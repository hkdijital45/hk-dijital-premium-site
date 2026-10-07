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

export async function insertArticleAsDraft(article: ImportedArticle, contentPlanItemId?: string) {
  const slug = slugifyBlogValue(article.slug || article.title);
  const existingSlug = await supabaseRest<Array<{ id: string }>>(`blog_posts?slug=eq.${encodeURIComponent(slug)}&select=id&limit=1`);
  const finalSlug = existingSlug.length ? `${slug}-${Date.now().toString(36)}` : slug;

  const metrics = calculateBlogMetrics(article.content);
  const base = {
    title: article.title,
    slug: finalSlug,
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

  const rows = await supabaseRest<Array<{ id: string }>>("blog_posts", {
    method: "POST",
    body: JSON.stringify({ ...base, ...metrics, ...scores, geo_score: geo.score, geo_factors: geo.factors, seo_factors: seo.factors, created_by: null })
  });
  const post = rows[0];

  if (contentPlanItemId) {
    const item = await getContentPlanItem(contentPlanItemId);
    if (item) await updateContentPlanItem(contentPlanItemId, { blog_post_id: post.id, status: "DRAFT" });
  }

  return { post, seo, geo, wordCount: metrics.word_count as number };
}
