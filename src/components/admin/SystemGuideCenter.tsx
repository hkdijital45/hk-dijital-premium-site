"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Edit3, Heart, Plus, Printer, Search, Trash2, X } from "lucide-react";

const emptyGuide = { id: "", slug: "", title: "", category: "", description: "", route: "/hk-admin", video_url: "", is_published: true, content: { purpose: "", whenToUse: "", steps: [""], example: "", commonErrors: [""], tips: [""], warnings: [""] } };

function list(value: any) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

const customerJourneyActions = [
  ["Müşterilere Git", "/hk-admin/musteriler"],
  ["Yeni Firma Oluştur", "/hk-admin/musteriler"],
  ["Müşteri Keşfine Git", "/hk-admin/musteri-kesfi"],
  ["Kampanya Oluştur", "/hk-admin/kampanyalar"],
  ["Tahsilat Ekle", "/hk-admin/tahsilat"],
  ["Rapor Oluştur", "/hk-admin/raporlar"],
  ["Agent Hub’a Git", "/hk-admin/agent-hub"],
  ["Veri Yedekleme", "/hk-admin/veri-aktarma"]
];

const customerJourneyFlow = [
  ["Lead", "Aday müşteri kaydı"],
  ["Firma Kaydı", "Müşteri profilini aç"],
  ["Müşteri Hesabı", "Panel erişimini oluştur"],
  ["Entegrasyonlar", "Meta ve Google bilgileri"],
  ["Kampanya", "Bütçe ve hizmet planı"],
  ["Rapor", "AI yorum ve çıktı"],
  ["Tahsilat", "Ödeme takibi"],
  ["Revizyon", "İyileştirme planı"],
  ["Yenileme / Kapanış", "Arşiv ve yedek"]
];

