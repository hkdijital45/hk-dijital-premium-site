import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSafeSupabaseError, hasSupabaseConfig } from "@/lib/supabase";
import { authorizeManualOrCron, cronAuthorized } from "@/lib/social-autopilot/cron-auth";
import { startSocialRun, finishSocialRun } from "@/lib/social-autopilot/run-logger";
import { processDueQueue } from "@/lib/social-autopilot/publish-queue";

// Runs once daily (see vercel.json) — the Vercel account this deploys to is
// on the Hobby plan, which rejects any cron schedule that fires more than
// once per day (a */15 schedule was tried first and blocked every
// deployment with "Hobby accounts are limited to daily cron jobs"). This is
// the safe fallback the module's design doc calls for: same-day precision
// publishing isn't available via Vercel Cron on this plan, so use the
// "Kuyruğu İşle" button in Yayın Kuyruğu for on-demand processing between
// daily runs, or upgrade to Pro for a sub-daily schedule. Scheduled
// publishing never depends on Claude/MCP being connected either way — a
// later tick (cron or manual) still finds and publishes anything already due.
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
