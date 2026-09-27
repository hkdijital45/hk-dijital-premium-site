// Reklam Kreatif Raporu — the creative-production follow-on to a
// customer's ad_strategies record (Reklam Stratejisi → Kreatif Brief →
// Reklam Kreatif Raporu). Same proven pattern as ad-strategies.ts:
// versioned (never overwritten), status-tracked (draft -> approved ->
// active -> archived, always starting DRAFT), a separate internal report
// and client report, company-ownership-checked reads/writes. A company
// with no linked ad_strategy is never broken by this — ad_strategy_id is
// optional.
import { supabaseRest } from "@/lib/supabase";

export const AD_CREATIVE_REPORT_STATUSES = ["draft", "approved", "active", "archived"] as const;
export type AdCreativeReportStatus = (typeof AD_CREATIVE_REPORT_STATUSES)[number];
export const AD_CREATIVE_REPORT_STATUS_LABELS: Record<AdCreativeReportStatus, string> = {
  draft: "Taslak", approved: "Onaylandı", active: "Uygulanıyor", archived: "Arşivlendi"
};

export const CREATIVE_FORMATS = ["reels", "video", "story", "static", "carousel"] as const;
export type CreativeFormat = (typeof CREATIVE_FORMATS)[number];

export type StrategySummary = Partial<{
  campaignGoal: string; creativeRole: string; targetAudience: string;
  funnelStage: string; awarenessLevel: string; keyMessage: string; primaryCta: string;
  creativeAngles: string[];
}>;

export type AdCopy = Partial<{ primaryText: string; headline: string; description: string; cta: string }>;
export type VideoScene = Partial<{ order: number; startTime: string; endTime: string; visual: string; cameraAngle: string; shotType: string; onScreenText: string; voiceover: string; purpose: string }>;
export type StaticFields = Partial<{ size: string; platform: string; visualConcept: string; background: string; mainVisual: string; headline: string; subheadline: string; offer: string; cta: string; logoPlacement: string; designHierarchy: string; textDensity: string; designPitfallsToAvoid: string }>;
export type CarouselSlide = Partial<{ order: number; purpose: string; title: string; subtext: string; visualSuggestion: string; designNote: string }>;
export type StoryFields = Partial<{ aspectRatio: string; hook: string; mainMessage: string; visualSuggestion: string; cta: string; action: string; textPlacement: string; safeArea: string; sequence: string }>;

export type CreativeItem = Partial<{
  order: number; format: string; title: string; campaign: string; adSet: string;
  funnelStage: string; angle: string; hook: string; cta: string; priority: string;
  videoDuration: string;
  adCopy: AdCopy;
  videoScenes: VideoScene[];
  staticFields: StaticFields;
  carouselSlides: CarouselSlide[];
  storyFields: StoryFields;
  abTestVariant: string;
  requestedMaterials: string;
  details: string;
  internalNotes: string;
}>;

export type AbTestPlanItem = Partial<{ hypothesis: string; variable: string; constants: string; expectedBehavior: string; evaluationCriteria: string }>;
export type RequiredMaterial = Partial<{ name: string; description: string; quantity: string; format: string; instructions: string }>;
export type ChecklistItem = { label: string; checked: boolean };
export type CreativeReportSection = { title: string; content: string };
export type CreativeReportText = { executiveSummary?: string; sections?: CreativeReportSection[] };

export type AdCreativeReportRecord = {
  id: string; company_id: string; ad_strategy_id: string | null; ad_strategy_version: number | null;
  version: number; status: AdCreativeReportStatus; report_title: string;
  strategy_summary: StrategySummary;
  creatives: CreativeItem[];
  ab_test_plan: AbTestPlanItem[];
  required_materials: RequiredMaterial[];
  production_checklist: ChecklistItem[];
  internal_report: CreativeReportText;
  client_report: CreativeReportText;
  full_payload: Record<string, unknown>;
  previous_report_id: string | null;
  source: string;
  created_at: string; updated_at: string; approved_at: string | null; activated_at: string | null; archived_at: string | null;
};

export const AD_CREATIVE_REPORTS_TABLE = "ad_creative_reports";

export class AdCreativeReportValidationError extends Error {}
export class AdCreativeReportCompanyNotFoundError extends Error {}
export class AdCreativeReportNotFoundError extends Error {}

function req(cond: unknown, message: string) {
  if (!cond) throw new AdCreativeReportValidationError(message);
}

