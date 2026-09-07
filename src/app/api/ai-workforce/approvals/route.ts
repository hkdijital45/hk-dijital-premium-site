import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { AI_WORKFORCE_MODULE } from "@/lib/ai-workforce-schema";

type ApprovalRow = {
  id: string;
  title: string;
  description?: string | null;
  action_type: string;
  risk_level: string;
  agent_key?: string | null;
  company_id?: string | null;
  status: string;
  execution_status: string;
  created_at: string;
  decided_at?: string | null;
};

type RecommendationRow = {
  id: string;
  company_id?: string | null;
  title: string;
  recommendation_type: string;
  expected_impact?: string | null;
  estimated_cost?: number | null;
  success_probability?: number | null;
  status: string;
  created_at: string;
};

// Approvals merges two real sources rather than duplicating data: new
// Director-originated proposals (ai_approval_requests) and the existing,
// already-populated HK Intelligence recommendation engine (hk_recommendations,
// status = 'open'). Both decide through the PATCH route below.
export async function GET() {
  const session = await requireModuleAccess(AI_WORKFORCE_MODULE);
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ approvals: [] });

  const [approvals, recommendations] = await Promise.all([
    supabaseRest<ApprovalRow[]>("ai_approval_requests?select=*&order=created_at.desc&limit=100").catch(() => []),
    supabaseRest<RecommendationRow[]>("hk_recommendations?status=eq.open&select=*&order=created_at.desc&limit=100").catch(() => [])
  ]);

  const merged = [
    ...approvals.map((row) => ({
      id: row.id,
      source: "approval" as const,
      title: row.title,
      description: row.description || "",
      actionType: row.action_type,
      riskLevel: row.risk_level,
      agentKey: row.agent_key || null,
      companyId: row.company_id || null,
      status: row.status,
      executionStatus: row.execution_status,
      createdAt: row.created_at,
      decidedAt: row.decided_at || null
    })),
    ...recommendations.map((row) => ({
      id: row.id,
      source: "recommendation" as const,
      title: row.title,
      description: [row.recommendation_type, row.expected_impact].filter(Boolean).join(" · "),
      actionType: "internal_write" as const,
      riskLevel: "low" as const,
      agentKey: null,
      companyId: row.company_id || null,
      status: "pending" as const,
      executionStatus: "pending" as const,
      createdAt: row.created_at,
      decidedAt: null
    }))
  ].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return NextResponse.json({ approvals: merged });
}

export async function POST(request: Request) {
  const session = await requireModuleAccess(AI_WORKFORCE_MODULE);
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 503 });
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ error: "Başlık zorunludur." }, { status: 400 });

  try {
    const rows = await supabaseRest<ApprovalRow[]>("ai_approval_requests", {
      method: "POST",
      body: JSON.stringify({
        title,
        description: body.description || null,
        action_type: body.actionType || "internal_write",
        risk_level: body.riskLevel || "low",
        agent_key: body.agentKey || null,
        company_id: body.companyId || null,
        source_type: body.sourceType || "manual",
        source_id: body.sourceId || null,
        proposed_change: body.proposedChange || {},
        created_by: session.profileId || session.authUserId || null
      })
    });
    return NextResponse.json({ ok: true, approval: rows[0] });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title, detail: safe.detail }, { status: 500 });
  }
}