export function SystemGuideCenter({ currentSession, notify }: any) {
  const [guides, setGuides] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>({ popular: [], recent: [], searches: [] });
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Tümü");
  const [selected, setSelected] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<any>(null);
  const [categoryName, setCategoryName] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const isAdmin = currentSession?.role === "admin";

  async function load() {
    setLoading(true);
    const response = await fetch("/api/admin/system-guide", { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) return notify?.(data.error || "Sistem rehberi yüklenemedi.", "error");
    setGuides(data.guides || []);
    setCategories(data.categories || []);
    setAnalytics(data.analytics || { popular: [], recent: [], searches: [] });
    const topic = new URLSearchParams(window.location.search).get("topic");
    if (topic) {
      const match = (data.guides || []).find((guide: any) => guide.slug === topic || String(guide.route || "").endsWith(`/${topic}`));
      if (match) openGuide(match);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      load();
      try {
        setFavorites(JSON.parse(localStorage.getItem("hk-guide-favorites") || "[]"));
        setRecent(JSON.parse(localStorage.getItem("hk-guide-recent") || "[]"));
      } catch {}
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!query.trim()) return;
    const timer = window.setTimeout(() => fetch("/api/admin/system-guide", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "search", query }) }), 700);
    return () => window.clearTimeout(timer);
  }, [query]);

  const filtered = useMemo(() => guides.filter((guide) => {
    const searchable = `${guide.title} ${guide.description} ${guide.category} ${JSON.stringify(guide.content || {})}`.toLocaleLowerCase("tr");
    return (category === "Tümü" || guide.category === category) && (!query || searchable.includes(query.toLocaleLowerCase("tr")));
  }), [guides, query, category]);

  function openGuide(guide: any) {
    setSelected(guide);
    const next = [guide.slug, ...recent.filter((slug) => slug !== guide.slug)].slice(0, 10);
    setRecent(next);
    localStorage.setItem("hk-guide-recent", JSON.stringify(next));
    fetch("/api/admin/system-guide", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "view", slug: guide.slug }) });
  }

  function toggleFavorite(slug: string) {
    const next = favorites.includes(slug) ? favorites.filter((item) => item !== slug) : [slug, ...favorites];
    setFavorites(next);
    localStorage.setItem("hk-guide-favorites", JSON.stringify(next));
  }

  async function action(payload: any, success: string) {
    const response = await fetch("/api/admin/system-guide", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return notify?.(data.error || "İşlem tamamlanamadı.", "error");
    notify?.(success, "success");
    await load();
    return data;
  }

  async function saveGuide() {
    const result = await action({ action: editor.id ? "updateGuide" : "createGuide", guide: editor }, editor.id ? "Rehber güncellendi." : "Yeni rehber eklendi.");
    if (result) setEditor(null);
  }

  const related = selected ? guides.filter((guide) => guide.category === selected.category && guide.id !== selected.id).slice(0, 4) : [];
  const favoriteGuides = favorites.map((slug) => guides.find((guide) => guide.slug === slug)).filter(Boolean).slice(0, 6);
  const recentGuides = recent.map((slug) => guides.find((guide) => guide.slug === slug)).filter(Boolean).slice(0, 6);

  return <div className="grid gap-5">
    <section className="rounded-[22px] border border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-blue-50 p-6 shadow-[0_12px_35px_rgba(15,23,42,.07)]">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">Yaşayan bilgi merkezi</p><h2 className="mt-2 text-3xl font-black text-slate-950">📚 HK Dijital Sistem Rehberi</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Tüm modüllerin kullanım kılavuzu, eğitim içerikleri ve sorun giderme rehberleri. İçerikler aranabilir, favorilenebilir ve admin tarafından geliştirilebilir.</p></div>{isAdmin && <button onClick={() => setEditor({ ...emptyGuide, category: categories[0]?.name || "" })} className="inline-flex items-center gap-2 rounded-[14px] bg-cyan-500 px-4 py-3 text-sm font-black text-white"><Plus size={16} /> Yeni Rehber</button>}</div>
      <label className="mt-6 flex min-h-14 items-center gap-3 rounded-[16px] border border-slate-200 bg-white px-4 shadow-sm"><Search size={20} className="text-cyan-600" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Müşteri nasıl eklenir, satış hunisi, tahsilat, Meta Pixel..." className="w-full bg-transparent text-base text-slate-950 outline-none placeholder:text-slate-400" /></label>
      <div className="mt-4 flex flex-wrap gap-2"><button onClick={() => setCategory("Tümü")} className={`rounded-full px-3 py-2 text-xs font-black ${category === "Tümü" ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>Tümü</button>{categories.map((item) => <button key={item.id || item.name} onClick={() => setCategory(item.name)} className={`rounded-full px-3 py-2 text-xs font-black ${category === item.name ? "bg-cyan-500 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>{item.name}</button>)}</div>
    </section>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><GuideStat label="Toplam rehber" value={guides.length} /><GuideStat label="Kategori" value={categories.length} /><GuideStat label="Favorilerim" value={favorites.length} /><GuideStat label="Arama sonucu" value={filtered.length} /></section>

    {(favoriteGuides.length > 0 || recentGuides.length > 0) && <section className="grid gap-4 xl:grid-cols-2">{favoriteGuides.length > 0 && <GuideStrip title="Favorilerim" guides={favoriteGuides} open={openGuide} />}{recentGuides.length > 0 && <GuideStrip title="Son Okuduklarım" guides={recentGuides} open={openGuide} />}</section>}

    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]"><div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">{filtered.map((guide) => <article key={guide.id || guide.slug} className="flex min-h-56 flex-col rounded-[18px] border border-slate-200 bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,.05)] transition hover:-translate-y-0.5 hover:border-cyan-300"><div className="flex items-start justify-between gap-2"><span className="rounded-full bg-cyan-50 px-2.5 py-1 text-[10px] font-black text-cyan-700">{guide.category}</span><button onClick={() => toggleFavorite(guide.slug)} aria-label="Favori" className={`grid size-8 place-items-center rounded-full ${favorites.includes(guide.slug) ? "bg-red-50 text-red-500" : "bg-slate-50 text-slate-400"}`}><Heart size={15} fill={favorites.includes(guide.slug) ? "currentColor" : "none"} /></button></div><h3 className="mt-4 text-lg font-black text-slate-950">{guide.title}</h3><p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{guide.description}</p><div className="mt-4 flex gap-2"><button onClick={() => openGuide(guide)} className="flex flex-1 items-center justify-center gap-2 rounded-[12px] bg-cyan-500 px-3 py-2.5 text-xs font-black text-white">Rehberi Aç <ChevronRight size={14} /></button>{isAdmin && <button onClick={() => setEditor(JSON.parse(JSON.stringify(guide)))} className="grid size-10 place-items-center rounded-[12px] border border-slate-200 text-blue-600"><Edit3 size={15} /></button>}</div></article>)}{!loading && !filtered.length && <p className="md:col-span-2 2xl:col-span-3 rounded-[18px] border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">Aramanızla eşleşen rehber bulunamadı. Farklı bir işlem veya modül adı deneyin.</p>}{loading && <p className="text-sm text-slate-500">Rehberler yükleniyor...</p>}</div><aside className="grid h-fit gap-4"><div className="rounded-[18px] border border-slate-200 bg-white p-4"><h3 className="font-black text-slate-950">En Çok Okunanlar</h3><div className="mt-3 grid gap-2">{(analytics.popular || []).map((guide: any) => <button key={guide.id} onClick={() => openGuide(guide)} className="rounded-[10px] bg-slate-50 p-3 text-left text-xs font-bold text-slate-700">{guide.title}<span className="mt-1 block text-[10px] text-slate-400">{guide.view_count || 0} görüntüleme</span></button>)}{!(analytics.popular || []).length && <p className="text-xs text-slate-500">Okuma verisi oluştuğunda burada sıralanır.</p>}</div></div><div className="rounded-[18px] border border-slate-200 bg-white p-4"><h3 className="font-black text-slate-950">En Çok Arananlar</h3><div className="mt-3 flex flex-wrap gap-2">{(analytics.searches || []).map(([term, count]: any) => <button key={term} onClick={() => setQuery(term)} className="rounded-full bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">{term} · {count}</button>)}{!(analytics.searches || []).length && <p className="text-xs text-slate-500">Aramalar yapıldıkça konu eğilimleri görünür.</p>}</div></div>{isAdmin && <div className="rounded-[18px] border border-slate-200 bg-white p-4"><h3 className="font-black text-slate-950">Kategori Yönetimi</h3><div className="mt-3 flex gap-2"><input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Yeni kategori" className="min-w-0 flex-1 rounded-[10px] border border-slate-300 px-3 text-sm" /><button disabled={!categoryName.trim()} onClick={async () => { await action({ action: "createCategory", name: categoryName }, "Kategori eklendi."); setCategoryName(""); }} className="rounded-[10px] bg-blue-600 px-3 py-2 text-xs font-black text-white disabled:opacity-40">Ekle</button></div><div className="mt-3 grid gap-1">{categories.map((item) => <div key={item.id || item.name} className="flex items-center justify-between gap-2 rounded-[9px] bg-slate-50 px-2 py-2"><span className="truncate text-xs font-bold text-slate-700">{item.name}</span>{!String(item.id).startsWith("category-") && <span className="flex gap-1"><button onClick={async () => { const name = window.prompt("Yeni kategori adı", item.name); if (name?.trim()) await action({ action: "updateCategory", id: item.id, name }, "Kategori güncellendi."); }} className="text-blue-600"><Edit3 size={13} /></button><button onClick={() => confirm("Bu kategoriyi silmek istediğinize emin misiniz?") && action({ action: "deleteCategory", id: item.id }, "Kategori silindi.")} className="text-red-600"><Trash2 size={13} /></button></span>}</div>)}</div></div>}</aside></section>

    {selected && <div className="fixed inset-0 z-[100] flex justify-end bg-slate-100/80" onMouseDown={() => setSelected(null)}><article className="h-full w-full max-w-4xl overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-2xl sm:p-8" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black text-cyan-700">Sistem Rehberi / {selected.category}</p><h2 className="mt-2 text-3xl font-black text-slate-950">{selected.title}</h2><p className="mt-3 text-sm leading-6 text-slate-600">{selected.description}</p></div><button onClick={() => setSelected(null)} className="grid size-10 place-items-center rounded-full border border-slate-200"><X size={18} /></button></div><nav className="mt-6 flex flex-wrap gap-2">{[["amac", "Bu ekran ne işe yarar?"], ["kullanim", "Nasıl kullanılır?"], ["hatalar", "Hatalar ve ipuçları"]].map(([id, label]) => <a key={id} href={`#${id}`} className="rounded-full border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">{label}</a>)}</nav>{selected.slug === "bir-musterinin-seruveni" && <div className="mt-6 rounded-[18px] border border-cyan-200 bg-cyan-50 p-4"><p className="text-xs font-black uppercase tracking-[.14em] text-cyan-700">Hızlı aksiyonlar</p><div className="mt-3 flex flex-wrap gap-2">{customerJourneyActions.map(([label, href]) => <Link key={label} href={href} className="rounded-[12px] bg-white px-3 py-2 text-xs font-black text-cyan-800 shadow-sm ring-1 ring-cyan-200">{label}</Link>)}</div><div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{customerJourneyFlow.map(([title, description], index) => <div key={title} className="rounded-[14px] border border-cyan-100 bg-white p-3"><span className="grid size-7 place-items-center rounded-full bg-cyan-500 text-xs font-black text-white">{index + 1}</span><strong className="mt-2 block text-sm text-slate-950">{title}</strong><span className="mt-1 block text-xs text-slate-500">{description}</span></div>)}</div></div>}<GuideSection id="amac" title="Bu ekran ne işe yarar?" text={selected.content?.purpose} /><GuideSection title="Ne zaman kullanılır?" text={selected.content?.whenToUse} /><GuideSection id="kullanim" title="Adım adım kullanım" items={list(selected.content?.steps)} ordered /><GuideSection title="Örnek kullanım" text={selected.content?.example} /><GuideSection id="hatalar" title="Sık yapılan hatalar" items={list(selected.content?.commonErrors)} /><GuideSection title="İpuçları" items={list(selected.content?.tips)} /><GuideSection title="Dikkat edilmesi gerekenler" items={list(selected.content?.warnings)} tone="amber" />{selected.video_url && <div className="mt-5 rounded-[16px] border border-blue-200 bg-blue-50 p-4"><p className="font-black text-blue-800">Eğitim Videosu</p><a href={selected.video_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-bold text-blue-700 underline">Videoyu aç</a></div>}<div className="mt-6 flex flex-wrap gap-2"><Link href={selected.route || "/hk-admin"} className="rounded-[12px] bg-cyan-500 px-4 py-3 text-sm font-black text-white">İlgili Ekranı Aç</Link><button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-[12px] border border-slate-300 px-4 py-3 text-sm font-black text-slate-700"><Printer size={16} /> PDF / Yazdır</button><button onClick={() => toggleFavorite(selected.slug)} className="rounded-[12px] border border-red-200 px-4 py-3 text-sm font-black text-red-600">Favorilere Ekle</button></div><div className="mt-7 rounded-[16px] border border-slate-200 bg-slate-50 p-4"><p className="font-black text-slate-950">Bu rehber işinize yaradı mı?</p><div className="mt-3 flex gap-2"><button onClick={() => action({ action: "feedback", slug: selected.slug, isHelpful: true }, "Geri bildiriminiz kaydedildi.")} className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-black text-white">Evet</button><button onClick={() => action({ action: "feedback", slug: selected.slug, isHelpful: false }, "Geri bildiriminiz kaydedildi.")} className="rounded-full bg-slate-600 px-4 py-2 text-xs font-black text-white">Hayır</button></div></div>{related.length > 0 && <div className="mt-7"><h3 className="text-lg font-black text-slate-950">İlgili Rehberler</h3><div className="mt-3 grid gap-2 sm:grid-cols-2">{related.map((guide) => <button key={guide.id} onClick={() => openGuide(guide)} className="rounded-[12px] border border-slate-200 p-3 text-left text-sm font-bold text-slate-700">{guide.title}</button>)}</div></div>}</article></div>}

    {editor && <div className="fixed inset-0 z-[110] grid place-items-center bg-slate-100/80 p-4" onMouseDown={() => setEditor(null)}><div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[22px] border border-slate-200 bg-white p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><div className="flex justify-between gap-3"><h2 className="text-2xl font-black text-slate-950">{editor.id ? "Rehberi Düzenle" : "Yeni Rehber"}</h2><button onClick={() => setEditor(null)}><X /></button></div><div className="mt-5 grid gap-4 md:grid-cols-2"><GuideInput label="Başlık" value={editor.title} set={(title) => setEditor({ ...editor, title })} /><GuideInput label="Slug" value={editor.slug} set={(slug) => setEditor({ ...editor, slug })} /><label className="grid gap-2 text-sm font-bold text-slate-700">Kategori<select value={editor.category} onChange={(event) => setEditor({ ...editor, category: event.target.value })} className="min-h-11 rounded-[10px] border border-slate-300 bg-white px-3">{categories.map((item) => <option key={item.id || item.name}>{item.name}</option>)}</select></label><GuideInput label="İlgili route" value={editor.route || ""} set={(route) => setEditor({ ...editor, route })} /><GuideInput label="Video / YouTube URL" value={editor.video_url || ""} set={(video_url) => setEditor({ ...editor, video_url })} /><div className="md:col-span-2"><GuideTextarea label="Kısa açıklama" value={editor.description} set={(description) => setEditor({ ...editor, description })} /></div><div className="md:col-span-2"><GuideTextarea label="Bu ekran ne işe yarar?" value={editor.content?.purpose || ""} set={(purpose) => setEditor({ ...editor, content: { ...editor.content, purpose } })} /></div><div className="md:col-span-2"><GuideTextarea label="Ne zaman kullanılır?" value={editor.content?.whenToUse || ""} set={(whenToUse) => setEditor({ ...editor, content: { ...editor.content, whenToUse } })} /></div><div className="md:col-span-2"><GuideTextarea label="Adımlar (her satır bir adım)" value={list(editor.content?.steps).join("\n")} set={(value) => setEditor({ ...editor, content: { ...editor.content, steps: value.split("\n").filter(Boolean) } })} /></div><div className="md:col-span-2"><GuideTextarea label="Örnek kullanım" value={editor.content?.example || ""} set={(example) => setEditor({ ...editor, content: { ...editor.content, example } })} /></div></div><div className="mt-5 flex justify-end gap-2">{editor.id && <button onClick={async () => { if (confirm("Bu rehberi silmek istediğinize emin misiniz?")) { await action({ action: "deleteGuide", id: editor.id }, "Rehber silindi."); setEditor(null); } }} className="mr-auto rounded-[12px] bg-red-500 px-4 py-3 text-sm font-black text-white"><Trash2 size={15} className="mr-1 inline" /> Sil</button>}<button onClick={() => setEditor(null)} className="rounded-[12px] border border-slate-300 px-4 py-3 text-sm font-black text-slate-700">Vazgeç</button><button onClick={saveGuide} className="rounded-[12px] bg-cyan-500 px-5 py-3 text-sm font-black text-white">Kaydet</button></div></div></div>}
  </div>;
}

function GuideStat({ label, value }: any) { return <div className="rounded-[16px] border border-slate-200 bg-white p-4"><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-1 text-2xl font-black text-slate-950">{value}</p></div>; }
function GuideStrip({ title, guides, open }: any) { return <div className="rounded-[18px] border border-slate-200 bg-white p-4"><h3 className="font-black text-slate-950">{title}</h3><div className="mt-3 flex flex-wrap gap-2">{guides.map((guide: any) => <button key={guide.slug} onClick={() => open(guide)} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700">{guide.title}</button>)}</div></div>; }
function GuideSection({ id, title, text, items, ordered, tone }: any) { const Tag = ordered ? "ol" : "ul"; return <section id={id} className={`mt-5 scroll-mt-5 rounded-[16px] border p-5 ${tone === "amber" ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}><h3 className="text-lg font-black text-slate-950">{title}</h3>{text && <p className="mt-3 text-sm leading-7 text-slate-700">{text}</p>}{items?.length > 0 && <Tag className={`${ordered ? "list-decimal" : "list-disc"} mt-3 space-y-2 pl-5 text-sm leading-6 text-slate-700`}>{items.map((item: string) => <li key={item}>{item}</li>)}</Tag>}</section>; }
function GuideInput({ label, value, set }: any) { return <label className="grid gap-2 text-sm font-bold text-slate-700">{label}<input value={value} onChange={(event) => set(event.target.value)} className="min-h-11 rounded-[10px] border border-slate-300 px-3 text-slate-950" /></label>; }
function GuideTextarea({ label, value, set }: any) { return <label className="grid gap-2 text-sm font-bold text-slate-700">{label}<textarea rows={4} value={value} onChange={(event) => set(event.target.value)} className="rounded-[10px] border border-slate-300 p-3 text-slate-950" /></label>; }
