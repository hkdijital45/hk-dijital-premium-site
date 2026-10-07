// Aday Değerlendirme — context resolution + report save/read. Mirrors
// src/lib/pre-audit/reports.ts's conventions (same polymorphic
// company_id/lead_id resolution, same "never guess on ambiguity" rule,
// same insert-new-row-by-default/update-only-when-asked history model) —
// a genuinely separate report family, not a variant of Ön İnceleme.
import { supabaseRest } from "@/lib/supabase";
import { CANDIDATE_EVALUATION_TABLE, type CandidateEvaluationReport, type CandidateEvaluationListItem } from "./types";

type CompanyRow = { id: string; name: string; sector: string | null; city: string | null; website: string | null; lifecycle_stage: string | null };
type LeadRow = { id: string; company: string | null; name: string | null; sector: string | null; business_type: string | null; city: string | null; district: string | null; website: string | null; phone: string | null; instagram: string | null; status: string | null; company_id: string | null; source: string | null; source_detail: string | null; google_maps_url: string | null; google_rating: number | null };

export type CandidateEvaluationContext = {
  status: "resolved";
  entity: "company" | "lead";
  business: { id: string; name: string; sector: string | null; city: string | null; website: string | null; status: string };
  evaluationCount: number;
  latestEvaluation: { reportDate: string; title: string; recommendation: string } | null;
  lead?: { instagram: string | null; phone: string | null; district: string | null; source: string | null; sourceDetail: string | null; googleMapsUrl: string | null; googleRating: number | null };
} | { status: "ambiguous"; candidates: Array<{ id: string; name: string }> } | { status: "not_found" };

export async function getCandidateEvaluationLeadContext(leadId: string): Promise<CandidateEvaluationContext> {
  const leads = await supabaseRest<LeadRow[]>(
    `leads?select=id,company,name,sector,business_type,city,district,website,phone,instagram,status,company_id,source,source_detail,google_maps_url,google_rating&id=eq.${encodeURIComponent(leadId)}&deleted_at=is.null&limit=1`
  );
  const lead = leads[0];
  if (!lead) return { status: "not_found" };

  const priorReports = await supabaseRest<Array<{ report_date: string; title: string; recommendation: string }>>(
    `${CANDIDATE_EVALUATION_TABLE}?select=report_date,title,recommendation&lead_id=eq.${encodeURIComponent(lead.id)}&order=report_date.desc,created_at.desc&limit=50`
  );

  return {
    status: "resolved",
    entity: "lead",
    business: {
      id: lead.id,
      name: lead.company || lead.name || "İsimsiz aday",
      sector: lead.sector || lead.business_type,
      city: [lead.district, lead.city].filter(Boolean).join(" / ") || null,
      website: lead.website,
      status: lead.company_id ? "Müşteriye dönüştürüldü" : (lead.status || "Bilinmiyor")
    },
    evaluationCount: priorReports.length,
    latestEvaluation: priorReports[0] ? { reportDate: priorReports[0].report_date, title: priorReports[0].title, recommendation: priorReports[0].recommendation } : null,
    lead: {
      instagram: lead.instagram || null,
      phone: lead.phone || null,
      district: lead.district || null,
      source: lead.source || null,
      sourceDetail: lead.source_detail || null,
      googleMapsUrl: lead.google_maps_url || null,
      googleRating: lead.google_rating || null
    }
  };
}

