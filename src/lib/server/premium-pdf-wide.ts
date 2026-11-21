import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PDFArray, PDFDocument, PDFName, PDFString, rgb } from "pdf-lib";
import type { PDFFont, PDFImage, PDFPage, RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { isDocumentLink, cellLabel } from "@/lib/document-model";
import type { DocumentCallout, DocumentCell, DocumentChart, DocumentMetric, DocumentPayload, DocumentSection, DocumentTable, DocumentTimelinePhase, DocumentTone } from "@/lib/document-model";
import {
  CHART_SERIES_COLORS, REPORT_COLORS, displayReportTitle, fitLogo, formatAxisValue, formatChartValue, formatPercentTr,
  hexToRgb01, niceAxisMax, sanitizeChartData, splitMetaLine
} from "@/lib/report-design";
import { isBrandingOnlyNote, wrapLines } from "@/lib/server/premium-pdf";

// HK Dijital Premium WIDE (16:9) presentation renderer — a horizontal
// sibling of premium-pdf.ts's A4-portrait "HK Dijital Premium Report
// System V3", used ONLY where a report is meant to read as a slide
// presentation (currently: Ön İnceleme Merkezi's internal/customer PDF
// exports). Every other existing PDF export in the app keeps going through
// renderPremiumPdf (document-generator.ts's generatePdfBuffer) completely
// unchanged — this file never touches that one, so no other report's
// output is affected.
//
// Deliberately reuses the SAME brand palette (REPORT_COLORS), the SAME
// pure formatting/chart-integrity helpers (report-design.ts), the SAME
// word-wrap implementation (wrapLines, imported from premium-pdf.ts), and
// the SAME DocumentPayload/DocumentSection data contract — only the page
// geometry and a few landscape-shaped components (stat-card row, numbered
// step cards, dark callouts) are new. A section's content (text/items/
// table/metrics/charts/callout/timeline) renders exactly as supplied;
// nothing here invents copy, numbers, or narrative.

const FONT_DIR = join(process.cwd(), "assets", "fonts");
const HK_LOGO_HORIZONTAL_PATH = join(process.cwd(), "src", "assets", "branding", "hk-dijital-logo-horizontal-report.png");

// 13.333 x 7.5 inch at 72pt/in — the same 16:9 proportions already used by
// this app's PowerPoint export (document-generator.ts's pptx.defineLayout
// "HK_WIDE"), so every HK Dijital "wide" output shares one aspect ratio.
const PAGE_W = 960;
const PAGE_H = 540;
const MARGIN = 50;
const CONTENT_W = PAGE_W - MARGIN * 2;
const TOPBAR_H = 4;
const HEADER_H = 40;
const CONTENT_TOP = PAGE_H - TOPBAR_H - HEADER_H - 24;
const CONTENT_BOTTOM = 54;

const C = Object.fromEntries(Object.entries(REPORT_COLORS).map(([k, v]) => [k, rgb(...hexToRgb01(v))])) as Record<keyof typeof REPORT_COLORS, RGB>;
const SERIES = CHART_SERIES_COLORS.map((hex) => rgb(...hexToRgb01(hex)));
const GRID = rgb(...hexToRgb01("#E8EDF1"));
const ZEBRA = rgb(...hexToRgb01("#F7F9FB"));

const STATUS_COLORS: Array<[RegExp, RGB]> = [
  [/Aksiyon Gerekebilir/i, C.coralText],
  [/Veri Yetersiz/i, rgb(...hexToRgb01("#1A69B4"))],
  [/Referans Yok/i, C.muted],
  [/İzle\b/i, rgb(...hexToRgb01("#A9750B"))],
  [/İyi\b/i, C.emerald],
  [/Doğrulandı/i, C.emerald],
  [/Kontrol edildi/i, C.emerald],
  [/Muhtemel/i, rgb(...hexToRgb01("#A9750B"))],
  [/Doğrulanamadı/i, C.muted],
  [/Bulunamadı/i, C.muted]
];

function toneColor(tone: DocumentTone | undefined): { bar: RGB; text: RGB } {
  switch (tone) {
    case "positive": return { bar: C.emerald, text: C.emerald };
    case "negative": return { bar: C.coral, text: C.coralText };
    case "warning": return { bar: C.gold, text: rgb(...hexToRgb01("#8A6D12")) };
    case "accent": return { bar: C.navy, text: C.navy };
    default: return { bar: C.turquoise, text: C.turquoiseText };
  }
}

type Fonts = { regular: PDFFont; semibold: PDFFont; bold: PDFFont };

function cleanGlyphs(text: string): string {
  return text.replace(/[🟢🟡🔴⚪🔵✓✔☐⚠️]/gu, "").replace(/\t/g, "  ");
}

function ellipsize(text: string, font: PDFFont, size: number, maxWidth: number): string {
  const clean = cleanGlyphs(text);
  if (font.widthOfTextAtSize(clean, size) <= maxWidth) return clean;
  let out = clean;
  while (out.length > 1 && font.widthOfTextAtSize(`${out}…`, size) > maxWidth) out = out.slice(0, -1);
  return `${out.trimEnd()}…`;
}

function roundedRectPath(w: number, h: number, r: number): string {
  const rr = Math.min(r, w / 2, h / 2);
  return `M ${rr} 0 H ${w - rr} Q ${w} 0 ${w} ${rr} V ${h - rr} Q ${w} ${h} ${w - rr} ${h} H ${rr} Q 0 ${h} 0 ${h - rr} V ${rr} Q 0 0 ${rr} 0 Z`;
}

function addLinkAnnotation(page: PDFPage, url: string, rect: [number, number, number, number]) {
  const context = page.doc.context;
  const annotationRef = context.register(context.obj({ Type: "Annot", Subtype: "Link", Rect: rect, Border: [0, 0, 0], A: context.obj({ Type: "Action", S: "URI", URI: PDFString.of(url) }) }));
  const existing = page.node.lookup(PDFName.of("Annots"));
  const annots = existing instanceof PDFArray ? existing : context.obj([]);
  annots.push(annotationRef);
  page.node.set(PDFName.of("Annots"), annots);
}

function isSubsection(section: DocumentSection): boolean {
  if (section.level) return section.level === 2;
  return /\s[—–]\s|\(devam\)\s*$/i.test(section.title);
}

class PremiumPdfWide {
  private pdf: PDFDocument;
  private fonts: Fonts;
  private hkLogo: PDFImage | null;
  private page!: PDFPage;
  private y = 0;
  private sectionNumber = 0;
  private readonly runningTitle: string;
  private contentPages = new Set<PDFPage>();
  private decorating = false;

  constructor(pdf: PDFDocument, fonts: Fonts, hkLogo: PDFImage | null, private payload: DocumentPayload) {
    this.pdf = pdf;
    this.fonts = fonts;
    this.hkLogo = hkLogo;
    this.runningTitle = displayReportTitle(payload.title).replace(/\s*[—–-]\s*Dahili Kullanım$/i, "");
  }

  // ---------- primitives ----------
  private text(t: string, x: number, y: number, size: number, font: PDFFont, color: RGB, opacity = 1) {
    const clean = cleanGlyphs(t);
    if (!this.decorating && clean.trim()) this.contentPages.add(this.page);
    this.page.drawText(clean, { x, y, size, font, color, opacity });
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number, opts: { color?: RGB; borderColor?: RGB; borderWidth?: number; opacity?: number }) {
    this.page.drawSvgPath(roundedRectPath(w, h, r), { x, y: y + h, color: opts.color, borderColor: opts.borderColor, borderWidth: opts.borderWidth, opacity: opts.opacity, borderOpacity: opts.opacity });
  }

  // ---------- page flow ----------
  private newSlide() {
    this.decorate(this.pdf.addPage([PAGE_W, PAGE_H]));
    this.y = CONTENT_TOP;
  }

  private decorate(page: PDFPage) {
    this.page = page;
    this.decorating = true;
    this.page.drawRectangle({ x: 0, y: PAGE_H - TOPBAR_H, width: PAGE_W, height: TOPBAR_H, color: C.turquoise });
    this.page.drawRectangle({ x: 0, y: PAGE_H - TOPBAR_H, width: 90, height: TOPBAR_H, color: C.gold });
    const by = PAGE_H - TOPBAR_H - HEADER_H / 2 - 3;
    if (this.hkLogo) {
      const size = fitLogo(this.hkLogo.width, this.hkLogo.height, 96, 20, 96 * 20);
      this.page.drawImage(this.hkLogo, { x: MARGIN, y: PAGE_H - TOPBAR_H - HEADER_H / 2 - size.height / 2, width: size.width, height: size.height });
    } else {
      this.text("HK DİJİTAL", MARGIN, by, 10, this.fonts.bold, C.navy);
    }
    const label = this.runningTitle.toLocaleUpperCase("tr");
    const maxW = CONTENT_W - 140;
    const shown = ellipsize(label, this.fonts.semibold, 8, maxW);
    const w = this.fonts.semibold.widthOfTextAtSize(shown, 8);
    this.text(shown, PAGE_W - MARGIN - w, by, 8, this.fonts.semibold, C.muted);
    this.decorating = false;
  }

  private ensure(height: number) {
    if (this.y - height < CONTENT_BOTTOM) this.newSlide();
  }

  private remaining() {
    return this.y - CONTENT_BOTTOM;
  }

  // ---------- cover ----------
  private async drawCover() {
    this.page = this.pdf.addPage([PAGE_W, PAGE_H]);
    const heroH = 352;
    const heroBottom = PAGE_H - heroH;
    this.page.drawRectangle({ x: 0, y: heroBottom, width: PAGE_W, height: heroH, color: C.navy });
    this.page.drawCircle({ x: PAGE_W + 40, y: PAGE_H - 10, size: 220, borderColor: C.navySoft, borderWidth: 34, borderOpacity: 0.5 });
    this.page.drawRectangle({ x: 0, y: heroBottom - 4, width: PAGE_W, height: 4, color: C.turquoise });
    this.page.drawRectangle({ x: MARGIN, y: heroBottom - 4, width: 90, height: 4, color: C.gold });

    // ----- corner logo badges -----
    const badgeY = PAGE_H - 92;
    if (this.hkLogo) {
      const fit = fitLogo(this.hkLogo.width, this.hkLogo.height, 196, 56, 196 * 56);
      this.roundRect(MARGIN, badgeY - 20, fit.width + 36, fit.height + 28, 10, { color: C.navySoft });
      this.page.drawImage(this.hkLogo, { x: MARGIN + 18, y: badgeY - 6, width: fit.width, height: fit.height });
    }
    const client = this.payload.clientLogo;
    if (client?.png?.length) {
      try {
        const clientImage = await this.pdf.embedPng(client.png);
        const envelopeW = 168;
        const envelopeH = 64;
        const fit = fitLogo(clientImage.width, clientImage.height, envelopeW, envelopeH, envelopeW * envelopeH);
        const plateW = envelopeW + 28;
        const plateH = envelopeH + 20;
        this.roundRect(PAGE_W - MARGIN - plateW, badgeY - 20, plateW, plateH, 10, { color: C.white });
        this.page.drawImage(clientImage, { x: PAGE_W - MARGIN - plateW + (plateW - fit.width) / 2, y: badgeY - 20 + (plateH - fit.height) / 2, width: fit.width, height: fit.height });
      } catch { /* a logo that fails to embed is simply skipped — never blocks the report */ }
    }

    // ----- date pill -----
    const meta = (this.payload.metaLines || []).map(splitMetaLine).filter((m) => m.value);
    const dateLine = meta.find((m) => /tarih|oluşturul/iu.test(m.label) && !/güncelle/iu.test(m.label));
    const date = (dateLine?.value || new Date().toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric", timeZone: "Europe/Istanbul" })).toLocaleUpperCase("tr");
    const pillW = this.fonts.semibold.widthOfTextAtSize(date, 8.6) + 28;
    this.roundRect(MARGIN, PAGE_H - 150, pillW, 20, 10, { color: C.navySoft });
    this.text(date, MARGIN + 14, PAGE_H - 144, 8.6, this.fonts.semibold, C.turquoiseLight);

    // ----- title block -----
    const title = displayReportTitle(this.payload.title);
    let titleSize = 32;
    let titleLines = wrapLines(title, this.fonts.bold, titleSize, 620);
    while (titleLines.length > 2 && titleSize > 22) { titleSize -= 2; titleLines = wrapLines(title, this.fonts.bold, titleSize, 620); }
    let ty = PAGE_H - 188;
    for (const line of titleLines.slice(0, 2)) {
      this.text(line, MARGIN, ty - titleSize, titleSize, this.fonts.bold, C.white);
      ty -= titleSize + 8;
    }
    const nameLines = wrapLines(this.payload.customerName || "", this.fonts.bold, 22, 620).slice(0, 1);
    for (const line of nameLines) {
      this.text(line, MARGIN, ty - 22, 22, this.fonts.bold, C.turquoiseLight);
      ty -= 30;
    }

    // ----- subtitle: real section titles, bullet-separated (never invented copy) -----
    const topTitles = this.payload.sections.filter((s) => !isSubsection(s) && (s.text || s.items?.length || s.table || s.metrics?.length)).slice(0, 5).map((s) => s.title);
    if (topTitles.length) {
      const subtitle = topTitles.join("  •  ");
      const subLines = wrapLines(subtitle, this.fonts.regular, 11.5, 700).slice(0, 2);
      for (const line of subLines) { this.text(line, MARGIN, ty - 11.5, 11.5, this.fonts.regular, rgb(1, 1, 1), 0.78); ty -= 18; }
    }

    if (this.payload.confidentialLabel) {
      const label = `${this.payload.confidentialLabel.toLocaleUpperCase("tr")} — MÜŞTERİYLE PAYLAŞILMAZ`;
      const w = this.fonts.semibold.widthOfTextAtSize(label, 8) + 26;
      this.roundRect(MARGIN, ty - 26, w, 22, 11, { borderColor: C.coral, borderWidth: 1, color: rgb(1, 1, 1) });
      this.text(label, MARGIN + 13, ty - 19, 8, this.fonts.semibold, C.coralText);
    }

    // ----- footer (white lower area) -----
    const tagline = "HK Dijital | Dijital Pazarlama & Büyüme Çözümleri";
    this.text(tagline, MARGIN, 34, 9.5, this.fonts.semibold, C.navy);
    const site = "hkdijital.com.tr";
    const sw = this.fonts.regular.widthOfTextAtSize(site, 9);
    this.text(site, PAGE_W - MARGIN - sw, 34, 9, this.fonts.regular, C.turquoiseText);
  }

  // ---------- section header ----------
  private sectionHeader(section: DocumentSection) {
    this.sectionNumber += 1;
    const num = String(this.sectionNumber).padStart(2, "0");
    this.text(num, MARGIN, this.y - 11, 10, this.fonts.semibold, C.turquoiseText);
    this.y -= 24;
    const size = section.titleSize && section.titleSize < 18 ? 18 : 24;
    for (const line of wrapLines(section.title, this.fonts.bold, size, CONTENT_W).slice(0, 2)) {
      this.text(line, MARGIN, this.y - size, size, this.fonts.bold, C.navy);
      this.y -= size + 5;
    }
    this.page.drawRectangle({ x: MARGIN, y: this.y - 2, width: 34, height: 3, color: C.turquoise });
    this.page.drawRectangle({ x: MARGIN + 34, y: this.y - 2, width: 10, height: 3, color: C.gold });
    this.y -= 18;
    if (section.intro) {
      for (const line of wrapLines(section.intro, this.fonts.regular, 11.5, CONTENT_W - 2)) {
        this.text(line, MARGIN, this.y - 11.5, 11.5, this.fonts.regular, C.muted);
        this.y -= 17;
      }
      this.y -= 6;
    }
  }

  private subheading(title: string) {
    this.ensure(44);
    this.y -= 8;
    this.page.drawRectangle({ x: MARGIN, y: this.y - 13, width: 3, height: 14, color: C.turquoise });
    for (const line of wrapLines(title, this.fonts.semibold, 14, CONTENT_W - 12)) {
      this.text(line, MARGIN + 11, this.y - 12, 14, this.fonts.semibold, C.navy);
      this.y -= 19;
    }
    this.y -= 4;
  }

  // ---------- body blocks ----------
  private paragraph(text: string, opts: { size?: number; font?: PDFFont; color?: RGB; width?: number; x?: number; leading?: number } = {}) {
    const size = opts.size ?? 12.5;
    const font = opts.font ?? this.fonts.regular;
    const leading = opts.leading ?? size * 1.55;
    const width = opts.width ?? CONTENT_W;
    const x = opts.x ?? MARGIN;
    const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    for (const p of paragraphs) {
      for (const line of wrapLines(p, font, size, width)) {
        if (!line.trim()) { this.y -= leading; continue; }
        this.ensure(leading);
        this.text(line, x, this.y - size, size, font, opts.color ?? C.anthracite);
        this.y -= leading;
      }
      this.y -= size * 0.5;
    }
  }

  /** Two-column flow for a long, standalone block of prose — a single
   * narrow column on a 16:9 slide leaves most of the width empty and turns
   * any overflow into an almost-blank continuation slide; splitting into
   * two columns roughly doubles how much text fits per slide before a new
   * one is needed. Only used for text-only sections (see section()) so a
   * short paragraph never gets an awkward near-empty second column. */
  private paragraphColumns(text: string, opts: { size?: number; color?: RGB } = {}) {
    const font = this.fonts.regular;
    const gap = 36;
    const colW = (CONTENT_W - gap) / 2;
    const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    type Block = { text: string } | { blank: true };
    const buildBlocks = (size: number): Block[] => {
      const blocks: Block[] = [];
      paragraphs.forEach((p, i) => {
        for (const line of wrapLines(p, font, size, colW)) blocks.push({ text: line });
        if (i < paragraphs.length - 1) blocks.push({ blank: true });
      });
      return blocks;
    };

    // A near-miss overflow (a handful of lines spilling onto an otherwise
    // empty continuation slide) looks unfinished — shrink the type a step
    // at a time (floor 10.5pt) until the whole block fits one slide's two
    // columns, before falling back to genuine pagination for long text.
    const baseSize = opts.size ?? 12.5;
    const capacityLines = (size: number) => Math.floor((this.y - CONTENT_BOTTOM) / (size * 1.55)) * 2;
    let size = baseSize;
    let blocks = buildBlocks(size);
    while (size > 10.5 && blocks.length > capacityLines(size)) {
      size -= 0.5;
      blocks = buildBlocks(size);
    }
    const leading = size * 1.55;

    const top = this.y;
    let col = 0;
    let x = MARGIN;
    let cy = top;
    for (const block of blocks) {
      if (cy - leading < CONTENT_BOTTOM) {
        if (col === 0) { col = 1; x = MARGIN + colW + gap; cy = top; }
        else { this.newSlide(); col = 0; x = MARGIN; cy = this.y; }
      }
      if ("blank" in block) { cy -= leading * 0.55; continue; }
      this.text(block.text, x, cy - size, size, font, opts.color ?? C.anthracite);
      cy -= leading;
    }
    this.y = CONTENT_BOTTOM - 1; // next block (if any) starts a fresh slide
  }

  private bullets(items: string[]) {
    const clean = items.map((raw) => raw.trim().replace(/^[•·\-–]\s+/, "")).filter(Boolean);
    if (!clean.length) return;
    const size = 11.5;
    const leading = 17;
    const twoCol = clean.length >= 5 && clean.every((it) => it.length <= 90);
    const columns = twoCol ? 2 : 1;
    const colW = (CONTENT_W - (columns - 1) * 28) / columns;
    const colItems: string[][] = columns === 2 ? [clean.slice(0, Math.ceil(clean.length / 2)), clean.slice(Math.ceil(clean.length / 2))] : [clean];
    const colLines = colItems.map((col) => col.map((item) => wrapLines(item, this.fonts.regular, size, colW - 18)));
    const top = this.y;
    let maxBottom = top;
    colLines.forEach((lines, ci) => {
      const x = MARGIN + ci * (colW + 28);
      let cy = top;
      lines.forEach((wrapped) => {
        const h = wrapped.length * leading + 6;
        if (cy - h < CONTENT_BOTTOM) { /* column overflow: last items simply stop rather than overlapping the footer */ return; }
        this.page.drawRectangle({ x, y: cy - size + 2.4, width: 4.2, height: 4.2, color: C.turquoise });
        wrapped.forEach((line, li) => { this.text(line, x + 16, cy - size - li * leading, size, this.fonts.regular, C.anthracite); });
        cy -= h;
      });
      maxBottom = Math.min(maxBottom, cy);
    });
    this.y = maxBottom - 8;
  }

  private metricsGrid(metrics: DocumentMetric[]) {
    const list = metrics.filter((m) => m && m.label && m.value);
    if (!list.length) return;
    const perRow = Math.min(list.length, 4);
    const gap = 16;
    const cardW = (CONTENT_W - gap * (perRow - 1)) / perRow;
    const cardH = 96;
    this.ensure(cardH + 14);
    const row = list.slice(0, perRow);
    row.forEach((m, i) => {
      const x = MARGIN + i * (cardW + gap);
      const top = this.y;
      const tone = toneColor(m.tone);
      this.roundRect(x, top - cardH, cardW, cardH, 10, { color: C.surface, borderColor: C.border, borderWidth: 0.6 });
      this.page.drawRectangle({ x, y: top - cardH, width: 4, height: cardH, color: tone.bar });
      let size = 27;
      while (size > 15 && this.fonts.bold.widthOfTextAtSize(cleanGlyphs(m.value), size) > cardW - 32) size -= 1;
      this.text(ellipsize(m.value, this.fonts.bold, size, cardW - 32), x + 18, top - 20 - size + 6, size, this.fonts.bold, C.navy);
      const labelLines = wrapLines(m.label.toLocaleUpperCase("tr"), this.fonts.semibold, 8.4, cardW - 32).slice(0, 2);
      labelLines.forEach((line, li) => this.text(line, x + 18, top - cardH + 26 - li * 11, 8.4, this.fonts.semibold, C.muted));
      if (m.note) this.text(ellipsize(m.note, this.fonts.regular, 8.6, cardW - 32), x + 18, top - cardH + 13, 8.6, this.fonts.regular, m.tone && m.tone !== "neutral" ? tone.text : C.muted);
    });
    if (list.length > perRow) {
      // extremely rare (>4 KPI cards): continue on a second row beneath
      this.y -= cardH + 14;
      this.metricsGrid(list.slice(perRow));
      return;
    }
    this.y -= cardH + 16;
  }

  private callout(callout: DocumentCallout) {
    const tone = toneColor(callout.tone);
    const width = CONTENT_W - 44;
    const titleLines = callout.title ? wrapLines(callout.title, this.fonts.semibold, 13, width) : [];
    const textLines = wrapLines(callout.text, this.fonts.regular, 11.5, width);
    const h = 26 + titleLines.length * 17 + textLines.length * 16.5 + (titleLines.length ? 4 : 0);
    if (h > this.remaining() && h < CONTENT_TOP - CONTENT_BOTTOM) this.newSlide();
    const top = this.y;
    this.roundRect(MARGIN, top - h, CONTENT_W, h, 10, { color: C.navy });
    this.page.drawRectangle({ x: MARGIN, y: top - h, width: 5, height: h, color: tone.bar });
    let ly = top - 20;
    for (const line of titleLines) { this.text(line, MARGIN + 24, ly - 10, 13, this.fonts.semibold, rgb(1, 1, 1)); ly -= 17; }
    if (titleLines.length) ly -= 4;
    for (const line of textLines) { this.text(line, MARGIN + 24, ly - 9, 11.5, this.fonts.regular, C.turquoiseLight); ly -= 16.5; }
    this.y = top - h - 16;
  }

  /** Numbered step cards — one row of up to 4, each a colored circular
   * badge + bold label + short bullet items. Drives three distinct Sante-
   * style layouts (opportunity triads, customer-journey steps, a 30-day
   * roadmap) from the same DocumentTimelinePhase[] shape already used by
   * the portrait renderer. */
  private stepsRow(phases: DocumentTimelinePhase[]) {
    const list = phases.filter((p) => p.label);
    if (!list.length) return;
    for (let start = 0; start < list.length; start += 4) {
      const row = list.slice(start, start + 4);
      const gap = 16;
      const cardW = (CONTENT_W - gap * (row.length - 1)) / row.length;
      const textW = cardW - 32;
      const heights = row.map((p) => {
        const labelLines = wrapLines(p.label, this.fonts.semibold, 12, textW).length;
        const itemLines = p.items.reduce((s, it) => s + wrapLines(it, this.fonts.regular, 9.6, textW - 10).length, 0);
        return 56 + labelLines * 15 + itemLines * 13 + p.items.length * 3;
      });
      const h = Math.min(Math.max(...heights, 90), CONTENT_TOP - CONTENT_BOTTOM - 10);
      this.ensure(h + 14);
      const top = this.y;
      row.forEach((phase, i) => {
        const x = MARGIN + i * (cardW + gap);
        const dark = i % 2 === 1;
        this.roundRect(x, top - h, cardW, h, 10, { color: dark ? C.navy : C.surface, borderColor: dark ? undefined : C.border, borderWidth: dark ? undefined : 0.6 });
        const badgeColor = dark ? C.turquoiseLight : C.turquoise;
        this.page.drawCircle({ x: x + 26, y: top - 26, size: 15, color: dark ? C.navySoft : rgb(1, 1, 1), borderColor: badgeColor, borderWidth: 1.4 });
        const numLabel = String(start + i + 1).padStart(2, "0");
        const nw = this.fonts.bold.widthOfTextAtSize(numLabel, 10);
        this.text(numLabel, x + 26 - nw / 2, top - 30, 10, this.fonts.bold, dark ? C.turquoiseLight : C.turquoiseText);
        let ly = top - 52;
        for (const line of wrapLines(phase.label, this.fonts.semibold, 12, textW)) {
          this.text(line, x + 16, ly, 12, this.fonts.semibold, dark ? rgb(1, 1, 1) : C.navy);
          ly -= 15;
        }
        ly -= 3;
        for (const item of phase.items) {
          for (const line of wrapLines(item, this.fonts.regular, 9.6, textW - 10)) {
            if (ly < top - h + 10) break;
            this.text(line, x + 16, ly, 9.6, this.fonts.regular, dark ? C.turquoiseLight : C.muted);
            ly -= 13;
          }
          ly -= 2;
        }
      });
      this.y = top - h - 16;
    }
  }

  // ---------- tables ----------
  private columnWidths(table: DocumentTable, size: number): number[] {
    const n = table.headers.length;
    const minW: number[] = [];
    const want: number[] = [];
    const statusCol = table.headers.findIndex((h) => /^durum$/i.test(h.trim()));
    for (let c = 0; c < n; c += 1) {
      const header = cleanGlyphs(table.headers[c]).toLocaleUpperCase("tr");
      let longestWord = Math.max(0, ...header.split(/\s+/).map((w) => this.fonts.semibold.widthOfTextAtSize(w, size - 0.4)));
      let longestText = this.fonts.semibold.widthOfTextAtSize(header, size - 0.4);
      const bodyFont = c === 0 || c === statusCol ? this.fonts.semibold : this.fonts.regular;
      const extra = c === statusCol ? 11 : 0;
      for (const row of table.rows) {
        const t = cleanGlyphs(row[c] !== undefined ? cellLabel(row[c]) : "");
        if (row[c] !== undefined && isDocumentLink(row[c]) && t.length <= 28) longestWord = Math.max(longestWord, bodyFont.widthOfTextAtSize(t, size));
        for (const word of t.split(/\s+/)) longestWord = Math.max(longestWord, Math.min(bodyFont.widthOfTextAtSize(word, size) + extra, 170));
        longestText = Math.max(longestText, bodyFont.widthOfTextAtSize(t, size) + extra);
      }
      minW.push(Math.max(50, longestWord + 16));
      want.push(Math.max(50, Math.min(longestText + 16, 360)));
    }
    const sumWant = want.reduce((a, b) => a + b, 0);
    if (sumWant <= CONTENT_W) return want.map((w) => (w / sumWant) * CONTENT_W);
    const sumMin = minW.reduce((a, b) => a + b, 0);
    if (sumMin >= CONTENT_W) return minW.map((w) => (w / sumMin) * CONTENT_W);
    const extra = CONTENT_W - sumMin;
    const flex = want.map((w, i) => w - minW[i]);
    const sumFlex = flex.reduce((a, b) => a + b, 0) || 1;
    return minW.map((w, i) => w + (flex[i] / sumFlex) * extra);
  }

  private headerWordsFit(table: DocumentTable, size: number): boolean {
    const widths = this.columnWidths(table, size);
    return !widths.some((w, i) => {
      const header = cleanGlyphs(table.headers[i]).toLocaleUpperCase("tr");
      return Math.max(...header.split(/\s+/).map((word) => this.fonts.semibold.widthOfTextAtSize(word, size - 0.4))) > w - 14;
    });
  }

  private table(table: DocumentTable) {
    if (!table.headers.length) return;
    const MIN_SIZE = 9;
    let size = table.headers.length > 5 ? 9.4 : 10.4;
    while (size > MIN_SIZE && !this.headerWordsFit(table, size)) size = Math.round((size - 0.3) * 10) / 10;
    if (table.headers.length >= 8 || !this.headerWordsFit(table, Math.max(size, MIN_SIZE))) {
      this.recordCards(table);
      return;
    }
    size = Math.max(size, MIN_SIZE);
    const leading = size + 4.4;
    const pad = 8;
    const widths = this.columnWidths(table, size);
    const statusCol = table.headers.findIndex((h) => /^durum$/i.test(h.trim()));
    const headerSize = size - 0.2;
    const cellLines = (cell: DocumentCell | undefined, w: number, font: PDFFont, indent: number, fontSize = size) =>
      wrapLines(cellLabel(cell ?? ""), font, fontSize, w - pad * 2 - indent);

    const headerLines = table.headers.map((h, i) => cellLines(h.toLocaleUpperCase("tr"), widths[i], this.fonts.semibold, 0, headerSize));
    const headerH = Math.max(...headerLines.map((l) => l.length), 1) * leading + pad * 2 - 2;
    const drawHeader = () => {
      const top = this.y;
      this.roundRect(MARGIN, top - headerH, CONTENT_W, headerH, 6, { color: C.navy });
      let x = MARGIN;
      headerLines.forEach((l, i) => {
        l.forEach((line, li) => this.text(line, x + pad, top - pad - size + 1 - li * leading, headerSize, this.fonts.semibold, C.white));
        x += widths[i];
      });
      this.y = top - headerH;
    };

    // Unlike the A4-portrait renderer, a table is never pre-emptively
    // relocated whole to a fresh slide just because it might not fully
    // fit: a landscape slide's content area is short enough that doing so
    // regularly orphaned the heading just drawn above it on an otherwise
    // near-empty slide. Per-row continuation below (new slide + repeated
    // header) already makes an overflowing table look intentional.
    this.ensure(headerH + leading * 2 + pad * 2 + 10);
    drawHeader();
    table.rows.forEach((row, rowIndex) => {
      const prepared = table.headers.map((_, i) => {
        const cell = row[i];
        const text = cell === undefined ? "" : cellLabel(cell);
        const status = !isDocumentLink(cell ?? "") && i === statusCol ? STATUS_COLORS.find(([re]) => re.test(text))?.[1] || null : null;
        return { cell, status, lines: cellLines(cell, widths[i], this.fonts.regular, status ? 11 : 0) };
      });
      const totalLines = Math.max(...prepared.map((p) => p.lines.length), 1);
      let start = 0;
      while (start < totalLines) {
        const remainingLines = totalLines - start;
        const fit = Math.floor((this.y - CONTENT_BOTTOM - pad * 2 + 2) / leading);
        if (fit < Math.min(remainingLines, 2)) { this.newSlide(); drawHeader(); continue; }
        const chunk = Math.min(fit, remainingLines);
        const h = chunk * leading + pad * 2 - 2;
        const top = this.y;
        if (rowIndex % 2 === 1) this.page.drawRectangle({ x: MARGIN, y: top - h, width: CONTENT_W, height: h, color: ZEBRA });
        let x = MARGIN;
        prepared.forEach((p, i) => {
          const link = p.cell !== undefined && isDocumentLink(p.cell) ? p.cell : null;
          const color = link ? C.turquoiseText : p.status || (i === 0 ? C.navy : C.anthracite);
          const font = i === 0 || p.status ? this.fonts.semibold : this.fonts.regular;
          const tx = x + pad + (p.status ? 11 : 0);
          if (p.status && start === 0) this.page.drawCircle({ x: x + pad + 3.5, y: top - pad - size / 2 + 0.5, size: 3, color: p.status });
          p.lines.slice(start, start + chunk).forEach((line, li) => {
            const ly = top - pad - size + 1 - li * leading;
            this.text(line, tx, ly, size, font, color);
            if (link && line) {
              const lw = font.widthOfTextAtSize(line, size);
              this.page.drawLine({ start: { x: tx, y: ly - 1.6 }, end: { x: tx + lw, y: ly - 1.6 }, thickness: 0.6, color: C.turquoiseText });
              addLinkAnnotation(this.page, link.url, [tx, ly - 2.6, tx + lw, ly + size]);
            }
          });
          x += widths[i];
        });
        this.y = top - h;
        start += chunk;
        if (start < totalLines) { this.newSlide(); drawHeader(); }
      }
      this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: PAGE_W - MARGIN, y: this.y }, thickness: 0.4, color: C.border });
    });
    this.y -= 16;
  }

  private recordCards(table: DocumentTable) {
    const size = 9.6;
    const leading = 13.4;
    const labelSize = 7.4;
    const colGap = 22;
    const innerX = MARGIN + 16;
    const innerW = CONTENT_W - 32;
    const cols = 3;
    const colW = (innerW - colGap * (cols - 1)) / cols;
    table.rows.forEach((row) => {
      const title = cleanGlyphs(row[0] !== undefined ? cellLabel(row[0]) : "");
      const titleLines = wrapLines(title || "—", this.fonts.semibold, 11, innerW);
      const fields = table.headers.slice(1).map((header, i) => {
        const cell = row[i + 1];
        const value = cell === undefined ? "" : cellLabel(cell);
        return { header: header.toLocaleUpperCase("tr"), link: cell !== undefined && isDocumentLink(cell) ? cell : null, lines: wrapLines(value || "—", this.fonts.regular, size, colW) };
      });
      const fieldRows: Array<typeof fields> = [];
      for (let i = 0; i < fields.length; i += cols) fieldRows.push(fields.slice(i, i + cols));
      const rowH = (group: typeof fields) => 12 + Math.max(...group.map((f) => f.lines.length)) * leading + 6;
      this.ensure(16 + titleLines.length * 15 + (fieldRows[0] ? rowH(fieldRows[0]) : 0) + 8);
      let top = this.y;
      let y = top - 14;
      titleLines.forEach((line) => { this.text(line, innerX, y - 11, 11, this.fonts.semibold, C.navy); y -= 15; });
      y -= 4;
      const flushCard = (bottom: number) => {
        this.page.drawRectangle({ x: MARGIN, y: bottom, width: 3, height: top - bottom, color: C.turquoise });
        this.page.drawLine({ start: { x: MARGIN, y: bottom }, end: { x: PAGE_W - MARGIN, y: bottom }, thickness: 0.4, color: C.border });
      };
      for (const group of fieldRows) {
        const h = rowH(group);
        if (y - h < CONTENT_BOTTOM && h < CONTENT_TOP - CONTENT_BOTTOM - 24) { flushCard(y + 2); this.newSlide(); top = this.y; y = top - 8; }
        group.forEach((f, ci) => {
          const x = innerX + ci * (colW + colGap);
          this.text(f.header, x, y - 9, labelSize, this.fonts.semibold, C.muted);
          f.lines.forEach((line, li) => {
            const ly = y - 12 - size - li * leading + 1;
            this.text(line, x, ly, size, this.fonts.regular, f.link ? C.turquoiseText : C.anthracite);
            if (f.link && line) {
              const lw = this.fonts.regular.widthOfTextAtSize(line, size);
              this.page.drawLine({ start: { x, y: ly - 1.6 }, end: { x: x + lw, y: ly - 1.6 }, thickness: 0.6, color: C.turquoiseText });
              addLinkAnnotation(this.page, f.link.url, [x, ly - 2.6, x + lw, ly + size]);
            }
          });
        });
        y -= h;
      }
      flushCard(y - 2);
      this.y = y - 12;
    });
    this.y -= 8;
  }

  // ---------- charts ----------
  private chartLayout(chart: DocumentChart) {
    const data = sanitizeChartData(chart.data, chart.type);
    if (!data) return null;
    const MAX_POINTS = chart.type === "line" ? 24 : chart.type === "hbar" ? 9 : 12;
    const shown = data.slice(0, MAX_POINTS);
    const truncated = data.length > shown.length;
    const captionText = [chart.caption, truncated ? `Grafikte ilk ${shown.length} kalem gösterilmiştir; tamamı tabloda yer alır.` : ""].filter(Boolean).join(" ");
    const captionLines = captionText ? wrapLines(captionText, this.fonts.regular, 9.4, CONTENT_W - 36) : [];
    const plotH = chart.type === "hbar" ? shown.length * 28 + 6 : 220;
    const h = 52 + plotH + (chart.type === "hbar" ? 6 : 36) + captionLines.length * 13 + (captionLines.length ? 10 : 0);
    return { shown, captionLines, plotH, h };
  }

  private chart(chart: DocumentChart) {
    const layout = this.chartLayout(chart);
    if (!layout) return;
    const { shown, captionLines, plotH, h } = layout;
    const format = chart.valueFormat || "number";
    if (h > this.remaining()) this.newSlide();
    const top = this.y;
    this.roundRect(MARGIN, top - h, CONTENT_W, h, 11, { color: C.white, borderColor: C.border, borderWidth: 0.8 });
    this.text(ellipsize(chart.title, this.fonts.semibold, 13, CONTENT_W - 36), MARGIN + 18, top - 28, 13, this.fonts.semibold, C.navy);
    const plotTop = top - 48;
    const plotLeft = MARGIN + 18;
    const plotWidth = CONTENT_W - 36;
    if (chart.type === "bar") this.barChart(shown, format, plotLeft, plotTop, plotWidth, plotH);
    else if (chart.type === "line") this.lineChart(shown, format, plotLeft, plotTop, plotWidth, plotH);
    else if (chart.type === "donut") this.donutChart(shown, format, plotLeft, plotTop, plotWidth, plotH);
    else this.hbarChart(shown, format, plotLeft, plotTop, plotWidth);
    let cy = top - h + 16 + (captionLines.length - 1) * 13;
    for (const line of captionLines) { this.text(line, MARGIN + 18, cy, 9.4, this.fonts.regular, C.muted); cy -= 13; }
    this.y = top - h - 18;
  }

  private axis(values: number[], format: DocumentChart["valueFormat"], left: number, top: number, width: number, height: number) {
    const max = niceAxisMax(Math.max(...values));
    const axisW = 56;
    for (let i = 0; i <= 4; i += 1) {
      const v = (max / 4) * i;
      const y = top - height + (height / 4) * i;
      this.page.drawLine({ start: { x: left + axisW, y }, end: { x: left + width, y }, thickness: i === 0 ? 0.9 : 0.4, color: i === 0 ? C.border : GRID });
      const label = formatAxisValue(v, format || "number");
      const lw = this.fonts.regular.widthOfTextAtSize(label, 8);
      this.text(label, left + axisW - 8 - lw, y - 2.8, 8, this.fonts.regular, C.muted);
    }
    return { max, plotX: left + axisW, plotW: width - axisW };
  }

  private xLabels(labels: string[], x0: number, slot: number, y: number, every = 1) {
    labels.forEach((label, i) => {
      if (i % every !== 0 && i !== labels.length - 1) return;
      const lines = wrapLines(label, this.fonts.regular, 8.2, Math.max(slot - 6, 36)).slice(0, 2);
      lines.forEach((line, li) => {
        const w = this.fonts.regular.widthOfTextAtSize(line, 8.2);
        this.text(line, x0 + slot * i + slot / 2 - w / 2, y - li * 10.5, 8.2, this.fonts.regular, C.muted);
      });
    });
  }

  private barChart(data: Array<{ label: string; value: number }>, format: DocumentChart["valueFormat"], left: number, top: number, width: number, height: number) {
    const { max, plotX, plotW } = this.axis(data.map((d) => d.value), format, left, top - 12, width, height - 14);
    const base = top - height;
    const slot = plotW / data.length;
    const barW = Math.min(slot * 0.52, 60);
    data.forEach((d, i) => {
      const h = (d.value / max) * (height - 14);
      const x = plotX + slot * i + (slot - barW) / 2;
      if (h > 0) this.page.drawRectangle({ x, y: base, width: barW, height: h, color: C.turquoise });
      const label = formatChartValue(d.value, format);
      const lw = this.fonts.semibold.widthOfTextAtSize(label, 8.4);
      this.text(label, x + barW / 2 - lw / 2, base + h + 5, 8.4, this.fonts.semibold, C.anthracite);
    });
    this.xLabels(data.map((d) => d.label), plotX, slot, base - 14);
  }

  private lineChart(data: Array<{ label: string; value: number }>, format: DocumentChart["valueFormat"], left: number, top: number, width: number, height: number) {
    const { max, plotX, plotW } = this.axis(data.map((d) => d.value), format, left, top - 12, width, height - 14);
    const base = top - height;
    const slot = plotW / data.length;
    const pts = data.map((d, i) => ({ x: plotX + slot * i + slot / 2, y: base + (d.value / max) * (height - 14), d }));
    const area = [`M ${pts[0].x - plotX} ${height}`, ...pts.map((p) => `L ${p.x - plotX} ${height - (p.y - base)}`), `L ${pts[pts.length - 1].x - plotX} ${height} Z`].join(" ");
    this.page.drawSvgPath(area, { x: plotX, y: base + height, color: C.turquoise, opacity: 0.1 });
    for (let i = 1; i < pts.length; i += 1) this.page.drawLine({ start: pts[i - 1], end: pts[i], thickness: 2.2, color: C.turquoise });
    const peakIndex = data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0);
    pts.forEach((p, i) => {
      this.page.drawCircle({ x: p.x, y: p.y, size: 3.2, color: C.white, borderColor: C.turquoise, borderWidth: 1.6 });
      if (i === 0 || i === pts.length - 1 || i === peakIndex) {
        const label = formatChartValue(p.d.value, format);
        const lw = this.fonts.semibold.widthOfTextAtSize(label, 8.2);
        const lx = Math.min(Math.max(p.x - lw / 2, plotX), plotX + plotW - lw);
        this.page.drawRectangle({ x: lx - 3, y: p.y + 8, width: lw + 6, height: 12, color: C.white, opacity: 0.94 });
        this.text(label, lx, p.y + 10.5, 8.2, this.fonts.semibold, C.anthracite);
      }
    });
    this.xLabels(data.map((d) => d.label), plotX, slot, base - 14, Math.ceil(data.length / 10));
  }

  private donutChart(data: Array<{ label: string; value: number }>, format: DocumentChart["valueFormat"], left: number, top: number, width: number, height: number) {
    const total = data.reduce((s, d) => s + d.value, 0);
    const R = 86;
    const r = 54;
    const cx = left + R + 16;
    const cy = top - height / 2;
    let angle = 0;
    const point = (radius: number, a: number) => `${(R + radius * Math.sin(a)).toFixed(2)} ${(R - radius * Math.cos(a)).toFixed(2)}`;
    data.forEach((d, i) => {
      const sweep = (d.value / total) * Math.PI * 2;
      if (sweep <= 0) return;
      const steps = Math.max(2, Math.ceil(sweep / (Math.PI / 90)));
      const outer: string[] = [];
      const inner: string[] = [];
      for (let s = 0; s <= steps; s += 1) {
        const a = angle + (sweep * s) / steps;
        outer.push(point(R, a));
        inner.unshift(point(r, a));
      }
      const path = `M ${outer[0]} ${outer.slice(1).map((p) => `L ${p}`).join(" ")} L ${inner[0]} ${inner.slice(1).map((p) => `L ${p}`).join(" ")} Z`;
      this.page.drawSvgPath(path, { x: cx - R, y: cy + R, color: SERIES[i % SERIES.length], borderColor: C.white, borderWidth: 1.2 });
      angle += sweep;
    });
    const totalLabel = formatChartValue(total, format);
    let ts = 14;
    while (ts > 9 && this.fonts.bold.widthOfTextAtSize(totalLabel, ts) > r * 2 - 14) ts -= 0.5;
    const tw = this.fonts.bold.widthOfTextAtSize(totalLabel, ts);
    this.text(totalLabel, cx - tw / 2, cy - 2, ts, this.fonts.bold, C.navy);
    const sub = "Toplam";
    this.text(sub, cx - this.fonts.regular.widthOfTextAtSize(sub, 8.4) / 2, cy - 15, 8.4, this.fonts.regular, C.muted);
    const lx = cx + R + 42;
    const lw = left + width - lx;
    let ly = cy + Math.min(data.length, 8) * 11;
    data.forEach((d, i) => {
      const pct = formatPercentTr((d.value / total) * 100);
      const value = `${formatChartValue(d.value, format)} · ${pct}`;
      this.page.drawRectangle({ x: lx, y: ly - 1, width: 10, height: 10, color: SERIES[i % SERIES.length] });
      const vw = this.fonts.regular.widthOfTextAtSize(value, 9.4);
      this.text(ellipsize(d.label, this.fonts.semibold, 9.8, lw - vw - 30), lx + 16, ly, 9.8, this.fonts.semibold, C.navy);
      this.text(value, left + width - vw, ly, 9.4, this.fonts.regular, C.anthracite);
      ly -= 21;
    });
  }

  private hbarChart(data: Array<{ label: string; value: number }>, format: DocumentChart["valueFormat"], left: number, top: number, width: number) {
    const labelW = 220;
    const valueW = 96;
    const barMaxW = width - labelW - valueW - 10;
    const max = Math.max(...data.map((d) => d.value));
    data.forEach((d, i) => {
      const y = top - i * 28 - 18;
      const label = ellipsize(d.label, this.fonts.regular, 9.6, labelW - 10);
      this.text(label, left, y, 9.6, this.fonts.regular, C.anthracite);
      const w = max > 0 ? (d.value / max) * barMaxW : 0;
      this.roundRect(left + labelW, y - 3, barMaxW, 14, 4, { color: C.surface });
      if (w > 0) this.roundRect(left + labelW, y - 3, Math.max(w, 4), 14, 4, { color: C.turquoise, opacity: i === 0 ? 1 : 0.8 });
      const value = formatChartValue(d.value, format);
      this.text(value, left + labelW + barMaxW + 10, y, 9.6, this.fonts.semibold, C.navy);
    });
  }

  // ---------- document ----------
  /** Rough "heading + first bite of body" height so short, boilerplate
   * sections (e.g. a two-sentence "Bu Rapor Hakkında") can share a slide
   * with whatever precedes them instead of each claiming an almost-empty
   * page of its own — substantial sections (a table/chart/timeline/many
   * metrics) still don't fit the remaining space and naturally get a
   * fresh slide via ensure(). */
  private minSectionHeight(section: DocumentSection): number {
    const headingH = 70;
    if (section.metrics?.length) return headingH + 110;
    if (section.charts?.length) {
      const layout = this.chartLayout(section.charts[0]);
      return headingH + (layout ? Math.min(layout.h, CONTENT_TOP - CONTENT_BOTTOM - headingH) : 180);
    }
    if (section.table) return headingH + 90;
    if (section.timeline?.length) return headingH + 120;
    if (section.callout) return headingH + 90;
    return headingH + 50;
  }

  /** A centered, large-type treatment for the deck's final section when
   * it's plain short prose (e.g. the client report's closing "Sonraki
   * Adım" CTA) — the default left-aligned body style left a lone two-line
   * paragraph stranded with most of the slide empty; a dedicated closing
   * slide reads as intentional instead. Never invents copy: renders
   * exactly the title/text the section already carries. */
  private closingSection(section: DocumentSection) {
    this.newSlide();
    let ty = CONTENT_TOP - 50;
    const titleSize = 28;
    for (const line of wrapLines(section.title, this.fonts.bold, titleSize, CONTENT_W * 0.72)) {
      const w = this.fonts.bold.widthOfTextAtSize(line, titleSize);
      this.text(line, (PAGE_W - w) / 2, ty - titleSize, titleSize, this.fonts.bold, C.navy);
      ty -= titleSize + 8;
    }
    this.page.drawRectangle({ x: (PAGE_W - 44) / 2, y: ty - 2, width: 34, height: 3, color: C.turquoise });
    this.page.drawRectangle({ x: (PAGE_W - 44) / 2 + 34, y: ty - 2, width: 10, height: 3, color: C.gold });
    ty -= 32;
    if (section.text) {
      for (const line of wrapLines(section.text, this.fonts.regular, 14.5, CONTENT_W * 0.64)) {
        const w = this.fonts.regular.widthOfTextAtSize(line, 14.5);
        this.text(line, (PAGE_W - w) / 2, ty - 14.5, 14.5, this.fonts.regular, C.anthracite);
        ty -= 23;
      }
    }
    this.y = ty - 10;
  }

  private section(section: DocumentSection, isLast = false) {
    const hasBody = section.text || section.items?.length || section.table || section.metrics?.length || section.charts?.length || section.callout || section.timeline?.length;
    if (!hasBody) return;
    const textOnlyOverall = section.text && section.text.length <= 420 && !section.items?.length && !section.table && !section.metrics?.length && !section.charts?.length && !section.callout && !section.timeline?.length;
    if (isLast && textOnlyOverall && !isSubsection(section)) {
      this.closingSection(section);
      return;
    }
    if (isSubsection(section)) {
      this.subheading(section.title);
    } else {
      this.ensure(Math.min(this.minSectionHeight(section), CONTENT_TOP - CONTENT_BOTTOM));
      this.sectionHeader(section);
    }
    if (section.metrics?.length) this.metricsGrid(section.metrics);
    for (const chart of section.charts || []) this.chart(chart);
    if (section.text) {
      const textOnly = !section.items?.length && !section.table && !section.callout && !section.timeline?.length;
      if (textOnly && section.text.length > 500) this.paragraphColumns(section.text);
      else this.paragraph(section.text);
    }
    if (section.items?.length) this.bullets(section.items);
    if (section.timeline?.length) this.stepsRow(section.timeline);
    if (section.table) this.table(section.table);
    if (section.callout) this.callout(section.callout);
  }

  private closingNote(note: string) {
    // A note that only repeats branding the cover and every footer already
    // carry ("HK Dijital · hkdijital.com.tr") would otherwise cost the
    // deck a near-blank final slide — never worth its own page.
    if (!note.trim() || isBrandingOnlyNote(note)) return;
    this.newSlide();
    this.y -= 40;
    const lines = wrapLines(note, this.fonts.regular, 13, CONTENT_W - 80);
    const h = lines.length * 20 + 36;
    const top = this.y;
    this.roundRect(MARGIN + 40, top - h, CONTENT_W - 80, h, 12, { color: C.surface, borderColor: C.border, borderWidth: 0.8 });
    let ly = top - 26;
    for (const line of lines) { this.text(line, MARGIN + 64, ly, 13, this.fonts.regular, C.anthracite); ly -= 20; }
    this.y = top - h;
  }

  async render(): Promise<Buffer> {
    await this.drawCover();

    if (this.payload.executiveSummary || this.payload.headlineMetrics?.length) {
      this.newSlide();
      this.sectionHeader({ title: "Yönetici Özeti" } as DocumentSection);
      if (this.payload.executiveSummary) {
        if (!this.payload.headlineMetrics?.length && this.payload.executiveSummary.length > 500) this.paragraphColumns(this.payload.executiveSummary, { size: 13, color: C.navy });
        else this.paragraph(this.payload.executiveSummary, { size: 13, color: C.navy, leading: 20 });
      }
      if (this.payload.headlineMetrics?.length) { this.y -= 8; this.metricsGrid(this.payload.headlineMetrics); }
    }

    this.payload.sections.forEach((section, i) => this.section(section, i === this.payload.sections.length - 1));

    if (this.payload.footerNote) this.closingNote(this.payload.footerNote);

    // Never ship a slide that only carries header/footer chrome.
    for (const page of this.pdf.getPages().slice(1)) {
      if (!this.contentPages.has(page)) this.pdf.removePage(this.pdf.getPages().indexOf(page));
    }

    const pages = this.pdf.getPages();
    const confidential = this.payload.confidentialLabel ? `${this.payload.confidentialLabel.toLocaleUpperCase("tr")} · MÜŞTERİYLE PAYLAŞILMAZ` : null;
    const footerLeft = `${this.payload.customerName || "HK Dijital"} · ${this.runningTitle}`;
    pages.forEach((p, index) => {
      if (index === 0) return; // cover carries its own footer
      this.page = p;
      p.drawLine({ start: { x: MARGIN, y: 46 }, end: { x: PAGE_W - MARGIN, y: 46 }, thickness: 0.6, color: C.border });
      this.text(ellipsize(footerLeft, this.fonts.semibold, 8, 420), MARGIN, 30, 8, this.fonts.semibold, C.muted);
      if (confidential) {
        const w = this.fonts.semibold.widthOfTextAtSize(confidential, 8);
        this.text(confidential, (PAGE_W - w) / 2, 30, 8, this.fonts.semibold, C.coralText);
      }
      const num = String(index + 1).padStart(2, "0");
      this.text(num, PAGE_W - MARGIN - this.fonts.semibold.widthOfTextAtSize(num, 8), 30, 8, this.fonts.semibold, C.navy);
    });

    this.pdf.setTitle(`${displayReportTitle(this.payload.title)} — ${this.payload.customerName}`);
    this.pdf.setAuthor("HK Dijital");
    this.pdf.setCreator("HK Admin");
    this.pdf.setProducer("HK Dijital Premium Wide Presentation System");
    this.pdf.setLanguage("tr-TR");
    return Buffer.from(await this.pdf.save());
  }
}

