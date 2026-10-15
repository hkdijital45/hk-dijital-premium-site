// Rapor Merkezi V2 — server-side report access over the EXISTING report
// tables and document builders (no new table, no copied report content,
// no AI calls, nothing written). Every function here is owner-scoped:
//   - list:   the PostgREST query itself filters by the selected lead /
//             customer (and business unit) — never client-side filtering.
//   - load:   a report is fetched by id and then REJECTED unless its own
//             owner columns match the selected owner (and business unit),
//             so a guessed/foreign id can never be opened (no IDOR).
//   - render: the same builder + verified client logo the module's own
//             export uses, generated only when requested.
import "server-only";

import { supabaseRest } from "@/lib/supabase";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import { formatDateTr } from "@/lib/report-design";
import type { DocumentPayload, DocumentSection } from "@/lib/document-model";
import { withAutomaticCharts } from "@/lib/report-auto-charts";
import { REPORT_TYPE_BY_KEY, type ReportOwnerType, type ReportTypeDefinition, type ReportTypeKey, type ReportVariant } from "./catalog";

export class ReportCenterError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export type ReportOwner = { type: ReportOwnerType; id: string };
/** "main" = Ana İşletme (business_unit_id is null); "all" = owner's every
 * business; a uuid = one linked branch / related brand. */
export type BusinessScope = "main" | "all" | string;

export type ReportListParams = {
  owner: ReportOwner;
  business: BusinessScope;
  from?: string | null;
  to?: string | null;
  q?: string | null;
  includeArchived?: boolean;
  limit: number;
  offset: number;
};

export type ReportListItem = {
  ref: string;
  type: ReportTypeKey;
  sourceId: string;
  title: string;
  subtitle: string | null;
  date: string | null;
  period: string | null;
  status: string | null;
  statusLabel: string | null;
  archived: boolean;
  businessName: string | null;
  businessUnitId: string | null;
  variants: ReportVariant[];
  formats: { pdf: boolean; docx: boolean };
  storedFile: boolean;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function enc(value: string) {
  return encodeURIComponent(value);
}

/** Search text safe for a PostgREST ilike filter value. */
function searchTerm(q: string | null | undefined): string | null {
  const clean = String(q || "").replace(/[*,()\\%_:"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  return clean.length >= 2 ? clean : null;
}

function ownerColumn(owner: ReportOwner) {
  return owner.type === "lead" ? "lead_id" : "company_id";
}

export function assertOwner(owner: ReportOwner) {
  if (owner.type !== "lead" && owner.type !== "company") throw new ReportCenterError("Geçerli bir kayıt türü seçin (Lead veya Müşteri).");
  if (!uuidPattern.test(owner.id)) throw new ReportCenterError("Geçerli bir lead veya müşteri seçin.");
}

function assertOwnerSupported(def: ReportTypeDefinition, owner: ReportOwner) {
  if (!def.owners.includes(owner.type)) {
    throw new ReportCenterError(def.owners[0] === "company" ? `${def.label} yalnızca müşteri kayıtları için tutulur.` : `${def.label} yalnızca lead kayıtları için tutulur.`);
  }
}

/** Verifies a business-unit scope belongs to the owner (server-side). */
async function resolveBusinessScope(def: ReportTypeDefinition, owner: ReportOwner, business: BusinessScope): Promise<BusinessScope> {
  if (!def.businessUnits) return "all";
  if (business === "main" || business === "all") return business;
  if (!uuidPattern.test(business)) throw new ReportCenterError("Geçerli bir işletme / şube seçin.");
  const { assertUnitLinkedTo } = await import("@/lib/business-relationships");
  try {
    await assertUnitLinkedTo(business, { type: owner.type === "lead" ? "lead" : "company", id: owner.id });
  } catch {
    throw new ReportCenterError("Seçilen işletme bu kayda bağlı değil.", 403);
  }
  return business;
}

function businessFilter(scope: BusinessScope): string {
  if (scope === "main") return "&business_unit_id=is.null";
  if (scope === "all") return "";
  return `&business_unit_id=eq.${enc(scope)}`;
}

function dateFilters(column: string, from?: string | null, to?: string | null) {
  let out = "";
  if (from && DATE_RE.test(from)) out += `&${column}=gte.${from}`;
  if (to && DATE_RE.test(to)) out += `&${column}=lte.${column.endsWith("_at") ? `${to}T23:59:59.999Z` : to}`;
  return out;
}

function page(limit: number, offset: number) {
  return `&limit=${limit + 1}&offset=${offset}`;
}

async function unitNames(ids: Array<string | null | undefined>): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id) && uuidPattern.test(String(id))))];
  if (!unique.length) return new Map();
  const rows = await supabaseRest<Array<{ id: string; name: string }>>(`business_units?id=in.(${unique.join(",")})&select=id,name`).catch(() => []);
  return new Map(rows.map((r) => [r.id, r.name]));
}

