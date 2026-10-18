import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument, PDFName, PDFArray, PDFNull, PDFString, rgb, setCharacterSpacing } from "pdf-lib";
import type { PDFFont, PDFImage, PDFPage, RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { isDocumentLink, cellLabel } from "@/lib/document-model";
import type { DocumentCallout, DocumentCell, DocumentChart, DocumentMetric, DocumentPayload, DocumentSection, DocumentTable, DocumentTimelinePhase, DocumentTone } from "@/lib/document-model";
import {
  CHART_SERIES_COLORS, REPORT_COLORS, displayReportTitle, fitLogo, formatAxisValue, formatChartValue, formatPercentTr,
  hexToRgb01, niceAxisMax, sanitizeChartData, splitMetaLine
} from "@/lib/report-design";
import { cleanTurkishTypography } from "@/lib/turkish-text";
import { analyzeLogoBackground } from "@/lib/server/logo-image";

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
  // Spacing/Unicode clean-up only (turkish-text.ts) — never changes words.
  for (const rawLine of cleanTurkishTypography(cleanGlyphs(text)).split(/\n/)) {
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

/** Clickable contents row → jumps to `target` (a GoTo destination). */
function addInternalLink(pdf: PDFDocument, page: PDFPage, target: PDFPage, rect: [number, number, number, number]) {
  const context = pdf.context;
  const dest = context.obj([target.ref, PDFName.of("XYZ"), PDFNull, PDFNull, PDFNull]);
  const annotationRef = context.register(context.obj({ Type: "Annot", Subtype: "Link", Rect: rect, Border: [0, 0, 0], Dest: dest }));
  const existing = page.node.lookup(PDFName.of("Annots"));
  const annots = existing instanceof PDFArray ? existing : context.obj([]);
  annots.push(annotationRef);
  page.node.set(PDFName.of("Annots"), annots);
}

/** A closing note that only repeats branding the page footer already
 * carries ("HK Dijital · hkdijital.com.tr") — never worth its own page. */
export function isBrandingOnlyNote(note: string): boolean {
  const rest = note
    .replace(/(?:https?:\/\/)?(?:www\.)?hkdijital\.com\.tr/gi, "")
    .replace(/HK\s*Dijital/gi, "")
    .replace(/Dahili Operasyon Belgesi|Dahili Kullanım|Müşteriyle Paylaşılmaz|Dijital Pazarlama\s*&\s*Büyüme Çözümleri|AI Görünürlük Merkezi/gi, "")
    .replace(/[\s·|—–\-:,.]+/g, "");
  return rest.length === 0;
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
  /** Every heading in reading order; `page` is the page object (not an
   * index) so pages inserted/removed later never desynchronize it. */
  private toc: Array<{ level: 1 | 2; num: string; title: string; page: PDFPage }> = [];
  /** Pages that received real content (text). Decoration (header band,
   * footer) never counts — a page left without content is removed. */
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
    this.decorate(this.pdf.addPage([PAGE_W, PAGE_H]));
    this.y = CONTENT_TOP;
  }

  /** Header band on a content/contents page — decoration only. */
  private decorate(page: PDFPage) {
    this.page = page;
    this.decorating = true;
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
    this.decorating = false;
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
    let clientBackground = { transparent: false, light: false };
    if (client?.png?.length) {
      try { clientImage = await this.pdf.embedPng(client.png); } catch { clientImage = null; }
      if (clientImage) {
        try { clientBackground = await analyzeLogoBackground(Buffer.from(client.png)); } catch { /* keep the conservative default: no added plate, logo drawn as-is */ }
      }
    }
    if (this.hkLogo && clientImage) {
      const hk = fitLogo(this.hkLogo.width, this.hkLogo.height, 214, 74, 214 * 74);
      // Same visual envelope as HK's own logo box (no padding stolen from
      // it first, no 0.55-of-box area attenuation) — this is the actual
      // fix for "tiny, barely visible" client logos: the old plate
      // reserved 168×82 then carved 28/22px of padding off that BEFORE
      // fitting, then fitLogo's own default area-ratio shrank it further.
      const envelopeW = 190;
      const envelopeH = 78;
      const clientFit = fitLogo(clientImage.width, clientImage.height, envelopeW, envelopeH, envelopeW * envelopeH);
      const gap = 24;
      const total = hk.width + gap * 2 + envelopeW;
      const startX = (PAGE_W - total) / 2;
      this.page.drawImage(this.hkLogo, { x: startX, y: logoCenterY - hk.height / 2, width: hk.width, height: hk.height });
      const dividerX = startX + hk.width + gap;
      this.page.drawLine({ start: { x: dividerX, y: logoCenterY - 30 }, end: { x: dividerX, y: logoCenterY + 30 }, thickness: 0.9, color: C.turquoise, opacity: 0.7 });
      const slotCenterX = dividerX + gap + envelopeW / 2;
      // A real backing plate is only drawn for an OPAQUE, LIGHT/WHITE
      // logo — the one case that genuinely needs it for readability on
      // navy (rule: açık renkli/beyaz logolar için okunabilir yerleşim).
      // A transparent logo, or an opaque logo with its own colored/dark
      // background, goes straight onto navy — never boxed, never
      // resized beyond its real proportions, and the logo's own
      // embedded background pixels are never touched/stripped.
      if (!clientBackground.transparent && clientBackground.light) {
        const padX = 14;
        const padY = 12;
        const plateW = clientFit.width + padX * 2;
        const plateH = clientFit.height + padY * 2;
        this.roundRect(slotCenterX - plateW / 2, logoCenterY - plateH / 2, plateW, plateH, 8, { color: C.white });
      }
      this.page.drawImage(clientImage, { x: slotCenterX - clientFit.width / 2, y: logoCenterY - clientFit.height / 2, width: clientFit.width, height: clientFit.height });
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
    const coverDates = this.coverDetails().map((d) => d.value);
    if (this.payload.period && this.payload.period !== "-" && !coverDates.includes(this.payload.period)) {
      const period = ellipsize(this.payload.period, this.fonts.regular, 10, 440);
      const w = this.fonts.regular.widthOfTextAtSize(period, 10);
      this.text(period, (PAGE_W - w) / 2, ty - 2, 10, this.fonts.regular, C.white, 0.72);
    }

    // ----- cover details (white area): date / period only — V3.2 keeps
    // the cover a cover: no info card, no contents, no analysis. -----
    let cy = heroBottom - 70;
    const details = this.coverDetails();
    if (details.length) {
      const colW = Math.min(200, CONTENT_W / details.length);
      const startX = (PAGE_W - colW * details.length) / 2;
      details.forEach((d, i) => {
        const x = startX + i * colW;
        if (i > 0) this.page.drawLine({ start: { x, y: cy - 30 }, end: { x, y: cy + 4 }, thickness: 0.6, color: C.border });
        const lw = this.trackedWidth(d.label, 7, this.fonts.semibold, 1.2);
        this.tracked(d.label, x + (colW - lw) / 2, cy - 6, 7, this.fonts.semibold, C.turquoiseText, 1.2);
        const value = ellipsize(d.value, this.fonts.semibold, 11.5, colW - 16);
        const vw = this.fonts.semibold.widthOfTextAtSize(value, 11.5);
        this.text(value, x + (colW - vw) / 2, cy - 24, 11.5, this.fonts.semibold, C.navy);
      });
      cy -= 64;
    }

    if (this.payload.confidentialLabel) {
      const label = `${this.payload.confidentialLabel.toLocaleUpperCase("tr")} — MÜŞTERİYLE PAYLAŞILMAZ`;
      const w = this.trackedWidth(label, 7.6, this.fonts.semibold, 0.8) + 28;
      this.roundRect((PAGE_W - w) / 2, cy - 22, w, 22, 11, { borderColor: C.coral, borderWidth: 0.9, color: rgb(1, 1, 1) });
      this.tracked(label, (PAGE_W - w) / 2 + 14, cy - 14.5, 7.6, this.fonts.semibold, C.coralText, 0.8);
    }
    // Subtle closing ornament above the cover footer.
    this.page.drawRectangle({ x: (PAGE_W - 36) / 2, y: 78, width: 36, height: 2, color: C.turquoise });
    this.page.drawRectangle({ x: (PAGE_W - 36) / 2 + 36, y: 78, width: 10, height: 2, color: C.gold });
    this.coverPage = this.page;

    const tagline = "HK Dijital · Dijital Pazarlama & Büyüme Çözümleri";
    const tw = this.fonts.regular.widthOfTextAtSize(tagline, 8.5);
    this.text(tagline, (PAGE_W - tw) / 2, 52, 8.5, this.fonts.regular, C.muted);
    const site = "hkdijital.com.tr";
    const sw = this.fonts.semibold.widthOfTextAtSize(site, 8.5);
    this.text(site, (PAGE_W - sw) / 2, 39, 8.5, this.fonts.semibold, C.turquoiseText);
  }

  /** Report date (+ period when it differs) for the cover — read from the
   * payload's own meta lines; generation date only when none is stored. */
  private coverDetails(): Array<{ label: string; value: string }> {
    const meta = (this.payload.metaLines || []).map(splitMetaLine).filter((m) => m.value);
    const dateLine = meta.find((m) => /tarih|oluşturul/iu.test(m.label) && !/güncelle/iu.test(m.label));
    const date = dateLine?.value || new Date().toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric", timeZone: "Europe/Istanbul" });
    const out = [{ label: "RAPOR TARİHİ", value: date }];
    const period = this.payload.period && this.payload.period !== "-" ? this.payload.period : "";
    const periodLine = meta.find((m) => /dönem|period/iu.test(m.label))?.value || period;
    if (periodLine && periodLine !== date && !date.startsWith(periodLine) && !periodLine.startsWith(date)) out.push({ label: "DÖNEM", value: periodLine });
    return out;
  }

  /** "Rapor Bilgileri" card — first block of the report body (moved off
   * the cover in V3.2; nothing in it is dropped). */
  private metaCard() {
    const meta = (this.payload.metaLines || []).map(splitMetaLine).filter((m) => m.value);
    if (!meta.length) return;
    const colW = (CONTENT_W - 36) / 2;
    const rows = Math.ceil(meta.length / 2);
    const rowH = 32;
    const cardH = 30 + rows * rowH;
    this.ensure(cardH + 12);
    const top = this.y;
    this.roundRect(MARGIN, top - cardH, CONTENT_W, cardH, 10, { color: C.surface, borderColor: C.border, borderWidth: 0.6 });
    this.tracked("RAPOR BİLGİLERİ", MARGIN + 18, top - 20, 7, this.fonts.semibold, C.turquoiseText, 1.2);
    meta.forEach((m, i) => {
      const x = MARGIN + 18 + (i % 2) * colW;
      const y0 = top - 40 - Math.floor(i / 2) * rowH;
      if (m.label) this.text(ellipsize(m.label, this.fonts.regular, 7.6, colW - 12), x, y0, 7.6, this.fonts.regular, C.muted);
      this.text(ellipsize(m.value, this.fonts.semibold, 10, colW - 12), x, y0 - 13, 10, this.fonts.semibold, C.navy);
    });
    this.y = top - cardH - 22;
  }

  /** Table of contents — EVERY heading, never truncated ("… ve N bölüm
   * daha" is gone). Rows that don't fit on the cover continue on
   * dedicated "Rapor İçeriği (devam)" pages inserted right after the
   * cover. Row heights never depend on the page numbers (a fixed column is
   * reserved for them), so the number of contents pages is known before
   * any number is printed; the loop below re-checks that the widest real
   * page label fits the reserved column and re-lays-out (bounded) if not.
   * Page numbers are read from the final page order, so they always match
   * the PDF. Each row is also a clickable link to its page. */
  private drawToc() {
    // Short reports (≤ 3 headings) need no contents page.
    if (!this.coverPage || this.toc.length < 4) return;
    const entries = this.toc;
    const firstTop = CONTENT_TOP - 56; // below the "İçindekiler" title
    const contTop = CONTENT_TOP - 30;

    type Row = { entry: (typeof entries)[number]; lines: string[]; size: number; font: PDFFont; indent: number; height: number };
    let numberColW = 22;
    let rows: Row[] = [];
    let pagesOfRows: Row[][] = [];
    for (let pass = 0; pass < 4; pass += 1) {
      rows = entries.map((entry) => {
        const sub = entry.level === 2;
        const size = sub ? 8.6 : 9.6;
        const font = sub ? this.fonts.regular : this.fonts.semibold;
        const indent = sub ? 40 : 26;
        const lines = wrapLines(entry.title, font, size, CONTENT_W - indent - numberColW - 18);
        return { entry, lines, size, font, indent, height: Math.max(sub ? 16 : 21, lines.length * (size + 3.4) + (sub ? 6 : 10)) };
      });
      pagesOfRows = [];
      let current: Row[] = [];
      let capacity = firstTop - CONTENT_BOTTOM;
      let used = 0;
      for (const row of rows) {
        if (used + row.height > capacity && current.length) {
          pagesOfRows.push(current);
          current = [];
          capacity = contTop - CONTENT_BOTTOM;
          used = 0;
        }
        current.push(row);
        used += row.height;
      }
      pagesOfRows.push(current);
      // The contents pages shift every body page by their count; the real
      // labels must fit the reserved number column (bounded re-layout).
      const inserted = pagesOfRows.length;
      const maxLabel = Math.max(...entries.map((e) => this.pdf.getPages().indexOf(e.page) + 1 + inserted));
      const needed = this.fonts.semibold.widthOfTextAtSize(String(maxLabel), 8.8) + 6;
      if (needed <= numberColW) break;
      numberColW = Math.ceil(needed);
    }

    // Contents always start on PDF page 2, right after the cover.
    const tocPages: PDFPage[] = [];
    for (let k = 0; k < pagesOfRows.length; k += 1) {
      const page = this.pdf.insertPage(k + 1, [PAGE_W, PAGE_H]);
      this.decorate(page);
      this.contentPages.add(page);
      tocPages.push(page);
    }
    const allPages = this.pdf.getPages();

    pagesOfRows.forEach((pageRows, pageIndex) => {
      this.page = tocPages[pageIndex];
      let y: number;
      if (pageIndex === 0) {
        this.tracked("RAPOR İÇERİĞİ", MARGIN, CONTENT_TOP - 9, 7.4, this.fonts.semibold, C.turquoiseText, 1.4);
        this.text("İçindekiler", MARGIN, CONTENT_TOP - 34, 20, this.fonts.bold, C.navy);
        this.page.drawRectangle({ x: MARGIN, y: CONTENT_TOP - 44, width: 34, height: 2.2, color: C.turquoise });
        y = firstTop;
      } else {
        this.tracked("İÇİNDEKİLER (DEVAM)", MARGIN, CONTENT_TOP - 9, 7.4, this.fonts.semibold, C.turquoiseText, 1.2);
        y = contTop;
      }
      for (const row of pageRows) {
        const target = row.entry.page;
        const pageLabel = String(allPages.indexOf(target) + 1);
        const isSub = row.entry.level === 2;
        if (!isSub) this.text(row.entry.num, MARGIN, y, 8.8, this.fonts.semibold, C.turquoiseText);
        row.lines.forEach((line, li) => this.text(line, MARGIN + row.indent, y - li * (row.size + 3.4), row.size, row.font, isSub ? C.anthracite : C.navy));
        const lastLineY = y - (row.lines.length - 1) * (row.size + 3.4);
        const lastW = row.font.widthOfTextAtSize(row.lines[row.lines.length - 1] || "", row.size);
        const pw = this.fonts.semibold.widthOfTextAtSize(pageLabel, 8.8);
        for (let x = MARGIN + row.indent + lastW + 5; x < PAGE_W - MARGIN - pw - 8; x += 4) this.page.drawCircle({ x, y: lastLineY + 2.4, size: 0.45, color: C.border });
        this.text(pageLabel, PAGE_W - MARGIN - pw, lastLineY, 8.8, this.fonts.semibold, isSub ? C.muted : C.navy);
        addInternalLink(this.pdf, this.page, target, [MARGIN, lastLineY - 3, PAGE_W - MARGIN, y + row.size]);
        if (!isSub) this.page.drawLine({ start: { x: MARGIN, y: lastLineY - 6 }, end: { x: PAGE_W - MARGIN, y: lastLineY - 6 }, thickness: 0.35, color: GRID });
        y -= row.height;
      }
    });
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
        if (!line.trim()) { this.y -= leading; continue; } // a blank line never opens a page
        this.ensure(leading);
        this.text(line, x, this.y - size, size, font, opts.color ?? C.anthracite);
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
      if (!/\(devam\)\s*$/i.test(section.title)) this.toc.push({ level: 2, num: "", title: section.title, page: this.page });
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
    this.toc.push({ level: 1, num, title: section.title, page: this.page });
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

  private headerWordsFit(table: DocumentTable, size: number): boolean {
    const widths = this.columnWidths(table, size);
    return !widths.some((w, i) => {
      const header = cleanGlyphs(table.headers[i]).toLocaleUpperCase("tr");
      return Math.max(...header.split(/\s+/).map((word) => this.fonts.semibold.widthOfTextAtSize(word, size - 0.4))) > w - 12;
    });
  }

  private table(table: DocumentTable) {
    if (!table.headers.length) return;
    // Readability floor: type never drops below 7.4pt. A table that still
    // can't fit its header words at that size (or has 7+ columns) is set as
    // one record card per row instead of being squeezed.
    const MIN_SIZE = 7.4;
    let size = table.headers.length > 5 ? 7.9 : 8.5;
    while (size > MIN_SIZE && !this.headerWordsFit(table, size)) size = Math.round((size - 0.3) * 10) / 10;
    if (table.headers.length >= 7 || !this.headerWordsFit(table, Math.max(size, MIN_SIZE))) {
      this.recordCards(table);
      return;
    }
    size = Math.max(size, MIN_SIZE);
    const leading = size + 3.6;
    const pad = 6;
    const widths = this.columnWidths(table, size);
    const statusCol = table.headers.findIndex((h) => /^durum$/i.test(h.trim()));
    const headerSize = size - 0.4;
    // Cells are never truncated: a row taller than the space left continues
    // on the next page (header repeated) instead of being cut with "…".
    const cellLines = (cell: DocumentCell | undefined, w: number, font: PDFFont, indent: number, fontSize = size) =>
      wrapLines(cellLabel(cell ?? ""), font, fontSize, w - pad * 2 - indent);

    const headerLines = table.headers.map((h, i) => cellLines(h.toLocaleUpperCase("tr"), widths[i], this.fonts.semibold, 0, headerSize));
    const headerH = Math.max(...headerLines.map((l) => l.length), 1) * leading + pad * 2 - 2;
    const drawHeader = () => {
      const top = this.y;
      this.roundRect(MARGIN, top - headerH, CONTENT_W, headerH, 5, { color: C.navy });
      let x = MARGIN;
      headerLines.forEach((l, i) => {
        l.forEach((line, li) => this.text(line, x + pad, top - pad - size + 1 - li * leading, headerSize, this.fonts.semibold, C.white));
        x += widths[i];
      });
      this.y = top - headerH;
    };

    // Keep short tables (≤ ~45% of a page) in one piece instead of leaving
    // a header and a single row stranded at the bottom of a page.
    const estimate = (table.rows.length + 1) * (leading + pad * 2) + 10;
    if (estimate < (CONTENT_TOP - CONTENT_BOTTOM) * 0.45 && estimate > this.remaining() && this.y < CONTENT_TOP - 1) this.newContentPage();
    // Never strand the header: it needs room for at least two body lines.
    this.ensure(headerH + leading * 2 + pad * 2 + 8);
    drawHeader();
    table.rows.forEach((row, rowIndex) => {
      const prepared = table.headers.map((_, i) => {
        const cell = row[i];
        const text = cell === undefined ? "" : cellLabel(cell);
        const status = !isDocumentLink(cell ?? "") && i === statusCol ? STATUS_COLORS.find(([re]) => re.test(text))?.[1] || null : null;
        return { cell, status, lines: cellLines(cell, widths[i], this.fonts.regular, status ? 9 : 0) };
      });
      const totalLines = Math.max(...prepared.map((p) => p.lines.length), 1);
      let start = 0;
      while (start < totalLines) {
        const remainingLines = totalLines - start;
        const fit = Math.floor((this.y - CONTENT_BOTTOM - pad * 2 + 2) / leading);
        if (fit < Math.min(remainingLines, 2)) { this.newContentPage(); drawHeader(); continue; }
        const chunk = Math.min(fit, remainingLines);
        const h = chunk * leading + pad * 2 - 2;
        const top = this.y;
        if (rowIndex % 2 === 1) this.page.drawRectangle({ x: MARGIN, y: top - h, width: CONTENT_W, height: h, color: ZEBRA });
        let x = MARGIN;
        prepared.forEach((p, i) => {
          const link = p.cell !== undefined && isDocumentLink(p.cell) ? p.cell : null;
          const color = link ? C.turquoiseText : p.status || (i === 0 ? C.navy : C.anthracite);
          const font = i === 0 || p.status ? this.fonts.semibold : this.fonts.regular;
          const tx = x + pad + (p.status ? 9 : 0);
          if (p.status && start === 0) this.page.drawCircle({ x: x + pad + 3, y: top - pad - size / 2 + 0.5, size: 2.6, color: p.status });
          p.lines.slice(start, start + chunk).forEach((line, li) => {
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
        start += chunk;
        if (start < totalLines) { this.newContentPage(); drawHeader(); }
      }
      this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: PAGE_W - MARGIN, y: this.y }, thickness: 0.4, color: C.border });
    });
    this.y -= 14;
  }

  /** Wide tables (7+ columns, or header words that can't fit at 7.4pt):
   * one card per row — first column as the card title, the other columns
   * as "BAŞLIK / değer" fields in a two-column grid — so nothing is
   * squeezed below a readable size or cut. Fields continue on the next
   * page if a card is taller than the space left. */
  private recordCards(table: DocumentTable) {
    const size = 8.6;
    const leading = 12.2;
    const labelSize = 6.6;
    const colGap = 18;
    const innerX = MARGIN + 14;
    const innerW = CONTENT_W - 28;
    const colW = (innerW - colGap) / 2;
    table.rows.forEach((row) => {
      const title = cleanGlyphs(row[0] !== undefined ? cellLabel(row[0]) : "");
      const titleLines = wrapLines(title || "—", this.fonts.semibold, 9.6, innerW);
      const fields = table.headers.slice(1).map((header, i) => {
        const cell = row[i + 1];
        const value = cell === undefined ? "" : cellLabel(cell);
        return { header: header.toLocaleUpperCase("tr"), link: cell !== undefined && isDocumentLink(cell) ? cell : null, lines: wrapLines(value || "—", this.fonts.regular, size, colW) };
      });
      const fieldRows: Array<typeof fields> = [];
      for (let i = 0; i < fields.length; i += 2) fieldRows.push(fields.slice(i, i + 2));
      const rowH = (pair: typeof fields) => 10 + Math.max(...pair.map((f) => f.lines.length)) * leading + 5;
      this.ensure(14 + titleLines.length * 13 + (fieldRows[0] ? rowH(fieldRows[0]) : 0) + 6);
      let top = this.y;
      let y = top - 12;
      titleLines.forEach((line) => { this.text(line, innerX, y - 9.6, 9.6, this.fonts.semibold, C.navy); y -= 13; });
      y -= 3;
      const flushCard = (bottom: number) => {
        this.page.drawRectangle({ x: MARGIN, y: bottom, width: 2.4, height: top - bottom, color: C.turquoise });
        this.page.drawLine({ start: { x: MARGIN, y: bottom }, end: { x: PAGE_W - MARGIN, y: bottom }, thickness: 0.4, color: C.border });
      };
      for (const pair of fieldRows) {
        const h = rowH(pair);
        if (y - h < CONTENT_BOTTOM && h < CONTENT_TOP - CONTENT_BOTTOM - 20) { flushCard(y + 2); this.newContentPage(); top = this.y; y = top - 6; }
        pair.forEach((f, ci) => {
          const x = innerX + ci * (colW + colGap);
          this.tracked(f.header, x, y - 7, labelSize, this.fonts.semibold, C.muted, 0.3);
          f.lines.forEach((line, li) => {
            const ly = y - 10 - size - li * leading + 1;
            this.text(line, x, ly, size, this.fonts.regular, f.link ? C.turquoiseText : C.anthracite);
            if (f.link && line) addLinkAnnotation(this.page, f.link.url, [x, ly - 2, x + this.fonts.regular.widthOfTextAtSize(line, size), ly + size]);
          });
        });
        y -= h;
      }
      flushCard(y - 2);
      this.y = y - 10;
    });
    this.y -= 6;
  }

  // ---------- charts ----------
  private chartLayout(chart: DocumentChart) {
    const data = sanitizeChartData(chart.data, chart.type);
    if (!data) return null;
    const MAX_POINTS = chart.type === "line" ? 24 : 12;
    const shown = data.slice(0, MAX_POINTS);
    const truncated = data.length > shown.length;
    const captionText = [chart.caption, truncated ? `Grafikte ilk ${shown.length} kalem gösterilmiştir; tamamı tabloda yer alır.` : ""].filter(Boolean).join(" ");
    const captionLines = captionText ? wrapLines(captionText, this.fonts.regular, 8.2, CONTENT_W - 28) : [];
    const plotH = chart.type === "hbar" ? shown.length * 22 + 4 : 150;
    const h = 40 + plotH + (chart.type === "hbar" ? 4 : 30) + captionLines.length * 11.5 + (captionLines.length ? 8 : 0);
    return { shown, captionLines, plotH, h };
  }

  private chart(chart: DocumentChart) {
    const layout = this.chartLayout(chart);
    if (!layout) return; // not enough real data -> no chart (never a fake one)
    const { shown, captionLines, plotH, h } = layout;
    const format = chart.valueFormat || "number";
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
    // Keep-with-next: a heading never stays alone at a page bottom while
    // its first block (a chart or a table) starts on the next page.
    if (!section.intro && !section.metrics?.length) {
      const firstChart = (section.charts || []).map((c) => this.chartLayout(c)).find(Boolean);
      const firstBlock = firstChart ? firstChart.h + 8 : !section.text && !section.items?.length && section.table ? 78 : 0;
      if (firstBlock) this.ensure(Math.min(firstBlock + 56, CONTENT_TOP - CONTENT_BOTTOM));
    }
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

  /** Closing note box. Branding-only notes ("HK Dijital ·
   * hkdijital.com.tr") are drawn only if they fit on the current page —
   * the page footer already carries that branding, so they never open a
   * page. A real note that doesn't fit is first set more compactly;
   * only if it still doesn't fit does it continue on a new page. */
  private closingNote(note: string) {
    const layout = (size: number, leading: number, padY: number) => {
      const lines = wrapLines(note, this.fonts.regular, size, CONTENT_W - 28);
      return { lines, size, leading, padY, h: padY * 2 + 4 + (lines.length - 1) * leading + size };
    };
    let box = layout(8.2, 11, 7);
    if (box.h + 12 > this.remaining()) {
      const compact = layout(7.6, 10, 5);
      if (compact.h + 8 <= this.remaining()) box = compact;
      else if (isBrandingOnlyNote(note)) return;
      else this.newContentPage();
    }
    this.y -= 6;
    this.roundRect(MARGIN, this.y - box.h, CONTENT_W, box.h, 7, { color: C.surface });
    box.lines.forEach((line, i) => this.text(line, MARGIN + 14, this.y - box.padY - box.size - i * box.leading + 2, box.size, this.fonts.regular, C.muted));
    this.y -= box.h;
  }

  async render(): Promise<Buffer> {
    await this.drawCover();
    this.newContentPage();
    this.metaCard();

    if (this.payload.executiveSummary || this.payload.headlineMetrics?.length) {
      this.toc.push({ level: 1, num: "—", title: "Yönetici Özeti", page: this.page });
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

    if (this.payload.footerNote) this.closingNote(this.payload.footerNote);

    // Never ship a page that only carries the header band / footer (e.g. a
    // page opened by a block that then moved on, or a trailing blank).
    for (const page of this.pdf.getPages().slice(1)) {
      if (!this.contentPages.has(page)) this.pdf.removePage(this.pdf.getPages().indexOf(page));
    }

    this.drawToc();

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
