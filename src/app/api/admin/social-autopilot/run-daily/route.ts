import { NextResponse } from "next/server";
import { hasSupabaseConfig, getSafeSupabaseError } from "@/lib/supabase";
import { authorizeManualOrCron } from "@/lib/social-autopilot/cron-auth";
import { runDailyCycle } from "@/lib/social-autopilot/orchestrator";
import { startSocialRun, finishSocialRun } from "@/lib/social-autopilot/run-logger";

async function run(triggeredBy: "cron" | "manual") {
  const runId = await startSocialRun("daily_cycle", triggeredBy).catch(() => null);
  try {
    const result = await runDailyCycle(triggeredBy);
    const affected = Array.isArray((result.summary as Record<string, unknown>)?.contentGenerated) ? ((result.summary as { contentGenerated: unknown[] }).contentGenerated.length) : 0;
    if (runId) await finishSocialRun(runId, "success", result.summary, affected);
    return NextResponse.json(result);
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
