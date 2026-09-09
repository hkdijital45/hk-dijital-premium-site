// Daily orchestration (spec section 22). Ties the engine together: ensure
// strategy exists/refresh if due, generate today's + near-term missing
// content within the weekly frequency and daily cap, run the quality gate
// (auto-revise up to the configured retry limit), and — only once a human
// has attached real media (see storage.ts for why) — auto-schedule ready
// items when control_mode is full_auto. Publishing itself and analytics/
// learning updates are separate cron-able steps (publish-queue.ts,
// analytics-sync.ts, learning-engine.ts) called from here but designed to
// also run standalone on their own schedule.
import { supabaseRest } from "@/lib/supabase";
import { planDailyContentBrief, generateContentItem } from "./content-generator";
import { runQualityGate } from "./quality-gate";
import { loadPrivacyWatchlist } from "./privacy-filter";
import { getActiveStrategy } from "./strategy-engine";
import { refreshStrategyIfDue } from "./monthly-refresh";
import { recommendPublishTime } from "./posting-time-engine";
import { enqueueContentItem } from "./publish-queue";
import { syncContentAnalytics, syncAccountSnapshot } from "./analytics-sync";
import { generateLearnings } from "./learning-engine";
import { getInstagramConnectionStatus } from "./instagram-oauth";
import { notifySocialAutopilot } from "./notify";
import { DEFAULT_QUALITY_THRESHOLD, MAX_QUALITY_AUTO_REVISIONS, SOCIAL_WORKSPACE_ID } from "./constants";
import type { SocialAutopilotSettings, SocialBrandProfile, SocialContentItem, SocialStrategy } from "./types";

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
  const day = date.getUTCDay() || 7; // Monday=1..Sunday=7
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

