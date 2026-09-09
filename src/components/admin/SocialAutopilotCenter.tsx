"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, Bot, Calendar, Camera, CheckCircle2, Pause, Play,
  RefreshCw, Send, Settings2, Shield, Sparkles, TrendingUp, Upload, XCircle, Zap
} from "lucide-react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminStatusBadge, type AdminStatusTone } from "@/components/admin/ui/AdminStatusBadge";
import { AdminTabs } from "@/components/admin/ui/AdminTabs";
import { AdminEmptyState, AdminLoadingState } from "@/components/admin/ui/AdminEmptyState";
import { AdminWorkspace } from "@/components/admin/workspace/AdminWorkspace";
import { AdminDataGrid, type AdminDataGridColumn } from "@/components/admin/workspace/AdminDataGrid";
import { AdminCompactKpiStrip } from "@/components/admin/workspace/AdminCompactKpiStrip";
import { FUNNEL_STAGE_LABELS } from "@/lib/social-autopilot/constants";
import type {
  SocialAiLearning, SocialAutopilotRun, SocialAutopilotSettings, SocialBrandProfile, SocialClicheEntry,
  SocialContentItem, SocialPublicationStatus, SocialQueueItem, SocialStrategy
} from "@/lib/social-autopilot/types";
import type { InstagramConnectionStatus } from "@/lib/social-autopilot/instagram-oauth";

const tabs = ["overview", "strategy", "calendar", "studio", "queue", "analytics", "learnings", "settings", "integrations"] as const;
type Tab = typeof tabs[number];
const tabLabels: Record<Tab, string> = {
  overview: "Genel Bakış", strategy: "30 Günlük Strateji", calendar: "İçerik Takvimi", studio: "İçerik Stüdyosu",
  queue: "Yayın Kuyruğu", analytics: "Instagram Analytics", learnings: "AI Öğrenmeleri", settings: "Autopilot Ayarları",
  integrations: "Entegrasyonlar"
};

const statusLabels: Record<SocialPublicationStatus, string> = {
  draft: "Taslak", generated: "Üretildi", quality_check: "Kalite Kontrolü", ready: "Hazır", scheduled: "Planlandı",
  preparing: "Hazırlanıyor", publishing: "Yayınlanıyor", processing: "İşleniyor", published: "Yayınlandı",
  failed: "Başarısız", needs_review: "İnceleme Gerekli", paused: "Duraklatıldı", cancelled: "İptal Edildi"
};
const statusTone: Record<SocialPublicationStatus, AdminStatusTone> = {
  draft: "neutral", generated: "info", quality_check: "info", ready: "ai", scheduled: "premium", preparing: "info",
  publishing: "info", processing: "info", published: "success", failed: "danger", needs_review: "warning",
  paused: "neutral", cancelled: "neutral"
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) throw new Error(payload?.error || `İstek başarısız (${response.status}).`);
  return payload as T;
}

type AnalyticsSummary = {
  publishedLast30d: number; todayScheduled: number; todayPublished: number; todayPending: number; todayFailed: number;
  queueNeedsReview: number; reach30d: number; followerGrowth: number | null; followerCount: number | null;
  bestContentPillar: string | null; bestContentType: string | null;
};
type HeatmapCell = { weekday: number; hour: number; avg_score: number; sample_size: number; confidence: string };

const WEEKDAY_LABELS = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

