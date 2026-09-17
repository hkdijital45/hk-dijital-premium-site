// Business-significant Claude output storage — reuses HK Intelligence's
// existing autonomous-agency schema (hk_intelligence_ceo_runs,
// hk_recommendations — supabase/migrations/20260629_hk_intelligence_
// autonomous_os.sql) rather than a second intelligence system. A "run" row
// is BOTH the activity record ("what did Claude do") and the intelligence
// record ("what did it conclude") — its jsonb fields hold the structured
// analysis; hk_recommendations rows (linked via created_by_run_id) are the
// trackable, individually-actionable outputs.
import { supabaseRest } from "@/lib/supabase";

export type IntelligenceInput = {
  companyId: string;
  title: string;
  activityType: string; // e.g. CUSTOMER_ANALYSIS_COMPLETED, META_ANALYSIS_COMPLETED, CUSTOMER_360_COMPLETED, STRATEGY_CREATED, PLAN_CREATED
  sources: string[]; // e.g. ["instagram", "content_tracking", "meta_ads"]
  periodStart?: string | null;
  periodEnd?: string | null;
  summary: string;
  findings?: string[];
  hypotheses?: string[];
  recommendations?: Array<{ title: string; recommendation_type: string; expected_impact?: string; priority?: string }>;
  actions?: string[];
  measurementPlan?: string[];
};

export type IntelligenceRun = {
  id: string;
  command_text: string;
  target_company_id: string | null;
  status: string;
  final_report: Record<string, unknown>;
  recommendation_summary: Record<string, unknown>;
  created_at: string;
  completed_at: string | null;
};

/** Cheap in-window dedup: the same title for the same company within the
 * last 5 minutes is treated as a retry, not a new activity (mission rule
 * 33 — avoid duplicate records from Claude/MCP retries). */
async function findRecentDuplicate(companyId: string, title: string) {
  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const rows = await supabaseRest<IntelligenceRun[]>(
    `hk_intelligence_ceo_runs?target_company_id=eq.${encodeURIComponent(companyId)}&command_text=eq.${encodeURIComponent(title)}&created_at=gte.${encodeURIComponent(since)}&select=*&limit=1`
  );
  return rows[0] || null;
}

export async function saveIntelligence(input: IntelligenceInput): Promise<{ run: IntelligenceRun; recommendationIds: string[]; deduped: boolean }> {
  const existing = await findRecentDuplicate(input.companyId, input.title);
  if (existing) return { run: existing, recommendationIds: [], deduped: true };

  const runs = await supabaseRest<IntelligenceRun[]>("hk_intelligence_ceo_runs", {
    method: "POST",
    body: JSON.stringify({
      command_text: input.title,
      target_company_id: input.companyId,
      status: "completed",
      final_report: {
        activity_type: input.activityType,
        sources: input.sources,
        period_start: input.periodStart || null,
        period_end: input.periodEnd || null,
        summary: input.summary,
        findings: input.findings || [],
        hypotheses: input.hypotheses || [],
        actions: input.actions || [],
        measurement_plan: input.measurementPlan || []
      },
      recommendation_summary: { count: input.recommendations?.length || 0 },
      completed_at: new Date().toISOString()
    })
  });
  const run = runs[0];

  const recommendationIds: string[] = [];
  if (input.recommendations?.length) {
    const rows = await supabaseRest<Array<{ id: string }>>("hk_recommendations", {
      method: "POST",
      body: JSON.stringify(input.recommendations.map((r) => ({
        company_id: input.companyId,
        title: r.title,
        recommendation_type: r.recommendation_type,
        expected_impact: r.expected_impact || null,
        status: "open",
        source: "claude_marketing_intelligence",
        created_by_run_id: run.id,
        metadata: r.priority ? { priority: r.priority } : {}
      })))
    });
    recommendationIds.push(...rows.map((r) => r.id));
  }

  return { run, recommendationIds, deduped: false };
}

export async function getIntelligenceHistory(companyId: string, limit = 20): Promise<IntelligenceRun[]> {
  return supabaseRest<IntelligenceRun[]>(
    `hk_intelligence_ceo_runs?target_company_id=eq.${encodeURIComponent(companyId)}&select=*&order=created_at.desc&limit=${limit}`
  );
}

export type Recommendation = {
  id: string;
  company_id: string;
  title: string;
  recommendation_type: string;
  expected_impact: string | null;
  status: string;
  source: string;
  created_by_run_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export async function getRecommendations(companyId: string, status?: string, limit = 50): Promise<Recommendation[]> {
  const statusFilter = status ? `&status=eq.${encodeURIComponent(status)}` : "";
  return supabaseRest<Recommendation[]>(
    `hk_recommendations?company_id=eq.${encodeURIComponent(companyId)}${statusFilter}&select=*&order=created_at.desc&limit=${limit}`
  );
}

const VALID_STATUSES = ["open", "planned", "implemented", "rejected"];

export async function updateRecommendation(id: string, status: string): Promise<Recommendation | null> {
  if (!VALID_STATUSES.includes(status)) throw new Error(`Geçersiz durum: ${status}. Geçerli değerler: ${VALID_STATUSES.join(", ")}.`);
  // hk_recommendations has no dedicated implemented_at column — the
  // timestamp goes in metadata (jsonb) instead of adding one, avoiding an
  // otherwise-unnecessary migration for a single field.
  const existing = await supabaseRest<Recommendation[]>(`hk_recommendations?id=eq.${encodeURIComponent(id)}&select=metadata`);
  const metadata = { ...(existing[0]?.metadata || {}) } as Record<string, unknown>;
  if (status === "implemented") metadata.implemented_at = new Date().toISOString();
  const rows = await supabaseRest<Recommendation[]>(`hk_recommendations?id=eq.${encodeURIComponent(id)}&select=*`, {
    method: "PATCH",
    body: JSON.stringify({ status, metadata, updated_at: new Date().toISOString() })
  });
  return rows[0] || null;
}
