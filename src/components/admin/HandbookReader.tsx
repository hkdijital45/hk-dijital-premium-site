"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { downloadHandbookPdf } from "@/components/admin/handbook-pdf-download";

type Chapter = { number: string; title: string; id: string; html: string };
type Meta = { edition: string; publishedLabel: string; chapterCount: number; screenshotCount: number };

// Native, full-screen "El Kitabı" reader mounted inside SystemGuideCenter —
// this app's whole HK Admin surface is one dashboard shell switching what
// it renders rather than separate routed pages (see
// src/app/hk-admin/[module]/page.tsx), so the handbook reader follows that
// same "view inside the shell" pattern instead of introducing a standalone
// route that would lose the shared header/nav chrome.
export function HandbookReader({ onClose }: { onClose: () => void }) {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [activeId, setActiveId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mobileTocOpen, setMobileTocOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/system-guide/el-kitabi", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        if (!data.chapters) { setError(data.error || "El kitabı yüklenemedi."); return; }
        setChapters(data.chapters);
        setMeta(data.meta);
        setActiveId(data.chapters[0]?.id || "");
      })
      .catch(() => { if (!cancelled) setError("El kitabı yüklenemedi."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const active = chapters.find((chapter) => chapter.id === activeId) || chapters[0];

  return (
    // Deliberately NOT `.fixed.inset-0` — a global rule (globals.css) forces
    // that exact class combination inside .hk-admin into a translucent
    // modal-backdrop scrim (`background: rgba(...) !important`), meant for
    // the existing "backdrop + floating card" overlays elsewhere in this
    // file. This reader is a full-bleed opaque page, not a backdrop, so it
    // uses the same fixed-to-all-four-edges layout via individual side
    // utilities instead, which that selector doesn't match.
    <div className="fixed top-0 right-0 bottom-0 left-0 z-[120] flex flex-col" style={{ background: "var(--admin-surface)" }}>
      <style>{`
        .hk-handbook-body h1{font-size:1.5rem;font-weight:900;margin:1.4rem 0 .6rem}
        .hk-handbook-body h2{font-size:1.2rem;font-weight:900;margin:1.2rem 0 .5rem;color:var(--admin-text-primary)}
        .hk-handbook-body h3{font-size:1.05rem;font-weight:800;margin:1rem 0 .4rem;color:var(--admin-text-primary)}
        .hk-handbook-body p{margin:.55rem 0;line-height:1.7;color:var(--admin-text-secondary)}
        .hk-handbook-body ul,.hk-handbook-body ol{margin:.5rem 0 .8rem 1.3rem;line-height:1.7;color:var(--admin-text-secondary)}
        .hk-handbook-body li{margin:.25rem 0}
        .hk-handbook-body table{width:100%;border-collapse:collapse;margin:.8rem 0;font-size:.85rem}
        .hk-handbook-body th,.hk-handbook-body td{border:1px solid var(--admin-border);padding:.5rem .6rem;text-align:left;vertical-align:top}
        .hk-handbook-body th{background:var(--admin-surface-soft);font-weight:800}
        .hk-handbook-body blockquote{border-left:3px solid #f59e0b;padding-left:.8rem;margin:.6rem 0;color:var(--admin-text-secondary)}
        .hk-callout{border-radius:14px;border:1px solid var(--admin-border);background:var(--admin-surface-soft);padding:.9rem 1rem;margin:.9rem 0}
        .hk-callout-label{font-weight:900;font-size:.8rem;margin:0 0 .35rem;color:var(--admin-text-primary)}
        .hk-callout-dikkat{background:#fff7ed;border-color:#fed7aa}
        .hk-callout-ai-notu,.hk-callout-ai-yorumu{background:#eff6ff;border-color:#bfdbfe}
        .hk-callout-hk-i-pucu,.hk-callout-satis-i-pucu,.hk-callout-operasyon-i-pucu{background:#ecfeff;border-color:#a5f3fc}
        .hk-figure{margin:.9rem 0;border-radius:14px;overflow:hidden;border:1px solid var(--admin-border)}
        .hk-figure img{display:block;width:100%;height:auto}
        .hk-figure figcaption{padding:.5rem .8rem;font-size:.75rem;font-weight:800;color:var(--admin-text-muted);background:var(--admin-surface-soft)}
        .hk-figure-pending{border:1px dashed var(--admin-border);border-radius:12px;padding:.8rem;font-size:.85rem;color:var(--admin-text-muted)}
      `}</style>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border)] px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[.14em] text-amber-600">Sistem Rehberi</p>
          <h2 className="truncate text-xl font-black text-[var(--admin-text-primary)]">HK Admin El Kitabı</h2>
          {meta && <p className="text-xs text-[var(--admin-text-muted)]">{meta.edition} · {meta.publishedLabel} · {meta.chapterCount} bölüm</p>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMobileTocOpen((v) => !v)} className="rounded-[10px] border border-[var(--admin-border)] px-3 py-2 text-xs font-black text-[var(--admin-text-secondary)] md:hidden">İçindekiler</button>
          <button disabled={pdfBusy} onClick={() => downloadHandbookPdf(setPdfBusy)} className="inline-flex items-center gap-2 rounded-[10px] bg-amber-500 px-3 py-2 text-xs font-black text-white disabled:opacity-60"><Download size={14} /> {pdfBusy ? "Hazırlanıyor..." : "PDF İndir"}</button>
          <button onClick={onClose} aria-label="Kapat" className="grid size-9 place-items-center rounded-full border border-[var(--admin-border)]"><X size={16} /></button>
        </div>
      </header>

      {loading && <p className="p-8 text-sm text-[var(--admin-text-muted)]">El kitabı yükleniyor...</p>}
      {error && <p className="p-8 text-sm font-bold text-red-600">{error}</p>}

      {!loading && !error && (
        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)]">
          <nav className={`${mobileTocOpen ? "block" : "hidden"} overflow-y-auto border-b border-[var(--admin-border)] bg-[var(--admin-surface-soft)] p-3 md:block md:border-b-0 md:border-r`}>
            {chapters.map((chapter) => (
              <button
                key={chapter.id}
                onClick={() => { setActiveId(chapter.id); setMobileTocOpen(false); }}
                className={`block w-full rounded-[10px] px-3 py-2 text-left text-xs font-bold leading-5 ${chapter.id === activeId ? "bg-amber-500 text-white" : "text-[var(--admin-text-secondary)] hover:bg-[var(--admin-surface)]"}`}
              >
                {chapter.number !== "0" ? `${chapter.number}. ` : ""}{chapter.title}
              </button>
            ))}
          </nav>
          <div className="min-w-0 overflow-y-auto p-5 sm:p-8">
            <article className="hk-handbook-body mx-auto max-w-3xl" dangerouslySetInnerHTML={{ __html: active?.html || "" }} />
          </div>
        </div>
      )}
    </div>
  );
}
