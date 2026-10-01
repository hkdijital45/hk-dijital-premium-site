// Reklam Değerlendirme — evaluates an ALREADY-RUNNING Meta Ads campaign's
// real performance against its approved ad_strategies record (never a new
// strategy). Same proven pattern as ad-strategies.ts/ad-creative-reports.ts:
// company-ownership-checked reads/writes, internal vs. client report
// split, a deterministic Claude prompt + manual paste-back import (no new
// paid AI API). Snapshot-immutable by design: metrics_snapshot/prompt_text/
// reports are frozen at generation time and never rewritten by a later
// live Meta sync — only decision/next_review/storage path fields and the
// report content itself (on a deliberate regenerate) are ever updated.
import { supabaseRest } from "@/lib/supabase";

export const AD_EVALUATION_STATUSES = ["draft", "evaluated", "archived"] as const;
export type AdEvaluationStatus = (typeof AD_EVALUATION_STATUSES)[number];
export const AD_EVALUATION_STATUS_LABELS: Record<AdEvaluationStatus, string> = {
  draft: "Taslak", evaluated: "Değerlendirildi", archived: "Arşivlendi"
};

export const AD_EVALUATION_DECISIONS = [
  "OBSERVE", "CONTINUE", "NO_CHANGE", "MONITOR", "CREATIVE_TEST", "CREATIVE_CHANGE",
  "AUDIENCE_TEST", "BUDGET_OPTIMIZATION", "ADSET_OPTIMIZATION", "REMARKETING",
  "TECHNICAL_ISSUE", "SALES_PROCESS_REVIEW", "INSUFFICIENT_DATA"
] as const;
export type AdEvaluationDecision = (typeof AD_EVALUATION_DECISIONS)[number];
export const AD_EVALUATION_DECISION_LABELS: Record<AdEvaluationDecision, string> = {
  OBSERVE: "Gözlemle", CONTINUE: "Devam Et", NO_CHANGE: "Değişiklik Yok", MONITOR: "İzle",
  CREATIVE_TEST: "Kreatif Testi", CREATIVE_CHANGE: "Kreatif Değişikliği", AUDIENCE_TEST: "Kitle Testi",
  BUDGET_OPTIMIZATION: "Bütçe Optimizasyonu", ADSET_OPTIMIZATION: "Reklam Seti Optimizasyonu",
  REMARKETING: "Yeniden Pazarlama", TECHNICAL_ISSUE: "Teknik Sorun",
  SALES_PROCESS_REVIEW: "Satış Süreci İncelemesi", INSUFFICIENT_DATA: "Veri Yetersiz"
};

export type EvaluationReportSection = { title: string; content: string };
export type EvaluationReportText = { executiveSummary?: string; sections?: EvaluationReportSection[] };

export type AdEvaluationRecord = {
  id: string; company_id: string; campaign_id: string | null; meta_campaign_id: string | null; ad_account_id: string | null;
  strategy_id: string | null; creative_strategy_id: string | null; previous_evaluation_id: string | null;
  evaluation_period_start: string | null; evaluation_period_end: string | null; campaign_age_hours: number | null;
  metrics_snapshot: Record<string, unknown>;
  prompt_text: string; claude_raw_response: string | null;
  internal_report: EvaluationReportText; client_report: EvaluationReportText;
  decision: AdEvaluationDecision | null; next_review_at: string | null; next_review_note: string | null;
  status: AdEvaluationStatus;
  internal_pdf_path: string | null; internal_docx_path: string | null; client_pdf_path: string | null; client_docx_path: string | null;
  source: string; created_at: string; updated_at: string;
};

export const AD_EVALUATIONS_TABLE = "ad_evaluations";

export class AdEvaluationValidationError extends Error {}
export class AdEvaluationCompanyNotFoundError extends Error {}
export class AdEvaluationNotFoundError extends Error {}

function req(cond: unknown, message: string) {
  if (!cond) throw new AdEvaluationValidationError(message);
}

async function assertCompanyExists(companyId: unknown): Promise<string> {
  if (typeof companyId !== "string" || !companyId.trim()) throw new AdEvaluationCompanyNotFoundError("companyId zorunludur.");
  const rows = await supabaseRest<Array<{ id: string }>>(`companies?id=eq.${encodeURIComponent(companyId)}&select=id&limit=1`);
  if (!rows.length) throw new AdEvaluationCompanyNotFoundError(`company_id doğrulanamadı: ${companyId}`);
  return companyId;
}

