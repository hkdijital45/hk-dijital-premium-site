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
export type DocumentSection = {
  title: string; items?: string[]; text?: string; table?: DocumentTable;
  titleSize?: number;
  spacingBefore?: number;
  minSpaceBefore?: number;
};
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
