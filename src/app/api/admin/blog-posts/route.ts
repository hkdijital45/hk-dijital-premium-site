import { NextResponse } from "next/server";
import { getSession, isStaffRole } from "@/lib/auth";
import { analyzeBlogPost, seedBlogPosts, slugifyBlogValue, type BlogStatus } from "@/lib/blog-seo-shared";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

const statuses: BlogStatus[] = ["draft", "review", "scheduled", "published", "archived"];
type BlogPostRow = Record<string, unknown> & { blog_categories?: unknown };

async function requireStaff() {
  const session = await getSession();
  return session && isStaffRole(session.role) ? session : null;
}

function text(value: unknown, fallback = "") {
  return String(value || fallback).trim();
}

function normalizePayload(input: Record<string, unknown>, userId?: string) {
  const title = text(input.title);
  const content = text(input.content);
  const slug = slugifyBlogValue(text(input.slug, title));
  const status = statuses.includes(input.status as BlogStatus) ? input.status as BlogStatus : "draft";
  const secondary = Array.isArray(input.secondary_keywords) ? input.secondary_keywords.map(String).map((item) => item.trim()).filter(Boolean) : text(input.secondary_keywords).split(",").map((item) => item.trim()).filter(Boolean);
  if (title.length < 8) throw new Error("Başlık en az 8 karakter olmalı.");
  if (!slug) throw new Error("Geçerli bir slug üretilemedi.");
  if (content.length < 120) throw new Error("İçerik en az 120 karakter olmalı.");
  const base = {
    title,
    slug,
    excerpt: text(input.excerpt).slice(0, 500),
    content,
    content_format: "markdown",
    status,
    author_name: text(input.author_name, "HK Dijital"),
    cover_image_url: text(input.cover_image_url) || null,
    cover_image_alt: text(input.cover_image_alt) || null,
    category_id: text(input.category_id) || null,
    primary_keyword: text(input.primary_keyword),
    secondary_keywords: secondary,
    search_intent: text(input.search_intent),
    target_location: text(input.target_location) || null,
    meta_title: text(input.meta_title, title).slice(0, 80),
    meta_description: text(input.meta_description, text(input.excerpt)).slice(0, 220),
    canonical_url: text(input.canonical_url) || null,
    og_title: text(input.og_title) || null,
    og_description: text(input.og_description) || null,
    og_image_url: text(input.og_image_url) || null,
    featured: Boolean(input.featured),
    allow_indexing: input.allow_indexing !== false,
    scheduled_at: text(input.scheduled_at) || null,
    published_at: status === "published" ? text(input.published_at, new Date().toISOString()) : text(input.published_at) || null,
    updated_by: userId || null
  };
  const metrics = analyzeBlogPost({ ...base, allow_indexing: base.allow_indexing });
  return { ...base, ...metrics };
}

function normalizeAdminPost(row: BlogPostRow) {
  return {
    ...row,
    category: Array.isArray(row.blog_categories) ? row.blog_categories[0] : row.blog_categories
  };
}

export async function GET(request: Request) {
  if (!(await requireStaff())) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  if (!hasSupabaseConfig()) return NextResponse.json({ posts: seedBlogPosts.filter((post) => !status || post.status === status), source: "seed" });
  try {
    const filters = ["select=*,blog_categories(name,slug,description)", "order=updated_at.desc", "limit=200"];
    if (status && statuses.includes(status as BlogStatus)) filters.push(`status=eq.${status}`);
    const posts = await supabaseRest<BlogPostRow[]>(`blog_posts?${filters.join("&")}`);
    return NextResponse.json({ posts: posts.map(normalizeAdminPost), source: "database" });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırması yok. Canlı kayıt için veritabanı gerekir." }, { status: 500 });
  try {
    const payload = normalizePayload(await request.json(), session.profileId);
    const rows = await supabaseRest("blog_posts", { method: "POST", body: JSON.stringify({ ...payload, created_by: session.profileId || null }) });
    return NextResponse.json({ post: Array.isArray(rows) ? rows[0] : rows });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 400 });
  }
}
