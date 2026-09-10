// Daily orchestration. Ties the engine together: ensure strategy exists/
// refresh if due, generate today's + near-term missing content within the
// weekly frequency and daily cap, run the quality gate (auto-revise up to
// the configured retry limit), run the media stage (AUTO/MANUAL — see
// media/pipeline.ts), and auto-schedule ready items with real media when
// control_mode is full_auto. Publishing itself and analytics/learning
// updates are separate cron-able steps (publish-queue.ts, analytics-
// sync.ts, learning-engine.ts) called from here but designed to also run
// standalone on their own schedule via HK Admin's existing cron routes.
import { supabaseRest } from "@/lib/supabase";
import { planDailyContentBrief, generateContentItem, runMediaAndPersist } from "./content-generator";
import { determineMediaMode } from "./media/pipeline";
import { runQualityGate } from "./quality-gate";
import { loadPrivacyWatchlist } from "./privacy-filter";
import { getActiveStrategy } from "./strategy-engine";
import { refreshStrategyIfDue } from "./monthly-refresh";
import { recommendPublishTime } from "./posting-time-engine";
import { enqueueContentItem } from "./publish-queue";
import { syncContentAnalytics, syncAccountSnapshot } from "./analytics-sync";
import { generateLearnings } from "./learning-engine";
import { computeStrategySupplyStatus } from "./strategy-supply";
import { getInstagramConnectionStatus } from "./instagram-oauth";
import { notifySocialAutopilot } from "./notify";
import { DEFAULT_QUALITY_THRESHOLD, MAX_QUALITY_AUTO_REVISIONS } from "./constants";
import { SOCIAL_WORKSPACE_ID } from "./types";
import type { SocialAutopilotSettings, SocialBrandProfile, SocialContentItem, ContentType, SocialStrategy } from "./types";

const LOOKAHEAD_DAYS = 3;

async function getSettings(): Promise<SocialAutopilotSettings> {
  const rows = await supabaseRest<SocialAutopilotSettings[]>(`social_autopilot_settings?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&select=*&limit=1`);
  if (!rows[0]) throw new Error("social_autopilot_settings satırı bulunamadı — migration uygulanmamış olabilir.");
  return rows[0];
}

async function getBrand(): Promise<SocialBrandProfile> {
  const rows = await supabaseRest<SocialBrandProfile[]>(`social_brand_profile?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&select=*&limit=1`);
  if (!rows[0]) throw new Error("social_brand_profile satırı bulunamadı — migration uygulanmamış olabilir.");
  return rows[0];
}

function isoWeekRange(dateIso: string) {
  const date = new Date(`${dateIso}T00:00:00Z`);
  const day = date.getUTCDay() || 7;
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() - day + 1);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { start: monday.toISOString().slice(0, 10), end: sunday.toISOString().slice(0, 10) };
}

async function countThisWeek(dateIso: string) {
  const { start, end } = isoWeekRange(dateIso);
  const rows = await supabaseRest<Array<{ id: string }>>(
    `social_content_items?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&content_date=gte.${start}&content_date=lte.${end}&generation_status=neq.failed&select=id`
  );
  return rows.length;
}

async function recentContext() {
  const rows = await supabaseRest<SocialContentItem[]>(
    `social_content_items?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&select=hook,hook_archetype,topic,content_pillar,caption,creative_brief,cta&order=content_date.desc&limit=6`
  );
  return {
    recentItems: rows,
    recentHooks: rows.map((row) => row.hook).filter(Boolean),
    recentHookArchetypes: rows.map((row) => row.hook_archetype).filter(Boolean),
    recentTopics: rows.map((row) => row.topic).filter(Boolean),
    recentPillars: rows.map((row) => row.content_pillar).filter(Boolean)
  };
}

function hasReadyMedia(item: SocialContentItem) {
  return item.media_generation_status === "generated" && item.media_asset_urls.length > 0;
}

