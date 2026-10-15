import "server-only";

import { withAutomaticCharts } from "@/lib/report-auto-charts";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { rgb } from "pdf-lib";
import { Document, Packer, Paragraph, HeadingLevel, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, AlignmentType, ExternalHyperlink, VerticalAlign } from "docx";
import PptxGenJS from "pptxgenjs";
import type { ProfessionalReportPayload } from "@/lib/report-export";
import { isDocumentLink } from "@/lib/document-model";
import type { DocumentLink, DocumentCell, DocumentTable, DocumentSection, DocumentPayload, DocumentMetric, DocumentChart, DocumentCallout, DocumentTimelinePhase, DocumentLogo, DocumentTone } from "@/lib/document-model";
import { renderPremiumPdf } from "@/lib/server/premium-pdf";
import { formatChartValue, sanitizeChartData } from "@/lib/report-design";

// Canonical document generation service — the single place every real
// Word/PDF/PowerPoint export in the app goes through, so there is one
// Turkish-character-safe, one HK Digital-styled implementation per format
// instead of five different generators drifting apart. Every format
// produces a REAL binary (a real .docx/.pdf/.pptx a real Word/Acrobat/
// PowerPoint can open), never an HTML file renamed with a .docx extension
// or a JSON blob renamed .pptx.
//
// Shares its input shape (ProfessionalReportPayload) with the existing
// print-ready-HTML generator (report-export.ts's buildPrintableHtmlReport)
// rather than defining a parallel one — one report payload contract for
// every export format (HTML-for-print, DOCX, PDF, PPTX) in the app.
//
// The report/table/link TYPES (and the two pure cell helpers) live in
// client-safe src/lib/document-model.ts, not here — this file is
// "server-only" (real fs/pdf-lib/docx work), so anything a client
// component needs to read (e.g. AdEvaluationPanel's on-screen table
// viewer) must never be defined in it. Re-exported below so every
// existing `from "@/lib/server/document-generator"` import of these
// types keeps working unchanged.
export type { DocumentLink, DocumentCell, DocumentTable, DocumentSection, DocumentPayload, DocumentMetric, DocumentChart, DocumentCallout, DocumentTimelinePhase, DocumentLogo, DocumentTone };

export function toDocumentPayload(report: ProfessionalReportPayload): DocumentPayload {
  return {
    title: report.title || "HK Dijital Raporu",
    customerName: report.customerName || "-",
    period: report.period || report.generatedAt || "-",
    executiveSummary: report.summary || "",
    sections: (report.sections || []).map((section) => ({
      title: section.title,
      items: section.items?.map((item) => String(item ?? "")),
      text: section.text
    }))
  };
}

// Geist (Vercel's own font, bundled for exactly this kind of generated-
// document use case) — verified to carry real glyphs for every Turkish
// character (ç Ç ğ Ğ ı I i İ ö Ö ş Ş ü Ü), unlike pdf-lib's built-in
// StandardFonts (WinAnsi-only, silently mangles Turkish characters).
export const GEIST_FONT_PATH = join(process.cwd(), "src", "assets", "fonts", "Geist-Regular.ttf");

// The one real, official HK Dijital logo asset in the repo (also used for
// the public site header/favicon source) — never regenerated, redrawn, or
// AI-produced; embedded as-is, aspect ratio preserved.
export const LOGO_PATH = join(process.cwd(), "public", "branding", "hk-dijital-logo.png");

export const HK_GOLD = rgb(0.749, 0.639, 0.243); // matches --hk-gold in globals.css
export const HK_INK = rgb(0.106, 0.114, 0.133); // matches --hk-text-primary (dark ink on light document pages)
export const HK_MUTED = rgb(0.373, 0.4, 0.447);
export const HK_BORDER = rgb(0.902, 0.894, 0.863);

