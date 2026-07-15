"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Archive, Bot, CheckCircle2, Edit3, FileText, Loader2, Plus, RefreshCw, Search, Send, Sparkles, Wand2 } from "lucide-react";
import { HKButton, HKPageHeader } from "@/components/admin/HKDesignSystem";
import { analyzeBlogPost, blogCategories, contentIntentMap, seedBlogPosts, slugifyBlogValue, type BlogCategory, type BlogPost, type BlogStatus } from "@/lib/blog-seo-shared";
import { servicePages } from "@/lib/public-seo-content";

const statusLabels: Record<BlogStatus, string> = { draft: "Taslak", review: "İncelemede", scheduled: "Planlandı", published: "Yayında", archived: "Arşiv" };
const intentOptions = ["Bilgilendirici", "Ticari araştırma", "Hizmet arama", "Yerel arama", "Karşılaştırma", "Sorun çözme"];
const contentTypeOptions = ["Rehber", "Hizmet açıklaması", "Kontrol listesi", "Karşılaştırma", "Sık sorulan sorular", "Yerel SEO yazısı", "Vaka odaklı içerik"];
const toneOptions = ["Profesyonel", "Açıklayıcı", "Güven veren", "Sade", "Satış odaklı fakat abartısız"];
const lengthOptions = ["Kısa: 700–900 kelime", "Standart: 1000–1400 kelime", "Derin rehber: 1600–2200 kelime"];
const serviceOptions = [
  ...servicePages.map((service) => ({ label: service.eyebrow, href: `/hizmetler/${service.slug}` })),
  { label: "Manisa Dijital Pazarlama", href: "/manisa-dijital-pazarlama" }
];

type DraftPost = Omit<BlogPost, "content_format" | "secondary_keywords" | "reading_time" | "word_count" | "seo_score" | "readability_score" | "clarity_score" | "content_quality_score"> & {
  secondary_keywords_text: string;
};

