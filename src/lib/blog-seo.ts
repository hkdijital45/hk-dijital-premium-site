import { cache } from "react";
import { absoluteUrl } from "@/lib/metadata";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import {
  blogPublishedAt,
  seedBlogPosts,
  slugifyBlogValue,
  type BlogCategory,
  type BlogPost,
  type BlogStatus
} from "@/lib/blog-seo-shared";

export * from "@/lib/blog-seo-shared";

function normalizePost(row: Record<string, unknown>): BlogPost {
  const category = Array.isArray(row.blog_categories) ? row.blog_categories[0] : row.blog_categories;
  return {
    id: String(row.id || ""),
    title: String(row.title || ""),
    slug: String(row.slug || ""),
    excerpt: String(row.excerpt || ""),
    content: String(row.content || ""),
    content_format: "markdown",
    status: String(row.status || "draft") as BlogStatus,
    author_name: String(row.author_name || "HK Dijital"),
    cover_image_url: row.cover_image_url ? String(row.cover_image_url) : null,
    cover_image_alt: row.cover_image_alt ? String(row.cover_image_alt) : null,
    category_id: row.category_id ? String(row.category_id) : null,
    category: category && typeof category === "object" ? category as BlogCategory : null,
    primary_keyword: String(row.primary_keyword || ""),
    secondary_keywords: Array.isArray(row.secondary_keywords) ? row.secondary_keywords.map(String) : [],
    search_intent: String(row.search_intent || ""),
    target_location: row.target_location ? String(row.target_location) : null,
    meta_title: String(row.meta_title || row.title || ""),
    meta_description: String(row.meta_description || row.excerpt || ""),
    canonical_url: row.canonical_url ? String(row.canonical_url) : null,
    og_title: row.og_title ? String(row.og_title) : null,
    og_description: row.og_description ? String(row.og_description) : null,
    og_image_url: row.og_image_url ? String(row.og_image_url) : null,
    featured: Boolean(row.featured),
    allow_indexing: row.allow_indexing !== false,
    approved_for_publish: Boolean(row.approved_for_publish),
    approved_at: row.approved_at ? String(row.approved_at) : null,
    approved_by: row.approved_by ? String(row.approved_by) : null,
    ai_image_metadata: row.ai_image_metadata && typeof row.ai_image_metadata === "object" ? row.ai_image_metadata as Record<string, unknown> : {},
    last_performance_check_at: row.last_performance_check_at ? String(row.last_performance_check_at) : null,
    published_at: row.published_at ? String(row.published_at) : null,
    scheduled_at: row.scheduled_at ? String(row.scheduled_at) : null,
    created_at: row.created_at ? String(row.created_at) : undefined,
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
    created_by: row.created_by ? String(row.created_by) : null,
    updated_by: row.updated_by ? String(row.updated_by) : null,
    reading_time: Number(row.reading_time || 1),
    word_count: Number(row.word_count || 0),
    seo_score: Number(row.seo_score || 0),
    readability_score: Number(row.readability_score || 0),
    clarity_score: Number(row.clarity_score || 0),
    content_quality_score: Number(row.content_quality_score || 0)
  };
}

export const getPublicBlogPosts = cache(async () => {
  if (!hasSupabaseConfig()) return seedBlogPosts;
  try {
    const now = encodeURIComponent(new Date().toISOString());
    const rows = await supabaseRest<Record<string, unknown>[]>(
      `blog_posts?select=*,blog_categories(name,slug,description)&status=eq.published&allow_indexing=eq.true&or=(published_at.is.null,published_at.lte.${now})&order=published_at.desc&limit=60`,
      {},
      false
    );
    return rows.map(normalizePost);
  } catch {
    return seedBlogPosts;
  }
});

export const getPublicBlogPost = cache(async (slug: string) => {
  const cleanSlug = slugifyBlogValue(slug);
  if (!hasSupabaseConfig()) return seedBlogPosts.find((post) => post.slug === cleanSlug) || null;
  try {
    const now = encodeURIComponent(new Date().toISOString());
    const rows = await supabaseRest<Record<string, unknown>[]>(
      `blog_posts?select=*,blog_categories(name,slug,description)&slug=eq.${encodeURIComponent(cleanSlug)}&status=eq.published&allow_indexing=eq.true&or=(published_at.is.null,published_at.lte.${now})&limit=1`,
      {},
      false
    );
    return rows[0] ? normalizePost(rows[0]) : null;
  } catch {
    return seedBlogPosts.find((post) => post.slug === cleanSlug) || null;
  }
});

export async function getBlogSitemapEntries() {
  const posts = await getPublicBlogPosts();
  return posts.map((post) => ({
    url: absoluteUrl(`/blog/${post.slug}`),
    lastModified: post.updated_at || post.published_at || blogPublishedAt
  }));
}
