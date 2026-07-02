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
