import { NextResponse } from "next/server";
import { hasSupabaseConfig, getSafeSupabaseError } from "@/lib/supabase";
import { authorizeManualOrCron } from "@/lib/social-autopilot/cron-auth";
import { processDueQueue } from "@/lib/social-autopilot/publish-queue";
import { startSocialRun, finishSocialRun } from "@/lib/social-autopilot/run-logger";

async function run(triggeredBy: "cron" | "manual") {
  const runId = await startSocialRun("queue_process", triggeredBy).catch(() => null);
  try {
    const summary = await processDueQueue(runId || `manual-${Date.now()}`);
    if (runId) await finishSocialRun(runId, summary.needsReview > 0 ? "partial" : "success", summary, summary.published);
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    const detail = getSafeSupabaseError(error).title;
    if (runId) await finishSocialRun(runId, "failed", {}, 0, detail);
    return NextResponse.json({ ok: false, error: detail }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const mode = await authorizeManualOrCron(request);
  if (!mode) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });
  return run(mode);
}

export async function GET(request: Request) {
  const mode = await authorizeManualOrCron(request);
  if (!mode) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });
  return run(mode);
}
