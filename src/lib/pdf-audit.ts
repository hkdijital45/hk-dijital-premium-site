import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

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

const pageTitles = [
  "Executive Summary",
  "Problems",
  "Opportunities",
  "Improvement Recommendations",
  "Social Profile Observations",
  "30-Day Social Media Plan",
  "Meta Ads Strategy",
  "Google Ads Strategy",
  "Content Ideas",
  "Proposal",
  "Closing"
];

function safeText(value: unknown) {
  return String(value || "")
    .replace(/İ/g, "I")
    .replace(/ı/g, "i")
    .replace(/Ğ/g, "G")
    .replace(/ğ/g, "g")
    .replace(/Ü/g, "U")
    .replace(/ü/g, "u")
    .replace(/Ş/g, "S")
    .replace(/ş/g, "s")
    .replace(/Ö/g, "O")
    .replace(/ö/g, "o")
    .replace(/Ç/g, "C")
    .replace(/ç/g, "c")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
}

function filenamePart(value: unknown) {
  return safeText(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "business";
}

function wrapText(text: string, maxChars = 92) {
  const lines: string[] = [];
  for (const paragraph of safeText(text).split(/\n+/)) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (next.length > maxChars) {
        if (line) lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    if (!words.length) lines.push("");
  }
  return lines;
}

function outputFor(payload: PdfAuditPayload, action: string) {
  return payload.outputs?.find((item) => safeText(item.action).toLowerCase() === action.toLowerCase())?.text || "";
}

function sectionText(payload: PdfAuditPayload, title: string) {
  const sections = payload.sections || {};
  const direct = sections[title] || sections[title.toLowerCase()] || outputFor(payload, title);
  if (direct) return direct;
  if (title === "Executive Summary") return payload.summary || payload.notes || "HK Dijital tarafindan hazirlanan mini audit ozeti. Girilen profil bilgileri, ekran goruntuleri, lead score ve AI ciktilari birlikte degerlendirilmistir.";
  if (title === "Problems") return outputFor(payload, "Duzeltilmesi Gerekenler") || outputFor(payload, "Düzeltilmesi Gerekenler") || "Profil aciklamasi, CTA, guven sinyalleri ve teklif dili netlestirilmelidir.";
  if (title === "Opportunities") return "Yerel gorunurluk, sosyal kanit, kisa video, yeniden pazarlama ve teklif odakli kampanyalar buyume firsati sunar.";
  if (title === "Improvement Recommendations") return outputFor(payload, "Duzeltilmesi Gerekenler") || outputFor(payload, "Düzeltilmesi Gerekenler") || "Bio, profil gorseli, sabit hikayeler, icerik tutarliligi ve donusum akislarini iyilestirin.";
  if (title === "Social Profile Observations") return (payload.platforms || []).map((item) => [
    `${item.platform || "Platform"}: ${item.displayName || item.username || item.publicTitle || "-"}`,
    item.bio || item.publicDescription ? `Bio/aciklama: ${item.bio || item.publicDescription}` : "",
    item.website ? `Website: ${item.website}` : "",
    item.profileUrl ? `Platform URL: ${item.profileUrl}` : "",
    item.profileImageUrl ? "Profil gorseli: var" : "Profil gorseli: yok veya goruntulenemedi"
  ].filter(Boolean).join("\n")).join("\n\n") || "Profil verileri sinirli. Girilen bilgiler ve ekran goruntuleriyle analiz yapilmistir.";
  if (title === "30-Day Social Media Plan") return outputFor(payload, "30 Gunluk Sosyal Medya Plani") || outputFor(payload, "30 Günlük Sosyal Medya Planı") || "1. hafta guven ve konumlandirma, 2. hafta sosyal kanit, 3. hafta teklif, 4. hafta donusum ve yeniden pazarlama.";
  if (title === "Meta Ads Strategy") return outputFor(payload, "Meta Reklam Stratejisi") || "Farkindalik, trafik, mesaj, yeniden pazarlama ve donusum kampanyalari ayrilmali; satis garantisi verilmemelidir.";
  if (title === "Google Ads Strategy") return outputFor(payload, "Google Reklam Stratejisi") || "Arama niyeti yuksek kelimeler lokasyon ve hizmet bazinda gruplanmali; olcumleme kurulmalidir.";
  if (title === "Content Ideas") return outputFor(payload, "Icerik Fikirleri") || outputFor(payload, "İçerik Fikirleri") || "Musteri yorumu, once/sonra, ekip guveni, sik sorulan sorular, kampanya ve lokasyon icerikleri.";
  if (title === "Proposal") return outputFor(payload, "Teklif Hazirlama") || outputFor(payload, "Teklif Hazırlama") || "Starter: 10.000 TL\nPro: 15.000 TL\nPremium: 25.000 TL\nReklam butcesi hizmet bedeline dahil degildir.";
  return "HK Dijital ile sonraki adim: net hedef, olcumleme, icerik ve reklam aksiyonlarini birlikte planlamak.";
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
    console.warn("[pdf-audit] Gorsel eklenemedi", error instanceof Error ? error.message : error);
  }
  return null;
}

export function auditPdfFilename(payload: PdfAuditPayload) {
  const date = safeText(payload.date || new Date().toISOString().slice(0, 10));
  return `hk-dijital-mini-audit-${filenamePart(payload.businessName)}-${date}.pdf`;
}

