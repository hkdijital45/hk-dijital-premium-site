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
      analyze: true
    });
    if (hasSupabaseConfig()) {
      await supabaseRest("ad_ai_interpretations", {
        method: "POST",
        body: JSON.stringify({
          customer_id: companyId,
          platform: body.platform || "all",
          date_from: data.dateRange.from,
          date_to: data.dateRange.to,
          metrics: data.metrics,
          insights: {
            analysis: data.analysis,
            diagnoses: data.diagnoses || [],
            prescription: data.prescription || {},
            creative_analysis: data.creativeAnalysis || {},
            trend_analysis: data.trendAnalysis || {},
            competitor_analysis: data.competitorAnalysis || {},
            doctor_summary: data.doctorSummary || {},
            customer_message: data.customerMessage || "",
            urgency: data.urgency || {},
            potential_improvement: data.potentialImprovement || 0,
            weekly_change: data.weeklyChange || {},
            wasted_budget_estimate: data.wastedBudgetEstimate || 0,
            best_ad: data.bestAd || {},
            worst_ad: data.worstAd || {},
            winning_creative: data.winningCreative || {},
            action_recommendations: data.actionRecommendations || []
          },
          health_score: data.healthScore,
          source_type: data.sourceType
        })
      }).catch(() => null);
    }
    await recordActivity({ session, action: "Oluşturma", entity: "Reklam Doktoru Pro", companyId, details: { message: "AI reklam yorumu oluşturuldu", result: "Başarılı" } }).catch(() => null);
    return NextResponse.json(data);
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    await recordActionFailure({ session, entity: "Reklam Doktoru Pro", action: "AI yorum oluşturma", error, companyId }).catch(() => null);
    return NextResponse.json({ error: safe.title, detail: safe.detail }, { status: 500 });
  }
}
