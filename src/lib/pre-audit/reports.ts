// Ön İnceleme Merkezi — company context resolution + report save/read.
// Reuses the exact same canonical company source every other HK Marketing
// Intelligence tool uses (public.companies) — no parallel lead/customer
// system. See src/lib/marketing-intelligence/customers.ts for the sibling
// pattern this mirrors (resolveCustomer's "never guess on ambiguity" rule).
import { supabaseRest } from "@/lib/supabase";
import {
  PRE_AUDIT_TABLE, PRE_AUDIT_REPORT_TYPES, PRE_AUDIT_INTERNAL_ONLY_FIELDS, LEAD_PRE_REVIEW_STATUS,
  type PreAuditReport, type PreAuditReportListItem, type PreAuditReportType
} from "./types";

type CompanyRow = { id: string; name: string; sector: string | null; city: string | null; website: string | null; lifecycle_stage: string | null };
type LeadRow = { id: string; company: string | null; name: string | null; sector: string | null; business_type: string | null; city: string | null; district: string | null; website: string | null; phone: string | null; instagram: string | null; status: string | null; company_id: string | null };

export type PreAuditCompanyContext = {
  status: "resolved";
  entity: "company" | "lead";
  company: { id: string; name: string; sector: string | null; city: string | null; website: string | null; leadOrCustomerStatus: string };
  integrations?: unknown;
  preAuditCount: number;
  latestPreAudit: { reportDate: string; title: string } | null;
} | { status: "ambiguous"; candidates: Array<{ id: string; name: string }> } | { status: "not_found" };

/** Lead-scoped equivalent of getPreAuditCompanyContext — used for a
 * discovery candidate that is not (yet, or ever) a public.companies row.
 * A leadId is unambiguous by construction (it's a real row id, not a name
 * search), so no ambiguity branch is needed here. */
export async function getPreAuditLeadContext(leadId: string): Promise<PreAuditCompanyContext> {
  const leads = await supabaseRest<LeadRow[]>(
    `leads?select=id,company,name,sector,business_type,city,district,website,phone,instagram,status,company_id&id=eq.${encodeURIComponent(leadId)}&deleted_at=is.null&limit=1`
  );
  const lead = leads[0];
  if (!lead) return { status: "not_found" };

  const priorReports = await supabaseRest<Array<{ report_date: string; title: string; analysis_group_id: string }>>(
    `${PRE_AUDIT_TABLE}?select=report_date,title,analysis_group_id&lead_id=eq.${lead.id}&order=report_date.desc,created_at.desc&limit=50`
  );
  const distinctGroups = new Set(priorReports.map((r) => r.analysis_group_id));

  return {
    status: "resolved",
    entity: "lead",
    company: {
      id: lead.id,
      name: lead.company || lead.name || "İsimsiz aday",
      sector: lead.sector || lead.business_type,
      city: [lead.district, lead.city].filter(Boolean).join(" / ") || null,
      website: lead.website,
      leadOrCustomerStatus: lead.company_id ? "Müşteriye dönüştürüldü" : (lead.status || "Bilinmiyor")
    },
    preAuditCount: distinctGroups.size,
    latestPreAudit: priorReports[0] ? { reportDate: priorReports[0].report_date, title: priorReports[0].title } : null
  };
}

/** Never picks a company silently when a name matches more than one row —
 * the caller (Claude) must ask the user to disambiguate. Mirrors
 * customers.ts's resolveCustomer rule. */