export async function getCandidateEvaluationCompanyContext(companyId?: string, companyName?: string): Promise<CandidateEvaluationContext> {
  let companies: CompanyRow[];
  if (companyId) {
    companies = await supabaseRest<CompanyRow[]>(`companies?select=id,name,sector,city,website,lifecycle_stage&id=eq.${encodeURIComponent(companyId)}&deleted_at=is.null&limit=1`);
  } else if (companyName?.trim()) {
    companies = await supabaseRest<CompanyRow[]>(`companies?select=id,name,sector,city,website,lifecycle_stage&name=ilike.*${encodeURIComponent(companyName.trim())}*&deleted_at=is.null&order=name.asc&limit=10`);
  } else {
    return { status: "not_found" };
  }

  if (companies.length === 0) {
    if (companyId) {
      const leadFallback = await getCandidateEvaluationLeadContext(companyId);
      if (leadFallback.status !== "not_found") return leadFallback;
    }
    return { status: "not_found" };
  }
  if (companies.length > 1) return { status: "ambiguous", candidates: companies.map((c) => ({ id: c.id, name: c.name })) };

  const company = companies[0];
  const priorReports = await supabaseRest<Array<{ report_date: string; title: string; recommendation: string }>>(
    `${CANDIDATE_EVALUATION_TABLE}?select=report_date,title,recommendation&company_id=eq.${company.id}&order=report_date.desc,created_at.desc&limit=50`
  );

  return {
    status: "resolved",
    entity: "company",
    business: { id: company.id, name: company.name, sector: company.sector, city: company.city, website: company.website, status: company.lifecycle_stage || "Bilinmiyor" },
    evaluationCount: priorReports.length,
    latestEvaluation: priorReports[0] ? { reportDate: priorReports[0].report_date, title: priorReports[0].title, recommendation: priorReports[0].recommendation } : null
  };
}

export type SaveCandidateEvaluationInput = Partial<CandidateEvaluationReport> & { company_id?: string; lead_id?: string };

export class CandidateEvaluationValidationError extends Error {}
export class CandidateEvaluationEntityNotFoundError extends Error {}

function req(cond: unknown, message: string) {
  if (!cond) throw new CandidateEvaluationValidationError(message);
}

export function validateCandidateEvaluation(input: unknown): SaveCandidateEvaluationInput {
  const s = input as Partial<SaveCandidateEvaluationInput>;
  req(s && typeof s === "object", "Rapor bir nesne olmalıdır.");
  req((typeof s.company_id === "string" && s.company_id) || (typeof s.lead_id === "string" && s.lead_id), "company_id veya lead_id zorunludur.");
  req(!(s.company_id && s.lead_id), "company_id ve lead_id aynı anda verilemez.");
  return s as SaveCandidateEvaluationInput;
}

const TEXT_FIELDS = ["title", "recommendation", "priority", "suggested_next_action", "report_content"] as const;
const ARRAY_FIELDS = ["strengths", "weaknesses", "digital_opportunities"] as const;

/** Insert-only by default — a genuinely new evaluation always adds a new
 * history row (same rule as Ön İnceleme). Passing reportId updates that
 * exact row in place instead, for an explicit "bu raporu güncelle". */
