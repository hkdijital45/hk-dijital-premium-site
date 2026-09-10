import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSafeSupabaseError, hasSupabaseConfig } from "@/lib/supabase";
import { authorizeManualOrCron, cronAuthorized } from "@/lib/social-autopilot/cron-auth";
import { startSocialRun, finishSocialRun } from "@/lib/social-autopilot/run-logger";
import { processDueQueue } from "@/lib/social-autopilot/publish-queue";

// Runs every 15 minutes (see vercel.json) — deliberately decoupled from
// run-daily/route.ts's once-a-day cycle: scheduled_at timestamps need
// finer-grained checking than once a day to actually publish close to the
// recommended time. Scheduled publishing never depends on this Vercel cron
// being hit at exactly the right minute, or on Claude/MCP being connected —
// a late tick still finds and publishes anything already due.
async function run(triggeredBy: "cron" | "manual") {
  const runId = await startSocialRun("queue_process", triggeredBy).catch(() => null);
  try {
    const summary = await processDueQueue(`vercel-cron-${randomUUID()}`);
    if (runId) await finishSocialRun(runId, "success", summary, summary.published);
    return { ok: true, summary };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Beklenmeyen hata";
    if (runId) await finishSocialRun(runId, "failed", {}, 0, detail);
    return { ok: false, error: detail };
  }
}

export async function POST(request: Request) {
  const mode = await authorizeManualOrCron(request);
  if (!mode) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });
  try {
    return NextResponse.json(await run(mode));
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

export async function GET(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });
  try {
    return NextResponse.json(await run("cron"));
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
