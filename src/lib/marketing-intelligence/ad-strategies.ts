// Reklam Stratejisi Operasyon Sistemi — the real, versioned, status-
// tracked, editable ad_strategies table (see supabase/migrations/
// 20260925_ad_strategies.sql), replacing the old approach of patching a
// JSONB blob onto a generic hk_intelligence_ceo_runs row. Claude still
// gathers context via getAdsStrategyContext (marketing-intelligence/
// ads-strategy.ts, unchanged) and validates the core strategy shape via
// validateAdsStrategy (reused, not duplicated) — this module is only the
// new operational persistence layer: draft → approved → active →
// updated → archived, with a separate internal report and client report,
// both editable in HK Admin after Claude's initial save.
import { supabaseRest } from "@/lib/supabase";
import { validateAdsStrategy, getLatestAdsStrategy, AdsStrategyValidationError, type AdsStrategyInput } from "./ads-strategy";
import type { IntelligenceRun } from "./intelligence-store";

export { AdsStrategyValidationError };

export const AD_STRATEGY_STATUSES = ["draft", "approved", "active", "updated", "archived"] as const;
export type AdStrategyStatus = (typeof AD_STRATEGY_STATUSES)[number];
export const AD_STRATEGY_STATUS_LABELS: Record<AdStrategyStatus, string> = {
  draft: "Taslak", approved: "Onaylandı", active: "Uygulanıyor", updated: "Güncellendi", archived: "Arşivlendi"
};

export type CampaignSequenceItem = {
  order: number; name: string; objective?: string; conversionLocation?: string;
  dailyBudget?: number; purpose?: string; transitionCondition?: string;
};

export type RemarketingInfo = { required?: boolean; status?: "not_ready" | "ready" | "active"; condition?: string };

export type AdStrategyReportSection = { title: string; content: string };
export type AdStrategyReport = { executiveSummary?: string; sections?: AdStrategyReportSection[] };

export type AdStrategyRecord = {
  id: string;
  company_id: string;
  version: number;
  status: AdStrategyStatus;
  strategy_title: string;
  primary_platform: string;
  primary_goal: string;
  monthly_ad_budget: number | null;
  daily_budget_estimate: number | null;
  meta_budget: number | null;
  google_budget: number | null;
  primary_kpi: string;
  campaign_sequence: CampaignSequenceItem[];
  remarketing: RemarketingInfo;
  internal_report: AdStrategyReport;
  client_report: AdStrategyReport;
  full_strategy_payload: Record<string, unknown>;
  previous_strategy_id: string | null;
  source: string;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  activated_at: string | null;
  archived_at: string | null;
};

export const AD_STRATEGIES_TABLE = "ad_strategies";

export class AdStrategyCompanyNotFoundError extends Error {}
export class AdStrategyNotFoundError extends Error {}

async function assertCompanyExists(companyId: unknown): Promise<string> {
  if (typeof companyId !== "string" || !companyId.trim()) throw new AdStrategyCompanyNotFoundError("companyId zorunludur.");
  const rows = await supabaseRest<Array<{ id: string }>>(`companies?id=eq.${encodeURIComponent(companyId)}&select=id&limit=1`);
  if (!rows.length) throw new AdStrategyCompanyNotFoundError(`company_id doğrulanamadı: ${companyId}`);
  return companyId;
}

// --- Extended Claude-facing save input: the existing AdsStrategyInput
// (unchanged, backward compatible) plus a small set of OPTIONAL
// operational fields Claude can supply so the new record starts with a
// real title/platform/goal/campaign sequence/reports instead of empty
// placeholders. Every new field is optional — a caller using the old
// shape still produces a valid draft (with best-effort derived values).
export type AdStrategySaveInput = AdsStrategyInput & Partial<{
  strategyTitle: string;
  primaryPlatform: string;
  primaryGoal: string;
  primaryKpi: string;
  campaignSequence: CampaignSequenceItem[];
  remarketing: RemarketingInfo;
  internalReport: AdStrategyReport;
  clientReport: AdStrategyReport;
}>;