let fontCache: { regular: Uint8Array; semibold: Uint8Array; bold: Uint8Array } | null = null;
let logoCache: Uint8Array | null | undefined;

function loadAssets() {
  if (!fontCache) {
    fontCache = {
      regular: readFileSync(join(FONT_DIR, "Inter-Regular.ttf")),
      semibold: readFileSync(join(FONT_DIR, "Inter-SemiBold.ttf")),
      bold: readFileSync(join(FONT_DIR, "Inter-Bold.ttf"))
    };
  }
  if (logoCache === undefined) {
    try { logoCache = readFileSync(HK_LOGO_HORIZONTAL_PATH); } catch { logoCache = null; }
  }
  return { fonts: fontCache, logo: logoCache };
}

/** Landscape 16:9 sibling of renderPremiumPdf — same DocumentPayload
 * contract, same brand system, new slide-deck geometry. Used only by
 * callers that explicitly want a presentation-style export (currently Ön
 * İnceleme Merkezi); every other report keeps using renderPremiumPdf
 * unchanged. */
export async function renderPremiumPdfWide(payload: DocumentPayload): Promise<Buffer> {
  const assets = loadAssets();
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fonts: Fonts = {
    regular: await pdf.embedFont(assets.fonts.regular, { subset: true }),
    semibold: await pdf.embedFont(assets.fonts.semibold, { subset: true }),
    bold: await pdf.embedFont(assets.fonts.bold, { subset: true })
  };
  let hkLogo: PDFImage | null = null;
  if (payload.logo !== false && assets.logo) {
    try { hkLogo = await pdf.embedPng(assets.logo); } catch { hkLogo = null; }
  }
  return new PremiumPdfWide(pdf, fonts, hkLogo, payload).render();
}
