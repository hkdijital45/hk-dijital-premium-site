import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

type BlogPostRow = {
  id: string;
  title?: string;
  status?: string;
  scheduled_at?: string | null;
  approved_for_publish?: boolean | null;
};

function cronAuthorized(request: Request) {
  const secret = request.headers.get("x-blog-seo-cron-secret") || new URL(request.url).searchParams.get("secret");
  if (process.env.NODE_ENV === "production" && !process.env.BLOG_SEO_CRON_SECRET) return false;
  return Boolean(process.env.BLOG_SEO_CRON_SECRET && secret === process.env.BLOG_SEO_CRON_SECRET);
}

export async function POST(request: Request) {
  const session = await requireModuleAccess("blog-seo");
  if (!session && !cronAuthorized(request)) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 503 });
  try {
    const now = new Date().toISOString();
    const rows = await supabaseRest<BlogPostRow[]>(`blog_posts?status=eq.scheduled&approved_for_publish=eq.true&scheduled_at=lte.${encodeURIComponent(now)}&select=id,title,status,scheduled_at,approved_for_publish&limit=10`);
    const results = [];
    for (const post of rows) {
      const updated = await supabaseRest<BlogPostRow[]>(`blog_posts?id=eq.${encodeURIComponent(post.id)}&status=eq.scheduled`, {
        method: "PATCH",
        body: JSON.stringify({ status: "published", published_at: now, updated_at: now })
      }).catch((error) => {
        results.push({ id: post.id, title: post.title, status: "error", error: getSafeSupabaseError(error).detail });
        return [];
      });
      if (updated.length) results.push({ id: post.id, title: post.title, status: "published" });
    }
    return NextResponse.json({ ok: true, processed: results.length, results });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
