import { analyzeBlogPost, slugifyBlogValue, stripMarkdown, type BlogPost } from "@/lib/blog-seo-shared";

export type ContentSourceSignal = "Manual brief" | "Search Console" | "Trend" | "Rakip" | "Mevcut içerik boşluğu" | "Mevsimsel";

export type ContentPlanItem = {
  id?: string;
  plan_id?: string;
  blog_post_id?: string | null;
  title: string;
  slug: string;
  primary_keyword: string;
  secondary_keywords: string[];
  search_intent: string;
  target_audience: string;
  content_type: string;
  scheduled_at: string | null;
  status: "planned" | "draft_ready" | "draft_created" | "scheduled" | "published" | "skipped";
  priority: "Yüksek" | "Orta" | "Düşük";
  rationale: string;
  source_signals: ContentSourceSignal[];
  last_error?: string | null;
};

export type ContentPlan = {
  id?: string;
  name: string;
  status: "draft" | "active" | "paused" | "completed" | "archived";
  service: string;
  region: string;
  audience: string;
  objective: string;
  weekly_count: number;
  start_date: string;
  end_date: string;
  preferred_days: string[];
  preferred_time: string;
  auto_generate_drafts: boolean;
  auto_publish: boolean;
  require_approval: boolean;
  items: ContentPlanItem[];
};

export type InternalLinkSuggestion = {
  id: string;
  sourceSlug: string;
  sourceTitle: string;
  targetSlug: string;
  targetTitle: string;
  anchorText: string;
  reason: string;
  priority: "Yüksek" | "Orta" | "Düşük";
  alreadyLinked: boolean;
};

export type PerformanceOpportunity = {
  postId?: string;
  slug: string;
  title: string;
  issue: string;
  evidence: string;
  priority: "Yüksek" | "Orta" | "Düşük";
  action: string;
  impact: "Yüksek" | "Orta" | "Düşük";
};

function text(value: unknown, max = 240) {
  return String(value || "").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function unique<T>(items: T[]) {
  return [...new Set(items.filter(Boolean))];
}

export function normalizeContentPlanItem(raw: Record<string, unknown>, existingSlugs: string[], index = 0): ContentPlanItem {
  const title = text(raw.title || raw.suggestedTitle || raw["önerilen başlık"], 150);
  if (title.length < 8) throw new Error("Plan öğesinde geçerli başlık yok.");
  const rootSlug = slugifyBlogValue(text(raw.slug || raw.slugSuggestion || title, 120)) || `icerik-${index + 1}`;
  const existing = new Set(existingSlugs.map(slugifyBlogValue));
  let slug = rootSlug;
  for (let i = 2; existing.has(slug); i += 1) slug = `${rootSlug}-${i}`;
  existing.add(slug);
  const sourceSignalInput = raw.source_signals || raw.sourceSignals;
  const keywordInput = raw.secondary_keywords || raw.secondaryKeywords;
  const sourceSignals = Array.isArray(sourceSignalInput)
    ? sourceSignalInput.map((item: unknown) => text(item, 40)).filter(Boolean)
    : ["Manual brief"];
  return {
    title,
    slug,
    primary_keyword: text(raw.primary_keyword || raw.primaryKeyword, 120),
    secondary_keywords: Array.isArray(keywordInput)
      ? keywordInput.map((item: unknown) => text(item, 80)).filter(Boolean).slice(0, 8)
      : [],
    search_intent: text(raw.search_intent || raw.searchIntent, 100) || "Yerel arama",
    target_audience: text(raw.target_audience || raw.targetAudience, 140),
    content_type: text(raw.content_type || raw.contentType, 80) || "Blog yazısı",
    scheduled_at: text(raw.scheduled_at || raw.scheduledAt, 80) || null,
    status: "planned",
    priority: ["Yüksek", "Orta", "Düşük"].includes(text(raw.priority, 20)) ? text(raw.priority, 20) as ContentPlanItem["priority"] : "Orta",
    rationale: text(raw.rationale || raw.reason || raw.gerekce, 500),
    source_signals: unique(sourceSignals).filter((item): item is ContentSourceSignal => ["Manual brief", "Search Console", "Trend", "Rakip", "Mevcut içerik boşluğu", "Mevsimsel"].includes(String(item))).slice(0, 5)
  };
}

export function buildInternalLinkSuggestions(posts: BlogPost[]): InternalLinkSuggestion[] {
  const published = posts.filter((post) => post.status === "published" && post.allow_indexing);
  const suggestions: InternalLinkSuggestion[] = [];
  for (const source of published) {
    const sourceText = `${source.title} ${source.excerpt} ${stripMarkdown(source.content)}`.toLocaleLowerCase("tr");
    const existingLinks = new Set([...source.content.matchAll(/\]\((\/blog\/[^)]+)\)/g)].map((match) => match[1]));
    for (const target of published) {
      if (source.slug === target.slug) continue;
      const phrases = unique([target.primary_keyword, target.title, ...(target.secondary_keywords || [])].map((item) => item.trim()).filter((item) => item.length > 5));
      const matched = phrases.find((phrase) => sourceText.includes(phrase.toLocaleLowerCase("tr")));
      if (!matched) continue;
      const href = `/blog/${target.slug}`;
      suggestions.push({
        id: `${source.slug}-${target.slug}`,
        sourceSlug: source.slug,
        sourceTitle: source.title,
        targetSlug: target.slug,
        targetTitle: target.title,
        anchorText: matched,
        reason: `"${matched}" ifadesi hedef yazının ana konusu ile eşleşiyor.`,
        priority: existingLinks.has(href) ? "Düşük" : target.featured ? "Yüksek" : "Orta",
        alreadyLinked: existingLinks.has(href)
      });
    }
  }
  return suggestions.slice(0, 40);
}

