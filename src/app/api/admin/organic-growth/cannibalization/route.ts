import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";
import { detectCannibalization } from "@/lib/organic-growth/cannibalization";
import { listContentPlanItems } from "@/lib/organic-growth/data";

type PostRow = { id: string; title: string; slug: string; primary_keyword: string; search_intent: string };

export async function GET() {
  const session = await requireModuleAccess("blog-seo");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  try {
    const [posts, planItems] = await Promise.all([
      supabaseRest<PostRow[]>("blog_posts?select=id,title,slug,primary_keyword,search_intent&status=neq.archived&limit=300"),
      listContentPlanItems()
    ]);
    const candidates = [
      ...posts.map((p) => ({ id: p.id, title: p.title, slug: p.slug, primaryTopic: p.primary_keyword, searchIntent: p.search_intent, targetService: "", topicClusterId: null })),
      ...planItems.filter((i) => !i.blog_post_id).map((i) => ({ id: i.id, title: i.working_title, slug: i.id, primaryTopic: i.primary_topic, searchIntent: i.search_intent, targetService: i.target_service, topicClusterId: i.topic_cluster_id }))
    ];
    const conflicts = detectCannibalization(candidates);
    return NextResponse.json({ conflicts });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
