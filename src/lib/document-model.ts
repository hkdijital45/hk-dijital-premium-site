// Client-safe document model — the shared report/table/link types plus a
// couple of pure helpers, split out of src/lib/server/document-generator.ts
// (which is "server-only": real fs/pdf-lib/docx work) specifically so a
// client component or a client-importable module (e.g. AdEvaluationPanel's
// on-screen report viewer, ad-evaluation-markdown.ts) can read/render a
// DocumentTable's cells without ever pulling the server-only PDF/DOCX
// generator into the browser bundle. document-generator.ts re-exports
// everything here, so existing importers of it are unaffected.

export type DocumentLink = { label: string; url: string };
export type DocumentCell = string | DocumentLink;
export type DocumentTable = { headers: string[]; rows: DocumentCell[][] };

// Premium Report System V3 additions — every field below is OPTIONAL, so a
// payload built before V3 renders unchanged in content (only the visual
// design is upgraded). Values are always pre-formatted by the builder from
// real stored data; the renderer never invents a number.
export type DocumentTone = "neutral" | "positive" | "negative" | "accent" | "warning";
export type DocumentMetric = { label: string; value: string; note?: string; tone?: DocumentTone };
export type DocumentChart = {
  type: "bar" | "hbar" | "line" | "donut";
  title: string;
  data: Array<{ label: string; value: number | null }>;
  /** How values are printed (Turkish formatting): 1.250,50 TL / %12,5 / 1.250 */
  valueFormat?: "number" | "currency" | "percent";
  /** One or two sentences: what the chart shows and why it matters. */
  caption?: string;
};
export type DocumentCallout = { title?: string; text: string; tone?: DocumentTone };
export type DocumentTimelinePhase = { label: string; items: string[] };

export type DocumentSection = {
  title: string; items?: string[]; text?: string; table?: DocumentTable;
  titleSize?: number;
  spacingBefore?: number;
  minSpaceBefore?: number;
  /** Short muted lead-in shown under the heading ("Bu bölümde ne inceledik?"). */
  intro?: string;
  metrics?: DocumentMetric[];
  charts?: DocumentChart[];
  callout?: DocumentCallout;
  timeline?: DocumentTimelinePhase[];
  /** 2 = subsection (no number, smaller heading). Inferred for "X — Y" / "(devam)" titles when omitted. */
  level?: 1 | 2;
  pageBreakBefore?: boolean;
};

/** A client logo that has ALREADY been verified and normalized server-side
 * (PNG bytes + intrinsic size). Never a URL: the renderer does no fetching. */
export type DocumentLogo = { png: Uint8Array; width: number; height: number; name?: string };

export type DocumentPayload = {
  title: string;
  customerName: string;
  period: string;
  executiveSummary: string;
  sections: DocumentSection[];
  footerNote?: string;
  logo?: boolean;
  confidentialLabel?: string;
  metaLines?: string[];
  /** Verified client logo for the dual-logo cover; omitted/null -> HK Dijital logo alone. */
  clientLogo?: DocumentLogo | null;
  /** KPI cards shown right after the executive summary. */
  headlineMetrics?: DocumentMetric[];
};

export function isDocumentLink(cell: DocumentCell): cell is DocumentLink {
  return typeof cell === "object" && cell !== null && "url" in cell;
}

/** The plain display text for a cell, whether it's a raw string or a
 * DocumentLink (its visible label) — for any caller that only needs to
 * read/render the text, never the link target. */
export function cellLabel(cell: DocumentCell): string {
  return isDocumentLink(cell) ? cell.label : cell;
}
