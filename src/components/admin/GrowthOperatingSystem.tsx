"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useState } from "react";
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

function metricSource(item: any) {
  return String(item?.source || item?.platform || item?.channel || item?.network || "").toLocaleLowerCase("tr");
}

function ratio(numerator: number, denominator: number, fallback = 0) {
  return denominator > 0 ? numerator / denominator : fallback;
}

function normalizeKey(value: unknown) {
  return String(value || "").toLocaleLowerCase("tr").replace(/[^a-z0-9ığüşöç]+/g, "_");
}

function firstValue(...values: unknown[]) {
  return values.map((value) => String(value ?? "").trim()).find(Boolean) || "";
}

function valueFromPayload(item: any, keys: string[]) {
  const payloads = [item?.manual_payload, item?.metadata, item];
  for (const payload of payloads) {
    if (!payload || typeof payload !== "object") continue;
    for (const key of keys) {
      const direct = payload[key];
      if (direct !== undefined && direct !== null && String(direct).trim()) return String(direct).trim();
    }
  }
  return "";
}

function methodDisplay(value: string) {
  const normalized = normalizeKey(value);
  if (normalized.includes("oauth")) return "Otomatik OAuth";
  if (normalized.includes("manual") || normalized.includes("manuel")) return "Manuel";
  return value || "Belirtilmedi";
}

