"use client";
/* eslint-disable react-hooks/set-state-in-effect -- fetch-on-mount pattern, same accepted precedent as AdsStrategyPanel.tsx */

import { useEffect, useState } from "react";
import { Download, Plus, RefreshCw, Trash2 } from "lucide-react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminStatusBadge, type AdminStatusTone } from "@/components/admin/ui/AdminStatusBadge";

type Company = { id: string; name: string };
type ReportStatus = "draft" | "approved" | "active" | "archived";
type ReportSection = { title: string; content: string };
type ReportText = { executiveSummary?: string; sections?: ReportSection[] };
type Creative = {
  order?: number; format?: string; title?: string; campaign?: string; adSet?: string;
  funnelStage?: string; angle?: string; hook?: string; cta?: string; priority?: string;
  details?: string; internalNotes?: string;
};
type AbTestItem = { hypothesis?: string; variable?: string; constants?: string; expectedBehavior?: string; evaluationCriteria?: string };
type MaterialItem = { name?: string; description?: string; quantity?: string; format?: string; instructions?: string };
type ChecklistItem = { label: string; checked: boolean };
type StrategySummary = { campaignGoal?: string; creativeRole?: string; targetAudience?: string; funnelStage?: string; awarenessLevel?: string; keyMessage?: string; primaryCta?: string; creativeAngles?: string[] };
type CreativeReport = {
  id: string; company_id: string; ad_strategy_id: string | null; ad_strategy_version: number | null;
  version: number; status: ReportStatus; report_title: string;
  strategy_summary: StrategySummary; creatives: Creative[]; ab_test_plan: AbTestItem[];
  required_materials: MaterialItem[]; production_checklist: ChecklistItem[];
  internal_report: ReportText; client_report: ReportText;
  created_at: string; updated_at: string;
};
type ApiResponse = { current: CreativeReport | null; history: CreativeReport[] };

const STATUS_LABELS: Record<ReportStatus, string> = { draft: "Taslak", approved: "Onaylandı", active: "Uygulanıyor", archived: "Arşivlendi" };
const STATUS_TONE: Record<ReportStatus, AdminStatusTone> = { draft: "neutral", approved: "info", active: "success", archived: "neutral" };
const ALL_STATUSES: ReportStatus[] = ["draft", "approved", "active", "archived"];
const FORMAT_OPTIONS = [["reels", "Reels"], ["video", "Video"], ["story", "Story"], ["static", "Statik Görsel"], ["carousel", "Carousel"]] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="content-plan-stat rounded-[14px] border p-4" style={{ borderColor: "var(--admin-border)" }}>
      <p className="mb-2 text-xs font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>{title}</p>
      {children}
    </div>
  );
}

