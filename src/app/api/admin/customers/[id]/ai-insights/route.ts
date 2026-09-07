import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

// Read-only aggregation for the Customer Profile "AI İçgörüleri (AI Insights)"
// tab — surfaces existing hk_recommendations / hk_risk_events / agent_memories
// / reports / agent_runs rows for this company. No new table: this is purely
// a company-scoped view over data the HK Intelligence CEO and Agent Hub
// features already produce. Gated on "musteriler" (same as the rest of the
// customer profile) rather than "ai-workforce" so any staff member who can
// already open a customer's profile can see this tab.
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("musteriler");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const { id } = await context.params;
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ recommendations: [], risks: [], memories: [], reports: [], recentRuns: [] });
  }

  const companyFilter = `company_id=eq.${encodeURIComponent(id)}`;
  const [recommendations, risks, memories, reports, recentRuns] = await Promise.all([
    supabaseRest<unknown[]>(`hk_recommendations?${companyFilter}&select=*&order=created_at.desc&limit=20`).catch(() => []),
    supabaseRest<unknown[]>(`hk_risk_events?${companyFilter}&select=*&order=detected_at.desc&limit=20`).catch(() => []),
    supabaseRest<unknown[]>(`agent_memories?${companyFilter}&is_active=eq.true&select=*&order=created_at.desc&limit=20`).catch(() => []),
    supabaseRest<unknown[]>(`reports?${companyFilter}&select=id,report_type,created_at&order=created_at.desc&limit=10`).catch(() => []),
    supabaseRest<unknown[]>(`agent_runs?customer_id=eq.${encodeURIComponent(id)}&select=id,agent_key,task_type,status,completed_at&order=created_at.desc&limit=10`).catch(() => [])
  ]);

  return NextResponse.json({ recommendations, risks, memories, reports, recentRuns });
}
