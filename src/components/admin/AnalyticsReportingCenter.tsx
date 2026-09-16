"use client";
/* eslint-disable react-hooks/set-state-in-effect -- fetch-on-mount/fetch-on-filter-change pattern, same accepted precedent as src/components/admin/WebsiteAnalyticsCenter.tsx */

import { useEffect, useMemo, useState } from "react";
import { AdminWorkspace } from "@/components/admin/workspace/AdminWorkspace";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminStatusBadge } from "@/components/admin/ui/AdminStatusBadge";
import { AdminConnectionDrawer } from "@/components/admin/AdminConnectionDrawer";
import { MetricCard } from "@/components/admin/analytics/MetricCard";
import { AnalyticsAreaChart, AnalyticsBarChart } from "@/components/admin/analytics/charts";
import { ContentTable, type ContentRow } from "@/components/admin/analytics/ContentTable";
import { InstagramView, FacebookView, TikTokView, YoutubeView, GoogleAdsView, GoogleBusinessView, type DailySeriesByMetric } from "@/components/admin/analytics/PlatformViews";
import { platformTheme } from "@/components/admin/analytics/theme";
import { PROVIDER_LABELS } from "@/lib/analytics-center/capabilities";
import type { AnalyticsProvider, KpiCardValue, ProviderConnectionStatus } from "@/lib/analytics-center/types";
import type { ComparisonMode } from "@/lib/analytics-center/date-math";
import { BarChart3, Search, ChevronDown, FileDown, ImagePlus, Megaphone, Music2, PlayCircle, MapPin, RefreshCw, Settings2, Users2, X } from "lucide-react";

const PROVIDERS: AnalyticsProvider[] = ["instagram", "facebook", "tiktok", "youtube", "google_ads", "google_business_profile"];
const PROVIDER_ICONS: Record<AnalyticsProvider, any> = { instagram: ImagePlus, facebook: Megaphone, tiktok: Music2, youtube: PlayCircle, google_ads: Search, google_business_profile: MapPin };

type Company = { id: string; name: string };
type ConnectionStatus = ProviderConnectionStatus;

const DATE_PRESETS = [
  { key: "today", label: "Bugün" },
  { key: "yesterday", label: "Dün" },
  { key: "last7", label: "Son 7 Gün" },
  { key: "last14", label: "Son 14 Gün" },
  { key: "last30", label: "Son 30 Gün" },
  { key: "thisMonth", label: "Bu Ay" },
  { key: "lastMonth", label: "Geçen Ay" },
  { key: "last90", label: "Son 90 Gün" },
  { key: "thisYear", label: "Bu Yıl" },
  { key: "custom", label: "Özel Tarih" }
] as const;
type DatePresetKey = (typeof DATE_PRESETS)[number]["key"];

const COMPARISON_OPTIONS: Array<{ key: ComparisonMode; label: string }> = [
  { key: "previous_period", label: "Önceki dönem" },
  { key: "previous_month", label: "Geçen ay" },
  { key: "previous_year", label: "Geçen yıl aynı dönem" },
  { key: "off", label: "Kapalı" }
];

// Deliberately NOT computed at module scope or in the initial useState() —
// new Date()/toISOString() during the render that gets both server-
// rendered and hydrated risks a one-day mismatch if the two happen to
// straddle a UTC midnight boundary (the same class of bug fixed elsewhere
// in this app — see formatDate/formatDateTime in AdminDashboard.tsx). The
// real default range is only ever set inside a post-mount useEffect, so
// the very first client render matches the server render exactly (both
// show the loading state) before any date math runs.
function rangeForPreset(preset: DatePresetKey, customStart: string, customEnd: string): { startDate: string; endDate: string } {
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const daysAgo = (n: number) => new Date(today.getTime() - n * 86400000);
  switch (preset) {
    case "today": return { startDate: iso(today), endDate: iso(today) };
    case "yesterday": { const y = daysAgo(1); return { startDate: iso(y), endDate: iso(y) }; }
    case "last7": return { startDate: iso(daysAgo(6)), endDate: iso(today) };
    case "last14": return { startDate: iso(daysAgo(13)), endDate: iso(today) };
    case "last30": return { startDate: iso(daysAgo(29)), endDate: iso(today) };
    case "last90": return { startDate: iso(daysAgo(89)), endDate: iso(today) };
    case "thisMonth": return { startDate: iso(new Date(today.getFullYear(), today.getMonth(), 1)), endDate: iso(today) };
    case "lastMonth": { const first = new Date(today.getFullYear(), today.getMonth() - 1, 1); const last = new Date(today.getFullYear(), today.getMonth(), 0); return { startDate: iso(first), endDate: iso(last) }; }
    case "thisYear": return { startDate: iso(new Date(today.getFullYear(), 0, 1)), endDate: iso(today) };
    case "custom": return { startDate: customStart || iso(daysAgo(29)), endDate: customEnd || iso(today) };
    default: return { startDate: iso(daysAgo(29)), endDate: iso(today) };
  }
}

