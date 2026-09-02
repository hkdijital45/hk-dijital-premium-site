"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, ArrowUpRight, Bot, CheckCircle2, Gauge, Globe2,
  RefreshCw, Search, Send, Sparkles, TrendingUp, XCircle
} from "lucide-react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminStatusBadge, type AdminStatusTone } from "@/components/admin/ui/AdminStatusBadge";
import { AdminTabs } from "@/components/admin/ui/AdminTabs";
import { AdminEmptyState, AdminErrorState, AdminLoadingState } from "@/components/admin/ui/AdminEmptyState";
import { AdminWorkspace } from "@/components/admin/workspace/AdminWorkspace";
import { AdminDataGrid, type AdminDataGridColumn } from "@/components/admin/workspace/AdminDataGrid";
import { AdminCompactKpiStrip } from "@/components/admin/workspace/AdminCompactKpiStrip";
import { analyzeGeoSignals } from "@/lib/growth-intelligence/geo-doctor";
import { GeminiVisibilityPanel } from "@/components/admin/GeminiVisibilityPanel";
import type {
  GrowthAutomationMode, GrowthAutomationRun, GrowthOpportunity, GrowthOpportunityStatus, GrowthSettings
} from "@/lib/growth-intelligence/types";
import type { BlogPost } from "@/lib/blog-seo-shared";

const tabs = ["overview", "opportunities", "geo-doctor", "gemini-visibility", "automation", "integrations", "logs"] as const;
type Tab = typeof tabs[number];
const tabLabels: Record<Tab, string> = {
  overview: "Genel Bakış",
  opportunities: "Fırsatlar",
  "geo-doctor": "GEO Doktoru",
  "gemini-visibility": "Gemini Görünürlüğü",
  automation: "Otomasyon",
  integrations: "Entegrasyonlar",
  logs: "Loglar"
};

const opportunityStatusLabels: Record<GrowthOpportunityStatus, string> = {
  new: "Yeni", reviewing: "İnceleniyor", converted: "Dönüştürüldü", dismissed: "Reddedildi"
};
const opportunityStatusTone: Record<GrowthOpportunityStatus, AdminStatusTone> = {
  new: "info", reviewing: "warning", converted: "success", dismissed: "neutral"
};

const automationModeLabels: Record<GrowthAutomationMode, string> = {
  manual: "Sadece Manuel", assisted: "Destekli", semi_automatic: "Yarı Otomatik", fully_automatic: "Tam Otomatik"
};

function scoreTone(score: number): AdminStatusTone {
  if (score >= 75) return "success";
  if (score >= 50) return "warning";
  return "danger";
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) throw new Error(payload?.error || `İstek başarısız (${response.status}).`);
  return payload as T;
}

