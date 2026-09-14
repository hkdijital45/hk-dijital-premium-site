import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { getHandbookPlainSections, getHandbookMeta, readHandbookScreenshot, FIGURE_CHAPTER_MAP, listHandbookScreenshotFiles } from "./hk-admin-el-kitabi";

// Dedicated generator (not the shared generatePdfBuffer in
// document-generator.ts) because the handbook needs two things that
// generic report PDF doesn't: a real page-numbered table of contents and
// embedded screenshots — reimplementing here keeps every other live PDF
// export (Agent Hub reports, etc.) untouched and low-risk.

const GEIST_FONT_PATH = join(process.cwd(), "src", "assets", "fonts", "Geist-Regular.ttf");

const HK_GOLD = rgb(0.749, 0.639, 0.243);
const HK_INK = rgb(0.106, 0.114, 0.133);
const HK_MUTED = rgb(0.373, 0.4, 0.447);
const HK_INK_ON_DARK = rgb(0.96, 0.96, 0.97);

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN = 56;
const CONTENT_W = PAGE_W - MARGIN * 2;

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
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

// A screenshot's PNG dimensions decoded from its IHDR chunk (bytes 16-23) —
// avoids pulling in an image-metadata dependency for a fixed, small set of
// files this same module already reads via readHandbookScreenshot.
function pngDimensions(bytes: Buffer): { width: number; height: number } {
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

export async function generateHandbookPdfBuffer(): Promise<Buffer> {
  const sections = getHandbookPlainSections();
  const meta = getHandbookMeta();
  const screenshotFiles = listHandbookScreenshotFiles();
  const figureByChapter = new Map<string, string>();
  for (const [figure, chapter] of Object.entries(FIGURE_CHAPTER_MAP)) {
    const file = screenshotFiles.find((name) => name.startsWith(`${figure}-`));
    if (file) figureByChapter.set(chapter, file);
  }

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fontBytes = readFileSync(GEIST_FONT_PATH);
  const font = await pdf.embedFont(fontBytes, { subset: true });
  const boldFont = await pdf.embedFont(fontBytes, { subset: true }); // Geist Regular only bundled — bold effect via size/color instead

  const embeddedImages = new Map<string, { image: Awaited<ReturnType<typeof pdf.embedPng>>; width: number; height: number }>();
  for (const file of screenshotFiles) {
    const bytes = readHandbookScreenshot(file);
    if (!bytes) continue;
    const image = await pdf.embedPng(bytes);
    const dims = pngDimensions(bytes);
    embeddedImages.set(file, { image, width: dims.width, height: dims.height });
  }

  let page: PDFPage;
  let y = 0;

  function addPage() {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    page.drawRectangle({ x: 0, y: PAGE_H - 6, width: PAGE_W, height: 6, color: HK_GOLD });
    y = PAGE_H - MARGIN;
    return page;
  }
  function ensureSpace(minSpace: number) {
    if (y < MARGIN + minSpace) addPage();
  }
  function drawHeading(text: string, size = 16) {
    ensureSpace(size + 14);
    page.drawText(text, { x: MARGIN, y, size, font: boldFont, color: HK_INK });
    y -= size + 10;
  }
  function drawParagraph(text: string, size = 10.5, color = HK_INK) {
    for (const line of wrapText(text, font, size, CONTENT_W)) {
      ensureSpace(size + 6);
      page.drawText(line, { x: MARGIN, y, size, font, color });
      y -= size + 6;
    }
    y -= 4;
  }
  function drawImageBlock(file: string) {
    const entry = embeddedImages.get(file);
    if (!entry) return;
    const maxW = CONTENT_W;
    const maxH = 300;
    const scale = Math.min(maxW / entry.width, maxH / entry.height, 1);
    const w = entry.width * scale;
    const h = entry.height * scale;
    ensureSpace(h + 30);
    page.drawImage(entry.image, { x: MARGIN, y: y - h, width: w, height: h });
    y -= h + 6;
    const captionSize = 8.5;
    page.drawText(`Şekil — gerçek HK Admin ekran görüntüsü`, { x: MARGIN, y, size: captionSize, font, color: HK_MUTED });
    y -= captionSize + 14;
  }

  // ---- Cover ----
  page = pdf.addPage([PAGE_W, PAGE_H]);
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: HK_INK });
  page.drawRectangle({ x: 0, y: PAGE_H - 10, width: PAGE_W, height: 10, color: HK_GOLD });
  page.drawText("HK DİJİTAL", { x: MARGIN, y: PAGE_H - 140, size: 13, font: boldFont, color: HK_GOLD });
  for (const [line, size, dy] of [["HK ADMİN", 34, 190], ["EL KİTABI", 34, 232]] as const) {
    page.drawText(line, { x: MARGIN, y: PAGE_H - dy, size, font: boldFont, color: HK_INK_ON_DARK });
  }
  page.drawText("Dijital Ajans Yönetim Sistemi Kullanım, Operasyon ve AI Rehberi", {
    x: MARGIN, y: PAGE_H - 270, size: 12.5, font, color: rgb(0.78, 0.8, 0.85)
  });
  page.drawLine({ start: { x: MARGIN, y: PAGE_H - 300 }, end: { x: PAGE_W - MARGIN, y: PAGE_H - 300 }, thickness: 1, color: rgb(0.3, 0.31, 0.34) });
  page.drawText(`${meta.edition} · ${meta.publishedLabel}`, { x: MARGIN, y: PAGE_H - 324, size: 10.5, font, color: rgb(0.7, 0.72, 0.77) });
  page.drawText(`${meta.chapterCount} bölüm · ${meta.screenshotCount} gerçek ekran görüntüsü`, { x: MARGIN, y: PAGE_H - 342, size: 10.5, font, color: rgb(0.7, 0.72, 0.77) });
  page.drawText("Yalnızca yetkili HK Admin kullanıcıları içindir.", { x: MARGIN, y: MARGIN, size: 8.5, font, color: rgb(0.55, 0.57, 0.62) });

  // ---- Table of contents (page numbers resolved via a dry-run pass) ----
  const dry = { y: PAGE_H - MARGIN, pages: 1 };
  function dryEnsureSpace(minSpace: number) {
    if (dry.y < MARGIN + minSpace) { dry.pages += 1; dry.y = PAGE_H - MARGIN; }
  }
  function dryParagraph(text: string, size = 10.5) {
    const lineCount = wrapText(text, font, size, CONTENT_W).length;
    for (let i = 0; i < lineCount; i++) { dryEnsureSpace(size + 6); dry.y -= size + 6; }
    dry.y -= 4;
  }
  function dryHeading(size = 16) { dryEnsureSpace(size + 14); dry.y -= size + 10; }
  function dryImage(file: string) {
    const entry = embeddedImages.get(file);
    if (!entry) return;
    const scale = Math.min(CONTENT_W / entry.width, 300 / entry.height, 1);
    const h = entry.height * scale;
    dryEnsureSpace(h + 30);
    dry.y -= h + 6 + 8.5 + 14;
  }
  const tocPageNumbers: string[] = [];
  // Reserve room for the TOC itself first (its own page count), then start
  // counting real chapter pages from cover(1) + tocPages + 1.
  const tocLineCount = sections.length;
  const tocPagesEstimate = Math.max(1, Math.ceil((tocLineCount * 18) / (PAGE_H - MARGIN * 2 - 60)));
  let dryPageCounter = 1 + tocPagesEstimate + 1; // cover + toc + this chapter's own first page
  for (const section of sections) {
    tocPageNumbers.push(String(dryPageCounter));
    const startPages = dry.pages;
    dryHeading();
    for (const para of section.text.split(/\n+/).filter(Boolean)) dryParagraph(para);
    const figureFile = figureByChapter.get(section.number);
    if (figureFile) dryImage(figureFile);
    dryPageCounter += dry.pages - startPages;
  }

  addPage();
  drawHeading("İçindekiler", 20);
  y -= 4;
  sections.forEach((section, index) => {
    ensureSpace(20);
    const label = section.number === "0" ? section.title : `${section.number}. ${section.title}`;
    const pageLabel = tocPageNumbers[index];
    const dotsWidth = font.widthOfTextAtSize(pageLabel, 10);
    page.drawText(label, { x: MARGIN, y, size: 10.5, font, color: HK_INK });
    page.drawText(pageLabel, { x: PAGE_W - MARGIN - dotsWidth, y, size: 10, font, color: HK_MUTED });
    y -= 19;
  });

  // ---- Chapters ----
  addPage();
  for (const section of sections) {
    ensureSpace(60);
    const label = section.number === "0" ? section.title : `${section.number}. ${section.title}`;
    drawHeading(label, 15);
    for (const para of section.text.split(/\n+/).filter(Boolean)) drawParagraph(para);
    const figureFile = figureByChapter.get(section.number);
    if (figureFile) drawImageBlock(figureFile);
    y -= 6;
  }

  const pages = pdf.getPages();
  pages.forEach((p, index) => {
    if (index === 0) return; // cover carries no footer
    p.drawText(`HK Dijital · HK Admin El Kitabı · ${index + 1}/${pages.length}`, {
      x: PAGE_W - MARGIN - 190, y: 28, size: 8, font, color: HK_MUTED
    });
  });

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}