async function generateAndGateOneItem(params: { strategy: Awaited<ReturnType<typeof getActiveStrategy>>; brand: SocialBrandProfile; settings: SocialAutopilotSettings; contentDate: string; dayIndex: number }) {
  if (!params.strategy) return null;
  const context = await recentContext();
  const blacklist = await supabaseRest(`social_cliche_blacklist?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&active=eq.true&select=*`);
  const watchlist = await loadPrivacyWatchlist();

  const brief = planDailyContentBrief({
    strategy: params.strategy, dayIndex: params.dayIndex,
    recentPillars: context.recentPillars, recentHookArchetypes: context.recentHookArchetypes, recentTopics: context.recentTopics
  });

  let { item } = await generateContentItem({
    strategy: params.strategy, brand: params.brand, contentDate: params.contentDate, brief,
    recentHooksToAvoid: context.recentHooks, recentTopicsToAvoid: context.recentTopics, aiPreference: params.settings.ai_provider_preference
  });

  let attempt = 1;
  let gateResult = await runQualityGate({ item, brand: params.brand, blacklist: blacklist as never, watchlist, recentItems: context.recentItems, attempt, aiPreference: params.settings.ai_provider_preference });

  while (!gateResult.passed && attempt <= (params.settings.max_quality_retries || MAX_QUALITY_AUTO_REVISIONS)) {
    attempt += 1;
    // Regenerate against the same brief — the writer prompt already avoids
    // the recent-hooks/topics list, and the quality-check notes are visible
    // in the checks record for a human reviewer even if auto-revision exhausts.
    const regenerated = await generateContentItem({
      strategy: params.strategy, brand: params.brand, contentDate: params.contentDate, brief,
      recentHooksToAvoid: [...context.recentHooks, item.hook], recentTopicsToAvoid: context.recentTopics, aiPreference: params.settings.ai_provider_preference
    });
    await supabaseRest(`social_content_items?id=eq.${encodeURIComponent(item.id)}`, { method: "DELETE" }).catch(() => {});
    item = regenerated.item;
    gateResult = await runQualityGate({ item, brand: params.brand, blacklist: blacklist as never, watchlist, recentItems: context.recentItems, attempt, aiPreference: params.settings.ai_provider_preference });
  }

  await supabaseRest("social_quality_checks", {
    method: "POST",
    body: JSON.stringify({ content_item_id: item.id, overall_score: gateResult.overall_score, checks: gateResult.checks, passed: gateResult.passed, attempt: gateResult.attempt })
  });

  const threshold = params.settings.min_quality_score || DEFAULT_QUALITY_THRESHOLD;
  const passedThreshold = gateResult.passed && gateResult.overall_score >= threshold;
  const nextStatus = passedThreshold ? "ready" : "needs_review";

  await supabaseRest(`social_content_items?id=eq.${encodeURIComponent(item.id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      publication_status: nextStatus,
      quality_score: gateResult.overall_score,
      brand_fit_score: gateResult.checks.brand_fit?.score ?? null,
      factuality_score: gateResult.checks.factuality_and_unsupported_claims?.score ?? null,
      originality_score: gateResult.checks.duplicate?.score ?? null,
      duplicate_score: gateResult.checks.duplicate?.score ?? null,
      privacy_check_passed: gateResult.checks.privacy?.passed ?? false,
      failure_reason: passedThreshold ? null : `Kalite eşiği karşılanmadı (${gateResult.overall_score}/${threshold}) — ${attempt} denemeden sonra.`
    })
  });

  if (!passedThreshold && params.settings.notify_on_quality_gate_repeat_failure) {
    await notifySocialAutopilot(`İçerik kalite eşiğini karşılamadı ve incelemeye alındı (skor ${gateResult.overall_score}/${threshold}): "${item.title || item.topic}".`);
  }

  return { item, gateResult, passedThreshold };
}

/** Manual "Bu Tarih İçin İçerik Üret" trigger from the Content Studio /
 * Calendar UI — same generate+quality-gate pipeline the daily cycle uses,
 * for one explicit date regardless of the weekly-frequency budget (an
 * editor explicitly asking for a draft should get one). */
export async function generateContentForDate(contentDate: string) {
  const settings = await getSettings();
  const brand = await getBrand();
  const strategy = await getActiveStrategy();
  if (!strategy) throw new Error("Aktif strateji yok — önce 30 Günlük Strateji sekmesinden bir strateji oluşturun.");
  const periodStartMs = new Date(`${strategy.period_start}T00:00:00Z`).getTime();
  const dayIndex = Math.max(0, Math.floor((new Date(`${contentDate}T00:00:00Z`).getTime() - periodStartMs) / (24 * 60 * 60_000)));
  return generateAndGateOneItem({ strategy, brand, settings, contentDate, dayIndex });
}

/** Manual "Yeniden Üret" — regenerates the creative for an existing content
 * item in place (same id, same calendar slot/funnel stage/pillar), so
 * scheduling/queue references stay valid. Snapshots the previous state to
 * social_content_versions first (spec section 44). Re-runs the quality gate
 * on the new draft immediately, same as the daily pipeline. */
export async function regenerateContentItem(id: string) {
  const settings = await getSettings();
  const brand = await getBrand();
  const existing = (await supabaseRest<SocialContentItem[]>(`social_content_items?id=eq.${encodeURIComponent(id)}&select=*&limit=1`))[0];
  if (!existing) throw new Error("İçerik bulunamadı.");
  const strategy = existing.strategy_id
    ? (await supabaseRest<SocialStrategy[]>(`social_strategies?id=eq.${encodeURIComponent(existing.strategy_id)}&select=*&limit=1`))[0]
    : await getActiveStrategy();
  if (!strategy) throw new Error("Bu içeriğe ait strateji bulunamadı.");

  const context = await recentContext();
  const brief = {
    funnelStage: existing.funnel_stage, contentPillar: existing.content_pillar,
    hookArchetype: existing.hook_archetype || "direct_insight", ctaGoal: existing.cta_goal || "save",
    contentType: existing.content_type, topic: existing.topic
  };
  const { item: freshItem } = await generateContentItem({
    strategy, brand, contentDate: existing.content_date, brief,
    recentHooksToAvoid: [...context.recentHooks, existing.hook], recentTopicsToAvoid: context.recentTopics, aiPreference: settings.ai_provider_preference
  });

  await supabaseRest("social_content_versions", {
    method: "POST", body: JSON.stringify({ content_item_id: id, version: existing.version, snapshot: existing, edit_note: "AI yeniden üretimi" })
  });
  await supabaseRest(`social_content_items?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      title: freshItem.title, hook: freshItem.hook, secondary_hook: freshItem.secondary_hook, caption: freshItem.caption,
      cta: freshItem.cta, hashtags: freshItem.hashtags, seo_keywords: freshItem.seo_keywords, creative_brief: freshItem.creative_brief,
      generation_status: "generated", publication_status: "generated", quality_score: null, brand_fit_score: null,
      factuality_score: null, originality_score: null, duplicate_score: null, privacy_check_passed: false,
      version: existing.version + 1, ai_provider: freshItem.ai_provider, ai_model: freshItem.ai_model, prompt_version: freshItem.prompt_version
    })
  });
  await supabaseRest(`social_content_items?id=eq.${encodeURIComponent(freshItem.id)}`, { method: "DELETE" }).catch(() => {});

  const updated = (await supabaseRest<SocialContentItem[]>(`social_content_items?id=eq.${encodeURIComponent(id)}&select=*&limit=1`))[0];
  const blacklist = await supabaseRest(`social_cliche_blacklist?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&active=eq.true&select=*`);
  const watchlist = await loadPrivacyWatchlist();
  const gateResult = await runQualityGate({ item: updated, brand, blacklist: blacklist as never, watchlist, recentItems: context.recentItems, attempt: 1, aiPreference: settings.ai_provider_preference });

  await supabaseRest("social_quality_checks", {
    method: "POST", body: JSON.stringify({ content_item_id: id, overall_score: gateResult.overall_score, checks: gateResult.checks, passed: gateResult.passed, attempt: gateResult.attempt })
  });
  const threshold = settings.min_quality_score || DEFAULT_QUALITY_THRESHOLD;
  const passedThreshold = gateResult.passed && gateResult.overall_score >= threshold;
  const finalRows = await supabaseRest<SocialContentItem[]>(`social_content_items?id=eq.${encodeURIComponent(id)}&select=*`, {
    method: "PATCH",
    body: JSON.stringify({
      publication_status: passedThreshold ? "ready" : "needs_review", quality_score: gateResult.overall_score,
      brand_fit_score: gateResult.checks.brand_fit?.score ?? null, privacy_check_passed: gateResult.checks.privacy?.passed ?? false
    })
  });

  return { item: finalRows[0], gateResult, passedThreshold };
}

