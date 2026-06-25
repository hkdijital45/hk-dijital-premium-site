import { NextResponse } from "next/server";
import { getAdInsightsData, type AdInsightPlatform, type AdInsightRange } from "@/lib/ad-insights";
import { recordActionFailure, recordActivity } from "@/lib/activity-log";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { uuidPattern } from "@/lib/meta-pixel-admin";

export async function POST(request: Request) {
  const session = await requireModuleAccess("ad-insights");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const companyId = String(body.companyId || "");
  if (!uuidPattern.test(companyId)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });
  try {
    const data = await getAdInsightsData({
      companyId,
      range: (body.range || "last_30d") as AdInsightRange,
      platform: (body.platform || "all") as AdInsightPlatform,
      customFrom: body.from || "",
      customTo: body.to || "",
      analyze: false
    });
    if (hasSupabaseConfig()) {
      await supabaseRest("ad_insight_snapshots", {
        method: "POST",
        body: JSON.stringify({
          customer_id: companyId,
          platform: body.platform || "all",
          account_id: data.connection?.metaAdAccountId || data.connection?.googleAdsCustomerId || null,
          date_from: data.dateRange.from,
          date_to: data.dateRange.to,
          metrics: data.metrics,
          insights: { connection: data.connection, sourceType: data.sourceType },
          health_score: data.healthScore,
          source_type: data.sourceType
        })
      }).catch(() => null);
    }
    await recordActivity({ session, action: "API İşlemi", entity: "Reklam Yorum Merkezi", companyId, details: { message: "Reklam analiz snapshot kaydı oluşturuldu", result: "Başarılı", source_type: data.sourceType } }).catch(() => null);
    return NextResponse.json({ ...data, message: "Analiz snapshot kaydı oluşturuldu." });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    await recordActionFailure({ session, entity: "Reklam Yorum Merkezi", action: "Analiz snapshot kaydetme", error, companyId }).catch(() => null);
    return NextResponse.json({ error: safe.title, detail: safe.detail }, { status: 500 });
  }
}
