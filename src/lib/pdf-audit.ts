import "server-only";

import { readFileSync } from "node:fs";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { GEIST_FONT_PATH, HK_GOLD, HK_INK, HK_MUTED } from "@/lib/server/document-generator";

type PdfAuditPayload = {
  businessName?: string;
  source?: string;
  date?: string;
  leadScore?: { score?: number; temperature?: string } | null;
  ai?: { provider?: string; model?: string; mode?: string } | null;
  profileImageUrl?: string;
  logoUrl?: string;
  platforms?: Array<{
    platform?: string;
    username?: string;
    profileUrl?: string;
    displayName?: string;
    bio?: string;
    website?: string;
    profileImageUrl?: string;
    publicTitle?: string;
    publicDescription?: string;
  }>;
  outputs?: Array<{ action?: string; text?: string; ai?: { provider?: string; model?: string; mode?: string } }>;
  sections?: Record<string, string>;
  summary?: string;
  notes?: string;
};

// Turkish corporate section titles — these are the ONLY titles this
// generator ever shows (both the Playwright/HTML path and the pdf-lib
// fallback path render from this same list). Previously these were
// plain English page titles; every one is now Turkish.
const pageTitles = [
  "Yönetici Özeti",
  "Tespit Edilen Sorunlar",
  "Fırsatlar",
  "İyileştirme Önerileri",
  "Sosyal Medya Profil Gözlemleri",
  "30 Günlük Sosyal Medya Planı",
  "Meta Reklam Stratejisi",
  "Google Reklam Stratejisi",
  "İçerik Fikirleri",
  "Teklif",
  "Kapanış"
] as const;

function turkishText(value: unknown) {
  return String(value || "").normalize("NFC").replace(/\u0000/g, "");
}

