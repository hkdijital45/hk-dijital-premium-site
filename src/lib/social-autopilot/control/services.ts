import { randomUUID } from "node:crypto";
import { supabaseRest } from "@/lib/supabase";
import { validatePackageShape } from "./import-validation";
import { loadPrivacyWatchlist, scanForPrivacyLeaks } from "../privacy-filter";
import { getUsableInstagramToken, getInstagramConnectionStatus } from "../instagram-oauth";
import { fetchInstagramProfile, getAccountInsights, getMediaInsights, getRecentInstagramMedia } from "../instagram-graph-client";
import { syncContentAnalytics, syncAccountSnapshot } from "../analytics-sync";
import { computeReadinessReport } from "../readiness";
import { enqueueContentItem, cancelQueueItem, processDueQueue } from "../publish-queue";
import { applyStrategyPackage, validateStrategyPackage } from "../strategy-package";
import { generateLearnings } from "../learning-engine";
import { runDailyCycle } from "../orchestrator";
import { recommendPublishTime } from "../posting-time-engine";
import { summarizePerformance, type ObservedItem } from "../performance-summary";
import { publicationAllowed } from "../publication-safety";
import { computeContentScore } from "../scoring-engine";
import { ControlError } from "./protocol";
import { getItem, getSettings, prepareContent, renderContent, validateContent } from "./content";
import { SOCIAL_WORKSPACE_ID } from "../types";
import type { SocialContentItem, MetricSnapshot } from "../types";

async function analysis(days = 30) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const rows = await supabaseRest<ObservedItem[]>(
    `social_content_items?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&publication_status=eq.published&published_at=gte.${encodeURIComponent(since)}&select=*,metric_snapshots:social_metric_snapshots(*)&limit=1000`
  );
  return { days, ...summarizePerformance(rows), truncated: rows.length === 1000 };
}

export async function schedule(id: string, at: string, reschedule = false) {
  if (Date.parse(at) <= Date.now()) throw new ControlError("INVALID_TIME", "Scheduling requires a future timestamp.");
  const [item, settings] = await Promise.all([getItem(id), getSettings()]);
  if (item.publication_status !== (reschedule ? "scheduled" : "ready") || !item.privacy_check_passed || (item.quality_score ?? 0) < settings.min_quality_score || (item.media_quality_score ?? 0) < settings.min_media_quality_score || item.media_generation_status !== "generated" || !item.media_asset_urls?.length) {
    throw new ControlError("NOT_READY", "Content and media quality gates must pass before scheduling.", 409);
  }
  // ASSISTED explicitly permits scheduling. HK Admin's existing cron will
  // publish at this timestamp if its own safety/settings gates allow it —
  // scheduled publishing never depends on this MCP connector being connected.
  return enqueueContentItem(id, new Date(at).toISOString());
}

