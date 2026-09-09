// Publishing queue: scheduling, idempotent locking, retry/backoff, and the
// actual publish-time precheck + Instagram API call (spec sections 21, 54,
// 41). A cron running twice must never publish the same content twice — the
// claim step below is a conditional single-row UPDATE (status=eq.scheduled
// in the filter), which PostgREST executes atomically; if a second runner
// races the same row, its conditional UPDATE matches zero rows and it moves
// on, rather than both runners proceeding to publish.
import { supabaseRest } from "@/lib/supabase";
import {
  createMediaContainer, publishMediaContainer, pollContainerUntilFinished, getMediaPermalink, type InstagramApiError
} from "./instagram-graph-client";
import { getUsableInstagramToken, recordInstagramSuccess, recordInstagramError, InstagramNotConnectedError } from "./instagram-oauth";
import { SOCIAL_WORKSPACE_ID } from "./types";
import type { SocialAutopilotSettings, SocialContentItem, SocialQueueItem } from "./types";

async function getSettings(): Promise<SocialAutopilotSettings | null> {
  const rows = await supabaseRest<SocialAutopilotSettings[]>(`social_autopilot_settings?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&select=*&limit=1`);
  return rows[0] || null;
}

export async function enqueueContentItem(contentItemId: string, scheduledAt: string): Promise<SocialQueueItem> {
  const existing = await supabaseRest<SocialQueueItem[]>(`social_publish_queue?content_item_id=eq.${encodeURIComponent(contentItemId)}&select=*&limit=1`);
  const patch = { status: "scheduled" as const, scheduled_at: scheduledAt, last_error: null, error_category: null, attempt_count: 0, next_attempt_at: null };

  const row = existing.length
    ? (await supabaseRest<SocialQueueItem[]>(`social_publish_queue?content_item_id=eq.${encodeURIComponent(contentItemId)}&select=*`, { method: "PATCH", body: JSON.stringify(patch) }))[0]
    : (await supabaseRest<SocialQueueItem[]>("social_publish_queue", {
        method: "POST",
        body: JSON.stringify({ workspace_id: SOCIAL_WORKSPACE_ID, content_item_id: contentItemId, idempotency_key: `content-${contentItemId}`, ...patch })
      }))[0];

  await supabaseRest(`social_content_items?id=eq.${encodeURIComponent(contentItemId)}`, {
    method: "PATCH", body: JSON.stringify({ publication_status: "scheduled", scheduled_at: scheduledAt })
  });
  return row;
}

export async function cancelQueueItem(contentItemId: string) {
  await supabaseRest(`social_publish_queue?content_item_id=eq.${encodeURIComponent(contentItemId)}`, { method: "PATCH", body: JSON.stringify({ status: "cancelled" }) });
  await supabaseRest(`social_content_items?id=eq.${encodeURIComponent(contentItemId)}`, { method: "PATCH", body: JSON.stringify({ publication_status: "cancelled" }) });
}

async function claimQueueRow(id: string, lockedBy: string): Promise<SocialQueueItem | null> {
  const rows = await supabaseRest<SocialQueueItem[]>(`social_publish_queue?id=eq.${encodeURIComponent(id)}&status=eq.scheduled&select=*`, {
    method: "PATCH",
    body: JSON.stringify({ status: "preparing", locked_at: new Date().toISOString(), locked_by: lockedBy })
  });
  return rows[0] || null;
}

function backoffMinutes(attempt: number) {
  return Math.min(240, 5 * Math.pow(2, attempt)); // 5, 10, 20, 40, 80... capped at 4h
}

