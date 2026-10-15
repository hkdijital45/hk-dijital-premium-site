import "server-only";

import { generatePdfBuffer, type DocumentCell, type DocumentPayload, type DocumentSection } from "@/lib/server/document-generator";
import { resolveReportClientLogo } from "@/lib/business-logos";

type PdfAuditPayload = {
  /** Optional lead id: when it has a VERIFIED logo, the cover shows it next to HK Dijital's. */
  leadId?: string;
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

function outputFor(payload: PdfAuditPayload, ...actions: string[]) {
  for (const action of actions) {
    const found = payload.outputs?.find((item) => asciiFold(item.action).toLowerCase() === asciiFold(action).toLowerCase())?.text;
    if (found && found.trim()) return found;
  }
  return "";
}

// Only content that was actually supplied is printed. The previous
// generator filled every empty section with generic boilerplate (and even
// sample package prices) — a client PDF must never contain advice or
// numbers nobody wrote for this business, so empty sections are omitted.
const SECTION_ALIASES: Partial<Record<(typeof pageTitles)[number], string[]>> = {
  "Tespit Edilen Sorunlar": ["Düzeltilmesi Gerekenler"],
  "İyileştirme Önerileri": ["Düzeltilmesi Gerekenler"],
  "Teklif": ["Teklif Hazırlama"]
};

function realSectionText(payload: PdfAuditPayload, title: (typeof pageTitles)[number]): string {
  const sections = payload.sections || {};
  const direct = sections[title] || sections[title.toLowerCase()];
  if (direct && direct.trim()) return turkishText(direct);
  return turkishText(outputFor(payload, title, ...(SECTION_ALIASES[title] || [])));
}

export function auditPdfFilename(payload: PdfAuditPayload) {
  const date = asciiFold(payload.date || new Date().toISOString().slice(0, 10));
  return `hk-dijital-mini-denetim-${filenamePart(payload.businessName)}-${date}.pdf`;
}

export function buildMiniAuditDocumentPayload(payload: PdfAuditPayload): DocumentPayload {
  const businessName = turkishText(payload.businessName || "İşletme");
  const date = turkishText(payload.date || new Date().toISOString().slice(0, 10));
  const ai = payload.ai || payload.outputs?.find((item) => item.ai)?.ai || {};
  const score = payload.leadScore?.score;
  const sections: DocumentSection[] = [];
  const usedTexts = new Set<string>();

  const platforms = (payload.platforms || []).filter((p) => p.username || p.profileUrl || p.displayName);
  if (platforms.length) {
    const rows: DocumentCell[][] = platforms.map((p) => [
      turkishText(p.platform || "Platform"),
      turkishText(p.displayName || p.username || p.publicTitle || "-"),
      p.profileUrl && /^https?:\/\//i.test(p.profileUrl) ? { label: "Bağlantıyı Aç", url: p.profileUrl } : turkishText(p.profileUrl || "-")
    ]);
    const notes = platforms.map((p) => turkishText(p.bio || p.publicDescription || "")).filter(Boolean);
    sections.push({ title: "Sosyal Medya Profil Gözlemleri", table: { headers: ["Platform", "Hesap", "Bağlantı"], rows }, items: notes.length ? notes : undefined });
  }

  for (const title of pageTitles) {
    if (title === "Yönetici Özeti" || title === "Sosyal Medya Profil Gözlemleri") continue;
    const text = realSectionText(payload, title);
    // The same supplied text is never printed twice under two headings.
    if (!text || usedTexts.has(text)) continue;
    usedTexts.add(text);
    sections.push({ title, text });
  }

  const summary = realSectionText(payload, "Yönetici Özeti") || turkishText(payload.summary || payload.notes || "");
  return {
    title: "HK Dijital — Mini Denetim Raporu",
    customerName: businessName,
    period: date,
    executiveSummary: summary,
    headlineMetrics: typeof score === "number" && Number.isFinite(score) ? [{ label: "Potansiyel Müşteri Puanı", value: `${score}/100`, note: payload.leadScore?.temperature || undefined, tone: score >= 80 ? "positive" : score >= 50 ? "warning" : "neutral" }] : undefined,
    sections,
    logo: true,
    metaLines: [
      `Firma: ${businessName}`,
      `Tarih: ${date}`,
      `Kaynak: ${turkishText(payload.source || "HK Dijital")}`,
      ...(ai.provider || ai.model ? [`Yapay Zekâ: ${[ai.provider, ai.model].filter(Boolean).join(" · ")}`] : []),
      "Hazırlayan: HK Dijital"
    ],
    footerNote: "Bu mini denetim, girilen profil bilgileri ve yapay zekâ çıktıları üzerinden hazırlanmıştır; bilgi bulunmayan başlıklar rapora eklenmemiştir."
  };
}

/** Same premium renderer as every other report. No remote image is ever
 * fetched here (the previous version loaded caller-supplied logo/profile
 * image URLs server-side); the only client logo shown is a VERIFIED one
 * resolved from the lead id. */
export async function generateMiniAuditPdf(payload: PdfAuditPayload) {
  const document = buildMiniAuditDocumentPayload(payload);
  if (payload.leadId && /^[0-9a-f-]{36}$/i.test(payload.leadId)) document.clientLogo = await resolveReportClientLogo({ leadId: payload.leadId });
  return generatePdfBuffer(document);
}
