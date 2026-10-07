// Pure Markdown/table parsing for one evaluation section's raw Claude
// content — deliberately isolated from ad-evaluation-document.ts (which
// pulls in server-only DB/report-record types through "./ad-evaluations")
// so this module can be imported by a CLIENT component (AdEvaluationPanel's
// on-screen report viewer) without dragging server-only code into the
// browser bundle. ad-evaluation-document.ts (PDF/DOCX export) re-uses these
// exact same functions, so the on-screen report and the downloaded document
// are always built from one parser, never two that can drift apart.
import { formatReportTimestamp } from "@/lib/report-timestamp";
import type { DocumentTable } from "@/lib/server/document-generator";

export type { DocumentTable };
export type ContentBlock = { text?: string; table?: DocumentTable };

// A Markdown table separator row: |---|---|, | :--- | ---: |, etc.
function isMarkdownTableSeparatorRow(line: string): boolean {
  return /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)+\|?\s*$/.test(line);
}

function splitMarkdownRow(line: string): string[] {
  let trimmed = line.trim();
  if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
  if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);
  return trimmed.split("|").map((cell) => cell.trim().replace(/\*\*/g, ""));
}

/** Splits one section's raw Claude markdown content into an ordered list
 * of plain-text blocks and real Markdown tables — a literal
 * "| Metrik | ... |" / "|---|---|" string must NEVER reach the reader as
 * text. Claude's evaluation prompt (ad-evaluation-prompt.ts) requires a
 * pipe-table for Ana Metrikler/Reklam Seti/Kreatif/Strateji sections;
 * this recognizes any such table anywhere in a section's content (a
 * header row immediately followed by a separator row) and extracts it as
 * a real DocumentTable. A section can contain more than one table (e.g.
 * a wide creative table deliberately split in two) — each is extracted
 * in order. */
export function parseMarkdownBlocks(content: string): ContentBlock[] {
  const lines = content.split(/\r?\n/);
  const blocks: ContentBlock[] = [];
  let buffer: string[] = [];
  const flushText = () => {
    const text = buffer.join("\n").trim();
    if (text) blocks.push({ text });
    buffer = [];
  };
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const next = lines[i + 1];
    if (line.includes("|") && next !== undefined && isMarkdownTableSeparatorRow(next)) {
      flushText();
      const headers = splitMarkdownRow(line);
      let j = i + 2;
      const rows: string[][] = [];
      while (j < lines.length && lines[j].includes("|") && lines[j].trim()) {
        rows.push(splitMarkdownRow(lines[j]));
        j++;
      }
      blocks.push({ table: { headers, rows } });
      i = j;
      continue;
    }
    buffer.push(line);
    i++;
  }
  flushText();
  return blocks;
}

// --- Legacy saved-report normalization (render-time only) ----------------
// Older saved evaluations (ad_evaluations.internal_report/client_report)
// were written by an earlier version of the evaluation prompt and their
// stored Markdown still contains structures this renderer no longer
// produces for new reports: a self-authored "Rapor Tarihi ve Saati"
// placeholder row (proven live leak), a 6-column Ana Metrikler table,
// and a single wide Kreatif/Reklam Analizi table. The stored row/report
// is NEVER mutated (no DB write happens here) — these transforms run
// only at render time, so old AND new saved reports always render in
// the CURRENT presentation shape without ever needing a resave/migration.
// Detection is structural (exact field-name cell / header signature),
// never a blind string replace — an already-current-format table
// (already 5 columns, already split into two tables) matches none of
// these signatures and passes through completely unchanged, so a new
// report is never double-transformed.

function fixReportTimestampRow(table: DocumentTable, createdAt: string | null | undefined): DocumentTable {
  const rows = table.rows.map((row) => {
    if ((row[0] || "").trim().toLocaleLowerCase("tr") !== "rapor tarihi ve saati") return row;
    const next = [...row];
    next[1] = formatReportTimestamp(createdAt);
    return next;
  });
  return { headers: table.headers, rows };
}

function isLegacyMetricsTable(table: DocumentTable): boolean {
  return table.headers.length === 6 && /mevcut değer/i.test(table.headers[1] || "") && /ne anlama gelir/i.test(table.headers[2] || "");
}

/** 6→5 columns: Metrik/Değer/Açıklama/Referans-Hedef/Durum — the old 6th
 * (evaluative-note) column's non-empty values are preserved verbatim as
 * footnote bullets immediately below the table rather than dropped. */
function normalizeLegacyMetricsTable(table: DocumentTable): { table: DocumentTable; footnotes: string[] } {
  const headers = ["Metrik", "Değer", "Açıklama", table.headers[3] || "Referans / Hedef", table.headers[4] || "Durum"];
  const rows = table.rows.map((row) => row.slice(0, 5));
  const footnotes = table.rows
    .map((row) => (row[0] || "").trim() && (row[5] || "").trim() ? `${row[0].trim()}: ${row[5].trim()}` : null)
    .filter((n): n is string => Boolean(n));
  return { table: { headers, rows }, footnotes };
}

function isLegacyCreativeTable(table: DocumentTable): boolean {
  const h = table.headers.map((x) => (x || "").trim());
  return (
    h.length === 11 &&
    /^reklam$/i.test(h[0]) &&
    /harcama pay/i.test(h[2]) &&
    /bağlantı tık/i.test(h[4]) &&
    /bağlantı ctr/i.test(h[5]) &&
    /bağlantı cpc/i.test(h[6]) &&
    /tüm tık/i.test(h[7]) &&
    /^sonuç$/i.test(h[8]) &&
    /sonuç başı maliyet/i.test(h[9]) &&
    /durum/i.test(h[10])
  );
}

/** One legacy 11-column Reklam/Kreatif table -> TESLİMAT + PERFORMANS —
 * the exact same split the current prompt already asks Claude to author
 * directly for new reports: same source values routed into whichever of
 * the two tables each column already belongs to, no new calculation, no
 * data loss. */
function splitLegacyCreativeTable(table: DocumentTable): [DocumentTable, DocumentTable] {
  const pick = (indices: number[]) => table.rows.map((row) => indices.map((i) => row[i] ?? ""));
  return [
    { headers: ["Reklam", "Harcama", "Harcama Payı", "Gösterim", "Bağlantı Tıklaması"], rows: pick([0, 1, 2, 3, 4]) },
    { headers: ["Reklam", "Bağlantı CTR", "Bağlantı CPC", "Tüm Tıklamalar", "Sonuç", "Sonuç Başı Maliyet", "Durum"], rows: pick([0, 5, 6, 7, 8, 9, 10]) }
  ];
}

/** Expands one parsed table block into one-or-more normalized blocks.
 * The timestamp-row fix applies to every table (cheap, narrowly scoped
 * to the exact field-name cell); the Ana Metrikler / creative reshaping
 * only fires when a table's header signature exactly matches the known
 * legacy shape. */
export function normalizeLegacyTableBlock(table: DocumentTable, createdAt: string | null | undefined): ContentBlock[] {
  const fixed = fixReportTimestampRow(table, createdAt);
  if (isLegacyMetricsTable(fixed)) {
    const { table: normalized, footnotes } = normalizeLegacyMetricsTable(fixed);
    const blocks: ContentBlock[] = [{ table: normalized }];
    if (footnotes.length) blocks.push({ text: footnotes.map((f) => `Not: ${f}`).join("\n") });
    return blocks;
  }
  if (isLegacyCreativeTable(fixed)) {
    const [deliveryTable, performanceTable] = splitLegacyCreativeTable(fixed);
    return [{ table: deliveryTable }, { table: performanceTable }];
  }
  return [{ table: fixed }];
}
