import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig } from "@/lib/supabase";
import { syncSearchConsoleOpportunities } from "@/lib/growth-intelligence/sync";
import { finishRun, startRun } from "@/lib/growth-intelligence/run-logger";

export async function POST() {
  const session = await requireModuleAccess("growth-intelligence");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });

  const runId = await startRun("sync", "manual").catch(() => null);
  try {
    const result = await syncSearchConsoleOpportunities();
    if (runId) {
      await finishRun(runId, result.ok ? "success" : "failed", result, result.ok ? result.upserted : 0, result.ok ? undefined : result.message);
    }
    return NextResponse.json(result);
  } catch (error) {
    const detail = getSafeSupabaseError(error).detail;
    if (runId) await finishRun(runId, "failed", {}, 0, detail);
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