function escapeHtml(value: unknown) {
  return turkishText(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

// Only ever used for FILE NAMES (which must stay ASCII-safe on every
// filesystem/download client) — never for on-page display text anymore.
// The previous version of this file also used this to fold Turkish
// characters out of the VISIBLE pdf-lib fallback page text, which was
// only needed because that path embedded pdf-lib's built-in WinAnsi-only
// StandardFonts; it now embeds the same Geist font document-generator.ts
// uses (real ç/ğ/ı/ö/ş/ü glyphs), so display text keeps its real
// Turkish characters.
function asciiFold(value: unknown) {
  return String(value || "")
    .replace(/İ/g, "I").replace(/ı/g, "i").replace(/Ğ/g, "G").replace(/ğ/g, "g")
    .replace(/Ü/g, "U").replace(/ü/g, "u").replace(/Ş/g, "S").replace(/ş/g, "s")
    .replace(/Ö/g, "O").replace(/ö/g, "o").replace(/Ç/g, "C").replace(/ç/g, "c")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
}

function filenamePart(value: unknown) {
  return asciiFold(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "isletme";
}

function wrapText(text: string, font: import("pdf-lib").PDFFont, size: number, maxWidth: number) {
  const lines: string[] = [];
  for (const paragraph of turkishText(text).split(/\n+/)) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    if (!words.length) lines.push("");
  }
  return lines;
}

function outputFor(payload: PdfAuditPayload, action: string) {
  return payload.outputs?.find((item) => asciiFold(item.action).toLowerCase() === asciiFold(action).toLowerCase())?.text || "";
}

function sectionText(payload: PdfAuditPayload, title: (typeof pageTitles)[number]) {
  const sections = payload.sections || {};
  const direct = sections[title] || sections[title.toLowerCase()] || outputFor(payload, title);
  if (direct) return direct;
  if (title === "Yönetici Özeti") return payload.summary || payload.notes || "HK Dijital tarafından hazırlanan mini denetim özeti. Girilen profil bilgileri, ekran görüntüleri, potansiyel müşteri puanı ve yapay zekâ çıktıları birlikte değerlendirilmiştir.";
  if (title === "Tespit Edilen Sorunlar") return outputFor(payload, "Düzeltilmesi Gerekenler") || "Profil açıklaması, harekete geçirici mesaj (CTA), güven sinyalleri ve teklif dili netleştirilmelidir.";
  if (title === "Fırsatlar") return "Yerel görünürlük, sosyal kanıt, kısa video, yeniden pazarlama ve teklif odaklı kampanyalar büyüme fırsatı sunar.";
  if (title === "İyileştirme Önerileri") return outputFor(payload, "Düzeltilmesi Gerekenler") || "Biyografi, profil görseli, sabit hikâyeler, içerik tutarlılığı ve dönüşüm akışlarını iyileştirin.";
  if (title === "Sosyal Medya Profil Gözlemleri") return (payload.platforms || []).map((item) => [
    `${item.platform || "Platform"}: ${item.displayName || item.username || item.publicTitle || "-"}`,
    item.bio || item.publicDescription ? `Biyografi/açıklama: ${item.bio || item.publicDescription}` : "",
    item.website ? `Web sitesi: ${item.website}` : "",
    item.profileUrl ? `Platform bağlantısı: ${item.profileUrl}` : "",
    item.profileImageUrl ? "Profil görseli: mevcut" : "Profil görseli: yok veya görüntülenemedi"
  ].filter(Boolean).join("\n")).join("\n\n") || "Profil verileri sınırlı. Girilen bilgiler ve ekran görüntüleriyle analiz yapılmıştır.";
  if (title === "30 Günlük Sosyal Medya Planı") return outputFor(payload, "30 Günlük Sosyal Medya Planı") || "1. hafta güven ve konumlandırma, 2. hafta sosyal kanıt, 3. hafta teklif, 4. hafta dönüşüm ve yeniden pazarlama.";
  if (title === "Meta Reklam Stratejisi") return outputFor(payload, "Meta Reklam Stratejisi") || "Farkındalık, trafik, mesaj, yeniden pazarlama ve dönüşüm kampanyaları ayrılmalı; satış garantisi verilmemelidir.";
  if (title === "Google Reklam Stratejisi") return outputFor(payload, "Google Reklam Stratejisi") || "Arama niyeti yüksek kelimeler lokasyon ve hizmet bazında gruplanmalı; ölçümleme kurulmalıdır.";
  if (title === "İçerik Fikirleri") return outputFor(payload, "İçerik Fikirleri") || "Müşteri yorumu, önce/sonra, ekip güveni, sık sorulan sorular, kampanya ve lokasyon içerikleri.";
  if (title === "Teklif") return outputFor(payload, "Teklif Hazırlama") || "Starter: 10.000 TL\nPro: 15.000 TL\nPremium: 25.000 TL\nReklam bütçesi hizmet bedeline dahil değildir.";
  return "HK Dijital ile sonraki adım: net hedef, ölçümleme, içerik ve reklam aksiyonlarını birlikte planlamak.";
}

async function embedImage(pdfDoc: PDFDocument, url?: string) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    const type = response.headers.get("content-type") || "";
    if (type.includes("png") || url.toLowerCase().endsWith(".png")) return await pdfDoc.embedPng(bytes);
    if (type.includes("jpeg") || type.includes("jpg") || /\.(jpe?g)$/i.test(url)) return await pdfDoc.embedJpg(bytes);
  } catch (error) {
    console.warn("[pdf-audit] Görsel eklenemedi", error instanceof Error ? error.message : error);
  }
  return null;
}

export function auditPdfFilename(payload: PdfAuditPayload) {
  const date = asciiFold(payload.date || new Date().toISOString().slice(0, 10));
  return `hk-dijital-mini-denetim-${filenamePart(payload.businessName)}-${date}.pdf`;
}

