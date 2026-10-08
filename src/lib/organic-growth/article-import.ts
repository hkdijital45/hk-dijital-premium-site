// Shared "insert a generated article as a blog_posts DRAFT" logic — the
// exact same code path used by:
//  1) the manual Claude-copy-paste import route (import-article/route.ts)
//  2) the automated autopilot (autopilot.ts)
// so a human-pasted article and an autopilot-generated article are
// validated and scored identically. Extracted rather than duplicated.
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";
import { analyzeBlogPost, calculateBlogMetrics, slugifyBlogValue } from "@/lib/blog-seo-shared";
import { analyzeGeo, analyzeSeo } from "@/lib/organic-growth/seo-geo-engine";
import type { ImportedArticle } from "@/lib/organic-growth/claude-prompts";
import { getContentPlanItem, updateContentPlanItem } from "@/lib/organic-growth/data";

export { getSafeSupabaseError };

function isUniqueViolation(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return message.includes("(409)") || message.includes("23505") || message.toLowerCase().includes("duplicate key");
}

function buildDraftFields(article: ImportedArticle, slug: string) {
  const metrics = calculateBlogMetrics(article.content);
  const base = {
    title: article.title,
    slug,
    excerpt: (article.excerpt || "").slice(0, 500),
    content: article.content,
    content_format: "markdown" as const,
    status: "draft" as const,
    author_name: "HK Dijital",
    primary_keyword: article.primary_keyword || "",
    secondary_keywords: article.secondary_keywords || [],
    search_intent: article.search_intent || "",
    target_location: article.target_location || null,
    meta_title: (article.meta_title || article.title).slice(0, 80),
    meta_description: (article.meta_description || article.excerpt || "").slice(0, 220),
    allow_indexing: true,
    featured: false
  };
  const scores = analyzeBlogPost(base);
  const qualityInput = { ...base, metaTitle: base.meta_title, metaDescription: base.meta_description, primaryTopic: base.primary_keyword, coverImageAlt: null, allowIndexing: true, updatedAt: new Date().toISOString(), authorName: base.author_name };
  const seo = analyzeSeo(qualityInput);
  const geo = analyzeGeo(qualityInput);
  return {
    fields: { ...base, ...metrics, geo_score: geo.score, geo_factors: geo.factors, seo_factors: seo.factors, ...scores },
    seo,
    geo,
    wordCount: metrics.word_count as number
  };
}

async function findUniqueSlug(preferredSlug: string) {
  const existing = await supabaseRest<Array<{ id: string }>>(`blog_posts?slug=eq.${encodeURIComponent(preferredSlug)}&select=id&limit=1`);
  return existing.length ? `${preferredSlug}-${Date.now().toString(36)}` : preferredSlug;
}

async function insertNewDraft(article: ImportedArticle, contentPlanItemId: string | undefined) {
  const baseSlug = slugifyBlogValue(article.slug || article.title);

  // A truly concurrent double-submit can still race past the SELECT-then-INSERT
  // check below (two requests both see "slug free", both try to insert it).
  // Instead of surfacing a raw Postgres "duplicate key" error to the editor,
  // retry once with a freshly suffixed slug — the write itself is still a
  // normal single INSERT, just self-healing against that one narrow window.
  let slug = await findUniqueSlug(baseSlug);
  let built = buildDraftFields(article, slug);
  let rows: Array<{ id: string }>;
  try {
    rows = await supabaseRest<Array<{ id: string }>>("blog_posts", {
      method: "POST",
      body: JSON.stringify({ ...built.fields, created_by: null })
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    slug = `${baseSlug}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    built = buildDraftFields(article, slug);
    rows = await supabaseRest<Array<{ id: string }>>("blog_posts", {
      method: "POST",
      body: JSON.stringify({ ...built.fields, created_by: null })
    });
  }
  const { seo, geo, wordCount } = built;
  const post = rows[0];

  if (contentPlanItemId) {
    try {
      await updateContentPlanItem(contentPlanItemId, { blog_post_id: post.id, status: "DRAFT" });
    } catch (linkError) {
      // PostgREST has no cross-table transaction here: the blog_posts insert
      // above already committed. Rather than leave a draft that exists but
      // isn't linked (requirement: no partial writes / no inconsistent
      // state), undo the insert we just made in this same request — this is
      // not "deleting an existing article," it's unwinding a write this
      // call itself made a moment ago — and surface the real failure.
      await supabaseRest(`blog_posts?id=eq.${encodeURIComponent(post.id)}`, { method: "DELETE" }).catch(() => {});
      throw linkError;
    }
  }

  return { post, seo, geo, wordCount };
}

async function updateExistingDraft(existingPostId: string, existingSlug: string, article: ImportedArticle, contentPlanItemId: string) {
  // Reuse the already-linked draft in place instead of inserting a new
  // blog_posts row: same id, same slug/URL (never sent in the PATCH body,
  // so it can't drift) — only content/metadata/scores are refreshed.
  // Re-importing the same (or a revised) Claude output for the same
  // content-plan item can never create a second article this way.
  const { fields, seo, geo, wordCount } = buildDraftFields(article, existingSlug);
  const { slug: _existingSlug, ...fieldsWithoutSlug } = fields;
  const rows = await supabaseRest<Array<{ id: string }>>(`blog_posts?id=eq.${encodeURIComponent(existingPostId)}&select=id`, {
    method: "PATCH",
    body: JSON.stringify(fieldsWithoutSlug)
  });
  const post = rows[0];
  await updateContentPlanItem(contentPlanItemId, { status: "DRAFT" });
  return { post, seo, geo, wordCount };
}

export async function insertArticleAsDraft(article: ImportedArticle, contentPlanItemId?: string) {
  if (contentPlanItemId) {
    const item = await getContentPlanItem(contentPlanItemId);
    if (!item) throw new Error(`İçerik planı öğesi bulunamadı (id: ${contentPlanItemId}). Sayfayı yenileyip tekrar deneyin.`);

    if (item.blog_post_id) {
      const existingRows = await supabaseRest<Array<{ id: string; status: string; slug: string }>>(
        `blog_posts?id=eq.${encodeURIComponent(item.blog_post_id)}&select=id,status,slug&limit=1`
      );
      const existingPost = existingRows[0];
      if (existingPost) {
        if (existingPost.status !== "draft") {
          throw new Error(
            `Bu planlı içerik zaten "${existingPost.status}" durumunda yayınlanmış/zamanlanmış bir makaleye bağlı. ` +
              "Mevcut bir makalenin üzerine otomatik yazılmaz — önce ilgili makaleyi Yazılar sekmesinden inceleyin."
          );
        }
        // Existing draft linked to this same content-plan item: safe to reuse/update.
        return updateExistingDraft(existingPost.id, existingPost.slug, article, contentPlanItemId);
      }
      // blog_post_id points at a row that no longer exists (deleted elsewhere) —
      // fall through and create a fresh draft; this also self-heals a
      // content-plan item left at status DRAFT by a previous failed import
      // that never actually created a blog_posts row.
    }
  }

  return insertNewDraft(article, contentPlanItemId);
}
