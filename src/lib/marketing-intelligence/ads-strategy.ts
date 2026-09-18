// Claude MCP ads-strategy: context gathering + schema-validated save/read.
// Reuses everything real that already exists — no new provider clients,
// no new Instagram/Meta/Google system, no new intelligence table. Saves
// into the same hk_intelligence_ceo_runs / hk_recommendations HK
// Intelligence already uses (activity_type: "ADS_STRATEGY_CREATED").
import { supabaseRest } from "@/lib/supabase";
import { getCustomerIntegrations, type CustomerIntegrationSummary } from "./customers";
import { getMetaAdsPerformance, getGoogleAdsPerformance } from "./ad-performance";
import { saveIntelligence, getIntelligenceHistory, type IntelligenceRun } from "./intelligence-store";
import { syncCompanyAnalytics, defaultSyncRange } from "@/lib/analytics-center/sync";
import { queryContentMetrics, analyticsTablesReady } from "@/lib/analytics-center/metrics-store";

type SocialSummary = { status: "data_available" | "data_unavailable"; reason?: string; postCount?: number; topPosts?: Array<{ format: string; likes: number; comments: number; permalink: string | null }> };

async function summarizeSocial(companyId: string, provider: "instagram" | "facebook", connected: boolean): Promise<SocialSummary> {
  if (!connected) return { status: "data_unavailable", reason: "not_connected" };
  if (!(await analyticsTablesReady())) return { status: "data_unavailable", reason: "analytics_tables_not_ready" };
  try {
    await syncCompanyAnalytics(companyId, [provider], defaultSyncRange());
    const rows = await queryContentMetrics(companyId, [provider], defaultSyncRange(), 10);
    if (!rows.length) return { status: "data_unavailable", reason: "no_recent_posts" };
    const top = [...rows].sort((a: any, b: any) => (b.likes || 0) - (a.likes || 0)).slice(0, 3);
    return {
      status: "data_available",
      postCount: rows.length,
      topPosts: top.map((r: any) => ({ format: r.media_type || r.format || "unknown", likes: r.likes || 0, comments: r.comments || 0, permalink: r.permalink || null }))
    };
  } catch (error) {
    return { status: "data_unavailable", reason: error instanceof Error ? error.message.slice(0, 200) : "error" };
  }
}

export type AdsStrategyContext = {
  company: { id: string; name: string; sector: string | null; city: string | null; website: string | null };
  integrations: CustomerIntegrationSummary;
  instagram: SocialSummary;
  facebook: SocialSummary;
  metaAds: unknown;
  googleAds: unknown;
  previousIntelligence: Array<{ id: string; title: string; activityType: string | undefined; createdAt: string }>;
  latestAdsStrategy: { id: string; createdAt: string; summary: string } | null;
};

/** Single, compact-as-possible call for everything Claude needs to build
 * a real ads strategy — never hundreds of raw rows, only real, already-
 * summarized data or an explicit data_unavailable + reason. */
export async function getAdsStrategyContext(companyId: string): Promise<AdsStrategyContext> {
  const [companies, integrations] = await Promise.all([
    supabaseRest<Array<{ id: string; name: string; sector: string | null; city: string | null; website: string | null }>>(`companies?id=eq.${encodeURIComponent(companyId)}&select=id,name,sector,city,website&limit=1`),
    getCustomerIntegrations(companyId)
  ]);
  const company = companies[0] || { id: companyId, name: "Bilinmiyor", sector: null, city: null, website: null };

  const [instagram, facebook, metaAds, googleAds, history] = await Promise.all([
    summarizeSocial(companyId, "instagram", integrations.instagram === "CONNECTED"),
    summarizeSocial(companyId, "facebook", integrations.facebook === "CONNECTED"),
    getMetaAdsPerformance(companyId),
    getGoogleAdsPerformance(companyId),
    getIntelligenceHistory(companyId, 5)
  ]);

  const latestAds = history.find((r) => r.final_report?.activity_type === "ADS_STRATEGY_CREATED") || null;

  return {
    company,
    integrations,
    instagram,
    facebook,
    metaAds,
    googleAds,
    previousIntelligence: history.slice(0, 5).map((r) => ({ id: r.id, title: r.command_text, activityType: r.final_report?.activity_type as string | undefined, createdAt: r.created_at })),
    latestAdsStrategy: latestAds ? { id: latestAds.id, createdAt: latestAds.created_at, summary: String(latestAds.final_report?.summary || "") } : null
  };
}

