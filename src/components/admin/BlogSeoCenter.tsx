"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Archive, CheckCircle2, Edit3, FileText, Loader2, Plus, Search, Send } from "lucide-react";
import { HKButton, HKPageHeader } from "@/components/admin/HKDesignSystem";
import { analyzeBlogPost, blogCategories, contentIntentMap, seedBlogPosts, slugifyBlogValue, type BlogCategory, type BlogPost, type BlogStatus } from "@/lib/blog-seo-shared";

const statusLabels: Record<BlogStatus, string> = { draft: "Taslak", review: "İncelemede", scheduled: "Planlandı", published: "Yayında", archived: "Arşiv" };

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

  const analysis = analyzeBlogPost({
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

  async function savePost(nextStatus?: BlogStatus) {
    if (saving) return;
    setSaving(true);
    setMessage("");
    const payload = { ...draft, status: nextStatus || draft.status, slug: draft.slug || slugifyBlogValue(draft.title), secondary_keywords: draft.secondary_keywords_text.split(",").map((item) => item.trim()).filter(Boolean) };
    try {
      const response = await fetch(draft.id ? `/api/admin/blog-posts/${draft.id}` : "/api/admin/blog-posts", {
        method: draft.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Yazı kaydedilemedi.");
      setDraft(toDraft(data.post));
      setMessage("Yazı kaydedildi.");
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
            <div className="mt-5 grid gap-2 rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300"><p className="font-black text-white">Yayına hazırlık analizi</p><p>Kelime: {analysis.word_count} · Okuma: {analysis.reading_time} dk</p><p>SEO {analysis.seo_score} · Okunabilirlik {analysis.readability_score} · Anlaşılırlık {analysis.clarity_score}</p>{analysis.warnings.map((warning) => <p key={warning} className="text-yellow-100">• {warning}</p>)}</div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2"><button type="button" disabled={saving} onClick={() => savePost()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-4 text-sm font-black text-slate-950 disabled:opacity-60">{saving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />} Kaydet</button><button type="button" disabled={saving} onClick={() => savePost("published")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 text-sm font-black text-slate-950 disabled:opacity-60"><Send size={16} /> Yayınla</button></div>
          </aside>
        </section>
      </div>
    </main>
  );
}
