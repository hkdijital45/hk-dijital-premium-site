import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { Document, Packer, Paragraph, HeadingLevel, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, AlignmentType } from "docx";
import PptxGenJS from "pptxgenjs";
import type { ProfessionalReportPayload } from "@/lib/report-export";

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
export type DocumentTable = { headers: string[]; rows: string[][] };
export type DocumentSection = { title: string; items?: string[]; text?: string; table?: DocumentTable };
export type DocumentPayload = {
  title: string;
  customerName: string;
  period: string;
  executiveSummary: string;
  sections: DocumentSection[];
  footerNote?: string;
  // Optional letterhead extensions — every existing caller omits these and
  // renders exactly as before (backward compatible, opt-in only).
  /** Embeds the real public/branding/hk-dijital-logo.png at the top of the
   * document. Never generated/redrawn — the actual asset, embedded as-is. */
  logo?: boolean;
  /** e.g. "DAHİLİ KULLANIM" — renders a visible-but-professional marker
   * near the top. Only ever set for HK Dijital-internal documents. */
  confidentialLabel?: string;
  /** Replaces the default "{customerName} · {period}" line with one line
   * per entry (e.g. ["Firma: X", "Rapor Tarihi: Y", "Hazırlayan: HK Dijital"]). */
  metaLines?: string[];
};

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
const GEIST_FONT_PATH = join(process.cwd(), "src", "assets", "fonts", "Geist-Regular.ttf");

// The one real, official HK Dijital logo asset in the repo (also used for
// the public site header/favicon source) — never regenerated, redrawn, or
// AI-produced; embedded as-is, aspect ratio preserved.
const LOGO_PATH = join(process.cwd(), "public", "branding", "hk-dijital-logo.png");

const HK_GOLD = rgb(0.749, 0.639, 0.243); // matches --hk-gold in globals.css
const HK_INK = rgb(0.106, 0.114, 0.133); // matches --hk-text-primary (dark ink on light document pages)
const HK_MUTED = rgb(0.373, 0.4, 0.447);
const HK_DANGER = rgb(0.706, 0.204, 0.204);
const HK_BORDER = rgb(0.902, 0.894, 0.863);