export async function execute(name: string, args: Record<string, unknown>): Promise<unknown> {
  const id = args.id as string;
  const limit = Number(args.limit || 20);
  switch (name) {
    case "health": {
      const report = await computeReadinessReport();
      return { overall: report.overall, checks: report.checks.map(({ key, status }) => ({ key, status })), fullAutoCapableFormats: report.fullAutoCapableFormats };
    }
    case "autopilot_get_readiness": {
      const report = await computeReadinessReport();
      return { ...report, checks: report.checks.map(({ key, label, status }) => ({ key, label, status })) };
    }
    case "autopilot_get_status": {
      const s = await getSettings();
      return { active: s.autopilot_active, control_mode: s.control_mode, test_mode: s.test_mode, emergency_pause: s.emergency_pause, publishing_enabled: publicationAllowed(s), ai_operating_mode: s.ai_operating_mode };
    }
    case "instagram_get_connection_status": return getInstagramConnectionStatus();
    case "instagram_get_profile": { const t = await getUsableInstagramToken(); return fetchInstagramProfile(t.accessToken, t.igUserId); }
    case "instagram_get_account_insights": { const t = await getUsableInstagramToken(); return getAccountInsights(t.accessToken, t.igUserId, ["reach", "follower_count", "accounts_engaged"], "day"); }
    case "instagram_get_post_insights": {
      const item = await getItem(id);
      if (!item.external_media_id) throw new ControlError("NOT_PUBLISHED", "No Instagram media id.", 409);
      const t = await getUsableInstagramToken();
      return getMediaInsights(t.accessToken, item.external_media_id, ["reach", "saved", "likes", "comments", "shares"]);
    }
    case "instagram_get_recent_posts": { const t = await getUsableInstagramToken(); const result = await getRecentInstagramMedia(t.accessToken, t.igUserId, limit); return { source: "instagram", posts: result.data }; }
    case "instagram_analyze_last_7_days": return analysis(7);
    case "instagram_analyze_last_30_days": return analysis(30);
    case "instagram_analyze_last_90_days": return analysis(90);
    case "instagram_synthesize_performance": return analysis(90);
    case "instagram_get_best_content": return (await analysis(90)).best_content.slice(0, limit);
    case "instagram_get_weak_content": return (await analysis(90)).weak_content.slice(0, limit);
    case "instagram_get_growth_summary": {
      const rows = await supabaseRest<MetricSnapshot[]>(`social_metric_snapshots?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&snapshot_scope=eq.account&select=follower_count,captured_at&order=captured_at.desc&limit=90`);
      const valid = rows.filter((r) => r.follower_count !== null);
      return { sample_size: valid.length, latest: valid[0] || null, earliest: valid.at(-1) || null, change: valid.length > 1 ? valid[0].follower_count! - valid.at(-1)!.follower_count! : null, scope: "available account snapshots; missing measurements excluded" };
    }
    case "instagram_get_best_posting_times": {
      const item = await getItem(id);
      return recommendPublishTime({ contentDate: args.date as string, contentType: item.content_type, contentPillar: item.content_pillar, objective: item.objective, dayIndex: 0 });
    }
    case "content_get_strategy": return supabaseRest(`social_strategies?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&status=eq.active&select=*&limit=1`);
    case "content_get_today": {
      const s = await getSettings();
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: s.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      return supabaseRest(`social_content_items?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&content_date=eq.${today}&select=*&limit=100`);
    }
    case "content_get_calendar":
      if (String(args.start) > String(args.end)) throw new ControlError("INVALID_RANGE", "Start must precede end.");
      return supabaseRest(`social_content_items?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&content_date=gte.${args.start}&content_date=lte.${args.end}&select=*&order=content_date.asc&limit=100`);
    case "content_preview": { const item = await getItem(id); return { id: item.id, caption: item.caption, creative_brief: item.creative_brief, media_asset_urls: item.media_asset_urls, status: item.publication_status }; }
    case "content_generate_carousel": return prepareContent(args.content, "carousel");
    case "content_generate_static": return prepareContent(args.content, "static");
    case "content_prepare_reel": return prepareContent(args.content, "reel");
    case "strategy_import": {
      validatePackageShape(args.package);
      if (scanForPrivacyLeaks(JSON.stringify(args.package), await loadPrivacyWatchlist()).length) throw new ControlError("PRIVACY_BLOCKED", "Package contains protected private information.");
      const result = validateStrategyPackage(args.package);
      if (!result.valid) throw new ControlError("INVALID_PACKAGE", "Strategy package validation failed. Use schema_version 1.0 and complete strategy/content items.");
      return applyStrategyPackage(result.package, null);
    }
    case "content_render": return renderContent(id);
    case "content_validate": return validateContent(id);
    case "instagram_get_publish_queue": return supabaseRest(`social_publish_queue?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&select=*&order=scheduled_at.asc&limit=100`);
    case "instagram_schedule_post": return schedule(id, args.scheduled_at as string);
    case "instagram_reschedule_post": return schedule(id, args.scheduled_at as string, true);
    case "instagram_cancel_scheduled_post": await cancelQueueItem(id); return { cancelled: true };
    case "instagram_publish_now": {
      const settings = await getSettings();
      if (!publicationAllowed(settings)) throw new ControlError("PUBLISH_DISABLED", "Production publication checks did not pass.", 403);
      const item = await getItem(id);
      if (item.publication_status !== "ready") throw new ControlError("NOT_READY", "Content must be ready.", 409);
      await enqueueContentItem(id, new Date().toISOString());
      return { summary: await processDueQueue(`mcp-${randomUUID()}`, id), item: await getItem(id) };
    }
    case "instagram_get_learnings": return supabaseRest(`social_ai_learnings?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&select=*&order=generated_at.desc&limit=${limit}`);
    case "instagram_refresh_posting_time_model": return generateLearnings(null, false);
    case "instagram_refresh_analytics": return { content: await syncContentAnalytics(), account: await syncAccountSnapshot() };
    case "instagram_refresh_scores": {
      const rows = await supabaseRest<Array<SocialContentItem & { metric_snapshots: MetricSnapshot[] }>>(
        `social_content_items?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&publication_status=eq.published&select=*,metric_snapshots:social_metric_snapshots(*)&limit=1000`
      );
      let updated = 0;
      for (const item of rows) {
        for (const snapshot of item.metric_snapshots || []) {
          await supabaseRest(`social_metric_snapshots?id=eq.${encodeURIComponent(snapshot.id)}`, { method: "PATCH", body: JSON.stringify({ performance_score: computeContentScore(snapshot, item.cta_goal) }) });
          updated++;
        }
      }
      return { updated, truncated: rows.length === 1000 };
    }
    case "autopilot_pause":
      await supabaseRest(`social_autopilot_settings?workspace_id=eq.${SOCIAL_WORKSPACE_ID}`, { method: "PATCH", body: JSON.stringify({ emergency_pause: true, emergency_pause_reason: "Claude MCP control", emergency_paused_at: new Date().toISOString() }) });
      return { paused: true };
    case "autopilot_resume": {
      const s = await getSettings();
      if (s.test_mode) throw new ControlError("TEST_MODE", "Resume is disabled in test mode.", 403);
      const readiness = await computeReadinessReport();
      if (readiness.overall !== "READY") throw new ControlError("NOT_READY", "Resolve readiness checks before resuming.", 409);
      await supabaseRest(`social_autopilot_settings?workspace_id=eq.${SOCIAL_WORKSPACE_ID}`, { method: "PATCH", body: JSON.stringify({ emergency_pause: false, emergency_pause_reason: null, emergency_paused_at: null, autopilot_active: true }) });
      return { resumed: true };
    }
    case "autopilot_run_daily_cycle": {
      const settings = await getSettings();
      if (!publicationAllowed(settings)) throw new ControlError("PUBLISH_DISABLED", "Daily cycle requires production permission.", 403);
      if (settings.ai_operating_mode === "optional_api_ai") throw new ControlError("RUNTIME_AI_DISABLED", "Select no_runtime_ai or claude_code_assisted mode for MCP-triggered daily cycles; HK Admin's own cron runs the AI-authored cycle.", 409);
      return runDailyCycle("manual");
    }
    default: throw new ControlError("UNKNOWN_TOOL", "Unknown tool.", 404);
  }
}
