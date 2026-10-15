import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument, PDFName, PDFArray, PDFString, rgb, setCharacterSpacing } from "pdf-lib";
import type { PDFFont, PDFImage, PDFPage, RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { isDocumentLink, cellLabel } from "@/lib/document-model";
import type { DocumentCallout, DocumentCell, DocumentChart, DocumentMetric, DocumentPayload, DocumentSection, DocumentTable, DocumentTimelinePhase, DocumentTone } from "@/lib/document-model";
import {
  CHART_SERIES_COLORS, REPORT_COLORS, displayReportTitle, fitLogo, formatAxisValue, formatChartValue, formatPercentTr,
  hexToRgb01, niceAxisMax, sanitizeChartData, splitMetaLine
} from "@/lib/report-design";

// HK Dijital Premium Report System V3 — the single PDF renderer behind
// generatePdfBuffer (document-generator.ts), so every report that already
// builds a DocumentPayload (Ön İnceleme, Reklam Değerlendirme, Strateji,
// Kreatif, Manuel Değerlendirme, Teklif, Aylık Rapor, İçerik Planı,
// Gemini Görünürlük, Analitik Merkezi, Agent Hub) gets the same premium
// design without any of them changing their content.
//
// Rules this file enforces:
//  - Never fetches anything. A client logo arrives already verified and
//    normalized to PNG (DocumentLogo); missing -> HK Dijital logo alone.
//  - Never invents data: charts are drawn only from sanitizeChartData()
//    output (missing values dropped, never zero-filled; negative/too-few
//    points -> no chart).
//  - Logos are only ever scaled proportionally (fitLogo) — never cropped,
//    stretched or recoloured.
//  - Inter (SIL OFL, full static TTFs under assets/fonts) for complete
//    Turkish coverage — ç Ç ğ Ğ ı İ ö Ö ş Ş ü Ü.

const FONT_DIR = join(process.cwd(), "assets", "fonts");
const HK_LOGO_HORIZONTAL_PATH = join(process.cwd(), "src", "assets", "branding", "hk-dijital-logo-horizontal-report.png");

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 52;
const CONTENT_W = PAGE_W - MARGIN * 2;
const HEADER_BAND = 30;
const CONTENT_TOP = PAGE_H - HEADER_BAND - 34;
const CONTENT_BOTTOM = 62;

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

// Inter has no glyph for status emoji / ✓ ☐ ⚠ — strip them so a broken
// "notdef" box never reaches the page; the status WORD always remains.
function cleanGlyphs(text: string): string {
  return text.replace(/[🟢🟡🔴⚪🔵✓✔☐⚠️]/gu, "").replace(/\t/g, "  ");
}

function charSplit(word: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const ch of word) {
    if (current && font.widthOfTextAtSize(current + ch, size) > maxWidth) {
      lines.push(current);
      current = ch;
    } else {
      current += ch;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Word wrap that keeps explicit line breaks and splits over-long tokens (URLs). */
export function wrapLines(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const rawLine of cleanGlyphs(text).split(/\n/)) {
    const words = rawLine.split(/\s+/).filter(Boolean);
    if (!words.length) { out.push(""); continue; }
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) { current = candidate; continue; }
      if (current) out.push(current);
      if (font.widthOfTextAtSize(word, size) > maxWidth) {
        const pieces = charSplit(word, font, size, maxWidth);
        out.push(...pieces.slice(0, -1));
        current = pieces[pieces.length - 1] || "";
      } else {
        current = word;
      }
    }
    if (current) out.push(current);
  }
  while (out.length && out[out.length - 1] === "") out.pop();
  return out;
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

class PremiumPdf {
  private pdf: PDFDocument;
  private fonts: Fonts;
  private hkLogo: PDFImage | null;
  private page!: PDFPage;
  private y = 0;
  private sectionNumber = 0;
  private readonly runningTitle: string;
  private coverPage: PDFPage | null = null;
  private tocTop = 0;
  private toc: Array<{ num: string; title: string; page: number }> = [];

  constructor(pdf: PDFDocument, fonts: Fonts, hkLogo: PDFImage | null, private payload: DocumentPayload) {
    this.pdf = pdf;
    this.fonts = fonts;
    this.hkLogo = hkLogo;
    this.runningTitle = displayReportTitle(payload.title).replace(/\s*[—–-]\s*Dahili Kullanım$/i, "");
  }

  // ---------- primitives ----------
  private text(t: string, x: number, y: number, size: number, font: PDFFont, color: RGB, opacity = 1) {
    this.page.drawText(cleanGlyphs(t), { x, y, size, font, color, opacity });
  }

  private tracked(t: string, x: number, y: number, size: number, font: PDFFont, color: RGB, spacing: number, opacity = 1) {
    this.page.pushOperators(setCharacterSpacing(spacing));
    this.text(t, x, y, size, font, color, opacity);
    this.page.pushOperators(setCharacterSpacing(0));
  }

  private trackedWidth(t: string, size: number, font: PDFFont, spacing: number) {
    return font.widthOfTextAtSize(t, size) + spacing * Math.max(0, [...t].length - 1);
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number, opts: { color?: RGB; borderColor?: RGB; borderWidth?: number; opacity?: number }) {
    this.page.drawSvgPath(roundedRectPath(w, h, r), { x, y: y + h, color: opts.color, borderColor: opts.borderColor, borderWidth: opts.borderWidth, opacity: opts.opacity, borderOpacity: opts.opacity });
  }

  // ---------- page flow ----------
  private newContentPage() {
    this.page = this.pdf.addPage([PAGE_W, PAGE_H]);
    this.page.drawRectangle({ x: 0, y: PAGE_H - HEADER_BAND, width: PAGE_W, height: HEADER_BAND, color: C.navy });
    this.page.drawRectangle({ x: 0, y: PAGE_H - HEADER_BAND - 1.4, width: PAGE_W, height: 1.4, color: C.turquoise });
    if (this.hkLogo) {
      const size = fitLogo(this.hkLogo.width, this.hkLogo.height, 80, 18, 80 * 18);
      this.page.drawImage(this.hkLogo, { x: MARGIN, y: PAGE_H - HEADER_BAND / 2 - size.height / 2, width: size.width, height: size.height });
    }
    const label = this.runningTitle.toLocaleUpperCase("tr");
    const maxW = CONTENT_W - 110;
    const shown = ellipsize(label, this.fonts.semibold, 7, maxW);
    const w = this.trackedWidth(shown, 7, this.fonts.semibold, 0.6);
    this.tracked(shown, PAGE_W - MARGIN - w, PAGE_H - HEADER_BAND / 2 - 2.5, 7, this.fonts.semibold, C.white, 0.6, 0.85);
    this.y = CONTENT_TOP;
  }

  private ensure(height: number) {
    if (this.y - height < CONTENT_BOTTOM) this.newContentPage();
  }

  private remaining() {
    return this.y - CONTENT_BOTTOM;
  }

  // ---------- cover ----------
  private async drawCover() {
    this.page = this.pdf.addPage([PAGE_W, PAGE_H]);
    const heroH = 440;
    const heroBottom = PAGE_H - heroH;
    this.page.drawRectangle({ x: 0, y: heroBottom, width: PAGE_W, height: heroH, color: C.navy });
    // Restrained depth: two soft rings, top-right, clipped by the page edge.
    this.page.drawCircle({ x: PAGE_W - 20, y: PAGE_H - 30, size: 170, borderColor: C.navySoft, borderWidth: 26, borderOpacity: 0.55 });
    this.page.drawCircle({ x: PAGE_W - 20, y: PAGE_H - 30, size: 250, borderColor: C.turquoise, borderWidth: 0.8, borderOpacity: 0.22 });
    this.page.drawRectangle({ x: 0, y: heroBottom - 4, width: PAGE_W, height: 4, color: C.turquoise });
    this.page.drawRectangle({ x: MARGIN, y: heroBottom - 4, width: 70, height: 4, color: C.gold });

    // ----- logos (side by side when a verified client logo exists) -----
    const logoCenterY = PAGE_H - 132;
    const client = this.payload.clientLogo;
    let clientImage: PDFImage | null = null;
    if (client?.png?.length) {
      try { clientImage = await this.pdf.embedPng(client.png); } catch { clientImage = null; }
    }
    if (this.hkLogo && clientImage) {
      const hk = fitLogo(this.hkLogo.width, this.hkLogo.height, 214, 74, 214 * 74);
      const plateW = 168;
      const plateH = 82;
      const inner = fitLogo(clientImage.width, clientImage.height, plateW - 28, plateH - 22);
      const gap = 24;
      const total = hk.width + gap * 2 + plateW;
      const startX = (PAGE_W - total) / 2;
      this.page.drawImage(this.hkLogo, { x: startX, y: logoCenterY - hk.height / 2, width: hk.width, height: hk.height });
      const dividerX = startX + hk.width + gap;
      this.page.drawLine({ start: { x: dividerX, y: logoCenterY - 30 }, end: { x: dividerX, y: logoCenterY + 30 }, thickness: 0.9, color: C.turquoise, opacity: 0.7 });
      const plateX = dividerX + gap;
      this.roundRect(plateX, logoCenterY - plateH / 2, plateW, plateH, 10, { color: C.white });
      this.page.drawImage(clientImage, { x: plateX + (plateW - inner.width) / 2, y: logoCenterY - inner.height / 2, width: inner.width, height: inner.height });
    } else if (this.hkLogo) {
      const hk = fitLogo(this.hkLogo.width, this.hkLogo.height, 300, 104, 300 * 104);
      this.page.drawImage(this.hkLogo, { x: (PAGE_W - hk.width) / 2, y: logoCenterY - hk.height / 2, width: hk.width, height: hk.height });
    }

    // ----- title block (on navy) -----
    const title = displayReportTitle(this.payload.title);
    let titleSize = 27;
    let titleLines = wrapLines(title, this.fonts.bold, titleSize, 440);
    while (titleLines.length > 2 && titleSize > 19) { titleSize -= 2; titleLines = wrapLines(title, this.fonts.bold, titleSize, 440); }
    let ty = PAGE_H - 252;
    if (this.payload.confidentialLabel) {
      const kicker = "DAHİLİ RAPOR";
      const kw = this.trackedWidth(kicker, 8, this.fonts.semibold, 1.6);
      this.tracked(kicker, (PAGE_W - kw) / 2, ty, 8, this.fonts.semibold, C.turquoiseLight, 1.6);
    }
    ty -= 30;
    for (const line of titleLines.slice(0, 3)) {
      const w = this.fonts.bold.widthOfTextAtSize(line, titleSize);
      this.text(line, (PAGE_W - w) / 2, ty, titleSize, this.fonts.bold, C.white);
      ty -= titleSize + 6;
    }
    ty -= 6;
    const nameLines = wrapLines(this.payload.customerName || "", this.fonts.semibold, 15, 440).slice(0, 2);
    for (const line of nameLines) {
      const w = this.fonts.semibold.widthOfTextAtSize(line, 15);
      this.text(line, (PAGE_W - w) / 2, ty, 15, this.fonts.semibold, C.turquoiseLight);
      ty -= 21;
    }
    if (this.payload.period && this.payload.period !== "-") {
      const period = ellipsize(this.payload.period, this.fonts.regular, 10, 440);
      const w = this.fonts.regular.widthOfTextAtSize(period, 10);
      this.text(period, (PAGE_W - w) / 2, ty - 2, 10, this.fonts.regular, C.white, 0.72);
    }

    // ----- report details card (white area) -----
    let cy = heroBottom - 44;
    const meta = (this.payload.metaLines?.length ? this.payload.metaLines : [`Firma: ${this.payload.customerName}`, `Dönem: ${this.payload.period}`])
      .map(splitMetaLine).filter((m) => m.value);
    if (meta.length) {
      const colW = (CONTENT_W - 36) / 2;
      const rows = Math.ceil(meta.length / 2);
      const rowH = 34;
      const cardH = 30 + rows * rowH;
      this.roundRect(MARGIN, cy - cardH, CONTENT_W, cardH, 10, { color: C.surface, borderColor: C.border, borderWidth: 0.6 });
      this.tracked("RAPOR BİLGİLERİ", MARGIN + 18, cy - 20, 7, this.fonts.semibold, C.turquoiseText, 1.2);
      meta.forEach((m, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = MARGIN + 18 + col * (colW + 0);
        const y0 = cy - 40 - row * rowH;
        if (m.label) this.text(ellipsize(m.label, this.fonts.regular, 7.6, colW - 12), x, y0, 7.6, this.fonts.regular, C.muted);
        this.text(ellipsize(m.value, this.fonts.semibold, 10, colW - 12), x, y0 - 13, 10, this.fonts.semibold, C.navy);
      });
      cy -= cardH + 22;
    }

    if (this.payload.confidentialLabel) {
      const label = `${this.payload.confidentialLabel.toLocaleUpperCase("tr")} — MÜŞTERİYLE PAYLAŞILMAZ`;
      const w = this.trackedWidth(label, 7.6, this.fonts.semibold, 0.8) + 28;
      this.roundRect((PAGE_W - w) / 2, cy - 22, w, 22, 11, { borderColor: C.coral, borderWidth: 0.9, color: rgb(1, 1, 1) });
      this.tracked(label, (PAGE_W - w) / 2 + 14, cy - 14.5, 7.6, this.fonts.semibold, C.coralText, 0.8);
      cy -= 44;
    }
    this.coverPage = this.page;
    this.tocTop = cy;

    const tagline = "HK Dijital · Dijital Pazarlama & Büyüme Çözümleri";
    const tw = this.fonts.regular.widthOfTextAtSize(tagline, 8.5);
    this.text(tagline, (PAGE_W - tw) / 2, 52, 8.5, this.fonts.regular, C.muted);
    const site = "hkdijital.com.tr";
    const sw = this.fonts.semibold.widthOfTextAtSize(site, 8.5);
    this.text(site, (PAGE_W - sw) / 2, 39, 8.5, this.fonts.semibold, C.turquoiseText);
  }

  /** "Rapor İçeriği" on the cover — real page numbers, drawn after layout. */
  private drawCoverToc() {
    if (!this.coverPage || !this.toc.length) return;
    this.page = this.coverPage;
    const entries = [...(this.payload.executiveSummary || this.payload.headlineMetrics?.length ? [{ num: "—", title: "Yönetici Özeti", page: 2 }] : []), ...this.toc];
    const rowH = 17;
    const bottom = 86;
    const maxRows = Math.floor((this.tocTop - 24 - bottom) / rowH);
    if (maxRows < 2) return;
    this.tracked("RAPOR İÇERİĞİ", MARGIN, this.tocTop - 8, 7, this.fonts.semibold, C.turquoiseText, 1.2);
    let shown = entries;
    let more = 0;
    if (entries.length > maxRows) { shown = entries.slice(0, maxRows - 1); more = entries.length - shown.length; }
    let y = this.tocTop - 28;
    for (const entry of shown) {
      this.text(entry.num, MARGIN, y, 8.6, this.fonts.semibold, C.turquoiseText);
      const pageLabel = String(entry.page);
      const pw = this.fonts.semibold.widthOfTextAtSize(pageLabel, 8.6);
      const title = ellipsize(entry.title, this.fonts.regular, 9, CONTENT_W - 70);
      this.text(title, MARGIN + 26, y, 9, this.fonts.regular, C.navy);
      const tw = this.fonts.regular.widthOfTextAtSize(title, 9);
      // dotted leader
      for (let x = MARGIN + 30 + tw; x < PAGE_W - MARGIN - pw - 8; x += 4) this.page.drawCircle({ x, y: y + 2.4, size: 0.45, color: C.border });
      this.text(pageLabel, PAGE_W - MARGIN - pw, y, 8.6, this.fonts.semibold, C.navy);
      y -= rowH;
    }
    if (more) this.text(`… ve ${more} bölüm daha`, MARGIN + 26, y, 8.6, this.fonts.regular, C.muted);
  }

  // ---------- blocks ----------
  private paragraph(text: string, opts: { size?: number; font?: PDFFont; color?: RGB; width?: number; x?: number; leading?: number } = {}) {
    const size = opts.size ?? 9.8;
    const font = opts.font ?? this.fonts.regular;
    const leading = opts.leading ?? size * 1.5;
    const width = opts.width ?? CONTENT_W;
    const x = opts.x ?? MARGIN;
    const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    for (const p of paragraphs) {
      for (const line of wrapLines(p, font, size, width)) {
        this.ensure(leading);
        if (line) this.text(line, x, this.y - size, size, font, opts.color ?? C.anthracite);
        this.y -= leading;
      }
      this.y -= size * 0.6;
    }
  }

  private bullets(items: string[]) {
    const size = 9.6;
    const leading = 14.2;
    for (const raw of items) {
      const indentLevel = (raw.match(/^( {2})+/)?.[0].length || 0) / 2;
      const item = raw.trim().replace(/^[•·\-–]\s+/, "");
      if (!item) continue;
      const x = MARGIN + 14 + indentLevel * 12;
      const lines = wrapLines(item, this.fonts.regular, size, CONTENT_W - (x - MARGIN));
      lines.forEach((line, i) => {
        this.ensure(leading);
        if (i === 0) {
          const dotColor = indentLevel ? C.border : C.turquoise;
          this.page.drawRectangle({ x: x - 10, y: this.y - size + 2.6, width: 3.6, height: 3.6, color: dotColor });
        }
        this.text(line, x, this.y - size, size, this.fonts.regular, C.anthracite);
        this.y -= leading;
      });
      this.y -= 2.5;
    }
    this.y -= 4;
  }

  private heading(section: DocumentSection) {
    const sub = isSubsection(section);
    if (sub) {
      this.ensure(56);
      this.y -= 6;
      this.page.drawRectangle({ x: MARGIN, y: this.y - 10.5, width: 3, height: 11, color: C.turquoise });
      const lines = wrapLines(section.title, this.fonts.semibold, 11.5, CONTENT_W - 10);
      for (const line of lines) {
        this.text(line, MARGIN + 9, this.y - 10, 11.5, this.fonts.semibold, C.navy);
        this.y -= 16;
      }
      this.y -= 4;
      return;
    }
    if (section.pageBreakBefore && this.y < CONTENT_TOP - 1) this.newContentPage();
    this.ensure(110);
    this.sectionNumber += 1;
    this.y -= 8;
    const num = String(this.sectionNumber).padStart(2, "0");
    this.toc.push({ num, title: section.title, page: this.pdf.getPageCount() });
    this.tracked(num, MARGIN, this.y - 9, 8.5, this.fonts.semibold, C.turquoiseText, 1);
    this.y -= 14;
    const size = section.titleSize && section.titleSize < 13 ? 13 : 15;
    for (const line of wrapLines(section.title, this.fonts.bold, size, CONTENT_W)) {
      this.text(line, MARGIN, this.y - size, size, this.fonts.bold, C.navy);
      this.y -= size + 5;
    }
    this.page.drawRectangle({ x: MARGIN, y: this.y - 3, width: 34, height: 2, color: C.turquoise });
    this.page.drawLine({ start: { x: MARGIN + 38, y: this.y - 2 }, end: { x: PAGE_W - MARGIN, y: this.y - 2 }, thickness: 0.5, color: C.border });
    this.y -= 14;
  }

  private metricsGrid(metrics: DocumentMetric[]) {
    const list = metrics.filter((m) => m && m.label && m.value);
    if (!list.length) return;
    const longest = Math.max(...list.map((m) => m.value.length));
    const perRow = Math.min(list.length, longest > 18 ? 2 : longest > 13 ? 3 : 4);
    const gap = 10;
    const cardW = (CONTENT_W - gap * (perRow - 1)) / perRow;
    const hasNote = list.some((m) => m.note);
    // Labels wrap (max 2 lines) instead of being cut off.
    const labelLines = (m: DocumentMetric) => wrapLines(m.label.toLocaleUpperCase("tr"), this.fonts.semibold, 6.8, cardW - 30).slice(0, 2);
    const extraLabel = Math.max(...list.map((m) => labelLines(m).length)) > 1 ? 9 : 0;
    const cardH = (hasNote ? 74 : 60) + extraLabel;
    for (let start = 0; start < list.length; start += perRow) {
      this.ensure(cardH + 10);
      const row = list.slice(start, start + perRow);
      row.forEach((m, i) => {
        const x = MARGIN + i * (cardW + gap);
        const top = this.y;
        const tone = toneColor(m.tone);
        this.roundRect(x, top - cardH, cardW, cardH, 8, { color: C.surface, borderColor: C.border, borderWidth: 0.5 });
        this.page.drawRectangle({ x: x + 12, y: top - 3, width: 22, height: 2.2, color: tone.bar });
        const labels = labelLines(m);
        labels.forEach((line, li) => this.tracked(line, x + 12, top - 17 - li * 9, 6.8, this.fonts.semibold, C.muted, 0.3));
        let size = 17;
        while (size > 10 && this.fonts.bold.widthOfTextAtSize(cleanGlyphs(m.value), size) > cardW - 24) size -= 1;
        this.text(ellipsize(m.value, this.fonts.bold, size, cardW - 24), x + 12, top - 19 - extraLabel - size - 4, size, this.fonts.bold, C.navy);
        if (m.note) {
          const noteLines = wrapLines(m.note, this.fonts.regular, 7.4, cardW - 24).slice(0, 2);
          noteLines.forEach((line, li) => this.text(line, x + 12, top - cardH + 18 - li * 9.5 + (noteLines.length > 1 ? 0 : -4), 7.4, this.fonts.regular, m.tone && m.tone !== "neutral" ? tone.text : C.muted));
        }
      });
      this.y -= cardH + 10;
    }
    this.y -= 4;
  }

  private callout(callout: DocumentCallout) {
    const tone = toneColor(callout.tone);
    const width = CONTENT_W - 30;
    const titleLines = callout.title ? wrapLines(callout.title, this.fonts.semibold, 9.6, width) : [];
    const textLines = wrapLines(callout.text, this.fonts.regular, 9.2, width);
    const h = 18 + titleLines.length * 13 + textLines.length * 13.4 + (titleLines.length ? 3 : 0);
    if (h > this.remaining() && h < CONTENT_TOP - CONTENT_BOTTOM) this.newContentPage();
    const top = this.y;
    this.page.drawRectangle({ x: MARGIN, y: top - h, width: CONTENT_W, height: h, color: tone.bar, opacity: 0.07 });
    this.page.drawRectangle({ x: MARGIN, y: top - h, width: 3, height: h, color: tone.bar });
    let ly = top - 12;
    for (const line of titleLines) { this.text(line, MARGIN + 16, ly - 8, 9.6, this.fonts.semibold, tone.text); ly -= 13; }
    if (titleLines.length) ly -= 3;
    for (const line of textLines) { this.text(line, MARGIN + 16, ly - 8, 9.2, this.fonts.regular, C.anthracite); ly -= 13.4; }
    this.y = top - h - 12;
  }

  private timeline(phases: DocumentTimelinePhase[]) {
    const list = phases.filter((p) => p.label && p.items?.length);
    if (!list.length) return;
    for (let start = 0; start < list.length; start += 4) {
      const row = list.slice(start, start + 4);
      const colW = CONTENT_W / row.length;
      const textW = colW - 16;
      const heights = row.map((p) => {
        const labelLines = wrapLines(p.label, this.fonts.semibold, 9.6, textW).length;
        const itemLines = p.items.reduce((s, it) => s + wrapLines(it, this.fonts.regular, 8.6, textW - 9).length, 0);
        return 26 + labelLines * 13 + itemLines * 12 + p.items.length * 3;
      });
      const h = Math.max(...heights);
      this.ensure(Math.min(h, CONTENT_TOP - CONTENT_BOTTOM - 10));
      const top = this.y;
      this.page.drawLine({ start: { x: MARGIN + 6, y: top - 6 }, end: { x: MARGIN + CONTENT_W - colW + 6, y: top - 6 }, thickness: 1, color: C.border });
      row.forEach((phase, i) => {
        const x = MARGIN + i * colW;
        this.page.drawCircle({ x: x + 6, y: top - 6, size: 5, color: i === 0 ? C.turquoise : C.white, borderColor: C.turquoise, borderWidth: 1.4 });
        let ly = top - 24;
        for (const line of wrapLines(phase.label, this.fonts.semibold, 9.6, textW)) { this.text(line, x, ly, 9.6, this.fonts.semibold, C.navy); ly -= 13; }
        ly -= 2;
        for (const item of phase.items) {
          const lines = wrapLines(item, this.fonts.regular, 8.6, textW - 9);
          this.page.drawRectangle({ x, y: ly + 2.5, width: 3, height: 3, color: C.turquoise });
          for (const line of lines) {
            if (ly < CONTENT_BOTTOM) break;
            this.text(line, x + 9, ly, 8.6, this.fonts.regular, C.anthracite);
            ly -= 12;
          }
          ly -= 3;
        }
      });
      this.y = top - h - 8;
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
      // A header word is never split: its full width is the column floor.
      let longestWord = Math.max(0, ...header.split(/\s+/).map((w) => this.fonts.semibold.widthOfTextAtSize(w, size - 0.4)));
      let longestText = this.fonts.semibold.widthOfTextAtSize(header, size - 0.4);
      const bodyFont = c === 0 || c === statusCol ? this.fonts.semibold : this.fonts.regular;
      const extra = c === statusCol ? 9 : 0;
      for (const row of table.rows) {
        const t = cleanGlyphs(row[c] !== undefined ? cellLabel(row[c]) : "");
        // A short link label ("Bağlantıyı Aç") is kept on one line.
        if (row[c] !== undefined && isDocumentLink(row[c]) && t.length <= 28) longestWord = Math.max(longestWord, bodyFont.widthOfTextAtSize(t, size));
        for (const word of t.split(/\s+/)) longestWord = Math.max(longestWord, Math.min(bodyFont.widthOfTextAtSize(word, size) + extra, 120));
        longestText = Math.max(longestText, bodyFont.widthOfTextAtSize(t, size) + extra);
      }
      minW.push(Math.max(40, longestWord + 13));
      want.push(Math.max(40, Math.min(longestText + 13, 300)));
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

  private table(table: DocumentTable) {
    if (!table.headers.length) return;
    let size = table.headers.length > 5 ? 7.9 : 8.5;
    // Wide tables: step the type down until every header word fits whole.
    while (size > 6.8 && this.columnWidths(table, size).some((w, i) => {
      const header = cleanGlyphs(table.headers[i]).toLocaleUpperCase("tr");
      return Math.max(...header.split(/\s+/).map((word) => this.fonts.semibold.widthOfTextAtSize(word, size - 0.4))) > w - 12;
    })) size -= 0.3;
    const leading = size + 3.6;
    const pad = 6;
    const widths = this.columnWidths(table, size);
    const statusCol = table.headers.findIndex((h) => /^durum$/i.test(h.trim()));
    const MAX_CELL_LINES = 42;

    const headerSize = size - 0.4;
    const cellLines = (cell: DocumentCell | undefined, w: number, font: PDFFont, indent: number, fontSize = size) => {
      const lines = wrapLines(cellLabel(cell ?? ""), font, fontSize, w - pad * 2 - indent);
      return lines.length > MAX_CELL_LINES ? [...lines.slice(0, MAX_CELL_LINES - 1), "…"] : lines;
    };

    const drawHeader = () => {
      const lines = table.headers.map((h, i) => cellLines(h.toLocaleUpperCase("tr"), widths[i], this.fonts.semibold, 0, headerSize));
      const h = Math.max(...lines.map((l) => l.length), 1) * leading + pad * 2 - 2;
      this.ensure(h + 26);
      const top = this.y;
      this.roundRect(MARGIN, top - h, CONTENT_W, h, 5, { color: C.navy });
      let x = MARGIN;
      lines.forEach((l, i) => {
        l.forEach((line, li) => this.text(line, x + pad, top - pad - size + 1 - li * leading, headerSize, this.fonts.semibold, C.white));
        x += widths[i];
      });
      this.y = top - h;
    };

    // Keep short tables (≤ ~45% of a page) in one piece instead of leaving
    // a header and a single row stranded at the bottom of a page.
    const estimate = (table.rows.length + 1) * (leading + pad * 2) + 10;
    if (estimate < (CONTENT_TOP - CONTENT_BOTTOM) * 0.45 && estimate > this.remaining() && this.y < CONTENT_TOP - 1) this.newContentPage();
    drawHeader();
    table.rows.forEach((row, rowIndex) => {
      const prepared = table.headers.map((_, i) => {
        const cell = row[i];
        const text = cell === undefined ? "" : cellLabel(cell);
        const status = !isDocumentLink(cell ?? "") && i === statusCol ? STATUS_COLORS.find(([re]) => re.test(text))?.[1] || null : null;
        return { cell, status, lines: cellLines(cell, widths[i], this.fonts.regular, status ? 9 : 0) };
      });
      const h = Math.max(...prepared.map((p) => p.lines.length), 1) * leading + pad * 2 - 2;
      if (this.y - h < CONTENT_BOTTOM) { this.newContentPage(); drawHeader(); }
      const top = this.y;
      if (rowIndex % 2 === 1) this.page.drawRectangle({ x: MARGIN, y: top - h, width: CONTENT_W, height: h, color: ZEBRA });
      let x = MARGIN;
      prepared.forEach((p, i) => {
        const link = p.cell !== undefined && isDocumentLink(p.cell) ? p.cell : null;
        const color = link ? C.turquoiseText : p.status || (i === 0 ? C.navy : C.anthracite);
        const font = i === 0 || p.status ? this.fonts.semibold : this.fonts.regular;
        const tx = x + pad + (p.status ? 9 : 0);
        if (p.status) this.page.drawCircle({ x: x + pad + 3, y: top - pad - size / 2 + 0.5, size: 2.6, color: p.status });
        p.lines.forEach((line, li) => {
          const ly = top - pad - size + 1 - li * leading;
          this.text(line, tx, ly, size, font, color);
          if (link && line) {
            const lw = font.widthOfTextAtSize(line, size);
            this.page.drawLine({ start: { x: tx, y: ly - 1.4 }, end: { x: tx + lw, y: ly - 1.4 }, thickness: 0.5, color: C.turquoiseText });
            addLinkAnnotation(this.page, link.url, [tx, ly - 2, tx + lw, ly + size]);
          }
        });
        x += widths[i];
      });
      this.y = top - h;
      this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: PAGE_W - MARGIN, y: this.y }, thickness: 0.4, color: C.border });
    });
    this.y -= 14;
  }

  // ---------- charts ----------
  private chart(chart: DocumentChart) {
    const data = sanitizeChartData(chart.data, chart.type);
    if (!data) return; // not enough real data -> no chart (never a fake one)
    const MAX_POINTS = chart.type === "line" ? 24 : 12;
    const shown = data.slice(0, MAX_POINTS);
    const truncated = data.length > shown.length;
    const format = chart.valueFormat || "number";
    const captionText = [chart.caption, truncated ? `Grafikte ilk ${shown.length} kalem gösterilmiştir; tamamı tabloda yer alır.` : ""].filter(Boolean).join(" ");
    const captionLines = captionText ? wrapLines(captionText, this.fonts.regular, 8.2, CONTENT_W - 28) : [];
    const plotH = chart.type === "hbar" ? shown.length * 22 + 4 : chart.type === "donut" ? 150 : 150;
    const h = 40 + plotH + (chart.type === "hbar" ? 4 : 30) + captionLines.length * 11.5 + (captionLines.length ? 8 : 0);
    if (h > this.remaining()) this.newContentPage();
    const top = this.y;
    this.roundRect(MARGIN, top - h, CONTENT_W, h, 9, { color: C.white, borderColor: C.border, borderWidth: 0.7 });
    this.text(ellipsize(chart.title, this.fonts.semibold, 10.5, CONTENT_W - 28), MARGIN + 14, top - 22, 10.5, this.fonts.semibold, C.navy);
    const plotTop = top - 38;
    const plotLeft = MARGIN + 14;
    const plotWidth = CONTENT_W - 28;
    if (chart.type === "bar") this.barChart(shown, format, plotLeft, plotTop, plotWidth, plotH);
    else if (chart.type === "line") this.lineChart(shown, format, plotLeft, plotTop, plotWidth, plotH);
    else if (chart.type === "donut") this.donutChart(shown, format, plotLeft, plotTop, plotWidth, plotH);
    else this.hbarChart(shown, format, plotLeft, plotTop, plotWidth);
    let cy = top - h + 12 + (captionLines.length - 1) * 11.5;
    for (const line of captionLines) { this.text(line, MARGIN + 14, cy, 8.2, this.fonts.regular, C.muted); cy -= 11.5; }
    this.y = top - h - 14;
  }

  private axis(values: number[], format: DocumentChart["valueFormat"], left: number, top: number, width: number, height: number) {
    const max = niceAxisMax(Math.max(...values));
    const axisW = 44;
    for (let i = 0; i <= 4; i += 1) {
      const v = (max / 4) * i;
      const y = top - height + (height / 4) * i;
      this.page.drawLine({ start: { x: left + axisW, y }, end: { x: left + width, y }, thickness: i === 0 ? 0.8 : 0.4, color: i === 0 ? C.border : GRID });
      const label = formatAxisValue(v, format || "number");
      const lw = this.fonts.regular.widthOfTextAtSize(label, 6.8);
      this.text(label, left + axisW - 6 - lw, y - 2.4, 6.8, this.fonts.regular, C.muted);
    }
    return { max, plotX: left + axisW, plotW: width - axisW };
  }

  private xLabels(labels: string[], x0: number, slot: number, y: number, every = 1) {
    labels.forEach((label, i) => {
      if (i % every !== 0 && i !== labels.length - 1) return;
      const lines = wrapLines(label, this.fonts.regular, 7, Math.max(slot - 4, 30)).slice(0, 2);
      if (wrapLines(label, this.fonts.regular, 7, Math.max(slot - 4, 30)).length > 2) lines[1] = ellipsize(`${lines[1]} …`, this.fonts.regular, 7, Math.max(slot - 4, 30));
      lines.forEach((line, li) => {
        const w = this.fonts.regular.widthOfTextAtSize(line, 7);
        this.text(line, x0 + slot * i + slot / 2 - w / 2, y - li * 9, 7, this.fonts.regular, C.muted);
      });
    });
  }

  private barChart(data: Array<{ label: string; value: number }>, format: DocumentChart["valueFormat"], left: number, top: number, width: number, height: number) {
    const { max, plotX, plotW } = this.axis(data.map((d) => d.value), format, left, top - 10, width, height - 10);
    const base = top - height;
    const slot = plotW / data.length;
    const barW = Math.min(slot * 0.56, 44);
    const peak = Math.max(...data.map((d) => d.value));
    data.forEach((d, i) => {
      const h = (d.value / max) * (height - 10);
      const x = plotX + slot * i + (slot - barW) / 2;
      if (h > 0) this.page.drawRectangle({ x, y: base, width: barW, height: h, color: d.value === peak ? C.turquoise : C.turquoise, opacity: d.value === peak ? 1 : 0.72 });
      let label = formatChartValue(d.value, format);
      if (this.fonts.semibold.widthOfTextAtSize(label, 7.2) > slot - 2) label = formatAxisValue(d.value, format);
      const lw = this.fonts.semibold.widthOfTextAtSize(label, 7.2);
      this.text(label, x + barW / 2 - lw / 2, base + h + 4, 7.2, this.fonts.semibold, C.anthracite);
    });
    this.xLabels(data.map((d) => d.label), plotX, slot, base - 12);
  }

  private lineChart(data: Array<{ label: string; value: number }>, format: DocumentChart["valueFormat"], left: number, top: number, width: number, height: number) {
    const { max, plotX, plotW } = this.axis(data.map((d) => d.value), format, left, top - 10, width, height - 10);
    const base = top - height;
    const slot = plotW / data.length;
    const pts = data.map((d, i) => ({ x: plotX + slot * i + slot / 2, y: base + (d.value / max) * (height - 10), d }));
    // Area wash (very light) + line + points.
    const area = [`M ${pts[0].x - plotX} ${height}`, ...pts.map((p) => `L ${p.x - plotX} ${height - (p.y - base)}`), `L ${pts[pts.length - 1].x - plotX} ${height} Z`].join(" ");
    this.page.drawSvgPath(area, { x: plotX, y: base + height, color: C.turquoise, opacity: 0.08 });
    for (let i = 1; i < pts.length; i += 1) this.page.drawLine({ start: pts[i - 1], end: pts[i], thickness: 1.8, color: C.turquoise });
    const peakIndex = data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0);
    pts.forEach((p, i) => {
      this.page.drawCircle({ x: p.x, y: p.y, size: 2.6, color: C.white, borderColor: C.turquoise, borderWidth: 1.4 });
      if (i === 0 || i === pts.length - 1 || i === peakIndex) {
        const label = formatChartValue(p.d.value, format);
        const lw = this.fonts.semibold.widthOfTextAtSize(label, 7);
        const lx = Math.min(Math.max(p.x - lw / 2, plotX), plotX + plotW - lw);
        this.page.drawRectangle({ x: lx - 2, y: p.y + 6, width: lw + 4, height: 10, color: C.white, opacity: 0.92 });
        this.text(label, lx, p.y + 8.5, 7, this.fonts.semibold, C.anthracite);
      }
    });
    this.xLabels(data.map((d) => d.label), plotX, slot, base - 12, Math.ceil(data.length / 8));
  }

  private donutChart(data: Array<{ label: string; value: number }>, format: DocumentChart["valueFormat"], left: number, top: number, width: number, height: number) {
    const total = data.reduce((s, d) => s + d.value, 0);
    const R = 66;
    const r = 42;
    const cx = left + R + 10;
    const cy = top - height / 2;
    // Angles run clockwise from 12 o'clock; points are in the SVG (y-down)
    // space of the donut's bounding box, whose top-left is (cx-R, cy+R).
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
      this.page.drawSvgPath(path, { x: cx - R, y: cy + R, color: SERIES[i % SERIES.length], borderColor: C.white, borderWidth: 1 });
      angle += sweep;
    });
    const totalLabel = formatChartValue(total, format);
    let ts = 10.5;
    while (ts > 7 && this.fonts.bold.widthOfTextAtSize(totalLabel, ts) > r * 2 - 10) ts -= 0.5;
    const tw = this.fonts.bold.widthOfTextAtSize(totalLabel, ts);
    this.text(totalLabel, cx - tw / 2, cy - 1, ts, this.fonts.bold, C.navy);
    const sub = "Toplam";
    this.text(sub, cx - this.fonts.regular.widthOfTextAtSize(sub, 7) / 2, cy - 12, 7, this.fonts.regular, C.muted);
    // Legend
    const lx = cx + R + 34;
    const lw = left + width - lx;
    let ly = cy + Math.min(data.length, 8) * 9;
    data.forEach((d, i) => {
      const pct = formatPercentTr((d.value / total) * 100);
      const value = `${formatChartValue(d.value, format)} · ${pct}`;
      this.page.drawRectangle({ x: lx, y: ly - 1, width: 8, height: 8, color: SERIES[i % SERIES.length] });
      const vw = this.fonts.regular.widthOfTextAtSize(value, 8.2);
      this.text(ellipsize(d.label, this.fonts.semibold, 8.4, lw - vw - 26), lx + 14, ly, 8.4, this.fonts.semibold, C.navy);
      this.text(value, left + width - vw, ly, 8.2, this.fonts.regular, C.anthracite);
      ly -= 18;
    });
  }

  private hbarChart(data: Array<{ label: string; value: number }>, format: DocumentChart["valueFormat"], left: number, top: number, width: number) {
    const labelW = 150;
    const valueW = 78;
    const barMaxW = width - labelW - valueW - 8;
    const max = Math.max(...data.map((d) => d.value));
    data.forEach((d, i) => {
      const y = top - i * 22 - 14;
      const label = ellipsize(d.label, this.fonts.regular, 8.2, labelW - 8);
      this.text(label, left, y, 8.2, this.fonts.regular, C.anthracite);
      const w = max > 0 ? (d.value / max) * barMaxW : 0;
      this.roundRect(left + labelW, y - 2.5, barMaxW, 11, 3, { color: C.surface });
      if (w > 0) this.roundRect(left + labelW, y - 2.5, Math.max(w, 3), 11, 3, { color: i === 0 ? C.turquoise : C.turquoise, opacity: i === 0 ? 1 : 0.75 });
      const value = formatChartValue(d.value, format);
      this.text(value, left + labelW + barMaxW + 8, y, 8.2, this.fonts.semibold, C.navy);
    });
  }

  // ---------- document ----------
  private section(section: DocumentSection) {
    const hasBody = section.text || section.items?.length || section.table || section.metrics?.length || section.charts?.length || section.callout || section.timeline?.length;
    if (!hasBody) return;
    if (section.spacingBefore) this.y -= section.spacingBefore;
    if (section.minSpaceBefore) this.ensure(section.minSpaceBefore);
    this.heading(section);
    if (section.intro) this.paragraph(section.intro, { size: 9, color: C.muted });
    if (section.metrics?.length) this.metricsGrid(section.metrics);
    for (const chart of section.charts || []) this.chart(chart);
    if (section.text) this.paragraph(section.text);
    if (section.items?.length) this.bullets(section.items);
    if (section.timeline?.length) this.timeline(section.timeline);
    if (section.table) this.table(section.table);
    if (section.callout) this.callout(section.callout);
    this.y -= 6;
  }

  async render(): Promise<Buffer> {
    await this.drawCover();
    this.newContentPage();

    if (this.payload.executiveSummary || this.payload.headlineMetrics?.length) {
      this.tracked("YÖNETİCİ ÖZETİ", MARGIN, this.y - 9, 8.5, this.fonts.semibold, C.turquoiseText, 1.4);
      this.y -= 26;
      if (this.payload.executiveSummary) {
        const before = this.y;
        this.paragraph(this.payload.executiveSummary, { size: 10.6, color: C.navy, leading: 16.2, x: MARGIN + 14, width: CONTENT_W - 14 });
        // Accent rule alongside the summary's first page portion.
        const bottom = Math.max(this.y + 8, CONTENT_BOTTOM);
        if (before > bottom) this.page.drawRectangle({ x: MARGIN, y: bottom, width: 2.4, height: Math.min(before - bottom, before - CONTENT_BOTTOM), color: C.turquoise });
        this.y -= 6;
      }
      if (this.payload.headlineMetrics?.length) this.metricsGrid(this.payload.headlineMetrics);
      this.y -= 6;
    }

    for (const section of this.payload.sections) this.section(section);

    if (this.payload.footerNote) {
      const lines = wrapLines(this.payload.footerNote, this.fonts.regular, 8.2, CONTENT_W - 28);
      const h = 18 + lines.length * 11;
      this.ensure(h + 8);
      this.y -= 6;
      this.roundRect(MARGIN, this.y - h, CONTENT_W, h, 7, { color: C.surface });
      lines.forEach((line, i) => this.text(line, MARGIN + 14, this.y - 14 - i * 11, 8.2, this.fonts.regular, C.muted));
      this.y -= h;
    }

    this.drawCoverToc();

    // Footers (needs the final page count).
    const pages = this.pdf.getPages();
    const left = this.payload.confidentialLabel ? `${this.payload.confidentialLabel.toLocaleUpperCase("tr")} · MÜŞTERİYLE PAYLAŞILMAZ` : "HK Dijital · hkdijital.com.tr";
    pages.forEach((p, index) => {
      if (index === 0) return; // cover carries its own footer
      this.page = p;
      p.drawLine({ start: { x: MARGIN, y: 42 }, end: { x: PAGE_W - MARGIN, y: 42 }, thickness: 0.5, color: C.border });
      this.text(ellipsize(left, this.fonts.semibold, 7, 200), MARGIN, 29, 7, this.fonts.semibold, this.payload.confidentialLabel ? C.coralText : C.muted);
      const center = ellipsize(this.payload.customerName || "", this.fonts.regular, 7, 150);
      this.text(center, (PAGE_W - this.fonts.regular.widthOfTextAtSize(center, 7)) / 2, 29, 7, this.fonts.regular, C.muted);
      const num = `Sayfa ${index + 1} / ${pages.length}`;
      this.text(num, PAGE_W - MARGIN - this.fonts.semibold.widthOfTextAtSize(num, 7), 29, 7, this.fonts.semibold, C.navy);
    });

    this.pdf.setTitle(`${displayReportTitle(this.payload.title)} — ${this.payload.customerName}`);
    this.pdf.setAuthor("HK Dijital");
    this.pdf.setCreator("HK Admin");
    this.pdf.setProducer("HK Dijital Premium Report System");
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

export async function renderPremiumPdf(payload: DocumentPayload): Promise<Buffer> {
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
  return new PremiumPdf(pdf, fonts, hkLogo, payload).render();
}
