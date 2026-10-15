import { NextResponse } from "next/server";
import { getAdInsightsData, type AdInsightPlatform, type AdInsightRange } from "@/lib/ad-insights";
import { recordActionFailure, recordActivity } from "@/lib/activity-log";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError } from "@/lib/supabase";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import { BusinessRelationshipValidationError } from "@/lib/business-relationships-shared";
import { BusinessRelationshipNotFoundError } from "@/lib/business-relationships";

export async function GET(request: Request) {
  const session = await requireModuleAccess("ad-insights");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const companyId = params.get("companyId") || "";
  if (!uuidPattern.test(companyId)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });
  const businessUnitId = params.get("businessUnitId") || "";
  if (businessUnitId && !uuidPattern.test(businessUnitId)) return NextResponse.json({ error: "Geçersiz işletme kimliği." }, { status: 400 });
  try {
    // A linked branch/brand only ever sees its own VERIFIED campaigns.
    let businessScope: Parameters<typeof getAdInsightsData>[0]["businessScope"];
    if (businessUnitId) {
      const [{ getBusinessAdScope }, { getBusinessUnit }] = await Promise.all([import("@/lib/business-ad-scope"), import("@/lib/business-relationships")]);
      const [scope, unit] = await Promise.all([getBusinessAdScope(companyId, businessUnitId), getBusinessUnit(businessUnitId)]);
      if (!scope.links.length) return NextResponse.json({ error: `${unit.name} için doğrulanmış kampanya eşleştirmesi yok.`, detail: "Önce Reklam Doktoru'ndaki 'Kampanya Eşleştirme' bölümünden bu işletmeye ait kampanyaları seçip onaylayın. Müşteri hesabının toplam verisi bu işletmeye atfedilmez.", code: "NO_VERIFIED_CAMPAIGNS" }, { status: 409 });
      businessScope = { name: unit.name, links: scope.links, sharedKeys: scope.sharedKeys };
    }
    const data = await getAdInsightsData({
      businessScope,
      companyId,
      range: (params.get("range") || "last_30d") as AdInsightRange,
      platform: (params.get("platform") || "all") as AdInsightPlatform,
      customFrom: params.get("from") || "",
      customTo: params.get("to") || "",
      analyze: params.get("analyze") === "true"
    });
    await recordActivity({ session, action: "Görüntüleme", entity: "Reklam Doktoru Pro", companyId, details: { message: "Reklam analizi görüntülendi", result: "Başarılı" } }).catch(() => null);
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof BusinessRelationshipValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof BusinessRelationshipNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    const safe = getSafeSupabaseError(error);
    await recordActionFailure({ session, entity: "Reklam Doktoru Pro", action: "Analiz verisi yükleme", error, companyId }).catch(() => null);
    return NextResponse.json({ error: safe.title, detail: safe.detail }, { status: 500 });
  }
}
