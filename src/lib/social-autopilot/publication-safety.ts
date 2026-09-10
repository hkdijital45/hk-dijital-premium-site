// The single, shared "is real Instagram publishing actually allowed right
// now" gate — every caller (publish-queue.ts, control/services.ts's
// instagram_publish_now/autopilot_run_daily_cycle) goes through this exact
// function. Fails closed: production NODE_ENV, the explicit
// INSTAGRAM_PUBLISH_ENABLED app-wide kill switch, and the workspace's own
// settings (test_mode off, no emergency pause, autopilot active) must ALL
// be true simultaneously.
import type { SocialAutopilotSettings } from "./types";

export function publicationAllowed(
  settings: Pick<SocialAutopilotSettings, "test_mode" | "emergency_pause" | "autopilot_active"> | null,
  env: Record<string, string | undefined> = process.env
) {
  return env.NODE_ENV === "production" && env.INSTAGRAM_PUBLISH_ENABLED === "true" && !!settings && settings.test_mode === false && !settings.emergency_pause && settings.autopilot_active;
}
