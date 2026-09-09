import { NextResponse } from "next/server";
import { hasSupabaseConfig, getSafeSupabaseError } from "@/lib/supabase";
import { authorizeManualOrCron } from "@/lib/social-autopilot/cron-auth";
import { generateLearnings } from "@/lib/social-autopilot/learning-engine";
import { getActiveStrategy } from "@/lib/social-autopilot/strategy-engine";
import { startSocialRun, finishSocialRun } from "@/lib/social-autopilot/run-logger";

export async function POST(request: Request) {
  const mode = await authorizeManualOrCron(request);
  if (!mode) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });

  const runId = await startSocialRun("learning_update", mode).catch(() => null);
  try {
    const strategy = await getActiveStrategy();
    const result = await generateLearnings(strategy?.id || null);
    if (runId) await finishSocialRun(runId, "success", { cellsUpdated: result.cellsUpdated }, result.learnings.length);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const detail = getSafeSupabaseError(error).title;
    if (runId) await finishSocialRun(runId, "failed", {}, 0, detail);
    return NextResponse.json({ ok: false, error: detail }, { status: 500 });
  }
}