async function assertCompanyExists(companyId: unknown): Promise<string> {
  if (typeof companyId !== "string" || !companyId.trim()) throw new AdCreativeReportCompanyNotFoundError("companyId zorunludur.");
  const rows = await supabaseRest<Array<{ id: string }>>(`companies?id=eq.${encodeURIComponent(companyId)}&select=id&limit=1`);
  if (!rows.length) throw new AdCreativeReportCompanyNotFoundError(`company_id doğrulanamadı: ${companyId}`);
  return companyId;
}

export type CreativeReportSaveInput = {
  companyId: string;
  adStrategyId?: string;
  adStrategyVersion?: number;
  reportTitle?: string;
  strategySummary?: StrategySummary;
  creatives?: CreativeItem[];
  abTestPlan?: AbTestPlanItem[];
  requiredMaterials?: RequiredMaterial[];
  productionChecklist?: ChecklistItem[];
  internalReport?: CreativeReportText;
  clientReport?: CreativeReportText;
  /** Provenance tag only ("hk_admin" default, "claude_project" for MCP
   * saves) — never validated/required, purely informational, same idea
   * as ad_strategies.source. */
  source?: string;
};

function validateSaveInput(raw: unknown): CreativeReportSaveInput {
  const s = raw as Partial<CreativeReportSaveInput> & Record<string, unknown>;
  req(s && typeof s === "object", "Rapor bir nesne olmalıdır.");
  req(typeof s.companyId === "string" && s.companyId, "companyId zorunludur.");
  if (s.creatives !== undefined) {
    req(Array.isArray(s.creatives), "creatives bir dizi olmalıdır.");
    (s.creatives as unknown[]).forEach((item, i) => {
      req(item && typeof item === "object" && !Array.isArray(item), `creatives[${i}] bir nesne olmalıdır.`);
      const c = item as Record<string, unknown>;
      if (c.format !== undefined) req(typeof c.format === "string", `creatives[${i}].format string olmalıdır.`);
      if (c.order !== undefined) req(typeof c.order === "number", `creatives[${i}].order number olmalıdır.`);
    });
  }
  if (s.abTestPlan !== undefined) req(Array.isArray(s.abTestPlan), "abTestPlan bir dizi olmalıdır.");
  if (s.requiredMaterials !== undefined) req(Array.isArray(s.requiredMaterials), "requiredMaterials bir dizi olmalıdır.");
  if (s.productionChecklist !== undefined) {
    req(Array.isArray(s.productionChecklist), "productionChecklist bir dizi olmalıdır.");
    (s.productionChecklist as unknown[]).forEach((item, i) => {
      req(item && typeof item === "object", `productionChecklist[${i}] bir nesne olmalıdır.`);
      req(typeof (item as Record<string, unknown>).label === "string", `productionChecklist[${i}].label string olmalıdır.`);
    });
  }
  return s as CreativeReportSaveInput;
}

/** Persists a new DRAFT creative report version — never auto-approved.
 * Versions per company (previous_report_id chain), same as ad_strategies.
 * ad_strategy_id is optional and never validated beyond being a string —
 * a company with no strategy yet is never blocked. */
export async function saveCreativeReportDraft(rawInput: unknown): Promise<AdCreativeReportRecord> {
  const input = validateSaveInput(rawInput);
  await assertCompanyExists(input.companyId);

  const [previous] = await supabaseRest<Array<{ id: string; version: number }>>(
    `${AD_CREATIVE_REPORTS_TABLE}?company_id=eq.${encodeURIComponent(input.companyId)}&select=id,version&order=version.desc,created_at.desc&limit=1`
  );

  const row = {
    company_id: input.companyId,
    ad_strategy_id: input.adStrategyId || null,
    ad_strategy_version: input.adStrategyVersion ?? null,
    version: (previous?.version || 0) + 1,
    status: "draft",
    report_title: input.reportTitle || `Reklam Kreatif Raporu v${(previous?.version || 0) + 1}`,
    strategy_summary: input.strategySummary || {},
    creatives: input.creatives || [],
    ab_test_plan: input.abTestPlan || [],
    required_materials: input.requiredMaterials || [],
    production_checklist: input.productionChecklist || [],
    internal_report: input.internalReport || {},
    client_report: input.clientReport || {},
    full_payload: input,
    previous_report_id: previous?.id || null,
    source: input.source || "hk_admin"
  };

  const rows = await supabaseRest<AdCreativeReportRecord[]>(AD_CREATIVE_REPORTS_TABLE, { method: "POST", body: JSON.stringify(row) });
  return rows[0];
}

