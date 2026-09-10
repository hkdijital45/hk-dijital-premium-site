import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { supabaseRest, getSafeSupabaseError } from "@/lib/supabase";
import { getInstagramConnectionStatus } from "@/lib/social-autopilot/instagram-oauth";
import { computeStrategySupplyStatus } from "@/lib/social-autopilot/strategy-supply";
import { summarizePerformance, type ObservedItem } from "@/lib/social-autopilot/performance-summary";
import { SOCIAL_WORKSPACE_ID } from "@/lib/social-autopilot/types";
import type { SocialAutopilotSettings, SocialContentItem, MetricSnapshot, PublishingTimeRecommendation } from "@/lib/social-autopilot/types";

export async function GET() {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });

  try {
    const todayStart = new Date().toISOString().slice(0, 10);
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString();

    const [settingsRows, connection, strategySupply, todayItems, snapshots, performanceRows, bestWindowRows, nextPostRows] = await Promise.all([
      supabaseRest<SocialAutopilotSettings[]>(`social_autopilot_settings?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&select=*&limit=1`),
      getInstagramConnectionStatus(),
      computeStrategySupplyStatus(),
      supabaseRest<Array<{ publication_status: string }>>(`social_content_items?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&content_date=eq.${todayStart}&select=publication_status`),
      supabaseRest<MetricSnapshot[]>(`social_metric_snapshots?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&captured_at=gte.${encodeURIComponent(since30d)}&select=*`),
      supabaseRest<ObservedItem[]>(`social_content_items?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&publication_status=eq.published&published_at=gte.${encodeURIComponent(since30d)}&select=*,metric_snapshots:social_metric_snapshots(*)&limit=500`),
      supabaseRest<PublishingTimeRecommendation[]>(`social_publishing_time_recommendations?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&select=*&order=avg_score.desc&limit=1`),
      supabaseRest<Array<Pick<SocialContentItem, "id" | "content_date" | "scheduled_at" | "content_type" | "title">>>(
        `social_content_items?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&publication_status=eq.scheduled&scheduled_at=gte.${encodeURIComponent(new Date().toISOString())}&select=id,content_date,scheduled_at,content_type,title&order=scheduled_at.asc&limit=1`
      )
    ]);

    const settings = settingsRows[0] || null;
    const todayScheduled = todayItems.filter((row) => row.publication_status === "scheduled").length;
    const todayPublished = todayItems.filter((row) => row.publication_status === "published").length;
    const todayFailures = todayItems.filter((row) => ["failed", "needs_review", "media_failed"].includes(row.publication_status)).length;

    const contentSnapshots = snapshots.filter((row) => row.snapshot_scope === "content");
    const accountSnapshots = snapshots.filter((row) => row.snapshot_scope === "account").sort((a, b) => a.captured_at.localeCompare(b.captured_at));
    const reach30d = contentSnapshots.reduce((sum, row) => sum + row.reach, 0);
    const saves30d = contentSnapshots.reduce((sum, row) => sum + row.saves, 0);
    const shares30d = contentSnapshots.reduce((sum, row) => sum + row.shares, 0);
    const profileVisits30d = contentSnapshots.reduce((sum, row) => sum + row.profile_visits, 0);
    const followerGrowth30d = accountSnapshots.length > 1 && accountSnapshots[0].follower_count !== null && accountSnapshots.at(-1)!.follower_count !== null
      ? accountSnapshots.at(-1)!.follower_count! - accountSnapshots[0].follower_count!
      : null;

    const performance = summarizePerformance(performanceRows);

    return NextResponse.json({
      autopilotActive: settings?.autopilot_active ?? false,
      emergencyPause: settings?.emergency_pause ?? false,
      controlMode: settings?.control_mode ?? "manual",
      testMode: settings?.test_mode ?? true,
      instagramConnection: connection,
      today: { scheduled: todayScheduled, published: todayPublished, failures: todayFailures },
      last30Days: { reach: reach30d, followerGrowth: followerGrowth30d, profileVisits: profileVisits30d, saves: saves30d, shares: shares30d },
      bestContentType: performance.best_performing_format,
      strongestContentPillar: performance.strongest_content_pillar,
      strongestPublishingWindow: bestWindowRows[0] || null,
      nextPost: nextPostRows[0] || null,
      strategySupply
    });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
