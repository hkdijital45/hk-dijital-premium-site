import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx";
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
export type DocumentSection = { title: string; items?: string[]; text?: string };
export type DocumentPayload = {
  title: string;
  customerName: string;
  period: string;
  executiveSummary: string;
  sections: DocumentSection[];
  footerNote?: string;
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

const HK_GOLD = rgb(0.749, 0.639, 0.243); // matches --hk-gold in globals.css
const HK_INK = rgb(0.106, 0.114, 0.133); // matches --hk-text-primary (dark ink on light document pages)
const HK_MUTED = rgb(0.373, 0.4, 0.447);

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

  // Cover block
  page.drawRectangle({ x: 0, y: pageHeight - 8, width: pageWidth, height: 8, color: HK_GOLD });
  y -= 6;
  drawHeading(payload.title, 22);
  page.drawText("HK DİJİTAL", { x: margin, y, size: 10, font, color: HK_GOLD });
  y -= 18;
  drawParagraph(`${payload.customerName} · ${payload.period}`, 11, HK_MUTED);
  y -= 6;
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 1, color: rgb(0.902, 0.894, 0.863) });
  y -= 20;

  if (payload.executiveSummary) {
    drawSubheading("Yönetici Özeti");
    drawParagraph(payload.executiveSummary);
  }

  for (const section of payload.sections) {
    if (!section.items?.length && !section.text) continue;
    drawSubheading(section.title);
    if (section.text) drawParagraph(section.text);
    for (const item of section.items || []) drawBullet(item);
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

export async function generateDocxBuffer(payload: DocumentPayload): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({ text: "HK DİJİTAL", spacing: { after: 80 } }),
    new Paragraph({ text: payload.title, heading: HeadingLevel.TITLE, spacing: { after: 120 } }),
    new Paragraph({
      children: [new TextRun({ text: `${payload.customerName} · ${payload.period}`, italics: true, color: "5F6672" })],
      spacing: { after: 300 }
    })
  ];

  if (payload.executiveSummary) {
    children.push(new Paragraph({ text: "Yönetici Özeti", heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 100 } }));
    children.push(new Paragraph({ text: payload.executiveSummary, spacing: { after: 200 } }));
  }

  for (const section of payload.sections) {
    if (!section.items?.length && !section.text) continue;
    children.push(new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 100 } }));
    if (section.text) children.push(new Paragraph({ text: section.text, spacing: { after: 150 } }));
    for (const item of section.items || []) {
      children.push(new Paragraph({ text: item, bullet: { level: 0 }, spacing: { after: 60 } }));
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
