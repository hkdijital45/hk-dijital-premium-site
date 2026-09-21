import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";
import { analyzeBlogPost, calculateBlogMetrics, slugifyBlogValue } from "@/lib/blog-seo-shared";
import { analyzeGeo, analyzeSeo } from "@/lib/organic-growth/seo-geo-engine";
import { parseArticleImport } from "@/lib/organic-growth/claude-prompts";
import { getContentPlanItem, updateContentPlanItem } from "@/lib/organic-growth/data";

// Imports a Claude-written article (pasted structured JSON) into blog_posts
// as a DRAFT, linked back to its content_plan_item. Never publishes
// directly — publishing/scheduling remains a separate, explicit human step
// via the existing blog-posts PATCH route.
export async function POST(request: Request) {
  const session = await requireModuleAccess("blog-seo");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const raw = typeof body.raw === "string" ? body.raw : "";
  const contentPlanItemId = typeof body.content_plan_item_id === "string" ? body.content_plan_item_id.trim() : "";
  if (!raw) return NextResponse.json({ error: "Claude çıktısı (raw JSON) gerekli." }, { status: 400 });

  const parsed = parseArticleImport(raw);
  if (!parsed.valid) return NextResponse.json({ error: parsed.errors.join(" ") }, { status: 400 });
  const article = parsed.article;

  try {
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

    return NextResponse.json({ post, flaggedClaims: article.flagged_claims || [] });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
