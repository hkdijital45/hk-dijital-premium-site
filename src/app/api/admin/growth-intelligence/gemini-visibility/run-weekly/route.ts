import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { safeCompare } from "@/lib/secure-compare";
import { runGeminiVisibilityScan } from "@/lib/gemini-visibility/scan";
import { startRun, finishRun } from "@/lib/growth-intelligence/run-logger";
import type { GeminiVisibilityProfile } from "@/lib/gemini-visibility/types";

// One weekly scan per tracked profile — several sequential customer scans,
// each of which can itself take a while (see scan/route.ts's maxDuration).
export const maxDuration = 300;

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function cronAuthorized(request: Request) {
  return safeCompare(bearerToken(request), process.env.CRON_SECRET);
}

function currentIsoWeekStart(): Date {
  const now = new Date();
  const day = now.getUTCDay() || 7;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day + 1));
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

async function runWeeklyCycle(triggeredBy: "cron" | "manual") {
  const runId = await startRun("gemini_visibility", triggeredBy).catch(() => null);
  const summary: { scanned: string[]; skippedAlreadyScanned: string[]; failed: Array<{ companyId: string; error: string }> } = {
    scanned: [], skippedAlreadyScanned: [], failed: []
  };

  try {
    const profiles = await supabaseRest<GeminiVisibilityProfile[]>("gemini_visibility_profiles?tracking_enabled=eq.true&select=*");
    const weekStart = currentIsoWeekStart().toISOString();

    for (const profile of profiles) {
      try {
        const recentScans = await supabaseRest<Array<{ id: string }>>(
          `gemini_visibility_scans?profile_id=eq.${encodeURIComponent(profile.id)}&started_at=gte.${encodeURIComponent(weekStart)}&select=id&limit=1`
        );
        if (recentScans.length) { summary.skippedAlreadyScanned.push(profile.company_id); continue; }

        const activeQuestions = await supabaseRest<Array<{ id: string }>>(
          `gemini_visibility_questions?profile_id=eq.${encodeURIComponent(profile.id)}&is_active=eq.true&deleted_at=is.null&select=id&limit=1`
        );
        if (!activeQuestions.length) { summary.skippedAlreadyScanned.push(profile.company_id); continue; }

        await runGeminiVisibilityScan(profile.id, { triggeredBy: "cron" });
        summary.scanned.push(profile.company_id);
      } catch (error) {
        // One customer's failure (quota, Gemini outage, etc.) must not stop
        // the rest of the weekly sweep.
        summary.failed.push({ companyId: profile.company_id, error: error instanceof Error ? error.message : "Bilinmeyen hata" });
      }
    }

    const status = summary.failed.length && !summary.scanned.length ? "failed" : summary.failed.length ? "partial" : "success";
    if (runId) await finishRun(runId, status, summary, summary.scanned.length, summary.failed.length ? `${summary.failed.length} müşteri taraması başarısız oldu.` : undefined);
    return { ok: true, summary };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Beklenmeyen hata";
    if (runId) await finishRun(runId, "failed", summary, summary.scanned.length, detail);
    return { ok: false, error: detail };
  }
}

export async function GET(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });
  try {
    return NextResponse.json(await runWeeklyCycle("cron"));
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authorizedByCron = cronAuthorized(request);
  const session = authorizedByCron ? null : await requireModuleAccess("growth-intelligence");
  if (!authorizedByCron && !session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });
  try {
    return NextResponse.json(await runWeeklyCycle(authorizedByCron ? "cron" : "manual"));
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