export async function getPreAuditCompanyContext(companyId?: string, companyName?: string): Promise<PreAuditCompanyContext> {
  let companies: CompanyRow[];
  if (companyId) {
    companies = await supabaseRest<CompanyRow[]>(
      `companies?select=id,name,sector,city,website,lifecycle_stage&id=eq.${encodeURIComponent(companyId)}&deleted_at=is.null&limit=1`
    );
  } else if (companyName?.trim()) {
    companies = await supabaseRest<CompanyRow[]>(
      `companies?select=id,name,sector,city,website,lifecycle_stage&name=ilike.*${encodeURIComponent(companyName.trim())}*&deleted_at=is.null&order=name.asc&limit=10`
    );
  } else {
    return { status: "not_found" };
  }

  if (companies.length === 0) {
    // Defensive fallback for exactly the failure mode this was built to
    // close: a caller (or an MCP client with a stale cached tool schema
    // that predates leadId support) passes a real lead's id in the
    // companyId slot. Rather than a bare not_found for an id that
    // genuinely exists in HK Dijital — just under a different entity —
    // resolve it as a lead instead of silently failing.
    if (companyId) {
      const leadFallback = await getPreAuditLeadContext(companyId);
      if (leadFallback.status !== "not_found") return leadFallback;
    }
    return { status: "not_found" };
  }
  if (companies.length > 1) return { status: "ambiguous", candidates: companies.map((c) => ({ id: c.id, name: c.name })) };

  const company = companies[0];
  const [{ getCustomerIntegrations }, priorReports] = await Promise.all([
    import("@/lib/marketing-intelligence/customers"),
    supabaseRest<Array<{ report_date: string; title: string; analysis_group_id: string }>>(
      `${PRE_AUDIT_TABLE}?select=report_date,title,analysis_group_id&company_id=eq.${company.id}&order=report_date.desc,created_at.desc&limit=50`
    )
  ]);
  const integrations = await getCustomerIntegrations(company.id).catch(() => undefined);
  const distinctGroups = new Set(priorReports.map((r) => r.analysis_group_id));

  return {
    status: "resolved",
    entity: "company",
    company: {
      id: company.id,
      name: company.name,
      sector: company.sector,
      city: company.city,
      website: company.website,
      leadOrCustomerStatus: company.lifecycle_stage || "Bilinmiyor"
    },
    integrations,
    preAuditCount: distinctGroups.size,
    latestPreAudit: priorReports[0] ? { reportDate: priorReports[0].report_date, title: priorReports[0].title } : null
  };
}

export type SavePreAuditReportInput = Partial<PreAuditReport> & { company_id?: string; lead_id?: string; report_type: PreAuditReportType };

export class PreAuditValidationError extends Error {}
export class PreAuditCompanyNotFoundError extends Error {}

function req(cond: unknown, message: string) {
  if (!cond) throw new PreAuditValidationError(message);
}

export function validatePreAuditReport(input: unknown): SavePreAuditReportInput {
  const s = input as Partial<SavePreAuditReportInput>;
  req(s && typeof s === "object", "Rapor bir nesne olmalıdır.");
  req((typeof s.company_id === "string" && s.company_id) || (typeof s.lead_id === "string" && s.lead_id), "company_id veya lead_id zorunludur.");
  req(!(s.company_id && s.lead_id), "company_id ve lead_id aynı anda verilemez.");
  req(typeof s.report_type === "string" && PRE_AUDIT_REPORT_TYPES.includes(s.report_type as PreAuditReportType), "report_type INTERNAL_REPORT veya CLIENT_REPORT olmalıdır.");
  return s as SavePreAuditReportInput;
}

const JSONB_FIELDS = [
  "digital_presence", "google_analysis", "maps_analysis", "website_analysis", "seo_analysis", "social_analysis",
  "meta_ads_analysis", "google_ads_analysis", "market_analysis", "competitor_analysis", "swot", "digital_gaps",
  "opportunities", "recommended_services", "recommended_package", "ad_strategy", "budget_plan", "sources", "objections"
] as const;

const TEXT_FIELDS = [
  "title", "status", "executive_summary", "sales_notes", "sales_script", "instagram_dm", "whatsapp_initial", "whatsapp_with_pdf"
] as const;

