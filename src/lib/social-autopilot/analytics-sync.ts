// Analytics sync (spec sections 26-27). Pulls Instagram Insights at fixed
// snapshot windows after publication and one daily account-level snapshot,
// storing each as a new row (never overwriting) so trend analysis works.
//
// IMPORTANT — verified-metric caveat: Instagram Insights metric names are
// the single fastest-moving part of Meta's API surface (Meta deprecated
// profile_views, website_clicks and several others in the January 2025
// Graph API v21 update, per Meta's own changelog). The metric lists below
// reflect the metrics documented as current at the time this was written,
// but this module deliberately does NOT assume they will all remain valid
// forever: fetchResilientMetrics tries the full batch first, and on any
// failure falls back to fetching metrics one at a time, keeping whatever
// succeeds and silently dropping whichever single metric Meta has renamed
// or removed — so one deprecated metric name degrades a field, not the
// entire sync. Re-verify the exact metric list against
// https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-media/insights
// (and .../ig-user/insights) against a real connected account before
// depending on this for anything business-critical.
import { supabaseRest } from "@/lib/supabase";
import { getAccountInsights, getMediaInsights } from "./instagram-graph-client";
import { getUsableInstagramToken, recordInstagramSuccess } from "./instagram-oauth";
import { computeContentScore } from "./scoring-engine";
import { SOCIAL_WORKSPACE_ID } from "./types";
import type { SocialContentItem, SocialMetricSnapshot, SocialSnapshotWindow } from "./types";

const CONTENT_METRICS_BY_TYPE: Record<string, string[]> = {
  reel: ["reach", "saved", "likes", "comments", "shares", "plays"],
  carousel: ["reach", "saved", "likes", "comments", "shares"],
  static: ["reach", "saved", "likes", "comments", "shares"],
  story: ["reach", "replies"]
};

const ACCOUNT_METRICS = ["reach", "follower_count", "accounts_engaged"];

const WINDOW_HOURS: Record<Exclude<SocialSnapshotWindow, "daily">, number> = { "1h": 1, "24h": 24, "72h": 72, "7d": 24 * 7, "30d": 24 * 30 };

async function fetchResilientMediaMetrics(accessToken: string, mediaId: string, metrics: string[]) {
  try {
    const result = await getMediaInsights(accessToken, mediaId, metrics);
    return Object.fromEntries(result.data.map((entry) => [entry.name, entry.values[0]?.value ?? 0]));
  } catch {
    const values: Record<string, number> = {};
    for (const metric of metrics) {
      try {
        const result = await getMediaInsights(accessToken, mediaId, [metric]);
        values[metric] = result.data[0]?.values[0]?.value ?? 0;
      } catch { /* metric unavailable for this media type/API version — skip it, not the whole sync */ }
    }
    return values;
  }
}

function windowElapsedHours(publishedAt: string) {
  return (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60);
}

async function alreadyCaptured(contentItemId: string, window: SocialSnapshotWindow) {
  const rows = await supabaseRest<Array<{ id: string }>>(
    `social_metric_snapshots?content_item_id=eq.${encodeURIComponent(contentItemId)}&snapshot_window=eq.${window}&select=id&limit=1`
  );
  return rows.length > 0;
}

export async function syncContentAnalytics(): Promise<{ snapshotsWritten: number; itemsChecked: number; errors: string[] }> {
  const errors: string[] = [];
  let snapshotsWritten = 0;

  const publishedItems = await supabaseRest<SocialContentItem[]>(
    `social_content_items?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&publication_status=eq.published&published_at=gte.${encodeURIComponent(new Date(Date.now() - 31 * 24 * 60 * 60_000).toISOString())}&select=*`
  );

  if (!publishedItems.length) return { snapshotsWritten: 0, itemsChecked: 0, errors: [] };

  let accessToken: string;
  try {
    ({ accessToken } = await getUsableInstagramToken()); // igUserId not needed — media insights are addressed by media id alone
  } catch (error) {
    return { snapshotsWritten: 0, itemsChecked: publishedItems.length, errors: [error instanceof Error ? error.message : "Instagram bağlı değil."] };
  }

  for (const item of publishedItems) {
    if (!item.published_at || !item.external_media_id) continue;
    const elapsedHours = windowElapsedHours(item.published_at);

    for (const [window, thresholdHours] of Object.entries(WINDOW_HOURS) as Array<[Exclude<SocialSnapshotWindow, "daily">, number]>) {
      if (elapsedHours < thresholdHours) continue;
      if (await alreadyCaptured(item.id, window)) continue;

      try {
        const metrics = CONTENT_METRICS_BY_TYPE[item.content_type] || CONTENT_METRICS_BY_TYPE.static;
        const values = await fetchResilientMediaMetrics(accessToken, item.external_media_id, metrics);
        const snapshot: Partial<SocialMetricSnapshot> = {
          workspace_id: SOCIAL_WORKSPACE_ID, content_item_id: item.id, snapshot_scope: "content", snapshot_window: window,
          reach: values.reach || 0, saves: values.saved || 0, likes: values.likes || 0, comments: values.comments || 0,
          shares: values.shares || 0, video_views: values.plays || 0, captured_at: new Date().toISOString()
        };
        const score = computeContentScore(snapshot as SocialMetricSnapshot, item.cta_goal);
        const created = await supabaseRest<SocialMetricSnapshot[]>("social_metric_snapshots", {
          method: "POST", body: JSON.stringify({ ...snapshot, performance_score: score })
        });
        if (created.length) snapshotsWritten += 1;
      } catch (error) {
        errors.push(`${item.id}/${window}: ${error instanceof Error ? error.message : "bilinmeyen hata"}`);
      }
    }
  }

  await recordInstagramSuccess({ last_insights_sync_at: new Date().toISOString() });
  return { snapshotsWritten, itemsChecked: publishedItems.length, errors };
}

export async function syncAccountSnapshot(): Promise<{ ok: boolean; error?: string }> {
  try {
    const { accessToken, igUserId } = await getUsableInstagramToken();
    let values: Record<string, number> = {};
    try {
      const result = await getAccountInsights(accessToken, igUserId, ACCOUNT_METRICS, "day");
      values = Object.fromEntries(result.data.map((entry) => [entry.name, entry.values[entry.values.length - 1]?.value ?? 0]));
    } catch {
      for (const metric of ACCOUNT_METRICS) {
        try {
          const result = await getAccountInsights(accessToken, igUserId, [metric], "day");
          values[metric] = result.data[0]?.values[result.data[0].values.length - 1]?.value ?? 0;
        } catch { /* skip unavailable metric */ }
      }
    }
    await supabaseRest("social_metric_snapshots", {
      method: "POST",
      body: JSON.stringify({
        workspace_id: SOCIAL_WORKSPACE_ID, content_item_id: null, snapshot_scope: "account", snapshot_window: "daily",
        reach: values.reach || 0, follower_count: values.follower_count || null, captured_at: new Date().toISOString()
      })
    });
    await recordInstagramSuccess({ last_insights_sync_at: new Date().toISOString() });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Hesap analitiği senkronize edilemedi." };
  }
}