async function releaseForRetry(queueItem: SocialQueueItem, error: unknown, category: string) {
  const message = error instanceof Error ? error.message : String(error);
  const nextAttempt = queueItem.attempt_count + 1;
  if (nextAttempt >= queueItem.max_attempts) {
    await supabaseRest(`social_publish_queue?id=eq.${encodeURIComponent(queueItem.id)}`, {
      method: "PATCH", body: JSON.stringify({ status: "needs_review", attempt_count: nextAttempt, last_error: message.slice(0, 500), error_category: category, locked_at: null, locked_by: null })
    });
    await supabaseRest(`social_content_items?id=eq.${encodeURIComponent(queueItem.content_item_id)}`, {
      method: "PATCH", body: JSON.stringify({ publication_status: "needs_review", failure_reason: message.slice(0, 500) })
    });
    return "needs_review" as const;
  }
  const nextAttemptAt = new Date(Date.now() + backoffMinutes(nextAttempt) * 60_000).toISOString();
  await supabaseRest(`social_publish_queue?id=eq.${encodeURIComponent(queueItem.id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "scheduled", attempt_count: nextAttempt, next_attempt_at: nextAttemptAt, last_error: message.slice(0, 500), error_category: category, locked_at: null, locked_by: null })
  });
  return "retry" as const;
}

async function markPermanentFailure(queueItem: SocialQueueItem, reason: string) {
  await supabaseRest(`social_publish_queue?id=eq.${encodeURIComponent(queueItem.id)}`, {
    method: "PATCH", body: JSON.stringify({ status: "needs_review", last_error: reason.slice(0, 500), error_category: "permanent_error", locked_at: null, locked_by: null })
  });
  await supabaseRest(`social_content_items?id=eq.${encodeURIComponent(queueItem.content_item_id)}`, {
    method: "PATCH", body: JSON.stringify({ publication_status: "needs_review", failure_reason: reason.slice(0, 500) })
  });
}

/** Publish-time precheck (spec section 54) — revalidates everything right
 * before the API call, not just at schedule time, since state can change
 * between scheduling and the scheduled moment (autopilot paused, quality
 * score invalidated by a manual edit, Instagram disconnected, etc). */
async function precheckContentItem(item: SocialContentItem, settings: SocialAutopilotSettings | null): Promise<{ ok: true } | { ok: false; permanent: boolean; reason: string }> {
  if (!settings) return { ok: false, permanent: true, reason: "Autopilot ayarları bulunamadı." };
  if (settings.emergency_pause) return { ok: false, permanent: false, reason: "Acil durdurma aktif — yayın ertelendi." };
  if (!settings.autopilot_active) return { ok: false, permanent: false, reason: "Autopilot pasif — yayın ertelendi." };
  if (["cancelled", "published"].includes(item.publication_status)) return { ok: false, permanent: true, reason: `İçerik zaten ${item.publication_status} durumunda.` };
  if (!item.privacy_check_passed) return { ok: false, permanent: true, reason: "Gizlilik kontrolü geçmemiş içerik yayınlanamaz." };
  if ((item.quality_score ?? 0) < settings.min_quality_score) return { ok: false, permanent: true, reason: `Kalite skoru eşik altında (${item.quality_score ?? 0}/${settings.min_quality_score}).` };
  if (!item.caption?.trim()) return { ok: false, permanent: true, reason: "Caption boş." };
  if (!item.media_asset_urls?.length) return { ok: false, permanent: true, reason: "Medya dosyası yüklenmemiş — Content Studio'dan görsel/video yükleyin." };
  if (!item.scheduled_at || new Date(item.scheduled_at).getTime() > Date.now() + 5 * 60_000) return { ok: false, permanent: false, reason: "Planlanan zaman henüz gelmedi." };
  return { ok: true };
}

async function publishToInstagram(item: SocialContentItem, accessToken: string, igUserId: string) {
  if (item.content_type === "carousel") {
    const childIds: string[] = [];
    for (const url of item.media_asset_urls) {
      const isVideo = /\.(mp4|mov)$/i.test(url);
      const child = await createMediaContainer(accessToken, igUserId, {
        mediaType: isVideo ? "VIDEO" : "IMAGE", isCarouselItem: true, ...(isVideo ? { videoUrl: url } : { imageUrl: url })
      });
      if (isVideo) await pollContainerUntilFinished(accessToken, child.id);
      childIds.push(child.id);
    }
    const parent = await createMediaContainer(accessToken, igUserId, { mediaType: "CAROUSEL", children: childIds, caption: item.caption });
    await pollContainerUntilFinished(accessToken, parent.id, { timeoutMs: 30_000, intervalMs: 3000 });
    const published = await publishMediaContainer(accessToken, igUserId, parent.id);
    return published;
  }

  if (item.content_type === "reel") {
    const container = await createMediaContainer(accessToken, igUserId, { mediaType: "REELS", videoUrl: item.media_asset_urls[0], caption: item.caption });
    await pollContainerUntilFinished(accessToken, container.id);
    return publishMediaContainer(accessToken, igUserId, container.id);
  }

  // static / story treated as a single IMAGE container.
  const container = await createMediaContainer(accessToken, igUserId, { mediaType: item.content_type === "story" ? "STORIES" : "IMAGE", imageUrl: item.media_asset_urls[0], caption: item.content_type === "story" ? undefined : item.caption });
  if (item.content_type !== "static") await pollContainerUntilFinished(accessToken, container.id, { timeoutMs: 30_000 });
  return publishMediaContainer(accessToken, igUserId, container.id);
}

export type QueueProcessSummary = { checked: number; published: number; retried: number; needsReview: number; skipped: number };

export async function processDueQueue(runId: string): Promise<QueueProcessSummary> {
  const summary: QueueProcessSummary = { checked: 0, published: 0, retried: 0, needsReview: 0, skipped: 0 };
  const settings = await getSettings();
  const now = new Date().toISOString();

  const dueRows = await supabaseRest<SocialQueueItem[]>(
    `social_publish_queue?status=eq.scheduled&scheduled_at=lte.${encodeURIComponent(now)}&or=(next_attempt_at.is.null,next_attempt_at.lte.${encodeURIComponent(now)})&select=*&order=scheduled_at.asc&limit=10`
  );

  for (const row of dueRows) {
    summary.checked += 1;
    const claimed = await claimQueueRow(row.id, runId);
    if (!claimed) { summary.skipped += 1; continue; } // already claimed by a concurrent run

    const itemRows = await supabaseRest<SocialContentItem[]>(`social_content_items?id=eq.${encodeURIComponent(claimed.content_item_id)}&select=*&limit=1`);
    const item = itemRows[0];
    if (!item) { await markPermanentFailure(claimed, "İçerik kaydı bulunamadı."); summary.needsReview += 1; continue; }

    const precheck = await precheckContentItem(item, settings);
    if (!precheck.ok) {
      if (precheck.permanent) { await markPermanentFailure(claimed, precheck.reason); summary.needsReview += 1; }
      else { await releaseForRetry(claimed, new Error(precheck.reason), "precheck_failed"); summary.retried += 1; }
      continue;
    }

    try {
      const { accessToken, igUserId } = await getUsableInstagramToken();
      await supabaseRest(`social_publish_queue?id=eq.${encodeURIComponent(claimed.id)}`, { method: "PATCH", body: JSON.stringify({ status: "publishing" }) });
      await supabaseRest(`social_content_items?id=eq.${encodeURIComponent(item.id)}`, { method: "PATCH", body: JSON.stringify({ publication_status: "publishing" }) });

      const published = await publishToInstagram(item, accessToken, igUserId);
      const permalink = await getMediaPermalink(accessToken, published.id).catch(() => null);
      const publishedAt = new Date().toISOString();

      await supabaseRest("social_publications", {
        method: "POST",
        body: JSON.stringify({ content_item_id: item.id, external_media_id: published.id, external_permalink: permalink?.permalink || null, media_type: item.content_type, published_at: publishedAt })
      });
      await supabaseRest(`social_content_items?id=eq.${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ publication_status: "published", published_at: publishedAt, external_media_id: published.id, external_permalink: permalink?.permalink || null, failure_reason: null })
      });
      await supabaseRest(`social_publish_queue?id=eq.${encodeURIComponent(claimed.id)}`, { method: "PATCH", body: JSON.stringify({ status: "published", locked_at: null, locked_by: null }) });
      await recordInstagramSuccess({ last_publish_at: publishedAt });
      summary.published += 1;
    } catch (error) {
      if (error instanceof InstagramNotConnectedError) {
        await recordInstagramError(error.message);
        await releaseForRetry(claimed, error, "auth_error");
        summary.retried += 1;
        continue;
      }
      const apiError = error as InstagramApiError;
      const retryable = apiError.retryable !== false;
      await recordInstagramError(apiError.message || "Yayın hatası");
      if (retryable) { await releaseForRetry(claimed, error, apiError.category || "provider_error"); summary.retried += 1; }
      else { await markPermanentFailure(claimed, apiError.message || "Kalıcı yayın hatası"); summary.needsReview += 1; }
    }
  }

  return summary;
}
