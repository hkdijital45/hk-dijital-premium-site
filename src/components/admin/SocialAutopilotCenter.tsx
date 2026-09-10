"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle, BarChart3, Bot, Camera, CheckCircle2, Clock,
  ListChecks, Pause, Play, RefreshCw, Send, ShieldAlert, Sparkles, XCircle
} from "lucide-react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminStatusBadge, type AdminStatusTone } from "@/components/admin/ui/AdminStatusBadge";
import { AdminTabs } from "@/components/admin/ui/AdminTabs";
import { AdminEmptyState, AdminErrorState, AdminLoadingState } from "@/components/admin/ui/AdminEmptyState";
import { AdminWorkspace } from "@/components/admin/workspace/AdminWorkspace";
import { AdminDataGrid, type AdminDataGridColumn } from "@/components/admin/workspace/AdminDataGrid";
import { AdminCompactKpiStrip } from "@/components/admin/workspace/AdminCompactKpiStrip";
import type {
  AiLearning, ClicheEntry, ControlMode, PrivacyBlacklistEntry, PublishingTimeRecommendation,
  ReadinessReport, SocialAutopilotSettings, SocialContentItem, SocialQueueItem, SocialStrategy
} from "@/lib/social-autopilot/types";
import type { InstagramConnectionStatus } from "@/lib/social-autopilot/instagram-oauth";

const tabs = ["overview", "strategy", "calendar", "studio", "queue", "analytics", "learnings", "settings", "integrations"] as const;
type Tab = typeof tabs[number];
const tabLabels: Record<Tab, string> = {
  overview: "Genel Bakış", strategy: "30 Günlük Strateji", calendar: "İçerik Takvimi", studio: "İçerik Stüdyosu",
  queue: "Yayın Kuyruğu", analytics: "Instagram Analytics", learnings: "AI Öğrenmeleri", settings: "Autopilot Ayarları",
  integrations: "Entegrasyonlar"
};

type DashboardData = {
  autopilotActive: boolean; emergencyPause: boolean; controlMode: ControlMode; testMode: boolean;
  instagramConnection: InstagramConnectionStatus;
  today: { scheduled: number; published: number; failures: number };
  last30Days: { reach: number; followerGrowth: number | null; profileVisits: number; saves: number; shares: number };
  bestContentType: { name: string; score: number; sample_size: number } | null;
  strongestContentPillar: { name: string; score: number; sample_size: number } | null;
  strongestPublishingWindow: PublishingTimeRecommendation | null;
  nextPost: Pick<SocialContentItem, "id" | "content_date" | "scheduled_at" | "content_type" | "title"> | null;
  strategySupply: { remainingContentItems: number; coverageDays: number; warning: boolean; message: string };
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) throw new Error(payload?.error || `İstek başarısız (${response.status}).`);
  return payload as T;
}

function readinessTone(status: string): AdminStatusTone {
  if (status === "READY") return "success";
  if (status === "WARNING") return "warning";
  return "danger";
}

function statusTone(status: string): AdminStatusTone {
  if (["published", "connected", "ready"].includes(status)) return "success";
  if (["failed", "needs_review", "media_failed", "error", "disconnected"].includes(status)) return "danger";
  if (["scheduled", "preparing", "publishing", "generated", "quality_check"].includes(status)) return "info";
  return "neutral";
}