export async function generateMiniAuditPdf(payload: PdfAuditPayload) {
  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const logo = await embedImage(pdfDoc, payload.logoUrl);
  const profileImage = await embedImage(pdfDoc, payload.profileImageUrl);
  const ai = payload.ai || payload.outputs?.find((item) => item.ai)?.ai || {};
  const businessName = safeText(payload.businessName || "Isletme");
  const date = safeText(payload.date || new Date().toISOString().slice(0, 10));
  const source = safeText(payload.source || "HK Dijital");
  const leadScore = safeText(payload.leadScore?.score != null ? `${payload.leadScore.score}/100 ${payload.leadScore.temperature || ""}` : "-");

  const drawFooter = (page: any, pageNo: number) => {
    page.drawText("HK Dijital | Digital Marketing Command Center", { x: 42, y: 28, size: 8, font: regular, color: rgb(0.33, 0.38, 0.49) });
    page.drawText(String(pageNo), { x: 545, y: 28, size: 8, font: regular, color: rgb(0.33, 0.38, 0.49) });
  };

  const cover = pdfDoc.addPage([595, 842]);
  cover.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: rgb(0.03, 0.07, 0.14) });
  cover.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: rgb(0.04, 0.21, 0.39), opacity: 0.55 });
  cover.drawRectangle({ x: 40, y: 86, width: 515, height: 670, color: rgb(1, 1, 1), opacity: 0.08, borderColor: rgb(0.99, 0.78, 0.23), borderWidth: 1 });
  if (logo) cover.drawImage(logo, { x: 56, y: 690, width: 92, height: 42 });
  cover.drawText("HK Dijital", { x: 56, y: logo ? 668 : 704, size: 18, font: bold, color: rgb(1, 0.85, 0.36) });
  cover.drawText("Mini Audit Report", { x: 56, y: 606, size: 34, font: bold, color: rgb(1, 1, 1) });
  cover.drawText(businessName.slice(0, 52), { x: 56, y: 558, size: 24, font: bold, color: rgb(0.68, 0.89, 1) });
  cover.drawText(`Date: ${date}`, { x: 56, y: 504, size: 12, font: regular, color: rgb(0.88, 0.93, 1) });
  cover.drawText(`Lead Score: ${leadScore}`, { x: 56, y: 480, size: 12, font: regular, color: rgb(0.88, 0.93, 1) });
  cover.drawText(`Source: ${source}`, { x: 56, y: 456, size: 12, font: regular, color: rgb(0.88, 0.93, 1) });
  cover.drawText(`Kullanilan AI Saglayicisi: ${safeText(ai.provider || "-")}`, { x: 56, y: 410, size: 11, font: regular, color: rgb(1, 0.85, 0.36) });
  cover.drawText(`Model: ${safeText(ai.model || "-")}`, { x: 56, y: 390, size: 11, font: regular, color: rgb(1, 0.85, 0.36) });
  cover.drawText(`Mod: ${safeText(ai.mode || "-")}`, { x: 56, y: 370, size: 11, font: regular, color: rgb(1, 0.85, 0.36) });
  if (profileImage) cover.drawImage(profileImage, { x: 410, y: 575, width: 86, height: 86 });
  drawFooter(cover, 1);

  const pages = [
    ["Executive Summary", ["Executive Summary", "Problems", "Opportunities"]],
    ["Improvement Recommendations", ["Improvement Recommendations", "Social Profile Observations"]],
    ["30-Day Social Media Plan", ["30-Day Social Media Plan"]],
    ["Meta Ads Strategy", ["Meta Ads Strategy"]],
    ["Google Ads Strategy", ["Google Ads Strategy"]],
    ["Content Ideas", ["Content Ideas"]],
    ["Proposal Section", ["Proposal"]],
    ["Closing", ["Closing"]]
  ];

  pages.forEach(([title, sections], index) => {
    const page = pdfDoc.addPage([595, 842]);
    page.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: rgb(0.98, 0.99, 1) });
    page.drawText(safeText(title), { x: 42, y: 786, size: 22, font: bold, color: rgb(0.04, 0.09, 0.18) });
    page.drawText(businessName.slice(0, 72), { x: 42, y: 758, size: 10, font: regular, color: rgb(0.33, 0.38, 0.49) });
    let y = 714;
    (sections as string[]).forEach((sectionTitle) => {
      page.drawText(safeText(sectionTitle), { x: 42, y, size: 14, font: bold, color: rgb(0.03, 0.34, 0.58) });
      y -= 22;
      const lines = wrapText(sectionText(payload, sectionTitle), 88);
      for (const line of lines) {
        if (y < 72) break;
        page.drawText(line || " ", { x: 52, y, size: 9.5, font: regular, color: rgb(0.12, 0.16, 0.24) });
        y -= 15;
      }
      y -= 16;
    });
    if (title === "Proposal Section") {
      const packages = [["Starter", "10.000 TL"], ["Pro", "15.000 TL"], ["Premium", "25.000 TL"]];
      packages.forEach(([label, price], itemIndex) => {
        page.drawRectangle({ x: 42 + itemIndex * 172, y: 104, width: 150, height: 72, color: rgb(1, 0.95, 0.82), borderColor: rgb(0.95, 0.67, 0.19), borderWidth: 1 });
        page.drawText(label, { x: 58 + itemIndex * 172, y: 146, size: 13, font: bold, color: rgb(0.12, 0.16, 0.24) });
        page.drawText(price, { x: 58 + itemIndex * 172, y: 124, size: 12, font: bold, color: rgb(0.83, 0.37, 0.06) });
      });
    }
    drawFooter(page, index + 2);
  });

  const bytes = await pdfDoc.save();
  const buffer = Buffer.from(bytes);
  if (buffer.length <= 1024 || !buffer.subarray(0, 5).toString("utf8").startsWith("%PDF-")) {
    throw new Error("PDF olusturulamadi. Gecersiz PDF verisi uretildi.");
  }
  return buffer;
}
