"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Archive, BarChart3, Bot, CalendarDays, CheckCircle2, Edit3, FileText, Link2, Loader2, Plus, RefreshCw, Search, Send, Share2, ShieldAlert, Sparkles, Wand2 } from "lucide-react";
import { HKButton } from "@/components/admin/HKDesignSystem";
import { applyInternalLinkPreview, buildInternalLinkSuggestions, buildPerformanceOpportunities, formatSocialPackageText, type ContentPlanItem, type InternalLinkSuggestion } from "@/lib/blog-content-ops";
import { analyzeBlogPost, blogCategories, contentIntentMap, seedBlogPosts, slugifyBlogValue, type BlogCategory, type BlogPost, type BlogStatus } from "@/lib/blog-seo-shared";
import { servicePages } from "@/lib/public-seo-content";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminStatusBadge } from "@/components/admin/ui/AdminStatusBadge";
import { AdminWorkspace } from "@/components/admin/workspace/AdminWorkspace";
import { AdminDataGrid, type AdminDataGridColumn } from "@/components/admin/workspace/AdminDataGrid";
import { AdminActionBar } from "@/components/admin/workspace/AdminActionBar";
import { AdminCompactKpiStrip } from "@/components/admin/workspace/AdminCompactKpiStrip";

const statusLabels: Record<BlogStatus, string> = { draft: "Taslak", review: "İncelemede", scheduled: "Planlandı", published: "Yayında", archived: "Arşiv" };
const intentOptions = ["Bilgilendirici", "Ticari araştırma", "Hizmet arama", "Yerel arama", "Karşılaştırma", "Sorun çözme"];
const contentTypeOptions = ["Rehber", "Hizmet açıklaması", "Kontrol listesi", "Karşılaştırma", "Sık sorulan sorular", "Yerel SEO yazısı", "Vaka odaklı içerik"];
const toneOptions = ["Profesyonel", "Açıklayıcı", "Güven veren", "Sade", "Satış odaklı fakat abartısız"];
const lengthOptions = ["Kısa: 600–900 kelime", "Standart: 1000–1400 kelime", "Uzun: 1500–2000 kelime", "Kapsamlı rehber: 2200–3000 kelime"];
const serviceOptions = [
  ...servicePages.map((service) => ({ label: service.eyebrow, href: `/hizmetler/${service.slug}` })),
  { label: "Manisa Dijital Pazarlama", href: "/manisa-dijital-pazarlama" }
];
const tabs = [
  ["editor", "İçerik Üretimi"],
  ["plan", "İçerik Planı"],
  ["calendar", "İçerik Takvimi"],
  ["links", "İç Bağlantılar"],
  ["social", "Sosyal Medya"],
  ["performance", "Performans"],
  ["integrations", "Entegrasyon Durumu"]
] as const;
type BlogSeoTab = typeof tabs[number][0];

type DraftPost = Omit<BlogPost, "content_format" | "secondary_keywords" | "reading_time" | "word_count" | "seo_score" | "readability_score" | "clarity_score" | "content_quality_score"> & {
  secondary_keywords_text: string;
};

const emptyPost: DraftPost = {
  id: undefined,
  title: "", slug: "", excerpt: "", content: "", status: "draft" as BlogStatus, author_name: "Hayri Kamalı",
  cover_image_url: "", cover_image_alt: "", category_id: "", primary_keyword: "", secondary_keywords_text: "",
  search_intent: "", target_location: "", meta_title: "", meta_description: "", canonical_url: "", og_title: "",
  og_description: "", og_image_url: "", featured: false, allow_indexing: true, approved_for_publish: false, published_at: "", scheduled_at: "", category: null,
  created_by: null, updated_by: null
};

type AgentBrief = {
  service: string;
  keyword: string;
  location: string;
  audience: string;
  intent: string;
  contentType: string;
  tone: string;
  length: string;
  notes: string;
};

type TopicSuggestion = {
  title: string;
  primaryKeyword: string;
  secondaryKeywords?: string[];
  searchIntent?: string;
  targetAudience?: string;
  category?: string;
  angle?: string;
  suggestedServiceLink?: string;
  estimatedValue?: string;
  duplicateRisk?: string;
  similarityReason?: string;
  sourceLabels?: string[];
  funnelStage?: string;
  suggestedLength?: string;
  suggestedCta?: string;
};

type AiDraft = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  status: BlogStatus;
  category?: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  metaTitle: string;
  metaDescription: string;
  searchIntent: string;
  suggestedInternalLinks?: Array<{ label?: string; href?: string }>;
  suggestedFaq?: Array<{ question?: string; answer?: string }>;
  qualityNotes?: string[];
};

type Improvement = {
  improvedTitle?: string;
  improvedMetaTitle?: string;
  improvedMetaDescription?: string;
  improvedExcerpt?: string;
  improvedContent?: string;
  changeSummary?: string[];
  qualityNotes?: string[];
};

type AiMeta = {
  provider?: string;
  providerLabel?: string;
  model?: string;
  mode?: string;
  requestId?: string;
  generatedAt?: string;
  finishReason?: string;
  estimatedInputTokens?: number;
  estimatedOutputTokens?: number;
  fallbackUsed?: boolean;
  warning?: string | null;
  selectionReason?: string;
};

type AiProviderOption = {
  key: string;
  label?: string;
  name?: string;
  status?: string;
  model?: string | null;
  missingEnv?: string[];
  description?: string;
};

type PlanForm = {
  name: string;
  objective: string;
  weeklyCount: string;
  startDate: string;
  endDate: string;
  preferredDays: string[];
  preferredTime: string;
  excludedKeywords: string;
  competitorNotes: string;
  autoGenerateDrafts: boolean;
  autoPublish: boolean;
  requireApproval: boolean;
};

