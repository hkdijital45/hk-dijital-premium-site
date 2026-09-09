import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { SOCIAL_WORKSPACE_ID } from "@/lib/social-autopilot/types";
import type { SocialContentItem, SocialMetricSnapshot } from "@/lib/social-autopilot/types";

export async function GET() {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });

  try {
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString();
    const [publishedItems, accountSnapshots, todayItems, queueFailed] = await Promise.all([
      supabaseRest<SocialContentItem[]>(`social_content_items?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&publication_status=eq.published&published_at=gte.${encodeURIComponent(since30d)}&select=*`),
      supabaseRest<SocialMetricSnapshot[]>(`social_metric_snapshots?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&snapshot_scope=eq.account&select=*&order=captured_at.desc&limit=14`),
      supabaseRest<SocialContentItem[]>(`social_content_items?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&content_date=eq.${new Date().toISOString().slice(0, 10)}&select=id,publication_status`),
      supabaseRest<Array<{ id: string }>>(`social_publish_queue?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&status=eq.needs_review&select=id`)
    ]);

    const latestAccount = accountSnapshots[0];
    const earliestAccount = accountSnapshots[accountSnapshots.length - 1];
    const followerGrowth = latestAccount?.follower_count != null && earliestAccount?.follower_count != null
      ? latestAccount.follower_count - earliestAccount.follower_count
      : null;

    const pillarCounts = new Map<string, number>();
    for (const item of publishedItems) pillarCounts.set(item.content_pillar, (pillarCounts.get(item.content_pillar) || 0) + 1);
    const bestPillar = [...pillarCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    const typeCounts = new Map<string, number>();
    for (const item of publishedItems) typeCounts.set(item.content_type, (typeCounts.get(item.content_type) || 0) + 1);
    const bestType = [...typeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    return NextResponse.json({
      publishedLast30d: publishedItems.length,
      todayScheduled: todayItems.filter((item) => item.publication_status === "scheduled").length,
      todayPublished: todayItems.filter((item) => item.publication_status === "published").length,
      todayPending: todayItems.filter((item) => ["draft", "generated", "quality_check", "ready", "preparing"].includes(item.publication_status)).length,
      todayFailed: todayItems.filter((item) => ["failed", "needs_review"].includes(item.publication_status)).length,
      queueNeedsReview: queueFailed.length,
      reach30d: latestAccount?.reach || 0,
      followerGrowth,
      followerCount: latestAccount?.follower_count ?? null,
      bestContentPillar: bestPillar,
      bestContentType: bestType
    });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).title }, { status: 500 });
  }
}