async function generateAndGateOneItem(params: { strategy: SocialStrategy | null; brand: SocialBrandProfile; settings: SocialAutopilotSettings; contentDate: string; dayIndex: number; allowedContentTypes?: ContentType[]; mediaModeOverride?: SocialAutopilotSettings["media_mode_default"] }) {
  if (!params.strategy) return null;
  const allowRuntimeAi = params.settings.ai_operating_mode === "optional_api_ai";
  const context = await recentContext();
  const blacklist = await supabaseRest(`social_cliche_blacklist?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&active=eq.true&select=*`);
  const watchlist = await loadPrivacyWatchlist();
  const effectiveMediaMode = params.mediaModeOverride || params.settings.media_mode_default;

  let item: SocialContentItem;

  if (allowRuntimeAi) {
    const brief = planDailyContentBrief({ strategy: params.strategy, dayIndex: params.dayIndex, recentPillars: context.recentPillars, recentHookArchetypes: context.recentHookArchetypes, recentTopics: context.recentTopics, allowedContentTypes: params.allowedContentTypes });
    const generated = await generateContentItem({
      strategy: params.strategy, brand: params.brand, contentDate: params.contentDate, brief,
      recentHooksToAvoid: context.recentHooks, recentTopicsToAvoid: context.recentTopics,
      aiPreference: params.settings.ai_provider_preference, mediaModeDefault: effectiveMediaMode, allowRuntimeAi: true
    });
    item = generated.item;

    let attempt = 1;
    let gateResult = await runQualityGate({ item, brand: params.brand, blacklist: blacklist as never, watchlist, recentItems: context.recentItems, attempt, aiPreference: params.settings.ai_provider_preference, allowRuntimeAi: true });

    while (!gateResult.passed && attempt <= (params.settings.max_quality_retries || MAX_QUALITY_AUTO_REVISIONS)) {
      attempt += 1;
      const regenerated = await generateContentItem({
        strategy: params.strategy, brand: params.brand, contentDate: params.contentDate, brief,
        recentHooksToAvoid: [...context.recentHooks, item.hook], recentTopicsToAvoid: context.recentTopics,
        aiPreference: params.settings.ai_provider_preference, mediaModeDefault: effectiveMediaMode, allowRuntimeAi: true
      });
      await supabaseRest(`social_content_items?id=eq.${encodeURIComponent(item.id)}`, { method: "DELETE" }).catch(() => {});
      item = regenerated.item;
      gateResult = await runQualityGate({ item, brand: params.brand, blacklist: blacklist as never, watchlist, recentItems: context.recentItems, attempt, aiPreference: params.settings.ai_provider_preference, allowRuntimeAi: true });
    }

    return finalizeGatedItem(item, gateResult, attempt, params);
  }

  // CLAUDE_CODE_ASSISTED / NO_RUNTIME_AI — never call generateContentItem
  // (which requires AI). Only ever advance an item Claude Code already
  // authored and that was imported (strategy-package.ts) for exactly this
  // date; if none exists, this is a normal "no supply for today" no-op, not
  // an error — the calendar simply has a gap until the next import.
  const importedRows = await supabaseRest<SocialContentItem[]>(`social_content_items?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&content_date=eq.${params.contentDate}&media_generation_status=eq.pending&select=*&limit=1`);
  if (!importedRows[0]) return null;
  let imported = importedRows[0];

  const resolvedMediaMode = determineMediaMode(effectiveMediaMode, imported.content_type);
  if (resolvedMediaMode !== imported.media_mode) {
    await supabaseRest(`social_content_items?id=eq.${encodeURIComponent(imported.id)}`, { method: "PATCH", body: JSON.stringify({ media_mode: resolvedMediaMode }) });
    imported = { ...imported, media_mode: resolvedMediaMode };
  }
  item = await runMediaAndPersist(imported, params.brand.brand_name);

  // Imported items get exactly one quality-gate pass — there is no AI
  // "regenerate and try again" available in this mode. A failure here means
  // a human either edits the item in İçerik Stüdyosu or fixes/re-imports
  // the source package; it is never silently retried with fabricated copy.
  const gateResult = await runQualityGate({ item, brand: params.brand, blacklist: blacklist as never, watchlist, recentItems: context.recentItems, attempt: 1, aiPreference: params.settings.ai_provider_preference, allowRuntimeAi: false });
  return finalizeGatedItem(item, gateResult, 1, params);
}