function hasText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function variantsFrom(def: ReportTypeDefinition, internal: boolean, client: boolean): ReportVariant[] {
  const out: ReportVariant[] = [];
  if (def.variants.includes("client") && client) out.push("client");
  if (def.variants.includes("internal") && internal) out.push("internal");
  return out;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Taslak", approved: "Onaylandı", active: "Aktif", updated: "Güncellendi", archived: "Arşivlendi", evaluated: "Değerlendirildi",
  submitted: "Kaydedildi", completed: "Tamamlandı", partial: "Kısmi", failed: "Başarısız", running: "Devam ediyor"
};

function statusLabel(status: unknown): string | null {
  const s = String(status || "").trim();
  return s ? STATUS_LABELS[s] || s : null;
}

// ---------------------------------------------------------------------------
// LIST

type Lister = (def: ReportTypeDefinition, p: ReportListParams, scope: BusinessScope) => Promise<ReportListItem[]>;

function base(def: ReportTypeDefinition, sourceId: string, partial: Partial<ReportListItem>): ReportListItem {
  return {
    ref: `${def.key}:${sourceId}`, type: def.key, sourceId,
    title: partial.title || def.label, subtitle: partial.subtitle ?? null,
    date: partial.date ?? null, period: partial.period ?? null,
    status: partial.status ?? null, statusLabel: partial.statusLabel ?? statusLabel(partial.status),
    archived: Boolean(partial.archived), businessName: partial.businessName ?? null, businessUnitId: partial.businessUnitId ?? null,
    variants: partial.variants || def.variants, formats: def.formats, storedFile: Boolean(def.storedFile)
  };
}

const listPreAudit: Lister = async (def, p, scope) => {
  const reportType = def.key === "pre_audit_internal" ? "INTERNAL_REPORT" : "CLIENT_REPORT";
  const q = searchTerm(p.q);
  const rows = await supabaseRest<any[]>(
    `pre_audit_reports?select=id,title,status,report_date,created_at,business_unit_id&${ownerColumn(p.owner)}=eq.${enc(p.owner.id)}&report_type=eq.${reportType}${businessFilter(scope)}`
    + (p.includeArchived ? "" : "&or=(status.is.null,status.neq.archived)")
    + (q ? `&title=ilike.*${enc(q)}*` : "")
    + dateFilters("report_date", p.from, p.to)
    + `&order=report_date.desc,created_at.desc${page(p.limit, p.offset)}`
  );
  const names = await unitNames(rows.map((r) => r.business_unit_id));
  return rows.map((r) => base(def, r.id, {
    title: r.title || def.label, date: r.report_date || r.created_at, status: r.status, archived: r.status === "archived",
    businessUnitId: r.business_unit_id || null, businessName: r.business_unit_id ? names.get(r.business_unit_id) || "Bağlı işletme" : null
  }));
};

const listManual = (instagram: boolean): Lister => async (def, p, scope) => {
  const { MODULE_LABELS } = await import("@/lib/manual-evaluations-shared");
  const q = searchTerm(p.q);
  const rows = await supabaseRest<any[]>(
    `manual_evaluations?select=id,module,title,status,source,created_at,business_unit_id&${ownerColumn(p.owner)}=eq.${enc(p.owner.id)}&module=${instagram ? "eq" : "neq"}.instagram${businessFilter(scope)}`
    + (q ? `&title=ilike.*${enc(q)}*` : "")
    + dateFilters("created_at", p.from, p.to)
    + `&order=created_at.desc${page(p.limit, p.offset)}`
  );
  const names = await unitNames(rows.map((r) => r.business_unit_id));
  return rows.map((r) => base(def, r.id, {
    title: r.title || def.label, subtitle: instagram ? null : MODULE_LABELS[r.module as keyof typeof MODULE_LABELS] || r.module,
    date: r.created_at, status: r.status, businessUnitId: r.business_unit_id || null,
    businessName: r.business_unit_id ? names.get(r.business_unit_id) || "Bağlı işletme" : null
  }));
};

const listCandidate: Lister = async (def, p, scope) => {
  const q = searchTerm(p.q);
  const rows = await supabaseRest<any[]>(
    `candidate_evaluations?select=id,title,report_date,recommendation,priority,score,created_at,business_unit_id&${ownerColumn(p.owner)}=eq.${enc(p.owner.id)}${businessFilter(scope)}`
    + (q ? `&title=ilike.*${enc(q)}*` : "")
    + dateFilters("report_date", p.from, p.to)
    + `&order=report_date.desc,created_at.desc${page(p.limit, p.offset)}`
  );
  const names = await unitNames(rows.map((r) => r.business_unit_id));
  return rows.map((r) => base(def, r.id, {
    title: r.title || def.label,
    subtitle: [r.recommendation, r.priority ? `Öncelik: ${r.priority}` : "", typeof r.score === "number" ? `Puan: ${r.score}` : ""].filter(Boolean).join(" · ") || null,
    date: r.report_date || r.created_at, businessUnitId: r.business_unit_id || null,
    businessName: r.business_unit_id ? names.get(r.business_unit_id) || "Bağlı işletme" : null
  }));
};