// Reklam Değerlendirme's controlled status vocabulary (🟢 İyi / 🟡 İzle /
// 🔴 Aksiyon Gerekebilir / ⚪ Referans Yok / 🔵 Veri Yetersiz) rendered as
// a visible color, never color-only — the matched status TEXT (whatever
// Claude wrote, emoji or not) is always kept verbatim; this only adds a
// color accent on top. Order matters: the three multi-word phrases are
// checked before the single words they could otherwise be confused with
// inside ("İzle"/"İyi" never falsely match inside "Aksiyon Gerekebilir").
// No LEADING \b before "İ" (Turkish capital dotted I) — verified live,
// a leading \b immediately before "İ" never matches (same class of bug
// already fixed elsewhere in this app for the dotless "ı"), which
// silently skipped these two patterns entirely; a trailing \b alone is
// sufficient and safe here.
// Pre-audit/candidate-evaluation source-matrix vocabulary (Doğrulandı/
// Muhtemel/Kontrol edildi/Bulunamadı/Doğrulanamadı) — a second, independent
// status vocabulary from Reklam Değerlendirme's own, both recognized by
// the same Durum-column accent so neither report family needs its own
// color logic.
function statusColorHexFor(cellText: string): string | null {
  if (/Aksiyon Gerekebilir/i.test(cellText)) return "B43434";
  if (/Veri Yetersiz/i.test(cellText)) return "1A69B4";
  if (/Referans Yok/i.test(cellText)) return "74778A";
  if (/İzle\b/i.test(cellText)) return "B47A0C";
  if (/İyi\b/i.test(cellText)) return "168A48";
  if (/Doğrulandı/i.test(cellText)) return "168A48";
  if (/Kontrol edildi/i.test(cellText)) return "168A48";
  if (/Muhtemel/i.test(cellText)) return "B47A0C";
  if (/Doğrulanamadı/i.test(cellText)) return "74778A";
  if (/Bulunamadı/i.test(cellText)) return "74778A";
  return null;
}

function isStatusColumnHeader(header: string): boolean {
  return /^durum$/i.test(header.trim());
}

// Strips the leading status emoji (🟢🟡🔴⚪🔵) from a Durum cell before
// it is drawn — verified directly that Geist-Regular.ttf (the embedded
// PDF font) has no real glyph for any of these (same notdef-box advance
// width as a genuinely unmapped codepoint), so leaving them in would
// render a broken box glyph in the PDF. The colored dot already drawn
// alongside the cell (see drawRow/buildDocxTable) is the color signal;
// the status WORD itself (never removed) remains the always-present
// text signal — color is never the only indicator of meaning.
// Confirmed via direct glyph-coverage check of Geist-Regular.ttf: ✓ (U+2713)
// and ⚠ (U+26A0) have NO glyph either (same notdef-box issue as the emoji
// above) — a PDF text layer can still contain these characters (copy/paste
// extraction reads the encoded codepoints, not the rendered pixels), which
// is why this looked fine in extracted text while the actual glyph was
// broken on the page. "—" (U+2014) IS present in the font and renders fine.
function stripStatusEmoji(cellText: string): string {
  return cellText.replace(/^[\s]*[🟢🟡🔴⚪🔵✓⚠]+[\s]*/u, "").trim();
}

/** Every PDF in the app renders through the HK Dijital Premium Report
 * System (premium-pdf.ts): dual-logo cover, Inter typography, KPI cards,
 * charts, branded tables, page numbering. Same DocumentPayload contract as
 * before, so no report builder had to change to get the new design. */
export async function generatePdfBuffer(payload: DocumentPayload): Promise<Buffer> {
  // V3.2: validated charts from the report's own structured tables.
  return renderPremiumPdf(withAutomaticCharts(payload));
}

