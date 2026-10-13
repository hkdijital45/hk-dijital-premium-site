import "server-only";

import { supabaseRest } from "@/lib/supabase";
import { getLatestPreAuditReport } from "@/lib/pre-audit/reports";
import type { PreAuditReport } from "@/lib/pre-audit/types";

export type SourceRef = { module: string; recordId: string; date: string | null; verified: boolean };

export type LeadRow = {
  id: string; company_id: string | null; name: string | null; company: string | null;
  phone: string | null; email: string | null; instagram: string | null; website: string | null;
  business_type: string | null; sector: string | null; city: string | null; district: string | null;
  address: string | null; goal: string | null; budget: string | null; message: string | null;
  notes: string | null; status: string | null; google_maps_url: string | null;
  requested_platforms: string[] | null; competitor_notes: string | null; created_at: string;
};

type InstagramAuditRow = {
  id: string; instagram_username: string | null; audit_date: string | null; status: string;
  overall_summary: string | null; current_bio: string | null; recommended_bio: string | null;
  priorities: unknown; checklist: unknown;
};

type AdEvaluationRow = {
  id: string; evaluation_period_start: string | null; evaluation_period_end: string | null;
  status: string; decision: string | null; internal_report: { executiveSummary?: string; sections?: Array<{ title: string; content: string }> } | null;
  metrics_snapshot: unknown; created_at: string;
};

export type LeadProposalContext = {
  lead: LeadRow;
  preAudit: PreAuditReport | null;
  instagram: InstagramAuditRow | null;
  adEvaluation: AdEvaluationRow | null;
  completeness: {
    lead: boolean; preAudit: boolean; instagram: boolean; adEvaluation: boolean;
    competitors: boolean; budget: boolean;
  };
  sources: SourceRef[];
  notes: string[]; // honest disclosures (e.g. "Instagram company_id olmadığı için alınamadı")
};

/** Real, server-side data aggregation across the four HK Admin modules
 * named in the brief — NEVER fabricates a missing analysis. Instagram
 * audits and ad evaluations are company_id-scoped tables with no lead_id
 * column (confirmed by direct schema inspection) — a lead that hasn't
 * been converted to a company yet genuinely cannot have real rows there,
 * so this function honestly reports them as unavailable rather than
 * guessing or inventing a linkage the schema doesn't support. Pre-audit
 * reports DO have a real lead_id column and are fetched directly by it. */
export async function collectLeadProposalContext(leadId: string): Promise<LeadProposalContext> {
  const leadRows = await supabaseRest<LeadRow[]>(`leads?id=eq.${encodeURIComponent(leadId)}&limit=1`);
  const lead = leadRows[0];
  if (!lead) throw new Error("Lead bulunamadı.");

  const notes: string[] = [];
  const sources: SourceRef[] = [];

  let preAudit: PreAuditReport | null = null;
  try {
    preAudit = (await getLatestPreAuditReport(lead.company_id || undefined, undefined, leadId)) as PreAuditReport | null;
  } catch {
    preAudit = null;
  }
  if (preAudit) sources.push({ module: "Ön İnceleme Merkezi", recordId: preAudit.id, date: preAudit.report_date, verified: true });
  else notes.push("Bu lead için henüz tamamlanmış bir Ön İnceleme raporu bulunamadı.");

  let instagram: InstagramAuditRow | null = null;
  if (lead.company_id) {
    const rows = await supabaseRest<InstagramAuditRow[]>(
      `instagram_profile_audits?company_id=eq.${lead.company_id}&status=eq.completed&order=audit_date.desc&limit=1`
    ).catch(() => []);
    instagram = rows[0] || null;
    if (instagram) sources.push({ module: "Instagram Profil Optimizasyonu", recordId: instagram.id, date: instagram.audit_date, verified: true });
    else notes.push("Bu müşteri için tamamlanmış bir Instagram profil değerlendirmesi bulunamadı.");
  } else {
    notes.push("Lead henüz bir müşteriye dönüştürülmediği için Instagram değerlendirmesi mevcut olamaz (bu modül yalnızca mevcut müşteriler için çalışır).");
  }

  let adEvaluation: AdEvaluationRow | null = null;
  if (lead.company_id) {
    const rows = await supabaseRest<AdEvaluationRow[]>(
      `ad_evaluations?company_id=eq.${lead.company_id}&status=eq.evaluated&order=created_at.desc&limit=1`
    ).catch(() => []);
    adEvaluation = rows[0] || null;
    if (adEvaluation) sources.push({ module: "Reklam Değerlendirme", recordId: adEvaluation.id, date: adEvaluation.evaluation_period_end, verified: true });
    else notes.push("Bu müşteri için tamamlanmış bir reklam değerlendirmesi bulunamadı.");
  } else {
    notes.push("Lead henüz bir müşteriye dönüştürülmediği için reklam değerlendirmesi mevcut olamaz (bu modül zaten yayında bir reklam kampanyası gerektirir).");
  }

  sources.push({ module: "Lead Center", recordId: lead.id, date: lead.created_at, verified: true });

  const hasCompetitorHints = Boolean(
    (preAudit?.competitor_analysis && JSON.stringify(preAudit.competitor_analysis) !== "{}" && JSON.stringify(preAudit.competitor_analysis) !== "[]") ||
    lead.competitor_notes?.trim()
  );

  return {
    lead,
    preAudit,
    instagram,
    adEvaluation,
    completeness: {
      lead: true,
      preAudit: Boolean(preAudit),
      instagram: Boolean(instagram),
      adEvaluation: Boolean(adEvaluation),
      competitors: hasCompetitorHints,
      budget: Boolean(lead.budget?.trim())
    },
    sources,
    notes
  };
}