export async function saveCandidateEvaluation(
  input: SaveCandidateEvaluationInput,
  reportId?: string
): Promise<{ success: true; report_id: string; company_id: string | null; lead_id: string | null; created_at: string; updated: boolean }> {
  let resolvedCompanyId = input.company_id || null;
  let resolvedLeadId = input.lead_id || null;

  if (resolvedLeadId) {
    const leads = await supabaseRest<Array<{ id: string }>>(`leads?select=id&id=eq.${encodeURIComponent(resolvedLeadId)}&deleted_at=is.null&limit=1`);
    if (!leads.length) throw new CandidateEvaluationEntityNotFoundError(`lead_id doğrulanamadı: ${resolvedLeadId} public.leads içinde bulunamadı.`);
  } else {
    const companies = await supabaseRest<Array<{ id: string }>>(`companies?select=id&id=eq.${encodeURIComponent(resolvedCompanyId || "")}&deleted_at=is.null&limit=1`);
    if (!companies.length) {
      const leadFallback = resolvedCompanyId ? await supabaseRest<Array<{ id: string }>>(`leads?select=id&id=eq.${encodeURIComponent(resolvedCompanyId)}&deleted_at=is.null&limit=1`) : [];
      if (!leadFallback.length) throw new CandidateEvaluationEntityNotFoundError(`company_id doğrulanamadı: ${input.company_id} public.companies içinde bulunamadı.`);
      resolvedLeadId = resolvedCompanyId;
      resolvedCompanyId = null;
    }
  }

  const row: Record<string, unknown> = {
    company_id: resolvedCompanyId,
    lead_id: resolvedLeadId,
    report_date: typeof input.report_date === "string" && input.report_date ? input.report_date : new Date().toISOString().slice(0, 10)
  };
  for (const field of TEXT_FIELDS) if (typeof input[field] === "string") row[field] = input[field];
  for (const field of ARRAY_FIELDS) if (Array.isArray(input[field])) row[field] = input[field];
  if (input.score !== undefined) row.score = typeof input.score === "number" && Number.isFinite(input.score) ? Math.max(0, Math.min(100, Math.round(input.score))) : null;
  if (input.sources !== undefined) row.sources = input.sources;

  let targetId: string | null = null;
  if (reportId) {
    const existing = await supabaseRest<Array<{ id: string; company_id: string | null; lead_id: string | null }>>(
      `${CANDIDATE_EVALUATION_TABLE}?select=id,company_id,lead_id&id=eq.${encodeURIComponent(reportId)}&limit=1`
    );
    const match = existing[0];
    if (!match) throw new CandidateEvaluationValidationError(`reportId doğrulanamadı: ${reportId} bulunamadı.`);
    if (match.company_id !== resolvedCompanyId || match.lead_id !== resolvedLeadId) throw new CandidateEvaluationValidationError("reportId, verilen company_id/lead_id ile eşleşmiyor.");
    targetId = match.id;
  }

  const saved = targetId
    ? (await supabaseRest<CandidateEvaluationReport[]>(`${CANDIDATE_EVALUATION_TABLE}?id=eq.${encodeURIComponent(targetId)}`, { method: "PATCH", body: JSON.stringify(row) }))[0]
    : (await supabaseRest<CandidateEvaluationReport[]>(CANDIDATE_EVALUATION_TABLE, { method: "POST", body: JSON.stringify(row) }))[0];
  if (!saved) throw new Error("Aday değerlendirme raporu kaydedilemedi.");

  return { updated: Boolean(targetId), success: true, report_id: saved.id, company_id: saved.company_id, lead_id: saved.lead_id, created_at: saved.created_at };
}

export async function getLatestCandidateEvaluation(companyId?: string, leadId?: string) {
  const scope = leadId ? `lead_id=eq.${encodeURIComponent(leadId)}` : `company_id=eq.${encodeURIComponent(companyId || "")}`;
  const rows = await supabaseRest<CandidateEvaluationReport[]>(`${CANDIDATE_EVALUATION_TABLE}?select=*&${scope}&order=report_date.desc,created_at.desc&limit=1`);
  return rows[0] || null;
}

export async function listCandidateEvaluations(companyId?: string, leadId?: string, search?: string, limit = 200): Promise<CandidateEvaluationListItem[]> {
  const filters = [
    "select=id,company_id,lead_id,title,report_date,recommendation,priority,score,created_at,updated_at",
    companyId ? `company_id=eq.${encodeURIComponent(companyId)}` : "",
    leadId ? `lead_id=eq.${encodeURIComponent(leadId)}` : "",
    search?.trim() ? `title=ilike.*${encodeURIComponent(search.trim())}*` : "",
    `order=report_date.desc,created_at.desc&limit=${limit}`
  ].filter(Boolean).join("&");
  return supabaseRest<CandidateEvaluationListItem[]>(`${CANDIDATE_EVALUATION_TABLE}?${filters}`);
}

export async function getCandidateEvaluationById(id: string): Promise<CandidateEvaluationReport | null> {
  const rows = await supabaseRest<CandidateEvaluationReport[]>(`${CANDIDATE_EVALUATION_TABLE}?select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
  return rows[0] || null;
}
