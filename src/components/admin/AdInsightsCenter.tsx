"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState } from "react";
import { BarChart3, Brain, FileText, MessageSquareText, RefreshCw, Search, Send, ShieldAlert, Sparkles, Trophy } from "lucide-react";

const ranges = [
  ["today", "Bugün"],
  ["last_7d", "Son 7 gün"],
  ["last_14d", "Son 14 gün"],
  ["last_30d", "Son 30 gün"],
  ["this_month", "Bu ay"],
  ["last_month", "Geçen ay"],
  ["custom", "Özel tarih aralığı"]
];

const platforms = [
  ["all", "Tümü"],
  ["meta", "Meta"],
  ["google", "Google Ads"],
  ["instagram", "Instagram"],
  ["facebook", "Facebook"],
  ["website", "Website / Pixel"]
];

const metricExplanations: Record<string, string> = {
  spend: "Harcama",
  impressions: "Gösterim",
  reach: "Erişim",
  clicks: "Tıklama",
  ctr: "CTR",
  cpc: "CPC",
  cpm: "CPM",
  messages: "Mesaj",
  leads: "Lead",
  conversions: "Dönüşüm",
  frequency: "Frekans",
  roas: "ROAS"
};

const descriptions: Record<string, string> = {
  spend: "Seçili dönemde kullanılan toplam reklam bütçesi.",
  impressions: "Reklamların ekranda kaç kez göründüğünü gösterir.",
  reach: "Reklamı gören benzersiz kişi sayısıdır.",
  clicks: "Reklamlardan alınan toplam tıklamadır.",
  ctr: "Reklamı görenlerden kaç kişinin tıkladığını gösterir.",
  cpc: "Bir tıklama için ortalama maliyet.",
  cpm: "Bin gösterim için ortalama maliyet.",
  messages: "Reklam kaynaklı mesaj veya konuşma başlangıcı.",
  leads: "Form, arama veya mesaj gibi potansiyel müşteri sinyali.",
  conversions: "Tanımlı dönüşüm aksiyonlarının toplamı.",
  frequency: "Bir kişinin reklamı ortalama kaç kez gördüğü.",
  roas: "Reklam harcamasına karşılık gelir oranı."
};

function formatMetric(key: string, value: any) {
  const number = Number(value || 0);
  if (["spend", "cpc", "cpm"].includes(key)) return `${number.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} TL`;
  if (["ctr", "frequency", "roas"].includes(key)) return number.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
  return number.toLocaleString("tr-TR");
}

function statusColor(score: number) {
  if (score >= 80) return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (score >= 60) return "border-amber-200 bg-amber-50 text-amber-800";
  if (score >= 40) return "border-orange-200 bg-orange-50 text-orange-800";
  return "border-red-200 bg-red-50 text-red-800";
}

function connectionLabel(value: any, missing: string) {
  return value ? <span className="font-black text-slate-950">{value}</span> : <span className="font-bold text-amber-700">{missing}</span>;
}