export function SocialAutopilotCenter() {
  const [tab, setTab] = useState<Tab>("overview");
  const [feedback, setFeedback] = useState("");
  const [busyAction, setBusyAction] = useState("");

  const [settings, setSettings] = useState<SocialAutopilotSettings | null>(null);
  const [brand, setBrand] = useState<SocialBrandProfile | null>(null);
  const [strategy, setStrategy] = useState<{ active: SocialStrategy | null; history: SocialStrategy[] }>({ active: null, history: [] });
  const [items, setItems] = useState<SocialContentItem[]>([]);
  const [queue, setQueue] = useState<Array<SocialQueueItem & { social_content_items: SocialContentItem | null }>>([]);
  const [learnings, setLearnings] = useState<SocialAiLearning[]>([]);
  const [runs, setRuns] = useState<SocialAutopilotRun[]>([]);
  const [instagramStatus, setInstagramStatus] = useState<InstagramConnectionStatus | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapCell[]>([]);
  const [blacklist, setBlacklist] = useState<SocialClicheEntry[]>([]);

  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [studioDraft, setStudioDraft] = useState<Partial<SocialContentItem>>({});
  const [genDate, setGenDate] = useState(new Date().toISOString().slice(0, 10));
  const [newPhrase, setNewPhrase] = useState("");

  function loadAll() {
    fetchJson<{ settings: SocialAutopilotSettings }>("/api/admin/social-autopilot/settings").then((d) => setSettings(d.settings)).catch(() => {});
    fetchJson<{ brand: SocialBrandProfile }>("/api/admin/social-autopilot/brand-profile").then((d) => setBrand(d.brand)).catch(() => {});
    fetchJson<{ active: SocialStrategy | null; history: SocialStrategy[] }>("/api/admin/social-autopilot/strategy").then(setStrategy).catch(() => {});
    fetchJson<{ items: SocialContentItem[] }>("/api/admin/social-autopilot/content").then((d) => setItems(d.items || [])).catch(() => {});
    fetchJson<{ queue: typeof queue }>("/api/admin/social-autopilot/queue").then((d) => setQueue(d.queue || [])).catch(() => {});
    fetchJson<{ learnings: SocialAiLearning[] }>("/api/admin/social-autopilot/learnings").then((d) => setLearnings(d.learnings || [])).catch(() => {});
    fetchJson<{ runs: SocialAutopilotRun[] }>("/api/admin/social-autopilot/runs").then((d) => setRuns(d.runs || [])).catch(() => {});
    fetchJson<{ status: InstagramConnectionStatus }>("/api/admin/social-autopilot/instagram/status").then((d) => setInstagramStatus(d.status)).catch(() => {});
    fetchJson<AnalyticsSummary>("/api/admin/social-autopilot/analytics/summary").then(setAnalytics).catch(() => {});
    fetchJson<{ cells: HeatmapCell[] }>("/api/admin/social-autopilot/analytics/heatmap").then((d) => setHeatmap(d.cells || [])).catch(() => {});
    fetchJson<{ entries: SocialClicheEntry[] }>("/api/admin/social-autopilot/cliche-blacklist").then((d) => setBlacklist(d.entries || [])).catch(() => {});
  }

  useEffect(() => {
    const timer = window.setTimeout(loadAll, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const found = items.find((item) => item.id === selectedItemId);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets the edit draft whenever the selected content item changes, same justified one-time-sync pattern as AdminStandaloneShell's theme read
    setStudioDraft(found || {});
  }, [selectedItemId, items]);

  const selectedItem = items.find((item) => item.id === selectedItemId) || null;
  const readyOrDraftItems = useMemo(() => items.filter((item) => !["published", "cancelled"].includes(item.publication_status)), [items]);
  const nextScheduled = useMemo(() => items.filter((item) => item.publication_status === "scheduled" && item.scheduled_at).sort((a, b) => (a.scheduled_at! < b.scheduled_at! ? -1 : 1))[0], [items]);

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

  function saveSettings(patch: Partial<SocialAutopilotSettings>) {
    return runAction("settings", () => fetchJson<{ settings: SocialAutopilotSettings }>("/api/admin/social-autopilot/settings", { method: "PUT", body: JSON.stringify(patch) }).then((d) => setSettings(d.settings)), "Ayarlar kaydedildi.");
  }

  function saveBrand(patch: Partial<SocialBrandProfile>) {
    return runAction("brand", () => fetchJson<{ brand: SocialBrandProfile }>("/api/admin/social-autopilot/brand-profile", { method: "PUT", body: JSON.stringify(patch) }).then((d) => setBrand(d.brand)), "Marka profili kaydedildi.");
  }

  function generateStrategy() {
    return runAction("strategy", () => fetchJson("/api/admin/social-autopilot/strategy/generate", { method: "POST" }), "Yeni 30 günlük strateji oluşturuldu.", () => fetchJson<{ active: SocialStrategy | null; history: SocialStrategy[] }>("/api/admin/social-autopilot/strategy").then(setStrategy));
  }

  function runDailyNow() {
    return runAction("run-daily", () => fetchJson("/api/admin/social-autopilot/run-daily", { method: "POST" }), "Günlük döngü çalıştırıldı.", loadAll);
  }

  function processQueueNow() {
    return runAction("process-queue", () => fetchJson("/api/admin/social-autopilot/queue/process-due", { method: "POST" }), "Yayın kuyruğu işlendi.", loadAll);
  }

  function generateForDate() {
    return runAction("generate-date", () => fetchJson("/api/admin/social-autopilot/content", { method: "POST", body: JSON.stringify({ contentDate: genDate }) }), `${genDate} için içerik üretildi.`, () => fetchJson<{ items: SocialContentItem[] }>("/api/admin/social-autopilot/content").then((d) => setItems(d.items || [])));
  }

  function generateLearningsNow() {
    return runAction("learnings", () => fetchJson("/api/admin/social-autopilot/learnings/generate", { method: "POST" }), "AI öğrenmeleri güncellendi.", () => fetchJson<{ learnings: SocialAiLearning[] }>("/api/admin/social-autopilot/learnings").then((d) => setLearnings(d.learnings || [])));
  }

  function saveStudioDraft() {
    if (!selectedItem) return Promise.resolve();
    const { title, hook, secondary_hook, caption, cta, cta_goal, hashtags } = studioDraft;
    return runAction("studio-save", () => fetchJson(`/api/admin/social-autopilot/content/${selectedItem.id}`, { method: "PATCH", body: JSON.stringify({ title, hook, secondary_hook, caption, cta, cta_goal, hashtags }) }), "Değişiklikler kaydedildi.", () => fetchJson<{ items: SocialContentItem[] }>("/api/admin/social-autopilot/content").then((d) => setItems(d.items || [])));
  }

  function regenerateSelected() {
    if (!selectedItem) return Promise.resolve();
    return runAction("studio-regen", () => fetchJson(`/api/admin/social-autopilot/content/${selectedItem.id}/regenerate`, { method: "POST" }), "İçerik yeniden üretildi.", () => fetchJson<{ items: SocialContentItem[] }>("/api/admin/social-autopilot/content").then((d) => setItems(d.items || [])));
  }

  function scheduleSelected() {
    if (!selectedItem) return Promise.resolve();
    return runAction("studio-schedule", () => fetchJson(`/api/admin/social-autopilot/content/${selectedItem.id}/schedule`, { method: "POST", body: JSON.stringify({}) }), "İçerik yayın kuyruğuna planlandı.", loadAll);
  }

  async function uploadMedia(file: File) {
    if (!selectedItem) return;
    setBusyAction("studio-media");
    setFeedback("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`/api/admin/social-autopilot/content/${selectedItem.id}/media`, { method: "POST", body: formData });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.error) throw new Error(payload?.error || "Medya yüklenemedi.");
      setFeedback("Medya yüklendi.");
      fetchJson<{ items: SocialContentItem[] }>("/api/admin/social-autopilot/content").then((d) => setItems(d.items || []));
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Medya yüklenemedi.");
    } finally {
      setBusyAction("");
    }
  }

  function cancelItem(id: string) {
    return runAction(`cancel-${id}`, () => fetchJson(`/api/admin/social-autopilot/content/${id}/cancel`, { method: "POST" }), "İçerik iptal edildi.", loadAll);
  }

  function connectInstagram() {
    window.location.href = "/api/admin/social-autopilot/instagram/connect";
  }

  function disconnectInstagram() {
    return runAction("ig-disconnect", () => fetchJson("/api/admin/social-autopilot/instagram/disconnect", { method: "POST" }), "Instagram bağlantısı kaldırıldı.", () => fetchJson<{ status: InstagramConnectionStatus }>("/api/admin/social-autopilot/instagram/status").then((d) => setInstagramStatus(d.status)));
  }

  function addBlacklistPhrase() {
    if (!newPhrase.trim()) return Promise.resolve();
    return runAction("blacklist-add", () => fetchJson("/api/admin/social-autopilot/cliche-blacklist", { method: "POST", body: JSON.stringify({ phrase: newPhrase.trim() }) }), "Klişe eklendi.", () => {
      setNewPhrase("");
      fetchJson<{ entries: SocialClicheEntry[] }>("/api/admin/social-autopilot/cliche-blacklist").then((d) => setBlacklist(d.entries || []));
    });
  }

  const contentColumns: AdminDataGridColumn<SocialContentItem>[] = [
    { key: "date", header: "Tarih", render: (row) => row.content_date, width: "100px" },
    { key: "type", header: "Format", render: (row) => row.content_type },
    { key: "title", header: "Başlık / Hook", render: (row) => <div><p className="font-black">{row.title || row.topic}</p><p className="text-xs opacity-70">{row.hook}</p></div> },
    { key: "funnel", header: "Funnel", render: (row) => FUNNEL_STAGE_LABELS[row.funnel_stage] || row.funnel_stage },
    { key: "score", header: "Kalite", render: (row) => row.quality_score != null ? <AdminStatusBadge tone={row.quality_score >= 85 ? "success" : row.quality_score >= 60 ? "warning" : "danger"}>{row.quality_score}/100</AdminStatusBadge> : "—" },
    { key: "status", header: "Durum", render: (row) => <AdminStatusBadge tone={statusTone[row.publication_status]}>{statusLabels[row.publication_status]}</AdminStatusBadge> },
    {
      key: "actions", header: "", align: "right", render: (row) => (
        <div className="flex justify-end gap-2">
          <AdminButton compact variant="ghost" onClick={() => { setSelectedItemId(row.id); setTab("studio"); }}>Stüdyoya Aç</AdminButton>
          {!["published", "cancelled", "scheduled"].includes(row.publication_status) && (
            <AdminButton compact variant="danger" loading={busyAction === `cancel-${row.id}`} onClick={() => cancelItem(row.id)}>İptal</AdminButton>
          )}
        </div>
      )
    }
  ];

  const queueColumns: AdminDataGridColumn<SocialQueueItem & { social_content_items: SocialContentItem | null }>[] = [
    { key: "title", header: "İçerik", render: (row) => row.social_content_items?.title || row.social_content_items?.topic || "—" },
    { key: "scheduled", header: "Planlanan Zaman", render: (row) => new Date(row.scheduled_at).toLocaleString("tr-TR") },
    { key: "status", header: "Durum", render: (row) => <AdminStatusBadge tone={row.status === "published" ? "success" : row.status === "needs_review" ? "danger" : row.status === "failed" ? "danger" : "info"}>{row.status}</AdminStatusBadge> },
    { key: "attempts", header: "Deneme", render: (row) => `${row.attempt_count}/${row.max_attempts}`, align: "right" },
    { key: "error", header: "Son Hata", render: (row) => row.last_error ? <span className="text-xs text-red-600">{row.last_error}</span> : "—" }
  ];

  const runColumns: AdminDataGridColumn<SocialAutopilotRun>[] = [
    { key: "type", header: "Tür", render: (row) => row.run_type },
    { key: "status", header: "Durum", render: (row) => <AdminStatusBadge tone={row.status === "success" ? "success" : row.status === "failed" ? "danger" : row.status === "partial" ? "warning" : "info"}>{row.status}</AdminStatusBadge> },
    { key: "started", header: "Başladı", render: (row) => new Date(row.started_at).toLocaleString("tr-TR") },
    { key: "affected", header: "Etkilenen", render: (row) => row.affected_count, align: "right" },
    { key: "trigger", header: "Tetikleyici", render: (row) => row.triggered_by === "cron" ? "Otomatik" : "Manuel" }
  ];

  return (
    <AdminWorkspace
      title="HK Social Autopilot"
      eyebrow="Instagram Strateji • İçerik • Yayın • Analitik • Öğrenme Motoru"
      description="HK Dijital Instagram hesabı için uçtan uca otonom içerik stratejisi, üretimi, kalite kontrolü, yayın ve performans öğrenmesi."
      headerActions={
        <>
          <AdminButton variant="secondary" icon={<RefreshCw size={14} />} loading={busyAction === "process-queue"} onClick={processQueueNow}>Kuyruğu Şimdi İşle</AdminButton>
          <AdminButton variant="primary" icon={<Bot size={14} />} loading={busyAction === "run-daily"} onClick={runDailyNow}>Günlük Döngüyü Çalıştır</AdminButton>
        </>
      }
    >
      {feedback && <div className="admin-card-soft mb-4 rounded-[12px] p-3 text-sm font-bold">{feedback}</div>}

      <AdminTabs items={tabs.map((key) => tabLabels[key])} active={tabLabels[tab]} onChange={(label) => setTab((Object.keys(tabLabels) as Tab[]).find((key) => tabLabels[key] === label) || "overview")} />

      {tab === "overview" && settings && (
        <div className="grid gap-5">
          <div className="admin-card flex flex-wrap items-center justify-between gap-4 rounded-[20px] p-5">
            <div>
              <p className="text-xs font-black uppercase tracking-wide opacity-60">Autopilot Durumu</p>
              <p className="mt-1 text-lg font-black">
                {settings.emergency_pause ? "ACİL DURDURULDU" : settings.autopilot_active ? "AKTİF" : "DURAKLATILDI"} — {settings.control_mode === "full_auto" ? "Tam Otomatik" : settings.control_mode === "approval" ? "Onaylı" : "Manuel"}
                {settings.test_mode && <AdminStatusBadge tone="warning"> Test Modu</AdminStatusBadge>}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <AdminButton variant={settings.autopilot_active ? "warning" : "success"} icon={settings.autopilot_active ? <Pause size={14} /> : <Play size={14} />} loading={busyAction === "settings"} onClick={() => saveSettings({ autopilot_active: !settings.autopilot_active })}>
                {settings.autopilot_active ? "Duraklat" : "Aktifleştir"}
              </AdminButton>
              <AdminButton variant="danger" icon={<AlertTriangle size={14} />} loading={busyAction === "settings"} onClick={() => saveSettings({ emergency_pause: !settings.emergency_pause, emergency_pause_reason: settings.emergency_pause ? null : "Manuel acil durdurma" })}>
                {settings.emergency_pause ? "Acil Durdurmayı Kaldır" : "OTOMATİK YAYINI DURDUR"}
              </AdminButton>
            </div>
          </div>

          {analytics && (
            <AdminCompactKpiStrip items={[
              { key: "today-sched", label: "Bugün Planlanan", value: analytics.todayScheduled, icon: <Calendar size={16} />, tone: "primary" },
              { key: "today-pub", label: "Bugün Yayınlanan", value: analytics.todayPublished, icon: <CheckCircle2 size={16} />, tone: "success" },
              { key: "today-pending", label: "Bekleyen", value: analytics.todayPending, icon: <Activity size={16} />, tone: "info" },
              { key: "failed", label: "Başarısız / İnceleme", value: analytics.todayFailed + analytics.queueNeedsReview, icon: <XCircle size={16} />, tone: analytics.todayFailed ? "danger" : "success" },
              { key: "reach", label: "30 Gün Erişim", value: analytics.reach30d, icon: <TrendingUp size={16} />, tone: "gold" },
              { key: "followers", label: "Takipçi Artışı", value: analytics.followerGrowth ?? "—", icon: <Sparkles size={16} />, tone: "ai" }
            ]} />
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="admin-card rounded-[16px] p-4">
              <p className="font-black">Instagram Bağlantısı</p>
              {instagramStatus ? (
                <>
                  <AdminStatusBadge tone={instagramStatus.status === "connected" ? "success" : "danger"}>{instagramStatus.status === "connected" ? `Bağlı — @${instagramStatus.username}` : "Bağlı Değil"}</AdminStatusBadge>
                  {instagramStatus.status === "connected" && <p className="mt-2 text-xs opacity-70">Token durumu: {instagramStatus.tokenHealth} · Son yayın: {instagramStatus.lastPublishAt ? new Date(instagramStatus.lastPublishAt).toLocaleString("tr-TR") : "yok"}</p>}
                </>
              ) : <AdminLoadingState />}
            </div>
            <div className="admin-card rounded-[16px] p-4">
              <p className="font-black">Sıradaki Planlanan Gönderi</p>
              {nextScheduled ? (
                <>
                  <p className="mt-1 text-sm font-bold">{nextScheduled.title || nextScheduled.topic}</p>
                  <p className="text-xs opacity-70">{new Date(nextScheduled.scheduled_at!).toLocaleString("tr-TR")} — güven: {nextScheduled.publish_confidence || "—"}</p>
                </>
              ) : <p className="mt-1 text-sm opacity-70">Planlanmış gönderi yok.</p>}
            </div>
          </div>

          <div className="admin-card rounded-[20px] p-5">
            <p className="text-xs font-black uppercase tracking-wide opacity-60">Son Çalışmalar</p>
            <div className="mt-3"><AdminDataGrid columns={runColumns} rows={runs.slice(0, 8)} rowKey={(row) => row.id} emptyTitle="Henüz çalışma yok" /></div>
          </div>
        </div>
      )}

      {tab === "strategy" && (
        <div className="grid gap-5">
          <div className="flex justify-end"><AdminButton variant="primary" icon={<Sparkles size={14} />} loading={busyAction === "strategy"} onClick={generateStrategy}>Stratejiyi Şimdi Oluştur / Yenile</AdminButton></div>
          {strategy.active ? (
            <div className="admin-card grid gap-3 rounded-[20px] p-5">
              <p className="text-lg font-black">{strategy.active.period_start} → {strategy.active.period_end}</p>
              <p><strong>Hedef:</strong> {strategy.active.monthly_objective}</p>
              <p><strong>Kitle:</strong> {strategy.active.target_audience}</p>
              <p><strong>İçerik Sütunları:</strong> {strategy.active.content_pillars.map((pillar) => `${pillar.name} (${Math.round(pillar.weight * 100)}%)`).join(", ") || "—"}</p>
              <p><strong>Format Oranları:</strong> Reel %{Math.round(strategy.active.reel_ratio * 100)} · Carousel %{Math.round(strategy.active.carousel_ratio * 100)} · Static %{Math.round(strategy.active.static_ratio * 100)}</p>
              <p><strong>Takipçi Stratejisi:</strong> {strategy.active.follower_strategy}</p>
              <p><strong>Otorite Stratejisi:</strong> {strategy.active.authority_strategy}</p>
              <p><strong>Lead Stratejisi:</strong> {strategy.active.lead_strategy}</p>
              <p><strong>Kreatif Temalar:</strong> {strategy.active.creative_themes.join(", ")}</p>
              <p><strong>Test Hipotezleri:</strong> {strategy.active.testing_hypotheses.map((hypothesis) => hypothesis.hypothesis).join("; ") || "—"}</p>
            </div>
          ) : <AdminEmptyState title="Aktif strateji yok" description="Yukarıdaki butonla ilk 30 günlük stratejiyi oluşturun." />}

          <div className="admin-card rounded-[16px] p-4">
            <p className="font-black">Geçmiş Stratejiler</p>
            <div className="mt-2 grid gap-2 text-sm">
              {strategy.history.map((entry) => <div key={entry.id} className="flex items-center justify-between"><span>{entry.period_start} → {entry.period_end}</span><AdminStatusBadge tone={entry.status === "active" ? "success" : "neutral"}>{entry.status}</AdminStatusBadge></div>)}
            </div>
          </div>
        </div>
      )}

      {tab === "calendar" && (
        <div className="grid gap-5">
          <div className="admin-card flex flex-wrap items-end gap-3 rounded-[16px] p-4">
            <div>
              <label className="text-xs font-black uppercase tracking-wide opacity-60">Tarih</label>
              <input type="date" value={genDate} onChange={(event) => setGenDate(event.target.value)} className="mt-1 rounded-[10px] px-3 py-2 text-sm font-bold outline-none" style={{ border: "1px solid var(--admin-border)", background: "var(--admin-surface)", color: "var(--admin-text-primary)" }} />
            </div>
            <AdminButton variant="primary" icon={<Sparkles size={14} />} loading={busyAction === "generate-date"} onClick={generateForDate}>Bu Tarih İçin İçerik Üret</AdminButton>
          </div>
          <AdminDataGrid columns={contentColumns} rows={items} rowKey={(row) => row.id} emptyTitle="İçerik bulunamadı" emptyDescription="Yukarıdan bir tarih seçip içerik üretin veya günlük döngüyü çalıştırın." />
        </div>
      )}

      {tab === "studio" && (
        <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
          <div className="admin-card rounded-[16px] p-3">
            <p className="mb-2 text-xs font-black uppercase tracking-wide opacity-60">İçerikler</p>
            <div className="grid gap-1">
              {readyOrDraftItems.map((item) => (
                <button key={item.id} onClick={() => setSelectedItemId(item.id)} className={`rounded-[10px] p-2 text-left text-sm ${selectedItemId === item.id ? "admin-card-soft font-black" : ""}`}>
                  <span className="block truncate">{item.title || item.topic}</span>
                  <span className="text-xs opacity-60">{item.content_date} · {statusLabels[item.publication_status]}</span>
                </button>
              ))}
              {!readyOrDraftItems.length && <p className="text-sm opacity-60">Henüz içerik yok.</p>}
            </div>
          </div>

          {selectedItem ? (
            <div className="admin-card grid gap-4 rounded-[20px] p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <AdminStatusBadge tone={statusTone[selectedItem.publication_status]}>{statusLabels[selectedItem.publication_status]}</AdminStatusBadge>
                {selectedItem.quality_score != null && <AdminStatusBadge tone={selectedItem.quality_score >= 85 ? "success" : "warning"}>Kalite: {selectedItem.quality_score}/100</AdminStatusBadge>}
                <span className="text-xs opacity-60">{selectedItem.content_type} · {FUNNEL_STAGE_LABELS[selectedItem.funnel_stage]} · {selectedItem.content_pillar}</span>
              </div>

              <label className="grid gap-1 text-sm"><span className="text-xs font-black uppercase tracking-wide opacity-60">Başlık</span>
                <input value={studioDraft.title || ""} onChange={(event) => setStudioDraft((draft) => ({ ...draft, title: event.target.value }))} className="rounded-[10px] px-3 py-2 outline-none" style={{ border: "1px solid var(--admin-border)", background: "var(--admin-surface)" }} />
              </label>
              <label className="grid gap-1 text-sm"><span className="text-xs font-black uppercase tracking-wide opacity-60">Hook</span>
                <textarea value={studioDraft.hook || ""} onChange={(event) => setStudioDraft((draft) => ({ ...draft, hook: event.target.value }))} rows={2} className="rounded-[10px] px-3 py-2 outline-none" style={{ border: "1px solid var(--admin-border)", background: "var(--admin-surface)" }} />
              </label>
              {selectedItem.creative_brief?.script && (
                <label className="grid gap-1 text-sm"><span className="text-xs font-black uppercase tracking-wide opacity-60">Script (salt okunur — Yeniden Üret ile değiştirin)</span>
                  <textarea readOnly value={selectedItem.creative_brief.script} rows={5} className="rounded-[10px] px-3 py-2 opacity-80 outline-none" style={{ border: "1px solid var(--admin-border)", background: "var(--admin-surface)" }} />
                </label>
              )}
              <label className="grid gap-1 text-sm"><span className="text-xs font-black uppercase tracking-wide opacity-60">Caption</span>
                <textarea value={studioDraft.caption || ""} onChange={(event) => setStudioDraft((draft) => ({ ...draft, caption: event.target.value }))} rows={5} className="rounded-[10px] px-3 py-2 outline-none" style={{ border: "1px solid var(--admin-border)", background: "var(--admin-surface)" }} />
              </label>
              <label className="grid gap-1 text-sm"><span className="text-xs font-black uppercase tracking-wide opacity-60">CTA</span>
                <input value={studioDraft.cta || ""} onChange={(event) => setStudioDraft((draft) => ({ ...draft, cta: event.target.value }))} className="rounded-[10px] px-3 py-2 outline-none" style={{ border: "1px solid var(--admin-border)", background: "var(--admin-surface)" }} />
              </label>

              <div>
                <p className="text-xs font-black uppercase tracking-wide opacity-60">Medya ({selectedItem.media_asset_urls?.length || 0})</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(selectedItem.media_asset_urls || []).map((url) => <a key={url} href={url} target="_blank" rel="noreferrer" className="text-xs underline">{url.split("/").pop()}</a>)}
                </div>
                <label className="hk-button hk-button-neutral mt-2 inline-flex w-fit cursor-pointer items-center gap-2">
                  <Upload size={14} /> Medya Yükle
                  <input type="file" accept="image/jpeg,video/mp4,video/quicktime" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadMedia(file); }} />
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                <AdminButton variant="primary" icon={<CheckCircle2 size={14} />} loading={busyAction === "studio-save"} onClick={saveStudioDraft}>Kaydet</AdminButton>
                <AdminButton variant="ai" icon={<Sparkles size={14} />} loading={busyAction === "studio-regen"} onClick={regenerateSelected}>Yeniden Üret</AdminButton>
                {selectedItem.publication_status === "ready" && (
                  <AdminButton variant="success" icon={<Send size={14} />} loading={busyAction === "studio-schedule"} onClick={scheduleSelected}>Onayla ve Planla</AdminButton>
                )}
              </div>
              {selectedItem.failure_reason && <p className="text-xs text-red-600">{selectedItem.failure_reason}</p>}
            </div>
          ) : <AdminEmptyState title="İçerik seçin" description="Soldaki listeden bir içerik seçerek düzenleyin." />}
        </div>
      )}

      {tab === "queue" && (
        <div className="grid gap-4">
          <div className="flex justify-end"><AdminButton variant="primary" icon={<RefreshCw size={14} />} loading={busyAction === "process-queue"} onClick={processQueueNow}>Kuyruğu Şimdi İşle</AdminButton></div>
          <AdminDataGrid columns={queueColumns} rows={queue} rowKey={(row) => row.id} emptyTitle="Kuyrukta içerik yok" />
        </div>
      )}

      {tab === "analytics" && analytics && (
        <div className="grid gap-5">
          <AdminCompactKpiStrip items={[
            { key: "published", label: "Yayınlanan (30g)", value: analytics.publishedLast30d, icon: <Camera size={16} />, tone: "primary" },
            { key: "reach", label: "Erişim (30g)", value: analytics.reach30d, icon: <TrendingUp size={16} />, tone: "gold" },
            { key: "followers", label: "Takipçi", value: analytics.followerCount ?? "—", icon: <Sparkles size={16} />, tone: "ai" },
            { key: "pillar", label: "En İyi Sütun", value: analytics.bestContentPillar || "—", icon: <Zap size={16} />, tone: "success" },
            { key: "type", label: "En İyi Format", value: analytics.bestContentType || "—", icon: <Activity size={16} />, tone: "info" }
          ]} />
          <div className="admin-card rounded-[20px] p-5">
            <p className="text-xs font-black uppercase tracking-wide opacity-60">Yayın Zamanı Isı Haritası (gün × saat, ortalama performans skoru)</p>
            {heatmap.length ? (
              <div className="mt-3 overflow-x-auto">
                <div className="grid min-w-[600px] grid-cols-8 gap-1 text-xs">
                  <div />
                  {WEEKDAY_LABELS.map((label) => <div key={label} className="text-center font-black">{label}</div>)}
                  {Array.from({ length: 24 }, (_, hour) => (
                    <div key={hour} className="contents">
                      <div className="text-right font-black opacity-60">{hour}:00</div>
                      {WEEKDAY_LABELS.map((_, weekday) => {
                        const cell = heatmap.find((entry) => entry.weekday === weekday && entry.hour === hour);
                        const intensity = cell ? Math.min(1, cell.avg_score / 100) : 0;
                        return <div key={weekday} title={cell ? `${cell.avg_score}/100 (n=${cell.sample_size}, ${cell.confidence})` : "veri yok"} className="aspect-square rounded-[4px]" style={{ background: cell ? `rgba(79,53,168,${0.15 + intensity * 0.7})` : "var(--admin-border)" }} />;
                      })}
                    </div>
                  ))}
                </div>
              </div>
            ) : <p className="mt-2 text-sm opacity-70">Henüz yeterli veri yok — gönderiler yayınlandıkça ısı haritası dolacak.</p>}
          </div>
        </div>
      )}

      {tab === "learnings" && (
        <div className="grid gap-4">
          <div className="flex justify-end"><AdminButton variant="ai" icon={<Sparkles size={14} />} loading={busyAction === "learnings"} onClick={generateLearningsNow}>Öğrenmeleri Şimdi Güncelle</AdminButton></div>
          {learnings.length ? learnings.map((learning) => (
            <div key={learning.id} className="admin-card rounded-[16px] p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-black">{learning.title}</p>
                <AdminStatusBadge tone={learning.confidence === "high" ? "success" : learning.confidence === "medium" ? "warning" : "neutral"}>{learning.confidence} güven (n={learning.sample_size})</AdminStatusBadge>
              </div>
              <p className="mt-1 text-sm opacity-80">{learning.summary}</p>
              <p className="mt-1 text-sm font-bold">Aksiyon: {learning.action_recommendation}</p>
            </div>
          )) : <AdminEmptyState title="Henüz öğrenme yok" description="Yeterli yayınlanmış içerik ve performans verisi biriktikçe burada gerçek performansa dayalı öğrenmeler görünecek." />}
        </div>
      )}

      {tab === "settings" && settings && brand && (
        <div className="grid gap-5">
          <div className="admin-card grid gap-4 rounded-[20px] p-5">
            <p className="font-black">Autopilot Kontrol</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="grid gap-1 text-sm"><span className="text-xs font-black uppercase tracking-wide opacity-60">Kontrol Modu</span>
                <select value={settings.control_mode} onChange={(event) => saveSettings({ control_mode: event.target.value as SocialAutopilotSettings["control_mode"] })} className="rounded-[10px] px-3 py-2 outline-none" style={{ border: "1px solid var(--admin-border)", background: "var(--admin-surface)" }}>
                  <option value="manual">Manuel</option><option value="approval">Onaylı</option><option value="full_auto">Tam Otomatik</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm"><span className="text-xs font-black uppercase tracking-wide opacity-60">Min. Kalite Skoru</span>
                <input type="number" min={0} max={100} defaultValue={settings.min_quality_score} onBlur={(event) => saveSettings({ min_quality_score: Number(event.target.value) })} className="rounded-[10px] px-3 py-2 outline-none" style={{ border: "1px solid var(--admin-border)", background: "var(--admin-surface)" }} />
              </label>
              <label className="grid gap-1 text-sm"><span className="text-xs font-black uppercase tracking-wide opacity-60">Haftalık Yayın Sıklığı</span>
                <input type="number" min={0} max={21} defaultValue={settings.posting_frequency_per_week} onBlur={(event) => saveSettings({ posting_frequency_per_week: Number(event.target.value) })} className="rounded-[10px] px-3 py-2 outline-none" style={{ border: "1px solid var(--admin-border)", background: "var(--admin-surface)" }} />
              </label>
              <label className="grid gap-1 text-sm"><span className="text-xs font-black uppercase tracking-wide opacity-60">Günlük Yayın Sınırı</span>
                <input type="number" min={0} max={10} defaultValue={settings.daily_publish_cap} onBlur={(event) => saveSettings({ daily_publish_cap: Number(event.target.value) })} className="rounded-[10px] px-3 py-2 outline-none" style={{ border: "1px solid var(--admin-border)", background: "var(--admin-surface)" }} />
              </label>
              <label className="grid gap-1 text-sm"><span className="text-xs font-black uppercase tracking-wide opacity-60">AI Sağlayıcı Tercihi</span>
                <select value={settings.ai_provider_preference} onChange={(event) => saveSettings({ ai_provider_preference: event.target.value as SocialAutopilotSettings["ai_provider_preference"] })} className="rounded-[10px] px-3 py-2 outline-none" style={{ border: "1px solid var(--admin-border)", background: "var(--admin-surface)" }}>
                  <option value="auto">Otomatik (Claude varsa öncelikli)</option><option value="anthropic">Claude</option><option value="gemini">Gemini</option>
                </select>
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={settings.test_mode} onChange={(event) => saveSettings({ test_mode: event.target.checked })} /> Test modu (gerçek yayın yapılmaz)</label>
            <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={settings.notify_on_disconnect} onChange={(event) => saveSettings({ notify_on_disconnect: event.target.checked })} /> Instagram bağlantısı kesildiğinde bildir</label>
            <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={settings.notify_on_quality_gate_repeat_failure} onChange={(event) => saveSettings({ notify_on_quality_gate_repeat_failure: event.target.checked })} /> Kalite eşiği tekrar tekrar karşılanmazsa bildir</label>
          </div>

          <div className="admin-card grid gap-4 rounded-[20px] p-5">
            <p className="font-black">Marka DNA</p>
            <label className="grid gap-1 text-sm"><span className="text-xs font-black uppercase tracking-wide opacity-60">Misyon</span>
              <textarea defaultValue={brand.mission} rows={2} onBlur={(event) => saveBrand({ mission: event.target.value })} className="rounded-[10px] px-3 py-2 outline-none" style={{ border: "1px solid var(--admin-border)", background: "var(--admin-surface)" }} />
            </label>
            <label className="grid gap-1 text-sm"><span className="text-xs font-black uppercase tracking-wide opacity-60">Ton Rehberi</span>
              <textarea defaultValue={brand.tone_guidelines} rows={3} onBlur={(event) => saveBrand({ tone_guidelines: event.target.value })} className="rounded-[10px] px-3 py-2 outline-none" style={{ border: "1px solid var(--admin-border)", background: "var(--admin-surface)" }} />
            </label>
            <label className="grid gap-1 text-sm"><span className="text-xs font-black uppercase tracking-wide opacity-60">Coğrafya</span>
              <input defaultValue={brand.geography} onBlur={(event) => saveBrand({ geography: event.target.value })} className="rounded-[10px] px-3 py-2 outline-none" style={{ border: "1px solid var(--admin-border)", background: "var(--admin-surface)" }} />
            </label>
          </div>

          <div className="admin-card grid gap-3 rounded-[20px] p-5">
            <p className="font-black">Klişe / AI İzi Kara Listesi</p>
            <div className="flex gap-2">
              <input value={newPhrase} onChange={(event) => setNewPhrase(event.target.value)} placeholder="Yeni klişe ifade ekle" className="flex-1 rounded-[10px] px-3 py-2 text-sm outline-none" style={{ border: "1px solid var(--admin-border)", background: "var(--admin-surface)" }} />
              <AdminButton variant="primary" loading={busyAction === "blacklist-add"} onClick={addBlacklistPhrase}>Ekle</AdminButton>
            </div>
            <div className="grid gap-1">
              {blacklist.map((entry) => <div key={entry.id} className="flex items-center justify-between text-sm"><span className={entry.active ? "" : "opacity-40 line-through"}>{entry.phrase}</span><AdminStatusBadge tone="neutral">{entry.category}</AdminStatusBadge></div>)}
            </div>
          </div>
        </div>
      )}

      {tab === "integrations" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="admin-card rounded-[16px] p-4">
            <p className="flex items-center gap-2 font-black"><Camera size={16} /> Instagram</p>
            {instagramStatus ? (
              <div className="mt-2 grid gap-1 text-sm">
                <p>Durum: <AdminStatusBadge tone={instagramStatus.status === "connected" ? "success" : "neutral"}>{instagramStatus.status}</AdminStatusBadge></p>
                {instagramStatus.username && <p>Hesap: @{instagramStatus.username} ({instagramStatus.accountType})</p>}
                {instagramStatus.scopes.length > 0 && <p className="text-xs opacity-70">İzinler: {instagramStatus.scopes.join(", ")}</p>}
                <p className="text-xs opacity-70">Token durumu: {instagramStatus.tokenHealth}</p>
                <p className="text-xs opacity-70">Son API çağrısı: {instagramStatus.lastSuccessfulCallAt ? new Date(instagramStatus.lastSuccessfulCallAt).toLocaleString("tr-TR") : "—"}</p>
                <p className="text-xs opacity-70">Son yayın: {instagramStatus.lastPublishAt ? new Date(instagramStatus.lastPublishAt).toLocaleString("tr-TR") : "—"}</p>
                <p className="text-xs opacity-70">Son analitik senkronizasyonu: {instagramStatus.lastInsightsSyncAt ? new Date(instagramStatus.lastInsightsSyncAt).toLocaleString("tr-TR") : "—"}</p>
                {instagramStatus.lastError && <p className="text-xs text-red-600">{instagramStatus.lastError}</p>}
                {!instagramStatus.appConfigured && <p className="text-xs text-amber-600">INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET yapılandırılmadı.</p>}
                <div className="mt-2 flex gap-2">
                  {instagramStatus.status === "connected"
                    ? <AdminButton variant="danger" loading={busyAction === "ig-disconnect"} onClick={disconnectInstagram}>Bağlantıyı Kes</AdminButton>
                    : <AdminButton variant="primary" icon={<Camera size={14} />} disabled={!instagramStatus.appConfigured} onClick={connectInstagram}>Instagram&apos;ı Bağla</AdminButton>}
                </div>
              </div>
            ) : <AdminLoadingState />}
          </div>
          <div className="admin-card rounded-[16px] p-4">
            <p className="flex items-center gap-2 font-black"><Bot size={16} /> AI Sağlayıcılar</p>
            <p className="mt-2 text-sm opacity-70">Strateji ve içerik üretimi HK AI Router üzerinden çalışır. Claude (Anthropic) yapılandırıldığında otomatik olarak önceliklendirilir, aksi halde Gemini kullanılır.</p>
          </div>
          <div className="admin-card rounded-[16px] p-4 sm:col-span-2">
            <p className="flex items-center gap-2 font-black"><Shield size={16} /> Gizlilik Filtresi</p>
            <p className="mt-2 text-sm opacity-70">Her içerik, yayınlanmadan önce public.companies ve public.customers tablolarındaki gerçek isim, kullanıcı adı, alan adı, telefon ve e-posta bilgilerine karşı otomatik olarak taranır. Bir eşleşme bulunursa içerik otomatik olarak yayınlanamaz.</p>
          </div>
          <div className="admin-card rounded-[16px] p-4 sm:col-span-2">
            <p className="flex items-center gap-2 font-black"><Settings2 size={16} /> Cron / Otomasyon</p>
            <div className="mt-2 grid gap-1 text-sm opacity-70">
              <p>Günlük döngü, yayın kuyruğu işleme ve analitik senkronizasyonu Vercel Cron ile otomatik çalışır (vercel.json). Aşağıdaki butonlarla manuel de tetikleyebilirsiniz.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <AdminButton compact variant="secondary" loading={busyAction === "run-daily"} onClick={runDailyNow}>Günlük Döngü</AdminButton>
                <AdminButton compact variant="secondary" loading={busyAction === "process-queue"} onClick={processQueueNow}>Kuyruk İşleme</AdminButton>
                <AdminButton compact variant="secondary" loading={busyAction === "learnings"} onClick={generateLearningsNow}>Öğrenme Güncelleme</AdminButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminWorkspace>
  );
}
