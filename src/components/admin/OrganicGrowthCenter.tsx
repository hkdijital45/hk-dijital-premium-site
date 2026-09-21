"use client";
/* eslint-disable react-hooks/set-state-in-effect -- fetch-on-mount + selection-sync pattern, same accepted precedent as PreAuditCenter.tsx/ContentPlanningCenter.tsx */

import { useCallback, useEffect, useState } from "react";
import {
  BarChart3, Calendar, CheckCircle2, ClipboardCopy, FileText, Layers, Link2, RefreshCw,
  Search, Sparkles, TrendingUp
} from "lucide-react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminStatusBadge } from "@/components/admin/ui/AdminStatusBadge";
import { AdminKpiCard } from "@/components/admin/ui/AdminKpiCard";
import { AdminEmptyState, AdminLoadingState } from "@/components/admin/ui/AdminEmptyState";
import { RichTextEditor } from "@/components/admin/blog/RichTextEditor";
import {
  CONTENT_PLAN_STATUSES, CONTENT_PLAN_STATUS_LABELS, TARGET_SERVICES,
  type ContentPlanItem, type ContentPlanStatus, type MonthlyStrategy, type TopicCluster
} from "@/lib/organic-growth/types";
import { buildArticlePrompt, buildMonthlyStrategyPrompt, CLAUDE_PROJECT_NAME } from "@/lib/organic-growth/claude-prompts";

type Tab = "genel-bakis" | "aylik-strateji" | "icerik-plani" | "konu-kumeleri" | "yazilar" | "seo-geo" | "ic-baglantilar" | "performans";

const TABS: Array<{ key: Tab; label: string; icon: React.ReactNode }> = [
  { key: "genel-bakis", label: "Genel Bakış", icon: <BarChart3 size={15} /> },
  { key: "aylik-strateji", label: "Aylık Strateji", icon: <Calendar size={15} /> },
  { key: "icerik-plani", label: "İçerik Planı", icon: <Layers size={15} /> },
  { key: "konu-kumeleri", label: "Konu Kümeleri", icon: <Sparkles size={15} /> },
  { key: "yazilar", label: "Yazılar", icon: <FileText size={15} /> },
  { key: "seo-geo", label: "SEO & GEO", icon: <Search size={15} /> },
  { key: "ic-baglantilar", label: "İç Bağlantılar", icon: <Link2 size={15} /> },
  { key: "performans", label: "Performans / Güncelleme", icon: <TrendingUp size={15} /> }
];

