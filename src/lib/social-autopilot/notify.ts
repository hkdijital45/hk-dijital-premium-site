// Alerting (spec section 33). Reuses the existing Discord webhook pattern
// (same fetch/body shape as src/app/api/admin/agent-hub/runs/[id]/notify/route.ts)
// and the existing activity-log/audit trail (Log Merkezi) rather than
// inventing a second notification channel. Never spams: each call site in
// orchestrator.ts / publish-queue.ts only fires on a genuine state
// transition (e.g. newly disconnected, not "still disconnected" every run).
import { recordActivity } from "@/lib/activity-log";

export async function notifySocialAutopilot(message: string, { critical = false }: { critical?: boolean } = {}) {
  await recordActivity({
    action: "API İşlemi",
    entity: "HK Social Autopilot",
    details: { message, critical, source: "social-autopilot" }
  }).catch(() => {});

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `HK Social Autopilot: ${message}`, content: `HK Social Autopilot: ${message}` })
    });
  } catch {
    // Best-effort — a failed webhook must never break the calling job.
  }
}