function ReportEditor({ report, onSave, saving }: { report: ReportText; onSave: (next: ReportText) => void; saving: boolean }) {
  const [summary, setSummary] = useState(report.executiveSummary || "");
  const [sections, setSections] = useState<ReportSection[]>(report.sections || []);
  function updateSection(i: number, patch: Partial<ReportSection>) {
    setSections((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  return (
    <div className="grid gap-3">
      <label className="grid gap-1.5 text-sm font-bold">
        Yönetici Özeti
        <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} className="rounded-[10px] border px-3 py-2 text-sm" style={{ borderColor: "var(--admin-border)" }} />
      </label>
      {sections.map((section, i) => (
        <div key={i} className="grid gap-2 rounded-[10px] border p-3" style={{ borderColor: "var(--admin-border)" }}>
          <div className="flex items-center gap-2">
            <input value={section.title} onChange={(e) => updateSection(i, { title: e.target.value })} placeholder="Bölüm başlığı" className="min-h-9 flex-1 rounded-[8px] border px-2 text-sm font-bold" style={{ borderColor: "var(--admin-border)" }} />
            <button type="button" onClick={() => setSections((prev) => prev.filter((_, idx) => idx !== i))} aria-label="Bölümü sil" className="rounded-full p-2" style={{ color: "var(--admin-text-muted)" }}><Trash2 size={14} /></button>
          </div>
          <textarea value={section.content} onChange={(e) => updateSection(i, { content: e.target.value })} rows={3} placeholder="İçerik" className="rounded-[8px] border px-3 py-2 text-sm" style={{ borderColor: "var(--admin-border)" }} />
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <AdminButton variant="secondary" compact icon={<Plus size={14} />} onClick={() => setSections((prev) => [...prev, { title: "", content: "" }])}>Bölüm Ekle</AdminButton>
        <AdminButton variant="primary" compact loading={saving} onClick={() => onSave({ executiveSummary: summary, sections: sections.filter((s) => s.title || s.content) })}>Kaydet</AdminButton>
      </div>
    </div>
  );
}

export function AdCreativeReportPanel({ companyId, companies }: { companyId: string; companies: Company[] }) {
  const [data, setData] = useState<ApiResponse | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "internal" | "client" | "history">("overview");
  const [creating, setCreating] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [reportSaving, setReportSaving] = useState<"internal" | "client" | "content" | null>(null);
  const [exportBusy, setExportBusy] = useState<string | null>(null);
  const [historyDetail, setHistoryDetail] = useState<CreativeReport | null>(null);

  // Draft editor state for the overview/content tab.
  const [summary, setSummary] = useState<StrategySummary>({});
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [abTests, setAbTests] = useState<AbTestItem[]>([]);

  const companyName = companies.find((c) => c.id === companyId)?.name || "";
  const report = data?.current || null;

  function load() {
    if (!companyId) return;
    setData(undefined);
    setError(null);
    fetch(`/api/admin/ad-insights/creative-reports?companyId=${companyId}`)
      .then((r) => r.json())
      .then((body) => {
        if (body.error) { setError(body.error); return; }
        setData(body);
        const current: CreativeReport | null = body.current || null;
        setSummary(current?.strategy_summary || {});
        setCreatives(current?.creatives || []);
        setMaterials(current?.required_materials || []);
        setChecklist(current?.production_checklist || []);
        setAbTests(current?.ab_test_plan || []);
      })
      .catch(() => setError("Yüklenemedi."));
  }
  useEffect(load, [companyId]);

  async function createDraft() {
    setCreating(true);
    setError(null);
    try {
      // Best-effort link to the company's current ad strategy, if any —
      // a company with no strategy yet must never be blocked.
      let adStrategyId: string | undefined;
      let adStrategyVersion: number | undefined;
      try {
        const stratRes = await fetch(`/api/admin/ad-insights/ads-strategy?companyId=${companyId}`);
        const stratBody = await stratRes.json();
        if (stratBody?.current?.id) { adStrategyId = stratBody.current.id; adStrategyVersion = stratBody.current.version; }
      } catch { /* no linked strategy — proceed without one */ }

      const res = await fetch("/api/admin/ad-insights/creative-reports", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, adStrategyId, adStrategyVersion })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Oluşturulamadı.");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Beklenmeyen hata.");
    } finally {
      setCreating(false);
    }
  }

  async function saveContent() {
    if (!report) return;
    setReportSaving("content");
    setError(null);
    try {
      const res = await fetch(`/api/admin/ad-insights/creative-reports/${report.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, strategy_summary: summary, creatives, required_materials: materials, production_checklist: checklist, ab_test_plan: abTests })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Kaydedilemedi.");
      setData((prev) => (prev ? { ...prev, current: body.report } : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Beklenmeyen hata.");
    } finally {
      setReportSaving(null);
    }
  }

  async function saveReport(kind: "internal" | "client", next: ReportText) {
    if (!report) return;
    setReportSaving(kind);
    setError(null);
    try {
      const res = await fetch(`/api/admin/ad-insights/creative-reports/${report.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, [kind === "internal" ? "internal_report" : "client_report"]: next })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Kaydedilemedi.");
      setData((prev) => (prev ? { ...prev, current: body.report } : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Beklenmeyen hata.");
    } finally {
      setReportSaving(null);
    }
  }

  async function changeStatus(status: ReportStatus) {
    if (!report) return;
    setStatusBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/ad-insights/creative-reports/${report.id}/status`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, status })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Durum güncellenemedi.");
      setData((prev) => (prev ? { ...prev, current: body.report, history: prev.history.map((h) => (h.id === body.report.id ? body.report : h)) } : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Beklenmeyen hata.");
    } finally {
      setStatusBusy(false);
    }
  }

  async function exportDocument(mode: "client" | "internal", format: "pdf" | "docx") {
    if (!report) return;
    const key = `${mode}-${format}`;
    setExportBusy(key);
    setError(null);
    try {
      const res = await fetch(`/api/admin/ad-insights/creative-reports/${report.id}/export`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, mode, format })
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Belge oluşturulamadı."); }
      const disposition = res.headers.get("Content-Disposition") || "";
      const filenameMatch = disposition.match(/filename="([^"]+)"/);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filenameMatch?.[1] || `reklam-kreatif-raporu.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Beklenmeyen hata.");
    } finally {
      setExportBusy(null);
    }
  }

  if (!companyId) return <p className="text-sm font-bold" style={{ color: "var(--admin-text-muted)" }}>Bir müşteri seçin.</p>;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold" style={{ color: "var(--admin-text-secondary)" }}>Reklam Stratejisinin devamı: kreatif brief&apos;ten üretim raporuna.</p>
        <AdminButton variant="secondary" compact icon={<RefreshCw size={14} />} onClick={load}>Yenile</AdminButton>
      </div>

      {error && <p className="text-sm font-bold text-[#dc2626]">{error}</p>}
      {data === undefined && !error && <p className="text-sm font-bold" style={{ color: "var(--admin-text-muted)" }}>Yükleniyor…</p>}

      {data && !report && (
        <div className="content-plan-empty rounded-[16px] border p-8 text-center" style={{ borderColor: "var(--admin-border)" }}>
          <p className="text-sm font-bold" style={{ color: "var(--admin-text-secondary)" }}>{companyName} için henüz kreatif raporu yok.</p>
          <div className="mt-3"><AdminButton variant="primary" compact loading={creating} onClick={createDraft}>Kreatif Raporu Oluştur</AdminButton></div>
        </div>
      )}

      {report && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <AdminStatusBadge tone={STATUS_TONE[report.status]}>{STATUS_LABELS[report.status]}</AdminStatusBadge>
            <span className="text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>
              v{report.version}{report.ad_strategy_id && ` · Bağlı Strateji v${report.ad_strategy_version ?? "?"}`} · Son güncelleme: {new Date(report.updated_at).toLocaleString("tr-TR")}
            </span>
            <label className="flex items-center gap-1.5 text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>
              Durumu Değiştir
              <select value={report.status} disabled={statusBusy} onChange={(e) => { const next = e.target.value as ReportStatus; if (next !== report.status) changeStatus(next); }} className="min-h-9 rounded-[8px] border px-2 text-xs font-bold" style={{ borderColor: "var(--admin-border)" }}>
                {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </label>
          </div>

          <Section title="Rapor İndirme">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-xs font-black" style={{ color: "var(--admin-text-muted)" }}>Müşteri Raporu</p>
                <div className="flex flex-wrap gap-2">
                  <AdminButton variant="secondary" compact icon={<Download size={14} />} loading={exportBusy === "client-pdf"} onClick={() => exportDocument("client", "pdf")}>PDF İndir</AdminButton>
                  <AdminButton variant="secondary" compact icon={<Download size={14} />} loading={exportBusy === "client-docx"} onClick={() => exportDocument("client", "docx")}>Word İndir</AdminButton>
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-black" style={{ color: "var(--admin-text-muted)" }}>Dahili Rapor</p>
                <div className="flex flex-wrap gap-2">
                  <AdminButton variant="secondary" compact icon={<Download size={14} />} loading={exportBusy === "internal-pdf"} onClick={() => exportDocument("internal", "pdf")}>PDF İndir</AdminButton>
                  <AdminButton variant="secondary" compact icon={<Download size={14} />} loading={exportBusy === "internal-docx"} onClick={() => exportDocument("internal", "docx")}>Word İndir</AdminButton>
                </div>
              </div>
            </div>
          </Section>

          <div className="flex flex-wrap gap-2">
            {([["overview", "Genel Bakış / Kreatifler"], ["internal", "Dahili Rapor"], ["client", "Müşteri Raporu"], ["history", "Geçmiş"]] as const).map(([key, label]) => (
              <button key={key} type="button" onClick={() => setTab(key)} className="rounded-full px-3.5 py-2 text-xs font-black transition" style={tab === key ? { background: "#0891b2", color: "white" } : { background: "var(--admin-surface-soft)", color: "var(--admin-text-secondary)" }}>{label}</button>
            ))}
          </div>

          {tab === "overview" && (
            <div className="grid gap-3">
              <Section title="Kreatif Strateji Özeti">
                <div className="grid gap-2 sm:grid-cols-2">
                  <input value={summary.campaignGoal || ""} onChange={(e) => setSummary((s) => ({ ...s, campaignGoal: e.target.value }))} placeholder="Kampanya Amacı" className="min-h-9 rounded-[8px] border px-2 text-sm" style={{ borderColor: "var(--admin-border)" }} />
                  <input value={summary.targetAudience || ""} onChange={(e) => setSummary((s) => ({ ...s, targetAudience: e.target.value }))} placeholder="Hedef Kitle" className="min-h-9 rounded-[8px] border px-2 text-sm" style={{ borderColor: "var(--admin-border)" }} />
                  <input value={summary.funnelStage || ""} onChange={(e) => setSummary((s) => ({ ...s, funnelStage: e.target.value }))} placeholder="Funnel Aşaması" className="min-h-9 rounded-[8px] border px-2 text-sm" style={{ borderColor: "var(--admin-border)" }} />
                  <input value={summary.awarenessLevel || ""} onChange={(e) => setSummary((s) => ({ ...s, awarenessLevel: e.target.value }))} placeholder="Farkındalık Seviyesi" className="min-h-9 rounded-[8px] border px-2 text-sm" style={{ borderColor: "var(--admin-border)" }} />
                  <input value={summary.keyMessage || ""} onChange={(e) => setSummary((s) => ({ ...s, keyMessage: e.target.value }))} placeholder="Ana Mesaj" className="min-h-9 rounded-[8px] border px-2 text-sm" style={{ borderColor: "var(--admin-border)" }} />
                  <input value={summary.primaryCta || ""} onChange={(e) => setSummary((s) => ({ ...s, primaryCta: e.target.value }))} placeholder="Ana CTA" className="min-h-9 rounded-[8px] border px-2 text-sm" style={{ borderColor: "var(--admin-border)" }} />
                </div>
              </Section>

              <Section title="Kreatifler">
                <div className="grid gap-3">
                  {creatives.map((c, i) => (
                    <div key={i} className="grid gap-2 rounded-[10px] border p-3" style={{ borderColor: "var(--admin-border)" }}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black" style={{ color: "var(--admin-text-muted)" }}>#{i + 1}</span>
                        <select value={c.format || "reels"} onChange={(e) => setCreatives((prev) => prev.map((x, idx) => (idx === i ? { ...x, format: e.target.value } : x)))} className="min-h-9 rounded-[8px] border px-2 text-xs font-bold" style={{ borderColor: "var(--admin-border)" }}>
                          {FORMAT_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                        <input value={c.title || ""} onChange={(e) => setCreatives((prev) => prev.map((x, idx) => (idx === i ? { ...x, title: e.target.value } : x)))} placeholder="Kreatif başlığı" className="min-h-9 flex-1 rounded-[8px] border px-2 text-sm font-bold" style={{ borderColor: "var(--admin-border)" }} />
                        <button type="button" onClick={() => setCreatives((prev) => prev.filter((_, idx) => idx !== i))} aria-label="Sil" className="rounded-full p-2" style={{ color: "var(--admin-text-muted)" }}><Trash2 size={14} /></button>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <input value={c.hook || ""} onChange={(e) => setCreatives((prev) => prev.map((x, idx) => (idx === i ? { ...x, hook: e.target.value } : x)))} placeholder="Hook" className="min-h-9 rounded-[8px] border px-2 text-sm" style={{ borderColor: "var(--admin-border)" }} />
                        <input value={c.cta || ""} onChange={(e) => setCreatives((prev) => prev.map((x, idx) => (idx === i ? { ...x, cta: e.target.value } : x)))} placeholder="CTA" className="min-h-9 rounded-[8px] border px-2 text-sm" style={{ borderColor: "var(--admin-border)" }} />
                      </div>
                      <textarea value={c.details || ""} onChange={(e) => setCreatives((prev) => prev.map((x, idx) => (idx === i ? { ...x, details: e.target.value } : x)))} placeholder="Sahne planı / çekim talimatları / tasarım notu / reklam metni vb." rows={3} className="rounded-[8px] border px-3 py-2 text-sm" style={{ borderColor: "var(--admin-border)" }} />
                      <textarea value={c.internalNotes || ""} onChange={(e) => setCreatives((prev) => prev.map((x, idx) => (idx === i ? { ...x, internalNotes: e.target.value } : x)))} placeholder="Ajans içi not (yalnızca dahili raporda görünür)" rows={2} className="rounded-[8px] border px-3 py-2 text-sm" style={{ borderColor: "var(--admin-border)" }} />
                    </div>
                  ))}
                  <AdminButton variant="secondary" compact icon={<Plus size={14} />} onClick={() => setCreatives((prev) => [...prev, { order: prev.length + 1 }])}>Kreatif Ekle</AdminButton>
                </div>
              </Section>

              <Section title="Müşteriden İstenecek Materyaller">
                <div className="grid gap-2">
                  {materials.map((m, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2 rounded-[8px] border p-2" style={{ borderColor: "var(--admin-border)" }}>
                      <input value={m.name || ""} onChange={(e) => setMaterials((prev) => prev.map((x, idx) => (idx === i ? { ...x, name: e.target.value } : x)))} placeholder="Materyal" className="min-h-9 flex-1 rounded-[8px] border px-2 text-sm" style={{ borderColor: "var(--admin-border)" }} />
                      <input value={m.quantity || ""} onChange={(e) => setMaterials((prev) => prev.map((x, idx) => (idx === i ? { ...x, quantity: e.target.value } : x)))} placeholder="Adet" className="min-h-9 w-20 rounded-[8px] border px-2 text-sm" style={{ borderColor: "var(--admin-border)" }} />
                      <button type="button" onClick={() => setMaterials((prev) => prev.filter((_, idx) => idx !== i))} aria-label="Sil" className="rounded-full p-2" style={{ color: "var(--admin-text-muted)" }}><Trash2 size={14} /></button>
                    </div>
                  ))}
                  <AdminButton variant="secondary" compact icon={<Plus size={14} />} onClick={() => setMaterials((prev) => [...prev, {}])}>Materyal Ekle</AdminButton>
                </div>
              </Section>

              <Section title="Prodüksiyon Kontrol Listesi">
                <div className="grid gap-1.5">
                  {checklist.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input type="checkbox" checked={item.checked} onChange={(e) => setChecklist((prev) => prev.map((x, idx) => (idx === i ? { ...x, checked: e.target.checked } : x)))} className="size-4" />
                      <input value={item.label} onChange={(e) => setChecklist((prev) => prev.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))} className="min-h-9 flex-1 rounded-[8px] border px-2 text-sm" style={{ borderColor: "var(--admin-border)" }} />
                      <button type="button" onClick={() => setChecklist((prev) => prev.filter((_, idx) => idx !== i))} aria-label="Sil" className="rounded-full p-2" style={{ color: "var(--admin-text-muted)" }}><Trash2 size={14} /></button>
                    </div>
                  ))}
                  <AdminButton variant="secondary" compact icon={<Plus size={14} />} onClick={() => setChecklist((prev) => [...prev, { label: "", checked: false }])}>Madde Ekle</AdminButton>
                </div>
              </Section>

              <Section title="A/B Test Planı (Dahili)">
                <div className="grid gap-2">
                  {abTests.map((t, i) => (
                    <div key={i} className="grid gap-2 rounded-[8px] border p-2" style={{ borderColor: "var(--admin-border)" }}>
                      <div className="flex items-center gap-2">
                        <input value={t.hypothesis || ""} onChange={(e) => setAbTests((prev) => prev.map((x, idx) => (idx === i ? { ...x, hypothesis: e.target.value } : x)))} placeholder="Hipotez" className="min-h-9 flex-1 rounded-[8px] border px-2 text-sm" style={{ borderColor: "var(--admin-border)" }} />
                        <button type="button" onClick={() => setAbTests((prev) => prev.filter((_, idx) => idx !== i))} aria-label="Sil" className="rounded-full p-2" style={{ color: "var(--admin-text-muted)" }}><Trash2 size={14} /></button>
                      </div>
                      <input value={t.variable || ""} onChange={(e) => setAbTests((prev) => prev.map((x, idx) => (idx === i ? { ...x, variable: e.target.value } : x)))} placeholder="Değişken" className="min-h-9 rounded-[8px] border px-2 text-sm" style={{ borderColor: "var(--admin-border)" }} />
                    </div>
                  ))}
                  <AdminButton variant="secondary" compact icon={<Plus size={14} />} onClick={() => setAbTests((prev) => [...prev, {}])}>Test Ekle</AdminButton>
                </div>
              </Section>

              <AdminButton variant="primary" loading={reportSaving === "content"} onClick={saveContent}>Kaydet</AdminButton>
            </div>
          )}

          {tab === "internal" && <ReportEditor report={report.internal_report} saving={reportSaving === "internal"} onSave={(next) => saveReport("internal", next)} />}
          {tab === "client" && <ReportEditor report={report.client_report} saving={reportSaving === "client"} onSave={(next) => saveReport("client", next)} />}

          {tab === "history" && (
            <div className="grid gap-2">
              {data!.history.map((h) => (
                <button key={h.id} type="button" onClick={() => setHistoryDetail(h)} className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border p-3 text-left text-sm" style={{ borderColor: "var(--admin-border)" }}>
                  <span className="font-black">v{h.version} — {new Date(h.created_at).toLocaleDateString("tr-TR")}</span>
                  <AdminStatusBadge tone={STATUS_TONE[h.status]}>{STATUS_LABELS[h.status]}</AdminStatusBadge>
                </button>
              ))}
              {!data!.history.length && <p className="text-sm" style={{ color: "var(--admin-text-muted)" }}>Geçmiş rapor versiyonu yok.</p>}
            </div>
          )}
        </>
      )}

      {historyDetail && (
        <div role="dialog" aria-modal="true" aria-label="Rapor Versiyonu" onMouseDown={() => setHistoryDetail(null)} className="fixed inset-0 z-[60] grid place-items-center p-4" style={{ background: "var(--admin-overlay, rgba(15,23,42,.55))" }}>
          <div onMouseDown={(e) => e.stopPropagation()} className="admin-modal-panel grid max-h-[85vh] w-full max-w-lg gap-3 overflow-y-auto rounded-[16px] p-5" style={{ background: "var(--admin-surface, var(--admin-bg))" }}>
            <div className="flex items-center justify-between gap-3">
              <strong className="font-black">v{historyDetail.version} — {STATUS_LABELS[historyDetail.status]}</strong>
              <AdminButton variant="ghost" compact onClick={() => setHistoryDetail(null)}>Kapat</AdminButton>
            </div>
            <p className="text-sm"><strong>Kreatif Sayısı:</strong> {historyDetail.creatives?.length || 0}</p>
            <p className="text-sm"><strong>Oluşturulma:</strong> {new Date(historyDetail.created_at).toLocaleString("tr-TR")}</p>
            {historyDetail.internal_report?.executiveSummary && <p className="whitespace-pre-wrap text-sm">{historyDetail.internal_report.executiveSummary}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