function matchesEntity(row: any, campaignId?: string | null, metaCampaignId?: string | null): boolean {
  return Boolean((metaCampaignId && row.meta_campaign_id === metaCampaignId) || (campaignId && row.campaign_id === campaignId));
}

function sumBy(rows: any[], keys: string[]): number {
  return rows.reduce((sum, row) => sum + keys.reduce((v, key) => v || Number(row[key] || 0), 0), 0);
}

function avgBy(rows: any[], key: string): number {
  if (!rows.length) return 0;
  return Number((sumBy(rows, [key]) / rows.length).toFixed(2));
}

/** Aggregates the already-synced campaign_metrics/meta_adset_metrics/
 * meta_ad_metrics rows (the same normalized tables the Meta sync engine
 * and Reklam Operasyon Merkezi already populate/read — no new Graph API
 * call here) into one real-data snapshot for a campaign+period. Returns
 * null per metric group when genuinely no rows matched — never a
 * fabricated zero. */
export function buildMetricsSnapshot(input: {
  campaignMetrics: any[]; adsetMetrics: any[]; adMetrics: any[];
  campaignId?: string | null; metaCampaignId?: string | null;
}) {
  const campaignRows = input.campaignMetrics.filter((r) => matchesEntity(r, input.campaignId, input.metaCampaignId));
  const adsetRows = input.adsetMetrics.filter((r) => matchesEntity(r, input.campaignId, input.metaCampaignId));
  const adRows = input.adMetrics.filter((r) => matchesEntity(r, input.campaignId, input.metaCampaignId));
  const campaign = campaignRows.length ? {
    spend: Number(sumBy(campaignRows, ["spend", "spent"]).toFixed(2)),
    reach: sumBy(campaignRows, ["reach"]),
    impressions: sumBy(campaignRows, ["impressions"]),
    clicks: sumBy(campaignRows, ["clicks"]),
    ctr: avgBy(campaignRows, "ctr"),
    cpc: avgBy(campaignRows, "cpc"),
    cpm: avgBy(campaignRows, "cpm"),
    results: sumBy(campaignRows, ["results", "leads"]),
    messages: sumBy(campaignRows, ["messages"]),
    costPerResult: (() => { const results = sumBy(campaignRows, ["results", "leads"]); return results ? Number((sumBy(campaignRows, ["spend", "spent"]) / results).toFixed(2)) : null; })(),
    frequency: campaignRows.some((r) => r.frequency) ? avgBy(campaignRows, "frequency") : (sumBy(campaignRows, ["reach"]) ? Number((sumBy(campaignRows, ["impressions"]) / sumBy(campaignRows, ["reach"])).toFixed(2)) : null)
  } : null;
  const adsets = adsetRows.map((r) => ({
    name: r.adset_name || "Adsız reklam seti", status: r.status || null,
    spend: Number(r.spend || 0), reach: Number(r.reach || 0), impressions: Number(r.impressions || 0),
    ctr: Number(r.ctr || 0), cpc: Number(r.cpc || 0), cpm: Number(r.cpm || 0), results: Number(r.results || r.leads || 0)
  }));
  const ads = adRows.map((r) => ({
    name: r.ad_name || "Adsız reklam", status: r.status || null,
    spend: Number(r.spend || 0), impressions: Number(r.impressions || 0), reach: Number(r.reach || 0),
    ctr: Number(r.ctr || 0), cpc: Number(r.cpc || 0), results: Number(r.results || r.leads || 0),
    creativeThumbnailUrl: r.creative_thumbnail_url || null
  }));
  return { campaign, adsets: adsets.length ? adsets : null, ads: ads.length ? ads : null, syncedAt: new Date().toISOString() };
}

function hoursSince(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return null;
  return Math.max(0, Number(((Date.now() - then) / 3_600_000).toFixed(1)));
}