const listInstagramAudit: Lister = async (def, p) => {
  const q = searchTerm(p.q);
  const rows = await supabaseRest<any[]>(
    `instagram_profile_audits?select=id,instagram_username,audit_date,status,created_at&company_id=eq.${enc(p.owner.id)}`
    + (q ? `&instagram_username=ilike.*${enc(q)}*` : "")
    + dateFilters("audit_date", p.from, p.to)
    + `&order=audit_date.desc,created_at.desc${page(p.limit, p.offset)}`
  );
  return rows.map((r) => base(def, r.id, { title: `Instagram Profil Analizi${r.instagram_username ? ` — @${String(r.instagram_username).replace(/^@/, "")}` : ""}`, date: r.audit_date || r.created_at, status: r.status }));
};

/** Reports with internal_report / client_report jsonb: only the first
 * section title and summary are selected to learn which variants exist. */
function availabilitySelect() {
  return "ies:internal_report->>executiveSummary,ist:internal_report->sections->0->>title,ces:client_report->>executiveSummary,cst:client_report->sections->0->>title";
}

const listAdEvaluation: Lister = async (def, p) => {
  const rows = await supabaseRest<any[]>(
    `ad_evaluations?select=id,status,decision,campaign_id,meta_campaign_id,evaluation_period_start,evaluation_period_end,created_at,${availabilitySelect()}&company_id=eq.${enc(p.owner.id)}`
    + (p.includeArchived ? "" : "&status=neq.archived")
    + dateFilters("created_at", p.from, p.to)
    + `&order=created_at.desc${page(p.limit, p.offset)}`
  );
  const campaignIds = [...new Set(rows.map((r) => r.campaign_id).filter((id) => uuidPattern.test(String(id || ""))))];
  const campaigns = campaignIds.length ? await supabaseRest<Array<{ id: string; name: string }>>(`campaigns?id=in.(${campaignIds.join(",")})&select=id,name`).catch(() => []) : [];
  const nameById = new Map(campaigns.map((c) => [c.id, c.name]));
  const q = searchTerm(p.q)?.toLocaleLowerCase("tr");
  return rows
    .map((r) => {
      const campaign = (r.campaign_id && nameById.get(r.campaign_id)) || r.meta_campaign_id || "Kampanya";
      return base(def, r.id, {
        title: `Reklam Değerlendirmesi — ${campaign}`, date: r.created_at, status: r.status, archived: r.status === "archived",
        period: r.evaluation_period_start && r.evaluation_period_end ? `${formatDateTr(r.evaluation_period_start)} – ${formatDateTr(r.evaluation_period_end)}` : null,
        variants: variantsFrom(def, hasText(r.ies) || hasText(r.ist), hasText(r.ces) || hasText(r.cst))
      });
    })
    .filter((item) => !q || item.title.toLocaleLowerCase("tr").includes(q));
};

const listStrategyLike = (table: "ad_strategies" | "ad_creative_reports"): Lister => async (def, p) => {
  const titleCol = table === "ad_strategies" ? "strategy_title" : "report_title";
  const q = searchTerm(p.q);
  const rows = await supabaseRest<any[]>(
    `${table}?select=id,${titleCol},version,status,created_at,updated_at,${availabilitySelect()}&company_id=eq.${enc(p.owner.id)}`
    + (p.includeArchived ? "" : "&status=neq.archived")
    + (q ? `&${titleCol}=ilike.*${enc(q)}*` : "")
    + dateFilters("created_at", p.from, p.to)
    + `&order=created_at.desc${page(p.limit, p.offset)}`
  );
  return rows.map((r) => base(def, r.id, {
    title: r[titleCol] || `${def.label} v${r.version}`, subtitle: r.version ? `Versiyon ${r.version}` : null,
    date: r.updated_at || r.created_at, status: r.status, archived: r.status === "archived",
    variants: variantsFrom(def, hasText(r.ies) || hasText(r.ist), hasText(r.ces) || hasText(r.cst))
  }));
};

