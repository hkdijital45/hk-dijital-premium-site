import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument, rgb, PDFName, PDFArray, PDFString } from "pdf-lib";
import type { PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { Document, Packer, Paragraph, HeadingLevel, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, AlignmentType, ExternalHyperlink, VerticalAlign } from "docx";
import PptxGenJS from "pptxgenjs";
import type { ProfessionalReportPayload } from "@/lib/report-export";
import { isDocumentLink, cellLabel } from "@/lib/document-model";
import type { DocumentLink, DocumentCell, DocumentTable, DocumentSection, DocumentPayload } from "@/lib/document-model";

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
export type { DocumentLink, DocumentCell, DocumentTable, DocumentSection, DocumentPayload };

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
const HK_DANGER = rgb(0.706, 0.204, 0.204);
export const HK_BORDER = rgb(0.902, 0.894, 0.863);
const STATUS_GREEN = rgb(0.086, 0.541, 0.282);
const STATUS_AMBER = rgb(0.706, 0.482, 0.047);
const STATUS_RED = rgb(0.706, 0.204, 0.204);
const STATUS_GRAY = rgb(0.455, 0.467, 0.49);
const STATUS_BLUE = rgb(0.102, 0.412, 0.706);
const HK_LINK = rgb(0.102, 0.412, 0.706);

// Real clickable PDF link — a URI-action Annotation dict registered
// directly in the page's Annots array. pdf-lib has no built-in helper for
// this (no addLink() on PDFPage); this is the documented low-level
// recipe. The full `url` is embedded in the annotation's /A /URI entry
// untouched — never the shortened label text that's actually drawn.
function addLinkAnnotation(page: PDFPage, url: string, rect: [number, number, number, number]) {
  const context = page.doc.context;
  const annotationRef = context.register(
    context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: rect,
      Border: [0, 0, 0],
      A: context.obj({ Type: "Action", S: "URI", URI: PDFString.of(url) })
    })
  );
  const existing = page.node.lookup(PDFName.of("Annots"));
  const annots = existing instanceof PDFArray ? existing : context.obj([]);
  annots.push(annotationRef);
  page.node.set(PDFName.of("Annots"), annots);
}

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
function statusColorFor(cellText: string): ReturnType<typeof rgb> | null {
  if (/Aksiyon Gerekebilir/i.test(cellText)) return STATUS_RED;
  if (/Veri Yetersiz/i.test(cellText)) return STATUS_BLUE;
  if (/Referans Yok/i.test(cellText)) return STATUS_GRAY;
  if (/İzle\b/i.test(cellText)) return STATUS_AMBER;
  if (/İyi\b/i.test(cellText)) return STATUS_GREEN;
  if (/Doğrulandı/i.test(cellText)) return STATUS_GREEN;
  if (/Kontrol edildi/i.test(cellText)) return STATUS_GREEN;
  if (/Muhtemel/i.test(cellText)) return STATUS_AMBER;
  if (/Doğrulanamadı/i.test(cellText)) return STATUS_GRAY;
  if (/Bulunamadı/i.test(cellText)) return STATUS_GRAY;
  return null;
}

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

