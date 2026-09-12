// Canonical merge of the two real "closed deal" sources this app has: main
// CRM leads (Satış Hunisi / Lead Merkezi) and the separate Fırsat Haritası
// opportunity flow (agency_opportunities + its historical
// agency_learning_signals). Previously "Kazanıldı / Kaybedildi Analizi"
// only read the Fırsat Haritası side, so deals won or lost through the main
// CRM pipeline never appeared in the analysis.
//
// Callers resolve each lead's outcome via the app's own existing canonical
// status mapping (pipelineStageForLead() in AdminDashboard.tsx) before
// calling this — that mapping is not duplicated here, so there is exactly
// one place that decides what counts as "Kazanıldı"/"Kaybedildi".
//
// agency_opportunities.lead_id is a real FK into leads(id)
// (supabase/migrations/20260626_agency_operation_persistence.sql): whenever
// it resolves to a lead already counted from the CRM side, the opportunity
// (and any learning signal derived from it) is skipped so the same real
// deal is never counted twice.
export type WonLostOutcome = "Kazanıldı" | "Kaybedildi";

export type WonLostLeadInput = {
  id: string;
  outcome: WonLostOutcome | null;
  sector?: string | null;
  business_type?: string | null;
  city?: string | null;
  district?: string | null;
  opportunity_score?: number | null;
  lead_heat_score?: number | null;
  proposal_amount?: number | null;
  recommended_package?: string | null;
  goal?: string | null;
  proposal_sent_at?: string | null;
  updated_at?: string | null;
  won_lost_reason?: string | null;
  rejection_reason?: string | null;
  assigned_to?: string | null;
};

export type WonLostOpportunityInput = {
  id: string;
  lead_id?: string | null;
  won_lost_status?: string | null;
  pipeline_status?: string | null;
  sector?: string | null;
  city?: string | null;
  district?: string | null;
  priority_score?: number | null;
  estimated_monthly_revenue?: number | null;
  sub_sector?: string | null;
  updated_at?: string | null;
  won_lost_reason?: string | null;
  assigned_to?: string | null;
};

export type WonLostSignalInput = {
  id: string;
  opportunity_id?: string | null;
  outcome?: string | null;
  sector?: string | null;
  city?: string | null;
  service_fee?: number | null;
  package_name?: string | null;
  loss_reason?: string | null;
  created_at?: string | null;
};

export type WonLostEntry = {
  id: string;
  source: "CRM" | "Fırsat Haritası" | "Fırsat Haritası (geçmiş)";
  outcome: WonLostOutcome;
  sector: string;
  city: string;
  district: string;
  opportunity_score: number | null;
  proposal_amount: number;
  service_type: string;
  close_date: string;
  loss_reason: string;
  sales_owner: string;
};

function dateOnly(value: unknown): string {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function isWonOrLost(value: unknown): value is WonLostOutcome {
  return value === "Kazanıldı" || value === "Kaybedildi";
}

export function mergeWonLostDeals(input: {
  leads: WonLostLeadInput[];
  opportunities: WonLostOpportunityInput[];
  signals: WonLostSignalInput[];
}): WonLostEntry[] {
  const entries: WonLostEntry[] = [];
  const seenLeadIds = new Set<string>();

  for (const lead of input.leads) {
    if (!isWonOrLost(lead.outcome)) continue;
    seenLeadIds.add(lead.id);
    entries.push({
      id: `lead-${lead.id}`,
      source: "CRM",
      outcome: lead.outcome,
      sector: lead.sector || lead.business_type || "Belirtilmedi",
      city: lead.city || "Belirtilmedi",
      district: lead.district || "Belirtilmedi",
      opportunity_score: Number(lead.opportunity_score || lead.lead_heat_score || 0) || null,
      proposal_amount: Number(lead.proposal_amount || 0),
      service_type: lead.recommended_package || lead.goal || "Belirtilmedi",
      close_date: dateOnly(lead.proposal_sent_at || lead.updated_at),
      loss_reason: lead.won_lost_reason || lead.rejection_reason || "",
      sales_owner: lead.assigned_to || ""
    });
  }

  const opportunityById = new Map(input.opportunities.map((item) => [item.id, item]));
  const countedOpportunityIds = new Set<string>();
  for (const opportunity of input.opportunities) {
    const outcome = opportunity.won_lost_status || opportunity.pipeline_status;
    if (!isWonOrLost(outcome)) continue;
    if (opportunity.lead_id && seenLeadIds.has(opportunity.lead_id)) continue;
    countedOpportunityIds.add(opportunity.id);
    entries.push({
      id: `opportunity-${opportunity.id}`,
      source: "Fırsat Haritası",
      outcome,
      sector: opportunity.sector || "Belirtilmedi",
      city: opportunity.city || "Belirtilmedi",
      district: opportunity.district || "Belirtilmedi",
      opportunity_score: Number(opportunity.priority_score || 0) || null,
      proposal_amount: Number(opportunity.estimated_monthly_revenue || 0),
      service_type: opportunity.sub_sector || "Belirtilmedi",
      close_date: dateOnly(opportunity.updated_at),
      loss_reason: opportunity.won_lost_reason || "",
      sales_owner: opportunity.assigned_to || ""
    });
  }

  for (const signal of input.signals) {
    if (!isWonOrLost(signal.outcome)) continue;
    const opportunity = signal.opportunity_id ? opportunityById.get(signal.opportunity_id) : undefined;
    if (opportunity?.lead_id && seenLeadIds.has(opportunity.lead_id)) continue;
    if (signal.opportunity_id && countedOpportunityIds.has(signal.opportunity_id)) continue;
    entries.push({
      id: `signal-${signal.id}`,
      source: "Fırsat Haritası (geçmiş)",
      outcome: signal.outcome,
      sector: signal.sector || opportunity?.sector || "Belirtilmedi",
      city: signal.city || opportunity?.city || "Belirtilmedi",
      district: opportunity?.district || "Belirtilmedi",
      opportunity_score: Number(opportunity?.priority_score || 0) || null,
      proposal_amount: Number(signal.service_fee || 0),
      service_type: signal.package_name || "Belirtilmedi",
      close_date: dateOnly(signal.created_at),
      loss_reason: signal.loss_reason || "",
      sales_owner: ""
    });
  }

  return entries;
}

export function summarizeWonLost(entries: WonLostEntry[]) {
  const won = entries.filter((item) => item.outcome === "Kazanıldı");
  const lost = entries.filter((item) => item.outcome === "Kaybedildi");
  const winRate = won.length + lost.length ? Math.round((won.length / (won.length + lost.length)) * 100) : null;
  return { won, lost, winRate };
}
