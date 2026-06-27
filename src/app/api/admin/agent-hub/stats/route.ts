import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

type RunRow = { id?: string; created_at?: string | null; selected_provider?: string | null; task_type?: string | null; estimated_cost?: number | string | null; status?: string | null; response_ms?: number | null; run_mode?: string | null; error_message?: string | null; provider_chain?: unknown };

export async function GET() {
  const session = await requireModuleAccess("agent-hub");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const runs = hasSupabaseConfig()
    ? await supabaseRest<RunRow[]>("agent_runs?select=id,created_at,selected_provider,task_type,estimated_cost,status,response_ms,run_mode,error_message,provider_chain&order=created_at.desc&limit=500").catch(() => [])
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
  const todayRuns = runs.filter((run) => String(run.created_at || "").startsWith(today));
  const monthRuns = runs.filter((run) => String(run.created_at || "").startsWith(month));
  const providerCosts = runs.reduce((acc: Record<string, number>, run) => {
    const key = run.selected_provider || "demo";
    acc[key] = (acc[key] || 0) + Number(run.estimated_cost || 0);
    return acc;
  }, {});
  const taskCosts = runs.reduce((acc: Record<string, number>, run) => {
    const key = run.task_type || "workflow_task";
    acc[key] = (acc[key] || 0) + Number(run.estimated_cost || 0);
    return acc;
  }, {});
  const fallbackRuns = runs.filter((run) => String(run.error_message || "").toLocaleLowerCase("tr").includes("fallback") || String(run.error_message || "").toLocaleLowerCase("tr").includes("yedek")).length;
  return NextResponse.json({
    summary: {
      todayRuns: todayRuns.length,
      monthRuns: monthRuns.length,
      successRate: runs.length ? Math.round((completed / runs.length) * 100) : 100,
      averageMs: runs.length ? Math.round(runs.reduce((sum, run) => sum + Number(run.response_ms || 0), 0) / runs.length) : 0,
      estimatedCost: runs.reduce((sum, run) => sum + Number(run.estimated_cost || 0), 0),
      todayCost: todayRuns.reduce((sum, run) => sum + Number(run.estimated_cost || 0), 0),
      monthCost: monthRuns.reduce((sum, run) => sum + Number(run.estimated_cost || 0), 0),
      averageCost: runs.length ? runs.reduce((sum, run) => sum + Number(run.estimated_cost || 0), 0) / runs.length : 0,
      topProvider: Object.entries(byProvider).sort((a, b) => b[1] - a[1])[0]?.[0] || "-",
      manusRuns: runs.filter((run) => run.selected_provider === "manus").length,
      multiAgentRuns: runs.filter((run) => run.run_mode === "multi_agent").length,
      fallbackRuns
    },
    charts: { byProvider, byTask, daily, providerCosts, taskCosts },
    expensiveRuns: [...runs].sort((a, b) => Number(b.estimated_cost || 0) - Number(a.estimated_cost || 0)).slice(0, 5),
    recentErrors: runs.filter((run) => String(run.status || "").includes("failed") || run.error_message).slice(0, 10)
  });
}