export type AdEvaluationContext = {
  company: { id: string; name: string; sector: string | null; city: string | null };
  campaign: { id: string; name: string; metaCampaignId: string | null; status: string | null; startDate: string | null; objective: string | null; dailyBudget: number | null; lifetimeBudget: number | null } | null;
  adAccount: { accountId: string | null; source: string } | null;
  strategy: { id: string; version: number; status: string; strategyTitle: string; primaryGoal: string; primaryKpi: string; campaignSequence: unknown[] } | null;
  creativeStrategy: { id: string; version: number; status: string; creatives: unknown[] } | null;
  previousEvaluations: Array<{ id: string; createdAt: string; periodStart: string | null; periodEnd: string | null; decision: string | null }>;
  metricsSnapshot: ReturnType<typeof buildMetricsSnapshot>;
  campaignAgeHours: number | null;
};

/** Single, compact context call for the evaluation prompt — real company +
 * the matched local campaign (if any) + the currently-active ad strategy
 * + latest creative report + up to 3 prior evaluations + a real metrics
 * snapshot built from already-synced DB rows. Never calls the Meta Graph
 * API itself — "Mevcut Meta verilerini yenile/senkronize et" is the
 * existing /api/admin/meta-ads sync action; this only reads what that
 * already wrote. */
export async function getAdEvaluationContext(companyId: string, input: { campaignId?: string; metaCampaignId?: string; rangePreset?: string } = {}): Promise<AdEvaluationContext> {
  await assertCompanyExists(companyId);
  const { getAdStrategyForActivation } = await import("./ad-strategies");
  const { getCreativeReportHistory } = await import("./ad-creative-reports");

  const campaignLookup = input.campaignId
    ? `id=eq.${encodeURIComponent(input.campaignId)}&company_id=eq.${encodeURIComponent(companyId)}`
    : input.metaCampaignId
      ? `meta_campaign_id=eq.${encodeURIComponent(input.metaCampaignId)}&company_id=eq.${encodeURIComponent(companyId)}`
      : null;

  const [companies, campaignRows, strategyActivation, creativeHistory, previousRows] = await Promise.all([
    supabaseRest<Array<{ id: string; name: string; sector: string | null; city: string | null }>>(`companies?id=eq.${encodeURIComponent(companyId)}&select=id,name,sector,city&limit=1`),
    campaignLookup
      ? supabaseRest<any[]>(`campaigns?${campaignLookup}&select=*&limit=1`).catch(() => [])
      : Promise.resolve([]),
    getAdStrategyForActivation(companyId),
    getCreativeReportHistory(companyId).catch(() => []),
    supabaseRest<any[]>(`${AD_EVALUATIONS_TABLE}?company_id=eq.${encodeURIComponent(companyId)}&select=id,created_at,evaluation_period_start,evaluation_period_end,decision&order=created_at.desc&limit=3`).catch(() => [])
  ]);

  const company = companies[0];
  const campaign = campaignRows[0] || null;
  const strategy = strategyActivation.strategy;
  const latestCreative = creativeHistory[0] || null;

  const [campaignMetricsRaw, adsetMetricsRaw, adMetricsRaw] = await Promise.all([
    supabaseRest<any[]>(`campaign_metrics?company_id=eq.${encodeURIComponent(companyId)}&select=*&order=date.desc&limit=200`).catch(() => []),
    supabaseRest<any[]>(`meta_adset_metrics?company_id=eq.${encodeURIComponent(companyId)}&select=*&order=date.desc&limit=200`).catch(() => []),
    supabaseRest<any[]>(`meta_ad_metrics?company_id=eq.${encodeURIComponent(companyId)}&select=*&order=date.desc&limit=200`).catch(() => [])
  ]);

  // Scope the snapshot to the selected evaluation period (section 2's
  // "Değerlendirme tarih aralığı") — a row with no date_range_label at
  // all (legacy/manual data) is always kept, never hidden.
  const rangeLabel = rangeLabelFor(input.rangePreset);
  const matchesRange = (row: any) => !row.date_range_label || row.date_range_label === rangeLabel;
  const campaignMetrics = campaignMetricsRaw.filter(matchesRange);
  const adsetMetrics = adsetMetricsRaw.filter(matchesRange);
  const adMetrics = adMetricsRaw.filter(matchesRange);

  const metaCampaignId = campaign?.meta_campaign_id || null;
  const metricsSnapshot = buildMetricsSnapshot({
    campaignMetrics, adsetMetrics, adMetrics, campaignId: campaign?.id || null, metaCampaignId
  });

  return {
    company: company ? { id: company.id, name: company.name, sector: company.sector, city: company.city } : { id: companyId, name: "Bilinmiyor", sector: null, city: null },
    campaign: campaign ? {
      id: campaign.id, name: campaign.name, metaCampaignId: campaign.meta_campaign_id || null,
      status: campaign.status || null, startDate: campaign.meta_start_time || campaign.start_date || null, objective: campaign.objective || null,
      dailyBudget: campaign.daily_budget ?? null, lifetimeBudget: campaign.lifetime_budget ?? null
    } : null,
    adAccount: campaign?.meta_campaign_id ? { accountId: null, source: "hk_connect" } : null,
    strategy: strategy ? {
      id: strategy.id, version: strategy.version, status: strategy.status, strategyTitle: strategy.strategy_title,
      primaryGoal: strategy.primary_goal, primaryKpi: strategy.primary_kpi, campaignSequence: strategy.campaign_sequence || []
    } : null,
    creativeStrategy: latestCreative ? { id: latestCreative.id, version: latestCreative.version, status: latestCreative.status, creatives: latestCreative.creatives || [] } : null,
    previousEvaluations: previousRows.map((r) => ({ id: r.id, createdAt: r.created_at, periodStart: r.evaluation_period_start, periodEnd: r.evaluation_period_end, decision: r.decision })),
    metricsSnapshot,
    campaignAgeHours: hoursSince(campaign?.meta_start_time || campaign?.start_date)
  };
}

