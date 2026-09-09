// Mirrors src/lib/growth-intelligence/run-logger.ts exactly, scoped to
// social_autopilot_runs — reused pattern rather than a new abstraction.
import { supabaseRest } from "@/lib/supabase";
import { SOCIAL_WORKSPACE_ID } from "./types";
import type { SocialAutopilotRun, SocialRunStatus, SocialRunType } from "./types";

export async function startSocialRun(runType: SocialRunType, triggeredBy: "cron" | "manual") {
  const rows = await supabaseRest<SocialAutopilotRun[]>("social_autopilot_runs", {
    method: "POST",
    body: JSON.stringify({
      workspace_id: SOCIAL_WORKSPACE_ID,
      run_type: runType,
      status: "running",
      started_at: new Date().toISOString(),
      triggered_by: triggeredBy
    })
  });
  return rows[0].id;
}

export async function finishSocialRun(runId: string, status: SocialRunStatus, summary: Record<string, unknown>, affectedCount: number, error?: string) {
  await supabaseRest(`social_autopilot_runs?id=eq.${encodeURIComponent(runId)}`, {
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