const listProposals: Lister = async (def, p) => {
  const q = searchTerm(p.q);
  const rows = await supabaseRest<any[]>(
    `proposals?select=id,title,proposal_number,version,status,valid_until,created_at,archived_at&${ownerColumn(p.owner)}=eq.${enc(p.owner.id)}&deleted_at=is.null`
    + (p.includeArchived ? "" : "&archived_at=is.null")
    + (q ? `&title=ilike.*${enc(q)}*` : "")
    + dateFilters("created_at", p.from, p.to)
    + `&order=created_at.desc${page(p.limit, p.offset)}`
  );
  return rows.map((r) => base(def, r.id, {
    title: r.title || `Teklif ${r.proposal_number || ""}`.trim(),
    subtitle: [r.proposal_number, r.version ? `v${r.version}` : "", r.valid_until ? `Geçerlilik: ${formatDateTr(r.valid_until)}` : ""].filter(Boolean).join(" · ") || null,
    date: r.created_at, status: r.status, archived: Boolean(r.archived_at)
  }));
};

const listCustomerReports: Lister = async (def, p) => {
  const q = searchTerm(p.q);
  const rows = await supabaseRest<any[]>(
    `reports?select=id,title,report_type,period,start_date,end_date,status,archived,created_at,business_name&${ownerColumn(p.owner)}=eq.${enc(p.owner.id)}&deleted_at=is.null`
    + (p.includeArchived ? "" : "&or=(archived.is.null,archived.eq.false)")
    + (q ? `&title=ilike.*${enc(q)}*` : "")
    + dateFilters("created_at", p.from, p.to)
    + `&order=created_at.desc${page(p.limit, p.offset)}`
  );
  return rows.map((r) => base(def, r.id, {
    title: r.title || r.report_type || def.label, subtitle: r.title && r.report_type ? r.report_type : null,
    date: r.created_at, period: r.period || (r.start_date && r.end_date ? `${formatDateTr(r.start_date)} – ${formatDateTr(r.end_date)}` : null),
    status: r.archived ? "archived" : r.status, archived: Boolean(r.archived)
  }));
};

const listMonthly: Lister = async (def, p) => {
  const q = searchTerm(p.q);
  const rows = await supabaseRest<any[]>(
    `monthly_reports?select=id,report_month,status,visible_to_customer,created_at&company_id=eq.${enc(p.owner.id)}`
    + (q ? `&report_month=ilike.*${enc(q)}*` : "")
    + dateFilters("created_at", p.from, p.to)
    + `&order=created_at.desc${page(p.limit, p.offset)}`
  );
  return rows.map((r) => base(def, r.id, {
    title: `Aylık Rapor — ${r.report_month || "Dönem belirtilmemiş"}`, period: r.report_month || null, date: r.created_at, status: r.status,
    subtitle: r.visible_to_customer ? "Müşteriye açık" : "Müşteriye kapalı"
  }));
};

const listAnalytics: Lister = async (def, p) => {
  const q = searchTerm(p.q);
  const rows = await supabaseRest<any[]>(
    `analytics_reports?select=id,title,period_start,period_end,created_at,document_id&company_id=eq.${enc(p.owner.id)}`
    + (q ? `&title=ilike.*${enc(q)}*` : "")
    + dateFilters("created_at", p.from, p.to)
    + `&order=created_at.desc${page(p.limit, p.offset)}`
  );
  return rows.map((r) => ({
    ...base(def, r.id, {
      title: r.title || def.label, date: r.created_at,
      period: r.period_start && r.period_end ? `${formatDateTr(r.period_start)} – ${formatDateTr(r.period_end)}` : null
    }),
    // The PDF is the stored file; without one only the summary can be viewed.
    formats: { pdf: Boolean(r.document_id), docx: false }
  }));
};

const listGemini: Lister = async (def, p) => {
  const rows = await supabaseRest<any[]>(
    `gemini_visibility_scans?select=id,status,score,started_at&company_id=eq.${enc(p.owner.id)}&status=in.(completed,partial)`
    + dateFilters("started_at", p.from, p.to)
    + `&order=started_at.desc${page(p.limit, p.offset)}`
  );
  return rows.map((r) => base(def, r.id, { title: "Gemini Görünürlük Raporu", subtitle: typeof r.score === "number" ? `Görünürlük skoru: ${r.score}/100` : null, date: r.started_at, status: r.status }));
};

const listContentPlan: Lister = async (def, p) => {
  if (p.offset > 0) return [];
  const [first, last] = await Promise.all([
    supabaseRest<Array<{ scheduled_date: string }>>(`social_content_plan_items?select=scheduled_date&company_id=eq.${enc(p.owner.id)}&order=scheduled_date.asc&limit=1`).catch(() => []),
    supabaseRest<Array<{ scheduled_date: string; updated_at?: string }>>(`social_content_plan_items?select=scheduled_date&company_id=eq.${enc(p.owner.id)}&order=scheduled_date.desc&limit=1`).catch(() => [])
  ]);
  if (!first[0]) return [];
  return [base(def, p.owner.id, {
    title: "Instagram İçerik Planı", period: `${formatDateTr(first[0].scheduled_date)} – ${formatDateTr(last[0]?.scheduled_date || first[0].scheduled_date)}`,
    date: last[0]?.scheduled_date || first[0].scheduled_date, subtitle: "Güncel plan (İçerik Takip)"
  })];
};