export async function getCreativeReportHistory(companyId: string): Promise<AdCreativeReportRecord[]> {
  await assertCompanyExists(companyId);
  return supabaseRest<AdCreativeReportRecord[]>(
    `${AD_CREATIVE_REPORTS_TABLE}?company_id=eq.${encodeURIComponent(companyId)}&select=*&order=version.desc,created_at.desc`
  );
}

export async function getCreativeReportById(companyId: string, id: string): Promise<AdCreativeReportRecord> {
  const rows = await supabaseRest<AdCreativeReportRecord[]>(
    `${AD_CREATIVE_REPORTS_TABLE}?id=eq.${encodeURIComponent(id)}&company_id=eq.${encodeURIComponent(companyId)}&select=*&limit=1`
  );
  if (!rows.length) throw new AdCreativeReportNotFoundError(`Rapor bulunamadı veya bu müşteriye ait değil: ${id}`);
  return rows[0];
}

export type CreativeReportUpdateInput = Partial<{
  report_title: string; strategy_summary: StrategySummary; creatives: CreativeItem[];
  ab_test_plan: AbTestPlanItem[]; required_materials: RequiredMaterial[]; production_checklist: ChecklistItem[];
  internal_report: CreativeReportText; client_report: CreativeReportText;
}>;

export const AD_CREATIVE_REPORT_EDITABLE_FIELDS = [
  "report_title", "strategy_summary", "creatives", "ab_test_plan", "required_materials", "production_checklist", "internal_report", "client_report"
] as const;

export class AdCreativeReportPatchValidationError extends Error {}

function reqPatch(cond: unknown, message: string) {
  if (!cond) throw new AdCreativeReportPatchValidationError(message);
}

export function validateCreativeReportPatch(raw: unknown): CreativeReportUpdateInput {
  reqPatch(raw && typeof raw === "object" && !Array.isArray(raw), "patch bir nesne olmalıdır.");
  const body = raw as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    reqPatch((AD_CREATIVE_REPORT_EDITABLE_FIELDS as readonly string[]).includes(key), `Bilinmeyen veya bu araçla güncellenemeyen alan: ${key}.`);
  }
  const patch: Record<string, unknown> = {};
  if ("report_title" in body) { reqPatch(typeof body.report_title === "string", "report_title string olmalıdır."); patch.report_title = body.report_title; }
  if ("strategy_summary" in body) { reqPatch(body.strategy_summary && typeof body.strategy_summary === "object", "strategy_summary bir nesne olmalıdır."); patch.strategy_summary = body.strategy_summary; }
  if ("creatives" in body) { reqPatch(Array.isArray(body.creatives), "creatives bir dizi olmalıdır."); patch.creatives = body.creatives; }
  if ("ab_test_plan" in body) { reqPatch(Array.isArray(body.ab_test_plan), "ab_test_plan bir dizi olmalıdır."); patch.ab_test_plan = body.ab_test_plan; }
  if ("required_materials" in body) { reqPatch(Array.isArray(body.required_materials), "required_materials bir dizi olmalıdır."); patch.required_materials = body.required_materials; }
  if ("production_checklist" in body) { reqPatch(Array.isArray(body.production_checklist), "production_checklist bir dizi olmalıdır."); patch.production_checklist = body.production_checklist; }
  if ("internal_report" in body) { reqPatch(body.internal_report && typeof body.internal_report === "object", "internal_report bir nesne olmalıdır."); patch.internal_report = body.internal_report; }
  if ("client_report" in body) { reqPatch(body.client_report && typeof body.client_report === "object", "client_report bir nesne olmalıdır."); patch.client_report = body.client_report; }
  reqPatch(Object.keys(patch).length > 0, "Güncellenecek en az bir alan gerekli.");
  return patch as CreativeReportUpdateInput;
}

/** Company-ownership enforced at the query level (id AND company_id
 * together) — same fail-closed pattern as ad_strategies. Pure partial
 * update: fields not in the patch are left untouched. */
