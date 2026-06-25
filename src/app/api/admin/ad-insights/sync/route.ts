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
          previous_metrics: data.previousMetrics || {},
          weekly_change: data.weeklyChange || {},
          wasted_budget_estimate: data.wastedBudgetEstimate || 0,
          best_ad: data.bestAd || {},
          worst_ad: data.worstAd || {},
          winning_creative: data.winningCreative || {},
          action_recommendations: data.actionRecommendations || [],
          insights: {
            connection: data.connection,
            sourceType: data.sourceType,
            analysis: data.analysis,
            diagnoses: data.diagnoses || [],
            prescription: data.prescription || {},
            creative_analysis: data.creativeAnalysis || {},
            trend_analysis: data.trendAnalysis || {},
            competitor_analysis: data.competitorAnalysis || {},
            doctor_summary: data.doctorSummary || {},
            customer_message: data.customerMessage || "",
            urgency: data.urgency || {},
            potential_improvement: data.potentialImprovement || 0
          },
          health_score: data.healthScore,
          source_type: data.sourceType
        })
      }).catch(() => null);
    }
    await recordActivity({ session, action: "API İşlemi", entity: "Reklam Doktoru Pro", companyId, details: { message: "Reklam analiz snapshot kaydı oluşturuldu", result: "Başarılı", source_type: data.sourceType } }).catch(() => null);
    return NextResponse.json({ ...data, message: "Analiz snapshot kaydı oluşturuldu." });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    await recordActionFailure({ session, entity: "Reklam Doktoru Pro", action: "Analiz snapshot kaydetme", error, companyId }).catch(() => null);
    return NextResponse.json({ error: safe.title, detail: safe.detail }, { status: 500 });
  }
}