function nextMonthIso() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`;
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function Notice({ notice }: { notice: { text: string; tone: "success" | "error" } | null }) {
  if (!notice) return null;
  return (
    <div
      className="rounded-[12px] border px-4 py-3 text-sm font-bold"
      style={{
        borderColor: notice.tone === "error" ? "color-mix(in srgb, var(--admin-danger, #dc2626) 40%, transparent)" : "color-mix(in srgb, var(--admin-success, #16a34a) 40%, transparent)",
        color: notice.tone === "error" ? "var(--admin-danger, #dc2626)" : "var(--admin-success, #16a34a)",
        background: "var(--admin-surface)"
      }}
    >
      {notice.text}
    </div>
  );
}

export function OrganicGrowthCenter() {
  const [tab, setTab] = useState<Tab>("genel-bakis");
  const [notice, setNotice] = useState<{ text: string; tone: "success" | "error" } | null>(null);
  const notify = useCallback((text: string, tone: "success" | "error" = "success") => {
    setNotice({ text, tone });
    setTimeout(() => setNotice((current) => (current?.text === text ? null : current)), 5000);
  }, []);

  const [overview, setOverview] = useState<any>(null);
  const [strategies, setStrategies] = useState<MonthlyStrategy[]>([]);
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>("");
  const [items, setItems] = useState<ContentPlanItem[]>([]);
  const [clusters, setClusters] = useState<TopicCluster[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [linkData, setLinkData] = useState<any>(null);
  const [cannibalization, setCannibalization] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewRes, strategiesRes, itemsRes, clustersRes, postsRes] = await Promise.all([
        fetch("/api/admin/organic-growth/overview").then((r) => r.json()).catch(() => null),
        fetch("/api/admin/organic-growth/strategies").then((r) => r.json()).catch(() => ({ strategies: [] })),
        fetch("/api/admin/organic-growth/content-plan").then((r) => r.json()).catch(() => ({ items: [] })),
        fetch("/api/admin/organic-growth/topic-clusters").then((r) => r.json()).catch(() => ({ clusters: [] })),
        fetch("/api/admin/blog-posts").then((r) => r.json()).catch(() => ({ posts: [] }))
      ]);
      setOverview(overviewRes);
      setStrategies(strategiesRes.strategies || []);
      setItems(itemsRes.items || []);
      setClusters(clustersRes.clusters || []);
      setPosts(postsRes.posts || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (tab !== "ic-baglantilar") return;
    fetch("/api/admin/organic-growth/internal-links").then((r) => r.json()).then(setLinkData).catch(() => {});
  }, [tab]);

  useEffect(() => {
    if (tab !== "seo-geo") return;
    fetch("/api/admin/organic-growth/cannibalization").then((r) => r.json()).then((body) => setCannibalization(body.conflicts || [])).catch(() => {});
  }, [tab]);

  return (
    <div className="flex flex-col gap-4">
      <Notice notice={notice} />
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-black transition"
            style={tab === t.key ? { background: "#0891b2", color: "white" } : { background: "var(--admin-surface-soft, #F3F2EE)", color: "var(--admin-text-secondary)" }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading ? <AdminLoadingState label="Organik Büyüme Merkezi yükleniyor..." /> : (
        <>
          {tab === "genel-bakis" && <OverviewTab overview={overview} onNavigate={setTab} />}
          {tab === "aylik-strateji" && (
            <StrategyTab
              strategies={strategies}
              selectedStrategyId={selectedStrategyId}
              onSelect={setSelectedStrategyId}
              clusters={clusters}
              items={items}
              posts={posts}
              notify={notify}
              reload={loadAll}
            />
          )}
          {tab === "icerik-plani" && (
            <ContentPlanTab
              items={items}
              strategies={strategies}
              clusters={clusters}
              notify={notify}
              reload={loadAll}
            />
          )}
          {tab === "konu-kumeleri" && <ClustersTab clusters={clusters} notify={notify} reload={loadAll} />}
          {tab === "yazilar" && <ArticlesTab posts={posts} notify={notify} reload={loadAll} />}
          {tab === "seo-geo" && <SeoGeoTab posts={posts} cannibalization={cannibalization} />}
          {tab === "ic-baglantilar" && <InternalLinksTab linkData={linkData} />}
          {tab === "performans" && <RefreshTab posts={posts} notify={notify} reload={loadAll} />}
        </>
      )}
    </div>
  );
}

// --- Genel Bakış ---------------------------------------------------------

function OverviewTab({ overview, onNavigate }: { overview: any; onNavigate: (tab: Tab) => void }) {
  if (!overview) return <AdminEmptyState title="Veriler yüklenemedi" description="Sayfayı yenileyin." />;
  const s = overview.statusCounts || {};
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <AdminKpiCard label="Bu Ay Planlanan" value={overview.thisMonthPlanned} icon={<Calendar size={18} />} tone="primary" onClick={() => onNavigate("icerik-plani")} />
        <AdminKpiCard label="Brief Hazır" value={s.BRIEF_READY || 0} icon={<FileText size={18} />} tone="info" onClick={() => onNavigate("icerik-plani")} />
        <AdminKpiCard label="Claude Bekleniyor" value={s.WAITING_FOR_CLAUDE || 0} icon={<Sparkles size={18} />} tone="ai" onClick={() => onNavigate("icerik-plani")} />
        <AdminKpiCard label="Taslak" value={s.DRAFT || 0} icon={<FileText size={18} />} tone="warning" onClick={() => onNavigate("yazilar")} />
        <AdminKpiCard label="İncelemede" value={s.REVIEW || 0} icon={<CheckCircle2 size={18} />} tone="warning" onClick={() => onNavigate("seo-geo")} />
        <AdminKpiCard label="Onaylandı" value={s.APPROVED || 0} icon={<CheckCircle2 size={18} />} tone="success" onClick={() => onNavigate("icerik-plani")} />
        <AdminKpiCard label="Yayına Planlandı" value={s.SCHEDULED || 0} icon={<Calendar size={18} />} tone="info" onClick={() => onNavigate("yazilar")} />
        <AdminKpiCard label="Yayınlandı" value={overview.publishedTotal} icon={<TrendingUp size={18} />} tone="success" onClick={() => onNavigate("yazilar")} />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <AdminKpiCard label="SEO Sorunları" value={overview.seoIssues} note="Skoru 70'in altında" icon={<Search size={18} />} tone="danger" onClick={() => onNavigate("seo-geo")} />
        <AdminKpiCard label="GEO Sorunları" value={overview.geoIssues} note="Skoru 70'in altında" icon={<Search size={18} />} tone="danger" onClick={() => onNavigate("seo-geo")} />
        <AdminKpiCard label="Güncelleme Gerekli" value={overview.updateRequired} icon={<RefreshCw size={18} />} tone="warning" onClick={() => onNavigate("performans")} />
        <AdminKpiCard label="Sahipsiz İçerik" value={overview.orphanCount} note={`${overview.internalLinkOpportunities} bağlantı fırsatı`} icon={<Link2 size={18} />} tone="info" onClick={() => onNavigate("ic-baglantilar")} />
      </div>
    </div>
  );
}

// --- Aylık Strateji -------------------------------------------------------

function StrategyTab({ strategies, selectedStrategyId, onSelect, clusters, items, posts, notify, reload }: any) {
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ month: nextMonthIso(), business_objective: "", target_services: [] as string[], target_geography: "Manisa / Türkiye", target_audience: "", publishing_frequency: "Haftada 2 yazı", strategic_notes: "" });
  const [prompt, setPrompt] = useState("");
  const [importRaw, setImportRaw] = useState("");
  const [importPreview, setImportPreview] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const strategy = strategies.find((s: MonthlyStrategy) => s.id === selectedStrategyId) || strategies[0] || null;

  async function submitCreate() {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/organic-growth/strategies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok) { notify(data.error || "Strateji oluşturulamadı.", "error"); return; }
      notify("Aylık strateji oluşturuldu.");
      setCreating(false);
      await reload();
      onSelect(data.strategy.id);
    } finally {
      setBusy(false);
    }
  }

  function generatePrompt() {
    if (!strategy) return;
    const publishedTitles = posts.filter((p: any) => p.status === "published").map((p: any) => p.title).slice(0, 30);
    const plannedTitles = items.map((i: ContentPlanItem) => i.working_title).slice(0, 30);
    const clusterNames = clusters.map((c: TopicCluster) => c.name);
    setPrompt(buildMonthlyStrategyPrompt({
      targetMonth: strategy.month,
      businessObjective: strategy.business_objective,
      targetServices: strategy.target_services,
      targetGeography: strategy.target_geography,
      targetAudience: strategy.target_audience,
      publishingFrequency: strategy.publishing_frequency,
      currentTopicClusters: clusterNames,
      publishedContent: publishedTitles,
      alreadyPlannedContent: plannedTitles,
      strategicNotes: strategy.strategic_notes
    }));
  }

  async function runPreview() {
    if (!strategy) return;
    const response = await fetch("/api/admin/organic-growth/content-plan/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ strategy_id: strategy.id, raw: importRaw, confirm: false }) });
    const data = await response.json();
    if (!response.ok) { notify(data.error || "İçe aktarım doğrulanamadı.", "error"); return; }
    setImportPreview(data);
  }

  async function confirmImport() {
    if (!strategy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/organic-growth/content-plan/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ strategy_id: strategy.id, raw: importRaw, confirm: true }) });
      const data = await response.json();
      if (!response.ok) { notify(data.error || "İçe aktarım başarısız.", "error"); return; }
      notify(`${data.created} yeni içerik planı öğesi içe aktarıldı (${data.skippedAsDuplicate} tekrar atlandı).`);
      setImportRaw("");
      setImportPreview(null);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <div className="flex flex-col gap-2">
        <AdminButton variant="primary" compact onClick={() => setCreating((v) => !v)}>{creating ? "Vazgeç" : "+ Yeni Ay"}</AdminButton>
        {creating && (
          <div className="admin-card flex flex-col gap-2 rounded-[14px] p-3">
            <label className="text-xs font-black">Ay<input type="date" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value.slice(0, 8) + "01" })} className="hk-input mt-1 w-full" /></label>
            <label className="text-xs font-black">İş Hedefi<textarea value={form.business_objective} onChange={(e) => setForm({ ...form, business_objective: e.target.value })} className="hk-input mt-1 w-full" rows={2} /></label>
            <div className="text-xs font-black">Hedef Hizmetler
              <div className="mt-1 flex flex-wrap gap-1">
                {TARGET_SERVICES.map((s) => (
                  <button key={s.slug} type="button" onClick={() => setForm({ ...form, target_services: form.target_services.includes(s.label) ? form.target_services.filter((x) => x !== s.label) : [...form.target_services, s.label] })}
                    className="rounded-full px-2 py-1 text-[11px] font-bold" style={form.target_services.includes(s.label) ? { background: "#0891b2", color: "white" } : { background: "var(--admin-surface-soft)" }}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="text-xs font-black">Hedef Coğrafya<input value={form.target_geography} onChange={(e) => setForm({ ...form, target_geography: e.target.value })} className="hk-input mt-1 w-full" /></label>
            <label className="text-xs font-black">Hedef Kitle<input value={form.target_audience} onChange={(e) => setForm({ ...form, target_audience: e.target.value })} className="hk-input mt-1 w-full" /></label>
            <label className="text-xs font-black">Yayın Sıklığı<input value={form.publishing_frequency} onChange={(e) => setForm({ ...form, publishing_frequency: e.target.value })} className="hk-input mt-1 w-full" /></label>
            <label className="text-xs font-black">Stratejik Notlar<textarea value={form.strategic_notes} onChange={(e) => setForm({ ...form, strategic_notes: e.target.value })} className="hk-input mt-1 w-full" rows={2} /></label>
            <AdminButton variant="success" compact loading={busy} onClick={submitCreate}>Oluştur</AdminButton>
          </div>
        )}
        {strategies.map((s: MonthlyStrategy) => (
          <button key={s.id} type="button" onClick={() => onSelect(s.id)} className="admin-card rounded-[12px] p-3 text-left" style={selectedStrategyId === s.id || (!selectedStrategyId && strategies[0]?.id === s.id) ? { outline: "2px solid #0891b2" } : undefined}>
            <strong className="block text-sm">{s.month.slice(0, 7)}</strong>
            <span className="block text-[11px]" style={{ color: "var(--admin-text-muted)" }}>{s.status}</span>
          </button>
        ))}
        {!strategies.length && !creating && <AdminEmptyState title="Henüz strateji yok" description="Yeni ay ekleyerek başlayın." />}
      </div>

      <div className="flex flex-col gap-4">
        {!strategy ? <AdminEmptyState title="Bir ay seçin veya oluşturun" /> : (
          <>
            <div className="admin-card rounded-[16px] p-4">
              <h3 className="font-black">{strategy.month.slice(0, 7)} Stratejisi</h3>
              <p className="mt-1 text-sm" style={{ color: "var(--admin-text-secondary)" }}>{strategy.business_objective || "İş hedefi girilmemiş."}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {strategy.target_services.map((s: string) => <AdminStatusBadge key={s} tone="info">{s}</AdminStatusBadge>)}
              </div>
            </div>

            <div className="admin-card rounded-[16px] p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-black">Claude Strateji Promptu</h3>
                <AdminButton compact variant="ai" icon={<Sparkles size={14} />} onClick={generatePrompt}>Prompt Üret</AdminButton>
              </div>
              <p className="mt-1 text-xs" style={{ color: "var(--admin-text-muted)" }}>Hedef Claude Project: <strong>{CLAUDE_PROJECT_NAME}</strong></p>
              {prompt && (
                <>
                  <textarea readOnly value={prompt} rows={10} className="hk-input mt-2 w-full font-mono text-xs" />
                  <AdminButton compact className="mt-2" icon={<ClipboardCopy size={14} />} onClick={async () => { if (await copyToClipboard(prompt)) notify("Prompt kopyalandı."); }}>Promptu Kopyala</AdminButton>
                </>
              )}
            </div>

            <div className="admin-card rounded-[16px] p-4">
              <h3 className="font-black">Claude Çıktısını İçe Aktar</h3>
              <p className="mt-1 text-xs" style={{ color: "var(--admin-text-muted)" }}>Claude&apos;un döndürdüğü yapılandırılmış JSON&apos;u yapıştırın.</p>
              <textarea value={importRaw} onChange={(e) => { setImportRaw(e.target.value); setImportPreview(null); }} rows={8} placeholder='{"items":[...]}' className="hk-input mt-2 w-full font-mono text-xs" />
              <div className="mt-2 flex gap-2">
                <AdminButton compact onClick={runPreview} disabled={!importRaw.trim()}>Önizle</AdminButton>
                {importPreview && importPreview.willCreate > 0 && <AdminButton compact variant="success" loading={busy} onClick={confirmImport}>{importPreview.willCreate} Öğeyi İçe Aktar</AdminButton>}
              </div>
              {importPreview && (
                <p className="mt-2 text-xs" style={{ color: "var(--admin-text-secondary)" }}>
                  {importPreview.willCreate} yeni öğe oluşturulacak, {importPreview.willSkipAsDuplicate} tekrar olduğu için atlanacak.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// --- İçerik Planı ---------------------------------------------------------

const EMPTY_ITEM_FORM = {
  working_title: "", primary_topic: "", search_intent: "", funnel_stage: "", target_service: "", target_geography: "", target_audience: "",
  pillar_or_supporting: "", article_type: "", priority: "medium", rationale: "", cta_objective: "", planned_publication_date: "",
  why_this_article: "", primary_question: "", secondary_questions: "", must_cover_points: "", existing_related_content: "",
  content_angle: "", seo_requirements: "", geo_requirements: "", facts_sources: "", editorial_notes: "", topic_cluster_id: "", strategy_id: ""
};

function ContentPlanTab({ items, strategies, clusters, notify, reload }: any) {
  const [selectedId, setSelectedId] = useState<string>("");
  const [form, setForm] = useState<any>(EMPTY_ITEM_FORM);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [importRaw, setImportRaw] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const selected = items.find((i: ContentPlanItem) => i.id === selectedId) || null;

  useEffect(() => {
    if (selected) {
      setForm({
        ...selected,
        secondary_questions: (selected.secondary_questions || []).join("\n"),
        must_cover_points: (selected.must_cover_points || []).join("\n"),
        existing_related_content: (selected.existing_related_content || []).join("\n"),
        pillar_or_supporting: selected.pillar_or_supporting || ""
      });
    }
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = statusFilter ? items.filter((i: ContentPlanItem) => i.status === statusFilter) : items;

  function toPayload(f: any) {
    return {
      ...f,
      secondary_questions: f.secondary_questions.split("\n").filter(Boolean),
      must_cover_points: f.must_cover_points.split("\n").filter(Boolean),
      existing_related_content: f.existing_related_content.split("\n").filter(Boolean)
    };
  }

  async function save() {
    setBusy(true);
    try {
      const payload = toPayload(form);
      const url = selected ? `/api/admin/organic-growth/content-plan/${selected.id}` : "/api/admin/organic-growth/content-plan";
      const response = await fetch(url, { method: selected ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) { notify(data.error || "Kaydedilemedi.", "error"); return; }
      notify(selected ? "Öğe güncellendi." : "Yeni planlı içerik oluşturuldu.");
      setCreating(false);
      await reload();
      if (!selected) setSelectedId(data.item.id);
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: ContentPlanStatus) {
    const response = await fetch(`/api/admin/organic-growth/content-plan/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    const data = await response.json();
    if (!response.ok) { notify(data.error || "Durum güncellenemedi.", "error"); return; }
    notify("Durum güncellendi.");
    await reload();
  }

  function generatePrompt() {
    if (!selected) return;
    const cluster = clusters.find((c: TopicCluster) => c.id === selected.topic_cluster_id);
    setPrompt(buildArticlePrompt({
      articleId: selected.id,
      targetPublicationDate: selected.planned_publication_date || undefined,
      workingTitle: selected.working_title,
      primaryTopic: selected.primary_topic,
      searchIntent: selected.search_intent,
      targetAudience: selected.target_audience,
      targetService: selected.target_service,
      targetLocation: selected.target_geography,
      topicCluster: cluster?.name,
      pillarOrSupporting: selected.pillar_or_supporting || undefined,
      funnelStage: selected.funnel_stage,
      whyThisArticle: selected.why_this_article,
      primaryQuestion: selected.primary_question,
      secondaryQuestions: selected.secondary_questions,
      contentAngle: selected.content_angle,
      mustCoverPoints: selected.must_cover_points,
      existingRelatedContent: selected.existing_related_content,
      internalLinkTargets: selected.internal_link_targets,
      ctaObjective: selected.cta_objective,
      seoRequirements: selected.seo_requirements,
      geoRequirements: selected.geo_requirements,
      factsSources: selected.facts_sources,
      editorialNotes: selected.editorial_notes
    }));
  }

  async function importArticle() {
    if (!selected) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/organic-growth/import-article", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content_plan_item_id: selected.id, raw: importRaw }) });
      const data = await response.json();
      if (!response.ok) { notify(data.error || "Makale içe aktarılamadı.", "error"); return; }
      notify("Makale taslak olarak Yazılar'a aktarıldı.");
      if (data.flaggedClaims?.length) notify(`Doğrulama gereken iddialar: ${data.flaggedClaims.join("; ")}`, "error");
      setImportRaw("");
      await reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-1">
          <button type="button" onClick={() => setStatusFilter("")} className="rounded-full px-2 py-1 text-[11px] font-bold" style={!statusFilter ? { background: "#0891b2", color: "white" } : { background: "var(--admin-surface-soft)" }}>Tümü</button>
          {CONTENT_PLAN_STATUSES.map((s) => (
            <button key={s} type="button" onClick={() => setStatusFilter(s)} className="rounded-full px-2 py-1 text-[11px] font-bold" style={statusFilter === s ? { background: "#0891b2", color: "white" } : { background: "var(--admin-surface-soft)" }}>{CONTENT_PLAN_STATUS_LABELS[s]}</button>
          ))}
        </div>
        <AdminButton variant="primary" compact onClick={() => { setCreating(true); setSelectedId(""); setForm(EMPTY_ITEM_FORM); }}>+ Yeni Planlı İçerik</AdminButton>
        {filtered.map((item: ContentPlanItem) => (
          <button key={item.id} type="button" onClick={() => { setSelectedId(item.id); setCreating(false); }} className="admin-card rounded-[12px] p-3 text-left" style={selectedId === item.id ? { outline: "2px solid #0891b2" } : undefined}>
            <strong className="block text-sm">{item.working_title}</strong>
            <span className="mt-1 flex flex-wrap items-center gap-1">
              <AdminStatusBadge tone="info">{CONTENT_PLAN_STATUS_LABELS[item.status]}</AdminStatusBadge>
              {item.planned_publication_date && <span className="text-[11px]" style={{ color: "var(--admin-text-muted)" }}>{item.planned_publication_date}</span>}
            </span>
          </button>
        ))}
        {!filtered.length && <AdminEmptyState title="Bu filtrede içerik yok" />}
      </div>

      <div className="flex flex-col gap-4">
        {!selected && !creating ? <AdminEmptyState title="Bir öğe seçin veya yeni oluşturun" /> : (
          <>
            <div className="admin-card grid gap-3 rounded-[16px] p-4 md:grid-cols-2">
              <label className="text-xs font-black md:col-span-2">Çalışma Başlığı<input value={form.working_title} onChange={(e) => setForm({ ...form, working_title: e.target.value })} className="hk-input mt-1 w-full" /></label>
              <label className="text-xs font-black">Birincil Konu / Anahtar Kelime<input value={form.primary_topic} onChange={(e) => setForm({ ...form, primary_topic: e.target.value })} className="hk-input mt-1 w-full" /></label>
              <label className="text-xs font-black">Arama Niyeti<input value={form.search_intent} onChange={(e) => setForm({ ...form, search_intent: e.target.value })} className="hk-input mt-1 w-full" /></label>
              <label className="text-xs font-black">Huni Aşaması<input value={form.funnel_stage} onChange={(e) => setForm({ ...form, funnel_stage: e.target.value })} className="hk-input mt-1 w-full" /></label>
              <label className="text-xs font-black">Hedef Hizmet
                <select value={form.target_service} onChange={(e) => setForm({ ...form, target_service: e.target.value })} className="hk-input mt-1 w-full">
                  <option value="">Seçin</option>
                  {TARGET_SERVICES.map((s) => <option key={s.slug} value={s.label}>{s.label}</option>)}
                </select>
              </label>
              <label className="text-xs font-black">Hedef Coğrafya<input value={form.target_geography} onChange={(e) => setForm({ ...form, target_geography: e.target.value })} className="hk-input mt-1 w-full" /></label>
              <label className="text-xs font-black">Hedef Kitle<input value={form.target_audience} onChange={(e) => setForm({ ...form, target_audience: e.target.value })} className="hk-input mt-1 w-full" /></label>
              <label className="text-xs font-black">Konu Kümesi
                <select value={form.topic_cluster_id || ""} onChange={(e) => setForm({ ...form, topic_cluster_id: e.target.value })} className="hk-input mt-1 w-full">
                  <option value="">Yok</option>
                  {clusters.map((c: TopicCluster) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="text-xs font-black">Pillar / Destekleyici
                <select value={form.pillar_or_supporting || ""} onChange={(e) => setForm({ ...form, pillar_or_supporting: e.target.value })} className="hk-input mt-1 w-full">
                  <option value="">Belirtilmedi</option>
                  <option value="pillar">Pillar</option>
                  <option value="supporting">Destekleyici</option>
                </select>
              </label>
              <label className="text-xs font-black">İçerik Türü<input value={form.article_type} onChange={(e) => setForm({ ...form, article_type: e.target.value })} className="hk-input mt-1 w-full" /></label>
              <label className="text-xs font-black">Öncelik
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="hk-input mt-1 w-full">
                  <option value="low">Düşük</option><option value="medium">Orta</option><option value="high">Yüksek</option>
                </select>
              </label>
              <label className="text-xs font-black">Planlanan Yayın Tarihi<input type="date" value={form.planned_publication_date || ""} onChange={(e) => setForm({ ...form, planned_publication_date: e.target.value })} className="hk-input mt-1 w-full" /></label>
              <label className="text-xs font-black">Strateji
                <select value={form.strategy_id || ""} onChange={(e) => setForm({ ...form, strategy_id: e.target.value })} className="hk-input mt-1 w-full">
                  <option value="">Yok</option>
                  {strategies.map((s: MonthlyStrategy) => <option key={s.id} value={s.id}>{s.month.slice(0, 7)}</option>)}
                </select>
              </label>
              <label className="text-xs font-black md:col-span-2">Gerekçe<textarea value={form.rationale} onChange={(e) => setForm({ ...form, rationale: e.target.value })} className="hk-input mt-1 w-full" rows={2} /></label>
              <label className="text-xs font-black md:col-span-2">CTA Hedefi<input value={form.cta_objective} onChange={(e) => setForm({ ...form, cta_objective: e.target.value })} className="hk-input mt-1 w-full" /></label>

              <h4 className="mt-2 font-black md:col-span-2">Editoryal Brief</h4>
              <label className="text-xs font-black md:col-span-2">Bu Makale Neden Var<textarea value={form.why_this_article} onChange={(e) => setForm({ ...form, why_this_article: e.target.value })} className="hk-input mt-1 w-full" rows={2} /></label>
              <label className="text-xs font-black">Birincil Soru<input value={form.primary_question} onChange={(e) => setForm({ ...form, primary_question: e.target.value })} className="hk-input mt-1 w-full" /></label>
              <label className="text-xs font-black">İçerik Açısı<input value={form.content_angle} onChange={(e) => setForm({ ...form, content_angle: e.target.value })} className="hk-input mt-1 w-full" /></label>
              <label className="text-xs font-black md:col-span-2">İkincil Sorular (her satıra bir tane)<textarea value={form.secondary_questions} onChange={(e) => setForm({ ...form, secondary_questions: e.target.value })} className="hk-input mt-1 w-full" rows={3} /></label>
              <label className="text-xs font-black md:col-span-2">Mutlaka Değinilmesi Gerekenler (her satıra bir tane)<textarea value={form.must_cover_points} onChange={(e) => setForm({ ...form, must_cover_points: e.target.value })} className="hk-input mt-1 w-full" rows={3} /></label>
              <label className="text-xs font-black md:col-span-2">Mevcut İlgili HK İçeriği (her satıra bir tane)<textarea value={form.existing_related_content} onChange={(e) => setForm({ ...form, existing_related_content: e.target.value })} className="hk-input mt-1 w-full" rows={2} /></label>
              <label className="text-xs font-black">SEO Gereksinimleri<textarea value={form.seo_requirements} onChange={(e) => setForm({ ...form, seo_requirements: e.target.value })} className="hk-input mt-1 w-full" rows={2} /></label>
              <label className="text-xs font-black">GEO Gereksinimleri<textarea value={form.geo_requirements} onChange={(e) => setForm({ ...form, geo_requirements: e.target.value })} className="hk-input mt-1 w-full" rows={2} /></label>
              <label className="text-xs font-black md:col-span-2">Kanıt / Kaynak<textarea value={form.facts_sources} onChange={(e) => setForm({ ...form, facts_sources: e.target.value })} className="hk-input mt-1 w-full" rows={2} /></label>
              <label className="text-xs font-black md:col-span-2">Editoryal Notlar<textarea value={form.editorial_notes} onChange={(e) => setForm({ ...form, editorial_notes: e.target.value })} className="hk-input mt-1 w-full" rows={2} /></label>

              <div className="flex gap-2 md:col-span-2">
                <AdminButton variant="success" loading={busy} onClick={save}>{selected ? "Güncelle" : "Oluştur"}</AdminButton>
                {selected && (
                  <select value={selected.status} onChange={(e) => setStatus(selected.id, e.target.value as ContentPlanStatus)} className="hk-input">
                    {CONTENT_PLAN_STATUSES.map((s) => <option key={s} value={s}>{CONTENT_PLAN_STATUS_LABELS[s]}</option>)}
                  </select>
                )}
              </div>
            </div>

            {selected && (
              <>
                <div className="admin-card rounded-[16px] p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-black">Claude Promptu</h3>
                    <AdminButton compact variant="ai" icon={<Sparkles size={14} />} onClick={generatePrompt}>Claude Promptu Hazırla</AdminButton>
                  </div>
                  <p className="mt-1 text-xs" style={{ color: "var(--admin-text-muted)" }}>Hedef Claude Project: <strong>{CLAUDE_PROJECT_NAME}</strong></p>
                  {prompt && (
                    <>
                      <textarea readOnly value={prompt} rows={10} className="hk-input mt-2 w-full font-mono text-xs" />
                      <AdminButton compact className="mt-2" icon={<ClipboardCopy size={14} />} onClick={async () => { if (await copyToClipboard(prompt)) notify("Prompt kopyalandı."); }}>Promptu Kopyala</AdminButton>
                    </>
                  )}
                </div>

                <div className="admin-card rounded-[16px] p-4">
                  <h3 className="font-black">Claude Çıktısını İçe Aktar (Makale)</h3>
                  <textarea value={importRaw} onChange={(e) => setImportRaw(e.target.value)} rows={6} placeholder='{"title":"...","content":"..."}' className="hk-input mt-2 w-full font-mono text-xs" />
                  <AdminButton compact className="mt-2" loading={busy} disabled={!importRaw.trim()} onClick={importArticle}>Makaleyi İçe Aktar → Yazılar</AdminButton>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// --- Konu Kümeleri ---------------------------------------------------------

function ClustersTab({ clusters, notify, reload }: any) {
  const [form, setForm] = useState({ name: "", description: "", target_service: "", geography: "", search_intents: "" });
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/organic-growth/topic-clusters", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, search_intents: form.search_intents.split(",").map((s) => s.trim()).filter(Boolean) }) });
      const data = await response.json();
      if (!response.ok) { notify(data.error || "Küme oluşturulamadı.", "error"); return; }
      notify("Konu kümesi oluşturuldu.");
      setForm({ name: "", description: "", target_service: "", geography: "", search_intents: "" });
      await reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div className="admin-card flex flex-col gap-2 rounded-[16px] p-4">
        <h3 className="font-black">Yeni Konu Kümesi</h3>
        <label className="text-xs font-black">Ad<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="hk-input mt-1 w-full" /></label>
        <label className="text-xs font-black">Açıklama<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="hk-input mt-1 w-full" rows={2} /></label>
        <label className="text-xs font-black">Hedef Hizmet
          <select value={form.target_service} onChange={(e) => setForm({ ...form, target_service: e.target.value })} className="hk-input mt-1 w-full">
            <option value="">Seçin</option>
            {TARGET_SERVICES.map((s) => <option key={s.slug} value={s.label}>{s.label}</option>)}
          </select>
        </label>
        <label className="text-xs font-black">Coğrafya<input value={form.geography} onChange={(e) => setForm({ ...form, geography: e.target.value })} className="hk-input mt-1 w-full" /></label>
        <label className="text-xs font-black">Arama Niyetleri (virgülle)<input value={form.search_intents} onChange={(e) => setForm({ ...form, search_intents: e.target.value })} className="hk-input mt-1 w-full" /></label>
        <AdminButton variant="success" compact loading={busy} disabled={form.name.trim().length < 3} onClick={create}>Oluştur</AdminButton>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {clusters.map((c: TopicCluster) => (
          <div key={c.id} className="admin-card rounded-[16px] p-4">
            <strong className="block">{c.name}</strong>
            <p className="mt-1 text-sm" style={{ color: "var(--admin-text-secondary)" }}>{c.description || "Açıklama yok."}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {c.target_service && <AdminStatusBadge tone="info">{c.target_service}</AdminStatusBadge>}
              {c.geography && <AdminStatusBadge tone="neutral">{c.geography}</AdminStatusBadge>}
            </div>
            {!!c.search_intents?.length && <p className="mt-2 text-xs" style={{ color: "var(--admin-text-muted)" }}>Niyetler: {c.search_intents.join(", ")}</p>}
          </div>
        ))}
        {!clusters.length && <AdminEmptyState title="Henüz konu kümesi yok" description="HK Dijital'in hizmet alanlarına göre ilk kümeyi oluşturun." />}
      </div>
    </div>
  );
}

// --- Yazılar ---------------------------------------------------------

function ArticlesTab({ posts, notify, reload }: any) {
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);

  const selected = posts.find((p: any) => p.id === selectedId) || null;

  useEffect(() => { if (selected) { setDraft({ ...selected }); setAnalysis(null); } }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!draft) return;
    setBusy(true);
    try {
      const url = selected ? `/api/admin/blog-posts/${selected.id}` : "/api/admin/blog-posts";
      const response = await fetch(url, { method: selected ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const data = await response.json();
      if (!response.ok) { notify(data.error || "Kaydedilemedi.", "error"); return; }
      notify("Yazı kaydedildi.");
      await reload();
      setSelectedId(data.post.id);
    } finally {
      setBusy(false);
    }
  }

  async function runAnalysis() {
    if (!selected) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/organic-growth/analyze/${selected.id}`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) { notify(data.error || "Analiz başarısız.", "error"); return; }
      setAnalysis(data);
      notify("SEO/GEO analizi tamamlandı.");
      await reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <div className="flex flex-col gap-2">
        <AdminButton variant="primary" compact onClick={() => { setSelectedId(""); setDraft({ title: "", slug: "", excerpt: "", content: "", status: "draft", primary_keyword: "", search_intent: "", meta_title: "", meta_description: "" }); }}>+ Yeni Yazı</AdminButton>
        {posts.map((p: any) => (
          <button key={p.id} type="button" onClick={() => setSelectedId(p.id)} className="admin-card rounded-[12px] p-3 text-left" style={selectedId === p.id ? { outline: "2px solid #0891b2" } : undefined}>
            <strong className="block text-sm truncate">{p.title}</strong>
            <AdminStatusBadge tone={p.status === "published" ? "success" : "neutral"}>{p.status}</AdminStatusBadge>
          </button>
        ))}
        {!posts.length && <AdminEmptyState title="Henüz yazı yok" />}
      </div>

      <div className="flex flex-col gap-4">
        {!draft ? <AdminEmptyState title="Bir yazı seçin veya yeni oluşturun" /> : (
          <>
            <div className="admin-card grid gap-3 rounded-[16px] p-4 md:grid-cols-2">
              <label className="text-xs font-black md:col-span-2">Başlık<input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="hk-input mt-1 w-full" /></label>
              <label className="text-xs font-black">Slug<input value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} className="hk-input mt-1 w-full" /></label>
              <label className="text-xs font-black">Durum
                <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })} className="hk-input mt-1 w-full">
                  <option value="draft">Taslak</option><option value="review">İncelemede</option><option value="scheduled">Planlandı</option><option value="published">Yayında</option><option value="archived">Arşivlendi</option>
                </select>
              </label>
              <label className="text-xs font-black md:col-span-2">Özet<textarea value={draft.excerpt} onChange={(e) => setDraft({ ...draft, excerpt: e.target.value })} className="hk-input mt-1 w-full" rows={2} /></label>
              <label className="text-xs font-black">Birincil Anahtar Kelime<input value={draft.primary_keyword} onChange={(e) => setDraft({ ...draft, primary_keyword: e.target.value })} className="hk-input mt-1 w-full" /></label>
              <label className="text-xs font-black">Arama Niyeti<input value={draft.search_intent} onChange={(e) => setDraft({ ...draft, search_intent: e.target.value })} className="hk-input mt-1 w-full" /></label>
              <label className="text-xs font-black">Meta Başlık<input value={draft.meta_title} onChange={(e) => setDraft({ ...draft, meta_title: e.target.value })} className="hk-input mt-1 w-full" /></label>
              <label className="text-xs font-black">Meta Açıklama<input value={draft.meta_description} onChange={(e) => setDraft({ ...draft, meta_description: e.target.value })} className="hk-input mt-1 w-full" /></label>
            </div>

            <div>
              <h4 className="mb-2 font-black">İçerik</h4>
              <RichTextEditor value={draft.content} onChange={(md) => setDraft({ ...draft, content: md })} />
            </div>

            <div className="flex gap-2">
              <AdminButton variant="success" loading={busy} onClick={save}>Kaydet</AdminButton>
              {selected && <AdminButton variant="info" loading={busy} icon={<Search size={14} />} onClick={runAnalysis}>SEO/GEO Analizi Çalıştır</AdminButton>}
            </div>

            {analysis && (
              <div className="grid gap-3 md:grid-cols-2">
                <FactorList title={`SEO — ${analysis.seo.score}/100 (dahili sezgisel)`} factors={analysis.seo.factors} />
                <FactorList title={`GEO — ${analysis.geo.score}/100 (dahili sezgisel)`} factors={analysis.geo.factors} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function FactorList({ title, factors }: { title: string; factors: Array<{ key: string; label: string; passed: boolean; why: string }> }) {
  return (
    <div className="admin-card rounded-[16px] p-4">
      <h4 className="font-black">{title}</h4>
      <ul className="mt-2 flex flex-col gap-2 text-xs">
        {factors.map((f) => (
          <li key={f.key} className="flex items-start gap-2">
            <span style={{ color: f.passed ? "var(--admin-success, #16a34a)" : "var(--admin-danger, #dc2626)" }}>{f.passed ? "✓" : "✗"}</span>
            <span><strong>{f.label}:</strong> {f.why}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// --- SEO & GEO ---------------------------------------------------------

function SeoGeoTab({ posts, cannibalization }: any) {
  const published = posts.filter((p: any) => p.status === "published");
  return (
    <div className="flex flex-col gap-4">
      <div className="admin-card rounded-[16px] p-4">
        <h3 className="font-black">Yayınlanan İçerik Skorları</h3>
        <p className="text-xs" style={{ color: "var(--admin-text-muted)" }}>Skorlar dahili sezgisel değerlerdir; sıralama garantisi vermez.</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {published.map((p: any) => (
            <div key={p.id} className="admin-card-soft flex items-center justify-between rounded-[12px] p-3">
              <span className="min-w-0 truncate text-sm font-bold">{p.title}</span>
              <span className="flex shrink-0 gap-2 text-xs font-black">
                <AdminStatusBadge tone={p.seo_score >= 70 ? "success" : "warning"}>SEO {p.seo_score}</AdminStatusBadge>
                <AdminStatusBadge tone={(p.geo_score || 0) >= 70 ? "success" : "warning"}>GEO {p.geo_score || 0}</AdminStatusBadge>
              </span>
            </div>
          ))}
          {!published.length && <AdminEmptyState title="Henüz yayınlanan yazı yok" />}
        </div>
      </div>

      <div className="admin-card rounded-[16px] p-4">
        <h3 className="font-black">Kanibalizasyon Uyarıları</h3>
        <p className="text-xs" style={{ color: "var(--admin-text-muted)" }}>Gerçek dahili veriye dayalı pratik bir kontrol — kesin arama motoru analizi değildir.</p>
        <div className="mt-3 flex flex-col gap-2">
          {cannibalization.map((c: any, i: number) => (
            <div key={i} className="admin-card-soft rounded-[12px] p-3 text-sm">
              <AdminStatusBadge tone={c.severity === "high" ? "danger" : c.severity === "medium" ? "warning" : "neutral"}>{c.severity}</AdminStatusBadge>
              <p className="mt-1"><strong>{c.aTitle}</strong> ↔ <strong>{c.bTitle}</strong></p>
              <ul className="mt-1 list-disc pl-4 text-xs" style={{ color: "var(--admin-text-muted)" }}>
                {c.reasons.map((r: string, ri: number) => <li key={ri}>{r}</li>)}
              </ul>
            </div>
          ))}
          {!cannibalization.length && <AdminEmptyState title="Kanibalizasyon riski bulunamadı" />}
        </div>
      </div>
    </div>
  );
}

// --- İç Bağlantılar ---------------------------------------------------------

function InternalLinksTab({ linkData }: { linkData: any }) {
  if (!linkData) return <AdminLoadingState label="İç bağlantı önerileri hesaplanıyor..." />;
  return (
    <div className="flex flex-col gap-4">
      <div className="admin-card rounded-[16px] p-4">
        <h3 className="font-black">Bağlantı Önerileri ({linkData.suggestions.length})</h3>
        <p className="text-xs" style={{ color: "var(--admin-text-muted)" }}>Yalnızca gerçek yayınlanan içerik ve hizmet sayfalarına dayalıdır — hiçbir bağlantı otomatik eklenmez.</p>
        <div className="mt-3 flex flex-col gap-2">
          {linkData.suggestions.slice(0, 40).map((s: any, i: number) => (
            <div key={i} className="admin-card-soft rounded-[12px] p-3 text-sm">
              <strong>{s.sourceTitle}</strong> → <code>{s.targetUrl}</code>
              <p className="text-xs" style={{ color: "var(--admin-text-muted)" }}>{s.why} · Anchor: {s.anchorContext}</p>
            </div>
          ))}
          {!linkData.suggestions.length && <AdminEmptyState title="Öneri bulunamadı" description="Daha fazla yayınlanan içerik/küme eklendikçe öneriler artar." />}
        </div>
      </div>
      <div className="admin-card rounded-[16px] p-4">
        <h3 className="font-black">Sahipsiz İçerik ({linkData.orphans.length})</h3>
        <div className="mt-3 flex flex-col gap-2">
          {linkData.orphans.map((o: any) => <div key={o.id} className="admin-card-soft rounded-[12px] p-3 text-sm">{o.title}</div>)}
          {!linkData.orphans.length && <AdminEmptyState title="Sahipsiz içerik yok" />}
        </div>
      </div>
    </div>
  );
}

// --- Performans / Güncelleme ---------------------------------------------------------

function RefreshTab({ posts, notify, reload }: any) {
  const [busyId, setBusyId] = useState("");
  const published = posts.filter((p: any) => p.status === "published");
  const needsRefresh = published.filter((p: any) => p.update_required || (p.seo_score > 0 && p.seo_score < 60));

  async function markReviewed(id: string) {
    setBusyId(id);
    try {
      const response = await fetch(`/api/admin/organic-growth/analyze/${id}`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) { notify(data.error || "İşlem başarısız.", "error"); return; }
      notify("Yeniden incelendi, skorlar güncellendi.");
      await reload();
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="admin-card rounded-[16px] p-4 text-sm" style={{ color: "var(--admin-text-secondary)" }}>
        Gerçek arama performansı (gösterim/tıklama/CTR/ortalama sıralama) için Search Console/GA4 bağlantısı bu sürümde aktif değildir — hiçbir performans verisi uydurulmaz. Bu sekme, yayınlanan içeriğin güncellik/kalite sinyallerine göre çalışır.
      </div>
      <div className="admin-card rounded-[16px] p-4">
        <h3 className="font-black">Güncelleme Gerekenler ({needsRefresh.length})</h3>
        <div className="mt-3 flex flex-col gap-2">
          {needsRefresh.map((p: any) => (
            <div key={p.id} className="admin-card-soft flex items-center justify-between rounded-[12px] p-3 text-sm">
              <span className="min-w-0 truncate"><strong>{p.title}</strong> · SEO {p.seo_score} · Son inceleme: {p.last_reviewed_at ? new Date(p.last_reviewed_at).toLocaleDateString("tr-TR") : "hiç"}</span>
              <AdminButton compact variant="info" loading={busyId === p.id} icon={<RefreshCw size={14} />} onClick={() => markReviewed(p.id)}>Yeniden İncele</AdminButton>
            </div>
          ))}
          {!needsRefresh.length && <AdminEmptyState title="Güncelleme gereken içerik yok" />}
        </div>
      </div>
    </div>
  );
}
