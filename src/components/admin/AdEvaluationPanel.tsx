"use client";
/* eslint-disable react-hooks/set-state-in-effect -- fetch-on-mount pattern, same accepted precedent as AdCreativeReportPanel.tsx */

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Copy, Download, FileText, History, RefreshCw, X } from "lucide-react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminStatusBadge, type AdminStatusTone } from "@/components/admin/ui/AdminStatusBadge";
import { formatReportTimestamp } from "@/lib/report-timestamp";
import { parseMarkdownBlocks, normalizeLegacyTableBlock, type ContentBlock, type DocumentTable } from "@/lib/marketing-intelligence/ad-evaluation-markdown";

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

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[16px] border p-5 ${className}`} style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }}>
      {children}
    </div>
  );
}

function EmptyNote({ title, description }: { title: string; description?: string }) {
  return (
    <div className="grid justify-items-center gap-1.5 rounded-[12px] border border-dashed px-5 py-8 text-center" style={{ borderColor: "var(--admin-border)" }}>
      <span className="grid size-9 place-items-center rounded-full" style={{ background: "var(--admin-surface-soft)", color: "var(--admin-text-muted)" }} aria-hidden>
        <History size={16} />
      </span>
      <p className="text-sm font-black" style={{ color: "var(--admin-text-primary)" }}>{title}</p>
      {description && <p className="max-w-sm text-xs leading-5" style={{ color: "var(--admin-text-muted)" }}>{description}</p>}
    </div>
  );
}

// Renders one evaluation section's content as real typography: bulleted
// lines as a list, a real <table> for any Markdown pipe table (same
// extraction/legacy-normalization the PDF/DOCX export already uses — see
// ad-evaluation-document.ts — so the on-screen report and the downloaded
// document never disagree), plain lines as paragraphs. Never a raw
// "| Metrik | Değer |" string.
function SectionBlocks({ content, createdAt }: { content: string; createdAt: string | null }) {
  const blocks: ContentBlock[] = parseMarkdownBlocks(content).flatMap((block) => (block.table ? normalizeLegacyTableBlock(block.table, createdAt) : [block]));
  return (
    <div className="grid gap-3">
      {blocks.map((block, index) => {
        if (block.table) return <MarkdownTable key={index} table={block.table} />;
        const lines = (block.text || "").split(/\r?\n/).filter((line) => line.trim());
        const isBulletBlock = lines.length > 0 && lines.every((line) => /^\s*[-*•✓☐]\s+/.test(line));
        if (isBulletBlock) {
          return (
            <ul key={index} className="grid gap-1.5 pl-1">
              {lines.map((line, lineIndex) => (
                <li key={lineIndex} className="flex gap-2 text-sm leading-6" style={{ color: "var(--admin-text-secondary)" }}>
                  <span className="mt-2 size-1.5 shrink-0 rounded-full" style={{ background: "var(--admin-text-muted)" }} aria-hidden />
                  {line.replace(/^\s*[-*•✓☐]\s+/, "").replace(/\*\*/g, "")}
                </li>
              ))}
            </ul>
          );
        }
        return <p key={index} className="whitespace-pre-line text-sm leading-7" style={{ color: "var(--admin-text-secondary)" }}>{(block.text || "").replace(/\*\*/g, "")}</p>;
      })}
    </div>
  );
}

function MarkdownTable({ table }: { table: DocumentTable }) {
  return (
    <div className="overflow-x-auto rounded-[12px] border" style={{ borderColor: "var(--admin-border)" }}>
      <table className="w-full min-w-[420px] border-collapse text-sm">
        <thead>
          <tr style={{ background: "var(--admin-surface-soft)" }}>
            {table.headers.map((header, index) => (
              <th key={index} className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={rowIndex} style={{ borderTop: "1px solid var(--admin-border)" }}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-3 py-2.5 align-top font-semibold" style={{ color: "var(--admin-text-primary)" }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReportView({ report, createdAt }: { report: ReportText; createdAt: string | null }) {
  if (!report?.sections?.length && !report?.executiveSummary) return <EmptyNote title="Henüz rapor yok." description="Bu değerlendirme için henüz içe aktarılmış bir rapor bulunmuyor." />;
  return (
    <div className="grid gap-4">
      {report.executiveSummary && (
        <div className="rounded-[12px] border p-4" style={{ borderColor: "#a5f3fc", background: "var(--admin-surface-soft)" }}>
          <p className="text-xs font-black uppercase tracking-wide" style={{ color: "#0e7490" }}>Yönetici Özeti</p>
          <p className="mt-1.5 text-sm leading-7" style={{ color: "var(--admin-text-primary)" }}>{report.executiveSummary}</p>
        </div>
      )}
      {(report.sections || []).map((section, index) => (
        <div key={index} className="rounded-[12px] border p-4" style={{ borderColor: "var(--admin-border)" }}>
          <p className="text-xs font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>{section.title}</p>
          <div className="mt-2">
            <SectionBlocks content={section.content} createdAt={createdAt} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Compact "PDF ▾ / Word ▾" export menu, scoped to one evaluation id so a
// history row's button can never download a different report's file.
function ExportMenu({
  label, icon, evaluationId, busyKey, onExport
}: {
  label: string; icon: React.ReactNode; evaluationId: string; busyKey: string | null;
  onExport: (evaluationId: string, mode: "client" | "internal", format: "pdf" | "docx") => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const format = label === "PDF" ? "pdf" : "docx";
  useEffect(() => {
    if (!open) return;
    function onClick(event: MouseEvent) { if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-[8px] border px-3 text-xs font-black transition"
        style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)", color: "var(--admin-text-primary)" }}
      >
        {icon}{label}<ChevronDown size={13} aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-20 mt-1.5 w-40 overflow-hidden rounded-[10px] border shadow-lg" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }}>
          {([["internal", "Dahili"], ["client", "Müşteri"]] as const).map(([mode, modeLabel]) => {
            const key = `${evaluationId}-${mode}-${format}`;
            return (
              <button
                key={mode}
                type="button"
                role="menuitem"
                disabled={busyKey === key}
                onClick={() => { onExport(evaluationId, mode, format); setOpen(false); }}
                className="block w-full px-3 py-2.5 text-left text-xs font-bold transition hover:bg-[var(--admin-surface-soft)] disabled:opacity-50"
                style={{ color: "var(--admin-text-primary)" }}
              >
                {busyKey === key ? "Hazırlanıyor…" : `${modeLabel} ${label}`}
              </button>
            );
          })}
        </div>
      )}
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
  const [openEvaluation, setOpenEvaluation] = useState<Evaluation | null>(null);

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
    const key = `${evaluationId}-${mode}-${format}`;
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

  function campaignLabel(item: Evaluation) {
    return campaigns.find((c) => c.id === item.campaign_id)?.name || item.meta_campaign_id || "Kampanya adı yok";
  }

  if (!companyId) return <EmptyNote title="Önce bir müşteri seçin." description="Değerlendirme hazırlamak ve geçmişi görmek için sol panelden bir müşteri seçin." />;

  return (
    <div className="grid gap-4">
      {error && <div className="rounded-[10px] border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}

      <Card>
        <p className="mb-3 text-sm font-black" style={{ color: "var(--admin-text-primary)" }}>Değerlendirme Kontrolü</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1.5 text-xs font-bold" style={{ color: "var(--admin-text-secondary)" }}>
            Kampanya
            <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className="min-h-10 rounded-[8px] border px-3 text-sm" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)", color: "var(--admin-text-primary)" }}>
              <option value="">Kampanya seçin</option>
              {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name} {c.meta_campaign_id ? "(Meta)" : ""}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-bold" style={{ color: "var(--admin-text-secondary)" }}>
            Değerlendirme Dönemi
            <select value={rangePreset} onChange={(e) => setRangePreset(e.target.value as typeof rangePreset)} className="min-h-10 rounded-[8px] border px-3 text-sm" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)", color: "var(--admin-text-primary)" }}>
              <option value="today">Bugün</option>
              <option value="last_7d">Son 7 Gün</option>
              <option value="last_30d">Son 30 Gün</option>
            </select>
          </label>
          <div className="flex items-end">
            <AdminButton variant="secondary" compact icon={<RefreshCw size={14} />} loading={contextLoading} onClick={loadContext}>Verileri Yenile</AdminButton>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 border-t pt-4" style={{ borderColor: "var(--admin-border)" }}>
          <AdminButton variant="primary" loading={preparing} onClick={prepareEvaluation}>Değerlendirme Hazırla</AdminButton>
          <AdminButton variant="ghost" icon={<Copy size={14} />} disabled={!prompt} onClick={copyPrompt}>{copied ? "Kopyalandı ✓" : "Promptu Kopyala"}</AdminButton>
        </div>
        {prompt && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-black" style={{ color: "var(--admin-text-muted)" }}>Prompt önizleme</summary>
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-[8px] bg-slate-50 p-3 text-xs" style={{ color: "var(--admin-text-primary)" }}>{prompt}</pre>
          </details>
        )}
      </Card>

      {current && (
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-black" style={{ color: "var(--admin-text-primary)" }}>Mevcut Değerlendirme — v{current.id.slice(0, 8)}</p>
            <div className="flex items-center gap-2">
              <AdminStatusBadge tone={STATUS_TONE[current.status]}>{STATUS_LABELS[current.status]}</AdminStatusBadge>
              {current.decision && <AdminStatusBadge tone="info">{DECISION_LABELS[current.decision] || current.decision}</AdminStatusBadge>}
            </div>
          </div>

          {current.status === "draft" && (
            <div className="grid gap-2">
              <label className="grid gap-1.5 text-sm font-bold" style={{ color: "var(--admin-text-secondary)" }}>
                Claude Sonucunu İçe Aktar
                <textarea value={rawResponse} onChange={(e) => setRawResponse(e.target.value)} rows={8} placeholder="Claude Reklam Değerlendirme Project'inden aldığınız tam çıktıyı buraya yapıştırın." className="rounded-[10px] border px-3 py-2 text-sm" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)", color: "var(--admin-text-primary)" }} />
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
              {current.client_report?.executiveSummary && (
                <p className="line-clamp-2 text-sm leading-6" style={{ color: "var(--admin-text-secondary)" }}>{current.client_report.executiveSummary}</p>
              )}
              {current.next_review_at && <p className="mt-2 text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>Sonraki kontrol: {new Date(current.next_review_at).toLocaleDateString("tr-TR")} {current.next_review_note ? `— ${current.next_review_note}` : ""}</p>}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <AdminButton variant="primary" compact icon={<FileText size={14} />} onClick={() => { setViewTab("client"); setOpenEvaluation(current); }}>Raporu Aç</AdminButton>
                <ExportMenu label="PDF" icon={<Download size={13} />} evaluationId={current.id} busyKey={exportBusy} onExport={exportDocument} />
                <ExportMenu label="Word" icon={<Download size={13} />} evaluationId={current.id} busyKey={exportBusy} onExport={exportDocument} />
              </div>
            </>
          )}
        </Card>
      )}

      <Card>
        <p className="mb-3 text-sm font-black" style={{ color: "var(--admin-text-primary)" }}>Değerlendirme Geçmişi</p>
        {!history.length && <EmptyNote title="Henüz değerlendirme kaydı yok." description="Bir değerlendirme hazırlayıp Claude sonucunu içe aktardığınızda burada listelenir." />}
        <div className="grid gap-3">
          {history.map((item, index) => (
            <div key={item.id} className="rounded-[12px] border p-4" style={{ borderColor: "var(--admin-border)" }}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-black" style={{ color: "var(--admin-text-primary)" }}>{formatReportTimestamp(item.created_at)}</p>
                  <p className="mt-0.5 truncate text-xs font-bold" style={{ color: "var(--admin-text-secondary)" }}>{campaignLabel(item)}</p>
                  <p className="mt-0.5 text-xs font-semibold" style={{ color: "var(--admin-text-muted)" }}>{item.evaluation_period_start || "-"} → {item.evaluation_period_end || "-"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {index === 0 && (
                    <span className="rounded-full px-2.5 py-1 text-[11px] font-black" style={{ background: "#0891b2", color: "#fff" }}>En Son Rapor</span>
                  )}
                  <AdminStatusBadge tone={STATUS_TONE[item.status]}>{STATUS_LABELS[item.status]}</AdminStatusBadge>
                  {item.decision && <AdminStatusBadge tone="info">{DECISION_LABELS[item.decision] || item.decision}</AdminStatusBadge>}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3" style={{ borderColor: "var(--admin-border)" }}>
                <AdminButton
                  variant="secondary" compact icon={<FileText size={13} />} disabled={item.status !== "evaluated"}
                  onClick={() => { setViewTab("client"); setOpenEvaluation(item); }}
                >
                  Aç
                </AdminButton>
                {item.status === "evaluated" && (
                  <>
                    <ExportMenu label="PDF" icon={<Download size={13} />} evaluationId={item.id} busyKey={exportBusy} onExport={exportDocument} />
                    <ExportMenu label="Word" icon={<Download size={13} />} evaluationId={item.id} busyKey={exportBusy} onExport={exportDocument} />
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {openEvaluation && (
        <div className="fixed inset-0 z-[90] flex justify-end bg-black/40" onMouseDown={() => setOpenEvaluation(null)}>
          <aside role="dialog" aria-modal="true" aria-labelledby="ad-eval-title" className="flex h-full w-full max-w-[min(760px,100vw)] flex-col overflow-hidden shadow-2xl" style={{ background: "var(--admin-surface)" }} onMouseDown={(e) => e.stopPropagation()}>
            <header className="flex items-start justify-between gap-4 border-b p-5" style={{ borderColor: "var(--admin-border)" }}>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>Reklam Değerlendirme Raporu</p>
                <h3 id="ad-eval-title" className="mt-1 truncate text-lg font-black" style={{ color: "var(--admin-text-primary)" }}>{campaignLabel(openEvaluation)}</h3>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <AdminStatusBadge tone={STATUS_TONE[openEvaluation.status]}>{STATUS_LABELS[openEvaluation.status]}</AdminStatusBadge>
                  {openEvaluation.decision && <AdminStatusBadge tone="info">{DECISION_LABELS[openEvaluation.decision] || openEvaluation.decision}</AdminStatusBadge>}
                  <span className="text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>{openEvaluation.evaluation_period_start || "-"} → {openEvaluation.evaluation_period_end || "-"}</span>
                </div>
              </div>
              <button type="button" onClick={() => setOpenEvaluation(null)} aria-label="Kapat" autoFocus className="grid size-10 shrink-0 place-items-center rounded-[10px] border" style={{ borderColor: "var(--admin-border)" }}>
                <X size={16} aria-hidden />
              </button>
            </header>

            <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4" style={{ borderColor: "var(--admin-border)" }}>
              <div className="flex gap-2">
                <button type="button" onClick={() => setViewTab("client")} className="rounded-full px-3.5 py-1.5 text-xs font-black transition" style={viewTab === "client" ? { background: "#0891b2", color: "#fff" } : { background: "var(--admin-surface-soft)", color: "var(--admin-text-secondary)" }}>Müşteri Raporu</button>
                <button type="button" onClick={() => setViewTab("internal")} className="rounded-full px-3.5 py-1.5 text-xs font-black transition" style={viewTab === "internal" ? { background: "#0891b2", color: "#fff" } : { background: "var(--admin-surface-soft)", color: "var(--admin-text-secondary)" }}>Dahili Rapor</button>
              </div>
              <div className="flex items-center gap-2">
                <ExportMenu label="PDF" icon={<Download size={13} />} evaluationId={openEvaluation.id} busyKey={exportBusy} onExport={exportDocument} />
                <ExportMenu label="Word" icon={<Download size={13} />} evaluationId={openEvaluation.id} busyKey={exportBusy} onExport={exportDocument} />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <ReportView report={viewTab === "client" ? openEvaluation.client_report : openEvaluation.internal_report} createdAt={openEvaluation.created_at} />
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
