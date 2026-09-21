import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";
import { findOrphanArticles, suggestInternalLinks } from "@/lib/organic-growth/internal-links";
import { TARGET_SERVICES } from "@/lib/organic-growth/types";

type PostRow = { id: string; title: string; slug: string; primary_keyword: string };

export async function GET() {
  const session = await requireModuleAccess("blog-seo");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  try {
    const posts = await supabaseRest<PostRow[]>("blog_posts?select=id,title,slug,primary_keyword&status=eq.published&order=title.asc&limit=200");
    const articles = posts.map((p) => ({ id: p.id, title: p.title, slug: p.slug, primaryTopic: p.primary_keyword, topicClusterId: null }));
    const services = TARGET_SERVICES.map((s) => ({ slug: s.slug, label: s.label }));
    const suggestions = suggestInternalLinks(articles, services);
    const orphans = findOrphanArticles(articles, suggestions);
    return NextResponse.json({ suggestions, orphans, totalPublished: articles.length });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
