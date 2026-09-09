import { NextResponse } from "next/server";
import { hasSupabaseConfig, getSafeSupabaseError } from "@/lib/supabase";
import { authorizeManualOrCron } from "@/lib/social-autopilot/cron-auth";
import { syncContentAnalytics, syncAccountSnapshot } from "@/lib/social-autopilot/analytics-sync";
import { startSocialRun, finishSocialRun } from "@/lib/social-autopilot/run-logger";

async function run(triggeredBy: "cron" | "manual") {
  const runId = await startSocialRun("analytics_sync", triggeredBy).catch(() => null);
  try {
    const content = await syncContentAnalytics();
    const account = await syncAccountSnapshot();
    const summary = { content, account };
    const status = content.errors.length || !account.ok ? "partial" : "success";
    if (runId) await finishSocialRun(runId, status, summary, content.snapshotsWritten, account.error);
    return NextResponse.json({ ok: true, ...summary });
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
