import { NextResponse } from "next/server";
import { hasSupabaseConfig, getSafeSupabaseError, supabaseRest } from "@/lib/supabase";
import { authorizeManualOrCron } from "@/lib/social-autopilot/cron-auth";
import { refreshStrategyIfDue } from "@/lib/social-autopilot/monthly-refresh";
import { startSocialRun, finishSocialRun } from "@/lib/social-autopilot/run-logger";
import { SOCIAL_WORKSPACE_ID } from "@/lib/social-autopilot/types";
import type { SocialBrandProfile } from "@/lib/social-autopilot/types";

export async function POST(request: Request) {
  const mode = await authorizeManualOrCron(request);
  if (!mode) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });

  const runId = await startSocialRun("monthly_refresh", mode).catch(() => null);
  try {
    const brandRows = await supabaseRest<SocialBrandProfile[]>(`social_brand_profile?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&select=*&limit=1`);
    if (!brandRows[0]) throw new Error("Marka profili bulunamadı.");
    const result = await refreshStrategyIfDue(brandRows[0]);
    if (runId) await finishSocialRun(runId, "success", { refreshed: result.refreshed }, result.refreshed ? 1 : 0);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const detail = getSafeSupabaseError(error).title;
    if (runId) await finishSocialRun(runId, "failed", {}, 0, detail);
    return NextResponse.json({ ok: false, error: detail }, { status: 500 });
  }
}

export const GET = POST;