function derivePrimaryPlatform(input: AdsStrategyInput): string {
  const meta = input.metaStrategy.recommended;
  const google = input.googleStrategy.recommended;
  if (meta && google) return "Meta Ads + Google Ads";
  if (meta) return "Meta Ads";
  if (google) return "Google Ads";
  return "";
}

function deriveBudgets(input: AdsStrategyInput) {
  const total = Number(input.budget.totalMonthlyRecommended) || 0;
  const metaPct = Number(input.budget.platformSplit?.meta) || 0;
  const googlePct = Number(input.budget.platformSplit?.google) || 0;
  return {
    monthly: total || null,
    daily: total ? Number((total / 30).toFixed(2)) : null,
    meta: total && metaPct ? Number(((total * metaPct) / 100).toFixed(2)) : null,
    google: total && googlePct ? Number(((total * googlePct) / 100).toFixed(2)) : null
  };
}

// Nothing here is invented — every line is built directly from a field the
// caller (Claude) already submitted in the validated AdsStrategyInput, so
// even a caller using only the original schema (no new optional fields)
// gets a real, non-empty default report rather than a blank one.
function buildDefaultInternalReport(input: AdsStrategyInput): AdStrategyReport {
  const sections: AdStrategyReportSection[] = [
    { title: "Mevcut Durum / Yönetici Özeti", content: input.businessSummary },
    { title: "Meta Ads Stratejisi", content: `${input.metaStrategy.recommended ? "Önerilir" : "Önerilmez"} — ${input.metaStrategy.rationale}${input.metaStrategy.audience ? `\nHedef kitle: ${input.metaStrategy.audience}` : ""}${input.metaStrategy.placements ? `\nYerleşimler: ${input.metaStrategy.placements}` : ""}${input.metaStrategy.creative ? `\nKreatif: ${input.metaStrategy.creative}` : ""}` },
    { title: "Google Ads Stratejisi", content: `${input.googleStrategy.recommended ? "Önerilir" : "Önerilmez"} — ${input.googleStrategy.rationale}${input.googleStrategy.campaignTypes?.length ? `\n${input.googleStrategy.campaignTypes.map((c) => `${c.type}: ${c.rationale}`).join("\n")}` : ""}` },
    { title: "Bütçe Dağılımı", content: `Aylık toplam: ${input.budget.totalMonthlyRecommended} TL (Meta %${input.budget.platformSplit.meta} / Google %${input.budget.platformSplit.google})\n${input.budget.rationale}${!input.budget.hasHistoricalPerformance ? "\nNot: geçmiş reklam performans verisi yok; bütçe bir test önerisidir." : ""}` },
    { title: "30 Günlük Uygulama Planı", content: input.thirtyDayPlan.map((p) => `${p.phase}: ${p.description}`).join("\n") }
  ];
  if (input.kpis?.length) sections.push({ title: "KPI / Ölçüm Planı", content: input.kpis.join("\n") });
  if (input.risks?.length) sections.push({ title: "Riskler / Eksikler", content: input.risks.join("\n") });
  if (input.assumptions?.length) sections.push({ title: "Varsayımlar / Gerekçeler", content: input.assumptions.join("\n") });
  if (input.dataGaps?.length) sections.push({ title: "Veri Eksikleri", content: input.dataGaps.join("\n") });
  return { executiveSummary: input.businessSummary, sections };
}