// Matches the exact date_range_label strings the Meta sync engine stamps
// onto campaign_metrics/meta_adset_metrics/meta_ad_metrics rows at sync
// time (see /api/admin/meta-ads's dateRangeForPreset) — same labels the
// Reklam Operasyon Merkezi UI's period buttons already use.
function rangeLabelFor(preset?: string): string {
  if (preset === "today") return "Bugün";
  if (preset === "last_7d") return "Son 7 Gün";
  return "Son 30 Gün";
}

export type AdEvaluationCreateInput = {
  companyId: string; campaignId?: string; metaCampaignId?: string; adAccountId?: string;
  strategyId?: string; creativeStrategyId?: string;
  evaluationPeriodStart?: string; evaluationPeriodEnd?: string; campaignAgeHours?: number;
  metricsSnapshot?: Record<string, unknown>; promptText: string;
  source?: string;
};

function validateCreateInput(raw: unknown): AdEvaluationCreateInput {
  const s = raw as Partial<AdEvaluationCreateInput> & Record<string, unknown>;
  req(s && typeof s === "object", "Değerlendirme bir nesne olmalıdır.");
  req(typeof s.companyId === "string" && s.companyId, "companyId zorunludur.");
  req(typeof s.promptText === "string" && s.promptText.trim().length > 0, "promptText zorunludur (boş prompt kaydedilemez).");
  return s as AdEvaluationCreateInput;
}

/** Persists the evaluation snapshot (metrics + prompt) as a new DRAFT —
 * this is the "reproducible snapshot" step (section 4): once saved, later
 * live Meta data changes never alter this row. */
export async function createAdEvaluationDraft(rawInput: unknown): Promise<AdEvaluationRecord> {
  const input = validateCreateInput(rawInput);
  await assertCompanyExists(input.companyId);
  const [previous] = await supabaseRest<Array<{ id: string }>>(
    `${AD_EVALUATIONS_TABLE}?company_id=eq.${encodeURIComponent(input.companyId)}${input.campaignId ? `&campaign_id=eq.${encodeURIComponent(input.campaignId)}` : ""}&select=id&order=created_at.desc&limit=1`
  ).catch(() => []);
  const row = {
    company_id: input.companyId,
    campaign_id: input.campaignId || null,
    meta_campaign_id: input.metaCampaignId || null,
    ad_account_id: input.adAccountId || null,
    strategy_id: input.strategyId || null,
    creative_strategy_id: input.creativeStrategyId || null,
    previous_evaluation_id: previous?.id || null,
    evaluation_period_start: input.evaluationPeriodStart || null,
    evaluation_period_end: input.evaluationPeriodEnd || null,
    campaign_age_hours: input.campaignAgeHours ?? null,
    metrics_snapshot: input.metricsSnapshot || {},
    prompt_text: input.promptText,
    status: "draft",
    source: input.source || "hk_admin"
  };
  const rows = await supabaseRest<AdEvaluationRecord[]>(AD_EVALUATIONS_TABLE, { method: "POST", body: JSON.stringify(row) });
  return rows[0];
}