function unitFormat(value: number, unit: string): string {
  if (unit === "currency") return `${value.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL`;
  if (unit === "percent") return `%${value.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}`;
  if (unit === "seconds") return `${Math.round(value)} sn`;
  if (unit === "rating") return value.toLocaleString("tr-TR", { maximumFractionDigits: 1 });
  return value.toLocaleString("tr-TR", { maximumFractionDigits: 0 });
}

export function AnalyticsReportingCenter() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyQuery, setCompanyQuery] = useState("");
  const [companyId, setCompanyId] = useState<string>("");
  const [ready, setReady] = useState(false); // becomes true only after mount — see rangeForPreset's comment
  const [preset, setPreset] = useState<DatePresetKey>("last30");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>("previous_period");
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [connections, setConnections] = useState<ConnectionStatus[] | null>(null);
  const [tablesReady, setTablesReady] = useState<boolean | null>(null);
  const [kpis, setKpis] = useState<Record<string, KpiCardValue[]>>({});
  const [dailyByProvider, setDailyByProvider] = useState<Record<string, DailySeriesByMetric>>({});
  const [content, setContent] = useState<ContentRow[]>([]);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [activeView, setActiveView] = useState<AnalyticsProvider | "overview" | "content" | "connections" | "reports">("overview");
  const [reportTitle, setReportTitle] = useState("");
  const [reportPlatforms, setReportPlatforms] = useState<AnalyticsProvider[]>(PROVIDERS);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportResult, setReportResult] = useState<{ pdfUrl: string } | null>(null);
  const [savedReports, setSavedReports] = useState<any[]>([]);
  const [drawerProvider, setDrawerProvider] = useState<AnalyticsProvider | null>(null);
  const [drawerAutoLoad, setDrawerAutoLoad] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);

  function markReady() { setReady(true); }
  useEffect(() => { markReady(); }, []);

  async function loadCompanies() {
    const response = await fetch("/api/admin/companies");
    const data = await response.json();
    setCompanies(data.companies || []);
  }
  useEffect(() => { loadCompanies(); }, []);

  // Restores the selected customer (and jumps to Bağlantılar) when this
  // page is reopened with ?company=<id> — the return route used after an
  // admin completes a provider OAuth handshake from here.
  useEffect(() => {
    if (!companies.length) return;
    const params = new URLSearchParams(window.location.search);
    const companyFromUrl = params.get("company");
    if (companyFromUrl && companies.some((c) => c.id === companyFromUrl)) {
      setCompanyId(companyFromUrl);
      if (window.location.hash === "#hesaplar") setActiveView("connections");
    }
  }, [companies]);

  // Direct-OAuth return handling — no /musteri-paneli hop. connections.ts's
  // directConnectHref sends the browser straight to Meta/Google/TikTok with
  // a returnTo of /hk-admin/analiz-raporlama?company=..&requestedChild=..
  // (never through the customer panel); oauthCallback appends
  // integration_provider/integration_success/integration_error/oauth_status
  // on top of that same returnTo on its way back here. requestedChild is
  // which of the 6 provider cards (e.g. "instagram", not just "meta") to
  // reopen the connection drawer on.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedChild = params.get("requestedChild") as AnalyticsProvider | null;
    const status = params.get("oauth_status");
    const success = params.get("integration_success");
    const error = params.get("integration_error");
    if (requestedChild && PROVIDERS.includes(requestedChild) && (status === "accounts_ready" || success || error)) {
      setActiveView("connections");
      setDrawerProvider(requestedChild);
      setDrawerAutoLoad(Boolean(status === "accounts_ready" || success));
      setDrawerError(error);
    }
  }, []);

  const range = useMemo(() => rangeForPreset(preset, customStart, customEnd), [preset, customStart, customEnd]);

  async function loadConnections() {
    if (!companyId) { setConnections(null); return; }
    try {
      const response = await fetch(`/api/admin/analytics-center/status?companyId=${companyId}`);
      const data = await response.json();
      setTablesReady(data.tablesReady);
      setConnections(data.connections || []);
    } catch {
      setConnections([]);
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadConnections(); }, [companyId]);

  async function loadMetricsAndContent() {
    if (!companyId || !ready || tablesReady === false) return;
    setLoadingMetrics(true);
    try {
      const providerParam = PROVIDERS.join(",");
      const [metricsData, contentData] = await Promise.all([
        fetch(`/api/admin/analytics-center/metrics?companyId=${companyId}&providers=${providerParam}&startDate=${range.startDate}&endDate=${range.endDate}&comparisonMode=${comparisonMode}`).then((r) => r.json()),
        fetch(`/api/admin/analytics-center/content?companyId=${companyId}&startDate=${range.startDate}&endDate=${range.endDate}`).then((r) => r.json())
      ]);
      setKpis(metricsData.kpis || {});
      setDailyByProvider(metricsData.dailyByProvider || {});
      setContent(contentData.content || []);
    } finally {
      setLoadingMetrics(false);
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadMetricsAndContent(); }, [companyId, ready, range.startDate, range.endDate, comparisonMode, tablesReady]);

  async function loadSavedReports() {
    if (!companyId) return;
    const response = await fetch(`/api/admin/analytics-center/reports?companyId=${companyId}`);
    const data = await response.json();
    setSavedReports(data.reports || []);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (activeView === "reports") loadSavedReports(); }, [activeView, companyId]);

  async function runSync() {
    if (!companyId) return;
    setSyncing(true);
    setSyncMessage("");
    try {
      const response = await fetch("/api/admin/analytics-center/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, providers: PROVIDERS, startDate: range.startDate, endDate: range.endDate })
      });
      const data = await response.json();
      if (!response.ok) { setSyncMessage(data.error || "Senkronizasyon başarısız oldu."); return; }
      const failed = (data.results || []).filter((r: any) => !r.ok);
      setSyncMessage(failed.length ? `${data.results.length - failed.length}/${data.results.length} platform senkronize edildi. ${failed.map((f: any) => f.message).join(" ")}` : "Tüm platformlar başarıyla senkronize edildi.");
      await loadConnections();
      await loadMetricsAndContent();
    } finally {
      setSyncing(false);
    }
  }

  async function generateReport() {
    if (!companyId) return;
    setGeneratingReport(true);
    setReportResult(null);
    try {
      const response = await fetch("/api/admin/analytics-center/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, title: reportTitle || undefined, startDate: range.startDate, endDate: range.endDate, platforms: reportPlatforms })
      });
      const data = await response.json();
      if (response.ok) { setReportResult({ pdfUrl: data.pdfUrl }); loadSavedReports(); }
    } finally {
      setGeneratingReport(false);
    }
  }

  const filteredCompanies = companyQuery ? companies.filter((c) => c.name.toLocaleLowerCase("tr-TR").includes(companyQuery.toLocaleLowerCase("tr-TR"))) : companies;
  const selectedCompany = companies.find((c) => c.id === companyId) || null;
  const connectedCount = (connections || []).filter((c) => c.status === "connected").length;
  const connectionByProvider = useMemo(() => new Map((connections || []).map((c) => [c.provider, c])), [connections]);
  const activePresetLabel = DATE_PRESETS.find((p) => p.key === preset)?.label || "";
  const activeComparisonLabel = COMPARISON_OPTIONS.find((c) => c.key === comparisonMode)?.label || "";

  function selectCompany(id: string) {
    setCompanyId(id);
    setCustomerPickerOpen(false);
    setActiveView("overview");
  }

  // ===== Genel Bakış (cross-platform overview) =====
  function OverviewSection() {
    const connectedProviders = PROVIDERS.filter((p) => connectionByProvider.get(p)?.status === "connected");
    const audienceTotal = connectedProviders.reduce((sum, p) => {
      const followerKey = p === "youtube" ? "subscribers" : p === "facebook" ? "page_fans" : "followers";
      const kpi = (kpis[p] || []).find((k) => k.key === followerKey);
      return sum + (kpi?.value || 0);
    }, 0);
    const reachTotal = connectedProviders.reduce((sum, p) => {
      const key = p === "facebook" ? "page_impressions_unique" : p === "google_ads" ? "impressions" : p === "google_business_profile" ? "BUSINESS_IMPRESSIONS_MOBILE_SEARCH" : "reach";
      const kpi = (kpis[p] || []).find((k) => k.key === key || k.key === "views");
      return sum + (kpi?.value || 0);
    }, 0);
    const spendTotal = (kpis.google_ads || []).find((k) => k.key === "cost")?.value ?? null;
    const conversionsTotal = (kpis.google_ads || []).find((k) => k.key === "conversions")?.value ?? null;
    const localActionsTotal = ["CALL_CLICKS", "WEBSITE_CLICKS", "BUSINESS_DIRECTION_REQUESTS"].reduce((sum, key) => sum + ((kpis.google_business_profile || []).find((k) => k.key === key)?.value || 0), 0);

    const comparisonSeries = connectedProviders.map((p) => {
      const key = p === "youtube" ? "subscribers" : p === "facebook" ? "page_fans" : p === "google_ads" ? "cost" : p === "google_business_profile" ? "BUSINESS_IMPRESSIONS_MOBILE_SEARCH" : "followers";
      const kpi = (kpis[p] || []).find((k) => k.key === key);
      return { label: PROVIDER_LABELS[p], value: kpi?.value || 0 };
    });

    return (
      <div className="grid gap-6">
        {syncMessage && <p className="rounded-[14px] bg-white p-4 text-sm font-bold" style={{ color: "var(--admin-text-secondary)" }}>{syncMessage}</p>}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard variant="neutral" label="Bağlı Platformlar" value={`${connectedCount}/${PROVIDERS.length}`} />
          <MetricCard variant="neutral" label="Toplam Kitle" value={audienceTotal.toLocaleString("tr-TR")} note="Takipçi/abone toplamı (bağlı platformlar)" />
          <MetricCard variant="neutral" label="Erişim / Görüntülenme" value={reachTotal.toLocaleString("tr-TR")} note="Seçili dönem toplamı" />
          <MetricCard variant="neutral" label="Yayınlanan İçerik" value={String(content.length)} note="Seçili dönemde" />
          <MetricCard variant="google_ads" label="Reklam Harcaması" value={spendTotal !== null ? unitFormat(spendTotal, "currency") : "—"} note={spendTotal === null ? "Google Ads bağlı değil" : undefined} />
          <MetricCard variant="google_ads" label="Dönüşüm" value={conversionsTotal !== null ? unitFormat(conversionsTotal, "count") : "—"} note={conversionsTotal === null ? "Google Ads bağlı değil" : undefined} />
          <MetricCard variant="google_business_profile" label="Yerel Aksiyonlar" value={localActionsTotal.toLocaleString("tr-TR")} note="Arama + yol tarifi + telefon" />
          <MetricCard variant="neutral" label="Karşılaştırma" value={activeComparisonLabel} note={activePresetLabel} />
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          <AnalyticsBarChart title="Platform Performans Karşılaştırması" subtitle="Ana kitle/harcama metriği" data={comparisonSeries} color={platformTheme("neutral").accent} loading={loadingMetrics} />
          <AnalyticsAreaChart title="Kitle Trendi" subtitle="Bağlı platformların toplamı" data={(() => {
            const dateMap = new Map<string, number>();
            for (const p of connectedProviders) {
              const key = p === "youtube" ? "subscribers" : p === "facebook" ? "page_fans" : "followers";
              for (const point of dailyByProvider[p]?.[key] || []) dateMap.set(point.date, (dateMap.get(point.date) || 0) + point.value);
            }
            return [...dateMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ label: new Date(`${date}T00:00:00`).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" }), value }));
          })()} color={platformTheme("neutral").accent} loading={loadingMetrics} />
        </div>
        <div>
          <h3 className="mb-3 text-base font-black" style={{ color: "var(--admin-text-primary)" }}>Öne Çıkan İçerikler</h3>
          <ContentTable rows={[...content].sort((a, b) => (b.metrics.views || b.metrics.reach || 0) - (a.metrics.views || a.metrics.reach || 0)).slice(0, 8)} emptyMessage="Seçili dönemde içerik bulunamadı." />
        </div>
      </div>
    );
  }

  function renderPlatformView(provider: AnalyticsProvider) {
    const props = { kpis: kpis[provider] || [], daily: dailyByProvider[provider] || {}, content: content.filter((c) => c.provider === provider), connection: connectionByProvider.get(provider) || null, loading: loadingMetrics };
    if (provider === "instagram") return <InstagramView {...props} />;
    if (provider === "facebook") return <FacebookView {...props} />;
    if (provider === "tiktok") return <TikTokView {...props} />;
    if (provider === "youtube") return <YoutubeView {...props} />;
    if (provider === "google_ads") return <GoogleAdsView {...props} />;
    return <GoogleBusinessView {...props} />;
  }

  return (
    <AdminWorkspace
      eyebrow="Rapor Merkezi"
      title="Analiz & Raporlama Merkezi"
      description={selectedCompany ? `${selectedCompany.name} için Instagram, Facebook, TikTok, YouTube, Google Ads ve Google Business Profile performansı.` : "Instagram, Facebook, TikTok, YouTube, Google Ads ve Google Business Profile performansını tek panelde birleştirir; resmi API verilerinden otomatik rapor üretir."}
      headerActions={companyId ? <>
        {connections && <AdminStatusBadge tone="info">{connectedCount}/{PROVIDERS.length} bağlı</AdminStatusBadge>}
        <AdminButton compact variant="primary" onClick={runSync} disabled={syncing || tablesReady === false}>{syncing ? "Güncelleniyor..." : <><RefreshCw size={14} /> Verileri Güncelle</>}</AdminButton>
      </> : undefined}
    >
      {!companyId ? (
        <div className="grid place-items-center py-16">
          <div className="w-full max-w-xl rounded-[24px] bg-white p-8 text-center" style={{ boxShadow: "0 1px 2px rgba(15,23,42,.04), 0 20px 48px rgba(15,23,42,.06)" }}>
            <Users2 size={32} style={{ color: platformTheme("neutral").accent, margin: "0 auto" }} />
            <h2 className="mt-4 text-xl font-black" style={{ color: "var(--admin-text-primary)" }}>Bir müşteri seçin</h2>
            <p className="mt-2 text-sm" style={{ color: "var(--admin-text-muted)" }}>Analiz görüntülemek için önce bir müşteri seçin.</p>
            <input value={companyQuery} onChange={(e) => setCompanyQuery(e.target.value)} placeholder="Müşteri ara..." className="mt-5 min-h-11 w-full rounded-[12px] border px-4 text-sm" style={{ borderColor: "var(--admin-border)" }} autoFocus />
            <div className="mt-3 grid max-h-72 gap-1 overflow-y-auto text-left">
              {filteredCompanies.slice(0, 40).map((c) => (
                <button key={c.id} type="button" onClick={() => selectCompany(c.id)} className="rounded-[10px] px-4 py-2.5 text-left text-sm font-bold" style={{ color: "var(--admin-text-primary)" }} onMouseOver={(e) => (e.currentTarget.style.background = "var(--admin-surface-soft)")} onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}>
                  {c.name}
                </button>
              ))}
              {!filteredCompanies.length && <p className="p-2 text-xs" style={{ color: "var(--admin-text-muted)" }}>Müşteri bulunamadı.</p>}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-5">
          {/* Top toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] bg-white p-3" style={{ boxShadow: "0 1px 2px rgba(15,23,42,.04), 0 8px 24px rgba(15,23,42,.04)" }}>
            <div className="relative">
              <button type="button" onClick={() => setCustomerPickerOpen((v) => !v)} className="flex items-center gap-2 rounded-[12px] px-3 py-2 text-sm font-black" style={{ background: "var(--admin-surface-soft)", color: "var(--admin-text-primary)" }}>
                <Users2 size={15} /> {selectedCompany?.name || "Müşteri seç"} <ChevronDown size={14} />
              </button>
              {customerPickerOpen && (
                <div className="absolute left-0 top-full z-20 mt-2 w-72 rounded-[14px] bg-white p-3" style={{ boxShadow: "0 12px 32px rgba(15,23,42,.14)" }}>
                  <input value={companyQuery} onChange={(e) => setCompanyQuery(e.target.value)} placeholder="Müşteri ara..." className="min-h-9 w-full rounded-[8px] border px-3 text-sm" style={{ borderColor: "var(--admin-border)" }} autoFocus />
                  <div className="mt-2 grid max-h-64 gap-0.5 overflow-y-auto">
                    {filteredCompanies.slice(0, 40).map((c) => (
                      <button key={c.id} type="button" onClick={() => selectCompany(c.id)} className="rounded-[8px] px-3 py-2 text-left text-sm font-bold" style={{ background: c.id === companyId ? "var(--admin-surface-soft)" : "transparent", color: "var(--admin-text-primary)" }}>
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <button type="button" onClick={() => setDatePickerOpen((v) => !v)} className="rounded-[12px] px-3 py-2 text-xs font-black" style={{ background: "var(--admin-surface-soft)", color: "var(--admin-text-primary)" }}>
                  {activePresetLabel} · {activeComparisonLabel} <ChevronDown size={12} className="ml-1 inline" />
                </button>
                {datePickerOpen && (
                  <div className="absolute right-0 top-full z-20 mt-2 w-80 rounded-[14px] bg-white p-4" style={{ boxShadow: "0 12px 32px rgba(15,23,42,.14)" }}>
                    <p className="text-[11px] font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>Ana dönem</p>
                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      {DATE_PRESETS.map((p) => (
                        <button key={p.key} type="button" onClick={() => setPreset(p.key)} className="rounded-[8px] px-2.5 py-2 text-left text-xs font-bold" style={{ background: preset === p.key ? "var(--admin-surface-soft)" : "transparent", color: "var(--admin-text-primary)" }}>{p.label}</button>
                      ))}
                    </div>
                    {preset === "custom" && (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <label className="grid gap-1 text-xs font-bold" style={{ color: "var(--admin-text-secondary)" }}>Başlangıç<input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="min-h-9 rounded-[8px] border px-2 text-sm" style={{ borderColor: "var(--admin-border)" }} /></label>
                        <label className="grid gap-1 text-xs font-bold" style={{ color: "var(--admin-text-secondary)" }}>Bitiş<input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="min-h-9 rounded-[8px] border px-2 text-sm" style={{ borderColor: "var(--admin-border)" }} /></label>
                      </div>
                    )}
                    <p className="mt-4 text-[11px] font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>Karşılaştırma</p>
                    <div className="mt-2 grid gap-1.5">
                      {COMPARISON_OPTIONS.map((c) => (
                        <button key={c.key} type="button" onClick={() => setComparisonMode(c.key)} className="rounded-[8px] px-2.5 py-2 text-left text-xs font-bold" style={{ background: comparisonMode === c.key ? "var(--admin-surface-soft)" : "transparent", color: "var(--admin-text-primary)" }}>{c.label}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <AdminButton compact variant="secondary" onClick={() => setActiveView("reports")}><FileDown size={14} /> Rapor</AdminButton>
            </div>
          </div>

          {/* Platform navigation */}
          <div className="flex flex-wrap gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Platform seçimi">
            {([
              { key: "overview" as const, label: "Genel Bakış", icon: BarChart3 },
              ...PROVIDERS.map((p) => ({ key: p, label: PROVIDER_LABELS[p], icon: PROVIDER_ICONS[p] })),
              { key: "content" as const, label: "İçerik Performansı", icon: BarChart3 },
              { key: "connections" as const, label: "Bağlantılar", icon: Settings2 }
            ]).map((item) => {
              const Icon = item.icon;
              const isProvider = PROVIDERS.includes(item.key as AnalyticsProvider);
              const conn = isProvider ? connectionByProvider.get(item.key as AnalyticsProvider) : null;
              const active = activeView === item.key;
              return (
                <button key={item.key} role="tab" aria-selected={active} type="button" onClick={() => setActiveView(item.key)}
                  className="flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-black transition"
                  style={active ? { background: platformTheme(isProvider ? (item.key as AnalyticsProvider) : "neutral").accent, color: "white" } : { background: "white", color: "var(--admin-text-secondary)" }}>
                  <Icon size={15} /> {item.label}
                  {isProvider && <span aria-hidden="true" title={conn?.status === "connected" ? "Bağlı" : "Bağlı değil"} className="h-2 w-2 rounded-full" style={{ background: conn?.status === "connected" ? "#22c55e" : "transparent", border: conn?.status === "connected" ? "none" : `1.5px solid ${active ? "white" : "var(--admin-text-muted)"}` }} />}
                </button>
              );
            })}
          </div>

          {tablesReady === false && (
            <div className="grid place-items-center rounded-[18px] bg-white p-10 text-center">
              <p className="text-sm font-bold" style={{ color: "var(--admin-text-muted)" }}>Analiz Merkezi veritabanı tabloları henüz oluşturulmadı. supabase/migrations/20260915_analytics_center.sql migration&apos;ı uygulanmalı.</p>
            </div>
          )}

          {tablesReady !== false && activeView === "overview" && OverviewSection()}
          {tablesReady !== false && PROVIDERS.includes(activeView as AnalyticsProvider) && renderPlatformView(activeView as AnalyticsProvider)}
          {tablesReady !== false && activeView === "content" && (
            <div className="grid gap-4">
              <ContentTable rows={content} emptyMessage="Seçili dönemde içerik bulunamadı." />
            </div>
          )}

          {activeView === "connections" && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {(connections || []).map((conn) => {
                const Icon = PROVIDER_ICONS[conn.provider];
                const theme = platformTheme(conn.provider);
                return (
                  <div key={conn.provider} className="rounded-[18px] bg-white p-4" style={{ boxShadow: "0 1px 2px rgba(15,23,42,.04), 0 8px 24px rgba(15,23,42,.04)" }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2"><span className="rounded-[10px] p-2" style={{ background: theme.accentSoft, color: theme.accent }}><Icon size={16} /></span><strong className="text-sm" style={{ color: "var(--admin-text-primary)" }}>{conn.label}</strong></div>
                      <AdminStatusBadge tone={conn.status === "connected" ? "success" : conn.status === "not_connected" ? "neutral" : "warning"}>{conn.statusLabel}</AdminStatusBadge>
                    </div>
                    {conn.asset && <p className="mt-2 truncate text-xs font-bold" style={{ color: "var(--admin-text-primary)" }}>{conn.asset.asset_name}</p>}
                    {!conn.asset && conn.parentConnected && <p className="mt-2 text-xs font-bold" style={{ color: "var(--admin-text-secondary)" }}>Giriş yapıldı — hesap seçimi gerekli.</p>}
                    {!conn.asset && !conn.parentConnected && <p className="mt-2 text-xs" style={{ color: "var(--admin-text-muted)" }}>Henüz bağlı değil.</p>}
                    {conn.lastSyncedAt && <p className="mt-1 text-[11px]" style={{ color: "var(--admin-text-muted)" }}>Son güncelleme: {new Date(conn.lastSyncedAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}</p>}
                    {conn.lastError && <p className="mt-1 text-[11px] font-bold text-[#dc2626]">{conn.lastError}</p>}
                    {!conn.scopeReady && conn.scopeNote && <p className="mt-2 rounded-[8px] p-2 text-[11px]" style={{ background: "var(--admin-surface-soft)", color: "var(--admin-text-secondary)" }}>{conn.scopeNote}</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {conn.externalHref && <a href={conn.externalHref} target="_blank" rel="noreferrer" className="hk-button hk-button-compact hk-button-secondary">Hesaba Git</a>}
                      <button type="button" onClick={() => { setDrawerProvider(conn.provider); setDrawerAutoLoad(false); setDrawerError(null); }} className="hk-button hk-button-compact hk-button-secondary">Bağlantıyı Yönet</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeView === "reports" && (
            <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
              <div className="rounded-[18px] bg-white p-5" style={{ boxShadow: "0 1px 2px rgba(15,23,42,.04), 0 8px 24px rgba(15,23,42,.04)" }}>
                <h3 className="text-base font-black" style={{ color: "var(--admin-text-primary)" }}>Rapor Oluştur</h3>
                <div className="mt-4 grid gap-4">
                  <label className="grid gap-1 text-xs font-bold" style={{ color: "var(--admin-text-secondary)" }}>Rapor başlığı (opsiyonel)<input value={reportTitle} onChange={(e) => setReportTitle(e.target.value)} className="min-h-10 rounded-[10px] border px-3 text-sm" style={{ borderColor: "var(--admin-border)" }} /></label>
                  <div>
                    <p className="mb-1.5 text-xs font-bold" style={{ color: "var(--admin-text-secondary)" }}>Platformlar</p>
                    <div className="flex flex-wrap gap-2">
                      {PROVIDERS.map((p) => (
                        <label key={p} className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold" style={{ borderColor: "var(--admin-border)" }}>
                          <input type="checkbox" checked={reportPlatforms.includes(p)} onChange={(e) => setReportPlatforms((current) => e.target.checked ? [...current, p] : current.filter((x) => x !== p))} />
                          {PROVIDER_LABELS[p]}
                        </label>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>Dönem: {activePresetLabel} · Karşılaştırma: {activeComparisonLabel}</p>
                  <AdminButton variant="primary" onClick={generateReport} disabled={generatingReport || !reportPlatforms.length}>{generatingReport ? "Rapor hazırlanıyor..." : <><FileDown size={15} /> Rapor Oluştur</>}</AdminButton>
                  {reportResult && <a href={reportResult.pdfUrl} target="_blank" rel="noreferrer" className="hk-button hk-button-success inline-flex w-fit items-center gap-2"><FileDown size={15} /> PDF İndir</a>}
                </div>
              </div>
              <div className="rounded-[18px] bg-white p-5" style={{ boxShadow: "0 1px 2px rgba(15,23,42,.04), 0 8px 24px rgba(15,23,42,.04)" }}>
                <h3 className="text-base font-black" style={{ color: "var(--admin-text-primary)" }}>Kaydedilen Raporlar</h3>
                <div className="mt-3 grid gap-2">
                  {savedReports.map((report) => (
                    <div key={report.id} className="rounded-[10px] border p-3 text-xs" style={{ borderColor: "var(--admin-border)" }}>
                      <strong className="block truncate">{report.title}</strong>
                      <span style={{ color: "var(--admin-text-muted)" }}>{report.period_start} — {report.period_end}</span>
                      {report.customer_documents?.document_url && <a href={report.customer_documents.document_url} target="_blank" rel="noreferrer" className="mt-1 block font-bold text-[#0e7490]">PDF&apos;yi Aç</a>}
                    </div>
                  ))}
                  {!savedReports.length && <p className="text-xs" style={{ color: "var(--admin-text-muted)" }}>Henüz rapor oluşturulmadı.</p>}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {(customerPickerOpen || datePickerOpen) && <button type="button" aria-label="Kapat" className="fixed inset-0 z-10 cursor-default" onClick={() => { setCustomerPickerOpen(false); setDatePickerOpen(false); }}><X className="sr-only" /></button>}
      {drawerProvider && companyId && (
        <AdminConnectionDrawer
          companyId={companyId}
          initialProvider={drawerProvider}
          connections={connections}
          autoLoadAccounts={drawerAutoLoad}
          incomingError={drawerError}
          onClose={() => setDrawerProvider(null)}
          onConnectionsChanged={loadConnections}
        />
      )}
    </AdminWorkspace>
  );
}
