import { NextResponse } from "next/server";
import { recordActionFailure, recordActivity } from "@/lib/activity-log";
import { removeCustomerAsset, type CustomerAssetType, uploadCustomerAsset } from "@/lib/customer-assets";
import { getSafeSupabaseError } from "@/lib/supabase";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import { requireModuleAccess } from "@/lib/permissions";

const assetTypes = new Set<CustomerAssetType>([
  "logo",
  "logo_light",
  "logo_dark",
  "favicon",
  "social_profile",
  "social_cover",
  "instagram_profile",
  "facebook_cover",
  "linkedin_cover",
  "letterhead",
  "business_card",
  "brochure",
  "proposal_document",
  "brand_document"
]);

function normalizeAssetType(value: unknown): CustomerAssetType | null {
  const type = String(value || "") as CustomerAssetType;
  return assetTypes.has(type) ? type : null;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("musteriler");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });

  try {
    const form = await request.formData();
    const assetType = normalizeAssetType(form.get("assetType"));
    const file = form.get("file");
    const previousUrl = String(form.get("previousUrl") || "");
    if (!assetType) return NextResponse.json({ error: "Geçerli bir marka varlığı türü seçin." }, { status: 400 });
    if (!(file instanceof File)) return NextResponse.json({ error: "Yüklenecek dosya bulunamadı." }, { status: 400 });

    const result = await uploadCustomerAsset(id, assetType, file, previousUrl);
    await recordActivity({
      session,
      action: "Güncelleme",
      entity: "Marka Varlıkları",
      entityId: id,
      companyId: id,
      details: { message: "Müşteri marka dosyası yüklendi", result: "Başarılı", assetType }
    }).catch(() => null);
    return NextResponse.json({ ok: true, url: result.url, path: result.path, branding: result.branding, message: "Logo başarıyla yüklendi." });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    await recordActionFailure({ session, entity: "Marka Varlıkları", action: "Dosya yükleme", error, entityId: id, companyId: id }).catch(() => null);
    return NextResponse.json({ error: "Logo yüklenemedi. Dosya formatını ve boyutunu kontrol edin.", detail: safe.detail }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("musteriler");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });

  try {
    const body = await request.json().catch(() => ({}));
    const assetType = normalizeAssetType(body.assetType);
    if (!assetType) return NextResponse.json({ error: "Geçerli bir marka varlığı türü seçin." }, { status: 400 });
    const branding = await removeCustomerAsset(id, assetType, String(body.url || ""));
    await recordActivity({
      session,
      action: "Güncelleme",
      entity: "Marka Varlıkları",
      entityId: id,
      companyId: id,
      details: { message: "Müşteri marka dosyası kaldırıldı", result: "Başarılı", assetType }
    }).catch(() => null);
    return NextResponse.json({ ok: true, branding, message: "Marka dosyası kaldırıldı." });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    await recordActionFailure({ session, entity: "Marka Varlıkları", action: "Dosya kaldırma", error, entityId: id, companyId: id }).catch(() => null);
    return NextResponse.json({ error: "Dosya kaldırılamadı.", detail: safe.detail }, { status: 500 });
  }
}
