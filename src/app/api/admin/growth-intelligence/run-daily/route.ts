import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { safeCompare } from "@/lib/secure-compare";
import { syncSearchConsoleOpportunities } from "@/lib/growth-intelligence/sync";
import { submitUrlsToIndexNow, getIndexNowStatus } from "@/lib/growth-intelligence/indexnow";
import { finishRun, startRun } from "@/lib/growth-intelligence/run-logger";
import { normalizeContentPlanItem } from "@/lib/blog-content-ops";
import { DEFAULT_WORKSPACE_ID, type GrowthOpportunity, type GrowthSettings } from "@/lib/growth-intelligence/types";
import { SITE_URL } from "@/lib/metadata";

const INBOX_PLAN_NAME = "HK Growth Intelligence Fırsatları";

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function cronAuthorized(request: Request) {
  return safeCompare(bearerToken(request), process.env.CRON_SECRET);
}

async function authorizeManualOrCron(request: Request): Promise<"cron" | "manual" | null> {
  if (cronAuthorized(request)) return "cron";
  const session = await requireModuleAccess("growth-intelligence");
  return session ? "manual" : null;
}

async function ensureSettings(): Promise<GrowthSettings> {
  const rows = await supabaseRest<GrowthSettings[]>(`growth_settings?workspace_id=eq.${DEFAULT_WORKSPACE_ID}&select=*&limit=1`);
  if (rows.length) return rows[0];
  const created = await supabaseRest<GrowthSettings[]>("growth_settings", { method: "POST", body: JSON.stringify({ workspace_id: DEFAULT_WORKSPACE_ID }) });
  return created[0];
}

async function ensureInboxPlan(): Promise<string> {
  const existing = await supabaseRest<Array<{ id: string }>>(`content_plans?name=eq.${encodeURIComponent(INBOX_PLAN_NAME)}&select=id&limit=1`);
  if (existing.length) return existing[0].id;
  const created = await supabaseRest<Array<{ id: string }>>("content_plans", {
    method: "POST",
    body: JSON.stringify({
      name: INBOX_PLAN_NAME, status: "active", service: "", region: "Türkiye", audience: "",
      objective: "Search Console fırsatlarından otomatik türetilen içerik fikirleri.",
      weekly_count: 3, preferred_days: [], preferred_time: "10:00",
      auto_generate_drafts: false, auto_publish: false, require_approval: true
    })
  });
  return created[0].id;
}

// Queues the top-scoring, still-open opportunities as real content_plan_items
// for a human to draft/review/publish in Blog & SEO Merkezi. Deliberately
// does NOT auto-generate AI drafts or auto-publish — see "Remaining
// Limitations" in the delivery report for why that boundary is intentional.
async function queueTopOpportunities(settings: GrowthSettings) {
  const opportunities = await supabaseRest<GrowthOpportunity[]>(
    `growth_opportunities?workspace_id=eq.${DEFAULT_WORKSPACE_ID}&status=eq.new&opportunity_score=gte.${settings.min_opportunity_score}&select=*&order=opportunity_score.desc&limit=5`
  );
  if (!opportunities.length) return { queued: 0 };

  const planId = await ensureInboxPlan();
  const existingItems = await supabaseRest<Array<{ slug: string }>>(`content_plan_items?plan_id=eq.${planId}&select=slug`);
  const existingSlugs = existingItems.map((row) => row.slug);
  let queued = 0;

  for (const opportunity of opportunities) {
    try {
      const item = normalizeContentPlanItem(
        {
          title: opportunity.query,
          primary_keyword: opportunity.query,
          search_intent: "Yerel arama",
          content_type: opportunity.opportunity_type === "service_page" ? "Hizmet açıklaması" : "Blog yazısı",
          rationale: `${opportunity.recommended_action} (Opportunity Score: ${opportunity.opportunity_score}/100)`,
          source_signals: ["Search Console"]
        },
        existingSlugs
      );
      existingSlugs.push(item.slug);
      const inserted = await supabaseRest<Array<{ id: string }>>("content_plan_items", { method: "POST", body: JSON.stringify({ ...item, plan_id: planId }) });
      await supabaseRest(`growth_opportunities?id=eq.${encodeURIComponent(opportunity.id!)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "converted", related_content_plan_item_id: inserted[0].id })
      });
      queued += 1;
    } catch {
      // One bad opportunity shouldn't stop the rest of the daily cycle.
    }
  }
  return { queued };
}

async function publishDuePosts() {
  const now = new Date().toISOString();
  const rows = await supabaseRest<Array<{ id: string; slug?: string }>>(
    `blog_posts?status=eq.scheduled&approved_for_publish=eq.true&scheduled_at=lte.${encodeURIComponent(now)}&select=id,slug&limit=25`
  );
  const publishedSlugs: string[] = [];
  for (const post of rows) {
    const updated = await supabaseRest<Array<{ id: string; slug: string }>>(
      `blog_posts?id=eq.${encodeURIComponent(post.id)}&status=eq.scheduled&approved_for_publish=eq.true&select=id,slug`,
      { method: "PATCH", body: JSON.stringify({ status: "published", published_at: now, updated_at: now }) }
    );
    if (updated.length) publishedSlugs.push(updated[0].slug);
  }
  return { checked: rows.length, publishedSlugs };
}

async function runDailyCycle(triggeredBy: "cron" | "manual") {
  const runId = await startRun("full_cycle", triggeredBy).catch(() => null);
  const summary: Record<string, unknown> = {};
  try {
    const settings = await ensureSettings();

    const syncResult = await syncSearchConsoleOpportunities();
    summary.sync = syncResult;

    if (settings.automation_mode !== "manual" && syncResult.ok) {
      summary.queue = await queueTopOpportunities(settings);
    }

    const publishResult = await publishDuePosts();
    summary.publish = publishResult;

    if (publishResult.publishedSlugs.length) {
      if (settings.sitemap_ping_enabled) {
        const pingUrl = `https://www.google.com/ping?sitemap=${encodeURIComponent(`${SITE_URL}/sitemap.xml`)}`;
        const pingResponse = await fetch(pingUrl).catch(() => null);
        summary.sitemapPing = { ok: Boolean(pingResponse?.ok), status: pingResponse?.status };
      }
      if (settings.indexnow_enabled && getIndexNowStatus().ready) {
        const siteHost = new URL(SITE_URL).host;
        const urls = publishResult.publishedSlugs.map((slug) => `${SITE_URL}/blog/${slug}`);
        summary.indexnow = await submitUrlsToIndexNow(urls, siteHost);
      }
    }

    const affected = (syncResult.ok ? syncResult.upserted : 0) + publishResult.publishedSlugs.length;
    if (runId) await finishRun(runId, syncResult.ok ? "success" : "partial", summary, affected, syncResult.ok ? undefined : syncResult.message);
    return { ok: true, summary };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Beklenmeyen hata";
    if (runId) await finishRun(runId, "failed", summary, 0, detail);
    return { ok: false, error: detail };
  }
}

export async function POST(request: Request) {
  const mode = await authorizeManualOrCron(request);
  if (!mode) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });
  try {
    return NextResponse.json(await runDailyCycle(mode));
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

export async function GET(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });
  try {
    return NextResponse.json(await runDailyCycle("cron"));
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
