"use client";
/* eslint-disable react-hooks/set-state-in-effect -- fetch-on-mount/fetch-on-filter-change pattern, same accepted precedent as src/components/admin/WebsiteAnalyticsCenter.tsx */

import { useEffect, useMemo, useState } from "react";
import { AdminWorkspace } from "@/components/admin/workspace/AdminWorkspace";
import { AdminControlPanel, AdminFilterSection } from "@/components/admin/workspace/AdminControlPanel";
import { AdminDataGrid, type AdminDataGridColumn } from "@/components/admin/workspace/AdminDataGrid";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminStatusBadge, type AdminStatusTone } from "@/components/admin/ui/AdminStatusBadge";
import { AdminKpiCard } from "@/components/admin/ui/AdminKpiCard";
import { AdminEmptyState } from "@/components/admin/ui/AdminEmptyState";
import { AdminTabs } from "@/components/admin/ui/AdminTabs";
import { AdminConnectionDrawer } from "@/components/admin/AdminConnectionDrawer";
import type { AnalyticsProvider, ProviderConnectionStatus } from "@/lib/analytics-center/types";
import { BarChart3, ImagePlus, Megaphone, PlayCircle, Search, MapPin, RefreshCw, FileDown, ExternalLink } from "lucide-react";

const PROVIDERS: AnalyticsProvider[] = ["instagram", "facebook", "youtube", "google_ads", "google_business_profile"];
const PROVIDER_LABELS: Record<AnalyticsProvider, string> = { instagram: "Instagram", facebook: "Facebook", youtube: "YouTube", google_ads: "Google Ads", google_business_profile: "Google Business Profile" };
const PROVIDER_ICONS: Record<AnalyticsProvider, any> = { instagram: ImagePlus, facebook: Megaphone, youtube: PlayCircle, google_ads: Search, google_business_profile: MapPin };

type Company = { id: string; name: string };
type ConnectionStatus = ProviderConnectionStatus;
type KpiCardValue = { key: string; label: string; value: number | null; changePercent: number | null; unit: string; capability: string; note?: string };
type ContentItem = { id: string; provider: AnalyticsProvider; content_id: string; content_type: string | null; title: string | null; caption: string | null; permalink: string | null; thumbnail_url: string | null; published_at: string | null; metrics: Record<string, number | null> };

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

const STATUS_TONE: Record<string, AdminStatusTone> = {
  connected: "success",
  not_connected: "neutral",
  token_expired: "warning",
  reauth_required: "warning",
  sync_error: "danger",
  no_data: "neutral"
};

