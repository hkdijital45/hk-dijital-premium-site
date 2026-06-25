import { NextResponse } from "next/server";
import { getAdInsightsData, type AdInsightPlatform, type AdInsightRange } from "@/lib/ad-insights";
import { recordActionFailure, recordActivity } from "@/lib/activity-log";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError } from "@/lib/supabase";
import { uuidPattern } from "@/lib/meta-pixel-admin";

export async function GET(request: Request) {
  const session = await requireModuleAccess("ad-insights");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const companyId = params.get("companyId") || "";
  if (!uuidPattern.test(companyId)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });
  try {
    const data = await getAdInsightsData({
      companyId,
      range: (params.get("range") || "last_30d") as AdInsightRange,
      platform: (params.get("platform") || "all") as AdInsightPlatform,
      customFrom: params.get("from") || "",
      customTo: params.get("to") || "",
      analyze: params.get("analyze") === "true"
    });
    await recordActivity({ session, action: "Görüntüleme", entity: "Reklam Yorum Merkezi", companyId, details: { message: "Reklam analizi görüntülendi", result: "Başarılı" } }).catch(() => null);
    return NextResponse.json(data);
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    await recordActionFailure({ session, entity: "Reklam Yorum Merkezi", action: "Analiz verisi yükleme", error, companyId }).catch(() => null);
    return NextResponse.json({ error: safe.title, detail: safe.detail }, { status: 500 });
  }
}