/** Server-side authoritative save: verifies the company/lead actually
 * exists (never trusts a client-supplied context blindly), strips
 * internal-only outreach/sales fields from CLIENT_REPORT rows regardless
 * of what the caller sent, and always INSERTs a new row — never
 * overwrites a prior report, so history is preserved. When lead_id is
 * given, this is the one allowed automatic status transition: the lead's
 * pre-review queue status moves to COMPLETED, since a saved report is
 * exactly what "review completed" means — no other lead/company field is
 * ever touched by this path. */
export async function savePreAuditReport(
  input: SavePreAuditReportInput,
  analysisGroupId?: string
): Promise<{ success: true; report_id: string; analysis_group_id: string; company_id: string | null; lead_id: string | null; report_type: PreAuditReportType; created_at: string }> {
  if (input.lead_id) {
    const leads = await supabaseRest<Array<{ id: string }>>(
      `leads?select=id&id=eq.${encodeURIComponent(input.lead_id)}&deleted_at=is.null&limit=1`
    );
    if (!leads.length) throw new PreAuditCompanyNotFoundError(`lead_id doğrulanamadı: ${input.lead_id} public.leads içinde bulunamadı.`);
  } else {
    const companies = await supabaseRest<Array<{ id: string }>>(
      `companies?select=id&id=eq.${encodeURIComponent(input.company_id || "")}&deleted_at=is.null&limit=1`
    );
    if (!companies.length) throw new PreAuditCompanyNotFoundError(`company_id doğrulanamadı: ${input.company_id} public.companies içinde bulunamadı.`);
  }

  const isClient = input.report_type === "CLIENT_REPORT";
  const row: Record<string, unknown> = {
    company_id: input.company_id || null,
    lead_id: input.lead_id || null,
    analysis_group_id: analysisGroupId || undefined,
    report_type: input.report_type,
    report_date: typeof input.report_date === "string" && input.report_date ? input.report_date : new Date().toISOString().slice(0, 10)
  };
  for (const field of TEXT_FIELDS) {
    if (isClient && (PRE_AUDIT_INTERNAL_ONLY_FIELDS as readonly string[]).includes(field)) continue;
    if (typeof input[field] === "string") row[field] = input[field];
  }
  for (const field of JSONB_FIELDS) {
    if (isClient && (PRE_AUDIT_INTERNAL_ONLY_FIELDS as readonly string[]).includes(field)) continue;
    if (input[field] !== undefined) row[field] = input[field];
  }

  const rows = await supabaseRest<PreAuditReport[]>(PRE_AUDIT_TABLE, { method: "POST", body: JSON.stringify(row) });
  const saved = rows[0];
  if (!saved) throw new Error("Ön inceleme raporu kaydedilemedi.");

  if (saved.lead_id) {
    await supabaseRest(`leads?id=eq.${saved.lead_id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: LEAD_PRE_REVIEW_STATUS.COMPLETED, updated_at: new Date().toISOString() })
    }).catch(() => null);
  }

  return {
    success: true,
    report_id: saved.id,
    analysis_group_id: saved.analysis_group_id,
    company_id: saved.company_id,
    lead_id: saved.lead_id,
    report_type: saved.report_type,
    created_at: saved.created_at
  };
}

export async function getLatestPreAuditReport(companyId?: string, reportType?: PreAuditReportType, leadId?: string) {
  const filter = reportType ? `&report_type=eq.${reportType}` : "";
  const scope = leadId ? `lead_id=eq.${encodeURIComponent(leadId)}` : `company_id=eq.${encodeURIComponent(companyId || "")}`;
  const rows = await supabaseRest<PreAuditReport[]>(
    `${PRE_AUDIT_TABLE}?select=*&${scope}${filter}&order=report_date.desc,created_at.desc&limit=1`
  );
  const latest = rows[0];
  if (!latest) return null;

  // Include the sibling report (INTERNAL/CLIENT) from the same research
  // pass when it exists, so a caller can see both halves of one analysis.
  const group = await supabaseRest<PreAuditReport[]>(
    `${PRE_AUDIT_TABLE}?select=*&analysis_group_id=eq.${latest.analysis_group_id}&order=report_type.asc&limit=5`
  );
  return { latest, group };
}

export async function listPreAuditReports(companyId?: string, search?: string, limit = 200, leadId?: string): Promise<PreAuditReportListItem[]> {
  const filters = [
    "select=id,company_id,lead_id,analysis_group_id,report_type,title,status,report_date,recommended_package,created_at",
    companyId ? `company_id=eq.${encodeURIComponent(companyId)}` : "",
    leadId ? `lead_id=eq.${encodeURIComponent(leadId)}` : "",
    search?.trim() ? `title=ilike.*${encodeURIComponent(search.trim())}*` : "",
    `order=report_date.desc,created_at.desc&limit=${limit}`
  ].filter(Boolean).join("&");
  return supabaseRest<PreAuditReportListItem[]>(`${PRE_AUDIT_TABLE}?${filters}`);
}

// --- Lead pre-review queue (Bekliyor/İnceleniyor/İptal live on leads.status
// — no pre_audit_reports row exists yet at these stages; "Tamamlandı" is
// derived from a saved report's existence, not tracked as its own lead
// status write here). Admin-only actions — never exposed via MCP. ---

export type PreReviewQueueLead = {
  id: string; company: string | null; name: string | null; sector: string | null; business_type: string | null;
  city: string | null; district: string | null; website: string | null; phone: string | null; instagram: string | null;
  status: string | null; rejection_reason: string | null; rejected_at: string | null; notes: string | null;
  google_place_id: string | null; source: string | null; created_at: string;
};

const QUEUE_LEAD_FIELDS = "id,company,name,sector,business_type,city,district,website,phone,instagram,status,rejection_reason,rejected_at,notes,google_place_id,source,created_at";

export async function listPreReviewQueue(status: string, limit = 200): Promise<PreReviewQueueLead[]> {
  return supabaseRest<PreReviewQueueLead[]>(
    `leads?select=${QUEUE_LEAD_FIELDS}&status=eq.${encodeURIComponent(status)}&deleted_at=is.null&order=created_at.desc&limit=${limit}`
  );
}

export class PreReviewLeadNotFoundError extends Error {}

/** "Ön İncele" — never creates a duplicate discovery/lead record; the
 * caller is responsible for resolving/creating the lead first via the
 * existing business-discovery save path. This only moves an existing
 * lead into the pre-review queue (idempotent: re-clicking a lead already
 * mid-queue is a no-op, not a downgrade). */
export async function startPreReviewQueue(leadId: string): Promise<PreReviewQueueLead> {
  const leads = await supabaseRest<PreReviewQueueLead[]>(`leads?select=${QUEUE_LEAD_FIELDS}&id=eq.${encodeURIComponent(leadId)}&deleted_at=is.null&limit=1`);
  const lead = leads[0];
  if (!lead) throw new PreReviewLeadNotFoundError(`lead_id doğrulanamadı: ${leadId}`);
  // Idempotent for a lead already actively in the queue — but a REJECTED
  // lead always gets a fresh PENDING transition on re-open ("Tekrar Ön
  // İncele"), never silently staying rejected. rejection_reason/rejected_at
  // are left untouched as historical audit trail.
  const activeQueueStatuses: string[] = [LEAD_PRE_REVIEW_STATUS.PENDING, LEAD_PRE_REVIEW_STATUS.IN_REVIEW, LEAD_PRE_REVIEW_STATUS.COMPLETED];
  if (activeQueueStatuses.includes(lead.status || "")) return lead;
  const updated = await supabaseRest<PreReviewQueueLead[]>(`leads?id=eq.${leadId}`, {
    method: "PATCH",
    body: JSON.stringify({ status: LEAD_PRE_REVIEW_STATUS.PENDING, updated_at: new Date().toISOString() })
  });
  return updated[0] || lead;
}

export async function markPreReviewInProgress(leadId: string): Promise<void> {
  await supabaseRest(`leads?id=eq.${encodeURIComponent(leadId)}`, {
    method: "PATCH",
    body: JSON.stringify({ status: LEAD_PRE_REVIEW_STATUS.IN_REVIEW, updated_at: new Date().toISOString() })
  });
}

export async function rejectPreReview(leadId: string, reason: string, note: string, actorEmail: string): Promise<PreReviewQueueLead> {
  const leads = await supabaseRest<PreReviewQueueLead[]>(`leads?select=id,notes&id=eq.${encodeURIComponent(leadId)}&deleted_at=is.null&limit=1`);
  if (!leads.length) throw new PreReviewLeadNotFoundError(`lead_id doğrulanamadı: ${leadId}`);
  const appendedNote = [leads[0].notes, `[Ön İnceleme İptal · ${new Date().toISOString().slice(0, 10)} · ${actorEmail}] ${note || "(not girilmedi)"}`].filter(Boolean).join("\n");
  const updated = await supabaseRest<PreReviewQueueLead[]>(`leads?id=eq.${encodeURIComponent(leadId)}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: LEAD_PRE_REVIEW_STATUS.REJECTED,
      rejection_reason: reason,
      rejected_at: new Date().toISOString(),
      notes: appendedNote,
      updated_at: new Date().toISOString()
    })
  });
  return updated[0];
}

