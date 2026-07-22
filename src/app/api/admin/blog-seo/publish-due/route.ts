import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { safeCompare } from "@/lib/secure-compare";

type BlogPostRow = {
  id: string;
  title?: string;
  status?: string;
  scheduled_at?: string | null;
  published_at?: string | null;
  approved_for_publish?: boolean | null;
};

type PublishResult = {
  checked: number;
  published: number;
  skipped: number;
  failed: number;
};

function matchesSecret(value: string | null, secret: string | undefined) {
  return safeCompare(value, secret);
}

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function cronAuthorized(request: Request) {
  const url = new URL(request.url);
  const bearer = bearerToken(request);
  const headerSecret = request.headers.get("x-blog-seo-cron-secret");
  const legacyQuerySecret = url.searchParams.get("secret");

  if (matchesSecret(bearer, process.env.CRON_SECRET)) return true;
  if (matchesSecret(headerSecret, process.env.BLOG_SEO_CRON_SECRET)) return true;

  // Legacy fallback only. Prefer Authorization: Bearer $CRON_SECRET in production.
  if (matchesSecret(legacyQuerySecret, process.env.BLOG_SEO_CRON_SECRET)) return true;
  if (matchesSecret(legacyQuerySecret, process.env.CRON_SECRET)) return true;

  return false;
}

async function authorizeManualOrCron(request: Request) {
  if (cronAuthorized(request)) return true;
  const session = await requireModuleAccess("blog-seo");
  return Boolean(session);
}

async function publishDuePosts(): Promise<PublishResult> {
  const now = new Date().toISOString();
  const rows = await supabaseRest<BlogPostRow[]>(
    `blog_posts?status=eq.scheduled&approved_for_publish=eq.true&scheduled_at=lte.${encodeURIComponent(now)}&select=id,title,status,scheduled_at,published_at,approved_for_publish&limit=25`
  );

  const result: PublishResult = {
    checked: rows.length,
    published: 0,
    skipped: 0,
    failed: 0
  };

  for (const post of rows) {
    try {
      const publishedAt = post.published_at || now;
      const updated = await supabaseRest<BlogPostRow[]>(
        `blog_posts?id=eq.${encodeURIComponent(post.id)}&status=eq.scheduled&approved_for_publish=eq.true&scheduled_at=lte.${encodeURIComponent(now)}&select=id,status,published_at`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: "published", published_at: publishedAt, updated_at: now })
        }
      );

      if (updated.length) {
        result.published += 1;
        console.info("[blog-seo-cron] published scheduled post", { postId: post.id });
      } else {
        result.skipped += 1;
        console.info("[blog-seo-cron] skipped scheduled post after conditional update", { postId: post.id });
      }
    } catch (error) {
      result.failed += 1;
      console.error("[blog-seo-cron] failed to publish scheduled post", {
        postId: post.id,
        error: getSafeSupabaseError(error).title
      });
    }
  }

  return result;
}

export async function POST(request: Request) {
  if (!(await authorizeManualOrCron(request))) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 503 });
  try {
    return NextResponse.json({ ok: true, ...(await publishDuePosts()) });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

export async function GET(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 503 });
  try {
    return NextResponse.json({ ok: true, ...(await publishDuePosts()) });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