const emptyPost: DraftPost = {
  id: undefined,
  title: "", slug: "", excerpt: "", content: "", status: "draft" as BlogStatus, author_name: "Hayri Kamalı",
  cover_image_url: "", cover_image_alt: "", category_id: "", primary_keyword: "", secondary_keywords_text: "",
  search_intent: "", target_location: "", meta_title: "", meta_description: "", canonical_url: "", og_title: "",
  og_description: "", og_image_url: "", featured: false, allow_indexing: true, published_at: "", scheduled_at: "", category: null,
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
  const internalLinks = (draft.content.match(/\]\(\/(?!\/)/g) || []).length;
  const externalLinks = (draft.content.match(/\]\(https?:\/\//g) || []).length;
  const paragraphs = draft.content.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  const longParagraphs = paragraphs.filter((item) => item.split(/\s+/).length > 95).length;
  const headingLabels = draft.content.split("\n").filter((line) => /^#{2,3}\s+/.test(line)).map((line) => line.replace(/^#{2,3}\s+/, "").toLocaleLowerCase("tr"));
  const repeatedHeadings = headingLabels.filter((item, index) => headingLabels.indexOf(item) !== index);
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
    internalLinks < 1 ? "En az bir doğrulanmış iç bağlantı ekleyin." : "",
    externalLinks < 1 ? "Güvenilir dış kaynak veya platform dokümanı bağlantısı yok." : "",
    !draft.cover_image_alt ? "Kapak görseli varsa alt metin ekleyin." : "",
    longParagraphs ? `${longParagraphs} paragraf çok uzun; bölmeyi düşünün.` : "",
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
  const readiness = Math.max(0, Math.min(100, Math.round((base.seo_score + base.readability_score + base.clarity_score) / 3) - critical.length * 8 - improvements.length * 2));
  return { ...base, headings, internalLinks, externalLinks, longParagraphs, critical, improvements, passed, readiness_score: readiness };
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
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [categories, setCategories] = useState<BlogCategory[]>(blogCategories);
  const [draft, setDraft] = useState<DraftPost>({ ...emptyPost });
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
  const [suggestions, setSuggestions] = useState<TopicSuggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<TopicSuggestion | null>(null);
  const [aiDraft, setAiDraft] = useState<AiDraft | null>(null);
  const [improvement, setImprovement] = useState<Improvement | null>(null);

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
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

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

  const cannibalization = posts.filter((post) => post.id !== draft.id && draft.primary_keyword && post.primary_keyword.toLocaleLowerCase("tr") === draft.primary_keyword.toLocaleLowerCase("tr"));

  function updateDraft(key: keyof DraftPost, value: string | boolean) {
    setDraft((current) => {
      const next = { ...current, [key]: value };
      if (key === "title" && !current.id) {
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
      allow_indexing: current.allow_indexing
    }));
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

  async function runAgent(action: "topic_suggestions" | "generate_draft" | "improve_draft", extra: Record<string, unknown> = {}) {
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
          existingTitles: posts.map((post) => post.title),
          existingSlugs: posts.map((post) => post.slug),
          currentDraft: draft
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "AI işlemi tamamlanamadı.");
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

  async function savePost(nextStatus?: BlogStatus) {
    if (saving) return;
    const targetStatus = nextStatus || draft.status;
    if (targetStatus === "published") {
      if (analysis.critical.length && !confirm(`Kritik eksikler var:\n\n${analysis.critical.join("\n")}\n\nYine de yayınlamak istiyor musunuz?`)) return;
      if (!confirm("Bu yazı public blogda yayınlanacak. Onaylıyor musunuz?")) return;
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

  return (
    <main className="min-h-screen bg-[#050711] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <HKPageHeader
          eyebrow="İçerik ve AI"
          title="Blog & SEO Merkezi"
          description="Blog yazıları, arama niyeti haritası, içerik takvimi ve açıklanabilir SEO kalite kontrolleri."
          action={<HKButton type="button" onClick={() => setDraft({ ...emptyPost })} icon={<Plus size={16} />}>Yeni yazı</HKButton>}
        />
        {message ? <div className="mt-5 rounded-2xl border border-cyan-200/20 bg-cyan-300/10 px-4 py-3 text-sm font-bold text-cyan-100">{message}</div> : null}
        <section className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[["Toplam yazı", metrics.total], ["Yayında", metrics.published], ["Taslak", metrics.draft], ["İncelemede", metrics.review], ["Planlanan", metrics.scheduled], ["Ortalama SEO", metrics.avgSeo], ["Okunabilirlik", metrics.avgReadability], ["Güncelleme önerisi", metrics.updateNeeded]].map(([label, value]) => <div key={label} className="rounded-[20px] border border-white/10 bg-white/[0.045] p-5"><p className="text-sm font-bold text-slate-400">{label}</p><p className="mt-2 text-3xl font-black text-white">{value}</p></div>)}
        </section>
        <section className="mt-8 rounded-[28px] border border-cyan-200/15 bg-gradient-to-br from-cyan-300/10 via-white/[0.045] to-violet-400/10 p-5 shadow-[0_28px_90px_rgba(8,145,178,.08)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-cyan-200"><Bot size={16} /> AI İçerik Agentı</p>
              <h2 className="mt-2 text-2xl font-black text-white">Konu araştır, taslak üret, SEO kontrolü yap</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">AI yalnız taslak ve öneri üretir. Yayınlama mevcut blog akışı ve admin onayıyla ayrı yapılır.</p>
            </div>
            <span className="rounded-full border border-emerald-200/20 bg-emerald-300/10 px-3 py-1 text-xs font-black text-emerald-100">Provider: HK Intelligence Router</span>
          </div>
          {agentError ? <p className="mt-4 rounded-2xl border border-rose-300/25 bg-rose-400/10 p-3 text-sm font-bold text-rose-100">{agentError}</p> : null}
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
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-black"><span className="rounded-full bg-white/10 px-2 py-1 text-slate-200">{item.searchIntent || agent.intent}</span><span className="rounded-full bg-amber-300/15 px-2 py-1 text-amber-100">Çakışma: {item.duplicateRisk || "Kontrol edildi"}</span></div>
                <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => applySuggestion(item)} className="min-h-10 rounded-xl border border-cyan-200/25 px-3 text-xs font-black text-cyan-100 hover:bg-cyan-300/10">Bu konuyu kullan</button><button type="button" disabled={Boolean(agentBusy)} onClick={() => applySuggestion(item, true)} className="min-h-10 rounded-xl bg-violet-600 px-3 text-xs font-black text-white disabled:opacity-60">Taslak oluştur</button></div>
              </article>)}</div>
            </div> : null}
            <div className="space-y-3">
              {aiDraft ? <div className="rounded-2xl border border-violet-200/20 bg-violet-400/10 p-4"><h3 className="font-black text-white">AI taslak özeti</h3><p className="mt-2 text-sm font-bold text-violet-100">{aiDraft.title}</p><p className="mt-2 text-xs leading-5 text-slate-300">{aiDraft.metaDescription}</p><button type="button" onClick={() => applyAiDraft()} className="mt-3 min-h-10 rounded-xl bg-violet-600 px-3 text-xs font-black text-white">Taslağı forma uygula</button></div> : null}
              {improvement ? <div className="rounded-2xl border border-emerald-200/20 bg-emerald-400/10 p-4"><h3 className="font-black text-white">Geliştirme önerisi</h3><div className="mt-2 grid gap-1 text-xs text-emerald-100">{(improvement.changeSummary || improvement.qualityNotes || []).slice(0, 5).map((item) => <p key={item}>• {item}</p>)}</div><button type="button" onClick={applyImprovement} className="mt-3 min-h-10 rounded-xl bg-emerald-600 px-3 text-xs font-black text-white">Öneriyi forma uygula</button></div> : null}
            </div>
          </div> : null}
        </section>
        <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
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
              <div className="mt-5 overflow-x-auto">
                <table className="min-w-[900px] w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-[.14em] text-slate-500"><tr><th className="py-3">Başlık</th><th>Durum</th><th>Kategori</th><th>Ana kelime</th><th>SEO</th><th>Okunabilirlik</th><th className="text-right">İşlem</th></tr></thead>
                  <tbody className="divide-y divide-white/10">
                    {loading ? <tr><td colSpan={7} className="py-8 text-center text-slate-400"><Loader2 className="mx-auto mb-2 animate-spin" /> Yazılar yükleniyor</td></tr> : filtered.map((post) => (
                      <tr key={post.id || post.slug} className="align-top">
                        <td className="py-4"><p className="max-w-md font-black text-white">{post.title}</p><p className="mt-1 text-xs text-slate-500">/{post.slug}</p></td>
                        <td><span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-slate-200">{statusLabels[post.status]}</span></td>
                        <td className="text-slate-300">{post.category?.name || "Kategori yok"}</td>
                        <td className="max-w-[180px] text-slate-300">{post.primary_keyword || "Belirtilmedi"}</td>
                        <td><span className={`rounded-full border px-3 py-1 text-xs font-black ${scoreTone(post.seo_score)}`}>{post.seo_score}</span></td>
                        <td><span className={`rounded-full border px-3 py-1 text-xs font-black ${scoreTone(post.readability_score)}`}>{post.readability_score}</span></td>
                        <td><div className="flex justify-end gap-2"><button type="button" onClick={() => setDraft(toDraft(post))} className="rounded-xl border border-cyan-200/20 p-2 text-cyan-100 hover:bg-cyan-300/10" aria-label="Düzenle"><Edit3 size={16} /></button><Link href={`/blog/${post.slug}`} target="_blank" className="rounded-xl border border-white/10 p-2 text-slate-200 hover:bg-white/10" aria-label="Public sayfayı aç"><FileText size={16} /></Link><button type="button" onClick={() => archivePost(post)} className="rounded-xl border border-rose-200/20 p-2 text-rose-100 hover:bg-rose-400/10" aria-label="Arşivle"><Archive size={16} /></button></div></td>
                      </tr>
                    ))}
                    {!loading && !filtered.length ? <tr><td colSpan={7} className="py-8 text-center text-slate-400">Filtreye uygun yazı bulunamadı.</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.045] p-5">
              <h2 className="text-xl font-black">Arama niyeti konu haritası</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">{contentIntentMap.map((item) => <div key={item.phrase} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4"><p className="text-xs font-black uppercase tracking-[.14em] text-cyan-200">{item.cluster}</p><p className="mt-2 font-black text-white">{item.phrase}</p><p className="mt-3 text-sm text-slate-400">{item.intent} · {item.contentType}</p><p className="mt-2 text-sm text-slate-300">İlişkili hizmet: {item.relatedService}</p></div>)}</div>
            </div>
          </div>
          <aside className="rounded-[24px] border border-white/10 bg-white/[0.055] p-5">
            <h2 className="text-xl font-black">{draft.id ? "Yazıyı düzenle" : "Yeni yazı"}</h2>
            <div className="mt-5 grid gap-3">
              <label className="grid gap-2 text-sm font-bold text-slate-300">Başlık<input value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} className="min-h-11 rounded-2xl border border-white/10 bg-slate-950/70 px-3 text-white outline-none focus:border-cyan-300" /></label>
              <label className="grid gap-2 text-sm font-bold text-slate-300">Slug<input value={draft.slug} onChange={(event) => updateDraft("slug", slugifyBlogValue(event.target.value))} className="min-h-11 rounded-2xl border border-white/10 bg-slate-950/70 px-3 text-white outline-none focus:border-cyan-300" /></label>
              <label className="grid gap-2 text-sm font-bold text-slate-300">Özet<textarea value={draft.excerpt} onChange={(event) => updateDraft("excerpt", event.target.value)} rows={3} className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-white outline-none focus:border-cyan-300" /></label>
              <label className="grid gap-2 text-sm font-bold text-slate-300">İçerik<textarea value={draft.content} onChange={(event) => updateDraft("content", event.target.value)} rows={10} className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 font-mono text-sm text-white outline-none focus:border-cyan-300" /></label>
              <label className="grid gap-2 text-sm font-bold text-slate-300">Durum<select value={draft.status} onChange={(event) => updateDraft("status", event.target.value)} className="min-h-11 rounded-2xl border border-white/10 bg-slate-950/70 px-3 text-white outline-none focus:border-cyan-300">{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
              <label className="grid gap-2 text-sm font-bold text-slate-300">Kategori<select value={draft.category_id || draft.category?.id || ""} onChange={(event) => updateDraft("category_id", event.target.value)} className="min-h-11 rounded-2xl border border-white/10 bg-slate-950/70 px-3 text-white outline-none focus:border-cyan-300"><option value="">Kategori seç</option>{categories.map((category) => <option key={category.id || category.slug} value={category.id || ""}>{category.name}</option>)}</select></label>
              <label className="grid gap-2 text-sm font-bold text-slate-300">Ana hedef kelime<input value={draft.primary_keyword} onChange={(event) => updateDraft("primary_keyword", event.target.value)} className="min-h-11 rounded-2xl border border-white/10 bg-slate-950/70 px-3 text-white outline-none focus:border-cyan-300" /></label>
              <label className="grid gap-2 text-sm font-bold text-slate-300">Meta title<input value={draft.meta_title} onChange={(event) => updateDraft("meta_title", event.target.value)} className="min-h-11 rounded-2xl border border-white/10 bg-slate-950/70 px-3 text-white outline-none focus:border-cyan-300" /></label>
              <label className="grid gap-2 text-sm font-bold text-slate-300">Meta description<textarea value={draft.meta_description} onChange={(event) => updateDraft("meta_description", event.target.value)} rows={3} className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-white outline-none focus:border-cyan-300" /></label>
            </div>
            {cannibalization.length ? <div className="mt-4 rounded-2xl border border-yellow-300/20 bg-yellow-300/10 p-4 text-sm text-yellow-100">Bu ana hedef başka yazıda da kullanılıyor: {cannibalization.map((post) => post.title).join(", ")}</div> : null}
            <div className="mt-5 grid gap-3 rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-black text-white">Yayına hazırlık analizi</p>
                <span className={`rounded-full border px-3 py-1 text-xs font-black ${scoreTone(analysis.readiness_score)}`}>Hazırlık {analysis.readiness_score}</span>
              </div>
              <p>Kelime: {analysis.word_count} · Okuma: {analysis.reading_time} dk · H2: {analysis.headings.h2} · H3: {analysis.headings.h3}</p>
              <p>SEO {analysis.seo_score} · Okunabilirlik {analysis.readability_score} · Anlaşılırlık {analysis.clarity_score}</p>
              <p>İç bağlantı: {analysis.internalLinks} · Dış bağlantı: {analysis.externalLinks} · Uzun paragraf: {analysis.longParagraphs}</p>
              {analysis.critical.length ? <div className="rounded-xl border border-rose-300/20 bg-rose-400/10 p-3"><p className="font-black text-rose-100">Kritik eksikler</p>{analysis.critical.map((item) => <p key={item} className="mt-1 text-rose-100">• {item}</p>)}</div> : null}
              {analysis.improvements.length ? <div className="rounded-xl border border-yellow-300/20 bg-yellow-300/10 p-3"><p className="font-black text-yellow-100">İyileştirme önerileri</p>{analysis.improvements.slice(0, 8).map((item) => <p key={item} className="mt-1 text-yellow-100">• {item}</p>)}</div> : null}
              {analysis.passed.length ? <div className="rounded-xl border border-emerald-300/20 bg-emerald-400/10 p-3"><p className="font-black text-emerald-100">Başarılı kontroller</p>{analysis.passed.slice(0, 8).map((item) => <p key={item} className="mt-1 text-emerald-100">• {item}</p>)}</div> : null}
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2"><button type="button" disabled={saving} onClick={() => savePost()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-4 text-sm font-black text-slate-950 disabled:opacity-60">{saving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />} Taslak Kaydet</button><button type="button" disabled={saving} onClick={() => savePost("published")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 text-sm font-black text-slate-950 disabled:opacity-60"><Send size={16} /> Yayınla</button></div>
            {draft.status === "published" && draft.slug ? <Link href={`/blog/${draft.slug}`} target="_blank" className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-emerald-200/25 bg-emerald-400/10 px-4 text-sm font-black text-emerald-100 hover:bg-emerald-400/15"><FileText size={16} /> Public blog yazısını aç</Link> : null}
          </aside>
        </section>
      </div>
    </main>
  );
}