export function GrowthIntelligenceCenter({ geminiConfigured = false }: { geminiConfigured?: boolean }) {
  const [tab, setTab] = useState<Tab>("overview");

  const [opportunities, setOpportunities] = useState<GrowthOpportunity[]>([]);
  const [opportunitiesLoading, setOpportunitiesLoading] = useState(true);
  const [opportunitiesError, setOpportunitiesError] = useState("");

  const [settings, setSettings] = useState<GrowthSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);

  const [runs, setRuns] = useState<GrowthAutomationRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(true);

  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);

  const [busyAction, setBusyAction] = useState("");
  const [feedback, setFeedback] = useState("");

  function loadOpportunities() {
    setOpportunitiesLoading(true);
    setOpportunitiesError("");
    fetchJson<{ opportunities: GrowthOpportunity[] }>("/api/admin/growth-intelligence/opportunities")
      .then((data) => setOpportunities(data.opportunities || []))
      .catch((error) => setOpportunitiesError(error instanceof Error ? error.message : "Fırsatlar yüklenemedi."))
      .finally(() => setOpportunitiesLoading(false));
  }

  function loadSettings() {
    setSettingsLoading(true);
    setSettingsError("");
    fetchJson<{ settings: GrowthSettings }>("/api/admin/growth-intelligence/settings")
      .then((data) => setSettings(data.settings))
      .catch((error) => setSettingsError(error instanceof Error ? error.message : "Ayarlar yüklenemedi."))
      .finally(() => setSettingsLoading(false));
  }

  function loadRuns() {
    setRunsLoading(true);
    fetchJson<{ runs: GrowthAutomationRun[] }>("/api/admin/growth-intelligence/runs")
      .then((data) => setRuns(data.runs || []))
      .catch(() => setRuns([]))
      .finally(() => setRunsLoading(false));
  }

  function loadPosts() {
    setPostsLoading(true);
    fetchJson<{ posts: BlogPost[] }>("/api/admin/blog-posts?status=published")
      .then((data) => setPosts(data.posts || []))
      .catch(() => setPosts([]))
      .finally(() => setPostsLoading(false));
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadOpportunities();
      loadSettings();
      loadRuns();
      loadPosts();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const openOpportunities = useMemo(() => opportunities.filter((item) => item.status === "new"), [opportunities]);
  const topOpportunity = openOpportunities[0];
  const geoResults = useMemo(() => posts.map((post) => ({ post, ...analyzeGeoSignals(post) })), [posts]);
  const avgGeoScore = geoResults.length ? Math.round(geoResults.reduce((sum, item) => sum + item.geo_score, 0) / geoResults.length) : 0;
  const avgSeoScore = posts.length ? Math.round(posts.reduce((sum, post) => sum + (post.seo_score || 0), 0) / posts.length) : 0;
  const lastRun = runs[0];

  async function runAction(key: string, action: () => Promise<unknown>, successMessage: string, onDone?: () => void) {
    setBusyAction(key);
    setFeedback("");
    try {
      await action();
      setFeedback(successMessage);
      onDone?.();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "İşlem başarısız oldu.");
    } finally {
      setBusyAction("");
    }
  }

  function syncNow() {
    return runAction("sync", () => fetchJson("/api/admin/growth-intelligence/sync", { method: "POST" }), "Search Console senkronizasyonu tamamlandı.", () => {
      loadOpportunities();
      loadRuns();
    });
  }

  function runDailyCycleNow() {
    return runAction("run-daily", () => fetchJson("/api/admin/growth-intelligence/run-daily", { method: "POST" }), "Günlük otomasyon döngüsü çalıştırıldı.", () => {
      loadOpportunities();
      loadRuns();
    });
  }

  function convertOpportunity(id: string) {
    return runAction(`convert-${id}`, () => fetchJson("/api/admin/growth-intelligence/opportunities/convert", { method: "POST", body: JSON.stringify({ opportunityId: id }) }), "Fırsat içerik planına eklendi.", loadOpportunities);
  }

  function dismissOpportunity(id: string) {
    return runAction(`dismiss-${id}`, () => fetchJson("/api/admin/growth-intelligence/opportunities", { method: "PATCH", body: JSON.stringify({ id, status: "dismissed" }) }), "Fırsat reddedildi.", loadOpportunities);
  }

  function saveSettings(patch: Partial<GrowthSettings>) {
    if (!settings) return;
    setSettingsSaving(true);
    fetchJson<{ settings: GrowthSettings }>("/api/admin/growth-intelligence/settings", { method: "PUT", body: JSON.stringify(patch) })
      .then((data) => setSettings(data.settings))
      .catch((error) => setFeedback(error instanceof Error ? error.message : "Ayarlar kaydedilemedi."))
      .finally(() => setSettingsSaving(false));
  }

  const opportunityColumns: AdminDataGridColumn<GrowthOpportunity>[] = [
    { key: "score", header: "Skor", render: (row) => <AdminStatusBadge tone={scoreTone(row.opportunity_score)}>{row.opportunity_score}/100</AdminStatusBadge>, width: "90px" },
    { key: "query", header: "Sorgu", render: (row) => <div><p className="font-black">{row.query}</p><p className="text-xs opacity-70">{row.page || "Sayfa yok — yeni içerik fırsatı"}</p></div> },
    { key: "metrics", header: "Gösterim / Tıklama / Sıra", render: (row) => `${row.impressions} / ${row.clicks} / ${row.avg_position.toFixed(1)}` },
    { key: "action", header: "Önerilen Aksiyon", render: (row) => <span className="text-xs leading-5">{row.recommended_action}</span> },
    { key: "status", header: "Durum", render: (row) => <AdminStatusBadge tone={opportunityStatusTone[row.status]}>{opportunityStatusLabels[row.status]}</AdminStatusBadge> },
    {
      key: "actions", header: "", align: "right", render: (row) => row.status === "new" || row.status === "reviewing" ? (
        <div className="flex justify-end gap-2">
          <AdminButton compact variant="primary" icon={<Sparkles size={14} />} loading={busyAction === `convert-${row.id}`} onClick={() => convertOpportunity(row.id!)}>Brief Oluştur</AdminButton>
          <AdminButton compact variant="ghost" icon={<XCircle size={14} />} loading={busyAction === `dismiss-${row.id}`} onClick={() => dismissOpportunity(row.id!)}>Yok Say</AdminButton>
        </div>
      ) : null
    }
  ];

  const runColumns: AdminDataGridColumn<GrowthAutomationRun>[] = [
    { key: "type", header: "Tür", render: (row) => row.run_type },
    { key: "status", header: "Durum", render: (row) => <AdminStatusBadge tone={row.status === "success" ? "success" : row.status === "failed" ? "danger" : row.status === "partial" ? "warning" : "info"}>{row.status}</AdminStatusBadge> },
    { key: "started", header: "Başladı", render: (row) => new Date(row.started_at).toLocaleString("tr-TR") },
    { key: "affected", header: "Etkilenen Kayıt", render: (row) => row.affected_count, align: "right" },
    { key: "trigger", header: "Tetikleyici", render: (row) => row.triggered_by === "cron" ? "Otomatik" : "Manuel" },
    { key: "error", header: "Hata", render: (row) => row.error ? <span className="text-xs text-red-600">{row.error}</span> : "—" }
  ];

  return (
    <AdminWorkspace
      title="SEO & GEO Command Center"
      eyebrow="HK Growth Intelligence · SEO • GEO • Content • Authority Engine"
      description="Search Console sinyallerinden gerçek fırsat skorlaması, GEO/cevap-motoru hazırlığı ve günlük SEO otomasyonu."
      headerActions={
        <>
          <AdminButton variant="secondary" icon={<RefreshCw size={14} />} loading={busyAction === "sync"} onClick={syncNow}>Search Console&apos;u Senkronize Et</AdminButton>
          <AdminButton variant="primary" icon={<Bot size={14} />} loading={busyAction === "run-daily"} onClick={runDailyCycleNow}>Günlük Döngüyü Şimdi Çalıştır</AdminButton>
        </>
      }
    >
      {feedback && <div className="admin-card-soft mb-4 rounded-[12px] p-3 text-sm font-bold">{feedback}</div>}

      <AdminTabs items={tabs.map((key) => tabLabels[key])} active={tabLabels[tab]} onChange={(label) => setTab((Object.keys(tabLabels) as Tab[]).find((key) => tabLabels[key] === label) || "overview")} />

      {tab === "overview" && (
        <div className="grid gap-5">
          <AdminCompactKpiStrip items={[
            { key: "opps", label: "Açık Fırsat", value: openOpportunities.length, icon: <Search size={16} />, tone: "info" },
            { key: "seo", label: "Ort. SEO Skoru", value: `${avgSeoScore}/100`, icon: <Gauge size={16} />, tone: avgSeoScore >= 75 ? "success" : "warning" },
            { key: "geo", label: "Ort. GEO Skoru", value: `${avgGeoScore}/100`, icon: <Globe2 size={16} />, tone: avgGeoScore >= 75 ? "success" : "warning" },
            { key: "published", label: "Yayında Yazı", value: posts.length, icon: <CheckCircle2 size={16} />, tone: "primary" },
            { key: "mode", label: "Otomasyon Modu", value: settings ? automationModeLabels[settings.automation_mode] : "—", icon: <Activity size={16} />, tone: "ai" },
            { key: "lastrun", label: "Son Çalışma", value: lastRun ? new Date(lastRun.started_at).toLocaleDateString("tr-TR") : "Henüz yok", icon: <TrendingUp size={16} />, tone: "gold" }
          ]} />

          <div className="admin-card rounded-[20px] p-5">
            <p className="text-xs font-black uppercase tracking-wide opacity-60">Bugünün AI Önerisi</p>
            {opportunitiesLoading ? <AdminLoadingState /> : topOpportunity ? (
              <div className="mt-3 grid gap-2">
                <p className="text-lg font-black">{topOpportunity.query}</p>
                <p className="text-sm opacity-80">{topOpportunity.recommended_action}</p>
                <div className="mt-1 flex flex-wrap gap-2 text-xs">
                  <AdminStatusBadge tone={scoreTone(topOpportunity.opportunity_score)}>Opportunity Score: {topOpportunity.opportunity_score}/100</AdminStatusBadge>
                  <AdminStatusBadge tone="neutral">{topOpportunity.impressions} gösterim</AdminStatusBadge>
                  <AdminStatusBadge tone="neutral">Sıra {topOpportunity.avg_position.toFixed(1)}</AdminStatusBadge>
                </div>
                <div className="mt-3">
                  <AdminButton variant="primary" icon={<Sparkles size={14} />} loading={busyAction === `convert-${topOpportunity.id}`} onClick={() => convertOpportunity(topOpportunity.id!)}>Brief Oluştur ve Blog &amp; SEO Merkezi&apos;ne Gönder</AdminButton>
                </div>
              </div>
            ) : <p className="mt-2 text-sm opacity-70">Henüz açık fırsat yok — &quot;Search Console&apos;u Senkronize Et&quot; ile başlayın.</p>}
          </div>

          <Link href="/hk-admin/blog-seo" className="admin-card flex items-center justify-between rounded-[16px] p-4 transition hover:-translate-y-0.5">
            <span><strong className="block">Brief → Taslak → Yayın</strong><span className="text-sm opacity-70">İçerik üretimi, düzenleme ve yayınlama Blog &amp; SEO Merkezi&apos;nde yapılır.</span></span>
            <ArrowUpRight size={18} />
          </Link>
        </div>
      )}

      {tab === "opportunities" && (
        opportunitiesLoading ? <AdminLoadingState /> :
        opportunitiesError ? <AdminErrorState description={opportunitiesError} /> :
        <AdminDataGrid columns={opportunityColumns} rows={opportunities} rowKey={(row) => row.id || row.query} emptyTitle="Fırsat bulunamadı" emptyDescription="Search Console&apos;u senkronize ederek başlayın." />
      )}

      {tab === "geo-doctor" && (
        postsLoading ? <AdminLoadingState /> :
        !geoResults.length ? <AdminEmptyState title="Yayında yazı yok" description="GEO analizi için yayınlanmış blog yazısı gerekir." /> :
        <div className="grid gap-3">
          {geoResults.map(({ post, geo_score, checks }) => (
            <div key={post.id} className="admin-card rounded-[16px] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-black">{post.title}</p>
                <AdminStatusBadge tone={scoreTone(geo_score)}>GEO: {geo_score}/100</AdminStatusBadge>
              </div>
              <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                {checks.map((check) => (
                  <div key={check.key} className="flex items-start gap-2 text-xs">
                    {check.passed ? <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" /> : <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />}
                    <span><strong>{check.label}</strong>{!check.passed && <span className="block opacity-70">{check.suggestion}</span>}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "gemini-visibility" && <GeminiVisibilityPanel geminiConfigured={geminiConfigured} />}

      {tab === "automation" && (
        settingsLoading ? <AdminLoadingState /> :
        settingsError ? <AdminErrorState description={settingsError} /> :
        settings && (
          <div className="admin-card grid max-w-2xl gap-5 rounded-[20px] p-5">
            <div>
              <label className="text-xs font-black uppercase tracking-wide opacity-60">Otomasyon Modu</label>
              <select
                className="mt-1 w-full rounded-[10px] px-3 py-2 text-sm font-bold outline-none" style={{ border: "1px solid var(--admin-border)", background: "var(--admin-surface)", color: "var(--admin-text-primary)" }}
                value={settings.automation_mode}
                disabled={settingsSaving}
                onChange={(event) => saveSettings({ automation_mode: event.target.value as GrowthAutomationMode })}
              >
                {(Object.keys(automationModeLabels) as GrowthAutomationMode[]).map((mode) => <option key={mode} value={mode}>{automationModeLabels[mode]}</option>)}
              </select>
              <p className="mt-1 text-xs opacity-60">Manuel dışındaki modlarda günlük döngü, eşiği geçen fırsatları otomatik olarak içerik planına ekler. Taslak üretimi ve yayın her zaman Blog &amp; SEO Merkezi&apos;nde insan onayı ile yapılır.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-black uppercase tracking-wide opacity-60">Min. Opportunity Score</label>
                <input type="number" min={0} max={100} className="mt-1 w-full rounded-[10px] px-3 py-2 text-sm font-bold outline-none" style={{ border: "1px solid var(--admin-border)", background: "var(--admin-surface)", color: "var(--admin-text-primary)" }} defaultValue={settings.min_opportunity_score} disabled={settingsSaving} onBlur={(event) => saveSettings({ min_opportunity_score: Number(event.target.value) })} />
              </div>
              <div>
                <label className="text-xs font-black uppercase tracking-wide opacity-60">Min. Kalite Skoru</label>
                <input type="number" min={0} max={100} className="mt-1 w-full rounded-[10px] px-3 py-2 text-sm font-bold outline-none" style={{ border: "1px solid var(--admin-border)", background: "var(--admin-surface)", color: "var(--admin-text-primary)" }} defaultValue={settings.min_quality_score} disabled={settingsSaving} onBlur={(event) => saveSettings({ min_quality_score: Number(event.target.value) })} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" checked={settings.sitemap_ping_enabled} disabled={settingsSaving} onChange={(event) => saveSettings({ sitemap_ping_enabled: event.target.checked })} />
              Yayın sonrası sitemap ping gönder
            </label>
            <label className="flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" checked={settings.indexnow_enabled} disabled={settingsSaving} onChange={(event) => saveSettings({ indexnow_enabled: event.target.checked })} />
              Yayın sonrası IndexNow&apos;a gönder
            </label>
          </div>
        )
      )}

      {tab === "integrations" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="admin-card rounded-[16px] p-4">
            <p className="font-black">Search Console</p>
            <p className="mt-1 text-sm opacity-70">Fırsat verisi doğrudan gerçek Search Console API çağrısından gelir (servis hesabı OAuth ile).</p>
            <div className="mt-3"><AdminButton variant="secondary" icon={<RefreshCw size={14} />} loading={busyAction === "sync"} onClick={syncNow}>Şimdi Senkronize Et</AdminButton></div>
          </div>
          <div className="admin-card rounded-[16px] p-4">
            <p className="font-black">IndexNow</p>
            <p className="mt-1 text-sm opacity-70">Yayınlanan yazılar otomasyon ayarları açıksa günlük döngüde otomatik gönderilir.</p>
          </div>
        </div>
      )}

      {tab === "logs" && (
        runsLoading ? <AdminLoadingState /> :
        <AdminDataGrid columns={runColumns} rows={runs} rowKey={(row) => row.id || row.started_at} emptyTitle="Henüz çalışma yok" emptyDescription="Günlük döngüyü manuel olarak çalıştırarak ilk logu oluşturabilirsiniz." emptyActions={<AdminButton variant="primary" icon={<Send size={14} />} onClick={runDailyCycleNow}>Şimdi Çalıştır</AdminButton>} />
      )}
    </AdminWorkspace>
  );
}
