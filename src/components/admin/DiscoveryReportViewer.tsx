"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, Loader2, RefreshCw, X } from "lucide-react";
import Link from "next/link";

export type DiscoveryReportSection = {
  title: string;
  items: string[];
};

export type DiscoveryReportRecord = {
  id: string;
  title?: string | null;
  report_type?: string | null;
  source_identifier?: string | null;
  business_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  content?: {
    summary?: string;
    sections?: DiscoveryReportSection[];
  } | null;
  metadata?: {
    provider_label?: string;
    model?: string;
    provider_notice?: string | null;
    report_kind?: string;
  } | null;
};

function reportText(report: DiscoveryReportRecord) {
  const sections = report.content?.sections || [];
  return [
    report.title || report.report_type || "Keşif Raporu",
    report.content?.summary || "",
    ...sections.flatMap((section) => [section.title, ...section.items.map((item) => `- ${item}`)])
  ].filter(Boolean).join("\n\n");
}

export function DiscoveryReportViewer({
  report,
  onClose,
  onRegenerate,
  regenerating = false
}: {
  report: DiscoveryReportRecord;
  onClose: () => void;
  onRegenerate?: () => void;
  regenerating?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const sections = report.content?.sections || [];

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(reportText(report));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[11000] grid place-items-center bg-slate-950/75 p-3 sm:p-6" role="presentation" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="discovery-report-title"
        className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-[18px] border border-slate-200 bg-white text-slate-950 shadow-2xl sm:max-h-[calc(100dvh-3rem)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">{report.report_type || "Keşif Raporu"}</p>
            <h2 id="discovery-report-title" className="mt-2 break-words text-xl font-black sm:text-2xl">{report.title || "Keşif Raporu"}</h2>
            <p className="mt-2 text-sm text-slate-500">
              {report.business_name || "İşletme"} · {report.updated_at || report.created_at ? new Date(report.updated_at || report.created_at || "").toLocaleString("tr-TR") : "Tarih bulunamadı"}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Rapor önizlemesini kapat" className="grid size-11 shrink-0 place-items-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-100">
            <X size={19} />
          </button>
        </header>

        <div className="premium-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-5 sm:px-6">
          {report.content?.summary && <p className="rounded-[14px] border border-cyan-200 bg-cyan-50 p-4 text-sm font-semibold leading-7 text-cyan-950">{report.content.summary}</p>}
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {sections.map((section) => (
              <article key={section.title} className="min-w-0 rounded-[14px] border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-base font-black text-slate-950">{section.title}</h3>
                <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate-700">
                  {section.items.map((item, index) => <li key={`${section.title}-${index}`} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-cyan-500" /> <span className="min-w-0 break-words">{item}</span></li>)}
                </ul>
              </article>
            ))}
          </div>
          {!sections.length && <p className="rounded-[14px] border border-dashed border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">Rapor içeriği bulunamadı. Raporu yeniden oluşturmayı deneyin.</p>}
          {report.metadata?.provider_label && (
            <p className="mt-5 text-xs leading-5 text-slate-500">
              Analiz motoru: {report.metadata.provider_label}{report.metadata.model ? ` · ${report.metadata.model}` : ""}{report.metadata.provider_notice ? ` · ${report.metadata.provider_notice}` : ""}
            </p>
          )}
        </div>

        <footer className="flex shrink-0 flex-col gap-2 border-t border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
          <button type="button" onClick={copyReport} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[12px] border border-slate-300 px-4 text-sm font-black text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-100">
            {copied ? <Check size={17} /> : <Copy size={17} />} {copied ? "Kopyalandı" : "Kopyala"}
          </button>
          <Link href="/hk-admin/raporlar?reportTab=discovery" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[12px] border border-cyan-200 bg-cyan-50 px-4 text-sm font-black text-cyan-800">
            <ExternalLink size={17} /> Rapor Merkezi’ne Git
          </Link>
          {onRegenerate && <button type="button" onClick={onRegenerate} disabled={regenerating} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[12px] bg-cyan-600 px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60">
            {regenerating ? <Loader2 className="animate-spin" size={17} /> : <RefreshCw size={17} />} {regenerating ? "Yeniden oluşturuluyor..." : "Yeniden Oluştur"}
          </button>}
        </footer>
      </section>
    </div>
  );
}
