import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { supabaseRest, getSafeSupabaseError } from "@/lib/supabase";
import { summarizePerformance, type ObservedItem } from "@/lib/social-autopilot/performance-summary";
import { SOCIAL_WORKSPACE_ID } from "@/lib/social-autopilot/types";
import type { MetricSnapshot } from "@/lib/social-autopilot/types";

const WINDOW_DAYS: Record<string, number> = { "24h": 1, "72h": 3, "7d": 7, "30d": 30 };

export async function GET(request: Request) {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const url = new URL(request.url);
  const range = url.searchParams.get("range") || "30d";
  const days = WINDOW_DAYS[range] || 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60_000).toISOString();

  try {
    const [items, accountSnapshots] = await Promise.all([
      supabaseRest<ObservedItem[]>(`social_content_items?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&publication_status=eq.published&published_at=gte.${encodeURIComponent(since)}&select=*,metric_snapshots:social_metric_snapshots(*)&limit=500`),
      supabaseRest<MetricSnapshot[]>(`social_metric_snapshots?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&snapshot_scope=eq.account&captured_at=gte.${encodeURIComponent(since)}&select=*&order=captured_at.asc`)
    ]);
    return NextResponse.json({ range, performance: summarizePerformance(items), accountSnapshots });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