export function applyInternalLinkPreview(content: string, suggestion: InternalLinkSuggestion) {
  if (suggestion.alreadyLinked) return content;
  const escaped = suggestion.anchorText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?<!\\])\\b(${escaped})\\b(?!\\]\\()`, "i");
  return content.replace(pattern, `[${suggestion.anchorText}](/blog/${suggestion.targetSlug})`);
}

export function buildPerformanceOpportunities(posts: BlogPost[]): PerformanceOpportunity[] {
  return posts.flatMap((post) => {
    const audit = analyzeBlogPost(post);
    const ageDays = post.updated_at ? Math.floor((Date.now() - new Date(post.updated_at).getTime()) / 86_400_000) : null;
    const items: PerformanceOpportunity[] = [];
    if (post.seo_score < 75) items.push({ postId: post.id, slug: post.slug, title: post.title, issue: "SEO skoru düşük", evidence: `Mevcut SEO skoru ${post.seo_score}/100.`, priority: "Yüksek", action: "Başlık, meta açıklama, iç bağlantı ve başlık hiyerarşisini güncelle.", impact: "Orta" });
    if (!post.cover_image_alt && post.cover_image_url) items.push({ postId: post.id, slug: post.slug, title: post.title, issue: "Kapak görseli alt metni eksik", evidence: "Kapak görseli var ancak alt metin yok.", priority: "Orta", action: "Açıklayıcı ve doğal alt metin ekle.", impact: "Düşük" });
    if (audit.word_count < 650) items.push({ postId: post.id, slug: post.slug, title: post.title, issue: "İçerik kısa", evidence: `${audit.word_count} kelime görünüyor.`, priority: "Orta", action: "Örnek, kontrol listesi ve sık soru bölümü ekle.", impact: "Orta" });
    if (ageDays !== null && ageDays > 120) items.push({ postId: post.id, slug: post.slug, title: post.title, issue: "Uzun süredir güncellenmedi", evidence: `Son güncelleme yaklaşık ${ageDays} gün önce.`, priority: "Orta", action: "Bilgileri, iç bağlantıları ve CTA bölümünü gözden geçir.", impact: "Orta" });
    if (!/\]\(\/(blog|hizmetler|teklif-al|iletisim)/.test(post.content)) items.push({ postId: post.id, slug: post.slug, title: post.title, issue: "İç bağlantı zayıf", evidence: "Doğal dahili bağlantı tespit edilmedi.", priority: "Yüksek", action: "İlgili hizmet veya blog yazılarına kontrollü iç bağlantı ekle.", impact: "Orta" });
    return items;
  }).slice(0, 60);
}

export function formatSocialPackageText(packageData: Record<string, unknown>) {
  return Object.entries(packageData)
    .map(([platform, value]) => `${platform.toUpperCase()}\n${typeof value === "string" ? value : JSON.stringify(value, null, 2)}`)
    .join("\n\n");
}