export async function getAdEvaluationHistory(companyId: string, campaignId?: string): Promise<AdEvaluationRecord[]> {
  await assertCompanyExists(companyId);
  const campaignFilter = campaignId ? `&campaign_id=eq.${encodeURIComponent(campaignId)}` : "";
  return supabaseRest<AdEvaluationRecord[]>(`${AD_EVALUATIONS_TABLE}?company_id=eq.${encodeURIComponent(companyId)}${campaignFilter}&select=*&order=created_at.desc`);
}

export async function getAdEvaluationById(companyId: string, id: string): Promise<AdEvaluationRecord> {
  const rows = await supabaseRest<AdEvaluationRecord[]>(`${AD_EVALUATIONS_TABLE}?id=eq.${encodeURIComponent(id)}&company_id=eq.${encodeURIComponent(companyId)}&select=*&limit=1`);
  if (!rows.length) throw new AdEvaluationNotFoundError(`Değerlendirme bulunamadı veya bu müşteriye ait değil: ${id}`);
  return rows[0];
}

export type AdEvaluationParsedUpdate = {
  claudeRawResponse: string;
  internalReport: EvaluationReportText;
  clientReport: EvaluationReportText;
  decision?: AdEvaluationDecision | null;
  nextReviewAt?: string | null;
  nextReviewNote?: string | null;
};

/** Saves the parsed Claude paste-back — ownership-checked, pure partial
 * update, marks status "evaluated". Never touches metrics_snapshot/
 * prompt_text (the frozen generation-time snapshot). */
export async function saveParsedEvaluation(companyId: string, id: string, patch: AdEvaluationParsedUpdate): Promise<AdEvaluationRecord> {
  await getAdEvaluationById(companyId, id);
  req(typeof patch.claudeRawResponse === "string" && patch.claudeRawResponse.trim(), "claudeRawResponse zorunludur.");
  if (patch.decision) req((AD_EVALUATION_DECISIONS as readonly string[]).includes(patch.decision), `Geçersiz karar: ${patch.decision}.`);
  const rows = await supabaseRest<AdEvaluationRecord[]>(
    `${AD_EVALUATIONS_TABLE}?id=eq.${encodeURIComponent(id)}&company_id=eq.${encodeURIComponent(companyId)}&select=*`,
    {
      method: "PATCH",
      body: JSON.stringify({
        claude_raw_response: patch.claudeRawResponse,
        internal_report: patch.internalReport || {},
        client_report: patch.clientReport || {},
        decision: patch.decision ?? null,
        next_review_at: patch.nextReviewAt ?? null,
        next_review_note: patch.nextReviewNote ?? null,
        status: "evaluated"
      })
    }
  );
  if (!rows.length) throw new AdEvaluationNotFoundError(`Değerlendirme bulunamadı veya bu müşteriye ait değil: ${id}`);
  return rows[0];
}

export async function updateAdEvaluationStoragePaths(companyId: string, id: string, paths: Partial<Pick<AdEvaluationRecord, "internal_pdf_path" | "internal_docx_path" | "client_pdf_path" | "client_docx_path">>): Promise<AdEvaluationRecord> {
  await getAdEvaluationById(companyId, id);
  const rows = await supabaseRest<AdEvaluationRecord[]>(
    `${AD_EVALUATIONS_TABLE}?id=eq.${encodeURIComponent(id)}&company_id=eq.${encodeURIComponent(companyId)}&select=*`,
    { method: "PATCH", body: JSON.stringify(paths) }
  );
  if (!rows.length) throw new AdEvaluationNotFoundError(`Değerlendirme bulunamadı veya bu müşteriye ait değil: ${id}`);
  return rows[0];
}

export async function archiveAdEvaluation(companyId: string, id: string): Promise<AdEvaluationRecord> {
  await getAdEvaluationById(companyId, id);
  const rows = await supabaseRest<AdEvaluationRecord[]>(
    `${AD_EVALUATIONS_TABLE}?id=eq.${encodeURIComponent(id)}&company_id=eq.${encodeURIComponent(companyId)}&select=*`,
    { method: "PATCH", body: JSON.stringify({ status: "archived" }) }
  );
  if (!rows.length) throw new AdEvaluationNotFoundError(`Değerlendirme bulunamadı veya bu müşteriye ait değil: ${id}`);
  return rows[0];
}
