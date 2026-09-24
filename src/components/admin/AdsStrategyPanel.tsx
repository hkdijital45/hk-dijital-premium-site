"use client";
/* eslint-disable react-hooks/set-state-in-effect -- fetch-on-mount pattern, same accepted precedent as ContentPlanningCenter.tsx */

import { useEffect, useState } from "react";
import { Copy, Download, Plus, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminStatusBadge, type AdminStatusTone } from "@/components/admin/ui/AdminStatusBadge";

type Company = { id: string; name: string };

type CampaignSequenceItem = { order: number; name: string; objective?: string; conversionLocation?: string; dailyBudget?: number; purpose?: string; transitionCondition?: string };
type RemarketingInfo = { required?: boolean; status?: "not_ready" | "ready" | "active"; condition?: string };
type ReportSection = { title: string; content: string };
type AdStrategyReport = { executiveSummary?: string; sections?: ReportSection[] };
type AdStrategyStatus = "draft" | "approved" | "active" | "updated" | "archived";
type AdStrategy = {
  id: string; company_id: string; version: number; status: AdStrategyStatus; strategy_title: string;
  primary_platform: string; primary_goal: string;
  monthly_ad_budget: number | null; daily_budget_estimate: number | null; meta_budget: number | null; google_budget: number | null;
  primary_kpi: string; campaign_sequence: CampaignSequenceItem[]; remarketing: RemarketingInfo;
  internal_report: AdStrategyReport; client_report: AdStrategyReport;
  created_at: string; updated_at: string; approved_at: string | null; activated_at: string | null; archived_at: string | null;
};
type LegacyRun = { id: string; created_at: string; final_report?: { summary?: string } };
type ApiResponse = { current: AdStrategy | null; history: AdStrategy[]; legacy: LegacyRun | null };

const STATUS_LABELS: Record<AdStrategyStatus, string> = { draft: "Taslak", approved: "Onaylandı", active: "Uygulanıyor", updated: "Güncellendi", archived: "Arşivlendi" };
const STATUS_TONE: Record<AdStrategyStatus, AdminStatusTone> = { draft: "neutral", approved: "info", active: "success", updated: "warning", archived: "neutral" };
const REMARKETING_STATUS_LABELS: Record<string, string> = { not_ready: "Hazır Değil", ready: "Hazır", active: "Aktif" };
const KPI_LABELS: Record<string, string> = { CPL: "CPL — Lead Başına Maliyet", CPA: "CPA — Aksiyon/Müşteri Edinme Başına Maliyet", "Cost per Message": "Mesaj Başına Maliyet", "Qualified Lead": "Nitelikli Potansiyel Müşteri", ROAS: "ROAS — Reklam Harcaması Getirisi", CTR: "CTR — Tıklama Oranı" };

function money(v: number | null): string {
  return v ? `${v.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL` : "—";
}

function kpiLabel(v: string): string {
  return KPI_LABELS[v] || v || "—";
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="content-plan-stat rounded-[14px] border p-4" style={{ borderColor: "var(--admin-border)" }}>
      <p className="mb-2 text-xs font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>{title}</p>
      {children}
    </div>
  );
}

/* ------------------------- Editable report editor ------------------------- */

