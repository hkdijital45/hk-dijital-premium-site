import { NextResponse } from "next/server";
import { getSafeSupabaseError, hasSupabaseConfig } from "@/lib/supabase";
import { authorizeManualOrCron, cronAuthorized } from "@/lib/social-autopilot/cron-auth";
import { startSocialRun, finishSocialRun } from "@/lib/social-autopilot/run-logger";
import { runDailyCycle } from "@/lib/social-autopilot/orchestrator";

async function run(triggeredBy: "cron" | "manual") {
  const runId = await startSocialRun("daily_cycle", triggeredBy).catch(() => null);
  try {
    const result = await runDailyCycle(triggeredBy);
    const summary = result.summary as Record<string, unknown>;
    const generated = Array.isArray(summary.contentGenerated) ? summary.contentGenerated.length : 0;
    if (runId) await finishSocialRun(runId, "success", summary, generated);
    return result;
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