export async function updateCreativeReport(companyId: string, id: string, patch: CreativeReportUpdateInput): Promise<AdCreativeReportRecord> {
  await getCreativeReportById(companyId, id);
  const rows = await supabaseRest<AdCreativeReportRecord[]>(
    `${AD_CREATIVE_REPORTS_TABLE}?id=eq.${encodeURIComponent(id)}&company_id=eq.${encodeURIComponent(companyId)}&select=*`,
    { method: "PATCH", body: JSON.stringify(patch) }
  );
  if (!rows.length) throw new AdCreativeReportNotFoundError(`Rapor bulunamadı veya bu müşteriye ait değil: ${id}`);
  return rows[0];
}

export async function updateCreativeReportStatus(companyId: string, id: string, status: AdCreativeReportStatus): Promise<AdCreativeReportRecord> {
  if (!AD_CREATIVE_REPORT_STATUSES.includes(status)) throw new AdCreativeReportValidationError(`Geçersiz durum: ${status}.`);
  await getCreativeReportById(companyId, id);
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status };
  if (status === "approved") patch.approved_at = now;
  if (status === "active") patch.activated_at = now;
  if (status === "archived") patch.archived_at = now;
  const rows = await supabaseRest<AdCreativeReportRecord[]>(
    `${AD_CREATIVE_REPORTS_TABLE}?id=eq.${encodeURIComponent(id)}&company_id=eq.${encodeURIComponent(companyId)}&select=*`,
    { method: "PATCH", body: JSON.stringify(patch) }
  );
  if (!rows.length) throw new AdCreativeReportNotFoundError(`Rapor bulunamadı veya bu müşteriye ait değil: ${id}`);
  return rows[0];
}

export type AdCreativeContext = {
  company: { id: string; name: string; sector: string | null; city: string | null };
  adStrategy: {
    id: string; version: number; status: string; strategyTitle: string;
    primaryPlatform: string; primaryGoal: string; primaryKpi: string;
    monthlyAdBudget: number | null; metaBudget: number | null; googleBudget: number | null;
    campaignSequence: unknown[]; remarketing: unknown;
  } | null;
  /** Only the sections actually relevant to creative production — never
   * the full internal report dump. Prefers a section explicitly titled
   * like a creative brief/handoff; otherwise falls back to the client-
   * safe report's own sections (already a compact, real summary), never
   * the internal report wholesale. */
  creativeBrief: Array<{ title: string; content: string }>;
  latestCreativeReport: { id: string; version: number; status: AdCreativeReportStatus; createdAt: string } | null;
};

/** Single, compact context call for the creative Claude Project — real
 * company + the company's own current ad strategy (if any) + only the
 * creative-relevant brief sections + the latest creative report's
 * identity (for revision). A company with no ad strategy or no prior
 * creative report is never blocked — both are simply null. */
export async function getAdCreativeContext(companyId: string): Promise<AdCreativeContext> {
  await assertCompanyExists(companyId);
  const { getAdStrategyForActivation } = await import("./ad-strategies");

  const [companies, activation, creativeHistory] = await Promise.all([
    supabaseRest<Array<{ id: string; name: string; sector: string | null; city: string | null }>>(`companies?id=eq.${encodeURIComponent(companyId)}&select=id,name,sector,city&limit=1`),
    getAdStrategyForActivation(companyId),
    getCreativeReportHistory(companyId)
  ]);
  const company = companies[0];
  const strategy = activation.strategy;

  let creativeBrief: Array<{ title: string; content: string }> = [];
  if (strategy) {
    const internalSections = strategy.internal_report?.sections || [];
    const briefSections = internalSections.filter((s) => /kreatif|creative/i.test(s.title));
    if (briefSections.length) creativeBrief = briefSections;
    else creativeBrief = strategy.client_report?.sections || [];
  }

  return {
    company: company ? { id: company.id, name: company.name, sector: company.sector, city: company.city } : { id: companyId, name: "Bilinmiyor", sector: null, city: null },
    adStrategy: strategy ? {
      id: strategy.id, version: strategy.version, status: strategy.status, strategyTitle: strategy.strategy_title,
      primaryPlatform: strategy.primary_platform, primaryGoal: strategy.primary_goal, primaryKpi: strategy.primary_kpi,
      monthlyAdBudget: strategy.monthly_ad_budget, metaBudget: strategy.meta_budget, googleBudget: strategy.google_budget,
      campaignSequence: strategy.campaign_sequence, remarketing: strategy.remarketing
    } : null,
    creativeBrief,
    latestCreativeReport: creativeHistory[0] ? { id: creativeHistory[0].id, version: creativeHistory[0].version, status: creativeHistory[0].status, createdAt: creativeHistory[0].created_at } : null
  };
}
