import { fetchSearchConsolePerformance } from "@/lib/google-search-console-server";
import { supabaseRest } from "@/lib/supabase";
import { executeAiTask } from "@/lib/server/ai-router";
import { normalizeContentPlanItem } from "@/lib/blog-content-ops";

const AUTOPILOT_PLAN_NAME = "HK SEO Autopilot";
const MIN_IMPRESSIONS_SAMPLE = 50;

type GscRow = { query: string; page: string; clicks: number; impressions: number; ctr: number; position: number };

function isoDate(daysAgo: number) {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);
}

function keyOf(row: GscRow) {
  return `${row.query}::${row.page}`;
}

async function safeFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    return await supabaseRest<T>(path);
  } catch {
    return fallback;
  }
}

async function ensureAutopilotPlan(): Promise<string> {
  const existing = await safeFetch<Array<{ id: string }>>(`content_plans?name=eq.${encodeURIComponent(AUTOPILOT_PLAN_NAME)}&select=id&limit=1`, []);
  if (existing.length) return existing[0].id;
  const created = await supabaseRest<Array<{ id: string }>>("content_plans", {
    method: "POST",
    body: JSON.stringify({
      name: AUTOPILOT_PLAN_NAME, status: "active", service: "", region: "Türkiye", audience: "",
      objective: "Search Console'da gerileme tespit edilen mevcut içeriklerin güncellenmesi.",
      weekly_count: 3, preferred_days: [], preferred_time: "10:00",
      auto_generate_drafts: false, auto_publish: false, require_approval: true
    })
  });
  return created[0].id;
}

function slugFromUrl(url: string) {
  try {
    const path = new URL(url).pathname;
    const match = path.match(/\/blog\/([^/]+)\/?$/);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

export async function detectSeoDecay(triggeredBy: "cron" | "manual" = "manual") {
  const [current, previous] = await Promise.all([
    fetchSearchConsolePerformance({ startDate: isoDate(28), endDate: isoDate(1), dimensions: ["query", "page"] }),
    fetchSearchConsolePerformance({ startDate: isoDate(56), endDate: isoDate(29), dimensions: ["query", "page"] })
  ]);

  if (!current.ok || !previous.ok) {
    return { ok: false, message: !current.ok ? current.message : previous.message, jobsCreated: 0 };
  }

  const previousByKey = new Map<string, GscRow>();
  for (const row of previous.rows as GscRow[]) previousByKey.set(keyOf(row), row);

  const posts = await safeFetch<Array<{ id: string; slug: string; title: string }>>("blog_posts?status=eq.published&select=id,slug,title&limit=500", []);
  const postBySlug = new Map(posts.map((post) => [post.slug, post]));

  let jobsCreated = 0;
  const planId = await ensureAutopilotPlan();
  const existingItems = await safeFetch<Array<{ slug: string }>>(`content_plan_items?plan_id=eq.${planId}&select=slug`, []);
  const existingSlugs = existingItems.map((row) => row.slug);

  for (const row of current.rows as GscRow[]) {
    const before = previousByKey.get(keyOf(row));
    if (!before || before.impressions < MIN_IMPRESSIONS_SAMPLE) continue;

    const positionWorsened = row.position - before.position >= 3;
    const impressionDrop = before.impressions > 0 && (before.impressions - row.impressions) / before.impressions >= 0.3;
    const ctrDrop = Math.abs(row.position - before.position) < 2 && before.ctr > 0 && row.ctr < before.ctr * 0.7;

    let triggerType: "position_decline" | "impression_decline" | "ctr_decline" | null = null;
    if (positionWorsened) triggerType = "position_decline";
    else if (impressionDrop) triggerType = "impression_decline";
    else if (ctrDrop) triggerType = "ctr_decline";
    if (!triggerType) continue;

    const existingJob = await safeFetch<Array<{ id: string }>>(
      `seo_autopilot_jobs?query=eq.${encodeURIComponent(row.query)}&url=eq.${encodeURIComponent(row.page)}&status=neq.published&status=neq.rejected&select=id&limit=1`,
      []
    );
    if (existingJob.length) continue;

    const slug = slugFromUrl(row.page);
    const post = slug ? postBySlug.get(slug) : undefined;

    const ai = await executeAiTask({
      taskType: "seo_analysis",
      module: "SEO Autopilot",
      endpoint: "/api/admin/seo-autopilot/run-daily",
      prompt: `"${row.query}" sorgusunda "${row.page}" sayfası gerilemiş: pozisyon ${before.position.toFixed(1)} → ${row.position.toFixed(1)}, gösterim ${before.impressions} → ${row.impressions}, CTR ${(before.ctr * 100).toFixed(1)}% → ${(row.ctr * 100).toFixed(1)}%. Bu sayfayı güçlendirmek için 3-5 maddelik kısa bir içerik güncelleme brief'i yaz (başlık/meta iyileştirme, eklenecek bölüm, iç link, SSS önerisi).`,
      expectedOutput: "3-5 maddelik güncelleme brief'i",
      fallbackText: "Başlık ve meta açıklamayı güncelleyin, güncel örnek/istatistik ekleyin, ilgili hizmet sayfasına iç link ekleyin, kısa bir SSS bölümü ekleyin.",
      createdBy: null
    }, { cacheTtlMs: 0 }).catch(() => null);

    let contentPlanItemId: string | null = null;
    if (post) {
      try {
        const item = normalizeContentPlanItem(
          {
            title: `Güncelle: ${post.title}`,
            slug: post.slug,
            primary_keyword: row.query,
            search_intent: "Yerel arama",
            content_type: "Blog yazısı güncelleme",
            rationale: `SEO Autopilot: ${triggerType} tespit edildi (${row.query}).`,
            source_signals: ["Search Console"]
          },
          existingSlugs
        );
        existingSlugs.push(item.slug);
        const inserted = await supabaseRest<Array<{ id: string }>>("content_plan_items", { method: "POST", body: JSON.stringify({ ...item, plan_id: planId, blog_post_id: post.id }) });
        contentPlanItemId = inserted[0].id;
      } catch {
        // Non-fatal — the job row itself still records the detected decay even without a linked plan item.
      }
    }

    await supabaseRest("seo_autopilot_jobs", {
      method: "POST",
      body: JSON.stringify({
        blog_post_id: post?.id || null,
        query: row.query,
        url: row.page,
        trigger_type: triggerType,
        position_before: before.position,
        position_after: row.position,
        impressions_before: before.impressions,
        impressions_after: row.impressions,
        clicks_before: before.clicks,
        clicks_after: row.clicks,
        content_plan_item_id: contentPlanItemId,
        ai_brief: ai?.text || null,
        status: ai?.text ? "draft_ready" : "detected"
      })
    });
    jobsCreated += 1;
  }

  return { ok: true, triggeredBy, currentRows: (current.rows as GscRow[]).length, jobsCreated };
}
