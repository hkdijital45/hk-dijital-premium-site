// Canonical "report creation timestamp" display formatter — ONE shared
// helper for Rapor Merkezi (ReportCenterPanel.tsx), Reklam Doktoru Pro
// (AdEvaluationPanel.tsx), and the PDF/DOCX renderer
// (ad-evaluation-document.ts), so a report's displayed time never
// drifts between the admin UI and its exported files. Deliberately
// framework-agnostic (no "use client"/"server-only") so every one of
// those three call sites can import it directly.
//
// Always Europe/Istanbul via an explicit Intl.DateTimeFormat timeZone —
// never the server process's or the viewer's browser's own local
// timezone (same explicit-timeZone pattern already established by
// analytics-time.ts's istanbulDateString for date-only values) — so
// output is deterministic regardless of where this code runs.
export function formatReportTimestamp(value: string | Date | null | undefined): string {
  if (!value) return "Tarih bilgisi yok";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "Tarih bilgisi yok";
  const datePart = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
  const timePart = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  return `${datePart} ${timePart}`;
}

/** Sorts report-like items newest-first by a canonical creation
 * timestamp field, treating a missing/invalid timestamp as oldest
 * (never crashes, never throws) — shared by Rapor Merkezi and Reklam
 * Doktoru Pro's evaluation history so "newest first" is one proven
 * comparator, not two independently-written sorts. */
export function compareByTimestampDesc(a: string | null | undefined, b: string | null | undefined): number {
  const toTime = (v: string | null | undefined) => {
    if (!v) return -Infinity;
    const t = new Date(v).getTime();
    return Number.isNaN(t) ? -Infinity : t;
  };
  return toTime(b) - toTime(a);
}
