"use client";
/* eslint-disable react-hooks/set-state-in-effect -- fetch-on-mount pattern, same accepted precedent as AdCreativeReportPanel.tsx */

import { useEffect, useState } from "react";
import { Copy, Download, RefreshCw } from "lucide-react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminStatusBadge, type AdminStatusTone } from "@/components/admin/ui/AdminStatusBadge";

type CampaignOption = { id: string; name: string; status: string; meta_campaign_id: string | null };
type ReportSection = { title: string; content: string };
type ReportText = { executiveSummary?: string; sections?: ReportSection[] };
type EvaluationStatus = "draft" | "evaluated" | "archived";
type Evaluation = {
  id: string; company_id: string; campaign_id: string | null; meta_campaign_id: string | null;
  evaluation_period_start: string | null; evaluation_period_end: string | null; campaign_age_hours: number | null;
  prompt_text: string; claude_raw_response: string | null;
  internal_report: ReportText; client_report: ReportText;
  decision: string | null; next_review_at: string | null; next_review_note: string | null;
  status: EvaluationStatus; created_at: string;
};

const DECISION_LABELS: Record<string, string> = {
  OBSERVE: "Gözlemle", CONTINUE: "Devam Et", NO_CHANGE: "Değişiklik Yok", MONITOR: "İzle",
  CREATIVE_TEST: "Kreatif Testi", CREATIVE_CHANGE: "Kreatif Değişikliği", AUDIENCE_TEST: "Kitle Testi",
  BUDGET_OPTIMIZATION: "Bütçe Optimizasyonu", ADSET_OPTIMIZATION: "Reklam Seti Optimizasyonu",
  REMARKETING: "Yeniden Pazarlama", TECHNICAL_ISSUE: "Teknik Sorun",
  SALES_PROCESS_REVIEW: "Satış Süreci İncelemesi", INSUFFICIENT_DATA: "Veri Yetersiz"
};
const STATUS_TONE: Record<EvaluationStatus, AdminStatusTone> = { draft: "neutral", evaluated: "success", archived: "neutral" };
const STATUS_LABELS: Record<EvaluationStatus, string> = { draft: "Taslak", evaluated: "Değerlendirildi", archived: "Arşivlendi" };

function ReportView({ report }: { report: ReportText }) {
  if (!report?.sections?.length && !report?.executiveSummary) return <p className="text-sm" style={{ color: "var(--admin-text-muted)" }}>Henüz rapor yok.</p>;
  return (
    <div className="grid gap-3">
      {report.executiveSummary && (
        <div>
          <p className="text-xs font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>Yönetici Özeti</p>
          <p className="mt-1 text-sm leading-6">{report.executiveSummary}</p>
        </div>
      )}
      {(report.sections || []).map((section, i) => (
        <div key={i} className="rounded-[10px] border p-3" style={{ borderColor: "var(--admin-border)" }}>
          <p className="text-xs font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>{section.title}</p>
          <p className="mt-1 whitespace-pre-line text-sm leading-6">{section.content}</p>
        </div>
      ))}
    </div>
  );
}