// Root cause of the long-standing "truncated/overflowing URL" bug: this
// only ever split on whitespace. A URL has no spaces, so a single token
// wider than the column/page simply never wrapped — pdf-lib draws text
// with no clipping, so it silently ran past the margin or into the next
// table cell. charSplit below is the fallback for exactly that one token
// (a normal word never reaches it, since real words are never this wide).
function charSplit(word: string, font: import("pdf-lib").PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const ch of word) {
    const candidate = current + ch;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = ch;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function wrapText(text: string, font: import("pdf-lib").PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else if (font.widthOfTextAtSize(candidate, size) > maxWidth) {
      // The word ALONE (no preceding content) is already wider than the
      // column — a long unbroken token (URL, long slug). Split it at the
      // character level instead of drawing it past the boundary.
      const pieces = charSplit(word, font, size, maxWidth);
      lines.push(...pieces.slice(0, -1));
      current = pieces[pieces.length - 1] || "";
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
    const statusColumnIndex = table.headers.findIndex(isStatusColumnHeader);
    function rowHeight(cells: DocumentCell[]) {
      return Math.max(...cells.map((cell) => wrapText(cellLabel(cell), font, size, columnWidth - 10).length), 1) * (size + 4) + 6;
    }
    function drawRow(cells: DocumentCell[], bold: boolean) {
      const height = rowHeight(cells);
      newPageIfNeeded(height + 4);
      const top = y;
      cells.forEach((cell, i) => {
        const link = isDocumentLink(cell) ? cell : null;
        const cellText = cellLabel(cell);
        // Status accent (section 17): colored dot + colored text, status
        // text itself is always kept verbatim regardless — color is
        // never the only signal of meaning.
        const statusColor = !bold && !link && i === statusColumnIndex ? statusColorFor(cellText) : null;
        const textColor = link ? HK_LINK : statusColor || (bold ? HK_INK : HK_MUTED);
        const textX = margin + i * columnWidth + (statusColor ? 12 : 4);
        if (statusColor) page.drawCircle({ x: margin + i * columnWidth + 5, y: top - size / 2 + 1, size: 3, color: statusColor });
        const displayCell = statusColor ? stripStatusEmoji(cellText) : cellText;
        const cellWidth = columnWidth - (statusColor ? 18 : 10);
        const cellLines = wrapText(displayCell, font, size, cellWidth);
        cellLines.forEach((line, li) => {
          const lineY = top - li * (size + 4);
          page.drawText(line, { x: textX, y: lineY, size, font, color: textColor });
          if (link) {
            // Underline (the visible "this is a link" affordance) + the
            // actual clickable Rect, sized to the real drawn text — never
            // the full column width, so the clickable/visible areas match.
            const lineWidth = font.widthOfTextAtSize(line, size);
            page.drawLine({ start: { x: textX, y: lineY - 1.5 }, end: { x: textX + lineWidth, y: lineY - 1.5 }, thickness: 0.6, color: HK_LINK });
            addLinkAnnotation(page, link.url, [textX, lineY - 2, textX + lineWidth, lineY + size]);
          }
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

  // Premium corporate letterhead — one charcoal band spanning the full
  // page width, logo and dynamic report title living ON it (the band IS
  // the design; never an isolated black rectangle floating behind an
  // otherwise-white logo). A thin gold accent line separates it from the
  // white document body below.
  const HEADER_HEIGHT = 60;
  page.drawRectangle({ x: 0, y: pageHeight - HEADER_HEIGHT, width: pageWidth, height: HEADER_HEIGHT, color: HK_INK });
  page.drawRectangle({ x: 0, y: pageHeight - HEADER_HEIGHT - 3, width: pageWidth, height: 3, color: HK_GOLD });

  if (payload.logo) {
    try {
      const logoBytes = readFileSync(LOGO_PATH);
      const logoImage = await pdf.embedPng(logoBytes);
      const logoSize = 36;
      page.drawImage(logoImage, { x: margin, y: pageHeight - HEADER_HEIGHT / 2 - logoSize / 2, width: logoSize, height: logoSize });
    } catch {
      // Logo asset missing — letterhead band still renders without it.
    }
  }

  // "HK Dijital — Ön İnceleme Raporu" -> "HK DİJİTAL | ÖN İNCELEME RAPORU"
  // — one dynamic band title reflecting the actual report type, never a
  // hardcoded generic label.
  const bandTitle = `HK DİJİTAL  |  ${payload.title.replace(/^HK Dijital\s*[—-]\s*/i, "").toLocaleUpperCase("tr")}`;
  const bandTitleSize = 12;
  const bandTitleWidth = font.widthOfTextAtSize(bandTitle, bandTitleSize);
  const bandTitleX = Math.max(margin + 52, pageWidth - margin - bandTitleWidth);
  page.drawText(bandTitle, { x: bandTitleX, y: pageHeight - HEADER_HEIGHT / 2 - bandTitleSize / 2 + 2, size: bandTitleSize, font, color: rgb(1, 1, 1) });

  y = pageHeight - HEADER_HEIGHT - 28;

  if (payload.confidentialLabel) {
    page.drawText(payload.confidentialLabel.toLocaleUpperCase("tr"), { x: margin, y, size: 10, font, color: HK_DANGER });
    y -= 18;
  }

  drawHeading(payload.title, 20);
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
    if (section.spacingBefore) y -= section.spacingBefore;
    if (section.minSpaceBefore) newPageIfNeeded(section.minSpaceBefore);
    drawSubheading(section.title, section.titleSize || 13);
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
  headerCells.push(new TableCell({
    width: { size: logoEmbedded ? 80 : 100, type: WidthType.PERCENTAGE },
    shading: { fill: HEADER_FILL },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: bandTitle, bold: true, color: "FFFFFF", size: 24 })] })]
  }));
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
