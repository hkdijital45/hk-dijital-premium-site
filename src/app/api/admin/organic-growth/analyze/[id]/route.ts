import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";
import { analyzeGeo, analyzeSeo } from "@/lib/organic-growth/seo-geo-engine";

type Params = { params: Promise<{ id: string }> };
type PostRow = {
  id: string; title: string; slug: string; excerpt: string; content: string;
  meta_title: string; meta_description: string; primary_keyword: string; search_intent: string;
  cover_image_alt: string | null; allow_indexing: boolean; canonical_url: string | null;
  published_at: string | null; updated_at: string | null; author_name: string | null;
};

// Deterministic SEO/GEO re-analysis for an already-saved article — no LLM
// call. Persists geo_score/geo_factors/seo_factors directly onto
// blog_posts (bypassing the full-form blog-posts PATCH route, which
// requires resubmitting the whole article body).
export async function POST(_request: Request, { params }: Params) {
  const session = await requireModuleAccess("blog-seo");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Geçersiz yazı ID" }, { status: 400 });
  try {
    const rows = await supabaseRest<PostRow[]>(`blog_posts?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
    const post = rows[0];
    if (!post) return NextResponse.json({ error: "Yazı bulunamadı." }, { status: 404 });

    const input = {
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      content: post.content,
      metaTitle: post.meta_title,
      metaDescription: post.meta_description,
      primaryTopic: post.primary_keyword,
      searchIntent: post.search_intent,
      coverImageAlt: post.cover_image_alt,
      allowIndexing: post.allow_indexing,
      canonicalUrl: post.canonical_url,
      publishedAt: post.published_at,
      updatedAt: post.updated_at,
      authorName: post.author_name
    };
    const seo = analyzeSeo(input);
    const geo = analyzeGeo(input);

    const updated = await supabaseRest<PostRow[]>(`blog_posts?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        seo_score: seo.score,
        seo_factors: seo.factors,
        geo_score: geo.score,
        geo_factors: geo.factors,
        last_reviewed_at: new Date().toISOString()
      })
    });

    return NextResponse.json({ seo, geo, post: updated[0] || null });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