export function AdEvaluationPanel({ companyId }: { companyId: string }) {
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [rangePreset, setRangePreset] = useState<"today" | "last_7d" | "last_30d">("last_30d");
  const [prompt, setPrompt] = useState("");
  const [contextLoading, setContextLoading] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [current, setCurrent] = useState<Evaluation | null>(null);
  const [history, setHistory] = useState<Evaluation[]>([]);
  const [rawResponse, setRawResponse] = useState("");
  const [importing, setImporting] = useState(false);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [exportBusy, setExportBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewTab, setViewTab] = useState<"internal" | "client">("client");

  function loadHistory() {
    if (!companyId) return;
    fetch(`/api/admin/ad-insights/evaluations?companyId=${companyId}${campaignId ? `&campaignId=${campaignId}` : ""}`)
      .then((r) => r.json())
      .then((body) => { if (!body.error) { setCurrent(body.current || null); setHistory(body.history || []); } })
      .catch(() => {});
  }
  useEffect(loadHistory, [companyId, campaignId]);

  function loadContext() {
    if (!companyId) return;
    setContextLoading(true);
    setError(null);
    fetch(`/api/admin/ad-insights/evaluations/context?companyId=${companyId}${campaignId ? `&campaignId=${campaignId}` : ""}&rangePreset=${rangePreset}`)
      .then((r) => r.json())
      .then((body) => {
        if (body.error) { setError(body.error); return; }
        setCampaigns(body.campaigns || []);
        setPrompt(body.prompt || "");
      })
      .catch(() => setError("Bağlam yüklenemedi."))
      .finally(() => setContextLoading(false));
  }
  useEffect(loadContext, [companyId, campaignId, rangePreset]);

  async function prepareEvaluation() {
    if (!companyId) return;
    setPreparing(true);
    setError(null);
    try {
      const ctxRes = await fetch(`/api/admin/ad-insights/evaluations/context?companyId=${companyId}${campaignId ? `&campaignId=${campaignId}` : ""}&rangePreset=${rangePreset}`);
      const ctxBody = await ctxRes.json();
      if (ctxBody.error) throw new Error(ctxBody.error);
      const today = new Date().toISOString().slice(0, 10);
      const periodStart = rangePreset === "today" ? today : new Date(Date.now() - (rangePreset === "last_7d" ? 7 : 30) * 86400000).toISOString().slice(0, 10);
      const res = await fetch("/api/admin/ad-insights/evaluations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId, campaignId: campaignId || undefined, metaCampaignId: ctxBody.context?.campaign?.metaCampaignId || undefined,
          strategyId: ctxBody.context?.strategy?.id, creativeStrategyId: ctxBody.context?.creativeStrategy?.id,
          evaluationPeriodStart: periodStart, evaluationPeriodEnd: today,
          campaignAgeHours: ctxBody.context?.campaignAgeHours ?? undefined,
          metricsSnapshot: ctxBody.context?.metricsSnapshot || {}, promptText: ctxBody.prompt
        })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Değerlendirme hazırlanamadı.");
      setPrompt(ctxBody.prompt || "");
      loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Beklenmeyen hata.");
    } finally {
      setPreparing(false);
    }
  }

  async function copyPrompt() {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard denied — prompt preview remains visible to copy manually */ }
  }

  async function importResponse() {
    if (!current || !rawResponse.trim()) return;
    setImporting(true);
    setError(null);
    setImportWarnings([]);
    try {
      const res = await fetch(`/api/admin/ad-insights/evaluations/${current.id}/import`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, rawResponse })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "İçe aktarılamadı.");
      setCurrent(body.evaluation);
      setImportWarnings(body.warnings || []);
      setRawResponse("");
      loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Beklenmeyen hata.");
    } finally {
      setImporting(false);
    }
  }

  async function exportDocument(evaluationId: string, mode: "client" | "internal", format: "pdf" | "docx") {
    const key = `${mode}-${format}`;
    setExportBusy(key);
    setError(null);
    try {
      const res = await fetch(`/api/admin/ad-insights/evaluations/${evaluationId}/export`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, mode, format })
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Belge oluşturulamadı."); }
      const disposition = res.headers.get("Content-Disposition") || "";
      const filenameMatch = disposition.match(/filename="([^"]+)"/);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filenameMatch?.[1] || `reklam-degerlendirme.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Beklenmeyen hata.");
    } finally {
      setExportBusy(null);
    }
  }

  if (!companyId) return <p className="text-sm" style={{ color: "var(--admin-text-muted)" }}>Önce bir müşteri seçin.</p>;

  return (
    <div className="grid gap-4">
      {error && <div className="rounded-[10px] border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}

      <div className="rounded-[14px] border p-4" style={{ borderColor: "var(--admin-border)" }}>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1.5 text-sm font-bold">
            Kampanya
            <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className="min-h-9 rounded-[8px] border px-3 text-sm" style={{ borderColor: "var(--admin-border)" }}>
              <option value="">Kampanya seçin</option>
              {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name} {c.meta_campaign_id ? "(Meta)" : ""}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-bold">
            Değerlendirme Dönemi
            <select value={rangePreset} onChange={(e) => setRangePreset(e.target.value as typeof rangePreset)} className="min-h-9 rounded-[8px] border px-3 text-sm" style={{ borderColor: "var(--admin-border)" }}>
              <option value="today">Bugün</option>
              <option value="last_7d">Son 7 Gün</option>
              <option value="last_30d">Son 30 Gün</option>
            </select>
          </label>
          <div className="flex items-end">
            <AdminButton variant="secondary" compact icon={<RefreshCw size={14} />} loading={contextLoading} onClick={loadContext}>Verileri Yenile</AdminButton>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <AdminButton variant="primary" compact loading={preparing} onClick={prepareEvaluation}>Değerlendirme Hazırla</AdminButton>
          <AdminButton variant="secondary" compact icon={<Copy size={14} />} disabled={!prompt} onClick={copyPrompt}>{copied ? "Kopyalandı ✓" : "Promptu Kopyala"}</AdminButton>
        </div>
        {prompt && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-black" style={{ color: "var(--admin-text-muted)" }}>Prompt önizleme</summary>
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-[8px] bg-slate-50 p-3 text-xs">{prompt}</pre>
          </details>
        )}
      </div>

      {current && (
        <div className="rounded-[14px] border p-4" style={{ borderColor: "var(--admin-border)" }}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-black">Mevcut Değerlendirme — v{current.id.slice(0, 8)}</p>
            <div className="flex items-center gap-2">
              <AdminStatusBadge tone={STATUS_TONE[current.status]}>{STATUS_LABELS[current.status]}</AdminStatusBadge>
              {current.decision && <AdminStatusBadge tone="info">{DECISION_LABELS[current.decision] || current.decision}</AdminStatusBadge>}
            </div>
          </div>

          {current.status === "draft" && (
            <div className="grid gap-2">
              <label className="grid gap-1.5 text-sm font-bold">
                Claude Sonucunu İçe Aktar
                <textarea value={rawResponse} onChange={(e) => setRawResponse(e.target.value)} rows={8} placeholder="Claude Reklam Değerlendirme Project'inden aldığınız tam çıktıyı buraya yapıştırın." className="rounded-[10px] border px-3 py-2 text-sm" style={{ borderColor: "var(--admin-border)" }} />
              </label>
              <AdminButton variant="primary" compact loading={importing} disabled={!rawResponse.trim()} onClick={importResponse}>Claude Sonucunu İçe Aktar</AdminButton>
              {importWarnings.length > 0 && (
                <div className="rounded-[8px] border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                  {importWarnings.map((w, i) => <p key={i}>{w}</p>)}
                </div>
              )}
            </div>
          )}

          {current.status === "evaluated" && (
            <>
              <div className="mb-3 flex gap-2">
                <button type="button" onClick={() => setViewTab("client")} className="rounded-full px-3 py-1.5 text-xs font-black" style={viewTab === "client" ? { background: "#0891b2", color: "white" } : { background: "var(--admin-surface-soft)", color: "var(--admin-text-secondary)" }}>Müşteri Raporu</button>
                <button type="button" onClick={() => setViewTab("internal")} className="rounded-full px-3 py-1.5 text-xs font-black" style={viewTab === "internal" ? { background: "#0891b2", color: "white" } : { background: "var(--admin-surface-soft)", color: "var(--admin-text-secondary)" }}>Dahili Rapor</button>
              </div>
              <ReportView report={viewTab === "client" ? current.client_report : current.internal_report} />
              {current.next_review_at && <p className="mt-3 text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>Sonraki kontrol: {new Date(current.next_review_at).toLocaleDateString("tr-TR")} {current.next_review_note ? `— ${current.next_review_note}` : ""}</p>}
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <AdminButton variant="secondary" compact icon={<Download size={14} />} loading={exportBusy === "internal-pdf"} onClick={() => exportDocument(current.id, "internal", "pdf")}>Dahili PDF</AdminButton>
                <AdminButton variant="secondary" compact icon={<Download size={14} />} loading={exportBusy === "internal-docx"} onClick={() => exportDocument(current.id, "internal", "docx")}>Dahili Word</AdminButton>
                <AdminButton variant="secondary" compact icon={<Download size={14} />} loading={exportBusy === "client-pdf"} onClick={() => exportDocument(current.id, "client", "pdf")}>Müşteri PDF</AdminButton>
                <AdminButton variant="secondary" compact icon={<Download size={14} />} loading={exportBusy === "client-docx"} onClick={() => exportDocument(current.id, "client", "docx")}>Müşteri Word</AdminButton>
              </div>
            </>
          )}
        </div>
      )}

      <div className="rounded-[14px] border p-4" style={{ borderColor: "var(--admin-border)" }}>
        <p className="mb-3 text-sm font-black">Değerlendirme Geçmişi</p>
        {!history.length && <p className="text-sm" style={{ color: "var(--admin-text-muted)" }}>Henüz değerlendirme kaydı yok.</p>}
        <div className="grid gap-2">
          {history.map((item) => (
            <button key={item.id} type="button" onClick={() => setCurrent(item)} className="rounded-[10px] border p-3 text-left text-sm" style={{ borderColor: "var(--admin-border)" }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold">{new Date(item.created_at).toLocaleDateString("tr-TR")} · {item.evaluation_period_start || "-"} → {item.evaluation_period_end || "-"}</span>
                <div className="flex items-center gap-2">
                  <AdminStatusBadge tone={STATUS_TONE[item.status]}>{STATUS_LABELS[item.status]}</AdminStatusBadge>
                  {item.decision && <AdminStatusBadge tone="info">{DECISION_LABELS[item.decision] || item.decision}</AdminStatusBadge>}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