function buildDocxTable(table: DocumentTable): Table {
  const columnWidth = Math.floor(100 / Math.max(table.headers.length, 1));
  const statusColumnIndex = table.headers.findIndex(isStatusColumnHeader);
  const headerRow = new TableRow({
    children: table.headers.map((header) => new TableCell({
      width: { size: columnWidth, type: WidthType.PERCENTAGE },
      children: [new Paragraph({ children: [new TextRun({ text: header, bold: true })] })]
    }))
  });
  const bodyRows = table.rows.map((row) => new TableRow({
    children: row.map((cell, i) => {
      if (isDocumentLink(cell)) {
        // Real DOCX hyperlink relationship (ExternalHyperlink) — the full
        // `url` is the actual link target; `label` is the only visible
        // text, same split as the PDF renderer above.
        return new TableCell({
          width: { size: columnWidth, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new ExternalHyperlink({ link: cell.url, children: [new TextRun({ text: cell.label, style: "Hyperlink" })] })] })]
        });
      }
      // Status accent (section 17) — colored text, status text itself
      // always kept verbatim; never color alone.
      const statusHex = i === statusColumnIndex ? statusColorHexFor(cell) : null;
      return new TableCell({
        width: { size: columnWidth, type: WidthType.PERCENTAGE },
        children: [new Paragraph({ children: [new TextRun({ text: statusHex ? stripStatusEmoji(cell) : cell, color: statusHex || undefined, bold: Boolean(statusHex) })] })]
      });
    })
  }));
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, ...bodyRows] });
}

// Word counterparts of the Premium Report System blocks — the same real
// values the PDF shows, as plain tables/paragraphs (Word gets the data,
// not a picture of a chart).
function docxMetricsTable(metrics: DocumentMetric[]): Table {
  return buildDocxTable({ headers: ["Gösterge", "Değer", "Not"], rows: metrics.filter((m) => m.label && m.value).map((m) => [m.label, m.value, m.note || ""]) });
}

function docxChartBlocks(chart: DocumentChart): Array<Paragraph | Table> {
  const data = sanitizeChartData(chart.data, chart.type);
  if (!data) return [];
  const blocks: Array<Paragraph | Table> = [
    new Paragraph({ spacing: { before: 120, after: 60 }, children: [new TextRun({ text: chart.title, bold: true, color: "10243A" })] }),
    buildDocxTable({ headers: ["Kalem", "Değer"], rows: data.map((d) => [d.label, formatChartValue(d.value, chart.valueFormat || "number")]) })
  ];
  if (chart.caption) blocks.push(new Paragraph({ spacing: { before: 60, after: 120 }, children: [new TextRun({ text: chart.caption, italics: true, color: "5E6B78", size: 18 })] }));
  return blocks;
}

function docxCallout(callout: DocumentCallout): Paragraph[] {
  return [new Paragraph({
    spacing: { before: 120, after: 160 },
    shading: { fill: "EEF8F7" },
    children: [
      ...(callout.title ? [new TextRun({ text: `${callout.title} `, bold: true, color: "0B7B76" })] : []),
      new TextRun({ text: callout.text })
    ]
  })];
}

function docxTimeline(phases: DocumentTimelinePhase[]): Paragraph[] {
  return phases.flatMap((phase) => [
    new Paragraph({ spacing: { before: 100, after: 40 }, children: [new TextRun({ text: phase.label, bold: true, color: "10243A" })] }),
    ...phase.items.map((item) => new Paragraph({ text: item, bullet: { level: 0 }, spacing: { after: 40 } }))
  ]);
}