const LISTERS: Record<ReportTypeKey, Lister> = {
  pre_audit_internal: listPreAudit, pre_audit_client: listPreAudit,
  instagram_evaluation: listManual(true), manual_evaluation: listManual(false),
  instagram_profile_audit: listInstagramAudit,
  ad_evaluation: listAdEvaluation, ad_strategy: listStrategyLike("ad_strategies"), ad_creative_report: listStrategyLike("ad_creative_reports"),
  candidate_evaluation: listCandidate, proposal: listProposals,
  customer_report: listCustomerReports, monthly_report: listMonthly,
  analytics_report: listAnalytics, gemini_visibility: listGemini, content_plan: listContentPlan
};

export async function listReports(type: ReportTypeKey, params: ReportListParams): Promise<{ items: ReportListItem[]; hasMore: boolean }> {
  const def = REPORT_TYPE_BY_KEY.get(type);
  if (!def) throw new ReportCenterError("Geçersiz rapor türü.");
  assertOwner(params.owner);
  assertOwnerSupported(def, params.owner);
  const scope = await resolveBusinessScope(def, params.owner, params.business);
  const rows = await LISTERS[type](def, params, scope);
  return { items: rows.slice(0, params.limit), hasMore: rows.length > params.limit };
}

// ---------------------------------------------------------------------------
// LOAD + RENDER (owner-verified)

export type LoadedReport = {
  def: ReportTypeDefinition;
  sourceId: string;
  title: string;
  /** Builds the same document the module's own export renders. */
  build: (variant: ReportVariant) => Promise<DocumentPayload>;
  variants: ReportVariant[];
  logoScope: { companyId?: string | null; leadId?: string | null; businessUnitId?: string | null };
  fileBase: string;
  /** For stored-file types only. */
  storedUrl?: string | null;
};

async function ownerDisplayName(owner: ReportOwner): Promise<string> {
  if (owner.type === "company") {
    const rows = await supabaseRest<Array<{ name: string }>>(`companies?id=eq.${enc(owner.id)}&select=name&limit=1`).catch(() => []);
    return rows[0]?.name || "Müşteri";
  }
  const rows = await supabaseRest<Array<{ company: string | null; name: string | null }>>(`leads?id=eq.${enc(owner.id)}&select=company,name&limit=1`).catch(() => []);
  return rows[0]?.company || rows[0]?.name || "Lead";
}

function matchesOwner(row: { company_id?: string | null; lead_id?: string | null }, owner: ReportOwner) {
  return owner.type === "company" ? row.company_id === owner.id : row.lead_id === owner.id;
}

function notFound(): never {
  throw new ReportCenterError("Rapor bulunamadı veya seçilen kayda ait değil.", 404);
}

function checkBusiness(scope: BusinessScope, rowUnit: string | null | undefined) {
  if (scope === "all") return;
  if (scope === "main" && rowUnit) notFound();
  if (scope !== "main" && rowUnit !== scope) notFound();
}

async function unitName(id: string | null | undefined): Promise<string | null> {
  if (!id) return null;
  return (await unitNames([id])).get(id) || null;
}