function ReportEditor({ report, onSave, saving }: { report: AdStrategyReport; onSave: (next: AdStrategyReport) => void; saving: boolean }) {
  const [summary, setSummary] = useState(report.executiveSummary || "");
  const [sections, setSections] = useState<ReportSection[]>(report.sections || []);

  function updateSection(index: number, patch: Partial<ReportSection>) {
    setSections((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
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

/* ------------------------------- Main panel ------------------------------- */

export function AdsStrategyPanel({ companyId, companies }: { companyId: string; companies: Company[] }) {
  const [data, setData] = useState<ApiResponse | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<"overview" | "internal" | "client" | "history">("overview");
  const [editingOverview, setEditingOverview] = useState(false);
  const [reportSaving, setReportSaving] = useState<"internal" | "client" | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState<string | null>(null);
  const [historyDetail, setHistoryDetail] = useState<AdStrategy | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  function load() {
    if (!companyId) return;
    setData(undefined);
    setError(null);
    fetch(`/api/admin/ad-insights/ads-strategy?companyId=${companyId}`)
      .then((r) => r.json())
      .then((body) => (body.error ? setError(body.error) : setData(body)))
      .catch(() => setError("Yüklenemedi."));
  }

  useEffect(load, [companyId]);

  const companyName = companies.find((c) => c.id === companyId)?.name || "";
  const strategy = data?.current || null;

  async function copyCommand() {
    const text = `${companyName} için güncel Instagram, Facebook, Meta Ads ve Google Ads verilerini HK Dijital MCP üzerinden incele. Profesyonel reklam stratejisi ve bütçe planı oluştur ve sonucu HK Dijital'e kaydet.`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard denied — nothing to fall back to here */ }
  }

  async function saveReport(kind: "internal" | "client", next: AdStrategyReport) {
    if (!strategy) return;
    setReportSaving(kind);
    setSaveError(null);
    try {
      const res = await fetch(`/api/admin/ad-insights/ads-strategy/${strategy.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, [kind === "internal" ? "internal_report" : "client_report"]: next })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Kaydedilemedi.");
      setData((prev) => (prev ? { ...prev, current: body.strategy } : prev));
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Beklenmeyen hata.");
    } finally {
      setReportSaving(null);
    }
  }

  async function saveOverview(patch: Record<string, unknown>) {
    if (!strategy) return;
    setSaveError(null);
    try {
      const res = await fetch(`/api/admin/ad-insights/ads-strategy/${strategy.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, ...patch })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Kaydedilemedi.");
      setData((prev) => (prev ? { ...prev, current: body.strategy } : prev));
      setEditingOverview(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Beklenmeyen hata.");
    }
  }

  async function changeStatus(status: AdStrategyStatus) {
    if (!strategy) return;
    setStatusBusy(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/admin/ad-insights/ads-strategy/${strategy.id}/status`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, status })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Durum güncellenemedi.");
      setData((prev) => (prev ? { ...prev, current: body.strategy, history: prev.history.map((h) => (h.id === body.strategy.id ? body.strategy : h)) } : prev));
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Beklenmeyen hata.");
    } finally {
      setStatusBusy(false);
    }
  }

  async function exportDocument(mode: "internal" | "client", format: "pdf" | "docx") {
    if (!strategy) return;
    const key = `${mode}-${format}`;
    setExportBusy(key);
    setSaveError(null);
    try {
      const res = await fetch(`/api/admin/ad-insights/ads-strategy/${strategy.id}/export`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, mode, format })
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || "Belge oluşturulamadı.");
      }
      const disposition = res.headers.get("Content-Disposition") || "";
      const filenameMatch = disposition.match(/filename="([^"]+)"/);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filenameMatch?.[1] || `reklam-stratejisi.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Beklenmeyen hata.");
    } finally {
      setExportBusy(null);
    }
  }

  if (!companyId) return <p className="text-sm font-bold" style={{ color: "var(--admin-text-muted)" }}>Bir müşteri seçin.</p>;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold" style={{ color: "var(--admin-text-secondary)" }}>Claude MCP ile oluşturulan reklam stratejisi — HK Admin&apos;de incelenir, düzenlenir ve onaylanır.</p>
        <div className="flex gap-2">
          <AdminButton variant="secondary" compact icon={<RefreshCw size={14} />} onClick={load}>Yenile</AdminButton>
          <AdminButton variant="secondary" compact icon={<Copy size={14} />} onClick={copyCommand}>{copied ? "Kopyalandı ✓" : "Claude için komutu kopyala"}</AdminButton>
        </div>
      </div>

      {error && <p className="text-sm font-bold text-[#dc2626]">{error}</p>}
      {saveError && <p className="text-sm font-bold text-[#dc2626]">{saveError}</p>}
      {data === undefined && !error && <p className="text-sm font-bold" style={{ color: "var(--admin-text-muted)" }}>Yükleniyor…</p>}

      {data && !strategy && !data.legacy && (
        <div className="content-plan-empty rounded-[16px] border p-8 text-center" style={{ borderColor: "var(--admin-border)" }}>
          <p className="text-sm font-bold" style={{ color: "var(--admin-text-secondary)" }}>{companyName} için henüz kaydedilmiş bir reklam stratejisi yok.</p>
        </div>
      )}

      {data && !strategy && data.legacy && (
        <div className="content-plan-stat rounded-[16px] border p-6" style={{ borderColor: "var(--admin-border)" }}>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>
            <Sparkles size={14} /> Eski (legacy) kayıt · {new Date(data.legacy.created_at).toLocaleString("tr-TR")}
          </div>
          <p className="text-sm">{data.legacy.final_report?.summary || "—"}</p>
          <p className="mt-3 text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>Bu kayıt yeni operasyon sisteminden önce oluşturuldu; düzenlenemez/onaylanamaz. Yeni bir strateji oluşturulduğunda yeni sistem otomatik kullanılır.</p>
        </div>
      )}

      {strategy && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <AdminStatusBadge tone={STATUS_TONE[strategy.status]}>{STATUS_LABELS[strategy.status]}</AdminStatusBadge>
            <span className="text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>v{strategy.version} · Son güncelleme: {new Date(strategy.updated_at).toLocaleString("tr-TR")}</span>
            <div className="ml-auto flex flex-wrap gap-2">
              {strategy.status === "draft" && <AdminButton variant="success" compact loading={statusBusy} onClick={() => changeStatus("approved")}>Taslağı Onayla</AdminButton>}
              {(strategy.status === "approved" || strategy.status === "updated") && <AdminButton variant="primary" compact loading={statusBusy} onClick={() => changeStatus("active")}>Uygulamaya Al</AdminButton>}
              {strategy.status !== "updated" && strategy.status !== "archived" && <AdminButton variant="secondary" compact loading={statusBusy} onClick={() => changeStatus("updated")}>Güncellendi Olarak İşaretle</AdminButton>}
              {strategy.status !== "archived" && <AdminButton variant="danger" compact loading={statusBusy} onClick={() => changeStatus("archived")}>Arşivle</AdminButton>}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {([["overview", "Genel Bakış"], ["internal", "Dahili Rapor"], ["client", "Müşteri Raporu"], ["history", "Geçmiş"]] as const).map(([key, label]) => (
              <button key={key} type="button" onClick={() => setTab(key)} className="rounded-full px-3.5 py-2 text-xs font-black transition" style={tab === key ? { background: "#0891b2", color: "white" } : { background: "var(--admin-surface-soft)", color: "var(--admin-text-secondary)" }}>
                {label}
              </button>
            ))}
          </div>

          {tab === "overview" && (
            <div className="grid gap-3">
              <Section title="Strateji Kartı">
                {!editingOverview ? (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <p className="text-sm"><strong>Müşteri:</strong> {companyName}</p>
                    <p className="text-sm"><strong>Platform:</strong> {strategy.primary_platform || "—"}</p>
                    <p className="text-sm"><strong>Ana Hedef:</strong> {strategy.primary_goal || "—"}</p>
                    <p className="text-sm"><strong>Aylık Toplam Bütçe:</strong> {money(strategy.monthly_ad_budget)}</p>
                    <p className="text-sm"><strong>Meta Bütçesi:</strong> {money(strategy.meta_budget)}</p>
                    <p className="text-sm"><strong>Google Bütçesi:</strong> {money(strategy.google_budget)}</p>
                    <p className="text-sm"><strong>Günlük Tahmini Bütçe:</strong> {money(strategy.daily_budget_estimate)}</p>
                    <p className="text-sm"><strong>Ana KPI:</strong> {kpiLabel(strategy.primary_kpi)}</p>
                  </div>
                ) : (
                  <OverviewEditForm strategy={strategy} onCancel={() => setEditingOverview(false)} onSave={saveOverview} />
                )}
                {!editingOverview && <div className="mt-3"><AdminButton variant="secondary" compact onClick={() => setEditingOverview(true)}>Genel Bilgileri Düzenle</AdminButton></div>}
              </Section>

              <Section title="Reklam Açılış Sırası">
                {strategy.campaign_sequence.length ? (
                  <ol className="grid gap-2">
                    {[...strategy.campaign_sequence].sort((a, b) => (a.order || 0) - (b.order || 0)).map((c, i) => (
                      <li key={i} className="rounded-[10px] border p-3 text-sm" style={{ borderColor: "var(--admin-border)" }}>
                        <p className="font-black">{c.order}. {c.name}</p>
                        {c.objective && <p className="mt-1 text-xs" style={{ color: "var(--admin-text-secondary)" }}>Objective: {c.objective}</p>}
                        {c.conversionLocation && <p className="text-xs" style={{ color: "var(--admin-text-secondary)" }}>Conversion location: {c.conversionLocation}</p>}
                        {c.dailyBudget ? <p className="text-xs" style={{ color: "var(--admin-text-secondary)" }}>Günlük bütçe: {money(c.dailyBudget)}</p> : null}
                        {c.purpose && <p className="text-xs" style={{ color: "var(--admin-text-secondary)" }}>Amaç: {c.purpose}</p>}
                        {c.transitionCondition && <p className="text-xs" style={{ color: "var(--admin-text-secondary)" }}>Geçiş Şartı: {c.transitionCondition}</p>}
                      </li>
                    ))}
                  </ol>
                ) : <p className="text-sm" style={{ color: "var(--admin-text-muted)" }}>Henüz kampanya sırası tanımlanmamış.</p>}
              </Section>

              <Section title="Remarketing">
                <AdminStatusBadge tone={strategy.remarketing.status === "active" ? "success" : strategy.remarketing.status === "ready" ? "info" : "neutral"}>
                  {REMARKETING_STATUS_LABELS[strategy.remarketing.status || ""] || "Hazır Değil"}
                </AdminStatusBadge>
                <p className="mt-2 text-sm">{strategy.remarketing.condition || "Başlatma şartı henüz tanımlanmamış."}</p>
              </Section>
            </div>
          )}

          {tab === "internal" && (
            <div className="grid gap-3">
              <div className="flex flex-wrap gap-2">
                <AdminButton variant="secondary" compact icon={<Download size={14} />} loading={exportBusy === "internal-pdf"} onClick={() => exportDocument("internal", "pdf")}>Dahili Rapor — PDF İndir</AdminButton>
                <AdminButton variant="secondary" compact icon={<Download size={14} />} loading={exportBusy === "internal-docx"} onClick={() => exportDocument("internal", "docx")}>Dahili Rapor — DOCX İndir</AdminButton>
              </div>
              <ReportEditor report={strategy.internal_report} saving={reportSaving === "internal"} onSave={(next) => saveReport("internal", next)} />
            </div>
          )}

          {tab === "client" && (
            <div className="grid gap-3">
              <div className="flex flex-wrap gap-2">
                <AdminButton variant="secondary" compact icon={<Download size={14} />} loading={exportBusy === "client-pdf"} onClick={() => exportDocument("client", "pdf")}>Müşteri Raporu — PDF İndir</AdminButton>
                <AdminButton variant="secondary" compact icon={<Download size={14} />} loading={exportBusy === "client-docx"} onClick={() => exportDocument("client", "docx")}>Müşteri Raporu — DOCX İndir</AdminButton>
              </div>
              <ReportEditor report={strategy.client_report} saving={reportSaving === "client"} onSave={(next) => saveReport("client", next)} />
            </div>
          )}

          {tab === "history" && (
            <div className="grid gap-2">
              {data!.history.map((h) => (
                <button key={h.id} type="button" onClick={() => setHistoryDetail(h)} className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border p-3 text-left text-sm" style={{ borderColor: "var(--admin-border)" }}>
                  <span className="font-black">v{h.version} — {new Date(h.created_at).toLocaleDateString("tr-TR")}</span>
                  <AdminStatusBadge tone={STATUS_TONE[h.status]}>{STATUS_LABELS[h.status]}</AdminStatusBadge>
                </button>
              ))}
              {!data!.history.length && <p className="text-sm" style={{ color: "var(--admin-text-muted)" }}>Geçmiş strateji versiyonu yok.</p>}
            </div>
          )}
        </>
      )}

      {historyDetail && (
        <div role="dialog" aria-modal="true" aria-label="Strateji Versiyonu" onMouseDown={() => setHistoryDetail(null)} className="fixed inset-0 z-[60] grid place-items-center p-4" style={{ background: "var(--admin-overlay, rgba(15,23,42,.55))" }}>
          <div onMouseDown={(e) => e.stopPropagation()} className="admin-modal-panel grid max-h-[85vh] w-full max-w-lg gap-3 overflow-y-auto rounded-[16px] p-5" style={{ background: "var(--admin-surface, var(--admin-bg))" }}>
            <div className="flex items-center justify-between gap-3">
              <strong className="font-black">v{historyDetail.version} — {STATUS_LABELS[historyDetail.status]}</strong>
              <AdminButton variant="ghost" compact onClick={() => setHistoryDetail(null)}>Kapat</AdminButton>
            </div>
            <p className="text-sm"><strong>Platform:</strong> {historyDetail.primary_platform || "—"} · <strong>Hedef:</strong> {historyDetail.primary_goal || "—"}</p>
            <p className="text-sm"><strong>Bütçe:</strong> {money(historyDetail.monthly_ad_budget)}</p>
            <p className="text-sm"><strong>Oluşturulma:</strong> {new Date(historyDetail.created_at).toLocaleString("tr-TR")}</p>
            {historyDetail.internal_report?.executiveSummary && <p className="text-sm whitespace-pre-wrap">{historyDetail.internal_report.executiveSummary}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function OverviewEditForm({ strategy, onCancel, onSave }: { strategy: AdStrategy; onCancel: () => void; onSave: (patch: Record<string, unknown>) => void }) {
  const [title, setTitle] = useState(strategy.strategy_title);
  const [platform, setPlatform] = useState(strategy.primary_platform);
  const [goal, setGoal] = useState(strategy.primary_goal);
  const [monthly, setMonthly] = useState(String(strategy.monthly_ad_budget ?? ""));
  const [meta, setMeta] = useState(String(strategy.meta_budget ?? ""));
  const [google, setGoogle] = useState(String(strategy.google_budget ?? ""));
  const [kpi, setKpi] = useState(strategy.primary_kpi);
  const [remarketingStatus, setRemarketingStatus] = useState(strategy.remarketing.status || "not_ready");
  const [remarketingCondition, setRemarketingCondition] = useState(strategy.remarketing.condition || "");

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="grid gap-1 text-xs font-bold">Strateji Başlığı<input value={title} onChange={(e) => setTitle(e.target.value)} className="min-h-9 rounded-[8px] border px-2 text-sm" style={{ borderColor: "var(--admin-border)" }} /></label>
      <label className="grid gap-1 text-xs font-bold">Platform<input value={platform} onChange={(e) => setPlatform(e.target.value)} className="min-h-9 rounded-[8px] border px-2 text-sm" style={{ borderColor: "var(--admin-border)" }} /></label>
      <label className="grid gap-1 text-xs font-bold">Ana Hedef<input value={goal} onChange={(e) => setGoal(e.target.value)} className="min-h-9 rounded-[8px] border px-2 text-sm" style={{ borderColor: "var(--admin-border)" }} /></label>
      <label className="grid gap-1 text-xs font-bold">Ana KPI<input value={kpi} onChange={(e) => setKpi(e.target.value)} className="min-h-9 rounded-[8px] border px-2 text-sm" style={{ borderColor: "var(--admin-border)" }} /></label>
      <label className="grid gap-1 text-xs font-bold">Aylık Toplam Bütçe (TL)<input type="number" value={monthly} onChange={(e) => setMonthly(e.target.value)} className="min-h-9 rounded-[8px] border px-2 text-sm" style={{ borderColor: "var(--admin-border)" }} /></label>
      <label className="grid gap-1 text-xs font-bold">Meta Bütçesi (TL)<input type="number" value={meta} onChange={(e) => setMeta(e.target.value)} className="min-h-9 rounded-[8px] border px-2 text-sm" style={{ borderColor: "var(--admin-border)" }} /></label>
      <label className="grid gap-1 text-xs font-bold">Google Bütçesi (TL)<input type="number" value={google} onChange={(e) => setGoogle(e.target.value)} className="min-h-9 rounded-[8px] border px-2 text-sm" style={{ borderColor: "var(--admin-border)" }} /></label>
      <label className="grid gap-1 text-xs font-bold">Remarketing Durumu
        <select value={remarketingStatus} onChange={(e) => setRemarketingStatus(e.target.value as RemarketingInfo["status"] & string)} className="min-h-9 rounded-[8px] border px-2 text-sm" style={{ borderColor: "var(--admin-border)" }}>
          <option value="not_ready">Hazır Değil</option>
          <option value="ready">Hazır</option>
          <option value="active">Aktif</option>
        </select>
      </label>
      <label className="grid gap-1 text-xs font-bold sm:col-span-2">Remarketing Başlatma Şartı<textarea value={remarketingCondition} onChange={(e) => setRemarketingCondition(e.target.value)} rows={2} className="rounded-[8px] border px-2 py-1.5 text-sm" style={{ borderColor: "var(--admin-border)" }} /></label>
      <div className="flex gap-2 sm:col-span-2">
        <AdminButton variant="primary" compact onClick={() => onSave({
          strategy_title: title, primary_platform: platform, primary_goal: goal, primary_kpi: kpi,
          monthly_ad_budget: monthly ? Number(monthly) : null, meta_budget: meta ? Number(meta) : null, google_budget: google ? Number(google) : null,
          remarketing: { ...strategy.remarketing, status: remarketingStatus, condition: remarketingCondition }
        })}>Kaydet</AdminButton>
        <AdminButton variant="ghost" compact onClick={onCancel}>Vazgeç</AdminButton>
      </div>
    </div>
  );
}