export async function generateDocxBuffer(payload: DocumentPayload): Promise<Buffer> {
  const children: Array<Paragraph | Table> = [];

  // Premium corporate letterhead — same charcoal-band-with-logo design as
  // the PDF renderer (via a shaded table row, docx's only way to fill a
  // cell's background), not a separate, drifting Word-only look.
  const HEADER_FILL = "1B1D22";
  const headerCells: TableCell[] = [];
  let logoEmbedded = false;
  if (payload.logo) {
    try {
      const logoBytes = readFileSync(LOGO_PATH);
      headerCells.push(new TableCell({
        width: { size: 20, type: WidthType.PERCENTAGE },
        shading: { fill: HEADER_FILL },
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ children: [new ImageRun({ data: logoBytes, transformation: { width: 44, height: 44 }, type: "png" })] })]
      }));
      logoEmbedded = true;
    } catch {
      // Logo asset missing — letterhead band still renders without it.
    }
  }
  const bandTitle = `HK DİJİTAL  |  ${payload.title.replace(/^HK Dijital\s*[—-]\s*/i, "").toLocaleUpperCase("tr")}`;
  const clientLogo: DocumentLogo | null | undefined = payload.clientLogo;
  headerCells.push(new TableCell({
    width: { size: (logoEmbedded ? 80 : 100) - (clientLogo ? 20 : 0), type: WidthType.PERCENTAGE },
    shading: { fill: HEADER_FILL },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: bandTitle, bold: true, color: "FFFFFF", size: 24 })] })]
  }));
  if (clientLogo?.png?.length) {
    // Verified client logo on a white cell, proportions preserved (max 110×46 px).
    const scale = Math.min(110 / clientLogo.width, 46 / clientLogo.height, 1);
    headerCells.push(new TableCell({
      width: { size: 20, type: WidthType.PERCENTAGE },
      shading: { fill: "FFFFFF" },
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: Buffer.from(clientLogo.png), transformation: { width: Math.round(clientLogo.width * scale), height: Math.round(clientLogo.height * scale) }, type: "png" })] })]
    }));
  }
  children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ children: headerCells })] }));
  children.push(new Paragraph({ text: "", spacing: { after: 200 } }));

  if (payload.confidentialLabel) {
    children.push(new Paragraph({
      spacing: { after: 100 },
      children: [new TextRun({ text: payload.confidentialLabel.toLocaleUpperCase("tr"), bold: true, color: "B43434" })]
    }));
  }

  children.push(new Paragraph({ text: payload.title, heading: HeadingLevel.TITLE, spacing: { after: 120 } }));

  if (payload.metaLines?.length) {
    for (const line of payload.metaLines) {
      children.push(new Paragraph({ children: [new TextRun({ text: line, italics: true, color: "5F6672" })], spacing: { after: 60 } }));
    }
    children.push(new Paragraph({ text: "", spacing: { after: 240 } }));
  } else {
    children.push(new Paragraph({
      children: [new TextRun({ text: `${payload.customerName} · ${payload.period}`, italics: true, color: "5F6672" })],
      spacing: { after: 300 }
    }));
  }

  if (payload.executiveSummary) {
    children.push(new Paragraph({ text: "Yönetici Özeti", heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 100 } }));
    children.push(new Paragraph({ text: payload.executiveSummary, spacing: { after: 200 } }));
  }
  if (payload.headlineMetrics?.length) {
    children.push(docxMetricsTable(payload.headlineMetrics));
    children.push(new Paragraph({ text: "", spacing: { after: 150 } }));
  }

  for (const section of payload.sections) {
    if (!section.items?.length && !section.text && !section.table && !section.metrics?.length && !section.charts?.length && !section.callout && !section.timeline?.length) continue;
    children.push(new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 100 } }));
    if (section.intro) children.push(new Paragraph({ children: [new TextRun({ text: section.intro, italics: true, color: "5E6B78" })], spacing: { after: 100 } }));
    if (section.metrics?.length) { children.push(docxMetricsTable(section.metrics)); children.push(new Paragraph({ text: "", spacing: { after: 100 } })); }
    for (const chart of section.charts || []) children.push(...docxChartBlocks(chart));
    if (section.text) children.push(new Paragraph({ text: section.text, spacing: { after: 150 } }));
    for (const item of section.items || []) {
      children.push(new Paragraph({ text: item, bullet: { level: 0 }, spacing: { after: 60 } }));
    }
    if (section.timeline?.length) children.push(...docxTimeline(section.timeline));
    if (section.table) {
      children.push(buildDocxTable(section.table));
      children.push(new Paragraph({ text: "", spacing: { after: 150 } }));
    }
    if (section.callout) children.push(...docxCallout(section.callout));
  }

  if (payload.footerNote) {
    children.push(new Paragraph({
      spacing: { before: 300 },
      children: [new TextRun({ text: payload.footerNote, italics: true, size: 18, color: "7B8492" })]
    }));
  }

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: "Calibri", size: 22 } } // 11pt
      }
    },
    sections: [{ properties: {}, children }]
  });

  return Packer.toBuffer(doc);
}