function buildDefaultClientReport(input: AdsStrategyInput): AdStrategyReport {
  const sections: AdStrategyReportSection[] = [
    { title: "İşletmenin Dijital Reklam Hedefi", content: input.businessSummary },
    { title: "Önerilen Reklam Yaklaşımı", content: [input.metaStrategy.recommended && "Meta Ads (Instagram/Facebook)", input.googleStrategy.recommended && "Google Ads"].filter(Boolean).join(" ve ") || "Değerlendiriliyor" }
  ];
  if (input.metaStrategy.recommended) sections.push({ title: "Meta Ads Planı", content: input.metaStrategy.rationale });
  if (input.googleStrategy.recommended) sections.push({ title: "Google Ads Planı", content: input.googleStrategy.rationale });
  sections.push({ title: "Bütçe Planı", content: `Aylık önerilen toplam: ${input.budget.totalMonthlyRecommended} TL` });
  sections.push({ title: "İlk 30 Günlük Yol Haritası", content: input.thirtyDayPlan.map((p) => `${p.phase}: ${p.description}`).join("\n") });
  if (input.kpis?.length) sections.push({ title: "Başarının Nasıl Ölçüleceği", content: input.kpis.join("\n") });
  return { executiveSummary: input.businessSummary, sections };
}

/** Persists a new DRAFT ad strategy version for a company — never
 * APPROVED/ACTIVE automatically (that only ever happens via an explicit
 * later status-change action, see updateAdStrategyStatus). Always
 * verified against a real company row. Versioning: resolves this
 * company's own current latest row (any status) and chains
 * previous_strategy_id/version — a prior version is never overwritten or
 * deleted. */
export async function saveAdStrategyDraft(rawInput: unknown): Promise<AdStrategyRecord> {
  const validated = validateAdsStrategy(rawInput) as AdsStrategyInput;
  const input = rawInput as AdStrategySaveInput;
  await assertCompanyExists(validated.companyId);

  const [previous] = await supabaseRest<Array<{ id: string; version: number }>>(
    `${AD_STRATEGIES_TABLE}?company_id=eq.${encodeURIComponent(validated.companyId)}&select=id,version&order=version.desc,created_at.desc&limit=1`
  );

  const budgets = deriveBudgets(validated);
  const row = {
    company_id: validated.companyId,
    version: (previous?.version || 0) + 1,
    status: "draft",
    strategy_title: input.strategyTitle || `Reklam Stratejisi v${(previous?.version || 0) + 1}`,
    primary_platform: input.primaryPlatform || derivePrimaryPlatform(validated),
    primary_goal: input.primaryGoal || "",
    monthly_ad_budget: budgets.monthly,
    daily_budget_estimate: budgets.daily,
    meta_budget: budgets.meta,
    google_budget: budgets.google,
    primary_kpi: input.primaryKpi || validated.kpis?.[0] || "",
    campaign_sequence: input.campaignSequence || [],
    remarketing: input.remarketing || {},
    internal_report: input.internalReport || buildDefaultInternalReport(validated),
    client_report: input.clientReport || buildDefaultClientReport(validated),
    full_strategy_payload: validated,
    previous_strategy_id: previous?.id || null,
    source: "claude_mcp"
  };

  const rows = await supabaseRest<AdStrategyRecord[]>(AD_STRATEGIES_TABLE, { method: "POST", body: JSON.stringify(row) });
  return rows[0];
}

export async function getAdStrategyHistory(companyId: string): Promise<AdStrategyRecord[]> {
  await assertCompanyExists(companyId);
  return supabaseRest<AdStrategyRecord[]>(
    `${AD_STRATEGIES_TABLE}?company_id=eq.${encodeURIComponent(companyId)}&select=*&order=version.desc,created_at.desc`
  );
}

export async function getAdStrategyById(companyId: string, id: string): Promise<AdStrategyRecord> {
  const rows = await supabaseRest<AdStrategyRecord[]>(
    `${AD_STRATEGIES_TABLE}?id=eq.${encodeURIComponent(id)}&company_id=eq.${encodeURIComponent(companyId)}&select=*&limit=1`
  );
  if (!rows.length) throw new AdStrategyNotFoundError(`Strateji bulunamadı veya bu müşteriye ait değil: ${id}`);
  return rows[0];
}

export type AdStrategyForSetup = { strategy: AdStrategyRecord } | { strategy: null; message: string };