export async function generateMiniAuditPdf(payload: PdfAuditPayload) {
  try {
    const { chromium } = await import("playwright");
    const ai = payload.ai || payload.outputs?.find((item) => item.ai)?.ai || {};
    const businessName = turkishText(payload.businessName || "İşletme");
    // Same HK corporate letterhead language as document-generator.ts's PDF/
    // DOCX renderer — a charcoal band with the real configured brand logo
    // (content.brand.logoUrl, embedded as-is, never redrawn) and a gold
    // accent line, so this generator's output matches the rest of the
    // corporate document system instead of its own ad-hoc blue styling.
    const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8" /><style>
      @page { size: A4; margin: 0; }
      body { margin:0; background:#ffffff; color:#1b1d22; font-family: Inter, Arial, Helvetica, sans-serif; font-size:13px; line-height:1.6; }
      .band { background:#1b1d22; color:#fff; padding:18px 28mm; display:flex; align-items:center; justify-content:space-between; gap:16px; border-bottom:3px solid #bfa33e; }
      .band img { height:36px; display:block; }
      .band .title { font-weight:800; letter-spacing:.06em; text-transform:uppercase; font-size:13px; text-align:right; }
      main { padding:10mm 28mm 18mm; }
      h2 { margin:22px 0 8px; color:#bfa33e; border-top:1px solid #e2e8f0; padding-top:14px; font-size:15px; }
      p { white-space:pre-wrap; overflow-wrap:anywhere; }
      .meta { color:#5f6672; font-size:12px; }
    </style></head><body>
      <div class="band">
        ${payload.logoUrl ? `<img src="${escapeHtml(payload.logoUrl)}" alt="HK Dijital" />` : `<span style="font-weight:900;letter-spacing:.1em;">HK DİJİTAL</span>`}
        <span class="title">HK DİJİTAL&nbsp;|&nbsp;MİNİ DENETİM RAPORU</span>
      </div>
      <main>
      <h1 style="font-size:26px;margin:4px 0 6px;">${escapeHtml(businessName)} — Mini Denetim Raporu</h1>
      <p class="meta">Tarih: ${escapeHtml(payload.date || new Date().toISOString().slice(0, 10))}</p>
      <p class="meta">Potansiyel Müşteri Puanı: ${escapeHtml(payload.leadScore?.score != null ? `${payload.leadScore.score}/100 ${payload.leadScore.temperature || ""}` : "-")}</p>
      <p class="meta">Kullanılan Yapay Zekâ: ${escapeHtml(ai.provider || "-")} · Model: ${escapeHtml(ai.model || "-")} · Mod: ${escapeHtml(ai.mode || "-")}</p>
      ${pageTitles.map((title) => `<h2>${escapeHtml(title)}</h2><p>${escapeHtml(sectionText(payload, title))}</p>`).join("")}
      </main>
    </body></html>`;
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ locale: "tr-TR" });
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
    await browser.close();
    return Buffer.from(pdf);
  } catch {
    // Fallback keeps the existing lightweight pdf-lib path if a browser binary is unavailable.
  }

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const fontBytes = readFileSync(GEIST_FONT_PATH);
  const regular = await pdfDoc.embedFont(fontBytes, { subset: true });
  const bold = regular; // Geist-Regular is embedded once; weight differences come from size/color, same approach document-generator.ts uses
  const logo = await embedImage(pdfDoc, payload.logoUrl);
  const profileImage = await embedImage(pdfDoc, payload.profileImageUrl);
  const ai = payload.ai || payload.outputs?.find((item) => item.ai)?.ai || {};
  const businessName = turkishText(payload.businessName || "İşletme");
  const date = turkishText(payload.date || new Date().toISOString().slice(0, 10));
  const source = turkishText(payload.source || "HK Dijital");
  const leadScore = turkishText(payload.leadScore?.score != null ? `${payload.leadScore.score}/100 ${payload.leadScore.temperature || ""}` : "-");

  const drawFooter = (page: import("pdf-lib").PDFPage, pageNo: number) => {
    page.drawText("HK Dijital | hkdijital.com.tr", { x: 42, y: 28, size: 8, font: regular, color: HK_MUTED });
    page.drawText(String(pageNo), { x: 545, y: 28, size: 8, font: regular, color: HK_MUTED });
  };

  const cover = pdfDoc.addPage([595, 842]);
  cover.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: HK_INK });
  cover.drawRectangle({ x: 0, y: 0, width: 595, height: 6, color: HK_GOLD });
  if (logo) cover.drawImage(logo, { x: 56, y: 690, width: 92, height: 42 });
  cover.drawText("HK DİJİTAL", { x: 56, y: logo ? 668 : 704, size: 16, font: bold, color: HK_GOLD });
  cover.drawText("Mini Denetim Raporu", { x: 56, y: 606, size: 30, font: bold, color: rgb(1, 1, 1) });
  cover.drawText(businessName.slice(0, 52), { x: 56, y: 558, size: 22, font: bold, color: rgb(0.68, 0.89, 1) });
  cover.drawText(`Tarih: ${date}`, { x: 56, y: 504, size: 12, font: regular, color: rgb(0.88, 0.93, 1) });
  cover.drawText(`Potansiyel Müşteri Puanı: ${leadScore}`, { x: 56, y: 480, size: 12, font: regular, color: rgb(0.88, 0.93, 1) });
  cover.drawText(`Kaynak: ${source}`, { x: 56, y: 456, size: 12, font: regular, color: rgb(0.88, 0.93, 1) });
  cover.drawText(`Kullanılan Yapay Zekâ: ${turkishText(ai.provider || "-")}`, { x: 56, y: 410, size: 11, font: regular, color: HK_GOLD });
  cover.drawText(`Model: ${turkishText(ai.model || "-")}`, { x: 56, y: 390, size: 11, font: regular, color: HK_GOLD });
  cover.drawText(`Mod: ${turkishText(ai.mode || "-")}`, { x: 56, y: 370, size: 11, font: regular, color: HK_GOLD });
  if (profileImage) cover.drawImage(profileImage, { x: 410, y: 575, width: 86, height: 86 });
  drawFooter(cover, 1);

  const pages: Array<[string, Array<(typeof pageTitles)[number]>]> = [
    ["Yönetici Özeti", ["Yönetici Özeti", "Tespit Edilen Sorunlar", "Fırsatlar"]],
    ["İyileştirme Önerileri", ["İyileştirme Önerileri", "Sosyal Medya Profil Gözlemleri"]],
    ["30 Günlük Sosyal Medya Planı", ["30 Günlük Sosyal Medya Planı"]],
    ["Meta Reklam Stratejisi", ["Meta Reklam Stratejisi"]],
    ["Google Reklam Stratejisi", ["Google Reklam Stratejisi"]],
    ["İçerik Fikirleri", ["İçerik Fikirleri"]],
    ["Teklif", ["Teklif"]],
    ["Kapanış", ["Kapanış"]]
  ];

  pages.forEach(([title, sections], index) => {
    const page = pdfDoc.addPage([595, 842]);
    page.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: rgb(1, 1, 1) });
    page.drawRectangle({ x: 0, y: 812, width: 595, height: 30, color: HK_INK });
    page.drawRectangle({ x: 0, y: 809, width: 595, height: 3, color: HK_GOLD });
    page.drawText("HK DİJİTAL", { x: 42, y: 822, size: 11, font: bold, color: HK_GOLD });
    page.drawText(turkishText(title), { x: 42, y: 772, size: 20, font: bold, color: HK_INK });
    page.drawText(businessName.slice(0, 72), { x: 42, y: 748, size: 10, font: regular, color: HK_MUTED });
    let y = 712;
    sections.forEach((sectionTitle) => {
      page.drawText(turkishText(sectionTitle), { x: 42, y, size: 13, font: bold, color: HK_GOLD });
      y -= 20;
      const lines = wrapText(sectionText(payload, sectionTitle), regular, 9.5, 510);
      for (const line of lines) {
        if (y < 72) break;
        page.drawText(line || " ", { x: 52, y, size: 9.5, font: regular, color: HK_INK });
        y -= 15;
      }
      y -= 16;
    });
    if (title === "Teklif") {
      const packages = [["Başlangıç", "10.000 TL"], ["Pro", "15.000 TL"], ["Premium", "25.000 TL"]];
      packages.forEach(([label, price], itemIndex) => {
        page.drawRectangle({ x: 42 + itemIndex * 172, y: 104, width: 150, height: 72, color: rgb(0.996, 0.976, 0.925), borderColor: HK_GOLD, borderWidth: 1 });
        page.drawText(label, { x: 58 + itemIndex * 172, y: 146, size: 13, font: bold, color: HK_INK });
        page.drawText(price, { x: 58 + itemIndex * 172, y: 124, size: 12, font: bold, color: rgb(0.63, 0.44, 0.08) });
      });
    }
    drawFooter(page, index + 2);
  });

  const bytes = await pdfDoc.save();
  const buffer = Buffer.from(bytes);
  if (buffer.length <= 1024 || !buffer.subarray(0, 5).toString("utf8").startsWith("%PDF-")) {
    throw new Error("PDF oluşturulamadı. Geçersiz PDF verisi üretildi.");
  }
  return buffer;
}
