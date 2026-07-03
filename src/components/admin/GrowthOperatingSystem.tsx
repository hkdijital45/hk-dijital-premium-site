"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState } from "react";
import { CheckCircle2, PackageCheck } from "lucide-react";

type GrowthProps = {
  content: any;
  setActive?: (target: string) => void;
  company?: any;
};

const campaignModes = ["Funnel Kur", "Funnelsız Reklam Yap", "WhatsApp Odaklı", "Instagram DM Odaklı", "Telefon Odaklı", "Web Trafiği", "Randevu / Rezervasyon", "Teklif Toplama", "Marka Bilinirliği"];
const funnelGoals = ["Potansiyel Müşteri", "Satış", "Randevu", "WhatsApp", "Teklif", "Bilinirlik"];
const channels = ["Meta", "Google", "Instagram", "TikTok", "Web", "WhatsApp"];
const fullFunnelSteps = ["Trafik Kaynağı", "İniş Sayfası", "Pixel / GA4", "WhatsApp / Form / Telefon", "CRM", "Teklif", "Satış", "Raporlama", "Yeniden Pazarlama"];
const simpleAdSteps = ["Reklam", "CTA", "WhatsApp / DM / Telefon", "CRM", "Takip", "Raporlama"];

function scoreCustomer(company: any, content: any = {}) {
  const data = content || {};
  if (!company) return { score: 0, status: "Veri yok", tone: "slate", reasons: ["Müşteri seçildiğinde büyüme sinyalleri hesaplanır."] };
  const today = new Date().toISOString().slice(0, 10);
  const tasks = (data.agencyTasks || []).filter((item: any) => item.company_id === company.id && !["Tamamlandı", "İptal"].includes(item.status));
  const payments = (data.paymentRecords || []).filter((item: any) => item.company_id === company.id);
  const reports = (data.reports || []).filter((item: any) => item.company_id === company.id);
  const overduePayments = payments.filter((item: any) => item.status === "Gecikmiş" || (item.due_date && item.due_date < today && item.status !== "Ödendi"));
  const integrationMissing = !(company.meta_account_id || company.google_ads_customer_id || company.ga4_property_id || company.search_console_site_url || company.gtm_container_id);
  let score = 86;
  if (overduePayments.length) score -= 22;
  if (tasks.length > 3) score -= 12;
  if (!reports.length) score -= 12;
  if (integrationMissing) score -= 18;
  const normalized = Math.max(0, Math.min(100, score));
  return {
    score: normalized,
    status: normalized >= 75 ? "Sağlıklı" : normalized >= 55 ? "Dikkat" : "Riskli",
    tone: normalized >= 75 ? "emerald" : normalized >= 55 ? "amber" : "red",
    reasons: [
      overduePayments.length ? `${overduePayments.length} geciken ödeme büyüme planını yavaşlatabilir.` : "Geciken ödeme görünmüyor.",
      tasks.length ? `${tasks.length} açık görev var; büyüme planına bağlanmalı.` : "Açık görev baskısı düşük.",
      reports.length ? "Rapor geçmişi var; karar verisi kullanılabilir." : "Rapor kaydı yok; ilk performans raporu hazırlanmalı.",
      integrationMissing ? "Meta / Google / GA4 / GTM entegrasyonlarından en az biri eksik." : "Temel entegrasyon sinyali mevcut."
    ]
  };
}