function countMarkdownHeadings(content: string) {
  const h2 = content.split("\n").filter((line) => /^##\s+/.test(line)).length;
  const h3 = content.split("\n").filter((line) => /^###\s+/.test(line)).length;
  return { h2, h3 };
}

function firstParagraph(content: string) {
  return content.split(/\n{2,}/).map((item) => item.trim()).find((item) => item && !item.startsWith("#")) || "";
}

function deterministicAudit(draft: DraftPost) {
  const base = analyzeBlogPost({
    title: draft.title,
    slug: draft.slug || slugifyBlogValue(draft.title),
    excerpt: draft.excerpt,
    content: draft.content,
    primary_keyword: draft.primary_keyword,
    meta_title: draft.meta_title,
    meta_description: draft.meta_description,
    cover_image_alt: draft.cover_image_alt,
    allow_indexing: draft.allow_indexing
  });
  const keyword = draft.primary_keyword.toLocaleLowerCase("tr").trim();
  const title = draft.title.toLocaleLowerCase("tr");
  const first = firstParagraph(draft.content).toLocaleLowerCase("tr");
  const headings = countMarkdownHeadings(draft.content);
  const h1Count = draft.content.split("\n").filter((line) => /^#\s+/.test(line)).length;
  const internalLinks = (draft.content.match(/\]\(\/(?!\/)/g) || []).length;
  const externalLinks = (draft.content.match(/\]\(https?:\/\//g) || []).length;
  const imageCount = (draft.content.match(/!\[[^\]]*]\([^)]+\)/g) || []).length + (draft.cover_image_url ? 1 : 0);
  const paragraphs = draft.content.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  const longParagraphs = paragraphs.filter((item) => item.split(/\s+/).length > 95).length;
  const sentences = draft.content.split(/[.!?…]+/).map((item) => item.trim()).filter((item) => item.split(/\s+/).length > 3);
  const longSentences = sentences.filter((item) => item.split(/\s+/).length > 28).length;
  const repeatedSentences = sentences.map((item) => item.toLocaleLowerCase("tr")).filter((item, index, list) => list.indexOf(item) !== index);
  const headingLabels = draft.content.split("\n").filter((line) => /^#{2,3}\s+/.test(line)).map((line) => line.replace(/^#{2,3}\s+/, "").toLocaleLowerCase("tr"));
  const repeatedHeadings = headingLabels.filter((item, index) => headingLabels.indexOf(item) !== index);
  const h2Labels = draft.content.split("\n").filter((line) => /^##\s+/.test(line)).map((line) => line.toLocaleLowerCase("tr"));
  const keywordInH2 = Boolean(keyword && h2Labels.some((line) => line.includes(keyword)));
  const plainWords = draft.content.replace(/[#>*_`[\]()!-]/g, " ").toLocaleLowerCase("tr").split(/\s+/).filter(Boolean);
  const keywordWords = keyword.split(/\s+/).filter(Boolean);
  const keywordMentions = keyword ? (draft.content.toLocaleLowerCase("tr").match(new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length : 0;
  const keywordDensity = plainWords.length && keywordWords.length ? Number(((keywordMentions * keywordWords.length / plainWords.length) * 100).toFixed(1)) : 0;
  const stuffingRisk = keywordDensity > 3.5 || keywordMentions > Math.max(8, Math.ceil(plainWords.length / 140));
  const technicalScore = Math.max(0, 100 - criticalPenalty([!draft.slug, !draft.meta_title, !draft.meta_description, h1Count > 0]));
  const coverageScore = Math.min(100, Math.round((Math.min(base.word_count, 1400) / 14) + headings.h2 * 5 + headings.h3 * 3));
  const keywordScore = Math.max(0, 100 - criticalPenalty([Boolean(keyword && !title.includes(keyword)), Boolean(keyword && !first.includes(keyword)), !keywordInH2, stuffingRisk]));
  const readabilityLocal = Math.max(35, 100 - longParagraphs * 8 - longSentences * 4 - repeatedSentences.length * 5);
  const linkScore = Math.min(100, internalLinks * 45 + externalLinks * 25);
  const visualScore = imageCount ? (draft.cover_image_alt ? 90 : 55) : 35;
  const critical = [
    !draft.title ? "Başlık eksik." : "",
    !draft.slug || !/^[a-z0-9-]+$/.test(draft.slug) ? "Slug geçersiz." : "",
    draft.content.length < 500 ? "İçerik yayın için kısa." : "",
    !draft.category_id ? "Kategori seçilmedi." : "",
    !draft.primary_keyword ? "Ana hedef kelime eksik." : "",
    !draft.meta_title ? "Meta title eksik." : "",
    !draft.meta_description ? "Meta description eksik." : ""
  ].filter(Boolean);
  const improvements = [
    keyword && !title.includes(keyword) ? "Ana hedef kelime başlıkta doğal biçimde geçmiyor." : "",
    keyword && !first.includes(keyword) ? "Ana hedef kelime ilk paragrafta doğal biçimde geçmiyor." : "",
    headings.h2 < 3 ? "En az 3 adet H2 başlık ekleyin." : "",
    headings.h3 < 1 ? "Gereken yerlerde H3 alt başlık ekleyin." : "",
    keyword && !keywordInH2 ? "Ana hedef kelime en az bir H2 başlıkta doğal biçimde geçmiyor." : "",
    h1Count > 0 ? "İçerik alanında H1 kullanılmış; H1 başlık alanından üretilir." : "",
    stuffingRisk ? `Anahtar kelime yoğunluğu yüksek görünüyor (%${keywordDensity}).` : "",
    internalLinks < 1 ? "En az bir doğrulanmış iç bağlantı ekleyin." : "",
    externalLinks < 1 ? "Güvenilir dış kaynak veya platform dokümanı bağlantısı yok." : "",
    !imageCount ? "Kapak veya içerik görseli yok." : "",
    imageCount && !draft.cover_image_alt ? "Kapak görseli varsa alt metin ekleyin." : "",
    longParagraphs ? `${longParagraphs} paragraf çok uzun; bölmeyi düşünün.` : "",
    longSentences ? `${longSentences} cümle çok uzun; Türkçe okunabilirlik için kısaltın.` : "",
    repeatedSentences.length ? "Tekrarlanan cümleler var." : "",
    repeatedHeadings.length ? "Tekrarlanan başlıklar var." : "",
    draft.meta_title.length > 65 ? "Meta title 65 karakteri aşıyor." : "",
    draft.meta_description.length < 120 || draft.meta_description.length > 170 ? "Meta description 120–170 karakter aralığında değil." : ""
  ].filter(Boolean);
  const passed = [
    draft.title.length >= 24 ? "Başlık yeterli uzunlukta." : "",
    /^[a-z0-9-]+$/.test(draft.slug || "") ? "Slug formatı geçerli." : "",
    base.word_count >= 650 ? "Kelime sayısı yayın için yeterli." : "",
    headings.h2 >= 3 ? "H2 yapısı var." : "",
    internalLinks > 0 ? "İç bağlantı var." : "",
    draft.meta_title.length >= 30 && draft.meta_title.length <= 65 ? "Meta title uygun aralıkta." : "",
    draft.meta_description.length >= 120 && draft.meta_description.length <= 170 ? "Meta description uygun aralıkta." : ""
  ].filter(Boolean);
  const readiness = Math.max(0, Math.min(100, Math.round((base.seo_score + readabilityLocal + keywordScore + coverageScore) / 4) - critical.length * 8 - improvements.length * 2));
  return { ...base, headings, h1Count, keywordInH2, keywordDensity, stuffingRisk, internalLinks, externalLinks, imageCount, longParagraphs, longSentences, repeatedSentences: repeatedSentences.length, critical, improvements, passed, readiness_score: readiness, subScores: { technicalScore, coverageScore, keywordScore, readabilityLocal, linkScore, visualScore } };
}

function criticalPenalty(values: boolean[]) {
  return values.filter(Boolean).length * 18;
}

function normalizeAiDraft(input: Record<string, unknown>): AiDraft {
  return {
    title: String(input.title || ""),
    slug: slugifyBlogValue(String(input.slug || input.title || "")),
    excerpt: String(input.excerpt || input.summary || ""),
    content: String(input.content || ""),
    status: "draft",
    category: String(input.category || ""),
    primaryKeyword: String(input.primaryKeyword || input.primary_keyword || ""),
    secondaryKeywords: Array.isArray(input.secondaryKeywords) ? input.secondaryKeywords.map(String) : [],
    metaTitle: String(input.metaTitle || input.meta_title || input.title || ""),
    metaDescription: String(input.metaDescription || input.meta_description || input.excerpt || ""),
    searchIntent: String(input.searchIntent || input.search_intent || ""),
    suggestedInternalLinks: Array.isArray(input.suggestedInternalLinks) ? input.suggestedInternalLinks as Array<{ label?: string; href?: string }> : [],
    suggestedFaq: Array.isArray(input.suggestedFaq) ? input.suggestedFaq as Array<{ question?: string; answer?: string }> : [],
    qualityNotes: Array.isArray(input.qualityNotes) ? input.qualityNotes.map(String) : []
  };
}

function scoreTone(value: number) {
  if (value >= 85) return "border-emerald-300/20 bg-emerald-400/10 text-emerald-200";
  if (value >= 70) return "border-yellow-300/20 bg-yellow-300/10 text-yellow-100";
  return "border-rose-300/20 bg-rose-400/10 text-rose-100";
}

function minWordsForLengthLabel(length: string) {
  if (length.startsWith("Kapsamlı")) return 1900;
  if (length.startsWith("Uzun")) return 1300;
  if (length.startsWith("Standart")) return 850;
  return 520;
}

function toDraft(post: BlogPost) {
  return {
    ...emptyPost,
    ...post,
    category_id: post.category_id || "",
    cover_image_url: post.cover_image_url || "",
    cover_image_alt: post.cover_image_alt || "",
    target_location: post.target_location || "",
    canonical_url: post.canonical_url || "",
    og_title: post.og_title || "",
    og_description: post.og_description || "",
    og_image_url: post.og_image_url || "",
    published_at: post.published_at || "",
    scheduled_at: post.scheduled_at || "",
    secondary_keywords_text: post.secondary_keywords.join(", ")
  };
}

export function BlogSeoCenter() {
  const [activeTab, setActiveTab] = useState<BlogSeoTab>("editor");
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [categories, setCategories] = useState<BlogCategory[]>(blogCategories);
  const [draft, setDraft] = useState<DraftPost>({ ...emptyPost });
  const [slugTouched, setSlugTouched] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<BlogStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [agent, setAgent] = useState<AgentBrief>({
    service: serviceOptions[0].label,
    keyword: "Manisa dijital pazarlama ajansı",
    location: "Manisa",
    audience: "Manisa ve çevresindeki yerel hizmet işletmeleri",
    intent: "Yerel arama",
    contentType: "Yerel SEO yazısı",
    tone: "Profesyonel",
    length: "Standart: 1000–1400 kelime",
    notes: ""
  });
  const [agentBusy, setAgentBusy] = useState("");
  const [agentError, setAgentError] = useState("");
  const [aiMode, setAiMode] = useState<"auto" | "manual">("auto");
  const [selectedProvider, setSelectedProvider] = useState("auto");
  const [providers, setProviders] = useState<AiProviderOption[]>([]);
  const [lastAiMeta, setLastAiMeta] = useState<AiMeta | null>(null);
  const [suggestions, setSuggestions] = useState<TopicSuggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<TopicSuggestion | null>(null);
  const [aiDraft, setAiDraft] = useState<AiDraft | null>(null);
  const [improvement, setImprovement] = useState<Improvement | null>(null);
  const [planForm, setPlanForm] = useState<PlanForm>({
    name: "Haftalık HK Dijital içerik planı",
    objective: "Manisa dijital pazarlama ajansı görünürlüğünü güçlendirmek",
    weeklyCount: "2",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
    preferredDays: ["Salı", "Perşembe"],
    preferredTime: "10:00",
    excludedKeywords: "",
    competitorNotes: "",
    autoGenerateDrafts: true,
    autoPublish: false,
    requireApproval: true
  });
  const [planItems, setPlanItems] = useState<ContentPlanItem[]>([]);
  const [savedPlans, setSavedPlans] = useState<Array<Record<string, unknown>>>([]);
  const [selectedSocialSlug, setSelectedSocialSlug] = useState("");
  const [socialPackage, setSocialPackage] = useState<Record<string, unknown> | null>(null);
  const [selectedPerformanceSlug, setSelectedPerformanceSlug] = useState("");
  const [updatePlan, setUpdatePlan] = useState<Record<string, unknown> | null>(null);
  const [linkPreview, setLinkPreview] = useState<{ suggestion: InternalLinkSuggestion; content: string } | null>(null);
  const [selectedCalendarSlug, setSelectedCalendarSlug] = useState("");
  const [selectedLinkId, setSelectedLinkId] = useState("");
  const [selectedOpportunityKey, setSelectedOpportunityKey] = useState("");
  const selectedProviderInfo = providers.find((provider) => provider.key === selectedProvider);

  async function loadData() {
    setLoading(true);
    try {
      const [postResponse, categoryResponse] = await Promise.all([
        fetch(`/api/admin/blog-posts${status !== "all" ? `?status=${status}` : ""}`, { cache: "no-store" }),
        fetch("/api/admin/blog-categories", { cache: "no-store" })
      ]);
      const postData = await postResponse.json();
      const categoryData = await categoryResponse.json();
      if (!postResponse.ok) throw new Error(postData.error || "Yazılar alınamadı.");
      setPosts(postData.posts || []);
      if (categoryResponse.ok) setCategories(categoryData.categories || blogCategories);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Blog verileri alınamadı.");
      setPosts(seedBlogPosts);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
      void loadPlans();
      void loadProviders();
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const current = new URLSearchParams(window.location.search).get("tab");
      if (current && tabs.some(([key]) => key === current)) setActiveTab(current as BlogSeoTab);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function selectTab(tab: BlogSeoTab) {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState(null, "", url.toString());
  }

  async function loadPlans() {
    const response = await fetch("/api/admin/blog-seo/content-plans", { cache: "no-store" }).catch(() => null);
    if (!response) return;
    const data = await response.json().catch(() => ({}));
    if (response.ok) setSavedPlans(Array.isArray(data.plans) ? data.plans : []);
  }

  async function loadProviders() {
    const response = await fetch("/api/admin/ai-providers", { cache: "no-store" }).catch(() => null);
    if (!response) return;
    const data = await response.json().catch(() => ({}));
    if (response.ok && Array.isArray(data.providers)) setProviders(data.providers);
  }

  const filtered = useMemo(() => {
    const q = query.toLocaleLowerCase("tr").trim();
    return posts.filter((post) => !q || `${post.title} ${post.slug} ${post.primary_keyword} ${post.search_intent}`.toLocaleLowerCase("tr").includes(q));
  }, [posts, query]);

  const metrics = useMemo(() => ({
    total: posts.length,
    published: posts.filter((post) => post.status === "published").length,
    draft: posts.filter((post) => post.status === "draft").length,
    review: posts.filter((post) => post.status === "review").length,
    scheduled: posts.filter((post) => post.status === "scheduled").length,
    avgSeo: posts.length ? Math.round(posts.reduce((sum, post) => sum + post.seo_score, 0) / posts.length) : 0,
    avgReadability: posts.length ? Math.round(posts.reduce((sum, post) => sum + post.readability_score, 0) / posts.length) : 0,
    updateNeeded: posts.filter((post) => post.status === "published" && (post.seo_score < 75 || !post.cover_image_alt || !post.meta_description)).length
  }), [posts]);

  const analysis = deterministicAudit(draft);
  const internalLinkSuggestions = useMemo(() => buildInternalLinkSuggestions(posts), [posts]);
  const performanceOpportunities = useMemo(() => buildPerformanceOpportunities(posts), [posts]);
  const selectedSocialPost = posts.find((post) => post.slug === selectedSocialSlug) || posts.find((post) => post.status === "published") || posts[0] || null;
  const selectedPerformancePost = posts.find((post) => post.slug === selectedPerformanceSlug) || posts.find((post) => post.status === "published") || posts[0] || null;

  const cannibalization = posts.filter((post) => post.id !== draft.id && draft.primary_keyword && post.primary_keyword.toLocaleLowerCase("tr") === draft.primary_keyword.toLocaleLowerCase("tr"));

  function updateDraft(key: keyof DraftPost, value: string | boolean) {
    if (key === "slug") setSlugTouched(true);
    setDraft((current) => {
      const next = { ...current, [key]: value };
      if (key === "title" && !current.id && !slugTouched) {
        next.slug = slugifyBlogValue(String(value));
        next.meta_title = String(value).slice(0, 65);
      }
      return next;
    });
  }

  function updateAgent(key: keyof AgentBrief, value: string) {
    setAgent((current) => ({ ...current, [key]: value }));
  }

  function categoryIdForName(value?: string) {
    const normalized = String(value || "").toLocaleLowerCase("tr");
    const found = categories.find((category) => category.name.toLocaleLowerCase("tr") === normalized || category.slug === slugifyBlogValue(value || ""));
    return found?.id || categories[0]?.id || "";
  }

  function hasDraftData() {
    return Boolean(draft.title || draft.slug || draft.excerpt || draft.content || draft.primary_keyword || draft.meta_title || draft.meta_description);
  }

  function applyDraft(next: Partial<DraftPost>, options: { requireConfirm?: boolean } = {}) {
    if (options.requireConfirm && hasDraftData() && !confirm("Mevcut alanlar değiştirilecek. Devam etmek istiyor musunuz?")) return;
    setDraft((current) => ({
      ...current,
      ...next,
      status: "draft",
      published_at: "",
      scheduled_at: "",
      allow_indexing: current.allow_indexing,
      approved_for_publish: current.approved_for_publish
    }));
    if (next.slug) setSlugTouched(false);
  }

  function applySuggestion(suggestion: TopicSuggestion, generateAfter = false) {
    setSelectedSuggestion(suggestion);
    applyDraft({
      title: suggestion.title || draft.title,
      slug: slugifyBlogValue(suggestion.title || draft.title),
      primary_keyword: suggestion.primaryKeyword || draft.primary_keyword,
      secondary_keywords_text: (suggestion.secondaryKeywords || []).join(", "),
      search_intent: suggestion.searchIntent || agent.intent,
      target_location: agent.location,
      category_id: categoryIdForName(suggestion.category),
      excerpt: suggestion.angle || draft.excerpt,
      meta_title: (suggestion.title || draft.title).slice(0, 65),
      meta_description: `${suggestion.angle || suggestion.title || ""}`.slice(0, 160)
    }, { requireConfirm: hasDraftData() });
    if (generateAfter) void generateDraft(suggestion);
  }

  function applyAiDraft(nextDraft = aiDraft) {
    if (!nextDraft) return;
    applyDraft({
      title: nextDraft.title,
      slug: nextDraft.slug,
      excerpt: nextDraft.excerpt,
      content: nextDraft.content,
      category_id: categoryIdForName(nextDraft.category),
      primary_keyword: nextDraft.primaryKeyword,
      secondary_keywords_text: nextDraft.secondaryKeywords.join(", "),
      search_intent: nextDraft.searchIntent,
      target_location: agent.location,
      meta_title: nextDraft.metaTitle.slice(0, 80),
      meta_description: nextDraft.metaDescription.slice(0, 220)
    }, { requireConfirm: hasDraftData() });
  }

  function applyImprovement() {
    if (!improvement) return;
    applyDraft({
      title: improvement.improvedTitle || draft.title,
      excerpt: improvement.improvedExcerpt || draft.excerpt,
      content: improvement.improvedContent || draft.content,
      meta_title: improvement.improvedMetaTitle || draft.meta_title,
      meta_description: improvement.improvedMetaDescription || draft.meta_description
    }, { requireConfirm: true });
  }

  async function runAgent(action: "topic_suggestions" | "generate_draft" | "improve_draft" | "expand_draft", extra: Record<string, unknown> = {}) {
    if (agentBusy) return null;
    setAgentBusy(action);
    setAgentError("");
    try {
      const response = await fetch("/api/admin/blog-seo/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ...agent,
          ...extra,
          aiMode,
          aiProvider: aiMode === "manual" ? selectedProvider : "auto",
          existingTitles: posts.map((post) => post.title),
          existingSlugs: posts.map((post) => post.slug),
          currentDraft: draft
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "AI işlemi tamamlanamadı.");
      setLastAiMeta(data.ai || null);
      return data as Record<string, unknown>;
    } catch (error) {
      setAgentError(error instanceof Error ? error.message : "AI işlemi tamamlanamadı.");
      return null;
    } finally {
      setAgentBusy("");
    }
  }

  async function runContentAgent(action: "weekly_plan" | "social_package" | "update_plan", extra: Record<string, unknown> = {}) {
    if (agentBusy) return null;
    setAgentBusy(action);
    setAgentError("");
    try {
      const response = await fetch("/api/admin/blog-seo/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ...agent,
          ...extra,
          aiMode,
          aiProvider: aiMode === "manual" ? selectedProvider : "auto",
          existingTitles: posts.map((post) => post.title),
          existingSlugs: posts.map((post) => post.slug)
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "AI işlemi tamamlanamadı.");
      setLastAiMeta(data.ai || null);
      return data as Record<string, unknown>;
    } catch (error) {
      setAgentError(error instanceof Error ? error.message : "AI işlemi tamamlanamadı.");
      return null;
    } finally {
      setAgentBusy("");
    }
  }

  async function findTopics() {
    const data = await runAgent("topic_suggestions");
    if (!data) return;
    const next = Array.isArray(data.suggestions) ? data.suggestions.slice(0, 8) as TopicSuggestion[] : [];
    setSuggestions(next);
    setMessage(next.length ? "Konu önerileri hazırlandı." : "Konu önerisi alınamadı.");
  }

  async function generateDraft(suggestion = selectedSuggestion) {
    const data = await runAgent("generate_draft", suggestion ? { topic: suggestion } : {});
    if (!data?.draft || typeof data.draft !== "object") return;
    const next = normalizeAiDraft(data.draft as Record<string, unknown>);
    setAiDraft(next);
    setMessage("AI taslak oluşturdu. Yayınlamak için önce form alanlarına uygulayıp kaydedin.");
  }

  async function improveDraft() {
    const data = await runAgent("improve_draft");
    if (!data?.improvement || typeof data.improvement !== "object") return;
    setImprovement(data.improvement as Improvement);
    setMessage("Taslak geliştirme önerisi hazırlandı.");
  }

  async function expandDraft() {
    const data = await runAgent("expand_draft");
    if (!data?.improvement || typeof data.improvement !== "object") return;
    setImprovement(data.improvement as Improvement);
    setMessage("Taslağı genişletme önerisi hazırlandı. İçeriğe uygulamadan önce özeti kontrol edin.");
  }

  async function generateWeeklyPlan() {
    if (!planForm.name.trim()) {
      setMessage("Plan adı zorunludur.");
      return;
    }
    const data = await runContentAgent("weekly_plan", {
      planName: planForm.name,
      objective: planForm.objective,
      weeklyCount: Number(planForm.weeklyCount || 2),
      startDate: planForm.startDate,
      endDate: planForm.endDate,
      preferredDays: planForm.preferredDays,
      preferredTime: planForm.preferredTime,
      excludedKeywords: planForm.excludedKeywords.split(",").map((item) => item.trim()).filter(Boolean),
      competitorNotes: planForm.competitorNotes
    });
    const items = Array.isArray(data?.items) ? data.items as ContentPlanItem[] : [];
    setPlanItems(items);
    setMessage(items.length ? "Haftalık içerik planı oluşturuldu. Taslaklar otomatik yayınlanmaz." : "Plan öğesi alınamadı.");
  }

  async function savePlan() {
    if (saving || !planItems.length) return;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/blog-seo/content-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: planForm.name,
          service: agent.service,
          region: agent.location,
          audience: agent.audience,
          objective: planForm.objective,
          weeklyCount: Number(planForm.weeklyCount || 2),
          startDate: planForm.startDate,
          endDate: planForm.endDate,
          preferredDays: planForm.preferredDays,
          preferredTime: planForm.preferredTime,
          contentTypes: [agent.contentType],
          primaryKeywords: [agent.keyword],
          excludedKeywords: planForm.excludedKeywords,
          tone: agent.tone,
          averageLength: agent.length,
          autoGenerateDrafts: planForm.autoGenerateDrafts,
          autoPublish: false,
          requireApproval: true,
          items: planItems
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Plan kaydedilemedi.");
      setMessage("İçerik planı kaydedildi.");
      await loadPlans();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Plan kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  async function generateDraftFromPlanItem(item: ContentPlanItem) {
    setSelectedSuggestion({
      title: item.title,
      primaryKeyword: item.primary_keyword,
      secondaryKeywords: item.secondary_keywords,
      searchIntent: item.search_intent,
      targetAudience: item.target_audience,
      angle: item.rationale,
      duplicateRisk: "Plan kontrolü"
    });
    await generateDraft({
      title: item.title,
      primaryKeyword: item.primary_keyword,
      secondaryKeywords: item.secondary_keywords,
      searchIntent: item.search_intent,
      targetAudience: item.target_audience,
      angle: item.rationale,
      duplicateRisk: "Plan kontrolü"
    });
  }

  async function generateSocialPackage() {
    if (!selectedSocialPost) {
      setMessage("Sosyal medya uyarlaması için yazı seçin.");
      return;
    }
    const data = await runContentAgent("social_package", {
      title: selectedSocialPost.title,
      excerpt: selectedSocialPost.excerpt,
      content: selectedSocialPost.content,
      url: `/blog/${selectedSocialPost.slug}`
    });
    if (data?.socialPackage && typeof data.socialPackage === "object") {
      setSocialPackage(data.socialPackage as Record<string, unknown>);
      setMessage("Sosyal medya taslak paketi hazırlandı. Otomatik paylaşım yapılmadı.");
    }
  }

  async function generateUpdatePlan() {
    if (!selectedPerformancePost) return;
    const findings = performanceOpportunities.filter((item) => item.slug === selectedPerformancePost.slug).slice(0, 8);
    const data = await runContentAgent("update_plan", {
      title: selectedPerformancePost.title,
      metaTitle: selectedPerformancePost.meta_title,
      metaDescription: selectedPerformancePost.meta_description,
      primaryKeyword: selectedPerformancePost.primary_keyword,
      content: selectedPerformancePost.content,
      findings
    });
    if (data?.updatePlan && typeof data.updatePlan === "object") {
      setUpdatePlan(data.updatePlan as Record<string, unknown>);
      setMessage("İçerik güncelleme önerisi hazırlandı. Kayıtlı içerik değiştirilmedi.");
    }
  }

  function applyLinkSuggestion(suggestion: InternalLinkSuggestion) {
    const sourcePost = posts.find((post) => post.slug === suggestion.sourceSlug);
    if (!sourcePost) return;
    const nextContent = applyInternalLinkPreview(sourcePost.content, suggestion);
    setLinkPreview({ suggestion, content: nextContent });
    setDraft(toDraft({ ...sourcePost, content: nextContent }));
    setSlugTouched(false);
    selectTab("editor");
    setMessage("İç bağlantı önerisi forma önizleme olarak uygulandı. Kaydetmeden canlı yazı değişmez.");
  }

  async function savePost(nextStatus?: BlogStatus) {
    if (saving) return;
    const targetStatus = nextStatus || draft.status;
    if (targetStatus === "published") {
      const publishSummary = [
        "Yayın öncesi kontrol özeti",
        "",
        `Başlık: ${draft.title || "Eksik"}`,
        `Slug: ${draft.slug || "Eksik"}`,
        `Kategori: ${categories.find((category) => category.id === draft.category_id)?.name || "Seçilmedi"}`,
        `Kelime sayısı: ${analysis.word_count}`,
        `SEO: ${analysis.seo_score}/100`,
        `Tahmini Türkçe okunabilirlik: ${analysis.subScores.readabilityLocal}/100`,
        `İç bağlantı: ${analysis.internalLinks}`,
        `Dış bağlantı: ${analysis.externalLinks}`,
        `Görsel: ${analysis.imageCount ? "Var" : "Yok"}`,
        `Meta title: ${draft.meta_title || "Eksik"}`,
        `Meta description: ${draft.meta_description || "Eksik"}`,
        `Public URL: /blog/${draft.slug || slugifyBlogValue(draft.title)}`,
        "",
        analysis.critical.length ? `Kritik eksikler:\n- ${analysis.critical.join("\n- ")}` : "Kritik eksik yok.",
        analysis.improvements.length ? `Öneri niteliğindeki uyarılar:\n- ${analysis.improvements.slice(0, 8).join("\n- ")}` : "Öneri niteliğinde uyarı yok."
      ].join("\n");
      if (!confirm(`${publishSummary}\n\nBu yazı public blogda yayınlanacak. Onaylıyor musunuz?`)) return;
    }
    const candidateSlug = draft.slug || slugifyBlogValue(draft.title);
    const duplicateSlug = posts.find((post) => post.id !== draft.id && post.slug === candidateSlug);
    if (duplicateSlug) {
      setMessage(`Slug çakışması var: ${duplicateSlug.title}`);
      return;
    }
    setSaving(true);
    setMessage("");
    const payload = { ...draft, status: targetStatus, slug: candidateSlug, secondary_keywords: draft.secondary_keywords_text.split(",").map((item) => item.trim()).filter(Boolean) };
    try {
      const response = await fetch(draft.id ? `/api/admin/blog-posts/${draft.id}` : "/api/admin/blog-posts", {
        method: draft.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Yazı kaydedilemedi.");
      setDraft(toDraft(data.post));
      setSlugTouched(false);
      setMessage(targetStatus === "published" ? `Yazı yayınlandı: /blog/${data.post.slug}` : "Yazı taslak olarak kaydedildi.");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Yazı kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  async function archivePost(post: BlogPost) {
    if (!post.id || saving || !confirm(`"${post.title}" arşivlensin mi?`)) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/blog-posts/${post.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Yazı arşivlenemedi.");
      setMessage("Yazı arşivlendi.");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Yazı arşivlenemedi.");
    } finally {
      setSaving(false);
    }
  }

  const calendarPosts = posts.filter((post) => ["draft", "review", "scheduled", "published"].includes(post.status));
  const selectedCalendarPost = selectedCalendarSlug ? calendarPosts.find((post) => post.slug === selectedCalendarSlug) || null : null;
  const calendarColumns: AdminDataGridColumn<any>[] = [
    { key: "title", header: "Başlık", render: (post: any) => <div className="min-w-0"><strong className="block truncate">{post.title}</strong><span className="block truncate text-[11px] text-slate-500">/{post.slug}</span></div> },
    { key: "status", header: "Durum", render: (post: any) => <AdminStatusBadge tone={post.status === "published" ? "success" : post.status === "scheduled" ? "info" : post.status === "review" ? "warning" : "neutral"}>{statusLabels[post.status as BlogStatus]}</AdminStatusBadge> },
    { key: "date", header: "Tarih", render: (post: any) => post.scheduled_at || post.published_at ? new Date(post.scheduled_at || post.published_at).toLocaleString("tr-TR") : "Tarih yok" }
  ];
  const linkColumns: AdminDataGridColumn<any>[] = [
    { key: "source", header: "Kaynak Yazı", render: (item: any) => item.sourceTitle },
    { key: "target", header: "Hedef Yazı", render: (item: any) => item.targetTitle },
    { key: "priority", header: "Durum", render: (item: any) => <AdminStatusBadge tone={item.alreadyLinked ? "success" : "warning"}>{item.alreadyLinked ? "Mevcut link var" : item.priority}</AdminStatusBadge> }
  ];
  const selectedLink = selectedLinkId ? internalLinkSuggestions.find((item) => item.id === selectedLinkId) || null : null;
  const opportunityColumns: AdminDataGridColumn<any>[] = [
    { key: "title", header: "Yazı", render: (item: any) => item.title },
    { key: "issue", header: "Sorun", render: (item: any) => item.issue },
    { key: "priority", header: "Öncelik", render: (item: any) => <AdminStatusBadge tone={item.priority === "Yüksek" ? "danger" : item.priority === "Orta" ? "warning" : "info"}>{item.priority}</AdminStatusBadge> }
  ];
  const selectedOpportunity = selectedOpportunityKey ? performanceOpportunities.find((item) => `${item.slug}-${item.issue}` === selectedOpportunityKey) || null : null;

  return (
    <AdminWorkspace
      eyebrow="İçerik ve AI"
      title="Blog & SEO Merkezi"
      description="Blog yazıları, arama niyeti haritası, içerik takvimi ve açıklanabilir SEO kalite kontrolleri. Yayınlama mevcut onay ve zamanlanmış yayın akışıyla sınırlıdır."
      headerActions={<>
        <div className="flex flex-wrap gap-1">{tabs.map(([key, label]) => <AdminButton key={key} compact variant={activeTab === key ? "info" : "secondary"} onClick={() => selectTab(key)}>{label}</AdminButton>)}</div>
        <AdminButton compact variant="primary" onClick={() => { setDraft({ ...emptyPost }); setSlugTouched(false); }}><Plus size={14} className="mr-1 inline" />Yeni yazı</AdminButton>
      </>}
      bottomBar={<AdminActionBar statusText={message || `${metrics.total} yazı · ${metrics.published} yayında`}>{null}</AdminActionBar>}
    >
      <AdminCompactKpiStrip items={[
        { key: "total", label: "Toplam yazı", value: metrics.total, icon: <FileText size={14} />, tone: "primary" },
        { key: "published", label: "Yayında", value: metrics.published, icon: <CheckCircle2 size={14} />, tone: "success" },
        { key: "draft", label: "Taslak", value: metrics.draft, icon: <Edit3 size={14} />, tone: "neutral" as any },
        { key: "review", label: "İncelemede", value: metrics.review, icon: <ShieldAlert size={14} />, tone: "warning" },
        { key: "seo", label: "Ortalama SEO", value: metrics.avgSeo, icon: <BarChart3 size={14} />, tone: "info" },
        { key: "updateNeeded", label: "Güncelleme önerisi", value: metrics.updateNeeded, icon: <RefreshCw size={14} />, tone: metrics.updateNeeded ? "warning" : "success" }
      ]} />
      <div className="mt-4 rounded-[24px] bg-[#050711] p-4 text-white">
        {activeTab === "editor" ? <>
        <section className="mt-2 rounded-[28px] border border-cyan-200/15 bg-gradient-to-br from-cyan-300/10 via-white/[0.045] to-violet-400/10 p-5 shadow-[0_28px_90px_rgba(8,145,178,.08)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-cyan-200"><Bot size={16} /> AI İçerik Agentı</p>
              <h2 className="mt-2 text-2xl font-black text-white">Konu araştır, taslak üret, SEO kontrolü yap</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">AI yalnız taslak ve öneri üretir. Yayınlama mevcut blog akışı ve admin onayıyla ayrı yapılır.</p>
            </div>
            <div className="grid min-w-[260px] gap-2 rounded-2xl border border-white/10 bg-slate-950/45 p-3 text-xs text-slate-300">
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setAiMode("auto")} className={`min-h-9 rounded-xl px-3 font-black ${aiMode === "auto" ? "bg-cyan-300 text-slate-950" : "bg-white/10 text-slate-200"}`}>Otomatik</button>
                <button type="button" onClick={() => setAiMode("manual")} className={`min-h-9 rounded-xl px-3 font-black ${aiMode === "manual" ? "bg-cyan-300 text-slate-950" : "bg-white/10 text-slate-200"}`}>Manuel</button>
              </div>
              <label className="grid gap-1 font-bold">AI sağlayıcı
                <select value={selectedProvider} onChange={(event) => setSelectedProvider(event.target.value)} disabled={aiMode === "auto"} className="min-h-10 rounded-xl border border-white/10 bg-slate-950 px-3 text-white disabled:opacity-60">
                  <option value="auto">HK Intelligence Router</option>
                  {providers.filter((provider) => provider.key !== "auto").map((provider) => <option key={provider.key} value={provider.key} disabled={provider.status?.toLocaleLowerCase("tr").includes("eksik") || provider.status?.toLocaleLowerCase("tr").includes("yapılandırılmadı")}>{provider.label || provider.name || provider.key} · {provider.status || "Durum yok"}</option>)}
                </select>
              </label>
              <p><strong className="text-cyan-100">Model:</strong> {lastAiMeta?.model || selectedProviderInfo?.model || "İstek sonrası görünür"}</p>
              <p><strong className="text-cyan-100">Seçim nedeni:</strong> {lastAiMeta?.selectionReason || (aiMode === "auto" ? "Router SEO görevi için sağlayıcıyı otomatik seçer." : "Manuel seçilen provider kullanılır.")}</p>
            </div>
          </div>
          {agentError ? <p className="mt-4 rounded-2xl border border-rose-300/25 bg-rose-400/10 p-3 text-sm font-bold text-rose-100">{agentError}</p> : null}
          {lastAiMeta ? <div className="mt-4 grid gap-2 rounded-2xl border border-emerald-200/20 bg-emerald-300/10 p-3 text-xs font-bold text-emerald-100 md:grid-cols-4">
            <span>Provider: {lastAiMeta.providerLabel || lastAiMeta.provider || "Bilinmiyor"}</span>
            <span>Model: {lastAiMeta.model || "Bilinmiyor"}</span>
            <span>Mod: {lastAiMeta.mode || "Bilinmiyor"}</span>
            <span>Fallback: {lastAiMeta.fallbackUsed ? "Kullanıldı" : "Yok"}</span>
            <span>Request: {lastAiMeta.requestId}</span>
            <span>Çıkış: {lastAiMeta.estimatedOutputTokens || 0} token tahmini</span>
            <span>Durum: {lastAiMeta.finishReason || "Bilinmiyor"}</span>
            <span>{lastAiMeta.warning || "Uyarı yok"}</span>
          </div> : null}
          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            <label className="grid gap-2 text-sm font-bold text-slate-300">Hedef hizmet<select value={agent.service} onChange={(event) => updateAgent("service", event.target.value)} className="min-h-11 rounded-2xl border border-white/10 bg-slate-950/70 px-3 text-white outline-none focus:border-cyan-300">{serviceOptions.map((service) => <option key={service.href} value={service.label}>{service.label}</option>)}</select></label>
            <label className="grid gap-2 text-sm font-bold text-slate-300">Ana konu veya anahtar kelime<input value={agent.keyword} onChange={(event) => updateAgent("keyword", event.target.value)} className="min-h-11 rounded-2xl border border-white/10 bg-slate-950/70 px-3 text-white outline-none focus:border-cyan-300" /></label>
            <label className="grid gap-2 text-sm font-bold text-slate-300">Hedef şehir veya bölge<input value={agent.location} onChange={(event) => updateAgent("location", event.target.value)} className="min-h-11 rounded-2xl border border-white/10 bg-slate-950/70 px-3 text-white outline-none focus:border-cyan-300" /></label>
            <label className="grid gap-2 text-sm font-bold text-slate-300">Hedef kitle<input value={agent.audience} onChange={(event) => updateAgent("audience", event.target.value)} className="min-h-11 rounded-2xl border border-white/10 bg-slate-950/70 px-3 text-white outline-none focus:border-cyan-300" /></label>
            <label className="grid gap-2 text-sm font-bold text-slate-300">Arama amacı<select value={agent.intent} onChange={(event) => updateAgent("intent", event.target.value)} className="min-h-11 rounded-2xl border border-white/10 bg-slate-950/70 px-3 text-white outline-none focus:border-cyan-300">{intentOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="grid gap-2 text-sm font-bold text-slate-300">Yazı türü<select value={agent.contentType} onChange={(event) => updateAgent("contentType", event.target.value)} className="min-h-11 rounded-2xl border border-white/10 bg-slate-950/70 px-3 text-white outline-none focus:border-cyan-300">{contentTypeOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="grid gap-2 text-sm font-bold text-slate-300">Ton<select value={agent.tone} onChange={(event) => updateAgent("tone", event.target.value)} className="min-h-11 rounded-2xl border border-white/10 bg-slate-950/70 px-3 text-white outline-none focus:border-cyan-300">{toneOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="grid gap-2 text-sm font-bold text-slate-300">Tahmini uzunluk<select value={agent.length} onChange={(event) => updateAgent("length", event.target.value)} className="min-h-11 rounded-2xl border border-white/10 bg-slate-950/70 px-3 text-white outline-none focus:border-cyan-300">{lengthOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="grid gap-2 text-sm font-bold text-slate-300">Ek not<input value={agent.notes} onChange={(event) => updateAgent("notes", event.target.value)} className="min-h-11 rounded-2xl border border-white/10 bg-slate-950/70 px-3 text-white outline-none focus:border-cyan-300" /></label>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <HKButton type="button" variant="communication" loading={agentBusy === "topic_suggestions"} disabled={Boolean(agentBusy)} onClick={findTopics} icon={<Search size={16} />}>Konu önerileri bul</HKButton>
            <HKButton type="button" variant="ai" loading={agentBusy === "generate_draft"} disabled={Boolean(agentBusy)} onClick={() => generateDraft()} icon={<Sparkles size={16} />}>Seçilen konu için taslak oluştur</HKButton>
            <HKButton type="button" variant="info" loading={agentBusy === "improve_draft"} disabled={Boolean(agentBusy) || !draft.content.trim()} onClick={improveDraft} icon={<Wand2 size={16} />}>Mevcut taslağı geliştir</HKButton>
            <HKButton type="button" variant="warning" loading={agentBusy === "expand_draft"} disabled={Boolean(agentBusy) || !draft.content.trim()} onClick={expandDraft} icon={<Wand2 size={16} />}>Taslağı genişlet</HKButton>
            <HKButton type="button" variant="neutral" onClick={() => setAgentError("")} icon={<RefreshCw size={16} />}>SEO analizini yenile</HKButton>
            <HKButton type="button" variant="success" disabled={!aiDraft} onClick={() => applyAiDraft()} icon={<CheckCircle2 size={16} />}>Form alanlarına uygula</HKButton>
          </div>
          {(suggestions.length || aiDraft || improvement) ? <div className="mt-5 grid gap-4 xl:grid-cols-3">
            {suggestions.length ? <div className="xl:col-span-2">
              <h3 className="text-sm font-black uppercase tracking-[.14em] text-cyan-200">Konu önerileri</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2">{suggestions.map((item) => <article key={`${item.title}-${item.primaryKeyword}`} className={`rounded-2xl border p-4 ${selectedSuggestion?.title === item.title ? "border-cyan-300 bg-cyan-300/10" : "border-white/10 bg-slate-950/35"}`}>
                <p className="text-base font-black text-white">{item.title}</p>
                <p className="mt-2 text-xs font-bold text-cyan-100">{item.primaryKeyword}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{item.angle}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-black"><span className="rounded-full bg-white/10 px-2 py-1 text-slate-200">{item.searchIntent || agent.intent}</span><span className="rounded-full bg-amber-300/15 px-2 py-1 text-amber-100">Mevcut içerikle benzerlik: {item.duplicateRisk || "Düşük"}</span>{(item.sourceLabels || ["AI analizi", "mevcut blog arşivi"]).slice(0, 4).map((source) => <span key={source} className="rounded-full bg-cyan-300/10 px-2 py-1 text-cyan-100">{source}</span>)}</div>
                {item.similarityReason ? <p className="mt-2 text-xs leading-5 text-slate-400">{item.similarityReason}</p> : null}
                <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => applySuggestion(item)} className="min-h-10 rounded-xl border border-cyan-200/25 px-3 text-xs font-black text-cyan-100 hover:bg-cyan-300/10">Bu konuyu kullan</button><button type="button" disabled={Boolean(agentBusy)} onClick={() => applySuggestion(item, true)} className="min-h-10 rounded-xl bg-violet-600 px-3 text-xs font-black text-white disabled:opacity-60">Taslak oluştur</button></div>
              </article>)}</div>
            </div> : null}
            <div className="space-y-3">
              {aiDraft ? <div className="rounded-2xl border border-violet-200/20 bg-violet-400/10 p-4"><h3 className="font-black text-white">AI taslak özeti</h3><p className="mt-2 text-sm font-bold text-violet-100">{aiDraft.title}</p><p className="mt-2 text-xs leading-5 text-slate-300">{aiDraft.metaDescription}</p><button type="button" onClick={() => applyAiDraft()} className="mt-3 min-h-10 rounded-xl bg-violet-600 px-3 text-xs font-black text-white">Taslağı forma uygula</button></div> : null}
              {improvement ? <div className="rounded-2xl border border-emerald-200/20 bg-emerald-400/10 p-4"><h3 className="font-black text-white">Geliştirme önerisi</h3><div className="mt-2 grid gap-1 text-xs text-emerald-100">{(improvement.changeSummary || improvement.qualityNotes || []).slice(0, 5).map((item) => <p key={item}>• {item}</p>)}</div><button type="button" onClick={applyImprovement} className="mt-3 min-h-10 rounded-xl bg-emerald-600 px-3 text-xs font-black text-white">Öneriyi forma uygula</button></div> : null}
            </div>
          </div> : null}
        </section>
        <section className="mt-8 grid gap-6 2xl:grid-cols-[minmax(0,1fr)_540px]">
          <div className="space-y-5">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.045] p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <h2 className="text-xl font-black">Yazı listesi</h2>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <label className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Başlık, slug, kelime ara" className="min-h-11 rounded-2xl border border-white/10 bg-slate-950/70 pl-9 pr-3 text-sm outline-none focus:border-cyan-300" /></label>
                  <select value={status} onChange={(event) => setStatus(event.target.value as BlogStatus | "all")} className="min-h-11 rounded-2xl border border-white/10 bg-slate-950/70 px-3 text-sm outline-none focus:border-cyan-300"><option value="all">Tüm durumlar</option>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
                  <button type="button" onClick={loadData} className="min-h-11 rounded-2xl border border-white/10 px-4 text-sm font-bold text-slate-200 hover:bg-white/10">Yenile</button>
                </div>
              </div>
              <div className="mt-5 grid gap-3">
                {loading ? <div className="rounded-2xl border border-white/10 bg-slate-950/40 py-8 text-center text-slate-400"><Loader2 className="mx-auto mb-2 animate-spin" /> Yazılar yükleniyor</div> : filtered.map((post) => (
                  <article key={post.id || post.slug} className={`grid gap-3 rounded-2xl border p-4 md:grid-cols-[minmax(0,1fr)_auto] ${draft.id === post.id ? "border-cyan-300 bg-cyan-300/10" : "border-white/10 bg-slate-950/35"}`}>
                    <div className="min-w-0">
                      <p className="break-words font-black text-white">{post.title}</p>
                      <p className="mt-1 break-all text-xs text-slate-500">/{post.slug}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs font-black">
                        <span className="rounded-full bg-white/10 px-3 py-1 text-slate-200">{statusLabels[post.status]}</span>
                        <span className="rounded-full bg-white/10 px-3 py-1 text-slate-300">{post.category?.name || "Kategori yok"}</span>
                        <span className="rounded-full bg-cyan-300/10 px-3 py-1 text-cyan-100">{post.primary_keyword || "Ana kelime yok"}</span>
                        <span className={`rounded-full border px-3 py-1 ${scoreTone(post.seo_score)}`}>SEO {post.seo_score}</span>
                        <span className={`rounded-full border px-3 py-1 ${scoreTone(post.readability_score)}`}>Okuma {post.readability_score}</span>
                      </div>
                    </div>
                    <div className="flex items-start justify-end gap-2"><button type="button" onClick={() => { setDraft(toDraft(post)); setSlugTouched(false); }} className="rounded-xl border border-cyan-200/20 p-2 text-cyan-100 hover:bg-cyan-300/10" aria-label="Düzenle"><Edit3 size={16} /></button><Link href={`/blog/${post.slug}`} target="_blank" className="rounded-xl border border-white/10 p-2 text-slate-200 hover:bg-white/10" aria-label="Public sayfayı aç"><FileText size={16} /></Link><button type="button" onClick={() => archivePost(post)} className="rounded-xl border border-rose-200/20 p-2 text-rose-100 hover:bg-rose-400/10" aria-label="Arşivle"><Archive size={16} /></button></div>
                  </article>
                ))}
                {!loading && !filtered.length ? <EmptyNotice title="Henüz blog yazısı bulunmuyor" text="Filtreyi değiştirin veya AI ile ilk taslağı oluşturun." icon={<FileText />} /> : null}
              </div>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.045] p-5">
              <h2 className="text-xl font-black">Arama niyeti konu haritası</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">{contentIntentMap.map((item) => <div key={item.phrase} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4"><p className="text-xs font-black uppercase tracking-[.14em] text-cyan-200">{item.cluster}</p><p className="mt-2 font-black text-white">{item.phrase}</p><p className="mt-3 text-sm text-slate-400">{item.intent} · {item.contentType}</p><p className="mt-2 text-sm text-slate-300">İlişkili hizmet: {item.relatedService}</p></div>)}</div>
            </div>
          </div>
          <aside className="rounded-[24px] border border-white/10 bg-white/[0.055] p-5 2xl:sticky 2xl:top-6 2xl:max-h-[calc(100vh-3rem)] 2xl:overflow-y-auto">
            <h2 className="text-xl font-black">{draft.id ? "Yazıyı düzenle" : "Yeni yazı"}</h2>
            <div className="mt-5 grid gap-3">
              <label className="grid gap-2 text-sm font-bold text-slate-300">Başlık<input value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} className="min-h-11 rounded-2xl border border-white/10 bg-slate-950/70 px-3 text-white outline-none focus:border-cyan-300" /></label>
              <label className="grid gap-2 text-sm font-bold text-slate-300">Slug<input value={draft.slug} onChange={(event) => updateDraft("slug", slugifyBlogValue(event.target.value))} className="min-h-11 rounded-2xl border border-white/10 bg-slate-950/70 px-3 text-white outline-none focus:border-cyan-300" /></label>
              <label className="grid gap-2 text-sm font-bold text-slate-300">Özet<textarea value={draft.excerpt} onChange={(event) => updateDraft("excerpt", event.target.value)} rows={3} className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-white outline-none focus:border-cyan-300" /></label>
              <label className="grid gap-2 text-sm font-bold text-slate-300">İçerik<textarea value={draft.content} onChange={(event) => updateDraft("content", event.target.value)} rows={18} className="min-h-[520px] rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 font-mono text-sm leading-6 text-white outline-none focus:border-cyan-300" /></label>
              <label className="grid gap-2 text-sm font-bold text-slate-300">Durum<select value={draft.status} onChange={(event) => updateDraft("status", event.target.value)} className="min-h-11 rounded-2xl border border-white/10 bg-slate-950/70 px-3 text-white outline-none focus:border-cyan-300">{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
              <label className="grid gap-2 text-sm font-bold text-slate-300">Planlanan yayın zamanı<input type="datetime-local" value={draft.scheduled_at ? draft.scheduled_at.slice(0, 16) : ""} onChange={(event) => updateDraft("scheduled_at", event.target.value)} className="min-h-11 rounded-2xl border border-white/10 bg-slate-950/70 px-3 text-white outline-none focus:border-cyan-300" /></label>
              <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/55 p-3 text-sm font-bold text-slate-300"><input type="checkbox" checked={Boolean(draft.approved_for_publish)} onChange={(event) => updateDraft("approved_for_publish", event.target.checked)} className="mt-1 h-4 w-4" /><span><span className="block text-white">Yayın için insan onayı verildi</span><span className="mt-1 block text-xs leading-5 text-slate-400">Zamanlanmış yayın endpoint’i yalnız bu onay açık ve zamanı gelmiş içerikleri yayınlar.</span></span></label>
              <label className="grid gap-2 text-sm font-bold text-slate-300">Kategori<select value={draft.category_id || draft.category?.id || ""} onChange={(event) => updateDraft("category_id", event.target.value)} className="min-h-11 rounded-2xl border border-white/10 bg-slate-950/70 px-3 text-white outline-none focus:border-cyan-300"><option value="">Kategori seç</option>{categories.map((category) => <option key={category.id || category.slug} value={category.id || ""}>{category.name}</option>)}</select></label>
              <label className="grid gap-2 text-sm font-bold text-slate-300">Ana hedef kelime<input value={draft.primary_keyword} onChange={(event) => updateDraft("primary_keyword", event.target.value)} className="min-h-11 rounded-2xl border border-white/10 bg-slate-950/70 px-3 text-white outline-none focus:border-cyan-300" /></label>
              <label className="grid gap-2 text-sm font-bold text-slate-300">İkincil kelimeler<input value={draft.secondary_keywords_text} onChange={(event) => updateDraft("secondary_keywords_text", event.target.value)} placeholder="Virgülle ayırın" className="min-h-11 rounded-2xl border border-white/10 bg-slate-950/70 px-3 text-white outline-none focus:border-cyan-300" /></label>
              <label className="grid gap-2 text-sm font-bold text-slate-300">Meta title<input value={draft.meta_title} onChange={(event) => updateDraft("meta_title", event.target.value)} className="min-h-11 rounded-2xl border border-white/10 bg-slate-950/70 px-3 text-white outline-none focus:border-cyan-300" /></label>
              <label className="grid gap-2 text-sm font-bold text-slate-300">Meta description<textarea value={draft.meta_description} onChange={(event) => updateDraft("meta_description", event.target.value)} rows={3} className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-white outline-none focus:border-cyan-300" /></label>
              <label className="grid gap-2 text-sm font-bold text-slate-300">Canonical URL<input value={draft.canonical_url || ""} onChange={(event) => updateDraft("canonical_url", event.target.value)} className="min-h-11 rounded-2xl border border-white/10 bg-slate-950/70 px-3 text-white outline-none focus:border-cyan-300" /></label>
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <p className="font-black text-white">Görsel hazırlığı</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">AI görsel provider doğrulanmadığı için sahte görsel üretilmez; URL ve alt metin manuel veya mevcut medya yükleme akışıyla girilir.</p>
                <label className="mt-3 grid gap-2 text-sm font-bold text-slate-300">Kapak görseli URL<input value={draft.cover_image_url || ""} onChange={(event) => updateDraft("cover_image_url", event.target.value)} className="min-h-11 rounded-2xl border border-white/10 bg-slate-950/70 px-3 text-white outline-none focus:border-cyan-300" /></label>
                <label className="mt-3 grid gap-2 text-sm font-bold text-slate-300">Alt metin<input value={draft.cover_image_alt || ""} onChange={(event) => updateDraft("cover_image_alt", event.target.value)} className="min-h-11 rounded-2xl border border-white/10 bg-slate-950/70 px-3 text-white outline-none focus:border-cyan-300" /></label>
              </div>
            </div>
            {cannibalization.length ? <div className="mt-4 rounded-2xl border border-yellow-300/20 bg-yellow-300/10 p-4 text-sm text-yellow-100">Bu ana hedef başka yazıda da kullanılıyor: {cannibalization.map((post) => post.title).join(", ")}</div> : null}
            {analysis.word_count > 0 && analysis.word_count < minWordsForLengthLabel(agent.length) ? <div className="mt-4 rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100">Seçili uzunluk hedefi için içerik kısa görünüyor: {analysis.word_count}/{minWordsForLengthLabel(agent.length)} kelime. “Taslağı genişlet” aksiyonunu kullanın.</div> : null}
            <div className="mt-5 grid gap-3 rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-black text-white">Yayına hazırlık analizi</p>
                <span className={`rounded-full border px-3 py-1 text-xs font-black ${scoreTone(analysis.readiness_score)}`}>Hazırlık {analysis.readiness_score}</span>
              </div>
              <p>Kelime: {analysis.word_count} · Okuma: {analysis.reading_time} dk · H2: {analysis.headings.h2} · H3: {analysis.headings.h3}</p>
              <p>SEO {analysis.seo_score} · Tahmini Türkçe okunabilirlik {analysis.subScores.readabilityLocal} · Anahtar kelime {analysis.subScores.keywordScore}</p>
              <p>İç bağlantı: {analysis.internalLinks} · Dış bağlantı: {analysis.externalLinks} · Görsel: {analysis.imageCount} · Uzun paragraf: {analysis.longParagraphs} · Uzun cümle: {analysis.longSentences}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {Object.entries({ "Teknik SEO": analysis.subScores.technicalScore, "İçerik kapsamı": analysis.subScores.coverageScore, "Anahtar kelime": analysis.subScores.keywordScore, "Okunabilirlik": analysis.subScores.readabilityLocal, "Bağlantılar": analysis.subScores.linkScore, "Görsel hazırlığı": analysis.subScores.visualScore }).map(([label, value]) => <p key={label} className="rounded-xl bg-white/5 p-2 text-xs font-bold text-slate-300"><span className="block text-slate-500">{label}</span>{value}/100</p>)}
              </div>
              <p className="rounded-xl border border-cyan-200/15 bg-cyan-300/10 p-3 text-xs leading-5 text-cyan-100">Dış kaynak doğrulama entegrasyonu bulunmadığı için AI’den sahte URL istenmez. Dış kaynak gerekiyorsa manuel ve doğrulanmış URL ekleyin.</p>
              {analysis.critical.length ? <div className="rounded-xl border border-rose-300/20 bg-rose-400/10 p-3"><p className="font-black text-rose-100">Kritik eksikler</p>{analysis.critical.map((item) => <p key={item} className="mt-1 text-rose-100">• {item}</p>)}</div> : null}
              {analysis.improvements.length ? <div className="rounded-xl border border-yellow-300/20 bg-yellow-300/10 p-3"><p className="font-black text-yellow-100">İyileştirme önerileri</p>{analysis.improvements.slice(0, 8).map((item) => <p key={item} className="mt-1 text-yellow-100">• {item}</p>)}</div> : null}
              {analysis.passed.length ? <div className="rounded-xl border border-emerald-300/20 bg-emerald-400/10 p-3"><p className="font-black text-emerald-100">Başarılı kontroller</p>{analysis.passed.slice(0, 8).map((item) => <p key={item} className="mt-1 text-emerald-100">• {item}</p>)}</div> : null}
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2"><button type="button" disabled={saving} onClick={() => savePost()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-4 text-sm font-black text-slate-950 disabled:opacity-60">{saving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />} Taslak Kaydet</button><button type="button" disabled={saving} onClick={() => savePost("published")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 text-sm font-black text-slate-950 disabled:opacity-60"><Send size={16} /> Yayınla</button></div>
            {draft.status === "published" && draft.slug ? <Link href={`/blog/${draft.slug}`} target="_blank" className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-emerald-200/25 bg-emerald-400/10 px-4 text-sm font-black text-emerald-100 hover:bg-emerald-400/15"><FileText size={16} /> Public blog yazısını aç</Link> : null}
          </aside>
        </section>
        </> : null}
        {activeTab === "plan" ? <section className="mt-8 grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.055] p-5">
            <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-cyan-200"><CalendarDays size={16} /> Otonom plan</p>
            <h2 className="mt-2 text-xl font-black">Haftalık içerik planı</h2>
            <div className="mt-5 grid gap-3">
              <label className="grid gap-2 text-sm font-bold text-slate-300">Plan adı<input value={planForm.name} onChange={(event) => setPlanForm({ ...planForm, name: event.target.value })} className="min-h-11 rounded-2xl border border-white/10 bg-slate-950/70 px-3 text-white outline-none focus:border-cyan-300" /></label>
              <label className="grid gap-2 text-sm font-bold text-slate-300">İçerik hedefi<textarea value={planForm.objective} onChange={(event) => setPlanForm({ ...planForm, objective: event.target.value })} rows={3} className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-white outline-none focus:border-cyan-300" /></label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-bold text-slate-300">Haftalık yazı<input type="number" min={1} max={14} value={planForm.weeklyCount} onChange={(event) => setPlanForm({ ...planForm, weeklyCount: event.target.value })} className="min-h-11 rounded-2xl border border-white/10 bg-slate-950/70 px-3 text-white outline-none focus:border-cyan-300" /></label>
                <label className="grid gap-2 text-sm font-bold text-slate-300">Saat<input type="time" value={planForm.preferredTime} onChange={(event) => setPlanForm({ ...planForm, preferredTime: event.target.value })} className="min-h-11 rounded-2xl border border-white/10 bg-slate-950/70 px-3 text-white outline-none focus:border-cyan-300" /></label>
                <label className="grid gap-2 text-sm font-bold text-slate-300">Başlangıç<input type="date" value={planForm.startDate} onChange={(event) => setPlanForm({ ...planForm, startDate: event.target.value })} className="min-h-11 rounded-2xl border border-white/10 bg-slate-950/70 px-3 text-white outline-none focus:border-cyan-300" /></label>
                <label className="grid gap-2 text-sm font-bold text-slate-300">Bitiş<input type="date" value={planForm.endDate} onChange={(event) => setPlanForm({ ...planForm, endDate: event.target.value })} className="min-h-11 rounded-2xl border border-white/10 bg-slate-950/70 px-3 text-white outline-none focus:border-cyan-300" /></label>
              </div>
              <label className="grid gap-2 text-sm font-bold text-slate-300">Hariç tutulacak kelimeler<input value={planForm.excludedKeywords} onChange={(event) => setPlanForm({ ...planForm, excludedKeywords: event.target.value })} placeholder="Virgülle ayırın" className="min-h-11 rounded-2xl border border-white/10 bg-slate-950/70 px-3 text-white outline-none focus:border-cyan-300" /></label>
              <label className="grid gap-2 text-sm font-bold text-slate-300">Rakip notu veya domain<textarea value={planForm.competitorNotes} onChange={(event) => setPlanForm({ ...planForm, competitorNotes: event.target.value })} rows={3} className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-white outline-none focus:border-cyan-300" /></label>
              <div className="rounded-2xl border border-amber-200/20 bg-amber-300/10 p-3 text-sm text-amber-100">Otomatik yayın kapalıdır. Plan öğeleri taslak olarak üretilir ve insan onayı olmadan yayınlanmaz.</div>
              <div className="flex flex-wrap gap-2">
                <HKButton type="button" variant="ai" loading={agentBusy === "weekly_plan"} disabled={Boolean(agentBusy)} onClick={generateWeeklyPlan} icon={<Sparkles size={16} />}>Haftalık plan oluştur</HKButton>
                <HKButton type="button" variant="success" loading={saving} disabled={!planItems.length || saving} onClick={savePlan} icon={<CheckCircle2 size={16} />}>Planı kaydet</HKButton>
              </div>
            </div>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/[0.045] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-black">Plan öğeleri</h2><span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-slate-200">{savedPlans.length} kayıtlı plan</span></div>
            {planItems.length ? <div className="mt-4 grid gap-3">{planItems.map((item) => <article key={item.slug} className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-black text-white">{item.title}</p><p className="mt-1 text-xs font-bold text-cyan-100">{item.primary_keyword || "Ana kelime yok"} · {item.search_intent}</p></div><span className="rounded-full bg-violet-400/15 px-3 py-1 text-xs font-black text-violet-100">{item.priority}</span></div>
              <p className="mt-3 text-sm leading-6 text-slate-300">{item.rationale || "Gerekçe AI tarafından kısa tutuldu."}</p>
              <div className="mt-3 flex flex-wrap gap-2">{item.source_signals.map((signal) => <span key={signal} className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-black text-slate-200">{signal}</span>)}</div>
              <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => generateDraftFromPlanItem(item)} disabled={Boolean(agentBusy)} className="min-h-10 rounded-xl bg-violet-600 px-3 text-xs font-black text-white disabled:opacity-60">Bu taslağı üret</button><button type="button" onClick={() => applySuggestion({ title: item.title, primaryKeyword: item.primary_keyword, secondaryKeywords: item.secondary_keywords, searchIntent: item.search_intent, targetAudience: item.target_audience, angle: item.rationale })} className="min-h-10 rounded-xl border border-cyan-200/25 px-3 text-xs font-black text-cyan-100">Forma aktar</button></div>
            </article>)}</div> : <EmptyNotice icon={<CalendarDays />} title="Henüz içerik planı yok" text="Plan oluşturmak için sol taraftaki brief alanlarını doldurun. Search Console veya Trends bağlı değilse sahte kaynak etiketi kullanılmaz." />}
          </div>
        </section> : null}
        {activeTab === "calendar" ? <section className="mt-8 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.045] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.16em] text-cyan-200">Takvim</p><h2 className="mt-2 text-xl font-black">Planlanan ve yayınlanan içerikler</h2></div><HKButton type="button" variant="neutral" onClick={loadData} icon={<RefreshCw size={16} />}>Yenile</HKButton></div>
            <div className="mt-4 rounded-[12px] bg-white p-2">
              <AdminDataGrid columns={calendarColumns} rows={calendarPosts} rowKey={(post: any) => post.id || post.slug} activeId={selectedCalendarSlug} onRowClick={(post: any) => setSelectedCalendarSlug(post.slug)} emptyTitle="Takvimde içerik yok." emptyDescription="Taslak veya planlanan yazılar burada listelenir." />
            </div>
          </div>
          <aside className="rounded-[24px] border border-white/10 bg-white/[0.055] p-5">
            <h2 className="text-lg font-black text-white">Seçili İçerik</h2>
            {selectedCalendarPost ? <div className="mt-4 grid gap-2 text-sm text-slate-300">
              <p className="font-black text-white">{selectedCalendarPost.title}</p>
              <p>Durum: {statusLabels[selectedCalendarPost.status]}</p>
              <p>Tarih: {selectedCalendarPost.scheduled_at || selectedCalendarPost.published_at ? new Date(selectedCalendarPost.scheduled_at || selectedCalendarPost.published_at || "").toLocaleString("tr-TR") : "Tarih yok"}</p>
              <button type="button" onClick={() => { setDraft(toDraft(selectedCalendarPost)); setSlugTouched(false); selectTab("editor"); }} className="mt-2 min-h-10 rounded-xl border border-cyan-200/25 px-3 text-xs font-black text-cyan-100">Editörde Aç</button>
            </div> : <p className="mt-4 text-sm text-slate-400">Listeden bir içerik seçin. Bir öğeyi açmak yeniden AI üretimi tetiklemez.</p>}
          </aside>
        </section> : null}
        {activeTab === "links" ? <section className="mt-8 grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.045] p-5">
            <div><p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-cyan-200"><Link2 size={16} /> İç bağlantılar</p><h2 className="mt-2 text-xl font-black">Akıllı iç bağlantı önerileri</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">Öneriler yayınlanmış yazı başlıkları, anahtar kelimeleri ve mevcut içerikteki ifadelerle deterministik çıkarılır. Onaylamadan kayıtlı içerik değişmez.</p></div>
            {linkPreview ? <div className="mt-4 rounded-2xl border border-cyan-200/20 bg-cyan-300/10 p-4 text-sm text-cyan-100">Önizleme forma aktarıldı: {linkPreview.suggestion.sourceTitle} → {linkPreview.suggestion.targetTitle}</div> : null}
            <div className="mt-4 rounded-[12px] bg-white p-2">
              <AdminDataGrid columns={linkColumns} rows={internalLinkSuggestions} rowKey={(item: any) => item.id} activeId={selectedLinkId} onRowClick={(item: any) => setSelectedLinkId(item.id)} emptyTitle="İç bağlantı önerisi bulunamadı." emptyDescription="Yayınlanmış yazı sayısı veya anahtar kelime eşleşmesi yetersiz olabilir." />
            </div>
          </div>
          <aside className="rounded-[24px] border border-white/10 bg-white/[0.055] p-5">
            <h2 className="text-lg font-black text-white">Seçili Öneri</h2>
            {selectedLink ? <div className="mt-4 grid gap-2 text-sm text-slate-300">
              <p><strong className="text-white">Kaynak:</strong> {selectedLink.sourceTitle}</p>
              <p><strong className="text-white">Hedef:</strong> {selectedLink.targetTitle}</p>
              <p>Anchor: <strong className="text-cyan-100">{selectedLink.anchorText}</strong></p>
              <p>{selectedLink.reason}</p>
              <button type="button" disabled={selectedLink.alreadyLinked} onClick={() => applyLinkSuggestion(selectedLink)} className="mt-2 min-h-10 rounded-xl border border-cyan-200/25 px-3 text-xs font-black text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50">Önizle ve forma uygula</button>
            </div> : <p className="mt-4 text-sm text-slate-400">Listeden bir öneri seçin.</p>}
          </aside>
        </section> : null}
        {activeTab === "social" ? <section className="mt-8 grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.055] p-5"><p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-cyan-200"><Share2 size={16} /> Sosyal medya</p><h2 className="mt-2 text-xl font-black">Blogdan sosyal paket üret</h2><label className="mt-5 grid gap-2 text-sm font-bold text-slate-300">Blog yazısı<select value={selectedSocialPost?.slug || ""} onChange={(event) => setSelectedSocialSlug(event.target.value)} className="min-h-11 rounded-2xl border border-white/10 bg-slate-950/70 px-3 text-white outline-none focus:border-cyan-300">{posts.map((post) => <option key={post.slug} value={post.slug}>{post.title}</option>)}</select></label><HKButton type="button" className="mt-4" variant="ai" loading={agentBusy === "social_package"} disabled={Boolean(agentBusy) || !selectedSocialPost} onClick={generateSocialPackage} icon={<Sparkles size={16} />}>Sosyal medya taslağı üret</HKButton><p className="mt-4 rounded-2xl border border-amber-200/20 bg-amber-300/10 p-3 text-sm text-amber-100">Gerçek paylaşım yapılmaz. Çıktılar kopyalanabilir taslaktır.</p></div>
          <div className="rounded-[24px] border border-white/10 bg-white/[0.045] p-5">{socialPackage ? <div className="space-y-4">{Object.entries(socialPackage).map(([platform, value]) => <article key={platform} className="rounded-2xl border border-white/10 bg-slate-950/35 p-4"><h3 className="font-black capitalize text-white">{platform}</h3><pre className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-300">{typeof value === "string" ? value : JSON.stringify(value, null, 2)}</pre></article>)}<button type="button" onClick={() => navigator.clipboard.writeText(formatSocialPackageText(socialPackage))} className="min-h-11 rounded-2xl bg-cyan-300 px-4 text-sm font-black text-slate-950">Tüm paketi kopyala</button></div> : <EmptyNotice icon={<Share2 />} title="Sosyal medya taslağı yok" text="Bir blog yazısı seçip AI ile taslak paketi üretin. Platform paylaşımı otomatik yapılmaz." />}</div>
        </section> : null}
        {activeTab === "performance" ? <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.045] p-5"><p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-cyan-200"><BarChart3 size={16} /> Performans</p><h2 className="mt-2 text-xl font-black">Güncellenmesi gereken içerikler</h2><p className="mt-2 text-sm leading-6 text-slate-300">Search Console/GA4 bağlı olmadığında sahte trafik metriği gösterilmez. Bu liste mevcut blog kalite sinyalleriyle deterministik hazırlanır.</p>
            <div className="mt-4 rounded-[12px] bg-white p-2">
              <AdminDataGrid columns={opportunityColumns} rows={performanceOpportunities} rowKey={(item: any) => `${item.slug}-${item.issue}`} activeId={selectedOpportunityKey} onRowClick={(item: any) => setSelectedOpportunityKey(`${item.slug}-${item.issue}`)} emptyTitle="Kritik güncelleme sinyali yok." emptyDescription="Mevcut yazılar deterministik kalite kontrollerinden geçti." />
            </div>
          </div>
          <aside className="rounded-[24px] border border-white/10 bg-white/[0.055] p-5">
            <h2 className="text-xl font-black">AI güncelleme planı</h2>
            {selectedOpportunity && <div className="mt-3 rounded-xl border border-amber-200/20 bg-amber-300/10 p-3 text-xs text-amber-100"><p className="font-black">{selectedOpportunity.title}</p><p className="mt-1">{selectedOpportunity.evidence}</p><p className="mt-1 text-cyan-100">{selectedOpportunity.action}</p></div>}
            <label className="mt-4 grid gap-2 text-sm font-bold text-slate-300">Yazı<select value={selectedPerformancePost?.slug || ""} onChange={(event) => setSelectedPerformanceSlug(event.target.value)} className="min-h-11 rounded-2xl border border-white/10 bg-slate-950/70 px-3 text-white outline-none focus:border-cyan-300">{posts.map((post) => <option key={post.slug} value={post.slug}>{post.title}</option>)}</select></label><HKButton type="button" className="mt-4" variant="ai" loading={agentBusy === "update_plan"} disabled={Boolean(agentBusy) || !selectedPerformancePost} onClick={generateUpdatePlan} icon={<Wand2 size={16} />}>Güncelleme planı oluştur</HKButton>{updatePlan ? <pre className="mt-4 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm leading-6 text-slate-300">{JSON.stringify(updatePlan, null, 2)}</pre> : <p className="mt-4 text-sm leading-6 text-slate-400">Öneri oluşturulduğunda burada görünür. Kayıtlı içerik otomatik değişmez.</p>}</aside>
        </section> : null}
        {activeTab === "integrations" ? <section className="mt-8 grid gap-4 lg:grid-cols-2">
          <IntegrationCard title="Search Console" status="Bağlı veri kaynağı doğrulanmadı" text="Kod tabanında müşteri Google OAuth ve Search Console alanları var; Blog & SEO için gerçek Search Console sorgu endpoint’i bulunmadığı için sahte metrik gösterilmiyor." href="/hk-admin/google-integrations" />
          <IntegrationCard title="Google Trends" status="Resmi veri kaynağı yok" text="Projede yasal ve gerçek Google Trends adapter’ı bulunmadı. Scraping eklenmedi ve sahte trend skoru üretilmedi." />
          <IntegrationCard title="GA4 / Analytics" status="Bağlantı alanları mevcut" text="GA4 property bilgileri müşteri entegrasyonlarında tutulabiliyor; Blog & SEO performans sekmesinde canlı GA4 metriği için ayrı server-side veri adapter’ı gerekir." href="/hk-admin/google-integrations" />
          <IntegrationCard title="AI Kapak Görseli" status="Provider yok" text="Mevcut HK Intelligence Router metin tabanlı sağlayıcılarla çalışıyor. Görsel üretim provider’ı doğrulanmadığı için sahte görsel üretimi eklenmedi." />
          <IntegrationCard title="Rakip Analizi" status="Mevcut modül var" text="Rakip watchlist ve sinyal altyapısı mevcut. Bu sprintte rakip metni crawl edilmedi; plan brief’inde manuel rakip notu kullanılabilir." href="/hk-admin/rakip-analizi" />
          <IntegrationCard title="Zamanlanmış Yayın" status="Cron endpoint hazır" text="Gizli token ile çalışan publish-due endpoint’i eklendi. Onaylanmamış veya zamanı gelmemiş yazılar yayınlanmaz." />
        </section> : null}
      </div>
    </AdminWorkspace>
  );
}

function EmptyNotice({ title, text, icon }: { title: string; text: string; icon?: ReactNode }) {
  return <div className="mt-5 rounded-2xl border border-dashed border-white/15 bg-slate-950/35 p-6 text-center text-slate-300">{icon ? <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-cyan-100">{icon}</div> : null}<h3 className="font-black text-white">{title}</h3><p className="mt-2 text-sm leading-6">{text}</p></div>;
}

function IntegrationCard({ title, status, text, href }: { title: string; status: string; text: string; href?: string }) {
  return <article className="rounded-[24px] border border-white/10 bg-white/[0.045] p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-black text-white">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-300">{text}</p></div><span className="rounded-full bg-amber-300/10 px-3 py-1 text-xs font-black text-amber-100">{status}</span></div>{href ? <Link href={href} className="mt-4 inline-flex min-h-10 items-center justify-center rounded-xl border border-cyan-200/25 px-3 text-sm font-black text-cyan-100 hover:bg-cyan-300/10">İlgili ayara git</Link> : <div className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-sm font-black text-slate-300"><ShieldAlert size={16} /> Manuel yapılandırma gerekli</div>}</article>;
}