export async function runDailyCycle(triggeredBy: "cron" | "manual") {
  const summary: Record<string, unknown> = {};
  const settings = await getSettings();

  if (settings.emergency_pause) {
    return { ok: true, summary: { skipped: true, reason: "emergency_pause" } };
  }

  const brand = await getBrand();
  const refresh = await refreshStrategyIfDue(brand, settings.ai_provider_preference);
  summary.strategyRefreshed = refresh.refreshed;
  const strategy = await getActiveStrategy();

  const generated: Array<{ id: string; status: string; score: number }> = [];
  if (strategy && settings.control_mode !== "manual") {
    const periodStartMs = new Date(`${strategy.period_start}T00:00:00Z`).getTime();
    for (let offset = 0; offset < LOOKAHEAD_DAYS; offset += 1) {
      const contentDate = new Date(Date.now() + offset * 24 * 60 * 60_000).toISOString().slice(0, 10);
      const dayIndex = Math.floor((new Date(`${contentDate}T00:00:00Z`).getTime() - periodStartMs) / (24 * 60 * 60_000));

      const existing = await supabaseRest<Array<{ id: string }>>(`social_content_items?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&content_date=eq.${contentDate}&select=id`);
      if (existing.length) continue;

      const weekCount = await countThisWeek(contentDate);
      if (weekCount >= settings.posting_frequency_per_week) continue;

      const result = await generateAndGateOneItem({ strategy, brand, settings, contentDate, dayIndex: Math.max(0, dayIndex) });
      if (!result) continue;
      generated.push({ id: result.item.id, status: result.passedThreshold ? "ready" : "needs_review", score: result.gateResult.overall_score });

      // full_auto only auto-schedules once real media exists (see storage.ts
      // boundary) — most freshly generated items won't have media yet, so
      // this mainly covers re-runs after a human has already attached media
      // to a previously "ready" item.
      if (result.passedThreshold && settings.control_mode === "full_auto" && result.item.media_asset_urls?.length) {
        const recommendation = await recommendPublishTime({ contentDate, contentType: result.item.content_type, contentPillar: result.item.content_pillar, dayIndex });
        await enqueueContentItem(result.item.id, recommendation.scheduledAt);
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
    const learningResult = await generateLearnings(strategy?.id || null).catch((error) => ({ error: error instanceof Error ? error.message : "learning update failed" }));
    summary.learningUpdate = learningResult;
  }

  const connection = await getInstagramConnectionStatus();
  summary.instagramConnection = { status: connection.status, tokenHealth: connection.tokenHealth };
  if (settings.notify_on_disconnect && (connection.status === "disconnected" || connection.status === "token_expired" || connection.tokenHealth === "expired")) {
    await notifySocialAutopilot(`Instagram bağlantısı sorunlu (${connection.status}, token: ${connection.tokenHealth}) — HK Social Autopilot > Entegrasyonlar'dan yeniden bağlayın.`, { critical: true });
  }

  return { ok: true, summary, triggeredBy };
}