function changeBadge(value: any) {
  const number = Number(value || 0);
  const tone = number > 0 ? "border-emerald-200 bg-emerald-50 text-emerald-800" : number < 0 ? "border-red-200 bg-red-50 text-red-800" : "border-slate-200 bg-slate-50 text-slate-700";
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${tone}`}>{number > 0 ? "+" : ""}{number.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}%</span>;
}

function adTitle(ad: any) {
  return ad?.name || ad?.campaign_name || ad?.ad_name || "Reklam verisi yok";
}

export function AdInsightsCenter({ content, notify }: { content: any; notify?: (message: string, type?: string) => void }) {
  const companies = useMemo(() => (content.companies || []).filter((company: any) => !company.status || company.status === "Aktif"), [content.companies]);
  const [companyId, setCompanyId] = useState(companies[0]?.id || "");
  const [range, setRange] = useState("last_30d");
  const [platform, setPlatform] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState("");
  const [data, setData] = useState<any>(null);
  const selectedCompany = companies.find((company: any) => company.id === companyId);

  async function request(path: string, method = "GET") {
    if (!companyId) {
      notify?.("Önce müşteri seçin.", "warning");
      return;
    }
    const params = new URLSearchParams({ companyId, range, platform, from, to });
    setLoading(path);
    try {
      const response = method === "GET"
        ? await fetch(`/api/admin/ad-insights?${params}`)
        : await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, range, platform, from, to }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || payload.error || "Reklam analizi alınamadı.");
      setData(payload);
      notify?.(method === "GET" ? "Analiz getirildi." : payload.message || "İşlem tamamlandı.", "success");
    } catch (error) {
      notify?.(error instanceof Error ? error.message : "İşlem başarısız oldu.", "error");
    } finally {
      setLoading("");
    }
  }

  function clearFilters() {
    setCompanyId("");
    setRange("last_30d");
    setPlatform("all");
    setFrom("");
    setTo("");
    setData(null);
    notify?.("Filtreler temizlendi.", "info");
  }

  const metrics = data?.metrics || {};
  const analysis = data?.analysis || {};
  return <div className="grid gap-6">
    <section className="rounded-[22px] border border-slate-200 bg-white p-6 shadow-[0_12px_34px_rgba(15,23,42,.06)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">HK Reklam Zekası</p>
          <h2 className="mt-2 text-3xl font-black text-slate-950">Reklam Yorum Merkezi</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Müşteri reklam hesaplarından gelen Meta, Google ve sosyal medya sinyallerini tek ekranda yorumlayın. Gerçek veri yoksa son senkron kayıtlar, o da yoksa demo/fallback analiz kullanılır.</p>
        </div>
        <div className={`rounded-[16px] border px-4 py-3 text-sm font-black ${statusColor(Number(data?.healthScore || 0))}`}>
          Reklam Sağlık Skoru: {data?.healthScore ?? "-"} / 100
          <span className="ml-2">{data?.healthLabel || "Veri bekleniyor"}</span>
        </div>
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-[1.4fr_.8fr_.8fr_.8fr_.8fr_auto]">
        <label className="grid gap-2 text-sm font-bold text-slate-700">Müşteri
          <select value={companyId} onChange={(event) => setCompanyId(event.target.value)} className="min-h-11 rounded-[12px] border border-slate-300 bg-white px-3 text-slate-950">
            <option value="">Müşteri seç</option>
            {companies.map((company: any) => <option key={company.id} value={company.id}>{company.name || company.company_name}</option>)}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-bold text-slate-700">Tarih
          <select value={range} onChange={(event) => setRange(event.target.value)} className="min-h-11 rounded-[12px] border border-slate-300 bg-white px-3 text-slate-950">{ranges.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        </label>
        <label className="grid gap-2 text-sm font-bold text-slate-700">Platform
          <select value={platform} onChange={(event) => setPlatform(event.target.value)} className="min-h-11 rounded-[12px] border border-slate-300 bg-white px-3 text-slate-950">{platforms.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        </label>
        {range === "custom" && <label className="grid gap-2 text-sm font-bold text-slate-700">Başlangıç<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="min-h-11 rounded-[12px] border border-slate-300 px-3" /></label>}
        {range === "custom" && <label className="grid gap-2 text-sm font-bold text-slate-700">Bitiş<input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="min-h-11 rounded-[12px] border border-slate-300 px-3" /></label>}
        <div className="flex items-end gap-2">
          <button onClick={() => request("/api/admin/ad-insights")} disabled={Boolean(loading)} className="rounded-[14px] bg-cyan-500 px-5 py-3 text-sm font-black text-white disabled:opacity-60"><Search size={16} className="mr-2 inline" />{loading ? "Getiriliyor..." : "Filtrele"}</button>
          <button onClick={clearFilters} className="rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700">Temizle</button>
        </div>
      </div>
      {(companyId || data) && <p className="mt-4 inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-black text-cyan-800">Aktif filtre: {selectedCompany?.name || selectedCompany?.company_name || "Müşteri seçilmedi"} / {ranges.find(([value]) => value === range)?.[1]} / {platforms.find(([value]) => value === platform)?.[1]}</p>}
    </section>

    {!selectedCompany && <p className="rounded-[18px] border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">Reklam yorumlarını görmek için aktif bir müşteri seçin.</p>}

    {selectedCompany && <section className="grid gap-4 lg:grid-cols-3">
      <div className="rounded-[18px] border border-slate-200 bg-white p-5 lg:col-span-2">
        <h3 className="font-black text-slate-950">Bağlantı Durumu</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <p className="rounded-[12px] bg-slate-50 p-3 text-sm text-slate-600">Meta Business ID<br />{connectionLabel(data?.connection?.metaBusinessId, "Meta reklam hesabı tanımlı değil.")}</p>
          <p className="rounded-[12px] bg-slate-50 p-3 text-sm text-slate-600">Meta Ad Account ID<br />{connectionLabel(data?.connection?.metaAdAccountId, "Meta Ads Account ID eksik.")}</p>
          <p className="rounded-[12px] bg-slate-50 p-3 text-sm text-slate-600">Facebook Page ID<br />{connectionLabel(data?.connection?.facebookPageId, "Facebook sayfası tanımlı değil.")}</p>
          <p className="rounded-[12px] bg-slate-50 p-3 text-sm text-slate-600">Instagram Business ID<br />{connectionLabel(data?.connection?.instagramBusinessId || data?.connection?.instagramUsername, "Instagram Business ID eksik.")}</p>
          <p className="rounded-[12px] bg-slate-50 p-3 text-sm text-slate-600">Google Ads Customer ID<br />{connectionLabel(data?.connection?.googleAdsCustomerId, "Google Ads Customer ID eksik.")}</p>
          <p className="rounded-[12px] bg-slate-50 p-3 text-sm text-slate-600">Website / Pixel<br />{connectionLabel(data?.connection?.websiteUrl || data?.connection?.metaPixelId, "Website veya Pixel bilgisi eksik.")}</p>
        </div>
      </div>
      <div className="rounded-[18px] border border-slate-200 bg-white p-5">
        <h3 className="font-black text-slate-950">Veri Kaynağı</h3>
        <p className="mt-3 rounded-[14px] border border-cyan-200 bg-cyan-50 p-4 text-sm font-bold text-cyan-800">{data?.sourceType || "Analiz bekleniyor"}</p>
        <p className="mt-3 text-sm leading-6 text-slate-600">Öncelik: gerçek API verisi, Supabase’de kayıtlı son senkron reklam verisi, son olarak demo fallback.</p>
      </div>
    </section>}

    {data && <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Object.keys(metricExplanations).map((key) => <div key={key} className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[.12em] text-slate-500">{metricExplanations[key]}</p>
        <strong className="mt-2 block text-2xl font-black text-slate-950">{formatMetric(key, metrics[key])}</strong>
        <p className="mt-2 text-xs leading-5 text-slate-500">{descriptions[key]}</p>
      </div>)}
    </section>}

    {data && <section className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
      <div className="rounded-[20px] border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-black text-slate-950">Haftalık Değişim</h3>
            <p className="mt-1 text-sm text-slate-500">Seçili dönem önceki aynı dönemle karşılaştırılır.</p>
          </div>
          <BarChart3 className="text-cyan-600" />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {["ctr", "cpc", "cpm", "spend", "impressions", "clicks", "leads", "messages"].map((key) => <div key={key} className="rounded-[16px] border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[.12em] text-slate-500">{metricExplanations[key] || key}</p>
            <div className="mt-2">{changeBadge(data.weeklyChange?.[key])}</div>
          </div>)}
        </div>
      </div>
      <div className="rounded-[20px] border border-slate-200 bg-white p-6">
        <h3 className="font-black text-slate-950">AI Sağlık Skoru Nedenleri</h3>
        <div className="mt-4 grid gap-2 text-sm text-slate-700">
          <p className="rounded-[12px] bg-slate-50 p-3">CTR değişimi: {changeBadge(data.weeklyChange?.ctr)}</p>
          <p className="rounded-[12px] bg-slate-50 p-3">CPC değişimi: {changeBadge(data.weeklyChange?.cpc)}</p>
          <p className="rounded-[12px] bg-slate-50 p-3">CPM değişimi: {changeBadge(data.weeklyChange?.cpm)}</p>
          <p className="rounded-[12px] bg-slate-50 p-3">Boşa harcanan bütçe tahmini: <strong>{Number(data.wastedBudgetEstimate || 0) ? `${Number(data.wastedBudgetEstimate).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} TL` : "Hesaplanamadı"}</strong></p>
        </div>
      </div>
    </section>}

    {data && <section className="grid gap-4 lg:grid-cols-3">
      <div className="rounded-[20px] border border-emerald-200 bg-white p-6">
        <Trophy className="text-emerald-600" />
        <h3 className="mt-3 font-black text-slate-950">En İyi Reklam</h3>
        <p className="mt-2 text-sm font-bold text-slate-700">{adTitle(data.bestAd)}</p>
        <p className="mt-2 text-xs leading-5 text-slate-500">Yüksek CTR, düşük maliyet ve sonuç sinyallerine göre seçilir.</p>
      </div>
      <div className="rounded-[20px] border border-red-200 bg-white p-6">
        <ShieldAlert className="text-red-600" />
        <h3 className="mt-3 font-black text-slate-950">En Zayıf Reklam</h3>
        <p className="mt-2 text-sm font-bold text-slate-700">{adTitle(data.worstAd)}</p>
        <p className="mt-2 text-xs leading-5 text-slate-500">Düşük CTR, yüksek CPC veya düşük dönüşüm sinyalleriyle belirlenir.</p>
      </div>
      <div className="rounded-[20px] border border-purple-200 bg-white p-6">
        <Sparkles className="text-purple-600" />
        <h3 className="mt-3 font-black text-slate-950">Kazanan Kreatif</h3>
        {data.winningCreative?.creative_thumbnail_url ? <img src={data.winningCreative.creative_thumbnail_url} alt="Kazanan kreatif" className="mt-3 aspect-video w-full rounded-[14px] object-cover" /> : <p className="mt-2 text-sm text-slate-600">{data.winningCreative?.ad_text || "Kreatif görsel/video verisi yok. Başlık/metin üzerinden analiz yapılır."}</p>}
      </div>
    </section>}

    {data && <section className="rounded-[20px] border border-slate-200 bg-white p-6">
      <h3 className="font-black text-slate-950">AI Otomatik Aksiyon Önerileri</h3>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {(data.actionRecommendations || []).map((item: string, index: number) => <p key={index} className="rounded-[14px] border border-cyan-100 bg-cyan-50 p-4 text-sm font-bold leading-6 text-cyan-900">{item}</p>)}
      </div>
    </section>}

    {data && <section className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-[20px] border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between gap-3"><h3 className="font-black text-slate-950">Reklam Yorum Paneli</h3><Brain className="text-purple-600" /></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button onClick={() => request("/api/admin/ad-insights/analyze", "POST")} disabled={Boolean(loading)} className="rounded-[12px] bg-purple-600 px-4 py-3 text-sm font-black text-white">Performansı Yorumla</button>
          <button onClick={() => request("/api/admin/ad-insights/analyze", "POST")} disabled={Boolean(loading)} className="rounded-[12px] bg-red-500 px-4 py-3 text-sm font-black text-white"><ShieldAlert size={15} className="mr-1 inline" /> Sorunları Bul</button>
          <button onClick={() => request("/api/admin/ad-insights/analyze", "POST")} disabled={Boolean(loading)} className="rounded-[12px] bg-cyan-500 px-4 py-3 text-sm font-black text-white">7 Günlük Aksiyon Planı Oluştur</button>
          <button onClick={() => navigator.clipboard?.writeText(analysis.customer || "")} className="rounded-[12px] bg-emerald-500 px-4 py-3 text-sm font-black text-white"><MessageSquareText size={15} className="mr-1 inline" /> WhatsApp Mesajı Yaz</button>
          <button onClick={() => request("/api/admin/ad-insights/sync", "POST")} disabled={Boolean(loading)} className="rounded-[12px] bg-orange-500 px-4 py-3 text-sm font-black text-white"><RefreshCw size={15} className="mr-1 inline" /> Snapshot Kaydet</button>
          <button onClick={() => window.print()} className="rounded-[12px] bg-amber-400 px-4 py-3 text-sm font-black text-slate-950"><FileText size={15} className="mr-1 inline" /> PDF Rapor Taslağı Oluştur</button>
        </div>
        <pre className="mt-5 whitespace-pre-wrap rounded-[16px] border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700">{analysis.admin || "Analiz için Performansı Yorumla düğmesini kullanın."}</pre>
      </div>
      <div className="rounded-[20px] border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between gap-3"><h3 className="font-black text-slate-950">Müşteriye Gönderilecek Sade Özet</h3><Send className="text-cyan-600" /></div>
        <p className="mt-4 rounded-[16px] border border-cyan-100 bg-cyan-50 p-4 text-sm leading-7 text-slate-700">{analysis.customer || "Müşteri özeti analiz sonrası burada görünür."}</p>
        <button onClick={() => navigator.clipboard?.writeText(analysis.customer || "")} className="mt-4 rounded-[12px] border border-cyan-200 px-4 py-3 text-sm font-black text-cyan-700">Metni Kopyala</button>
      </div>
    </section>}

    {!data && selectedCompany && <div className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <BarChart3 className="mx-auto text-cyan-600" />
      <p className="mt-3 font-black text-slate-950">Analiz henüz yüklenmedi.</p>
      <p className="mt-2 text-sm text-slate-500">Filtreleri seçip “Analizi Getir” düğmesine basın.</p>
    </div>}
  </div>;
}