function wrapText(text: string, font: import("pdf-lib").PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function generatePdfBuffer(payload: DocumentPayload): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fontBytes = readFileSync(GEIST_FONT_PATH);
  const font = await pdf.embedFont(fontBytes, { subset: true });

  const pageWidth = 595.28; // A4
  const pageHeight = 841.89;
  const margin = 56;
  const contentWidth = pageWidth - margin * 2;

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  function newPageIfNeeded(minSpace: number) {
    if (y < margin + minSpace) {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  }

  function drawHeading(text: string, size = 18) {
    newPageIfNeeded(40);
    page.drawText(text, { x: margin, y, size, font, color: HK_INK });
    y -= size + 10;
  }

  function drawSubheading(text: string, size = 13) {
    newPageIfNeeded(30);
    page.drawText(text, { x: margin, y, size, font, color: HK_GOLD });
    y -= size + 8;
  }

  function drawParagraph(text: string, size = 10.5, color = HK_INK) {
    const lines = wrapText(text, font, size, contentWidth);
    for (const line of lines) {
      newPageIfNeeded(size + 6);
      page.drawText(line, { x: margin, y, size, font, color });
      y -= size + 6;
    }
    y -= 4;
  }

  function drawBullet(text: string, size = 10.5) {
    const lines = wrapText(text, font, size, contentWidth - 16);
    lines.forEach((line, index) => {
      newPageIfNeeded(size + 6);
      const prefix = index === 0 ? "•  " : "    ";
      page.drawText(`${prefix}${line}`, { x: margin, y, size, font, color: HK_INK });
      y -= size + 6;
    });
  }

  function drawTable(table: DocumentTable, size = 9.5) {
    const columnWidth = contentWidth / table.headers.length;
    function rowHeight(cells: string[]) {
      return Math.max(...cells.map((cell) => wrapText(cell, font, size, columnWidth - 10).length), 1) * (size + 4) + 6;
    }
    function drawRow(cells: string[], bold: boolean) {
      const height = rowHeight(cells);
      newPageIfNeeded(height + 4);
      const top = y;
      cells.forEach((cell, i) => {
        const cellLines = wrapText(cell, font, size, columnWidth - 10);
        cellLines.forEach((line, li) => {
          page.drawText(line, { x: margin + i * columnWidth + 4, y: top - li * (size + 4), size, font, color: bold ? HK_INK : HK_MUTED });
        });
      });
      y = top - height;
      page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: HK_BORDER });
    }
    newPageIfNeeded(rowHeight(table.headers) + 4);
    drawRow(table.headers, true);
    for (const row of table.rows) drawRow(row, false);
    y -= 6;
  }

  // Cover block
  page.drawRectangle({ x: 0, y: pageHeight - 8, width: pageWidth, height: 8, color: HK_GOLD });
  y -= 6;

  if (payload.logo) {
    try {
      const logoBytes = readFileSync(LOGO_PATH);
      const logoImage = await pdf.embedPng(logoBytes);
      const logoSize = 40;
      page.drawImage(logoImage, { x: margin, y: y - logoSize, width: logoSize, height: logoSize });
      // Gap must clear the title heading's ascender (drawHeading draws at
      // 22pt, whose glyphs extend ~16-18pt above the y baseline) or the
      // logo's bottom edge visually collides with the title text.
      y -= logoSize + 26;
    } catch {
      // Logo asset missing — document still renders correctly without it.
    }
  }

  if (payload.confidentialLabel) {
    page.drawText(payload.confidentialLabel.toLocaleUpperCase("tr"), { x: margin, y, size: 10, font, color: HK_DANGER });
    y -= 18;
  }

  drawHeading(payload.title, 22);
  page.drawText("HK DİJİTAL", { x: margin, y, size: 10, font, color: HK_GOLD });
  y -= 18;
  if (payload.metaLines?.length) {
    for (const line of payload.metaLines) drawParagraph(line, 11, HK_MUTED);
  } else {
    drawParagraph(`${payload.customerName} · ${payload.period}`, 11, HK_MUTED);
  }
  y -= 6;
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 1, color: HK_BORDER });
  y -= 20;

  if (payload.executiveSummary) {
    drawSubheading("Yönetici Özeti");
    drawParagraph(payload.executiveSummary);
  }

  for (const section of payload.sections) {
    if (!section.items?.length && !section.text && !section.table) continue;
    drawSubheading(section.title);
    if (section.text) drawParagraph(section.text);
    for (const item of section.items || []) drawBullet(item);
    if (section.table) drawTable(section.table);
    y -= 6;
  }

  if (payload.footerNote) {
    newPageIfNeeded(30);
    drawParagraph(payload.footerNote, 9, HK_MUTED);
  }

  const pages = pdf.getPages();
  pages.forEach((p, index) => {
    p.drawText(`HK Dijital · ${index + 1}/${pages.length}`, { x: pageWidth - margin - 90, y: 28, size: 8, font, color: HK_MUTED });
  });

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

function buildDocxTable(table: DocumentTable): Table {
  const columnWidth = Math.floor(100 / Math.max(table.headers.length, 1));
  const headerRow = new TableRow({
    children: table.headers.map((header) => new TableCell({
      width: { size: columnWidth, type: WidthType.PERCENTAGE },
      children: [new Paragraph({ children: [new TextRun({ text: header, bold: true })] })]
    }))
  });
  const bodyRows = table.rows.map((row) => new TableRow({
    children: row.map((cell) => new TableCell({
      width: { size: columnWidth, type: WidthType.PERCENTAGE },
      children: [new Paragraph({ text: cell })]
    }))
  }));
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, ...bodyRows] });
}

export async function generateDocxBuffer(payload: DocumentPayload): Promise<Buffer> {
  const children: Array<Paragraph | Table> = [];

  if (payload.logo) {
    try {
      const logoBytes = readFileSync(LOGO_PATH);
      children.push(new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 120 },
        children: [new ImageRun({ data: logoBytes, transformation: { width: 64, height: 64 }, type: "png" })]
      }));
    } catch {
      // Logo asset missing — document still renders correctly without it.
    }
  }

  if (payload.confidentialLabel) {
    children.push(new Paragraph({
      spacing: { after: 100 },
      children: [new TextRun({ text: payload.confidentialLabel.toLocaleUpperCase("tr"), bold: true, color: "B43434" })]
    }));
  }

  children.push(new Paragraph({ text: "HK DİJİTAL", spacing: { after: 80 } }));
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

  for (const section of payload.sections) {
    if (!section.items?.length && !section.text && !section.table) continue;
    children.push(new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 100 } }));
    if (section.text) children.push(new Paragraph({ text: section.text, spacing: { after: 150 } }));
    for (const item of section.items || []) {
      children.push(new Paragraph({ text: item, bullet: { level: 0 }, spacing: { after: 60 } }));
    }
    if (section.table) {
      children.push(buildDocxTable(section.table));
      children.push(new Paragraph({ text: "", spacing: { after: 150 } }));
    }
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