// --- Schema-validated strategy shape (validated in app code — no new dependency) ---
export type AdsStrategyInput = {
  companyId: string;
  dataSources: string[];
  dataPeriod: { start: string; end: string };
  confidence: "low" | "medium" | "high";
  assumptions?: string[];
  dataGaps?: string[];
  businessSummary: string;
  metaStrategy: { recommended: boolean; rationale: string; objective?: string; audience?: string; placements?: string; creative?: string; cta?: string; technicalGaps?: string[] };
  googleStrategy: { recommended: boolean; rationale: string; campaignTypes?: Array<{ type: string; rationale: string }> };
  budget: {
    hasHistoricalPerformance: boolean;
    meta?: { dailyMin: number; dailyMax: number; monthlyMin: number; monthlyMax: number };
    google?: { dailyMin: number; dailyMax: number; monthlyMin: number; monthlyMax: number };
    totalMonthlyRecommended: number;
    platformSplit: { meta: number; google: number };
    rationale: string;
  };
  kpis?: string[];
  thirtyDayPlan: Array<{ phase: string; description: string }>;
  risks?: string[];
  implementationGuide?: Record<string, unknown>;
  recommendations?: Array<{ title: string; recommendation_type: string; expected_impact?: string; priority?: string }>;
};

export class AdsStrategyValidationError extends Error {}

function req(cond: unknown, message: string) {
  if (!cond) throw new AdsStrategyValidationError(message);
}

export function validateAdsStrategy(input: unknown): AdsStrategyInput {
  const s = input as Partial<AdsStrategyInput>;
  req(s && typeof s === "object", "Strateji bir nesne olmalıdır.");
  req(typeof s.companyId === "string" && s.companyId, "companyId zorunludur.");
  req(Array.isArray(s.dataSources) && s.dataSources.length, "dataSources zorunludur.");
  req(s.dataPeriod && typeof s.dataPeriod.start === "string" && typeof s.dataPeriod.end === "string", "dataPeriod.start/end zorunludur.");
  req(["low", "medium", "high"].includes(String(s.confidence)), "confidence low/medium/high olmalıdır.");
  req(typeof s.businessSummary === "string" && s.businessSummary.length > 10, "businessSummary zorunludur.");
  req(s.metaStrategy && typeof s.metaStrategy.recommended === "boolean" && typeof s.metaStrategy.rationale === "string", "metaStrategy.recommended/rationale zorunludur.");
  req(s.googleStrategy && typeof s.googleStrategy.recommended === "boolean" && typeof s.googleStrategy.rationale === "string", "googleStrategy.recommended/rationale zorunludur.");
  req(s.budget && typeof s.budget.hasHistoricalPerformance === "boolean" && typeof s.budget.totalMonthlyRecommended === "number" && s.budget.platformSplit && typeof s.budget.rationale === "string", "budget alanları zorunludur.");
  req(Array.isArray(s.thirtyDayPlan) && s.thirtyDayPlan.length > 0 && s.thirtyDayPlan.every((p) => p.phase && p.description), "thirtyDayPlan zorunludur.");
  return s as AdsStrategyInput;
}

export async function saveAdsStrategy(input: AdsStrategyInput): Promise<{ run: IntelligenceRun; recommendationIds: string[]; deduped: boolean }> {
  return saveIntelligence({
    companyId: input.companyId,
    title: `Reklam Stratejisi — ${new Date().toISOString().slice(0, 10)}`,
    activityType: "ADS_STRATEGY_CREATED",
    sources: input.dataSources,
    periodStart: input.dataPeriod.start,
    periodEnd: input.dataPeriod.end,
    summary: input.businessSummary,
    findings: [
      `Meta: ${input.metaStrategy.recommended ? "önerilir" : "önerilmez"} — ${input.metaStrategy.rationale}`,
      `Google Ads: ${input.googleStrategy.recommended ? "önerilir" : "önerilmez"} — ${input.googleStrategy.rationale}`,
      `Bütçe: aylık ${input.budget.totalMonthlyRecommended} TL önerilir (Meta %${input.budget.platformSplit.meta} / Google %${input.budget.platformSplit.google}) — ${input.budget.rationale}`,
      ...(input.dataGaps || [])
    ],
    hypotheses: input.assumptions,
    recommendations: input.recommendations,
    actions: input.thirtyDayPlan.map((p) => `${p.phase}: ${p.description}`),
    measurementPlan: input.kpis
  }).then(async (result) => {
    // Full structured strategy (confidence, per-field detail, implementation
    // guide) doesn't fit save_marketing_intelligence's generic shape — patch
    // it onto the same run row's final_report right after creation so the
    // UI can render every section without a second table.
    await supabaseRest(`hk_intelligence_ceo_runs?id=eq.${result.run.id}`, {
      method: "PATCH",
      body: JSON.stringify({ final_report: { ...result.run.final_report, ads_strategy: input } })
    });
    return result;
  });
}

export async function getLatestAdsStrategy(companyId: string): Promise<IntelligenceRun | null> {
  const history = await getIntelligenceHistory(companyId, 10);
  return history.find((r) => r.final_report?.activity_type === "ADS_STRATEGY_CREATED") || null;
}