async function finalizeGatedItem(item: SocialContentItem, gateResult: Awaited<ReturnType<typeof runQualityGate>>, attempt: number, params: { settings: SocialAutopilotSettings }) {

  await supabaseRest("social_quality_checks", { method: "POST", body: JSON.stringify({ content_item_id: item.id, overall_score: gateResult.overall_score, checks: gateResult.checks, passed: gateResult.passed, attempt: gateResult.attempt }) });

  const threshold = params.settings.min_quality_score || DEFAULT_QUALITY_THRESHOLD;
  const passedThreshold = gateResult.passed && gateResult.overall_score >= threshold;
  // A media failure (needs_media, set by content-generator.ts's call into
  // runMediaStage for strict AUTO mode) takes precedence over content
  // quality status — the item cannot become "ready" without a final media
  // asset regardless of how good the copy is.
  const mediaBlocked = item.publication_status === "needs_media";
  const nextStatus = mediaBlocked ? "needs_media" : passedThreshold ? "ready" : "needs_review";

  await supabaseRest(`social_content_items?id=eq.${encodeURIComponent(item.id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      publication_status: nextStatus, quality_score: gateResult.overall_score,
      brand_fit_score: gateResult.checks.brand_fit?.score ?? null,
      factuality_score: gateResult.checks.factuality_and_unsupported_claims?.score ?? null,
      originality_score: gateResult.checks.duplicate?.score ?? null, duplicate_score: gateResult.checks.duplicate?.score ?? null,
      privacy_check_passed: gateResult.checks.privacy?.passed ?? false,
      failure_reason: mediaBlocked ? item.media_generation_error : passedThreshold ? null : `Kalite eşiği karşılanmadı (${gateResult.overall_score}/${threshold}) — ${attempt} denemeden sonra.`
    })
  });

  if (mediaBlocked && params.settings.notify_on_failure) {
    await notifySocialAutopilot(`AUTO MEDIA bu içerik için final dosya üretemedi, NEEDS_MEDIA durumuna alındı: "${item.title || item.topic}" — ${item.media_generation_error || ""}`);
  } else if (!passedThreshold && params.settings.notify_on_failure) {
    await notifySocialAutopilot(`İçerik kalite eşiğini karşılamadı ve incelemeye alındı (skor ${gateResult.overall_score}/${threshold}): "${item.title || item.topic}".`);
  }

  const finalItem = { ...item, publication_status: nextStatus } as SocialContentItem;
  return { item: finalItem, gateResult, passedThreshold: passedThreshold && !mediaBlocked };
}

export async function generateContentForDate(contentDate: string) {
  const settings = await getSettings();
  const brand = await getBrand();
  const strategy = await getActiveStrategy();
  if (!strategy) throw new Error("Aktif strateji yok — önce 30 Günlük Strateji sekmesinden bir strateji oluşturun.");
  const periodStartMs = new Date(`${strategy.period_start}T00:00:00Z`).getTime();
  const dayIndex = Math.max(0, Math.floor((new Date(`${contentDate}T00:00:00Z`).getTime() - periodStartMs) / (24 * 60 * 60_000)));
  return generateAndGateOneItem({ strategy, brand, settings, contentDate, dayIndex });
}

/** Regenerates BOTH copy and media in place (same content_items id, so
 * scheduling/queue references stay valid). Guarded by
 * social_autopilot_settings.media_regeneration_limit (cost control) — once
 * an item has been regenerated that many times, this refuses rather than
 * looping forever on a topic that keeps failing quality/media gates; the
 * caller should switch it to MANUAL MEDIA instead. */
export async function regenerateContentItem(id: string) {
  const settings = await getSettings();
  if (settings.ai_operating_mode !== "optional_api_ai") {
    throw new Error("AI ile yeniden üretim yalnızca OPTIONAL_API_AI modunda kullanılabilir. Bu içeriği İçerik Stüdyosu'ndan elle düzenleyin veya Claude Code Paketi'nden yeni bir strateji/içerik paketi içe aktarın.");
  }
  const brand = await getBrand();
  const existing = (await supabaseRest<SocialContentItem[]>(`social_content_items?id=eq.${encodeURIComponent(id)}&select=*&limit=1`))[0];
  if (!existing) throw new Error("İçerik bulunamadı.");
  if (existing.media_regeneration_count >= settings.media_regeneration_limit) {
    throw new Error(`Bu içerik için medya yeniden üretim limiti (${settings.media_regeneration_limit}) doldu — MANUAL MEDIA'ya geçip elle görsel/video yükleyin.`);
  }
  const strategy = existing.strategy_id
    ? (await supabaseRest<SocialStrategy[]>(`social_strategies?id=eq.${encodeURIComponent(existing.strategy_id)}&select=*&limit=1`))[0]
    : await getActiveStrategy();
  if (!strategy) throw new Error("Bu içeriğe ait strateji bulunamadı.");

  const context = await recentContext();
  const brief = { funnelStage: existing.funnel_stage, contentPillar: existing.content_pillar, hookArchetype: existing.hook_archetype || "direct_insight", ctaGoal: existing.cta_goal || "save", contentType: existing.content_type, topic: existing.topic };
  const { item: freshItem } = await generateContentItem({
    strategy, brand, contentDate: existing.content_date, brief,
    recentHooksToAvoid: [...context.recentHooks, existing.hook], recentTopicsToAvoid: context.recentTopics,
    aiPreference: settings.ai_provider_preference, mediaModeDefault: existing.media_mode === "manual" ? "manual" : settings.media_mode_default,
    allowRuntimeAi: true
  });

  await supabaseRest("social_content_versions", { method: "POST", body: JSON.stringify({ content_item_id: id, version: existing.version, snapshot: existing, edit_note: "AI yeniden üretimi" }) });
  await supabaseRest(`social_content_items?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      title: freshItem.title, hook: freshItem.hook, secondary_hook: freshItem.secondary_hook, caption: freshItem.caption,
      cta: freshItem.cta, hashtags: freshItem.hashtags, seo_keywords: freshItem.seo_keywords, creative_brief: freshItem.creative_brief,
      media_mode: freshItem.media_mode, media_asset_urls: freshItem.media_asset_urls, media_generation_status: freshItem.media_generation_status,
      media_generation_provider: freshItem.media_generation_provider, media_generation_error: freshItem.media_generation_error,
      media_template_used: freshItem.media_template_used, media_regeneration_count: existing.media_regeneration_count + 1,
      visual_quality_score: freshItem.visual_quality_score, brand_consistency_score: freshItem.brand_consistency_score,
      readability_score: freshItem.readability_score, composition_score: freshItem.composition_score,
      content_visual_match_score: freshItem.content_visual_match_score, platform_compatibility_score: freshItem.platform_compatibility_score,
      media_quality_score: freshItem.media_quality_score,
      generation_status: "generated", publication_status: freshItem.publication_status === "needs_media" ? "needs_media" : "generated",
      quality_score: null, brand_fit_score: null, factuality_score: null, originality_score: null, duplicate_score: null, privacy_check_passed: false,
      version: existing.version + 1, ai_provider: freshItem.ai_provider, ai_model: freshItem.ai_model, prompt_version: freshItem.prompt_version
    })
  });
  await supabaseRest(`social_media_assets?content_item_id=eq.${encodeURIComponent(freshItem.id)}`, { method: "PATCH", body: JSON.stringify({ content_item_id: id }) }).catch(() => {});
  await supabaseRest(`social_content_items?id=eq.${encodeURIComponent(freshItem.id)}`, { method: "DELETE" }).catch(() => {});

  const updated = (await supabaseRest<SocialContentItem[]>(`social_content_items?id=eq.${encodeURIComponent(id)}&select=*&limit=1`))[0];
  if (updated.publication_status === "needs_media") {
    return { item: updated, gateResult: null, passedThreshold: false };
  }

  const blacklist = await supabaseRest(`social_cliche_blacklist?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&active=eq.true&select=*`);
  const watchlist = await loadPrivacyWatchlist();
  const gateResult = await runQualityGate({ item: updated, brand, blacklist: blacklist as never, watchlist, recentItems: context.recentItems, attempt: 1, aiPreference: settings.ai_provider_preference, allowRuntimeAi: true });

  await supabaseRest("social_quality_checks", { method: "POST", body: JSON.stringify({ content_item_id: id, overall_score: gateResult.overall_score, checks: gateResult.checks, passed: gateResult.passed, attempt: gateResult.attempt }) });
  const threshold = settings.min_quality_score || DEFAULT_QUALITY_THRESHOLD;
  const passedThreshold = gateResult.passed && gateResult.overall_score >= threshold;
  const finalRows = await supabaseRest<SocialContentItem[]>(`social_content_items?id=eq.${encodeURIComponent(id)}&select=*`, {
    method: "PATCH",
    body: JSON.stringify({ publication_status: passedThreshold ? "ready" : "needs_review", quality_score: gateResult.overall_score, brand_fit_score: gateResult.checks.brand_fit?.score ?? null, privacy_check_passed: gateResult.checks.privacy?.passed ?? false })
  });

  return { item: finalRows[0], gateResult, passedThreshold };
}

export async function runDailyCycle(triggeredBy: "cron" | "manual" | "worker") {
  const summary: Record<string, unknown> = {};
  const settings = await getSettings();

  if (settings.emergency_pause) return { ok: true, summary: { skipped: true, reason: "emergency_pause" } };

  const brand = await getBrand();
  const refresh = await refreshStrategyIfDue(brand, settings.ai_operating_mode, settings.ai_provider_preference);
  summary.strategyRefreshed = refresh.refreshed;
  if (refresh.reason) summary.strategyRefreshSkippedReason = refresh.reason;
  const strategy = await getActiveStrategy();

  const allowRuntimeAi = settings.ai_operating_mode === "optional_api_ai";
  const generated: Array<{ id: string; status: string; score: number }> = [];
  if (strategy && settings.control_mode !== "manual") {
    const periodStartMs = new Date(`${strategy.period_start}T00:00:00Z`).getTime();
    // Cost control: once this many AUTO/AUTO_WITH_FALLBACK media generations
    // have happened today, further items this run default to MANUAL MEDIA
    // instead of consuming another automated render — the copy/strategy
    // pipeline keeps running either way, only the media stage is throttled.
    const todayStart = new Date().toISOString().slice(0, 10);
    const todayGenerations = await supabaseRest<Array<{ id: string }>>(
      `social_content_items?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&content_date=eq.${todayStart}&media_generation_status=eq.generated&media_mode=neq.manual&select=id`
    );
    let mediaGenerationsUsedToday = todayGenerations.length;

    for (let offset = 0; offset < LOOKAHEAD_DAYS; offset += 1) {
      const contentDate = new Date(Date.now() + offset * 24 * 60 * 60_000).toISOString().slice(0, 10);
      const dayIndex = Math.floor((new Date(`${contentDate}T00:00:00Z`).getTime() - periodStartMs) / (24 * 60 * 60_000));

      // AI mode: skip a date that already has anything (AI already ran, or
      // a human created something manually). CLAUDE_CODE_ASSISTED/NO_RUNTIME_AI:
      // never generate anything new here — only proceed if an imported item
      // for this date is still sitting unprocessed (media_generation_status
      // "pending"); a date with no import, or one already fully handled,
      // is correctly left alone.
      const existingForDate = await supabaseRest<Array<{ id: string; media_generation_status: string }>>(
        `social_content_items?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&content_date=eq.${contentDate}&select=id,media_generation_status`
      );
      if (allowRuntimeAi) {
        if (existingForDate.length) continue;
      } else if (!existingForDate.some((row) => row.media_generation_status === "pending")) {
        continue;
      }

      const weekCount = await countThisWeek(contentDate);
      if (allowRuntimeAi && weekCount >= settings.posting_frequency_per_week) continue;

      // FULL AUTO only ever plans a format social_autopilot_settings.
      // full_auto_supported_formats lists — never generates a Reel it
      // already knows it can't finish end-to-end. APPROVAL/MANUAL modes stay
      // unrestricted since a human handles media there regardless of format.
      const allowedContentTypes = settings.control_mode === "full_auto" ? settings.full_auto_supported_formats : undefined;
      const capReached = mediaGenerationsUsedToday >= settings.media_daily_generation_cap;
      const mediaModeOverride = capReached ? ("manual" as const) : undefined;

      const result = await generateAndGateOneItem({ strategy, brand, settings, contentDate, dayIndex: Math.max(0, dayIndex), allowedContentTypes, mediaModeOverride });
      if (!result) continue;
      generated.push({ id: result.item.id, status: result.item.publication_status, score: result.gateResult?.overall_score ?? 0 });
      if (result.item.media_generation_status === "generated" && result.item.media_mode !== "manual") mediaGenerationsUsedToday += 1;

      // full_auto only auto-schedules once real media exists — either
      // AUTO MEDIA actually produced it, or a human had already attached it
      // to a previously "ready" item before this re-run.
      if (result.passedThreshold && settings.control_mode === "full_auto" && hasReadyMedia(result.item)) {
        const recommendation = await recommendPublishTime({ contentDate, contentType: result.item.content_type, contentPillar: result.item.content_pillar, dayIndex });
        if (recommendation.scheduledAt) await enqueueContentItem(result.item.id, recommendation.scheduledAt);
      }
    }
  }
  summary.contentGenerated = generated;

  const analyticsResult = await syncContentAnalytics().catch((error) => ({ error: error instanceof Error ? error.message : "analytics sync failed" }));
  summary.analytics = analyticsResult;
  const accountSnapshot = await syncAccountSnapshot().catch((error) => ({ ok: false, error: error instanceof Error ? error.message : "account snapshot failed" }));
  summary.accountSnapshot = accountSnapshot;

  const lastLearningRun = await supabaseRest<Array<{ started_at: string }>>(
    `social_autopilot_runs?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&run_type=eq.learning_update&status=eq.success&select=started_at&order=started_at.desc&limit=1`
  );
  const daysSinceLearning = lastLearningRun[0] ? (Date.now() - new Date(lastLearningRun[0].started_at).getTime()) / (24 * 60 * 60_000) : Infinity;
  if (daysSinceLearning >= 7) {
    // generateLearnings is deterministic/statistical by default (see
    // learning-engine.ts) — allowRuntimeAi only controls an OPTIONAL prose
    // enhancement pass on top, never whether learning happens at all.
    const learningResult = await generateLearnings(strategy?.id || null, allowRuntimeAi, settings.ai_provider_preference).catch((error) => ({ error: error instanceof Error ? error.message : "learning update failed" }));
    summary.learningUpdate = learningResult;
  }

  const connection = await getInstagramConnectionStatus();
  summary.instagramConnection = { status: connection.status, tokenHealth: connection.tokenHealth };
  if (settings.notify_on_disconnect && (connection.status === "disconnected" || connection.status === "token_expired" || connection.tokenHealth === "expired")) {
    await notifySocialAutopilot(`Instagram bağlantısı sorunlu (${connection.status}, token: ${connection.tokenHealth}) — Entegrasyonlar sayfasından yeniden bağlayın.`, { critical: true });
  }

  if (!allowRuntimeAi) {
    const strategySupply = await computeStrategySupplyStatus().catch(() => null);
    if (strategySupply) {
      summary.strategySupply = strategySupply;
      if (strategySupply.warning) await notifySocialAutopilot("Claude Code ile yeni 30 günlük strateji oluşturma zamanı yaklaşıyor.");
    }
  }

  return { ok: true, summary, triggeredBy };
}