export function PremiumPageHeader({ eyebrow, title, description, actionLabel, onAction }: any) {
  return (
    <section className="overflow-hidden rounded-[30px] border border-cyan-300/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,.22),transparent_34%),linear-gradient(135deg,#020617,#0f172a_52%,#111827)] p-5 text-white shadow-[0_28px_80px_rgba(15,23,42,.28)] sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-4xl">
          <p className="text-xs font-black uppercase tracking-[.18em] text-cyan-200">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">{title}</h1>
          <p className="mt-4 text-sm leading-7 text-slate-200 sm:text-base">{description}</p>
        </div>
        {actionLabel && <button onClick={onAction} className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 shadow-[0_14px_35px_rgba(34,211,238,.22)] transition hover:-translate-y-0.5">{actionLabel}</button>}
      </div>
    </section>
  );
}

export function GlassPanel({ children, tone = "cyan" }: any) {
  const color = tone === "purple" ? "border-purple-200 bg-purple-50" : tone === "emerald" ? "border-emerald-200 bg-emerald-50" : tone === "amber" ? "border-amber-200 bg-amber-50" : "border-cyan-200 bg-cyan-50";
  return <div className={`rounded-[24px] border p-5 shadow-sm ${color}`}>{children}</div>;
}

export function FunnelStepCard({ step, index, status = "hazır", action = "Kontrol et" }: any) {
  const tone = status === "eksik" ? "border-amber-200 bg-amber-50 text-amber-900" : status === "öneriliyor" ? "border-purple-200 bg-purple-50 text-purple-900" : "border-cyan-100 bg-white text-slate-800";
  return <div className={`rounded-[16px] border p-4 ${tone}`}><span className="text-[10px] font-black uppercase tracking-[.12em] opacity-70">Adım {index + 1}</span><strong className="mt-1 block text-sm">{step}</strong><span className="mt-2 inline-flex rounded-full bg-white/70 px-2 py-1 text-[10px] font-black">{status} · {action}</span></div>;
}

function CustomerPicker({ companies = [], value, onChange }: any) {
  const safeCompanies = Array.isArray(companies) ? companies : [];
  return <label className="grid gap-2 text-sm font-black text-slate-700">Müşteri Seç<select value={value || ""} onChange={(event) => onChange(event.target.value)} className="min-h-11 rounded-[12px] border border-slate-200 bg-white px-3 text-sm text-slate-900"><option value="">Demo / genel plan</option>{safeCompanies.map((company: any) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>;
}

function AiRecommendationCard({ mode, customer, content }: any) {
  const health = scoreCustomer(customer, content);
  const platform = mode.includes("WhatsApp") ? "Meta + WhatsApp" : mode.includes("Instagram") ? "Instagram + Reels" : mode.includes("Telefon") ? "Google Ads + Telefon" : "Google Ads + Meta Yeniden Pazarlama";
  return (
    <GlassPanel tone="emerald">
      <p className="text-xs font-black uppercase tracking-[.16em] text-emerald-700">Yapay Zekâ Öneri Kartı</p>
      <h3 className="mt-2 text-xl font-black text-slate-950">{customer?.name || "Genel kampanya"} için büyüme önerisi</h3>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {[["Önerilen platform", platform], ["Hedef", "Kaliteli lead ve teklif görüşmesi"], ["Tahmini bütçe", "20.000 - 45.000 TL"], ["Müşteri sağlığı", `${health.score}/100 · ${health.status}`], ["İlk 7 gün planı", "Kurulum, veri toplama, kreatif test"], ["30 günlük plan", "Dönüşüm optimizasyonu, rapor ve remarketing"]].map(([label, value]) => <div key={label} className="rounded-[14px] bg-white p-3"><span className="text-[10px] font-black uppercase tracking-[.12em] text-emerald-700">{label}</span><strong className="mt-1 block text-sm text-slate-950">{value}</strong></div>)}
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-2">{health.reasons.map((reason) => <p key={reason} className="rounded-[12px] bg-white/80 p-3 text-xs font-bold leading-5 text-slate-700">{reason}</p>)}</div>
    </GlassPanel>
  );
}

function numberValue(item: any, keys: string[]) {
  for (const key of keys) {
    const value = Number(item?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

function belongsToCustomer(item: any, customerId?: string) {
  if (!customerId) return true;
  return item?.company_id === customerId || item?.customer_id === customerId || item?.client_id === customerId;
}

function integrationReady(customer: any, keys: string[]) {
  return keys.some((key) => Boolean(customer?.[key] || customer?.integrations?.[key]));
}

function metricSource(item: any) {
  return String(item?.source || item?.platform || item?.channel || item?.network || "").toLocaleLowerCase("tr");
}

function ratio(numerator: number, denominator: number, fallback = 0) {
  return denominator > 0 ? numerator / denominator : fallback;
}

export function AdsOperatingCenter({ content, setActive }: GrowthProps) {
  const data = content || {};
  const companies = Array.isArray(data.companies) ? data.companies : [];
  const activeCompanies = companies.filter((company: any) => company?.status !== "Pasif");
  const [companyId, setCompanyId] = useState(activeCompanies[0]?.id || companies[0]?.id || "");
  const [period, setPeriod] = useState("Son 30 Gün");
  const [funnelMode, setFunnelMode] = useState("WhatsApp Funnel");
  const customer = companies.find((company: any) => company?.id === companyId) || activeCompanies[0] || companies[0];
  const customerId = customer?.id;
  const campaigns = (Array.isArray(data.campaigns) ? data.campaigns : []).filter((item: any) => belongsToCustomer(item, customerId));
  const metrics = (Array.isArray(data.campaignMetrics) ? data.campaignMetrics : []).filter((item: any) => belongsToCustomer(item, customerId));
  const tasks = (Array.isArray(data.agencyTasks) ? data.agencyTasks : []).filter((item: any) => belongsToCustomer(item, customerId) && !["Tamamlandı", "İptal"].includes(item?.status));
  const reports = [...(Array.isArray(data.reports) ? data.reports : []), ...(Array.isArray(data.monthlyReports) ? data.monthlyReports : [])].filter((item: any) => belongsToCustomer(item, customerId));
  const payments = (Array.isArray(data.paymentRecords) ? data.paymentRecords : []).filter((item: any) => belongsToCustomer(item, customerId));
  const leads = (Array.isArray(data.leads) ? data.leads : []).filter((item: any) => belongsToCustomer(item, customerId));
  const proposals = (Array.isArray(data.proposals) ? data.proposals : []).filter((item: any) => belongsToCustomer(item, customerId));
  const metaRows = metrics.filter((item: any) => metricSource(item).includes("meta") || item?.meta_campaign_id);
  const googleRows = metrics.filter((item: any) => metricSource(item).includes("google") || item?.google_campaign_id);
  const spend = metrics.reduce((sum: number, item: any) => sum + numberValue(item, ["spend", "spent", "cost", "amount", "harcama"]), 0) || campaigns.reduce((sum: number, item: any) => sum + numberValue(item, ["spent_budget", "spent", "budget_used", "budget"]), 0);
  const metaSpend = metaRows.reduce((sum: number, item: any) => sum + numberValue(item, ["spend", "spent", "cost", "amount"]), 0);
  const googleSpend = googleRows.reduce((sum: number, item: any) => sum + numberValue(item, ["spend", "spent", "cost", "amount"]), 0);
  const impressions = metrics.reduce((sum: number, item: any) => sum + numberValue(item, ["impressions", "gosterim"]), 0);
  const reach = metrics.reduce((sum: number, item: any) => sum + numberValue(item, ["reach", "erisim"]), 0);
  const clicks = metrics.reduce((sum: number, item: any) => sum + numberValue(item, ["clicks", "link_clicks", "tiklama"]), 0);
  const messages = metrics.reduce((sum: number, item: any) => sum + numberValue(item, ["messages", "whatsapp_messages", "message_count"]), 0);
  const conversions = metrics.reduce((sum: number, item: any) => sum + numberValue(item, ["conversions", "leads", "form_leads", "sales"]), 0) || leads.length;
  const revenue = payments.filter((item: any) => ["Ödendi", "Tahsil Edildi", "paid"].includes(String(item?.status))).reduce((sum: number, item: any) => sum + numberValue(item, ["amount", "total", "price"]), 0);
  const ctr = ratio(clicks, impressions) * 100;
  const cpc = ratio(spend, clicks);
  const cpa = ratio(spend, conversions);
  const cpm = ratio(spend, impressions) * 1000;
  const roas = ratio(revenue, spend);
  const hasMeta = integrationReady(customer, ["meta_account_id", "meta_ad_account_id", "meta_pixel_id", "meta_business_id"]);
  const hasGoogle = integrationReady(customer, ["google_ads_customer_id", "google_ads_account_id"]);
  const hasPixel = integrationReady(customer, ["meta_pixel_id", "pixel_id"]);
  const hasGa4 = integrationReady(customer, ["ga4_property_id", "ga4_measurement_id"]);
  const hasWebsite = Boolean(customer?.website || customer?.website_url || customer?.domain);
  const healthReasons = [
    !hasPixel ? "Pixel eksik olduğu için dönüşüm ölçümü zayıf." : "",
    !hasGa4 ? "GA4 eksik veya müşteri profilinde görünmüyor." : "",
    ctr && ctr < 1 ? "CTR düşük; kreatif ve ilk mesaj güçlendirilmeli." : "",
    cpa && cpa > 750 ? "CPA yüksek; hedefleme ve teklif akışı gözden geçirilmeli." : "",
    roas && roas < 2 ? "ROAS düşük; bütçe ve teklif kalitesi kontrol edilmeli." : "",
    !hasWebsite ? "Website veya iniş sayfası bilgisi eksik." : "",
    !reports.length ? "Son rapor kaydı bulunmadı." : ""
  ].filter(Boolean);
  const healthScore = Math.max(0, Math.min(100, 96 - healthReasons.length * 9 - (tasks.length > 4 ? 8 : 0)));
  const channelCards = [
    ["Meta", hasMeta, hasPixel, metaRows[0]?.updated_at || metaRows[0]?.created_at, metaRows.length],
    ["Google", hasGoogle, hasGa4, googleRows[0]?.updated_at || googleRows[0]?.created_at, googleRows.length],
    ["Instagram", Boolean(customer?.instagram || customer?.instagram_url), hasMeta, customer?.updated_at, campaigns.filter((item: any) => String(item?.platform || "").includes("Instagram")).length],
    ["Website", hasWebsite, hasGa4, customer?.updated_at, reports.length],
    ["WhatsApp", Boolean(customer?.whatsapp || customer?.phone), Boolean(customer?.phone), customer?.updated_at, messages]
  ];
  const doctorChecks = [
    ["CTR", ctr >= 1 ? "İyi" : "Risk", ctr >= 1 ? "İlk mesaj ve kreatif yeterli sinyal veriyor." : "Yeni hook, daha net teklif ve güçlü görsel test edin.", ctr >= 1 ? "Orta" : "Yüksek"],
    ["CPA", !cpa || cpa < 750 ? "İyi" : "Risk", !cpa || cpa < 750 ? "Maliyet baskısı yönetilebilir." : "Hedef kitle, teklif ve funnel adımlarını sadeleştirin.", cpa < 750 ? "Orta" : "Yüksek"],
    ["Pixel", hasPixel ? "İyi" : "Eksik", hasPixel ? "Pixel sinyali müşteri profilinde var." : "Pixel kurulumu ve event kontrolü yapılmalı.", hasPixel ? "Düşük" : "Yüksek"],
    ["GA4", hasGa4 ? "İyi" : "Eksik", hasGa4 ? "GA4 sinyali müşteri profilinde var." : "GA4 Property / Measurement ID tamamlanmalı.", hasGa4 ? "Düşük" : "Yüksek"],
    ["Kreatif", campaigns.length ? "Kontrol" : "Eksik", campaigns.length ? "Kampanya var; kreatif yorgunluğu takip edilmeli." : "İlk kreatif brief ve metin hazırlanmalı.", "Orta"],
    ["Bütçe", spend > 0 ? "Kontrol" : "Eksik", spend > 0 ? "Harcama verisi okunuyor." : "Bütçe planı veya metrik girişi eksik.", spend > 0 ? "Orta" : "Yüksek"]
  ];
  const funnelSteps = funnelMode === "Funnelsız Reklam" ? simpleAdSteps : fullFunnelSteps;
  const formatMoney = (value: number) => `${Math.round(value || 0).toLocaleString("tr-TR")} TL`;
  const formatNumber = (value: number) => Math.round(value || 0).toLocaleString("tr-TR");
  return (
    <div className="grid gap-5">
      <PremiumPageHeader eyebrow="Reklam Operasyon Merkezi" title="Ajans reklam operasyonunu tek ekrandan yönet" description="Müşteri seç, mevcut Meta, Google, Pixel, GA4, Website, CRM, tahsilat, görev ve rapor sinyallerini birlikte oku; reklam sağlığı, funnel, doktor kontrolleri ve yayın öncesi planı tek merkezde takip et." actionLabel="Reklam Doktorunu Aç" onAction={() => setActive?.("Reklam Doktoru Pro")} />
      <GlassPanel tone="purple">
        <div className="grid gap-4 lg:grid-cols-[minmax(260px,.7fr)_minmax(0,1.3fr)]">
          <CustomerPicker companies={companies} value={customerId || ""} onChange={setCompanyId} />
          <div className="grid gap-3 md:grid-cols-4">
            {["Son 30 Gün", "Son 7 Gün", "Bugün", "Canlı durum"].map((item) => <button key={item} onClick={() => setPeriod(item)} className={`rounded-[14px] px-4 py-3 text-sm font-black ${period === item ? "bg-purple-600 text-white" : "border border-purple-100 bg-white text-purple-700"}`}>{item}</button>)}
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-purple-900">{customer?.name ? `${customer.name} için mevcut sistem verileri okunuyor.` : "Müşteri verisi yoksa genel ajans operasyon görünümü güvenli fallback ile gösterilir."} Yeni API anahtarı veya müşteri tarafından ayrı veri istenmez.</p>
      </GlassPanel>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        {[["Toplam Harcama", formatMoney(spend)], ["Meta Harcaması", formatMoney(metaSpend)], ["Google Harcaması", formatMoney(googleSpend)], ["Lead", formatNumber(conversions)], ["Teklif", formatNumber(proposals.length)], ["Satış", formatNumber(payments.filter((item: any) => ["Ödendi", "Tahsil Edildi", "paid"].includes(String(item?.status))).length)], ["ROAS", roas ? roas.toFixed(2) : "-"], ["CTR", `${ctr.toFixed(2)}%`], ["CPA", cpa ? formatMoney(cpa) : "-"], ["CPC", cpc ? formatMoney(cpc) : "-"], ["CPM", cpm ? formatMoney(cpm) : "-"], ["Gösterim", formatNumber(impressions)], ["Erişim", formatNumber(reach)], ["Tıklama", formatNumber(clicks)], ["Mesaj", formatNumber(messages)], ["WhatsApp", formatNumber(messages)], ["Telefon", formatNumber(leads.filter((item: any) => item?.phone).length)], ["Form", formatNumber(leads.filter((item: any) => String(item?.source || "").includes("Form")).length)]].map(([label, value]) => (
          <div key={label} className="rounded-[18px] border border-cyan-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300">
            <span className="text-[10px] font-black uppercase tracking-[.12em] text-cyan-700">{label}</span>
            <strong className="mt-2 block text-2xl text-slate-950">{value}</strong>
            <span className="mt-1 block text-xs font-bold text-slate-500">{period}</span>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <GlassPanel>
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">Kanal Komuta Merkezi</p><h3 className="mt-2 text-xl font-black text-slate-950">Meta, Google, Instagram, Website ve WhatsApp durumu</h3></div><button onClick={() => setActive?.("Entegrasyonlar")} className="rounded-full bg-cyan-500 px-4 py-2 text-xs font-black text-white">Entegrasyonları Kontrol Et</button></div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">{channelCards.map(([name, connected, tracking, lastSync, count]: any) => <div key={name} className="rounded-[16px] border border-slate-200 bg-white p-4"><strong className="block text-slate-950">{name}</strong><span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-black ${connected ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>{connected ? "Bağlı" : "Eksik"}</span><p className="mt-3 text-xs leading-5 text-slate-600">Ölçüm: {tracking ? "Hazır" : "Kontrol gerekli"}<br />Son veri: {lastSync ? new Date(lastSync).toLocaleDateString("tr-TR") : "Yok"}<br />Kayıt: {count || 0}</p></div>)}</div>
        </GlassPanel>
        <GlassPanel tone={healthScore >= 80 ? "emerald" : healthScore >= 60 ? "amber" : "purple"}>
          <p className="text-xs font-black uppercase tracking-[.16em] text-slate-700">Reklam Sağlığı</p>
          <h3 className="mt-2 text-5xl font-black text-slate-950">{healthScore}/100</h3>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-white"><span className="block h-full rounded-full bg-gradient-to-r from-cyan-400 via-purple-500 to-emerald-400" style={{ width: `${healthScore}%` }} /></div>
          <div className="mt-4 grid gap-2">{(healthReasons.length ? healthReasons : ["Temel reklam operasyon sinyalleri sağlıklı görünüyor."]).map((reason: string) => <p key={reason} className="rounded-[12px] bg-white p-3 text-xs font-bold leading-5 text-slate-700">{reason}</p>)}</div>
        </GlassPanel>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <GlassPanel tone="emerald">
          <p className="text-xs font-black uppercase tracking-[.16em] text-emerald-700">Yapay Zekâ Stratejisti</p>
          <h3 className="mt-2 text-xl font-black text-slate-950">{customer?.name || "Seçili müşteri"} için operasyon yorumu</h3>
          <div className="mt-4 grid gap-2">{["İyi giden taraf: mevcut müşteri, kampanya veya rapor sinyalleri tek merkezde okunuyor.", `İlk yapılacak 5 iş: ${hasPixel ? "Pixel doğrula" : "Pixel kur"}, ${hasGa4 ? "GA4 raporunu kontrol et" : "GA4 tamamla"}, kreatif test planla, CRM takip aşamasını güncelle, haftalık raporu hazırla.`, "7 günlük plan: ölçümleme kontrolü, kreatif testi, bütçe dağılımı, teklif takipleri ve rapor özeti.", "30 günlük plan: funnel optimizasyonu, yeniden pazarlama, teklif dönüşüm analizi ve müşteri yenileme aksiyonu.", `Bütçe önerisi: ${spend ? `${formatMoney(Math.max(spend * 0.15, 5000))} optimizasyon payı ayır.` : "İlk kampanya için kontrollü test bütçesi belirle."}`].map((item) => <p key={item} className="rounded-[12px] bg-white p-3 text-sm font-bold leading-6 text-slate-700">{item}</p>)}</div>
        </GlassPanel>
        <GlassPanel tone="amber">
          <p className="text-xs font-black uppercase tracking-[.16em] text-amber-700">Reklam Doktoru</p>
          <h3 className="mt-2 text-xl font-black text-slate-950">Gerçek kontrol listesi</h3>
          <div className="mt-4 grid gap-2">{doctorChecks.map(([name, status, solution, priority]) => <div key={name} className="rounded-[12px] bg-white p-3"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-slate-950">{name}</strong><span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-800">{status} · Öncelik: {priority}</span></div><p className="mt-2 text-xs font-bold leading-5 text-slate-600">{solution}</p></div>)}</div>
        </GlassPanel>
      </div>

      <GlassPanel>
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">Funnel Merkezi</p><h3 className="mt-2 text-xl font-black text-slate-950">Reklam akışını seç ve yayın öncesi kontrol et</h3></div><button onClick={() => setActive?.("Funnel Planlayıcı")} className="rounded-full bg-cyan-500 px-4 py-2 text-xs font-black text-white">Funnel Planlayıcıya Git</button></div>
        <div className="mt-4 flex flex-wrap gap-2">{["Funnelsız Reklam", "WhatsApp Funnel", "Web Sitesi Funnel", "Telefon Funnel", "Teklif Funnel", "Rezervasyon Funnel", "Marka Bilinirliği Funnel"].map((item) => <button key={item} onClick={() => setFunnelMode(item)} className={`rounded-full px-3 py-2 text-xs font-black ${funnelMode === item ? "bg-purple-600 text-white" : "border border-slate-200 bg-white text-slate-700"}`}>{item}</button>)}</div>
        <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-4">{funnelSteps.map((step, index) => <FunnelStepCard key={step} step={step} index={index} status={index < 2 ? "hazır" : index < 5 ? "öneriliyor" : "eksik"} action={index < 2 ? "Kontrol et" : "Planla"} />)}</div>
      </GlassPanel>

      <div className="grid gap-5 xl:grid-cols-2">
        <GlassPanel tone="purple"><p className="text-xs font-black uppercase tracking-[.16em] text-purple-700">Kreatif Merkezi</p><h3 className="mt-2 text-xl font-black text-slate-950">Mevcut kreatif ve kampanya hazırlıklarına erişim</h3><p className="mt-2 text-sm leading-6 text-slate-700">Görseller, videolar, son yüklenenler, eksikler ve yapay zekâ önerileri mevcut içerik / medya akışlarından yönetilir.</p><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => setActive?.("Medya")} className="rounded-full bg-purple-600 px-4 py-2 text-xs font-black text-white">Medya Merkezini Aç</button><button onClick={() => setActive?.("Kampanya Önerileri")} className="rounded-full border border-purple-200 bg-white px-4 py-2 text-xs font-black text-purple-700">Kreatif Önerisi Hazırla</button></div></GlassPanel>
        <GlassPanel tone="emerald"><p className="text-xs font-black uppercase tracking-[.16em] text-emerald-700">Kampanya Planlayıcı</p><h3 className="mt-2 text-xl font-black text-slate-950">Gerçek reklam açmadan yayın öncesi taslak oluştur</h3><div className="mt-4 grid gap-2">{["Platform", "Amaç", "Bütçe", "Hedef", "Kitle", "Kreatif", "Ölçümleme", "Yayın öncesi kontrol", "Taslak"].map((item, index) => <p key={item} className="rounded-[12px] bg-white p-3 text-sm font-bold text-slate-700">{index + 1}. {item}</p>)}</div></GlassPanel>
      </div>
    </div>
  );
}

export function GrowthEngineCenter({ content, setActive }: GrowthProps) {
  const data = content || {};
  const companies = (data.companies || []).filter((company: any) => company.status !== "Pasif");
  const [mode, setMode] = useState("Funnel Kur");
  const [companyId, setCompanyId] = useState(companies[0]?.id || "");
  const selectedCompany = companies.find((company: any) => company.id === companyId);
  const steps = mode === "Funnel Kur" ? fullFunnelSteps : simpleAdSteps;
  return (
    <div className="grid gap-5">
      <PremiumPageHeader eyebrow="Büyüme Motoru" title="Reklamdan önce satış yolculuğunu planla" description="Reklam açmak yerine müşterinin funnel yapısını, kreatif ihtiyacını, entegrasyonlarını ve takip sürecini tek ekranda netleştir." actionLabel="Yayın Öncesi Kontrolü Hazırla" onAction={() => setActive?.("Reklam Doktoru Pro")} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]">
        <GlassPanel tone="purple">
          <p className="text-xs font-black uppercase tracking-[.16em] text-purple-700">Kampanya Modu Seç</p>
          <div className="mt-4 flex flex-wrap gap-2">{campaignModes.map((item) => <button key={item} onClick={() => setMode(item)} className={`rounded-full px-3 py-2 text-xs font-black ${mode === item ? "bg-purple-600 text-white" : "border border-purple-100 bg-white text-purple-700"}`}>{item}</button>)}</div>
          <div className="mt-5 grid gap-4 md:grid-cols-2"><CustomerPicker companies={companies} value={companyId} onChange={setCompanyId} /><div className="rounded-[14px] bg-white p-4 text-sm text-slate-700"><strong className="block text-slate-950">Seçili mod</strong>{mode}<br /><span className="text-xs text-slate-500">Gerçek reklam yayına alma yapılmaz; yalnız plan ve kontrol listesi hazırlanır.</span></div></div>
        </GlassPanel>
        <GlassPanel tone="amber">
          <p className="text-xs font-black uppercase tracking-[.16em] text-amber-700">Kampanya Yayına Alma Hazırlığı</p>
          <h3 className="mt-2 text-xl font-black text-slate-950">Yayın öncesi kontrol listesi</h3>
          <div className="mt-4 grid gap-2">{["Meta bağlantısı durumu", "Google bağlantısı durumu", "Pixel / GA4 durumu", "Kreatif ve CTA netliği", "CRM takip aşaması", "Raporlama şablonu"].map((item) => <p key={item} className="rounded-[12px] bg-white p-3 text-sm font-bold text-amber-900"><CheckCircle2 className="mr-2 inline" size={15} />{item}</p>)}</div>
        </GlassPanel>
      </div>
      <GlassPanel>
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">{mode === "Funnel Kur" ? "Funnel Planı" : "Funnelsız Reklam Planı"}</p><h3 className="mt-2 text-xl font-black text-slate-950">{selectedCompany?.name || "Genel müşteri"} yol haritası</h3></div><button onClick={() => setActive?.("Görevler")} className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-black text-white">Plan çıktısını görevlerde aç</button></div>
        <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-4">{steps.map((step, index) => <FunnelStepCard key={step} step={step} index={index} status={index < 2 ? "hazır" : index < 5 ? "öneriliyor" : "eksik"} action={index < 2 ? "Hazırla" : "Planla"} />)}</div>
      </GlassPanel>
      <AiRecommendationCard mode={mode} customer={selectedCompany} content={data} />
    </div>
  );
}

export function FunnelBuilderCenter({ content, setActive }: GrowthProps) {
  const data = content || {};
  const companies = data.companies || [];
  const [companyId, setCompanyId] = useState(companies[0]?.id || "");
  const [goal, setGoal] = useState("Potansiyel Müşteri");
  const [channel, setChannel] = useState("Meta");
  const selectedCompany = companies.find((company: any) => company.id === companyId);
  const steps = useMemo(() => fullFunnelSteps.map((step, index) => ({ step, status: index < 2 ? "hazır" : index < 6 ? "öneriliyor" : "eksik", action: index < 2 ? "Mevcut varlığı kontrol et" : "Kurulum veya içerik üret" })), []);
  const missing = steps.filter((item) => item.status === "eksik");
  return (
    <div className="grid gap-5">
      <PremiumPageHeader eyebrow="Funnel Planlayıcı" title="Müşteriye özel funnel şablonu oluştur" description="Sürükle-bırak yerine güvenli kart tabanlı planlayıcı ile müşteri, amaç, kanal ve eksik adımları planlayın." actionLabel="Eksikleri Göster" onAction={() => null} />
      <GlassPanel tone="purple"><div className="grid gap-4 md:grid-cols-3"><CustomerPicker companies={companies} value={companyId} onChange={setCompanyId} /><label className="grid gap-2 text-sm font-black text-slate-700">Funnel amacı<select value={goal} onChange={(event) => setGoal(event.target.value)} className="min-h-11 rounded-[12px] border border-slate-200 bg-white px-3">{funnelGoals.map((item) => <option key={item}>{item}</option>)}</select></label><label className="grid gap-2 text-sm font-black text-slate-700">Kanal<select value={channel} onChange={(event) => setChannel(event.target.value)} className="min-h-11 rounded-[12px] border border-slate-200 bg-white px-3">{channels.map((item) => <option key={item}>{item}</option>)}</select></label></div></GlassPanel>
      <GlassPanel><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">Funnel adımları</p><h3 className="mt-2 text-xl font-black text-slate-950">{selectedCompany?.name || "Genel müşteri"} · {goal} · {channel}</h3></div><div className="flex flex-wrap gap-2"><button className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-black text-amber-800">Eksikleri Göster: {missing.length}</button><button className="rounded-full bg-cyan-500 px-4 py-2 text-xs font-black text-white">Yapay Zekâ Plan Öner</button><button onClick={() => setActive?.("Müşteri Raporları")} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700">Raporla / PDF</button></div></div><div className="mt-4 grid gap-3 md:grid-cols-3">{steps.map((item, index) => <FunnelStepCard key={item.step} step={item.step} index={index} status={item.status} action={item.action} />)}</div><pre className="mt-4 whitespace-pre-wrap rounded-[16px] bg-slate-950 p-4 text-xs leading-6 text-slate-100">{`${selectedCompany?.name || "Müşteri"} için ${goal} odaklı ${channel} funnel planı hazırlandı.\nEksikler: ${missing.map((item) => item.step).join(", ") || "Eksik yok"}.\nPDF/rapor çıktısı için Rapor Merkezi’nde bu plan metni kullanılabilir.`}</pre></GlassPanel>
    </div>
  );
}

export function GrowthMarketplaceCenter({ setActive }: GrowthProps) {
  const packages = ["Meta Ads Modülü", "Google Ads Modülü", "WhatsApp Funnel", "E-Ticaret Funnel", "Klinik Paketi", "Güzellik Merkezi Paketi", "Oto Galeri Paketi", "Emlak Paketi", "Raporlama Paketi", "Yapay Zekâ Kreatif Paketi"];
  return (
    <div className="grid gap-5">
      <PremiumPageHeader eyebrow="Modül Pazarı" title="Büyüme paketlerinden plan oluştur" description="Satın alma veya ödeme yoktur. Bu alan paketleri inceleyip Büyüme Motoru içinde strateji planına dönüştürmek için kullanılır." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{packages.map((item, index) => <GlassPanel key={item} tone={index % 3 === 0 ? "purple" : index % 3 === 1 ? "cyan" : "emerald"}><PackageCheck className="text-cyan-700" size={24} /><h3 className="mt-3 text-lg font-black text-slate-950">{item}</h3><p className="mt-2 text-sm leading-6 text-slate-600">Kimler için uygun? {item.includes("Klinik") ? "Sağlık ve randevu odaklı işletmeler" : item.includes("Rapor") ? "Düzenli performans raporu isteyen ajans müşterileri" : "Lead, teklif ve reklam performansı büyütmek isteyen müşteriler"}.</p><span className="mt-3 inline-flex rounded-full bg-white px-3 py-1 text-xs font-black text-slate-700 ring-1 ring-slate-200">Kurulum durumu: {index < 3 ? "Aktif" : index < 8 ? "Hazır" : "Yakında"}</span><div className="mt-4 flex flex-wrap gap-2"><button className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700">İncele</button><button onClick={() => setActive?.("Büyüme Motoru")} className="rounded-full bg-cyan-500 px-4 py-2 text-xs font-black text-white">Bu paketten plan oluştur</button></div></GlassPanel>)}</div>
    </div>
  );
}

export function CustomerGrowthPanel({ company, content, setActive }: GrowthProps) {
  const data = content || {};
  if (!company) {
    return (
      <GlassPanel tone="amber">
        <p className="text-xs font-black uppercase tracking-[.16em] text-amber-700">Büyüme</p>
        <h3 className="mt-2 text-xl font-black text-slate-950">Müşteri seçimi bekleniyor</h3>
        <p className="mt-2 text-sm leading-6 text-amber-900">Büyüme planı, sağlık skoru ve funnel yol haritası için önce müşteri profili seçilmelidir.</p>
      </GlassPanel>
    );
  }
  const health = scoreCustomer(company, data);
  const tasks = (data.agencyTasks || []).filter((item: any) => item.company_id === company?.id && !["Tamamlandı", "İptal"].includes(item.status));
  const payments = (data.paymentRecords || []).filter((item: any) => item.company_id === company?.id);
  const reports = (data.reports || []).filter((item: any) => item.company_id === company?.id);
  const integrationMissing = !(company?.meta_account_id || company?.google_ads_customer_id || company?.ga4_property_id || company?.search_console_site_url || company?.gtm_container_id);
  const recommendedFunnel = integrationMissing ? "Funnel Kur + Pixel/GA4 tamamla" : health.score < 65 ? "WhatsApp Odaklı Kampanya" : "Google Ads + Yeniden Pazarlama Funnel";
  const actionPlan = integrationMissing
    ? ["Entegrasyonları tamamla", "Kampanya hedefini belirle", "İlk funnel planını oluştur"]
    : ["3 kreatif fikri hazırla", "7 günlük reklam sağlık raporu oluştur", "Teklif ve CRM takip aşamasını bağla"];
  return (
    <div className="grid gap-5">
      <GlassPanel tone="purple"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.16em] text-purple-700">Büyüme</p><h3 className="mt-2 text-2xl font-black text-slate-950">{company?.name} büyüme özeti</h3><p className="mt-2 text-sm leading-6 text-slate-700">Bu müşteri için ilk iş: {actionPlan[0]}.</p></div><span className={`rounded-full px-4 py-2 text-sm font-black ${health.tone === "emerald" ? "bg-emerald-100 text-emerald-700" : health.tone === "amber" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-700"}`}>Sağlık: {health.score}/100 · {health.status}</span></div></GlassPanel>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{[["Önerilen funnel", recommendedFunnel], ["Açık görev", tasks.length], ["Tahsilat durumu", payments.some((item: any) => item.status === "Gecikmiş") ? "Geciken ödeme var" : "Normal"], ["Rapor durumu", reports.length ? "Rapor kaydı var" : "Rapor bekliyor"]].map(([label, value]) => <div key={label} className="rounded-[18px] border border-slate-200 bg-white p-4"><span className="text-[10px] font-black uppercase tracking-[.12em] text-slate-500">{label}</span><strong className="mt-2 block text-lg text-slate-950">{value}</strong></div>)}</div>
      <GlassPanel><h3 className="font-black text-slate-950">Funnel yol haritası</h3><div className="mt-4 grid gap-3 md:grid-cols-3">{fullFunnelSteps.slice(0, 6).map((step, index) => <FunnelStepCard key={step} step={step} index={index} status={index < 2 ? "hazır" : integrationMissing && index < 4 ? "eksik" : "öneriliyor"} action={index < 2 ? "Kontrol et" : "Planla"} />)}</div></GlassPanel>
      <div className="grid gap-4 lg:grid-cols-2"><GlassPanel tone="emerald"><h3 className="font-black text-slate-950">7 günlük aksiyon planı</h3><div className="mt-3 grid gap-2">{actionPlan.map((item) => <p key={item} className="rounded-[12px] bg-white p-3 text-sm font-bold text-slate-700">{item}</p>)}</div></GlassPanel><GlassPanel tone="amber"><h3 className="font-black text-slate-950">Marka Özelleştirme Hazırlık</h3><div className="mt-3 grid gap-2 text-sm text-amber-900">{["Müşteri logosu", "Panel başlığı", "Marka rengi", "Rapor dili", "Müşteri panelinde marka görünümü"].map((item) => <p key={item} className="rounded-[12px] bg-white p-3 font-bold">{item}: {company?.brand_assets?.[item] ? "Hazır" : "Hazırlık bekliyor"}</p>)}</div></GlassPanel></div>
      <GlassPanel tone="purple"><h3 className="font-black text-slate-950">30 günlük büyüme planı</h3><p className="mt-2 text-sm leading-6 text-purple-900">İlk hafta kurulum ve veri toplama, ikinci hafta kreatif test, üçüncü hafta teklif/landing page iyileştirme, dördüncü hafta raporlama ve yenileme önerisi.</p><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => setActive?.("Büyüme Motoru")} className="rounded-full bg-purple-600 px-4 py-2 text-xs font-black text-white">Büyüme Motoru’de Aç</button><button onClick={() => setActive?.("Funnel Planlayıcı")} className="rounded-full border border-purple-200 bg-white px-4 py-2 text-xs font-black text-purple-700">Funnel Planlayıcı’a Git</button></div></GlassPanel>
    </div>
  );
}