export async function generatePptxBuffer(payload: DocumentPayload): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "HK_WIDE", width: 13.333, height: 7.5 });
  pptx.layout = "HK_WIDE";

  const GOLD = "BFA33E";
  const INK = "1B1D22";
  const MUTED = "5F6672";
  const FONT = "Calibri";

  // Slide 1 — Kapak
  const cover = pptx.addSlide();
  cover.background = { color: "0B0D14" };
  cover.addShape("rect", { x: 0, y: 0, w: 13.333, h: 0.12, fill: { color: GOLD } });
  cover.addText("HK DİJİTAL", { x: 0.7, y: 2.5, w: 8, h: 0.5, fontFace: FONT, fontSize: 14, color: GOLD, bold: true, charSpacing: 2 });
  cover.addText(payload.title, { x: 0.7, y: 3.0, w: 11.5, h: 1.4, fontFace: FONT, fontSize: 34, color: "FFFFFF", bold: true });
  cover.addText(`${payload.customerName} · ${payload.period}`, { x: 0.7, y: 4.3, w: 10, h: 0.5, fontFace: FONT, fontSize: 16, color: "C7CBD4" });

  // Slide 2 — Yönetici Özeti
  if (payload.executiveSummary) {
    const summarySlide = pptx.addSlide();
    summarySlide.addShape("rect", { x: 0, y: 0, w: 13.333, h: 0.9, fill: { color: INK } });
    summarySlide.addText("Yönetici Özeti", { x: 0.6, y: 0.2, w: 10, h: 0.5, fontFace: FONT, fontSize: 22, color: "FFFFFF", bold: true });
    summarySlide.addText(payload.executiveSummary, { x: 0.7, y: 1.3, w: 12, h: 5.5, fontFace: FONT, fontSize: 16, color: INK, valign: "top" });
  }

  // Analysis slides — one per section with real content
  for (const section of payload.sections) {
    if (!section.items?.length && !section.text) continue;
    const slide = pptx.addSlide();
    slide.addShape("rect", { x: 0, y: 0, w: 13.333, h: 0.9, fill: { color: INK } });
    slide.addText(section.title, { x: 0.6, y: 0.2, w: 10, h: 0.5, fontFace: FONT, fontSize: 22, color: "FFFFFF", bold: true });
    if (section.text) {
      slide.addText(section.text, { x: 0.7, y: 1.3, w: 12, h: 5.5, fontFace: FONT, fontSize: 15, color: INK, valign: "top" });
    } else if (section.items?.length) {
      slide.addText(
        section.items.map((item) => ({ text: item, options: { bullet: { code: "2022" }, breakLine: true, color: INK, fontSize: 15 } })),
        { x: 0.7, y: 1.3, w: 12, h: 5.5, fontFace: FONT, valign: "top" }
      );
    }
    slide.addText(`HK Dijital · ${payload.customerName}`, { x: 0.6, y: 7.1, w: 6, h: 0.3, fontFace: FONT, fontSize: 9, color: MUTED });
  }

  const result = await pptx.write({ outputType: "nodebuffer" });
  return result as Buffer;
}

export function safeFileNameSegment(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ç/gi, (m) => (m === "Ç" ? "C" : "c"))
    .replace(/ğ/gi, (m) => (m === "Ğ" ? "G" : "g"))
    .replace(/ı/g, "i").replace(/İ/g, "I")
    .replace(/ö/gi, (m) => (m === "Ö" ? "O" : "o"))
    .replace(/ş/gi, (m) => (m === "Ş" ? "S" : "s"))
    .replace(/ü/gi, (m) => (m === "Ü" ? "U" : "u"))
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "belge";
}

export function buildDocumentFileName(customerName: string, documentTitle: string, format: "docx" | "pdf" | "pptx") {
  const date = new Date().toISOString().slice(0, 10);
  return `${safeFileNameSegment(customerName)}_${safeFileNameSegment(documentTitle)}_${date}.${format}`;
}

export const DOCUMENT_MIME_TYPES: Record<"docx" | "pdf" | "pptx", string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation"
};