export function SocialAutopilotCenter() {
  const [tab, setTab] = useState<Tab>("overview");
  const [busyAction, setBusyAction] = useState("");
  const [feedback, setFeedback] = useState("");

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");

  const [readiness, setReadiness] = useState<ReadinessReport | null>(null);

  const [strategy, setStrategy] = useState<SocialStrategy | null>(null);
  const [strategyLoading, setStrategyLoading] = useState(true);

  const [calendarItems, setCalendarItems] = useState<SocialContentItem[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(true);

  const [studioItems, setStudioItems] = useState<SocialContentItem[]>([]);
  const [studioLoading, setStudioLoading] = useState(true);

  const [queueItems, setQueueItems] = useState<SocialQueueItem[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);

  const [analytics, setAnalytics] = useState<{ best_content: Array<{ id: string; pillar: string; format: string; score: number }> } | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  const [learnings, setLearnings] = useState<AiLearning[]>([]);
  const [learningsLoading, setLearningsLoading] = useState(true);

  const [settings, setSettings] = useState<SocialAutopilotSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);

  const [clicheEntries, setClicheEntries] = useState<ClicheEntry[]>([]);
  const [privacyEntries, setPrivacyEntries] = useState<PrivacyBlacklistEntry[]>([]);

  const [instagramStatus, setInstagramStatus] = useState<InstagramConnectionStatus | null>(null);

  function loadDashboard() {
    setDashboardLoading(true); setDashboardError("");
    fetchJson<DashboardData>("/api/admin/social-autopilot/dashboard")
      .then(setDashboard)
      .catch((error) => setDashboardError(error instanceof Error ? error.message : "Panel yüklenemedi."))
      .finally(() => setDashboardLoading(false));
  }
  function loadReadiness() {
    fetchJson<{ readiness: ReadinessReport }>("/api/admin/social-autopilot/readiness").then((data) => setReadiness(data.readiness)).catch(() => setReadiness(null));
  }
  function loadStrategy() {
    setStrategyLoading(true);
    fetchJson<{ strategy: SocialStrategy | null }>("/api/admin/social-autopilot/strategy").then((data) => setStrategy(data.strategy)).catch(() => setStrategy(null)).finally(() => setStrategyLoading(false));
  }
  function loadCalendar() {
    setCalendarLoading(true);
    const start = new Date().toISOString().slice(0, 10);
    const end = new Date(Date.now() + 30 * 24 * 60 * 60_000).toISOString().slice(0, 10);
    fetchJson<{ items: SocialContentItem[] }>(`/api/admin/social-autopilot/calendar?start=${start}&end=${end}`).then((data) => setCalendarItems(data.items || [])).catch(() => setCalendarItems([])).finally(() => setCalendarLoading(false));
  }
  function loadStudio() {
    setStudioLoading(true);
    fetchJson<{ items: SocialContentItem[] }>("/api/admin/social-autopilot/content?limit=50").then((data) => setStudioItems(data.items || [])).catch(() => setStudioItems([])).finally(() => setStudioLoading(false));
  }
  function loadQueue() {
    setQueueLoading(true);
    fetchJson<{ items: SocialQueueItem[] }>("/api/admin/social-autopilot/queue").then((data) => setQueueItems(data.items || [])).catch(() => setQueueItems([])).finally(() => setQueueLoading(false));
  }
  function loadAnalytics() {
    setAnalyticsLoading(true);
    fetchJson<{ performance: { best_content: Array<{ id: string; pillar: string; format: string; score: number }> } }>("/api/admin/social-autopilot/analytics?range=30d")
      .then((data) => setAnalytics(data.performance)).catch(() => setAnalytics(null)).finally(() => setAnalyticsLoading(false));
  }
  function loadLearnings() {
    setLearningsLoading(true);
    fetchJson<{ learnings: AiLearning[] }>("/api/admin/social-autopilot/learnings").then((data) => setLearnings(data.learnings || [])).catch(() => setLearnings([])).finally(() => setLearningsLoading(false));
  }
  function loadSettings() {
    setSettingsLoading(true);
    fetchJson<{ settings: SocialAutopilotSettings }>("/api/admin/social-autopilot/settings").then((data) => setSettings(data.settings)).catch(() => setSettings(null)).finally(() => setSettingsLoading(false));
  }
  function loadBlacklists() {
    fetchJson<{ entries: ClicheEntry[] }>("/api/admin/social-autopilot/cliche-blacklist").then((data) => setClicheEntries(data.entries || [])).catch(() => setClicheEntries([]));
    fetchJson<{ entries: PrivacyBlacklistEntry[] }>("/api/admin/social-autopilot/privacy-blacklist").then((data) => setPrivacyEntries(data.entries || [])).catch(() => setPrivacyEntries([]));
  }
  function loadInstagramStatus() {
    fetchJson<{ status: InstagramConnectionStatus }>("/api/admin/social-autopilot/instagram/status").then((data) => setInstagramStatus(data.status)).catch(() => setInstagramStatus(null));
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadDashboard(); loadReadiness(); loadStrategy(); loadCalendar(); loadStudio();
      loadQueue(); loadAnalytics(); loadLearnings(); loadSettings(); loadBlacklists(); loadInstagramStatus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("instagram") === "connected") setFeedback("Instagram bağlantısı başarılı.");
      if (params.get("instagram_error")) setFeedback(`Instagram bağlantı hatası: ${params.get("instagram_error")}`);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function runAction(key: string, action: () => Promise<unknown>, successMessage: string, onDone?: () => void) {
    setBusyAction(key); setFeedback("");
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

  function toggleEmergencyPause() {
    const action = dashboard?.emergencyPause ? "autopilot_resume" : "autopilot_pause";
    return runAction(action, () => fetchJson("/api/admin/social-autopilot/control", { method: "POST", body: JSON.stringify({ action }) }), dashboard?.emergencyPause ? "Autopilot devam ettirildi." : "OTOMATİK YAYIN DURDURULDU.", loadDashboard);
  }

  function runDailyNow() {
    return runAction("run-daily", () => fetchJson("/api/admin/social-autopilot/run-daily", { method: "POST" }), "Günlük döngü çalıştırıldı.", () => { loadDashboard(); loadCalendar(); loadStudio(); });
  }

  function processQueueNow() {
    return runAction("process-queue", () => fetchJson("/api/admin/social-autopilot/process-queue", { method: "POST" }), "Yayın kuyruğu işlendi.", () => { loadQueue(); loadDashboard(); });
  }

  function validateContent(id: string) {
    return runAction(`validate-${id}`, () => fetchJson(`/api/admin/social-autopilot/content/${id}/validate`, { method: "POST" }), "İçerik doğrulandı.", () => { loadStudio(); loadCalendar(); });
  }
  function renderContent(id: string) {
    return runAction(`render-${id}`, () => fetchJson(`/api/admin/social-autopilot/content/${id}/render`, { method: "POST" }), "Medya render edildi.", () => { loadStudio(); loadCalendar(); });
  }
  function publishNow(id: string) {
    return runAction(`publish-${id}`, () => fetchJson(`/api/admin/social-autopilot/content/${id}/publish`, { method: "POST" }), "Yayın denemesi tamamlandı.", () => { loadQueue(); loadStudio(); loadCalendar(); loadDashboard(); });
  }
  function cancelScheduled(id: string) {
    return runAction(`cancel-${id}`, () => fetchJson(`/api/admin/social-autopilot/content/${id}/cancel`, { method: "POST" }), "Planlama iptal edildi.", () => { loadQueue(); loadStudio(); loadCalendar(); });
  }

  function saveSettings(patch: Partial<SocialAutopilotSettings>) {
    if (!settings) return;
    setSettingsSaving(true);
    fetchJson<{ settings: SocialAutopilotSettings }>("/api/admin/social-autopilot/settings", { method: "PATCH", body: JSON.stringify(patch) })
      .then((data) => setSettings(data.settings))
      .catch((error) => setFeedback(error instanceof Error ? error.message : "Ayarlar kaydedilemedi."))
      .finally(() => setSettingsSaving(false));
  }

  function connectInstagram() {
    window.location.href = "/api/admin/social-autopilot/instagram/connect";
  }
  function disconnectInstagram() {
    return runAction("disconnect-instagram", () => fetchJson("/api/admin/social-autopilot/instagram/disconnect", { method: "POST" }), "Instagram bağlantısı kesildi.", () => { loadInstagramStatus(); loadDashboard(); });
  }

  const inputStyle = { border: "1px solid var(--admin-border)", background: "var(--admin-surface)", color: "var(--admin-text-primary)" } as const;

  const calendarColumns: AdminDataGridColumn<SocialContentItem>[] = [
    { key: "date", header: "Tarih", render: (row) => row.content_date, width: "100px" },
    { key: "type", header: "Format", render: (row) => row.content_type },
    { key: "pillar", header: "Sütun", render: (row) => row.content_pillar || "—" },
    { key: "title", header: "Başlık", render: (row) => <span className="font-bold">{row.title || row.topic || "—"}</span> },
    { key: "status", header: "Durum", render: (row) => <AdminStatusBadge tone={statusTone(row.publication_status)}>{row.publication_status}</AdminStatusBadge> },
    { key: "media", header: "Medya", render: (row) => <AdminStatusBadge tone={row.media_generation_status === "generated" ? "success" : row.media_generation_status === "failed" ? "danger" : "neutral"}>{row.media_generation_status}</AdminStatusBadge> }
  ];

  const studioColumns: AdminDataGridColumn<SocialContentItem>[] = [
    { key: "date", header: "Tarih", render: (row) => row.content_date, width: "100px" },
    { key: "title", header: "Başlık / Konu", render: (row) => <div><p className="font-black">{row.title || "—"}</p><p className="text-xs opacity-70">{row.topic}</p></div> },
    { key: "type", header: "Format", render: (row) => row.content_type },
    { key: "quality", header: "Kalite", render: (row) => row.quality_score ?? "—" },
    { key: "status", header: "Durum", render: (row) => <AdminStatusBadge tone={statusTone(row.publication_status)}>{row.publication_status}</AdminStatusBadge> },
    {
      key: "actions", header: "", align: "right", render: (row) => (
        <div className="flex flex-wrap justify-end gap-2">
          {row.publication_status === "needs_review" || row.publication_status === "generated" ? (
            <AdminButton compact variant="secondary" loading={busyAction === `validate-${row.id}`} onClick={() => validateContent(row.id)}>Doğrula</AdminButton>
          ) : null}
          {row.content_type !== "reel" && row.media_generation_status !== "generated" ? (
            <AdminButton compact variant="ai" icon={<Sparkles size={14} />} loading={busyAction === `render-${row.id}`} onClick={() => renderContent(row.id)}>Render Et</AdminButton>
          ) : null}
          {row.publication_status === "scheduled" ? (
            <AdminButton compact variant="danger" icon={<XCircle size={14} />} loading={busyAction === `cancel-${row.id}`} onClick={() => cancelScheduled(row.id)}>İptal</AdminButton>
          ) : null}
        </div>
      )
    }
  ];

  const queueColumns: AdminDataGridColumn<SocialQueueItem>[] = [
    { key: "scheduled", header: "Planlanan Zaman", render: (row) => new Date(row.scheduled_at).toLocaleString("tr-TR") },
    { key: "status", header: "Durum", render: (row) => <AdminStatusBadge tone={statusTone(row.status)}>{row.status}</AdminStatusBadge> },
    { key: "attempts", header: "Deneme", render: (row) => `${row.attempt_count}/${row.max_attempts}` },
    { key: "error", header: "Hata", render: (row) => row.last_error ? <span className="text-xs text-red-600">{row.last_error}</span> : "—" },
    {
      key: "actions", header: "", align: "right", render: (row) => (
        <div className="flex justify-end gap-2">
          {row.status === "scheduled" && (
            <AdminButton compact variant="primary" icon={<Send size={14} />} loading={busyAction === `publish-${row.content_item_id}`} onClick={() => publishNow(row.content_item_id)}>Şimdi Yayınla</AdminButton>
          )}
          {row.status === "scheduled" && (
            <AdminButton compact variant="danger" icon={<XCircle size={14} />} loading={busyAction === `cancel-${row.content_item_id}`} onClick={() => cancelScheduled(row.content_item_id)}>İptal</AdminButton>
          )}
        </div>
      )
    }
  ];

  const learningColumns: AdminDataGridColumn<AiLearning>[] = [
    { key: "title", header: "Öğrenim", render: (row) => <div><p className="font-black">{row.title}</p><p className="text-xs opacity-70">{row.summary}</p></div> },
    { key: "confidence", header: "Güven", render: (row) => <AdminStatusBadge tone={row.confidence === "high" ? "success" : row.confidence === "medium" ? "warning" : "neutral"}>{row.confidence} (n={row.sample_size})</AdminStatusBadge> },
    { key: "action", header: "Önerilen Aksiyon", render: (row) => <span className="text-xs leading-5">{row.action_recommendation}</span> }
  ];

  return (
    <AdminWorkspace
      title="HK Social Autopilot"
      eyebrow="Instagram Strateji · İçerik · Yayın · Öğrenme Motoru"
      description="HK Dijital'ın kendi Instagram hesabı için otonom strateji, deterministik medya üretimi, yayın kuyruğu ve performans öğrenmesi."
      headerActions={
        <>
          <AdminButton variant="secondary" icon={<RefreshCw size={14} />} loading={busyAction === "process-queue"} onClick={processQueueNow}>Kuyruğu İşle</AdminButton>
          <AdminButton variant="primary" icon={<Bot size={14} />} loading={busyAction === "run-daily"} onClick={runDailyNow}>Günlük Döngüyü Çalıştır</AdminButton>
          <AdminButton variant={dashboard?.emergencyPause ? "success" : "danger"} icon={dashboard?.emergencyPause ? <Play size={14} /> : <Pause size={14} />} loading={busyAction === "autopilot_pause" || busyAction === "autopilot_resume"} onClick={toggleEmergencyPause}>
            {dashboard?.emergencyPause ? "Devam Ettir" : "OTOMATİK YAYINI DURDUR"}
          </AdminButton>
        </>
      }
    >
      {feedback && <div className="admin-card-soft mb-4 rounded-[12px] p-3 text-sm font-bold">{feedback}</div>}

      <AdminTabs items={tabs.map((key) => tabLabels[key])} active={tabLabels[tab]} onChange={(label) => setTab((Object.keys(tabLabels) as Tab[]).find((key) => tabLabels[key] === label) || "overview")} />

      {tab === "overview" && (
        dashboardLoading ? <AdminLoadingState /> :
        dashboardError ? <AdminErrorState description={dashboardError} /> :
        dashboard && (
          <div className="grid gap-5">
            <AdminCompactKpiStrip items={[
              { key: "active", label: "Autopilot", value: dashboard.emergencyPause ? "ACİL DURDURULDU" : dashboard.autopilotActive ? "Aktif" : "Pasif", icon: <Bot size={16} />, tone: dashboard.emergencyPause ? "danger" : dashboard.autopilotActive ? "success" : "warning" },
              { key: "ig", label: "Instagram", value: dashboard.instagramConnection.status === "connected" ? `@${dashboard.instagramConnection.username || "bağlı"}` : "Bağlı değil", icon: <Camera size={16} />, tone: dashboard.instagramConnection.status === "connected" ? "success" : "danger" },
              { key: "scheduled", label: "Bugün Planlı", value: dashboard.today.scheduled, icon: <Clock size={16} />, tone: "info" },
              { key: "published", label: "Bugün Yayınlandı", value: dashboard.today.published, icon: <CheckCircle2 size={16} />, tone: "success" },
              { key: "failures", label: "Bugün Başarısız", value: dashboard.today.failures, icon: <AlertTriangle size={16} />, tone: dashboard.today.failures ? "danger" : "success" },
              { key: "reach", label: "30G Erişim", value: dashboard.last30Days.reach.toLocaleString("tr-TR"), icon: <BarChart3 size={16} />, tone: "gold" }
            ]} />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="admin-card rounded-[16px] p-4">
                <p className="text-xs font-black uppercase tracking-wide opacity-60">30 Günlük Performans</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <p>Takipçi Artışı: <strong>{dashboard.last30Days.followerGrowth ?? "—"}</strong></p>
                  <p>Profil Ziyareti: <strong>{dashboard.last30Days.profileVisits}</strong></p>
                  <p>Kaydetme: <strong>{dashboard.last30Days.saves}</strong></p>
                  <p>Paylaşım: <strong>{dashboard.last30Days.shares}</strong></p>
                </div>
              </div>
              <div className="admin-card rounded-[16px] p-4">
                <p className="text-xs font-black uppercase tracking-wide opacity-60">En Güçlü Sinyaller</p>
                <div className="mt-2 grid gap-1 text-sm">
                  <p>En iyi format: <strong>{dashboard.bestContentType?.name || "Henüz veri yok"}</strong></p>
                  <p>En güçlü sütun: <strong>{dashboard.strongestContentPillar?.name || "Henüz veri yok"}</strong></p>
                  <p>En iyi yayın penceresi: <strong>{dashboard.strongestPublishingWindow ? `${dashboard.strongestPublishingWindow.weekday}. gün ${dashboard.strongestPublishingWindow.hour}:00` : "Henüz veri yok"}</strong></p>
                </div>
              </div>
            </div>

            <div className="admin-card rounded-[16px] p-4">
              <p className="text-xs font-black uppercase tracking-wide opacity-60">Strateji Kapsamı</p>
              <p className="mt-2 text-sm">{dashboard.strategySupply.message} ({dashboard.strategySupply.remainingContentItems} içerik, {dashboard.strategySupply.coverageDays} gün kapsam)</p>
              {dashboard.nextPost && <p className="mt-2 text-sm opacity-80">Sıradaki yayın: <strong>{dashboard.nextPost.title || dashboard.nextPost.content_type}</strong> — {dashboard.nextPost.scheduled_at ? new Date(dashboard.nextPost.scheduled_at).toLocaleString("tr-TR") : "—"}</p>}
            </div>

            {readiness && (
              <div className="admin-card rounded-[16px] p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-wide opacity-60">FULL AUTO Hazırlık Durumu</p>
                  <AdminStatusBadge tone={readinessTone(readiness.overall)}>{readiness.overall}</AdminStatusBadge>
                </div>
                <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                  {readiness.checks.map((check) => (
                    <div key={check.key} className="flex items-start gap-2 text-xs">
                      {check.status === "READY" ? <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" /> : <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />}
                      <span><strong>{check.label}</strong><span className="block opacity-70">{check.message}</span></span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      )}

      {tab === "strategy" && (
        strategyLoading ? <AdminLoadingState /> :
        !strategy ? <AdminEmptyState title="Aktif strateji yok" description="Claude MCP'nin strategy_import aracı ile bir 30 günlük strateji/içerik paketi içe aktarın, veya OPTIONAL_API_AI modundaysanız AI ile üretin." /> :
        <div className="admin-card grid gap-4 rounded-[20px] p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-black uppercase tracking-wide opacity-60">{strategy.period_start} → {strategy.period_end}</p>
              <p className="text-lg font-black">{strategy.monthly_objective}</p>
            </div>
            <AdminStatusBadge tone={strategy.status === "active" ? "success" : "neutral"}>{strategy.status}</AdminStatusBadge>
          </div>
          <p className="text-sm opacity-80">Hedef Kitle: {strategy.target_audience}</p>
          <div className="grid gap-2 sm:grid-cols-3 text-sm">
            <p>Reel: <strong>%{Math.round(strategy.reel_ratio * 100)}</strong></p>
            <p>Carousel: <strong>%{Math.round(strategy.carousel_ratio * 100)}</strong></p>
            <p>Static: <strong>%{Math.round(strategy.static_ratio * 100)}</strong></p>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-wide opacity-60">İçerik Sütunları</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {strategy.content_pillars.map((pillar) => <AdminStatusBadge key={pillar.name} tone="info">{pillar.name} (%{Math.round(pillar.weight * 100)})</AdminStatusBadge>)}
            </div>
          </div>
          {strategy.creative_themes.length > 0 && (
            <div>
              <p className="text-xs font-black uppercase tracking-wide opacity-60">Kreatif Temalar</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {strategy.creative_themes.map((theme) => <AdminStatusBadge key={theme} tone="neutral">{theme}</AdminStatusBadge>)}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "calendar" && (
        calendarLoading ? <AdminLoadingState /> :
        <AdminDataGrid columns={calendarColumns} rows={calendarItems} rowKey={(row) => row.id} emptyTitle="Önümüzdeki 30 günde içerik yok" emptyDescription="İçerik Stüdyosu'ndan yeni içerik oluşturun veya Claude MCP ile strateji paketi içe aktarın." />
      )}

      {tab === "studio" && (
        studioLoading ? <AdminLoadingState /> :
        <AdminDataGrid columns={studioColumns} rows={studioItems} rowKey={(row) => row.id} emptyTitle="İçerik yok" emptyDescription="Günlük döngüyü çalıştırın veya Claude MCP ile içerik paketi içe aktarın." />
      )}

      {tab === "queue" && (
        queueLoading ? <AdminLoadingState /> :
        <AdminDataGrid columns={queueColumns} rows={queueItems} rowKey={(row) => row.id} emptyTitle="Yayın kuyruğu boş" emptyDescription="Hazır içerikleri planladığınızda burada görünecek." />
      )}

      {tab === "analytics" && (
        analyticsLoading ? <AdminLoadingState /> :
        !analytics || !analytics.best_content.length ? <AdminEmptyState title="Henüz analitik verisi yok" description="İlk gerçek yayından sonra Instagram Insights senkronize edildikçe burada görünecek." /> :
        <div className="grid gap-3">
          {analytics.best_content.slice(0, 10).map((row) => (
            <div key={row.id} className="admin-card flex items-center justify-between rounded-[14px] p-4">
              <div>
                <p className="font-black">{row.pillar} · {row.format}</p>
              </div>
              <AdminStatusBadge tone={row.score >= 75 ? "success" : row.score >= 50 ? "warning" : "danger"}>Skor: {Math.round(row.score)}/100</AdminStatusBadge>
            </div>
          ))}
        </div>
      )}

      {tab === "learnings" && (
        <div className="grid gap-4">
          <AdminButton variant="ai" icon={<Sparkles size={14} />} loading={busyAction === "refresh-learnings"} onClick={() => runAction("refresh-learnings", () => fetchJson("/api/admin/social-autopilot/learnings", { method: "POST" }), "Öğrenmeler güncellendi.", loadLearnings)}>
            Öğrenmeleri Şimdi Güncelle
          </AdminButton>
          {learningsLoading ? <AdminLoadingState /> :
            <AdminDataGrid columns={learningColumns} rows={learnings} rowKey={(row) => row.id} emptyTitle="Henüz öğrenme yok" emptyDescription="En az 3 yayınlanmış gönderi ve analitik verisi biriktiğinde öğrenmeler burada görünecek." />}
        </div>
      )}

      {tab === "settings" && (
        settingsLoading ? <AdminLoadingState /> :
        settings && (
          <div className="grid gap-5">
            <div className="admin-card grid max-w-2xl gap-5 rounded-[20px] p-5">
              <div>
                <label className="text-xs font-black uppercase tracking-wide opacity-60">Kontrol Modu</label>
                <select className="mt-1 w-full rounded-[10px] px-3 py-2 text-sm font-bold outline-none" style={inputStyle} value={settings.control_mode} disabled={settingsSaving} onChange={(event) => saveSettings({ control_mode: event.target.value as ControlMode })}>
                  <option value="manual">Manuel</option>
                  <option value="approval">Onay Bekler</option>
                  <option value="full_auto">Tam Otomatik</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-black uppercase tracking-wide opacity-60">AI Çalışma Modu</label>
                <select className="mt-1 w-full rounded-[10px] px-3 py-2 text-sm font-bold outline-none" style={inputStyle} value={settings.ai_operating_mode} disabled={settingsSaving} onChange={(event) => saveSettings({ ai_operating_mode: event.target.value as SocialAutopilotSettings["ai_operating_mode"] })}>
                  <option value="claude_code_assisted">Claude Code Destekli (Anthropic API gerekmez)</option>
                  <option value="no_runtime_ai">Yalnızca Deterministik (AI çağrısı yok)</option>
                  <option value="optional_api_ai">Opsiyonel API AI (HK AI Router)</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm font-bold">
                <input type="checkbox" checked={settings.test_mode} disabled={settingsSaving} onChange={(event) => saveSettings({ test_mode: event.target.checked })} />
                Test modu (gerçek Instagram yayınını engeller)
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-black uppercase tracking-wide opacity-60">Min. Kalite Skoru</label>
                  <input type="number" min={0} max={100} className="mt-1 w-full rounded-[10px] px-3 py-2 text-sm font-bold outline-none" style={inputStyle} defaultValue={settings.min_quality_score} disabled={settingsSaving} onBlur={(event) => saveSettings({ min_quality_score: Number(event.target.value) })} />
                </div>
                <div>
                  <label className="text-xs font-black uppercase tracking-wide opacity-60">Haftalık Yayın Sıklığı</label>
                  <input type="number" min={0} max={21} className="mt-1 w-full rounded-[10px] px-3 py-2 text-sm font-bold outline-none" style={inputStyle} defaultValue={settings.posting_frequency_per_week} disabled={settingsSaving} onBlur={(event) => saveSettings({ posting_frequency_per_week: Number(event.target.value) })} />
                </div>
              </div>
            </div>

            <div className="admin-card rounded-[20px] p-5">
              <div className="flex items-center justify-between">
                <p className="font-black">Klişe Kelime Filtresi ({clicheEntries.filter((e) => e.active).length} aktif)</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {clicheEntries.map((entry) => (
                  <button key={entry.id} type="button" onClick={() => { fetchJson(`/api/admin/social-autopilot/cliche-blacklist`, { method: "PATCH", body: JSON.stringify({ id: entry.id, active: !entry.active }) }).then(loadBlacklists); }}>
                    <AdminStatusBadge tone={entry.active ? "danger" : "neutral"}>{entry.phrase}</AdminStatusBadge>
                  </button>
                ))}
              </div>
            </div>

            <div className="admin-card rounded-[20px] p-5">
              <p className="font-black">Gizlilik Kara Listesi ({privacyEntries.filter((e) => e.active).length} aktif)</p>
              <p className="mt-1 text-xs opacity-70">Müşteri isimleri, Instagram kullanıcı adları, alan adları, e-posta ve telefon numaraları — hiçbiri otomatik doldurulmaz, mevcut müşteri tablolarından beslenmez.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {privacyEntries.length ? privacyEntries.map((entry) => <AdminStatusBadge key={entry.id} tone={entry.active ? "danger" : "neutral"}>{entry.kind}: {entry.value}</AdminStatusBadge>) : <span className="text-sm opacity-60">Liste boş.</span>}
              </div>
            </div>
          </div>
        )
      )}

      {tab === "integrations" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="admin-card rounded-[16px] p-4">
            <div className="flex items-center justify-between">
              <p className="font-black">Instagram</p>
              <AdminStatusBadge tone={instagramStatus?.status === "connected" ? "success" : "danger"}>{instagramStatus?.status || "disconnected"}</AdminStatusBadge>
            </div>
            {instagramStatus?.status === "connected" ? (
              <div className="mt-2 grid gap-1 text-sm">
                <p>Kullanıcı: <strong>@{instagramStatus.username}</strong></p>
                <p>Hesap Türü: {instagramStatus.accountType}</p>
                <p>Token Sağlığı: <AdminStatusBadge tone={instagramStatus.tokenHealth === "healthy" ? "success" : instagramStatus.tokenHealth === "warning" ? "warning" : "danger"}>{instagramStatus.tokenHealth}</AdminStatusBadge></p>
                <p>Son Başarılı Çağrı: {instagramStatus.lastSuccessfulCallAt ? new Date(instagramStatus.lastSuccessfulCallAt).toLocaleString("tr-TR") : "—"}</p>
                <p>Son Yayın: {instagramStatus.lastPublishAt ? new Date(instagramStatus.lastPublishAt).toLocaleString("tr-TR") : "—"}</p>
                <p>Son Analitik Senkronizasyonu: {instagramStatus.lastInsightsSyncAt ? new Date(instagramStatus.lastInsightsSyncAt).toLocaleString("tr-TR") : "—"}</p>
                <div className="mt-3"><AdminButton variant="danger" icon={<XCircle size={14} />} loading={busyAction === "disconnect-instagram"} onClick={disconnectInstagram}>Bağlantıyı Kes</AdminButton></div>
              </div>
            ) : (
              <div className="mt-2">
                <p className="text-sm opacity-70">{instagramStatus?.appConfigured ? "Instagram hesabınızı bağlayın." : "Önce INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET ortam değişkenlerini yapılandırın."}</p>
                <div className="mt-3"><AdminButton variant="primary" icon={<Camera size={14} />} disabled={!instagramStatus?.appConfigured} onClick={connectInstagram}>Instagram&apos;ı Bağla</AdminButton></div>
              </div>
            )}
          </div>
          <div className="admin-card rounded-[16px] p-4">
            <p className="font-black">Claude MCP Bağlayıcısı</p>
            <p className="mt-1 text-sm opacity-70">Claude Code / Claude Desktop, aynı backend servislerine yerel MCP bağlantısı ile erişebilir (<code>npm run mcp</code>). Ayrı bir Supabase, ayrı bir giriş sistemi veya Chatplace gerekmez.</p>
            <div className="mt-2 flex items-center gap-2 text-xs">
              <ListChecks size={14} /> 37 araç · READ_ONLY / WRITE_SAFE / WRITE_PUBLISH izin katmanları
            </div>
          </div>
          <div className="admin-card rounded-[16px] p-4 sm:col-span-2">
            <div className="flex items-center gap-2"><ShieldAlert size={16} /><p className="font-black">Yayın Güvenliği</p></div>
            <p className="mt-1 text-sm opacity-70">Gerçek Instagram yayını yalnızca NODE_ENV=production, INSTAGRAM_PUBLISH_ENABLED=true, test modu kapalı, acil durdurma pasif ve autopilot aktifken mümkündür. Diğer tüm durumlarda yayın engellenir.</p>
          </div>
        </div>
      )}
    </AdminWorkspace>
  );
}