function normalizeIntegrationAccounts(rows: any[]) {
  const accounts: any[] = [];
  const pushAccount = (raw: any, row: any = raw) => {
    const platformKey = normalizeKey(raw?.platform || raw?.provider || row?.platform || row?.provider || raw?.platform_label);
    const typeKey = normalizeKey(raw?.account_type || raw?.asset_type || raw?.oauth_asset_type || row?.account_type || row?.oauth_asset_type);
    const provider = normalizeKey(raw?.provider || row?.provider || platformKey);
    const metaAdId = valueFromPayload(raw, ["meta_ad_account_id", "ad_account_id", "account_id", "provider_account_id"]);
    const googleAdsId = valueFromPayload(raw, ["google_ads_customer_id", "customer_id", "provider_account_id", "account_id"]);
    const ga4Id = valueFromPayload(raw, ["ga4_property_id", "property_id", "ga4_measurement_id", "measurement_id"]);
    const pixelId = valueFromPayload(raw, ["meta_pixel_id", "pixel_id", "dataset_id", "meta_dataset_id"]);
    const websiteUrl = valueFromPayload(raw, ["website_url", "site_url", "domain"]);
    const searchConsoleUrl = valueFromPayload(raw, ["search_console_site_url", "site_url", "domain_property"]);
    const accountId = firstValue(raw?.provider_account_id, raw?.account_id, raw?.asset_id, metaAdId, googleAdsId, ga4Id, pixelId, websiteUrl);
    const accountName = firstValue(raw?.provider_account_name, raw?.asset_name, raw?.account_name, raw?.platform_label, row?.provider_account_name, row?.asset_name);
    const method = firstValue(raw?.connection_method, raw?.connection_mode, row?.connection_method, row?.connection_mode, raw?.source);
    const status = firstValue(raw?.status, row?.status, raw?.admin_review_status, row?.admin_review_status);
    const lastDate = firstValue(raw?.last_synced_at, row?.last_synced_at, raw?.updated_at, row?.updated_at, raw?.created_at, row?.created_at);
    const base = {
      id: firstValue(raw?.id, `${provider || platformKey}-${typeKey || "account"}-${accountId || accounts.length}`),
      platformKey,
      typeKey,
      provider,
      accountId,
      accountName,
      method,
      status,
      lastDate,
      syncError: firstValue(raw?.sync_error, raw?.connection_error, row?.sync_error, row?.connection_error),
      raw,
      row
    };

    const isMeta = provider.includes("meta") || platformKey.includes("meta") || platformKey.includes("facebook");
    const isInstagram = platformKey.includes("instagram") || typeKey.includes("instagram");
    const isTikTok = provider.includes("tiktok") || platformKey.includes("tiktok");
    const isGoogleAds = platformKey.includes("google_ads") || typeKey.includes("google_ads") || typeKey.includes("ads_customer") || Boolean(googleAdsId);
    const isGa4 = platformKey.includes("analytics") || platformKey.includes("ga4") || typeKey.includes("ga4") || typeKey.includes("analytics") || Boolean(ga4Id);
    const isYouTube = platformKey.includes("youtube") || typeKey.includes("youtube");
    const isSearch = platformKey.includes("search_console") || typeKey.includes("search_console") || Boolean(searchConsoleUrl);
    const isX = provider === "x" || platformKey.includes("twitter") || platformKey.includes("x_twitter") || typeKey.includes("x_");
    const isWebsite = platformKey.includes("website") || platformKey.includes("pixel") || typeKey.includes("website") || typeKey.includes("pixel") || Boolean(websiteUrl || pixelId);
    const isMetaAd = isMeta && (typeKey.includes("ad_account") || typeKey.includes("meta_ads") || Boolean(metaAdId));
    const isPixel = typeKey.includes("pixel") || typeKey.includes("dataset") || Boolean(pixelId);
    const isTikTokAd = isTikTok && (typeKey.includes("advertiser") || typeKey.includes("ads") || Boolean(accountId));
    const isXAds = isX && typeKey.includes("ads");

    const add = (kind: string, id: string, name = accountName) => {
      if (!id && !["instagram", "website"].includes(kind)) return;
      accounts.push({ ...base, kind, accountId: id || accountId || websiteUrl || accountName, accountName: name || accountName || id || kind });
    };
    if (isMetaAd) add("meta_ad_account", metaAdId || accountId);
    if (isGoogleAds) add("google_ads_customer", googleAdsId || accountId);
    if (isTikTokAd) add("tiktok_advertiser", accountId);
    if (isXAds) add("x_ads_account", accountId);
    if (isX && !isXAds) add("x_profile", accountId);
    if (isGa4) add("ga4_property", ga4Id || accountId);
    if (isYouTube) add("youtube_channel", accountId);
    if (isPixel) add("pixel_dataset", pixelId || accountId);
    if (isInstagram) add("instagram", accountId || firstValue(raw?.username, raw?.instagram_account_id, raw?.provider_account_name));
    if (isWebsite) add("website", websiteUrl || accountId);
    if (isSearch) add("search_console", searchConsoleUrl || accountId);
  };

  for (const row of rows) {
    const assets = Array.isArray(row?.integration_assets) ? row.integration_assets : [];
    assets.forEach((asset: any) => pushAccount(asset, row));
    pushAccount(row, row);
  }
  const seen = new Set<string>();
  return accounts.filter((account) => {
    const key = `${account.kind}-${account.accountId}-${account.accountName}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function AdsOperatingCenter({ content, setActive }: GrowthProps) {
  const data = content || {};
  const companies = Array.isArray(data.companies) ? data.companies : [];
  const integrations = Array.isArray(data.customerIntegrations) ? data.customerIntegrations : [];
  const activeCompanies = companies.filter((company: any) => company?.status !== "Pasif");
  const [companyId, setCompanyId] = useState(activeCompanies[0]?.id || companies[0]?.id || "");
  const [period, setPeriod] = useState("Son 30 Gün");
  const [adAccount, setAdAccount] = useState("");
  const [remoteIntegrations, setRemoteIntegrations] = useState<any[]>([]);
  const [integrationsLoading, setIntegrationsLoading] = useState(false);
  const [integrationError, setIntegrationError] = useState("");
  const [integrationsRefreshedAt, setIntegrationsRefreshedAt] = useState("");
  const [planTab, setPlanTab] = useState("Bugün");
  const [funnelMode, setFunnelMode] = useState("WhatsApp Funnel");
  const customer = companies.find((company: any) => company?.id === companyId) || activeCompanies[0] || companies[0];
  const customerId = customer?.id;
  const localIntegration = integrations.find((item: any) => item?.company_id === customerId || item?.customer_id === customerId) || {};
  const integrationRows = remoteIntegrations.length ? remoteIntegrations : localIntegration?.id ? [localIntegration] : [];
  const linkedAccounts = normalizeIntegrationAccounts(integrationRows);
  const selectedLinkedAccount = linkedAccounts.find((item) => item.id === adAccount);
  const accountOptions = linkedAccounts
    .filter((item) => ["meta_ad_account", "google_ads_customer", "tiktok_advertiser", "x_ads_account"].includes(item.kind))
    .map((item) => ({ value: item.id, label: `${item.kind === "meta_ad_account" ? "Meta" : item.kind === "google_ads_customer" ? "Google Ads" : item.kind === "x_ads_account" ? "X Ads" : "TikTok"} · ${item.accountName || "Hesap"} · ${item.accountId || "ID yok"}` }));
  const accountByKind = (kind: string) => linkedAccounts.find((item) => item.kind === kind);
  const metaAccount = accountByKind("meta_ad_account");
  const googleAdsAccount = accountByKind("google_ads_customer");
  const tiktokAccount = accountByKind("tiktok_advertiser");
  const xAdsAccount = accountByKind("x_ads_account");
  const xProfileAccount = accountByKind("x_profile");
  const ga4Account = accountByKind("ga4_property");
  const youtubeAccount = accountByKind("youtube_channel");
  const pixelAccount = accountByKind("pixel_dataset");
  const websiteAccount = accountByKind("website");
  const instagramAccount = accountByKind("instagram");
  const searchConsoleAccount = accountByKind("search_console");
  const valueFor = (keys: string[]) => keys.map((key) => localIntegration?.[key] || customer?.[key] || customer?.integrations?.[key]).find(Boolean) || "";
  const metaAdAccountId = firstValue(metaAccount?.accountId, valueFor(["meta_ad_account_id", "meta_account_id", "ad_account_id"]));
  const pixelId = firstValue(pixelAccount?.accountId, valueFor(["meta_pixel_id", "pixel_id"]));
  const datasetId = firstValue(valueFor(["meta_dataset_id", "dataset_id"]), pixelAccount?.typeKey?.includes("dataset") ? pixelAccount.accountId : "");
  const googleAdsCustomerId = firstValue(googleAdsAccount?.accountId, valueFor(["google_ads_customer_id", "google_ads_account_id"]));
  const ga4PropertyId = firstValue(ga4Account?.accountId, valueFor(["ga4_property_id", "ga4_measurement_id"]));
  const gtmId = valueFor(["gtm_container_id", "gtm_id"]);
  const websiteUrl = firstValue(websiteAccount?.accountId, valueFor(["website_url", "website", "domain"]));

  const loadCustomerIntegrations = useCallback(async () => {
    if (!customerId) return;
    setIntegrationsLoading(true);
    setIntegrationError("");
    try {
      const response = await fetch(`/api/admin/companies/${encodeURIComponent(customerId)}/integrations`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.supabaseError || payload.error || "Müşteri entegrasyonları alınamadı.");
      setRemoteIntegrations(Array.isArray(payload.integrations) ? payload.integrations : []);
      setIntegrationsRefreshedAt(new Date().toISOString());
    } catch (error) {
      setRemoteIntegrations([]);
      setIntegrationError(error instanceof Error ? error.message : "Müşteri entegrasyonları alınamadı.");
    } finally {
      setIntegrationsLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    setAdAccount("");
    setRemoteIntegrations([]);
    setIntegrationError("");
    loadCustomerIntegrations();
  }, [loadCustomerIntegrations]);

  useEffect(() => {
    if (!adAccount && accountOptions[0]?.value) setAdAccount(accountOptions[0].value);
    if (adAccount && accountOptions.length && !accountOptions.some((item) => item.value === adAccount)) setAdAccount(accountOptions[0].value);
  }, [adAccount, accountOptions]);
  const accountScoped = (item: any) => {
    if (!customerId || !belongsToCustomer(item, customerId)) return false;
    const source = metricSource(item);
    if (source.includes("meta") || item?.meta_campaign_id || item?.meta_ad_account_id || item?.ad_account_id) {
      if (!metaAdAccountId) return false;
      const ids = [item?.meta_ad_account_id, item?.ad_account_id, item?.account_id].filter(Boolean).map(String);
      return ids.length ? ids.includes(String(metaAdAccountId)) : true;
    }
    if (source.includes("google") || item?.google_campaign_id || item?.google_ads_customer_id) {
      if (!googleAdsCustomerId) return false;
      const ids = [item?.google_ads_customer_id, item?.customer_id, item?.account_id].filter(Boolean).map(String);
      return ids.length ? ids.includes(String(googleAdsCustomerId)) : true;
    }
    return true;
  };
  const campaigns = (Array.isArray(data.campaigns) ? data.campaigns : []).filter((item: any) => accountScoped(item));
  const metrics = (Array.isArray(data.campaignMetrics) ? data.campaignMetrics : []).filter((item: any) => accountScoped(item));
  const tasks = (Array.isArray(data.agencyTasks) ? data.agencyTasks : []).filter((item: any) => belongsToCustomer(item, customerId) && !["Tamamlandı", "İptal"].includes(item?.status));
  const reports = [...(Array.isArray(data.reports) ? data.reports : []), ...(Array.isArray(data.monthlyReports) ? data.monthlyReports : [])].filter((item: any) => belongsToCustomer(item, customerId));
  const payments = (Array.isArray(data.paymentRecords) ? data.paymentRecords : []).filter((item: any) => belongsToCustomer(item, customerId));
  const leads = (Array.isArray(data.leads) ? data.leads : []).filter((item: any) => belongsToCustomer(item, customerId));
  const proposals = (Array.isArray(data.proposals) ? data.proposals : []).filter((item: any) => belongsToCustomer(item, customerId));
  const metaRows = metrics.filter((item: any) => metricSource(item).includes("meta") || item?.meta_campaign_id);
  const googleRows = metrics.filter((item: any) => metricSource(item).includes("google") || item?.google_campaign_id);
  const spend = metrics.reduce((sum: number, item: any) => sum + numberValue(item, ["spend", "spent", "cost", "amount", "harcama"]), 0) || campaigns.reduce((sum: number, item: any) => sum + numberValue(item, ["spent_budget", "spent", "budget_used", "budget"]), 0);
  const impressions = metrics.reduce((sum: number, item: any) => sum + numberValue(item, ["impressions", "gosterim"]), 0);
  const clicks = metrics.reduce((sum: number, item: any) => sum + numberValue(item, ["clicks", "link_clicks", "tiklama"]), 0);
  const messages = metrics.reduce((sum: number, item: any) => sum + numberValue(item, ["messages", "whatsapp_messages", "message_count"]), 0);
  const formLeads = metrics.reduce((sum: number, item: any) => sum + numberValue(item, ["form_leads", "forms", "form"]), 0);
  const phoneLeads = leads.filter((item: any) => item?.phone).length;
  const conversions = metrics.reduce((sum: number, item: any) => sum + numberValue(item, ["conversions", "leads", "form_leads", "sales"]), 0) || leads.length;
  const revenue = payments.filter((item: any) => ["Ödendi", "Tahsil Edildi", "paid"].includes(String(item?.status))).reduce((sum: number, item: any) => sum + numberValue(item, ["amount", "total", "price"]), 0);
  const ctr = ratio(clicks, impressions) * 100;
  const cpc = ratio(spend, clicks);
  const cpa = ratio(spend, conversions);
  const roas = ratio(revenue, spend);
  const integrationStatusRows = [
    { label: "Meta reklam hesabı", ok: Boolean(metaAdAccountId), detail: metaAdAccountId ? `Bağlı: ${metaAccount?.accountName || metaAdAccountId} · ${metaAdAccountId}` : "Eksik", method: methodDisplay(metaAccount?.method || localIntegration.connection_method) },
    { label: "Google Ads müşteri ID", ok: Boolean(googleAdsCustomerId), detail: googleAdsCustomerId ? `Bağlı: ${googleAdsAccount?.accountName || googleAdsCustomerId} · ${googleAdsCustomerId}` : "Eksik", method: methodDisplay(googleAdsAccount?.method || localIntegration.connection_method) },
    { label: "GA4 Property ID", ok: Boolean(ga4PropertyId), detail: ga4PropertyId ? `Bağlı: ${ga4Account?.accountName || ga4PropertyId} · ${ga4PropertyId}` : "Eksik", method: methodDisplay(ga4Account?.method || localIntegration.connection_method) },
    { label: "Pixel/Dataset", ok: Boolean(pixelId || datasetId), detail: pixelId || datasetId ? `Bağlı: ${pixelAccount?.accountName || pixelId || datasetId}` : "Eksik", method: methodDisplay(pixelAccount?.method || localIntegration.connection_method) }
  ];
  const healthReasons = [
    ...integrationStatusRows.filter((item) => !item.ok).map((item) => `${item.label}: Eksik`),
    integrationError ? `Entegrasyon API hatası: ${integrationError}` : "",
    integrationsLoading ? "Müşteri entegrasyonları yükleniyor." : "",
    linkedAccounts.length && !accountOptions.length ? "Bağlı entegrasyon var ancak reklam hesabı türünde kayıt bulunamadı." : "",
    accountOptions.length && !metrics.length ? "Hesap bağlı, ancak canlı reklam verisi için API izinleri veya metrik senkronizasyonu gerekiyor." : "",
    !websiteUrl ? "Website URL müşteri profilinde görünmüyor." : "",
    !metrics.length ? "Bu tarih aralığında eşleşen reklam verisi bulunamadı." : "",
    ctr && ctr < 1 ? "Tıklama Oranı düşük; kreatif ve teklif dili kontrol edilmeli." : "",
    cpa && cpa > 750 ? "Dönüşüm Maliyeti yüksek; hedef kitle ve funnel sadeleşmeli." : ""
  ].filter(Boolean);
  const healthScore = Math.max(0, Math.min(100, 96 - healthReasons.length * 8 - (tasks.length > 4 ? 6 : 0)));
  const lastDataDate = [...metrics, ...campaigns, ...reports].map((item: any) => item?.updated_at || item?.created_at || item?.report_date).filter(Boolean).sort().at(-1);
  const channelCards = [
    { name: "Meta", account: metaAccount, connected: Boolean(metaAdAccountId), tracking: Boolean(pixelId || datasetId), lastSync: metaAccount?.lastDate || metaRows[0]?.updated_at || metaRows[0]?.created_at, action: metaAdAccountId ? "Detay Gör" : "Hesap Ekle" },
    { name: "Google Ads", account: googleAdsAccount, connected: Boolean(googleAdsCustomerId), tracking: Boolean(googleAdsCustomerId), lastSync: googleAdsAccount?.lastDate || googleRows[0]?.updated_at || googleRows[0]?.created_at, action: googleAdsCustomerId ? "Detay Gör" : "Hesap Ekle" },
    { name: "Instagram", account: instagramAccount, connected: Boolean(instagramAccount || customer?.instagram || customer?.instagram_url), tracking: Boolean(metaAdAccountId), lastSync: instagramAccount?.lastDate || customer?.updated_at, action: instagramAccount ? "Detay Gör" : "Hesap Ekle" },
    { name: "Website", account: websiteAccount, connected: Boolean(websiteUrl), tracking: Boolean(ga4PropertyId || gtmId || pixelId), lastSync: websiteAccount?.lastDate || customer?.updated_at, action: websiteUrl ? "Detay Gör" : "Hesap Ekle" },
    { name: "WhatsApp", account: null, connected: Boolean(customer?.whatsapp || customer?.phone), tracking: Boolean(customer?.phone), lastSync: customer?.updated_at, action: "Müşteri Profilini Aç" },
    { name: "TikTok", account: tiktokAccount, connected: Boolean(tiktokAccount), tracking: Boolean(tiktokAccount), lastSync: tiktokAccount?.lastDate, action: tiktokAccount ? "Detay Gör" : "Hesap Ekle" },
    { name: "X / Twitter", account: xAdsAccount || xProfileAccount, connected: Boolean(xAdsAccount || xProfileAccount), tracking: Boolean(xAdsAccount), lastSync: xAdsAccount?.lastDate || xProfileAccount?.lastDate, action: xAdsAccount || xProfileAccount ? "Detay Gör" : "Hesap Ekle" },
    { name: "Google Analytics", account: ga4Account, connected: Boolean(ga4PropertyId), tracking: Boolean(ga4PropertyId), lastSync: ga4Account?.lastDate, action: ga4PropertyId ? "Detay Gör" : "Hesap Ekle" },
    { name: "YouTube", account: youtubeAccount, connected: Boolean(youtubeAccount), tracking: Boolean(youtubeAccount), lastSync: youtubeAccount?.lastDate, action: youtubeAccount ? "Detay Gör" : "Hesap Ekle" },
    { name: "Search Console", account: searchConsoleAccount, connected: Boolean(searchConsoleAccount), tracking: Boolean(searchConsoleAccount), lastSync: searchConsoleAccount?.lastDate, action: searchConsoleAccount ? "Detay Gör" : "Hesap Ekle" }
  ];
  const doctorChecks = [
    ["Ölçüm", metrics.length ? "Hazır" : "Eksik", metrics.length ? "Eşleşen müşteri reklam verisi okunuyor." : "Müşteri profiline reklam hesabı ID ekleyin ve veriyi yenileyin.", "Yüksek"],
    ["Pixel / Dataset", pixelId && datasetId ? "Hazır" : "Eksik", pixelId && datasetId ? "Web sitesi takip kodu ve Meta veri bağlantısı eşleşmiş." : "Pixel ID ve Dataset ID müşteri entegrasyonlarında tamamlanmalı.", "Yüksek"],
    ["GA4", ga4PropertyId ? "Hazır" : "Eksik", ga4PropertyId ? "Google Analytics ölçümü bağlı görünüyor." : "GA4 Property ID girilmeden Google tarafı eksik kalır.", "Yüksek"],
    ["Kreatif", campaigns.length ? "Kontrol" : "Eksik", campaigns.length ? "Kampanya var; kreatif yorgunluğu izlenmeli." : "İlk görsel/video brief hazırlanmalı.", "Orta"],
    ["Bütçe", spend > 0 ? "Kontrol" : "Eksik", spend > 0 ? "Harcama verisi var." : "Bütçe veya metrik verisi yok.", "Orta"],
    ["Hedef Kitle", campaigns.length ? "Kontrol" : "Planla", "Kitle daralması ve teklif uyumu haftalık kontrol edilmeli.", "Orta"],
    ["Funnel", proposals.length || leads.length ? "Kontrol" : "Planla", "CRM, teklif ve takip adımları reklam akışına bağlanmalı.", "Orta"],
    ["Raporlama", reports.length ? "Hazır" : "Eksik", reports.length ? "Rapor kaydı var." : "İlk müşteri raporu hazırlanmalı.", "Orta"]
  ];
  const funnelSteps = ["Trafik Kaynağı", "Landing Page", "Pixel / GA4", "WhatsApp / Form / Telefon", "CRM", "Teklif", "Satış", "Raporlama", "Yeniden Pazarlama"];
  const planItems: Record<string, string[]> = {
    "Bugün": ["Müşteri entegrasyon ID’lerini doğrula", "Reklam verisinin doğru hesaptan geldiğini kontrol et", "Açık görev ve teklifleri gözden geçir"],
    "7 Günlük Plan": ["Kreatif test seti hazırla", "Pixel / GA4 dönüşüm ölçümünü doğrula", "CRM takip aşamalarını rapora bağla"],
    "30 Günlük Plan": ["Bütçe dağılımı ve ROAS eğilimini izle", "Yeniden pazarlama kitlesi oluştur", "Müşteri raporunu görünür hale getir"],
    "Yayın Öncesi Kontrol": ["Platform, amaç, bütçe ve kitle net mi?", "Pixel/Dataset ve GA4 hazır mı?", "Teklif ve satış takibi CRM’de açık mı?"],
    "Kreatif Hazırlık": ["3 görsel/video fikri üret", "İlk 3 saniye hook yaz", "WhatsApp CTA varyasyonu hazırla"],
    "Raporlama": ["Tıklama Oranı, Tıklama Maliyeti ve Dönüşüm Maliyeti sade dille açıklanmalı", "Müşteriye sadece onaylı içerik gösterilmeli", "Sonraki aksiyon raporda net yazılmalı"]
  };
  const formatMoney = (value: number) => `${Math.round(value || 0).toLocaleString("tr-TR")} TL`;
  const formatNumber = (value: number) => Math.round(value || 0).toLocaleString("tr-TR");
  const integrationHref = customerId ? `/hk-admin/musteriler?companyId=${customerId}&tab=entegrasyonlar` : "/hk-admin/musteriler";
  const dataDrivenRecommendations = [
    {
      problem: !metaAdAccountId ? "Meta reklam hesabı eşleşmemiş" : !metrics.length ? "Reklam verisi bu müşteriyle eşleşmiyor" : ctr && ctr < 1 ? "Tıklama Oranı düşük" : "",
      evidence: !metaAdAccountId ? "Müşteri entegrasyonlarında Meta Ad Account ID yok." : !metrics.length ? "Seçili müşteri ve tarih aralığında metrik kaydı bulunamadı." : `Tıklama Oranı ${ctr.toFixed(2)}%.`,
      action: !metaAdAccountId ? "Müşteri profilinde Meta hesap ID alanını tamamla." : !metrics.length ? "Reklam hesabı eşleşmesini ve tarih aralığını kontrol et." : "Kreatif hook ve teklif dilini yenile.",
      priority: "Yüksek",
      impact: "Ölçüm güvenilirliği ve kampanya optimizasyonu netleşir.",
      target: integrationHref
    },
    {
      problem: !pixelId || !datasetId ? "Dönüşüm ölçümü eksik" : !ga4PropertyId ? "Google Analytics ölçümü eksik" : cpa && cpa > 750 ? "Dönüşüm Maliyeti yüksek" : "",
      evidence: !pixelId || !datasetId ? "Pixel veya Dataset ID müşteri profilinde eksik." : !ga4PropertyId ? "GA4 Property ID bulunamadı." : `Dönüşüm Maliyeti ${formatMoney(cpa)}.`,
      action: !pixelId || !datasetId ? "Pixel/Dataset eşleşmesini tamamla." : !ga4PropertyId ? "GA4 Property ID ekle ve ölçümü doğrula." : "Hedef kitle, funnel ve teklif adımını sadeleştir.",
      priority: "Yüksek",
      impact: "Lead kalitesi ve raporlanabilir dönüşüm artar.",
      target: integrationHref
    },
    {
      problem: tasks.length > 4 ? "Açık görev yükü yüksek" : !reports.length ? "Raporlama aksiyonu eksik" : proposals.length === 0 && leads.length > 0 ? "Lead var ama teklif akışı zayıf" : "",
      evidence: tasks.length > 4 ? `${tasks.length} açık görev var.` : !reports.length ? "Bu müşteri için rapor kaydı bulunamadı." : `${leads.length} lead ve ${proposals.length} teklif kaydı görünüyor.`,
      action: tasks.length > 4 ? "Önceliklendirme yap ve kritik görevleri kapat." : !reports.length ? "Rapor Merkezi’nde ilk performans özetini oluştur." : "Teklif Takip Merkezi’nde leadleri teklife bağla.",
      priority: tasks.length > 4 ? "Orta" : "Yüksek",
      impact: "Operasyon zinciri CRM → Teklif → Rapor → Tahsilat akışına bağlanır.",
      target: !reports.length ? "/hk-admin/rapor-merkezi" : "/hk-admin/teklif-takip-merkezi"
    }
  ].filter((item) => item.problem);
  const nextActionCards = [
    ["Ne oldu?", `${customer?.name || "Seçili müşteri"} için reklam, CRM, teklif, görev, rapor ve tahsilat sinyalleri birlikte okundu.`],
    ["Şimdi ne yapmalısın?", dataDrivenRecommendations[0]?.action || "Kampanya verisini izleyip haftalık rapor ve teklif takiplerini kontrol et."],
    ["Nereden kontrol edeceksin?", "Müşteri Profili → Reklam Operasyon Merkezi → CRM → Teklif Takip Merkezi → Rapor Merkezi → Tahsilat"],
    ["Müşteriye açık mı?", "Bu ekran admin operasyon ekranıdır; müşteriye yalnız görünürlük izni verilen sade özetler gider."]
  ];
  const debugRows = [
    ["Seçili müşteri id", customerId || "Yok"],
    ["customer_integrations kayıt sayısı", integrationRows.length],
    ["Normalize edilen hesap sayısı", linkedAccounts.length],
    ["Meta hesap sayısı", linkedAccounts.filter((item) => item.kind === "meta_ad_account").length],
    ["Google Ads hesap sayısı", linkedAccounts.filter((item) => item.kind === "google_ads_customer").length],
    ["GA4 kayıt sayısı", linkedAccounts.filter((item) => item.kind === "ga4_property").length],
    ["YouTube kayıt sayısı", linkedAccounts.filter((item) => item.kind === "youtube_channel").length],
    ["X/Twitter kayıt sayısı", linkedAccounts.filter((item) => item.kind === "x_ads_account" || item.kind === "x_profile").length],
    ["Pixel kayıt sayısı", linkedAccounts.filter((item) => item.kind === "pixel_dataset").length],
    ["Son API hatası", integrationError || "Yok"],
    ["Son yenileme", integrationsRefreshedAt ? new Date(integrationsRefreshedAt).toLocaleString("tr-TR") : "Henüz yok"]
  ];
  return (
    <div className="grid gap-5">
      <PremiumPageHeader eyebrow="Reklam Operasyon Merkezi" title="Müşteri bazlı reklam operasyonu" description="Her müşteri yalnız kendi profilindeki Meta Ad Account ID, Google Ads Customer ID, Pixel, Dataset, GA4 ve website bilgileriyle eşleştirilir. Tüm HK Dijital reklam hesapları varsayılan olarak karıştırılmaz." actionLabel="Entegrasyonları Kontrol Et" onAction={() => window.location.assign(integrationHref)} />
      <GlassPanel tone="purple">
        <div className="grid gap-4 xl:grid-cols-[minmax(240px,.8fr)_minmax(260px,.75fr)_minmax(0,1fr)]">
          <CustomerPicker companies={companies} value={customerId || ""} onChange={(value: string) => { setCompanyId(value); setAdAccount(""); }} />
          <label className="grid gap-2 text-sm font-black text-slate-700">
            Reklam hesabı seç
            <select value={adAccount} disabled={!accountOptions.length || integrationsLoading} onChange={(event) => setAdAccount(event.target.value)} className="min-h-11 rounded-[12px] border border-slate-200 bg-white px-3 text-sm text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400">
              <option value="">{integrationsLoading ? "Bağlı hesaplar yükleniyor..." : accountOptions.length ? "Müşteriye bağlı hesap seçin" : "Bağlı reklam hesabı yok"}</option>
              {accountOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            {!accountOptions.length && !integrationsLoading && <span className="rounded-[10px] bg-white p-2 text-xs leading-5 text-purple-900">Bu müşteriye bağlı reklam hesabı bulunamadı. Müşteri profilinden veya Hesap Bağla ekranından hesap ekleyin.</span>}
          </label>
          <div className="grid gap-2 md:grid-cols-4">{["Son 30 Gün", "Son 7 Gün", "Bugün", "Canlı durum"].map((item) => <button key={item} onClick={() => setPeriod(item)} className={`rounded-[14px] px-4 py-3 text-sm font-black ${period === item ? "bg-purple-600 text-white" : "border border-purple-100 bg-white text-purple-700"}`}>{item}</button>)}</div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-4">
          <p className="rounded-[14px] bg-white p-3 text-sm font-bold text-purple-900">Son veri çekme: {lastDataDate ? new Date(lastDataDate).toLocaleDateString("tr-TR") : "Veri yok"}</p>
          <p className="rounded-[14px] bg-white p-3 text-sm font-bold text-purple-900">Seçili hesap: {selectedLinkedAccount ? `${selectedLinkedAccount.accountName} · ${selectedLinkedAccount.accountId}` : "Hesap seçilmedi"}</p>
          <button onClick={loadCustomerIntegrations} disabled={integrationsLoading} className="rounded-[14px] bg-cyan-500 px-4 py-3 text-sm font-black text-white disabled:opacity-60">{integrationsLoading ? "Yenileniyor..." : "Verileri Yenile"}</button>
          <button onClick={() => window.location.assign(`/hk-admin/musteriler?companyId=${customerId || ""}&tab=entegrasyonlar`)} className="rounded-[14px] border border-purple-200 bg-white px-4 py-3 text-sm font-black text-purple-700">Müşteri Profilini Aç</button>
        </div>
        {integrationError && <p className="mt-3 rounded-[12px] border border-amber-200 bg-white p-3 text-sm font-bold text-amber-900">{integrationError}</p>}
      </GlassPanel>
      <GlassPanel tone="amber"><p className="text-xs font-black uppercase tracking-[.16em] text-amber-700">Gerçek veri uyarıları</p><div className="mt-3 grid gap-2 md:grid-cols-2">{integrationStatusRows.map((item) => <p key={item.label} className={`rounded-[12px] p-3 text-sm font-bold ${item.ok ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200" : "bg-white text-amber-900"}`}><span className="block text-xs uppercase tracking-[.12em]">{item.label}</span>{item.detail}<br /><span className="text-xs">Yöntem: {item.method}</span></p>)}{healthReasons.slice(0, 4).map((item: string) => <p key={item} className="rounded-[12px] bg-white p-3 text-sm font-bold text-amber-900">{item}</p>)}</div><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => window.location.assign(integrationHref)} className="rounded-full bg-amber-400 px-4 py-2 text-xs font-black text-slate-950">Müşteri Entegrasyonlarını Aç</button><button onClick={() => setActive?.("API Durum Kontrolü")} className="rounded-full border border-amber-200 bg-white px-4 py-2 text-xs font-black text-amber-800">API Durumunu Kontrol Et</button></div></GlassPanel>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">{[["Toplam Harcama", formatMoney(spend)], ["Lead", formatNumber(conversions)], ["Mesaj", formatNumber(messages)], ["Form", formatNumber(formLeads)], ["Telefon", formatNumber(phoneLeads)], ["CTR / Tıklama Oranı", `${ctr.toFixed(2)}%`], ["CPC / Tıklama Maliyeti", cpc ? formatMoney(cpc) : "Veri yok"], ["CPA / Dönüşüm Maliyeti", cpa ? formatMoney(cpa) : "Veri yok"], ["ROAS / Reklam Getiri Oranı", roas ? roas.toFixed(2) : "Veri yok"], ["Reklam Sağlığı", `${healthScore}/100`]].map(([label, value]) => <div key={label} className="rounded-[18px] border border-cyan-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300"><span className="text-[10px] font-black uppercase tracking-[.12em] text-cyan-700">{label}</span><strong className="mt-2 block text-2xl text-slate-950">{value}</strong><span className="mt-1 block text-xs font-bold text-slate-500">{period}</span></div>)}</div>
      <GlassPanel><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">Kanal Durumu</p><h3 className="mt-2 text-xl font-black text-slate-950">Müşteri profiline bağlı kanallar</h3></div><button onClick={() => window.location.assign(integrationHref)} className="rounded-full bg-cyan-500 px-4 py-2 text-xs font-black text-white">İlgili müşteri profili alanına git</button></div><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{channelCards.map((card: any) => <div key={card.name} className="rounded-[16px] border border-slate-200 bg-white p-4"><strong className="block text-slate-950">{card.name}</strong><span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-black ${card.connected ? "bg-emerald-100 text-emerald-700" : card.tracking ? "bg-blue-100 text-blue-700" : card.account?.syncError ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800"}`}>{card.connected ? "Bağlı" : card.account?.syncError ? "Hata" : card.tracking ? "Kontrol Bekliyor" : "Eksik"}</span><p className="mt-3 text-xs leading-5 text-slate-600">Son veri: {card.lastSync ? new Date(card.lastSync).toLocaleDateString("tr-TR") : "Yok"}<br />Yöntem: {methodDisplay(card.account?.method || "")}<br />Hesap: {card.account?.accountName || card.account?.accountId || "Yok"}</p>{card.account?.syncError && <p className="mt-2 text-xs font-bold text-rose-700">{card.account.syncError}</p>}<button onClick={() => window.location.assign(integrationHref)} className="mt-3 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-2 text-[11px] font-black text-cyan-800">{card.account?.syncError ? "Yeniden Bağla" : card.action}</button></div>)}</div></GlassPanel>
      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]"><GlassPanel tone={healthScore >= 80 ? "emerald" : healthScore >= 60 ? "amber" : "purple"}><p className="text-xs font-black uppercase tracking-[.16em] text-slate-700">Reklam Sağlığı</p><h3 className="mt-2 text-5xl font-black text-slate-950">{healthScore}/100</h3><div className="mt-4 h-3 overflow-hidden rounded-full bg-white"><span className="block h-full rounded-full bg-gradient-to-r from-cyan-400 via-purple-500 to-emerald-400" style={{ width: `${healthScore}%` }} /></div><p className="mt-4 text-sm font-bold leading-6 text-slate-700">Skor; müşteri profili entegrasyonları, ölçümleme, veri varlığı, görev yoğunluğu ve performans sinyallerinden hesaplanır.</p></GlassPanel><GlassPanel tone="amber"><p className="text-xs font-black uppercase tracking-[.16em] text-amber-700">Reklam Doktoru</p><div className="mt-4 grid gap-2 md:grid-cols-2">{doctorChecks.map(([name, status, solution, priority]) => <div key={name} className="rounded-[12px] bg-white p-3"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-slate-950">{name}</strong><span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-800">{status} · {priority}</span></div><p className="mt-2 text-xs font-bold leading-5 text-slate-600">{solution}</p></div>)}</div></GlassPanel></div>
      <GlassPanel tone="purple"><p className="text-xs font-black uppercase tracking-[.16em] text-purple-700">Yapay Zekâ Önerileri</p><h3 className="mt-2 text-xl font-black text-slate-950">Veri sinyaline göre önceliklendirilmiş aksiyonlar</h3><div className="mt-4 grid gap-3 lg:grid-cols-3">{(dataDrivenRecommendations.length ? dataDrivenRecommendations : [{ problem: "Kritik eksik görünmüyor", evidence: "Seçili veri setinde yüksek öncelikli eksik sinyal bulunmadı.", action: "Haftalık rapor ve teklif takiplerini kontrol et.", priority: "Bilgi", impact: "Operasyon ritmi korunur.", target: "/hk-admin/rapor-merkezi" }]).map((item) => <div key={item.problem} className="rounded-[16px] border border-purple-100 bg-white p-4"><span className="rounded-full bg-purple-100 px-3 py-1 text-[10px] font-black text-purple-800">Öncelik: {item.priority}</span><h4 className="mt-3 font-black text-slate-950">Sorun: {item.problem}</h4><p className="mt-2 text-xs font-bold leading-5 text-slate-600">Kanıt / veri sinyali: {item.evidence}</p><p className="mt-2 text-xs font-bold leading-5 text-slate-700">Önerilen aksiyon: {item.action}</p><p className="mt-2 text-xs font-bold leading-5 text-emerald-700">Beklenen etki: {item.impact}</p><button onClick={() => window.location.assign(item.target)} className="mt-3 rounded-full bg-purple-600 px-4 py-2 text-xs font-black text-white">İlgili modüle git</button></div>)}</div></GlassPanel>
      <GlassPanel tone="cyan"><p className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">Sonraki Aksiyon</p><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{nextActionCards.map(([title, text]) => <div key={title} className="rounded-[14px] bg-white p-4"><strong className="block text-sm text-slate-950">{title}</strong><p className="mt-2 text-xs font-bold leading-5 text-slate-600">{text}</p></div>)}</div><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => setActive?.("CRM & Lead Workspace")} className="rounded-full bg-cyan-500 px-4 py-2 text-xs font-black text-white">CRM’e Git</button><button onClick={() => setActive?.("Teklif Takip Merkezi")} className="rounded-full border border-cyan-200 bg-white px-4 py-2 text-xs font-black text-cyan-800">Teklif Takip Merkezi</button><button onClick={() => setActive?.("Müşteri Raporları")} className="rounded-full border border-cyan-200 bg-white px-4 py-2 text-xs font-black text-cyan-800">Rapor Merkezi’ne Git</button><button onClick={() => setActive?.("Tahsilatlar")} className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-800">Tahsilat Kontrol Et</button></div></GlassPanel>
      <GlassPanel tone="purple"><details><summary className="cursor-pointer text-xs font-black uppercase tracking-[.16em] text-purple-700">Geliştirici kontrol alanı</summary><div className="mt-4 grid gap-2 md:grid-cols-3">{debugRows.map(([label, value]) => <p key={label} className="rounded-[12px] bg-white p-3 text-xs font-bold text-slate-700"><span className="block text-slate-500">{label}</span>{String(value)}</p>)}</div></details></GlassPanel>
      <GlassPanel tone="emerald"><p className="text-xs font-black uppercase tracking-[.16em] text-emerald-700">Operasyon Planı</p><div className="mt-3 flex flex-wrap gap-2">{Object.keys(planItems).map((item) => <button key={item} onClick={() => setPlanTab(item)} className={`rounded-full px-3 py-2 text-xs font-black ${planTab === item ? "bg-emerald-600 text-white" : "border border-emerald-200 bg-white text-emerald-700"}`}>{item}</button>)}</div><div className="mt-4 grid gap-3 md:grid-cols-3">{planItems[planTab].map((item) => <p key={item} className="rounded-[12px] bg-white p-4 text-sm font-bold leading-6 text-slate-700">{item}</p>)}</div></GlassPanel>
      <GlassPanel><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">Funnel Merkezi</p><h3 className="mt-2 text-xl font-black text-slate-950">Timeline akışı</h3></div><div className="flex flex-wrap gap-2">{["Funnelsız Reklam", "WhatsApp Funnel", "Web Sitesi Funnel", "Telefon Funnel", "Teklif Funnel", "Rezervasyon Funnel", "Marka Bilinirliği Funnel"].map((item) => <button key={item} onClick={() => setFunnelMode(item)} className={`rounded-full px-3 py-2 text-xs font-black ${funnelMode === item ? "bg-purple-600 text-white" : "border border-slate-200 bg-white text-slate-700"}`}>{item}</button>)}</div></div><div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-9">{funnelSteps.map((step, index) => <FunnelStepCard key={step} step={step} index={index} status={index < 2 ? "hazır" : index < 6 ? "öneriliyor" : "eksik"} action={index < 2 ? "Git" : "Planla"} />)}</div></GlassPanel>
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
