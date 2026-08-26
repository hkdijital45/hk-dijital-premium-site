import { supabaseRest } from "@/lib/supabase";
import { DEFAULT_WORKSPACE_ID, type GrowthAutomationRun, type GrowthRunStatus, type GrowthRunType } from "./types";

export async function startRun(runType: GrowthRunType, triggeredBy: "cron" | "manual") {
  const rows = await supabaseRest<GrowthAutomationRun[]>("growth_automation_runs", {
    method: "POST",
    body: JSON.stringify({
      workspace_id: DEFAULT_WORKSPACE_ID,
      run_type: runType,
      status: "running",
      started_at: new Date().toISOString(),
      triggered_by: triggeredBy
    })
  });
  return rows[0].id as string;
}

export async function finishRun(runId: string, status: GrowthRunStatus, summary: Record<string, unknown>, affectedCount: number, error?: string) {
  await supabaseRest(`growth_automation_runs?id=eq.${encodeURIComponent(runId)}`, {
    method: "PATCH",
    body: JSON.stringify({
      status,
      finished_at: new Date().toISOString(),
      summary,
      affected_count: affectedCount,
      error: error || null
    })
  });
}
