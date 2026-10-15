import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import { recordActivity } from "@/lib/activity-log";
import { getBusinessAdScope, listCampaignLinks, listCampaignOptions, removeCampaignLink, verifyCampaignLink } from "@/lib/business-ad-scope";
import { BusinessRelationshipNotFoundError } from "@/lib/business-relationships";
import { BusinessRelationshipValidationError } from "@/lib/business-relationships-shared";

// Reklam Doktoru Pro — Kampanya Eşleştirme (business ↔ verified campaigns).
function fail(error: unknown) {
  if (error instanceof BusinessRelationshipValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
  if (error instanceof BusinessRelationshipNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
  const message = error instanceof Error ? error.message : "";
  if (message.includes("23505")) return NextResponse.json({ error: "Bu kampanya bu işletmeye zaten eşleştirilmiş." }, { status: 409 });
  if (message.includes("PGRST205") || message.includes("42P01")) return NextResponse.json({ error: "Kampanya eşleştirme tablosu henüz oluşturulmadı (veritabanı migration'ı bekleniyor)." }, { status: 503 });
  return NextResponse.json({ error: "İşlem tamamlanamadı." }, { status: 500 });
}

export async function GET(request: Request) {
  const session = await requireModuleAccess("ad-insights");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const companyId = params.get("companyId") || "";
  const businessUnitId = params.get("businessUnitId") || "";
  if (!uuidPattern.test(companyId) || !uuidPattern.test(businessUnitId)) return NextResponse.json({ error: "Geçersiz müşteri veya işletme." }, { status: 400 });
  try {
    const [scope, campaigns, allLinks] = await Promise.all([getBusinessAdScope(companyId, businessUnitId), listCampaignOptions(companyId), listCampaignLinks(companyId)]);
    return NextResponse.json({ links: scope.links, sharedKeys: scope.sharedKeys, campaigns, claimedBy: allLinks.filter((link) => link.business_unit_id !== businessUnitId).map((link) => ({ platform: link.platform, campaign_key: link.campaign_key })) });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  const session = await requireModuleAccess("ad-insights");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (!uuidPattern.test(String(body.companyId || "")) || !uuidPattern.test(String(body.businessUnitId || ""))) return NextResponse.json({ error: "Geçersiz müşteri veya işletme." }, { status: 400 });
  try {
    const link = await verifyCampaignLink({
      companyId: body.companyId,
      businessUnitId: body.businessUnitId,
      platform: body.platform,
      campaignKey: String(body.campaignKey || ""),
      adAccountLabel: body.adAccountLabel ? String(body.adAccountLabel) : "",
      verifiedBy: session.profileId || null,
      confirmed: body.confirmed === true
    });
    await recordActivity({ session, action: "Güncelleme", entity: "Reklam Doktoru Pro", companyId: body.companyId, details: { message: `Kampanya işletmeye eşleştirildi: ${link.campaign_name}`, result: "Başarılı", businessUnitId: body.businessUnitId } }).catch(() => null);
    return NextResponse.json({ link });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: Request) {
  const session = await requireModuleAccess("ad-insights");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const id = params.get("id") || "";
  const companyId = params.get("companyId") || "";
  if (!uuidPattern.test(id) || !uuidPattern.test(companyId)) return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  try {
    await removeCampaignLink(id, companyId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