export async function loadReport(type: ReportTypeKey, sourceId: string, owner: ReportOwner, business: BusinessScope): Promise<LoadedReport> {
  const def = REPORT_TYPE_BY_KEY.get(type);
  if (!def) throw new ReportCenterError("Geçersiz rapor türü.");
  assertOwner(owner);
  assertOwnerSupported(def, owner);
  if (!uuidPattern.test(sourceId)) notFound();
  const scope = await resolveBusinessScope(def, owner, business);
  const slug = async () => (await import("@/lib/server/document-generator")).safeFileNameSegment(await ownerDisplayName(owner)).toLocaleLowerCase("en");

  switch (type) {
    case "pre_audit_internal":
    case "pre_audit_client": {
      const { getPreAuditReportById } = await import("@/lib/pre-audit/reports");
      const report = await getPreAuditReportById(sourceId);
      if (!report || !matchesOwner(report, owner)) notFound();
      if (report.report_type !== (type === "pre_audit_internal" ? "INTERNAL_REPORT" : "CLIENT_REPORT")) notFound();
      checkBusiness(scope, report.business_unit_id);
      const displayName = (await unitName(report.business_unit_id)) || (await ownerDisplayName(owner));
      const { buildPreAuditDocumentPayload, buildPreAuditFileName } = await import("@/lib/pre-audit/document");
      return {
        def, sourceId, title: report.title || def.label, variants: def.variants,
        build: async () => buildPreAuditDocumentPayload(report, displayName),
        logoScope: { companyId: report.company_id, leadId: report.lead_id, businessUnitId: report.business_unit_id || null },
        fileBase: buildPreAuditFileName(report, displayName, "pdf").replace(/\.pdf$/, "")
      };
    }
    case "instagram_evaluation":
    case "manual_evaluation": {
      const { getManualEvaluation } = await import("@/lib/manual-evaluations");
      const evaluation = await getManualEvaluation(sourceId).catch(() => null);
      if (!evaluation || !matchesOwner(evaluation, owner)) notFound();
      if ((evaluation.module === "instagram") !== (type === "instagram_evaluation")) notFound();
      checkBusiness(scope, evaluation.business_unit_id);
      const targetName = (await unitName(evaluation.business_unit_id)) || (await ownerDisplayName(owner));
      const { buildManualEvaluationDocumentPayload } = await import("@/lib/manual-evaluation-document");
      return {
        def, sourceId, title: evaluation.title || def.label, variants: def.variants,
        build: async (variant) => buildManualEvaluationDocumentPayload(targetName, evaluation, variant),
        logoScope: { companyId: evaluation.company_id, leadId: evaluation.lead_id, businessUnitId: evaluation.business_unit_id || null },
        fileBase: `${await slug()}-${evaluation.module}-degerlendirme`
      };
    }
    case "candidate_evaluation": {
      const { getCandidateEvaluationById } = await import("@/lib/candidate-evaluation/reports");
      const report = await getCandidateEvaluationById(sourceId);
      if (!report || !matchesOwner(report, owner)) notFound();
      checkBusiness(scope, report.business_unit_id);
      const displayName = (await unitName(report.business_unit_id)) || (await ownerDisplayName(owner));
      const { buildCandidateEvaluationDocumentPayload } = await import("./documents");
      return {
        def, sourceId, title: report.title || def.label, variants: def.variants,
        build: async () => buildCandidateEvaluationDocumentPayload(report, displayName),
        logoScope: { companyId: report.company_id, leadId: report.lead_id, businessUnitId: report.business_unit_id || null },
        fileBase: `${await slug()}-aday-degerlendirmesi-${report.report_date || ""}`
      };
    }
    case "instagram_profile_audit": {
      const { getInstagramProfileAudits } = await import("@/lib/instagram-profile-audits");
      const audit = await getInstagramProfileAudits(owner.id, { id: sourceId }).catch(() => null);
      if (!audit || Array.isArray(audit) || audit.company_id !== owner.id) notFound();
      const name = await ownerDisplayName(owner);
      const { buildInstagramProfileAuditDocumentPayload } = await import("./documents");
      return {
        def, sourceId, title: `Instagram Profil Analizi — @${audit.instagram_username}`, variants: def.variants,
        build: async () => buildInstagramProfileAuditDocumentPayload(audit, name),
        logoScope: { companyId: owner.id }, fileBase: `${await slug()}-instagram-profil-analizi-${audit.audit_date || ""}`
      };
    }
    case "ad_evaluation": {
      const { getAdEvaluationById } = await import("@/lib/marketing-intelligence/ad-evaluations");
      const evaluation = await getAdEvaluationById(owner.id, sourceId).catch(() => null);
      if (!evaluation || evaluation.company_id !== owner.id) notFound();
      const campaigns = evaluation.campaign_id ? await supabaseRest<Array<{ name: string }>>(`campaigns?id=eq.${enc(evaluation.campaign_id)}&select=name&limit=1`).catch(() => []) : [];
      const campaignName = campaigns[0]?.name || evaluation.meta_campaign_id || "Kampanya";
      const companyName = await ownerDisplayName(owner);
      const { buildAdEvaluationDocumentPayload } = await import("@/lib/marketing-intelligence/ad-evaluation-document");
      const available = variantsFrom(def, Boolean(evaluation.internal_report?.executiveSummary || evaluation.internal_report?.sections?.length), Boolean(evaluation.client_report?.executiveSummary || evaluation.client_report?.sections?.length));
      return {
        def, sourceId, title: `Reklam Değerlendirmesi — ${campaignName}`, variants: available.length ? available : def.variants,
        build: async (variant) => buildAdEvaluationDocumentPayload(companyName, campaignName, evaluation, variant),
        logoScope: { companyId: owner.id }, fileBase: `${await slug()}-reklam-degerlendirmesi`
      };
    }
    case "ad_strategy": {
      const { getAdStrategyById } = await import("@/lib/marketing-intelligence/ad-strategies");
      const strategy = await getAdStrategyById(owner.id, sourceId).catch(() => null);
      if (!strategy || strategy.company_id !== owner.id) notFound();
      const companyName = await ownerDisplayName(owner);
      const { buildAdStrategyDocumentPayload } = await import("@/lib/marketing-intelligence/ad-strategy-document");
      return {
        def, sourceId, title: strategy.strategy_title || `${def.label} v${strategy.version}`, variants: def.variants,
        build: async (variant) => buildAdStrategyDocumentPayload(companyName, strategy, variant),
        logoScope: { companyId: owner.id }, fileBase: `${await slug()}-reklam-stratejisi-v${strategy.version}`
      };
    }
    case "ad_creative_report": {
      const { getCreativeReportById } = await import("@/lib/marketing-intelligence/ad-creative-reports");
      const report = await getCreativeReportById(owner.id, sourceId).catch(() => null);
      if (!report || report.company_id !== owner.id) notFound();
      const companyName = await ownerDisplayName(owner);
      const { buildCreativeReportDocumentPayload } = await import("@/lib/marketing-intelligence/ad-creative-report-document");
      return {
        def, sourceId, title: report.report_title || `${def.label} v${report.version}`, variants: def.variants,
        build: async (variant) => buildCreativeReportDocumentPayload(companyName, report, variant),
        logoScope: { companyId: owner.id }, fileBase: `${await slug()}-reklam-kreatif-v${report.version}`
      };
    }
    case "proposal": {
      const { getProposal } = await import("@/lib/proposals/store");
      const proposal = await getProposal(sourceId).catch(() => null);
      if (!proposal || proposal.deleted_at || !matchesOwner(proposal, owner)) notFound();
      const { buildProposalDocumentPayload, buildProposalFileName } = await import("@/lib/proposals/document");
      return {
        def, sourceId, title: proposal.title || `Teklif ${proposal.proposal_number}`, variants: def.variants,
        build: async (variant) => buildProposalDocumentPayload(proposal, variant),
        logoScope: { companyId: proposal.company_id, leadId: proposal.lead_id }, fileBase: buildProposalFileName(proposal, "client", "pdf").replace(/\.pdf$/, "")
      };
    }
    case "customer_report": {
      const rows = await supabaseRest<any[]>(`reports?id=eq.${enc(sourceId)}&deleted_at=is.null&select=*&limit=1`);
      const report = rows[0];
      if (!report || !matchesOwner(report, owner)) notFound();
      const [companies, interpretations, updates] = await Promise.all([
        report.company_id ? supabaseRest<any[]>(`companies?id=eq.${enc(report.company_id)}&select=*&limit=1`).catch(() => []) : Promise.resolve([]),
        supabaseRest<any[]>(`report_interpretations?report_id=eq.${enc(report.id)}&select=*&order=created_at.desc&limit=1`).catch(() => []),
        supabaseRest<any[]>(`report_updates?report_id=eq.${enc(report.id)}&is_visible_to_customer=eq.true&select=*&order=is_pinned.desc,update_date.desc`).catch(() => [])
      ]);
      const { buildReportExportPayload } = await import("@/lib/reports/report-exports");
      return {
        def, sourceId, title: report.title || report.report_type || def.label, variants: def.variants,
        // Read-only: an interpretation is never generated from here.
        build: async () => buildReportExportPayload(report, companies[0] || null, interpretations[0], updates),
        logoScope: { companyId: report.company_id, leadId: report.lead_id }, fileBase: `${await slug()}-rapor-${String(report.period || report.created_at || "").slice(0, 10)}`
      };
    }
    case "monthly_report": {
      const rows = await supabaseRest<any[]>(`monthly_reports?id=eq.${enc(sourceId)}&select=*&limit=1`);
      const report = rows[0];
      if (!report || report.company_id !== owner.id) notFound();
      const name = await ownerDisplayName(owner);
      const { buildMonthlyReportDocumentPayload } = await import("./documents");
      return {
        def, sourceId, title: `Aylık Rapor — ${report.report_month || ""}`.trim(), variants: def.variants,
        build: async () => buildMonthlyReportDocumentPayload(report, name),
        logoScope: { companyId: owner.id }, fileBase: `${await slug()}-aylik-rapor-${report.report_month || ""}`
      };
    }
    case "analytics_report": {
      const rows = await supabaseRest<any[]>(`analytics_reports?id=eq.${enc(sourceId)}&select=id,company_id,title,period_start,period_end,created_at,summary,customer_documents(document_url)&limit=1`);
      const report = rows[0];
      if (!report || report.company_id !== owner.id) notFound();
      const name = await ownerDisplayName(owner);
      const { buildAnalyticsReportSummaryPayload } = await import("./documents");
      return {
        def, sourceId, title: report.title || def.label, variants: def.variants,
        build: async () => buildAnalyticsReportSummaryPayload(report, name),
        logoScope: { companyId: owner.id }, fileBase: `${await slug()}-analiz-raporu`,
        storedUrl: report.customer_documents?.document_url || null
      };
    }
    case "gemini_visibility": {
      const { getScanWithAnswers } = await import("@/lib/gemini-visibility/scan");
      const result = await getScanWithAnswers(sourceId).catch(() => null);
      if (!result || result.scan.company_id !== owner.id) notFound();
      const profiles = await supabaseRest<any[]>(`gemini_visibility_profiles?id=eq.${enc(result.scan.profile_id)}&select=*&limit=1`).catch(() => []);
      if (!profiles[0]) notFound();
      const name = await ownerDisplayName(owner);
      const { buildGeminiVisibilityReportPayload } = await import("@/lib/gemini-visibility/report");
      return {
        def, sourceId, title: "Gemini Görünürlük Raporu", variants: def.variants,
        build: async () => buildGeminiVisibilityReportPayload(name, profiles[0], result.scan, result.answers),
        logoScope: { companyId: owner.id }, fileBase: `${await slug()}-gemini-gorunurluk`
      };
    }
    case "content_plan": {
      if (sourceId !== owner.id) notFound();
      const { CONTENT_PLAN_TABLE } = await import("@/lib/content-plan/types");
      const items = await supabaseRest<any[]>(`${CONTENT_PLAN_TABLE}?company_id=eq.${enc(owner.id)}&select=*&order=scheduled_date.asc`);
      if (!items.length) notFound();
      const name = await ownerDisplayName(owner);
      const { buildContentPlanDocumentPayload } = await import("@/lib/content-plan/pdf-payload");
      return {
        def, sourceId, title: "Instagram İçerik Planı", variants: def.variants,
        build: async (variant) => buildContentPlanDocumentPayload(name, items, variant === "internal" ? "internal" : "customer"),
        logoScope: { companyId: owner.id }, fileBase: `${await slug()}-instagram-icerik-plani`
      };
    }
  }
}