function textOrPlaceholder(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  try {
    const s = JSON.stringify(value);
    return s === "{}" || s === "[]" || s === "null" ? "" : s;
  } catch {
    return "";
  }
}

const NOT_FOUND = "Bu değerlendirme HK Admin'de bulunamadı.";

/** Maps the collected context into the questionnaire shape, filling
 * ONLY currently-empty fields — an existing manually-entered value is
 * never overwritten, whether this runs on first open or via "Lead
 * Verilerini Yenile". Returns which fields were actually filled, so the
 * UI can show what changed. */
export function mergeContextIntoQuestionnaire<Q extends Record<string, unknown>>(
  questionnaire: Q,
  context: LeadProposalContext
): { questionnaire: Q; filledFields: string[] } {
  const filled: string[] = [];
  const q = structuredClone(questionnaire) as any;
  const { lead, preAudit } = context;

  function fill(path: string[], value: unknown) {
    if (value === undefined || value === null || value === "") return;
    let obj = q;
    for (let i = 0; i < path.length - 1; i++) {
      obj[path[i]] = obj[path[i]] || {};
      obj = obj[path[i]];
    }
    const key = path[path.length - 1];
    if (!obj[key]) {
      obj[key] = value;
      filled.push(path.join("."));
    }
  }

  fill(["business", "name"], lead.company || lead.name || "");
  fill(["business", "sector"], lead.sector || lead.business_type || "");
  fill(["business", "city"], lead.city || "");
  fill(["business", "district"], lead.district || "");
  fill(["business", "website"], lead.website || "");
  fill(["business", "instagram"], lead.instagram || "");
  fill(["business", "googleBusinessProfile"], lead.google_maps_url || "");
  fill(["business", "mainServices"], lead.message || "");
  fill(["audience", "city"], lead.city || "");
  if (lead.goal?.trim() && (!q.objectives || q.objectives.length === 0)) {
    q.objectives = [lead.goal.trim()];
    filled.push("objectives");
  }
  if (Array.isArray(lead.requested_platforms) && lead.requested_platforms.length && (!q.platforms || q.platforms.length === 0)) {
    q.platforms = lead.requested_platforms;
    filled.push("platforms");
  }

  if (preAudit) {
    fill(["strategy", "existingPerformance"], textOrPlaceholder(preAudit.market_analysis));
    fill(["strategy", "mainPriority"], textOrPlaceholder(preAudit.opportunities));
  }

  return { questionnaire: q as Q, filledFields: filled };
}