function unitFormat(value: number, unit: string): string {
  if (unit === "currency") return `${value.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL`;
  if (unit === "percent") return `${value.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}%`;
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
  const [selectedProviders, setSelectedProviders] = useState<AnalyticsProvider[]>(PROVIDERS);
  const [connections, setConnections] = useState<ConnectionStatus[] | null>(null);
  const [tablesReady, setTablesReady] = useState<boolean | null>(null);
  const [kpis, setKpis] = useState<Record<string, KpiCardValue[]>>({});
  const [content, setContent] = useState<ContentItem[]>([]);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [activeTab, setActiveTab] = useState("Genel Bakış");
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

  // Restores the selected customer (and jumps to the Hesaplar tab) when
  // this page is reopened with ?company=<id> — the return route used after
  // an admin completes a provider OAuth handshake from here (see
  // CustomerAccountConnectCenter's isHkAdminOrigin branch), so the admin
  // lands back on the same customer/tab they were managing instead of an
  // empty "Müşteri seçilmedi" state.
  useEffect(() => {
    if (!companies.length) return;
    const params = new URLSearchParams(window.location.search);
    const companyFromUrl = params.get("company");
    if (companyFromUrl && companies.some((c) => c.id === companyFromUrl)) {
      setCompanyId(companyFromUrl);
      if (window.location.hash === "#hesaplar") setActiveTab("Hesaplar");
    }
  }, [companies]);

  // Direct-OAuth return handling — no /musteri-paneli hop. connections.ts's
  // directConnectHref sends the browser straight to Meta/Google with a
  // returnTo of /hk-admin/analiz-raporlama?company=..&requestedChild=..
  // (never through the customer panel); oauthCallback appends
  // integration_provider/integration_success/integration_error/oauth_status
  // on top of that same returnTo on its way back here. requestedChild is
  // what which of the 5 provider cards (e.g. "instagram", not just "meta")
  // to reopen the connection drawer on — read once on mount, same pattern
  // CustomerAccountConnectCenter used for its own OAuth-return detection.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedChild = params.get("requestedChild") as AnalyticsProvider | null;
    const status = params.get("oauth_status");
    const success = params.get("integration_success");
    const error = params.get("integration_error");
    if (requestedChild && PROVIDERS.includes(requestedChild) && (status === "accounts_ready" || success || error)) {
      setActiveTab("Hesaplar");
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
      const providerParam = selectedProviders.join(",");
      const [metricsData, contentData] = await Promise.all([
        fetch(`/api/admin/analytics-center/metrics?companyId=${companyId}&providers=${providerParam}&startDate=${range.startDate}&endDate=${range.endDate}`).then((r) => r.json()),
        fetch(`/api/admin/analytics-center/content?companyId=${companyId}&startDate=${range.startDate}&endDate=${range.endDate}`).then((r) => r.json())
      ]);
      setKpis(metricsData.kpis || {});
      setContent(contentData.content || []);
    } finally {
      setLoadingMetrics(false);
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadMetricsAndContent(); }, [companyId, ready, range.startDate, range.endDate, selectedProviders, tablesReady]);

  async function loadSavedReports() {
    if (!companyId) return;
    const response = await fetch(`/api/admin/analytics-center/reports?companyId=${companyId}`);
    const data = await response.json();
    setSavedReports(data.reports || []);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (activeTab === "Raporlama") loadSavedReports(); }, [activeTab, companyId]);

  async function runSync() {
    if (!companyId) return;
    setSyncing(true);
    setSyncMessage("");
    try {
      const response = await fetch("/api/admin/analytics-center/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, providers: selectedProviders, startDate: range.startDate, endDate: range.endDate })
      });
      const data = await response.json();
      if (!response.ok) { setSyncMessage(data.error || "Senkronizasyon başarısız oldu."); return; }
      const failed = (data.results || []).filter((r: any) => !r.ok);
      setSyncMessage(failed.length ? `${data.results.length - failed.length}/${data.results.length} platform senkronize edildi. ${failed.map((f: any) => f.message).join(" ")}` : "Tüm platformlar başarıyla senkronize edildi.");
      // Re-fetch status + metrics after a sync.
      fetch(`/api/admin/analytics-center/status?companyId=${companyId}`).then((r) => r.json()).then((d) => setConnections(d.connections || []));
      setPreset((p) => p); // trigger metrics refetch via range dependency unchanged path — explicit refetch below
      const providerParam = selectedProviders.join(",");
      fetch(`/api/admin/analytics-center/metrics?companyId=${companyId}&providers=${providerParam}&startDate=${range.startDate}&endDate=${range.endDate}`).then((r) => r.json()).then((d) => setKpis(d.kpis || {}));
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

  const contentColumns: AdminDataGridColumn<ContentItem>[] = [
    { key: "content", header: "İçerik", render: (row) => <div className="flex items-center gap-2 min-w-0"><div className="min-w-0"><strong className="block truncate text-sm">{row.title || row.caption?.slice(0, 60) || "İçerik"}</strong><span className="text-xs" style={{ color: "var(--admin-text-muted)" }}>{PROVIDER_LABELS[row.provider]} · {row.content_type || "-"}</span></div></div> },
    { key: "date", header: "Tarih", render: (row) => row.published_at ? new Date(row.published_at).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" }) : "-" },
    { key: "reach", header: "Erişim / Görüntülenme", render: (row) => (row.metrics.reach ?? row.metrics.views ?? "-").toString() },
    { key: "engagement", header: "Beğeni / Yorum", render: (row) => `${row.metrics.likes ?? "-"} / ${row.metrics.comments ?? "-"}` },
    { key: "open", header: "", render: (row) => row.permalink ? <a href={row.permalink} target="_blank" rel="noreferrer" className="hk-button hk-button-compact hk-button-secondary inline-flex items-center gap-1"><ExternalLink size={13} /> Platformda Aç</a> : null }
  ];

  return (
    <AdminWorkspace
      eyebrow="Rapor Merkezi"
      title="Analiz & Raporlama Merkezi"
      description={selectedCompany ? `${selectedCompany.name} için Instagram, Facebook, YouTube, Google Ads ve Google Business Profile performansı.` : "Instagram, Facebook, YouTube, Google Ads ve Google Business Profile performansını tek panelde birleştirir; resmi API verilerinden otomatik rapor üretir."}
      headerActions={<>
        {connections && <AdminStatusBadge tone="info">{connectedCount}/{PROVIDERS.length} bağlı</AdminStatusBadge>}
        <AdminButton compact variant="primary" onClick={runSync} disabled={!companyId || syncing || tablesReady === false}>{syncing ? "Güncelleniyor..." : <><RefreshCw size={14} /> Verileri Güncelle</>}</AdminButton>
      </>}
      leftPanel={
        <AdminControlPanel>
          <AdminFilterSection title="Müşteri Seç">
            <input value={companyQuery} onChange={(e) => setCompanyQuery(e.target.value)} placeholder="Müşteri ara..." className="min-h-10 w-full rounded-[8px] border px-3 text-sm" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)", color: "var(--admin-text-primary)" }} />
            <div className="mt-2 grid max-h-64 gap-1 overflow-y-auto">
              {filteredCompanies.slice(0, 40).map((c) => (
                <button key={c.id} type="button" onClick={() => setCompanyId(c.id)} className="rounded-[8px] px-3 py-2 text-left text-sm" style={{ background: c.id === companyId ? "var(--hk-cyan-soft, var(--admin-surface-soft))" : "transparent", color: "var(--admin-text-primary)", fontWeight: c.id === companyId ? 700 : 500 }}>
                  {c.name}
                </button>
              ))}
              {!filteredCompanies.length && <p className="p-2 text-xs" style={{ color: "var(--admin-text-muted)" }}>Müşteri bulunamadı.</p>}
            </div>
          </AdminFilterSection>
          <AdminFilterSection title="Tarih Aralığı">
            <div className="grid gap-1.5">
              {DATE_PRESETS.map((p) => (
                <button key={p.key} type="button" onClick={() => setPreset(p.key)} className="rounded-[8px] px-3 py-2 text-left text-xs font-bold" style={{ background: preset === p.key ? "var(--hk-cyan-soft, var(--admin-surface-soft))" : "transparent", color: "var(--admin-text-primary)" }}>
                  {p.label}
                </button>
              ))}
            </div>
            {preset === "custom" && (
              <div className="mt-2 grid gap-2">
                <label className="grid gap-1 text-xs font-bold" style={{ color: "var(--admin-text-secondary)" }}>Başlangıç<input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="min-h-9 rounded-[8px] border px-2 text-sm" style={{ borderColor: "var(--admin-border)" }} /></label>
                <label className="grid gap-1 text-xs font-bold" style={{ color: "var(--admin-text-secondary)" }}>Bitiş<input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="min-h-9 rounded-[8px] border px-2 text-sm" style={{ borderColor: "var(--admin-border)" }} /></label>
              </div>
            )}
          </AdminFilterSection>
          <AdminFilterSection title="Platformlar">
            <div className="grid gap-1.5">
              {PROVIDERS.map((p) => (
                <label key={p} className="flex items-center gap-2 text-xs font-bold" style={{ color: "var(--admin-text-secondary)" }}>
                  <input type="checkbox" checked={selectedProviders.includes(p)} onChange={(e) => setSelectedProviders((current) => e.target.checked ? [...current, p] : current.filter((x) => x !== p))} />
                  {PROVIDER_LABELS[p]}
                </label>
              ))}
            </div>
          </AdminFilterSection>
        </AdminControlPanel>
      }
    >
      {!companyId && <AdminEmptyState title="Müşteri seçilmedi" description="Analiz görüntülemek için sol panelden bir müşteri seçin." />}

      {companyId && (
        <>
          <AdminTabs items={["Genel Bakış", "Hesaplar", "İçerik Performansı", "Raporlama"] as const} active={activeTab} onChange={setActiveTab} ariaLabel="Analiz Merkezi sekmeleri" />

          {activeTab === "Hesaplar" && (
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {tablesReady === false && <AdminEmptyState title="Kurulum gerekli" description="Analiz Merkezi veritabanı tabloları henüz oluşturulmadı. supabase/migrations/20260915_analytics_center.sql migration'ı uygulanmalı." />}
              {(connections || []).map((conn) => {
                const Icon = PROVIDER_ICONS[conn.provider];
                return (
                  <div key={conn.provider} className="admin-card rounded-[14px] p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2"><Icon size={18} /><strong className="text-sm">{conn.label}</strong></div>
                      <AdminStatusBadge tone={STATUS_TONE[conn.status] || "neutral"}>{conn.statusLabel}</AdminStatusBadge>
                    </div>
                    {conn.asset && <p className="mt-2 truncate text-xs font-bold" style={{ color: "var(--admin-text-primary)" }}>{conn.asset.asset_name}</p>}
                    {!conn.asset && <p className="mt-2 text-xs" style={{ color: "var(--admin-text-muted)" }}>Müşteri panelinden (Hesap Bağla) bağlanabilir.</p>}
                    {conn.lastSyncedAt && <p className="mt-1 text-[11px]" style={{ color: "var(--admin-text-muted)" }}>Son güncelleme: {new Date(conn.lastSyncedAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}</p>}
                    {conn.lastError && <p className="mt-1 text-[11px] font-bold text-red-600">{conn.lastError}</p>}
                    {!conn.scopeReady && conn.scopeNote && <p className="mt-2 rounded-[8px] p-2 text-[11px]" style={{ background: "var(--admin-surface-muted, var(--admin-surface-soft))", color: "var(--admin-text-secondary)" }}>{conn.scopeNote}</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {conn.externalHref && <a href={conn.externalHref} target="_blank" rel="noreferrer" className="hk-button hk-button-compact hk-button-secondary">Hesaba Git</a>}
                      <button type="button" onClick={() => { setDrawerProvider(conn.provider); setDrawerAutoLoad(false); setDrawerError(null); }} className="hk-button hk-button-compact hk-button-secondary">Bağlantıyı Yönet</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === "Genel Bakış" && (
            <div className="mt-4 grid gap-5">
              {syncMessage && <p className="rounded-[8px] border p-3 text-sm" style={{ borderColor: "var(--admin-border)", color: "var(--admin-text-secondary)" }}>{syncMessage}</p>}
              {loadingMetrics && <p className="text-sm" style={{ color: "var(--admin-text-muted)" }}>Yükleniyor...</p>}
              {tablesReady === false && <AdminEmptyState title="Kurulum gerekli" description="Analiz Merkezi veritabanı tabloları henüz oluşturulmadı." />}
              {!loadingMetrics && tablesReady !== false && selectedProviders.map((provider) => {
                const providerKpis = (kpis[provider] || []).filter((k) => k.capability === "supported");
                if (!providerKpis.length) return null;
                const hasAnyData = providerKpis.some((k) => k.value !== null);
                return (
                  <section key={provider}>
                    <h3 className="mb-2 text-sm font-black" style={{ color: "var(--admin-text-primary)" }}>{PROVIDER_LABELS[provider]}</h3>
                    {!hasAnyData ? (
                      <AdminEmptyState title={`${PROVIDER_LABELS[provider]} verisi yok`} description="Bağlantı yok, senkronizasyon henüz yapılmadı veya seçili dönemde veri bulunamadı." />
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        {providerKpis.filter((k) => k.value !== null).slice(0, 8).map((kpi) => (
                          <AdminKpiCard key={kpi.key} label={kpi.label} value={unitFormat(kpi.value!, kpi.unit)} note={kpi.changePercent !== null ? `${kpi.changePercent >= 0 ? "↑" : "↓"} ${Math.abs(kpi.changePercent).toFixed(1)}% önceki döneme göre` : "Önceki dönem verisi yok"} icon={<BarChart3 size={18} />} tone={kpi.changePercent !== null && kpi.changePercent < 0 ? "warning" : "primary"} />
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}

          {activeTab === "İçerik Performansı" && (
            <div className="mt-4">
              <AdminDataGrid columns={contentColumns} rows={content} rowKey={(row) => row.id} emptyTitle="İçerik verisi yok" emptyDescription="Seçili dönemde Instagram, Facebook veya YouTube içeriği bulunamadı." />
            </div>
          )}

          {activeTab === "Raporlama" && (
            <div className="mt-4 grid gap-5 xl:grid-cols-[1fr_360px]">
              <div className="admin-card rounded-[14px] p-4">
                <h3 className="text-sm font-black" style={{ color: "var(--admin-text-primary)" }}>Rapor Oluştur</h3>
                <div className="mt-3 grid gap-3">
                  <label className="grid gap-1 text-xs font-bold" style={{ color: "var(--admin-text-secondary)" }}>Rapor başlığı (opsiyonel)<input value={reportTitle} onChange={(e) => setReportTitle(e.target.value)} className="min-h-10 rounded-[8px] border px-3 text-sm" style={{ borderColor: "var(--admin-border)" }} /></label>
                  <div>
                    <p className="mb-1 text-xs font-bold" style={{ color: "var(--admin-text-secondary)" }}>Platformlar</p>
                    <div className="flex flex-wrap gap-2">
                      {PROVIDERS.map((p) => (
                        <label key={p} className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold" style={{ borderColor: "var(--admin-border)" }}>
                          <input type="checkbox" checked={reportPlatforms.includes(p)} onChange={(e) => setReportPlatforms((current) => e.target.checked ? [...current, p] : current.filter((x) => x !== p))} />
                          {PROVIDER_LABELS[p]}
                        </label>
                      ))}
                    </div>
                  </div>
                  <AdminButton variant="primary" onClick={generateReport} disabled={generatingReport || !reportPlatforms.length}>{generatingReport ? "Rapor hazırlanıyor..." : <><FileDown size={15} /> Rapor Oluştur</>}</AdminButton>
                  {reportResult && <a href={reportResult.pdfUrl} target="_blank" rel="noreferrer" className="hk-button hk-button-success inline-flex w-fit items-center gap-2"><FileDown size={15} /> PDF İndir</a>}
                </div>
              </div>
              <div className="admin-card rounded-[14px] p-4">
                <h3 className="text-sm font-black" style={{ color: "var(--admin-text-primary)" }}>Kaydedilen Raporlar</h3>
                <div className="mt-3 grid gap-2">
                  {savedReports.map((report) => (
                    <div key={report.id} className="rounded-[8px] border p-3 text-xs" style={{ borderColor: "var(--admin-border)" }}>
                      <strong className="block truncate">{report.title}</strong>
                      <span style={{ color: "var(--admin-text-muted)" }}>{report.period_start} — {report.period_end}</span>
                      {report.customer_documents?.document_url && <a href={report.customer_documents.document_url} target="_blank" rel="noreferrer" className="mt-1 block font-bold text-cyan-700">PDF&apos;yi Aç</a>}
                    </div>
                  ))}
                  {!savedReports.length && <p className="text-xs" style={{ color: "var(--admin-text-muted)" }}>Henüz rapor oluşturulmadı.</p>}
                </div>
              </div>
            </div>
          )}
        </>
      )}
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
