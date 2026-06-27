import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

type RunRow = { created_at?: string | null; selected_provider?: string | null; task_type?: string | null; estimated_cost?: number | string | null; status?: string | null; response_ms?: number | null; run_mode?: string | null };

export async function GET() {
  const session = await requireModuleAccess("agent-hub");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const runs = hasSupabaseConfig()
    ? await supabaseRest<RunRow[]>("agent_runs?select=created_at,selected_provider,task_type,estimated_cost,status,response_ms,run_mode&order=created_at.desc&limit=500").catch(() => [])
    : [];
  const today = new Date().toISOString().slice(0, 10);
  const month = new Date().toISOString().slice(0, 7);
  const byProvider = runs.reduce((acc: Record<string, number>, run) => {
    const key = run.selected_provider || "demo";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const byTask = runs.reduce((acc: Record<string, number>, run) => {
    const key = run.task_type || "workflow_task";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const daily = runs.reduce((acc: Record<string, number>, run) => {
    const key = String(run.created_at || "").slice(0, 10);
    if (key) acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const completed = runs.filter((run) => String(run.status || "").startsWith("completed")).length;
  return NextResponse.json({
    summary: {
      todayRuns: runs.filter((run) => String(run.created_at || "").startsWith(today)).length,
      monthRuns: runs.filter((run) => String(run.created_at || "").startsWith(month)).length,
      successRate: runs.length ? Math.round((completed / runs.length) * 100) : 100,
      averageMs: runs.length ? Math.round(runs.reduce((sum, run) => sum + Number(run.response_ms || 0), 0) / runs.length) : 0,
      estimatedCost: runs.reduce((sum, run) => sum + Number(run.estimated_cost || 0), 0),
      topProvider: Object.entries(byProvider).sort((a, b) => b[1] - a[1])[0]?.[0] || "-",
      manusRuns: runs.filter((run) => run.selected_provider === "manus").length,
      multiAgentRuns: runs.filter((run) => run.run_mode === "multi_agent").length
    },
    charts: { byProvider, byTask, daily }
  });
}
