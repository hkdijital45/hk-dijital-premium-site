import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";
import { listContentPlanItems } from "@/lib/organic-growth/data";
import { findOrphanArticles, suggestInternalLinks } from "@/lib/organic-growth/internal-links";
import { CONTENT_PLAN_STATUSES, type ContentPlanStatus } from "@/lib/organic-growth/types";

type PostRow = { id: string; title: string; slug: string; primary_keyword: string; seo_score: number; geo_score: number; update_required: boolean; status: string };

export async function GET() {
  const session = await requireModuleAccess("blog-seo");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  try {
    const [items, posts] = await Promise.all([
      listContentPlanItems(),
      supabaseRest<PostRow[]>("blog_posts?select=id,title,slug,primary_keyword,seo_score,geo_score,update_required,status&order=updated_at.desc&limit=300")
    ]);

    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-31`;
    const thisMonthItems = items.filter((i) => i.planned_publication_date && i.planned_publication_date >= monthStart && i.planned_publication_date <= monthEnd);

    const byStatus: Record<ContentPlanStatus, number> = Object.fromEntries(CONTENT_PLAN_STATUSES.map((s) => [s, 0])) as Record<ContentPlanStatus, number>;
    for (const item of items) byStatus[item.status] = (byStatus[item.status] || 0) + 1;

    const publishedPosts = posts.filter((p) => p.status === "published");
    const seoIssues = publishedPosts.filter((p) => p.seo_score > 0 && p.seo_score < 70).length;
    const geoIssues = publishedPosts.filter((p) => p.geo_score > 0 && p.geo_score < 70).length;
    const updateRequired = publishedPosts.filter((p) => p.update_required).length;

    const articles = publishedPosts.map((p) => ({ id: p.id, title: p.title, slug: p.slug, primaryTopic: p.primary_keyword, topicClusterId: null }));
    const suggestions = suggestInternalLinks(articles, []);
    const orphans = findOrphanArticles(articles, suggestions);

    return NextResponse.json({
      thisMonthPlanned: thisMonthItems.length,
      statusCounts: byStatus,
      publishedTotal: publishedPosts.length,
      seoIssues,
      geoIssues,
      updateRequired,
      orphanCount: orphans.length,
      internalLinkOpportunities: suggestions.length
    });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