/** "Teklif Gönder" → Lead Merkezi: promotes the lead out of the pre-review
 * holding area into the active sales pipeline. Does not create or touch
 * any company/customer record — the lead already IS the canonical CRM
 * record. */
export async function sendPreReviewToLeadPipeline(leadId: string): Promise<PreReviewQueueLead> {
  const updated = await supabaseRest<PreReviewQueueLead[]>(`leads?id=eq.${encodeURIComponent(leadId)}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "Teklif Gönderildi", pipeline_stage: "Teklif", updated_at: new Date().toISOString() })
  });
  if (!updated.length) throw new PreReviewLeadNotFoundError(`lead_id doğrulanamadı: ${leadId}`);
  return updated[0];
}

export async function getPreAuditReportById(id: string): Promise<PreAuditReport | null> {
  const rows = await supabaseRest<PreAuditReport[]>(`${PRE_AUDIT_TABLE}?select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
  return rows[0] || null;
}

export type PreAuditSummary = { totalPreAudits: number; thisMonth: number; potentialCompanies: number; convertedCompanies: number };

/** "Müşteriye Dönüşenler" uses the same lifecycle_stage = "Aktif Müşteri"
 * value the customer-onboarding completion flow already writes (see
 * src/app/api/admin/customer-onboarding/route.ts) — a real, existing
 * convention, not a fabricated metric. */
export async function getPreAuditSummary(): Promise<PreAuditSummary> {
  const rows = await supabaseRest<Array<{ company_id: string; analysis_group_id: string; report_date: string }>>(
    `${PRE_AUDIT_TABLE}?select=company_id,analysis_group_id,report_date&limit=5000`
  );
  if (!rows.length) return { totalPreAudits: 0, thisMonth: 0, potentialCompanies: 0, convertedCompanies: 0 };

  const monthPrefix = new Date().toISOString().slice(0, 7);
  const totalGroups = new Set(rows.map((r) => r.analysis_group_id));
  const thisMonthGroups = new Set(rows.filter((r) => r.report_date.startsWith(monthPrefix)).map((r) => r.analysis_group_id));
  const companyIds = [...new Set(rows.map((r) => r.company_id))];

  const companies = await supabaseRest<Array<{ id: string; lifecycle_stage: string | null }>>(
    `companies?select=id,lifecycle_stage&id=in.(${companyIds.join(",")})`
  );
  const converted = companies.filter((c) => c.lifecycle_stage === "Aktif Müşteri").length;

  return {
    totalPreAudits: totalGroups.size,
    thisMonth: thisMonthGroups.size,
    potentialCompanies: companyIds.length - converted,
    convertedCompanies: converted
  };
}