/** Payload for the on-screen viewer: identical content to the PDF, minus
 * binary logo bytes. */
export function viewerPayload(payload: DocumentPayload): Omit<DocumentPayload, "clientLogo"> & { sections: DocumentSection[] } {
  const { clientLogo: _logo, ...rest } = withAutomaticCharts(payload);
  return rest;
}

// ---------------------------------------------------------------------------
// OWNERS + BUSINESSES

export async function listOwners(type: ReportOwnerType, q: string | null): Promise<Array<{ id: string; name: string; detail: string | null }>> {
  const term = searchTerm(q);
  if (type === "lead") {
    const rows = await supabaseRest<any[]>(
      `leads?select=id,company,name,status,company_id&deleted_at=is.null`
      + (term ? `&or=(company.ilike.*${enc(term)}*,name.ilike.*${enc(term)}*)` : "")
      + "&order=created_at.desc&limit=60"
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.company || r.name || "İsimsiz lead",
      detail: [r.company && r.name && r.company !== r.name ? r.name : "", r.status || "", r.company_id ? "Müşteriye dönüştürüldü" : ""].filter(Boolean).join(" · ") || null
    }));
  }
  const rows = await supabaseRest<any[]>(
    `companies?select=*&deleted_at=is.null`
    + (term ? `&name=ilike.*${enc(term)}*` : "")
    + "&order=name.asc&limit=200"
  );
  const { isArchivedCustomer } = await import("@/lib/customer-visibility");
  return rows.map((r) => ({ id: r.id, name: r.name || r.company_name || "İsimsiz müşteri", detail: isArchivedCustomer(r) ? "Arşivli müşteri" : companyStatusLabel(r.status) }));
}

const COMPANY_STATUS_LABELS: Record<string, string> = { active: "Aktif müşteri", inactive: "Pasif müşteri", passive: "Pasif müşteri", paused: "Duraklatıldı", lead: "Aday" };

function companyStatusLabel(status: unknown): string | null {
  const s = String(status || "").trim();
  return s ? COMPANY_STATUS_LABELS[s.toLowerCase()] || s : null;
}

export async function listOwnerBusinesses(owner: ReportOwner): Promise<Array<{ id: string; name: string; relationship: string }>> {
  assertOwner(owner);
  const { listLinkedBusinesses } = await import("@/lib/business-relationships");
  const linked = await listLinkedBusinesses({ type: owner.type === "lead" ? "lead" : "company", id: owner.id }).catch(() => []);
  const labels: Record<string, string> = { branch: "Şube", related_brand: "Bağlı Marka", business_group: "İşletme Grubu" };
  return linked
    .filter((item) => item.entity.type === "unit")
    .map((item) => ({ id: item.entity.id, name: item.name, relationship: labels[item.relationshipType] || item.relationshipType }));
}