/** Meta/Google Ads setup source-of-truth resolution: prefers ACTIVE, then
 * APPROVED, then the most recent version of any other status — never a
 * DRAFT is silently treated as ready-to-implement unless it's genuinely
 * the only thing on file. */
export async function getAdStrategyForActivation(companyId: string): Promise<AdStrategyForSetup> {
  const history = await getAdStrategyHistory(companyId);
  if (!history.length) return { strategy: null, message: "Onaylı/aktif reklam stratejisi bulunamadı." };
  const active = history.find((s) => s.status === "active");
  if (active) return { strategy: active };
  const approved = history.find((s) => s.status === "approved");
  if (approved) return { strategy: approved };
  return { strategy: null, message: "Onaylı/aktif reklam stratejisi bulunamadı." };
}

export type AdStrategyUpdateInput = Partial<{
  strategy_title: string; primary_platform: string; primary_goal: string;
  monthly_ad_budget: number | null; daily_budget_estimate: number | null; meta_budget: number | null; google_budget: number | null;
  primary_kpi: string; campaign_sequence: CampaignSequenceItem[]; remarketing: RemarketingInfo;
  internal_report: AdStrategyReport; client_report: AdStrategyReport;
}>;

/** HK Admin edits — company ownership is enforced at the query level
 * (id AND company_id together), so one company's strategy can never be
 * edited via another company's session. Editing a strategy that is
 * currently APPROVED/ACTIVE also marks it UPDATED (an edited-after-
 * approval strategy should never silently keep looking untouched-approved). */
export async function updateAdStrategy(companyId: string, id: string, patch: AdStrategyUpdateInput): Promise<AdStrategyRecord> {
  const existing = await getAdStrategyById(companyId, id);
  const body: Record<string, unknown> = { ...patch };
  if (existing.status === "approved" || existing.status === "active") body.status = "updated";

  const rows = await supabaseRest<AdStrategyRecord[]>(
    `${AD_STRATEGIES_TABLE}?id=eq.${encodeURIComponent(id)}&company_id=eq.${encodeURIComponent(companyId)}&select=*`,
    { method: "PATCH", body: JSON.stringify(body) }
  );
  if (!rows.length) throw new AdStrategyNotFoundError(`Strateji bulunamadı veya bu müşteriye ait değil: ${id}`);
  return rows[0];
}

/** Status transitions — HK Dijital's own internal operational state only,
 * never touches any real Meta/Google ad account/campaign. Company
 * ownership enforced the same way as updateAdStrategy (fail closed). */
export async function updateAdStrategyStatus(companyId: string, id: string, status: AdStrategyStatus): Promise<AdStrategyRecord> {
  if (!AD_STRATEGY_STATUSES.includes(status)) throw new AdsStrategyValidationError(`Geçersiz durum: ${status}.`);
  await getAdStrategyById(companyId, id); // ownership check, fail closed
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status };
  if (status === "approved") patch.approved_at = now;
  if (status === "active") patch.activated_at = now;
  if (status === "archived") patch.archived_at = now;

  const rows = await supabaseRest<AdStrategyRecord[]>(
    `${AD_STRATEGIES_TABLE}?id=eq.${encodeURIComponent(id)}&company_id=eq.${encodeURIComponent(companyId)}&select=*`,
    { method: "PATCH", body: JSON.stringify(patch) }
  );
  if (!rows.length) throw new AdStrategyNotFoundError(`Strateji bulunamadı veya bu müşteriye ait değil: ${id}`);
  return rows[0];
}

/** Legacy fallback: a company with real, pre-existing ADS_STRATEGY_CREATED
 * activity in hk_intelligence_ceo_runs but no row yet in ad_strategies
 * (the new table). Read-only — legacy runs are never edited/versioned,
 * only shown so nothing already on file appears to have vanished. */
export async function getLegacyAdsStrategyRun(companyId: string): Promise<IntelligenceRun | null> {
  return getLatestAdsStrategy(companyId);
}
