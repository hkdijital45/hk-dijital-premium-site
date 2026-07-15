import { NextResponse } from "next/server";
import { getSession, isStaffRole } from "@/lib/auth";
import { analyzeBlogPost, slugifyBlogValue, type BlogPost, type BlogStatus } from "@/lib/blog-seo-shared";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

const statuses: BlogStatus[] = ["draft", "review", "scheduled", "published", "archived"];
type Params = { params: Promise<{ id: string }> };
type BlogPostRow = Record<string, unknown> & { blog_categories?: unknown };

async function requireStaff() {
  const session = await getSession();
  return session && isStaffRole(session.role) ? session : null;
}

function text(value: unknown, fallback = "") {
  return String(value || fallback).trim();
}

function normalizePatch(input: Record<string, unknown>, userId?: string) {
  const title = text(input.title);
  const content = text(input.content);
  const slug = slugifyBlogValue(text(input.slug, title));
  const status = statuses.includes(input.status as BlogStatus) ? input.status as BlogStatus : "draft";
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
    secondary_keywords: Array.isArray(input.secondary_keywords) ? input.secondary_keywords.map(String) : text(input.secondary_keywords).split(",").map((item) => item.trim()).filter(Boolean),
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
    updated_by: userId || null,
    updated_at: new Date().toISOString()
  };
  return { ...base, ...analyzeBlogPost({ ...base, allow_indexing: base.allow_indexing }) };
}

function normalizeAdminPost(row: BlogPostRow) {
  return {
    ...row,
    category: Array.isArray(row.blog_categories) ? row.blog_categories[0] : row.blog_categories
  };
}

export async function PATCH(request: Request, { params }: Params) {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırması yok. Canlı kayıt için veritabanı gerekir." }, { status: 500 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Geçersiz yazı ID" }, { status: 400 });
  try {
    const body = await request.json();
    const existing = await supabaseRest<BlogPost[]>(`blog_posts?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
    if (!existing[0]) return NextResponse.json({ error: "Yazı bulunamadı" }, { status: 404 });
    const rows = await supabaseRest<BlogPostRow[]>(`blog_posts?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(normalizePatch(body, session.profileId)) });
    await supabaseRest("blog_post_revisions", { method: "POST", body: JSON.stringify({ post_id: id, title: existing[0].title, content: existing[0].content, meta_title: existing[0].meta_title, meta_description: existing[0].meta_description, revision_note: text(body.revision_note, "Admin düzenlemesi"), created_by: session.profileId || null }) }).catch(() => null);
    return NextResponse.json({ post: normalizeAdminPost(rows[0]) });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırması yok. Canlı kayıt için veritabanı gerekir." }, { status: 500 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Geçersiz yazı ID" }, { status: 400 });
  try {
    const rows = await supabaseRest<BlogPostRow[]>(`blog_posts?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status: "archived", allow_indexing: false, updated_by: session.profileId || null, updated_at: new Date().toISOString() }) });
    return NextResponse.json({ post: normalizeAdminPost(rows[0]) });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 400 });
  }
}