export { NOT_FOUND as PROPOSAL_SECTION_NOT_FOUND };

/** Renders the real previously-completed-analysis findings as Claude
 * prompt text blocks — every section either contains actual stored
 * content or the literal NOT_FOUND string, never a fabricated
 * placeholder pretending an analysis exists. */
export function buildContextFindingsBlocks(context: LeadProposalContext): { preAudit: string; instagram: string; adEvaluation: string; sourcesSummary: string } {
  const { preAudit, instagram, adEvaluation, sources, notes } = context;

  const preAuditBlock = preAudit
    ? [
        `Rapor tarihi: ${preAudit.report_date || "bilinmiyor"}`,
        preAudit.executive_summary ? `Yönetici Özeti: ${preAudit.executive_summary}` : "",
        textOrPlaceholder(preAudit.digital_presence) && `Dijital Varlık: ${textOrPlaceholder(preAudit.digital_presence)}`,
        textOrPlaceholder(preAudit.market_analysis) && `Pazar Analizi: ${textOrPlaceholder(preAudit.market_analysis)}`,
        textOrPlaceholder(preAudit.competitor_analysis) && `Rakip Analizi: ${textOrPlaceholder(preAudit.competitor_analysis)}`,
        textOrPlaceholder(preAudit.google_ads_analysis) && `Google Ads Önerileri: ${textOrPlaceholder(preAudit.google_ads_analysis)}`,
        textOrPlaceholder(preAudit.meta_ads_analysis) && `Meta Ads Önerileri: ${textOrPlaceholder(preAudit.meta_ads_analysis)}`,
        textOrPlaceholder(preAudit.swot) && `SWOT: ${textOrPlaceholder(preAudit.swot)}`,
        textOrPlaceholder(preAudit.budget_plan) && `Bütçe Planı: ${textOrPlaceholder(preAudit.budget_plan)}`,
        textOrPlaceholder(preAudit.sources) && `Kaynaklar: ${textOrPlaceholder(preAudit.sources)}`
      ].filter(Boolean).join("\n")
    : NOT_FOUND;

  const instagramBlock = instagram
    ? [
        `Değerlendirme tarihi: ${instagram.audit_date || "bilinmiyor"}`,
        instagram.instagram_username && `Hesap: @${instagram.instagram_username}`,
        instagram.overall_summary && `Genel Özet: ${instagram.overall_summary}`,
        instagram.current_bio && `Mevcut Bio: ${instagram.current_bio}`,
        instagram.recommended_bio && `Önerilen Bio: ${instagram.recommended_bio}`,
        textOrPlaceholder(instagram.priorities) && `Öncelikler: ${textOrPlaceholder(instagram.priorities)}`
      ].filter(Boolean).join("\n")
    : NOT_FOUND;

  const adEvaluationBlock = adEvaluation
    ? [
        `Değerlendirme dönemi: ${adEvaluation.evaluation_period_start || "?"} - ${adEvaluation.evaluation_period_end || "?"}`,
        adEvaluation.decision && `Karar: ${adEvaluation.decision}`,
        adEvaluation.internal_report?.executiveSummary && `Yönetici Özeti: ${adEvaluation.internal_report.executiveSummary}`,
        ...(adEvaluation.internal_report?.sections || []).map((s) => `${s.title}: ${s.content}`)
      ].filter(Boolean).join("\n")
    : NOT_FOUND;

  const sourcesSummary = sources.length
    ? sources.map((s) => `- ${s.module} (kayıt: ${s.recordId}${s.date ? `, tarih: ${s.date}` : ""})`).join("\n") +
      (notes.length ? `\n\nEksik veriler:\n${notes.map((n) => `- ${n}`).join("\n")}` : "")
    : "Hiçbir geçmiş kayıt bulunamadı — bu teklif yalnızca lead'in kendi bilgilerine dayanmaktadır.";

  return { preAudit: preAuditBlock, instagram: instagramBlock, adEvaluation: adEvaluationBlock, sourcesSummary };
}
