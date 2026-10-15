import "server-only";

import type { PreAuditReport } from "@/lib/pre-audit/types";
import { PRE_AUDIT_SECTION_LABELS, PRE_AUDIT_INTERNAL_SECTION_LABELS } from "@/lib/pre-audit/types";
import type { DocumentPayload, DocumentSection, DocumentTable, DocumentCell, DocumentMetric, DocumentChart } from "@/lib/server/document-generator";
import { formatNumberTr as formatNumberTrDigits } from "@/lib/report-design";
import { safeFileNameSegment } from "@/lib/server/document-generator";
import { normalizeTurkishText, formatTurkishDateTime } from "@/lib/reports/report-exports";
import { capitalizeWordsTr, restoreAsciiKeyWords } from "@/lib/turkish-text";

// Ön İnceleme report → branded PDF/DOCX document model. EXPORT = RENDER,
// never research: this only reformats what save_pre_audit_report already
// persisted (see src/lib/pre-audit/reports.ts) into the same
// DocumentPayload shape every other export in the app uses
// (src/lib/server/document-generator.ts) — no second document engine, no
// AI call, no new research.
//
// CLIENT_REPORT export reads ONLY PRE_AUDIT_SECTION_LABELS fields — the
// six PRE_AUDIT_INTERNAL_SECTION_LABELS fields (sales_notes, sales_script,
// instagram_dm, whatsapp_initial, whatsapp_with_pdf, objections) are never
// read for a client document, even if a row somehow carried a value. This
// mirrors the same defence-in-depth already applied in reports.ts
// (savePreAuditReport strips them server-side for report_type =
// CLIENT_REPORT) and PreAuditCenter.tsx (never renders them for
// CLIENT_REPORT in the viewer either) — a third independent enforcement
// point at the export boundary.

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

/** Strips literal markdown syntax Claude occasionally leaves in a plain-
 * text field (bold/heading/backtick markers, "- " bullets) — the field is
 * stored as plain text, not rendered markdown, so raw `**`/`#`/`` ` ``
 * must never reach the printed document. Never touches factual content. */
function stripMarkdownArtifacts(text: string): string {
  return text
    .replace(/```([\s\S]*?)```/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(?<!\*)\*(?!\*)(.+?)\*(?!\*)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^[-*]\s+/gm, "• ")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function textValue(value: unknown): string {
  return stripMarkdownArtifacts(normalizeTurkishText(value));
}

function prettifyKey(key: string): string {
  const spaced = key.replaceAll("_", " ").replace(/([a-zçğıöşü])([A-ZÇĞİÖŞÜ])/g, "$1 $2");
  const known: Record<string, string> = {
    rating: "Puan", reviewcount: "Yorum Sayısı", "review count": "Yorum Sayısı",
    followers: "Takipçi", following: "Takip Edilen", posts: "Paylaşım", handle: "Kullanıcı Adı",
    phonelisted: "Telefon", "phone listed": "Telefon", website: "Web Sitesi", instagram: "Instagram",
    google: "Google", price: "Fiyat", condition: "Koşul", classification: "Sınıflandırma", source: "Kaynak",
    name: "İsim", phone: "Telefon", package: "Paket", objective: "Hedef", targeting: "Hedefleme",
    dailybudget: "Günlük Bütçe", "daily budget": "Günlük Bütçe",
    priceexclvat: "KDV Hariç Fiyat", "price excl vat": "KDV Hariç Fiyat",
    priceinclvat: "KDV Dahil Fiyat", "price incl vat": "KDV Dahil Fiyat",
    phoneongbp: "Google Profilinde Telefon", "phone on gbp": "Google Profilinde Telefon",
    pricesignal: "Fiyat Bilgisi Kaynağı", "price signal": "Fiyat Bilgisi Kaynağı",
    reviewthemes: "Yorumlarda Öne Çıkan Temalar", "review themes": "Yorumlarda Öne Çıkan Temalar",
    websitelisted: "Google Profilinde Web Sitesi", "website listed": "Google Profilinde Web Sitesi",
    hours: "Çalışma Saatleri", address: "Adres", category: "Kategori", status: "Durum",
    location: "Konum", service: "Hizmet",
    gerekce: "Gerekçe", firsat: "Fırsat", kosul: "Koşul", siniflandirma: "Sınıflandırma",
    uyari: "Uyarı", butcesi: "Bütçesi", erisilebilirlik: "Erişilebilirlik",
    // "assets" is deliberately "Bağlantılar" (Links), not the dictionary's
    // generic "Dijital Varlıklar" — in this specific usage it is always a
    // sub-table titled "{parent section} — {this label}" where the parent
    // section is ITSELF "Dijital Varlıklar" (digital_presence); using the
    // same term twice would read as "Dijital Varlıklar — Dijital
    // Varlıklar". "Bağlantılar" is the accurate, non-redundant label for
    // what this sub-table actually contains (a list of platform links).
    assets: "Bağlantılar", sourcematrix: "Kaynak Doğrulama Tablosu", "source matrix": "Kaynak Doğrulama Tablosu",
    channels: "Kanallar", identityverification: "İşletme Kimlik Doğrulaması", "identity verification": "İşletme Kimlik Doğrulaması",
    identity: "Kimlik Doğrulama", consistency: "Tutarlılık",
    inconsistencies: "Tutarsızlıklar", evidence: "Kanıtlar", durum: "Durum", sonuc: "Sonuç",
    kanal: "Kanal", kaynak: "Kaynak", tarih: "Tarih", url: "Bağlantı",
    googlebusinessprofile: "Google İşletme Profili", "google business profile": "Google İşletme Profili",
    // Section 3/4 terminology dictionary — every untranslated English
    // field label the brief named explicitly, plus the technical terms
    // from section 4 (Turkish term first, original abbreviation kept
    // only where it adds real value, e.g. "(CTR)").
    sources: "Kaynaklar",
    brandsearch: "Marka Adıyla Arama Sonuçları", "brand search": "Marka Adıyla Arama Sonuçları",
    query: "Arama Sorgusu", findings: "Bulgular", recommendation: "Öneri", recommendations: "Öneriler",
    when: "Hangi Durumda Önerilir?", why: "Gerekçe", scope: "Hizmet Kapsamı", readiness: "Hazırlık Durumu",
    readinessgates: "Reklama Başlamadan Önceki Koşullar", "readiness gates": "Reklama Başlamadan Önceki Koşullar",
    customerstatement: "Müşteri Beyanı", "customer statement": "Müşteri Beyanı",
    risk: "Risk", risks: "Riskler", priority: "Öncelik", impact: "Etki",
    opportunity: "Fırsat", opportunities: "Fırsatlar", strengths: "Güçlü Yönler", weaknesses: "Zayıf Yönler",
    threats: "Tehditler", competitors: "Rakipler", competitor: "Rakip",
    verifiedat: "Doğrulama Tarihi", "verified at": "Doğrulama Tarihi",
    checkedat: "İnceleme Tarihi", "checked at": "İnceleme Tarihi",
    openpoint: "Netleştirilmesi Gereken Konu", "open point": "Netleştirilmesi Gereken Konu",
    notincluded: "Hizmet Kapsamına Dahil Değil", "not included": "Hizmet Kapsamına Dahil Değil",
    alternatives: "Alternatifler", alternative: "Alternatif",
    customerbudget: "Müşterinin Reklam Bütçesi", "customer budget": "Müşterinin Reklam Bütçesi",
    audience: "Hedef Kitle", creativeangles: "Reklam İçerik Yaklaşımları", "creative angles": "Reklam İçerik Yaklaşımları",
    existingcreatives: "Mevcut Reklam İçerikleri", "existing creatives": "Mevcut Reklam İçerikleri",
    websitevisibility: "Web Sitesi Görünürlüğü", "website visibility": "Web Sitesi Görünürlüğü",
    localmarket: "Yerel Pazar", "local market": "Yerel Pazar",
    differentiation: "Rakiplerden Ayrışma", seasonality: "Mevsimsellik", segments: "Hedef Kitle Segmentleri",
    segment: "Segment", behavior: "Davranış", fark: "Fark", veri: "Veri", firma: "Firma",
    marketanalysis: "Pazar Analizi", "market analysis": "Pazar Analizi",
    competitoranalysis: "Rakip Analizi", "competitor analysis": "Rakip Analizi",
    digitalpresence: "Dijital Varlıklar", "digital presence": "Dijital Varlıklar",
    observations: "Gözlemler", development: "Geliştirilmesi Gereken Alanlar", suggestion: "Öneri",
    current: "Mevcut Durum", result: "Sonuç", results: "Sonuçlar",
    businessad: "İşletmenin Reklamı", "business ad": "İşletmenin Reklamı",
    competitorad: "Rakip Reklamı", "competitor ad": "Rakip Reklamı",
    creative: "Reklam Görseli veya Videosu",
    toverify: "Doğrulanması Gerekenler", "to verify": "Doğrulanması Gerekenler",
    verified: "Doğrulandı", unverified: "Doğrulanmadı", unknown: "Bilinmiyor", likely: "Muhtemel",
    confidence: "Güven Düzeyi", high: "Yüksek", medium: "Orta", low: "Düşük",
    primary: "Birincil Öneri", secondary: "İkinci Aşama", internal: "Dahili Kullanım", client: "Müşteri",
    executivesummary: "Yönetici Özeti", "executive summary": "Yönetici Özeti",
    actionplan: "Eylem Planı", "action plan": "Eylem Planı", nextsteps: "Sonraki Adımlar", "next steps": "Sonraki Adımlar",
    keyissues: "Temel Sorunlar", "key issues": "Temel Sorunlar", keyfindings: "Önemli Bulgular", "key findings": "Önemli Bulgular",
    businessoverview: "İşletmenin Genel Durumu", "business overview": "İşletmenin Genel Durumu",
    performance: "Performans", conversion: "Dönüşüm", engagement: "Etkileşim", reach: "Erişim", impressions: "Gösterim",
    frequency: "Gösterim Sıklığı",
    costperresult: "Sonuç Başına Maliyet", "cost per result": "Sonuç Başına Maliyet",
    costperclick: "Tıklama Başına Maliyet (CPC)", "cost per click": "Tıklama Başına Maliyet (CPC)",
    clickthroughrate: "Tıklama Oranı (CTR)", "click through rate": "Tıklama Oranı (CTR)",
    returnonadspend: "Reklam Harcamasının Getirisi (ROAS)", "return on ad spend": "Reklam Harcamasının Getirisi (ROAS)",
    takeaway: "Genel Değerlendirme", comparison: "Karşılaştırma", note: "Not", market: "Pazar",
    structure: "Yapı", principle: "İlke", audit: "Denetim", interpretation: "Yorum",
    recommended: "Önerilen", howtoimplement: "Nasıl Uygulanır", "how to implement": "Nasıl Uygulanır",
    expectedbenefit: "Beklenen Fayda", "expected benefit": "Beklenen Fayda"
  };
  // Plain (non-locale) lowercasing for the dictionary lookup only — the
  // dictionary keys above are plain ASCII English, and Turkish-locale
  // lowercasing turns "I" into dotless "ı" (e.g. "priceInclVat" -> "price
  // Incl Vat" -> tr-locale-lowercased "price ıncl vat", which then never
  // matches the ASCII "price incl vat" key). Turkish-locale casing is only
  // used below for the human-facing capitalization of whatever key wasn't
  // in the dictionary (which may legitimately be a Turkish word).
  const lower = spaced.toLowerCase();
  if (known[lower]) return known[lower];
  // Unicode-aware (JS \b/\w are ASCII-only and capitalized the letter
  // after every Turkish character: "işletme" -> "işLetme").
  return capitalizeWordsTr(restoreAsciiKeyWords(spaced));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Turkish-locale number formatting only — never touches strings, so a
 * text field that happens to contain digits (a URL, a phone number kept
 * as a string) is never reformatted. 4.6 -> "4,6", 2299 -> "2.299". */
function formatNumberTr(value: number): string {
  return value.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
}

/** The one place a single leaf value is turned into display text — the
 * root-cause fix lives here: an object/array NEVER reaches String() (the
 * source of the literal "[object Object]" bug) and NEVER reaches
 * JSON.stringify() for display (the source of raw `{"rating":4.6,...}`
 * leaking into the report body). Composite values are only ever handed
 * to renderValueLines(), never formatted as a single string. */
function formatPrimitiveForDisplay(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return formatNumberTr(value);
  if (typeof value === "boolean") return value ? "Evet" : "Hayır";
  if (value === null || value === undefined) return "Bilgi bulunamadı";
  return textValue(String(value));
}

/** Recursively renders ANY JSON value (primitive, nested object, nested
 * array, array of objects, mixed array) into human-readable, indented
 * lines — used everywhere a nested structure previously risked reaching
 * String()/JSON.stringify(). A plain object becomes "Label: value" lines
 * (recursing into nested values instead of dumping raw JSON); an array of
 * objects becomes numbered blocks; a mixed array never silently drops its
 * non-object entries (the old code's array-of-objects branch did). */
function renderValueLines(value: unknown, depth = 0): string[] {
  if (isEmptyValue(value)) return [];
  const indent = "  ".repeat(depth);

  if (Array.isArray(value)) {
    const lines: string[] = [];
    value.forEach((item, index) => {
      if (isEmptyValue(item)) return;
      if (isPlainObject(item)) {
        lines.push(`${indent}${index + 1}.`);
        lines.push(...renderValueLines(item, depth + 1));
      } else if (Array.isArray(item)) {
        lines.push(...renderValueLines(item, depth));
      } else {
        // No manual bullet character here: every DocumentSection.items[]
        // entry is already auto-bulleted by both PDF/DOCX renderers
        // (drawBullet / bullet code "2022") — adding our own "•" would
        // double up into "• • text" for a plain top-level array.
        // Indentation alone conveys nesting depth for sub-items.
        lines.push(`${indent}${formatPrimitiveForDisplay(item)}`);
      }
    });
    return lines;
  }

  if (isPlainObject(value)) {
    const lines: string[] = [];
    for (const [key, entryValue] of Object.entries(value)) {
      if (isEmptyValue(entryValue)) continue;
      const label = prettifyKey(key);
      if (isPlainObject(entryValue) || Array.isArray(entryValue)) {
        lines.push(`${indent}${label}:`);
        lines.push(...renderValueLines(entryValue, depth + 1));
      } else {
        lines.push(`${indent}${label}: ${formatPrimitiveForDisplay(entryValue)}`);
      }
    }
    return lines;
  }

  return [`${indent}${formatPrimitiveForDisplay(value)}`];
}

// INTERNAL keeps the analyst's own SWOT vocabulary. CLIENT uses
// constructive, customer-facing terminology for the same two quadrants —
// a presentation-only relabeling (A7): the underlying analysis/meaning is
// never altered, only how "weaknesses" and "threats" are introduced to
// the business reading about itself.
const SWOT_QUADRANTS_INTERNAL: Array<[string, string]> = [
  ["strengths", "Güçlü Yönler"],
  ["weaknesses", "Zayıf Yönler"],
  ["opportunities", "Fırsatlar"],
  ["threats", "Tehditler / Rekabet Riskleri"]
];
const SWOT_QUADRANTS_CLIENT: Array<[string, string]> = [
  ["strengths", "Güçlü Yönler"],
  ["weaknesses", "Geliştirilebilecek Alanlar"],
  ["opportunities", "Fırsatlar"],
  ["threats", "Rekabet / Dikkat Edilmesi Gerekenler"]
];

function swotToSection(value: unknown, isInternal: boolean): DocumentSection | null {
  if (isEmptyValue(value)) return null;
  const swot = value as Record<string, unknown>;
  const quadrants = isInternal ? SWOT_QUADRANTS_INTERNAL : SWOT_QUADRANTS_CLIENT;
  const rows: string[][] = [];
  for (const [key, label] of quadrants) {
    const entry = swot[key];
    if (isEmptyValue(entry)) continue;
    // renderValueLines handles string/array/object uniformly — never
    // String()'s an object (root cause of literal "[object Object]" when a
    // SWOT quadrant is populated with structured entries, not plain text).
    const content = renderValueLines(entry).join("; ");
    if (content) rows.push([label, content]);
  }
  if (!rows.length) return null;
  const table: DocumentTable = { headers: ["Kategori", "Değerlendirme"], rows };
  return { title: "SWOT", table };
}

// Matches a leading http(s) URL with no embedded whitespace, optionally
// followed by a trailing human note (e.g. "https://...esya (muhtemel)" ->
// url="https://...esya", note="(muhtemel)"). Source data occasionally
// carries exactly this shape (a confidence caveat appended after the raw
// link) — the note must never be silently dropped, and the URL must
// never be truncated to make room for it.
const URL_WITH_NOTE_PATTERN = /^(https?:\/\/\S+?)(?:\s+(.*))?$/;

function parseUrlString(value: string): { url: string; note: string } | null {
  const match = value.trim().match(URL_WITH_NOTE_PATTERN);
  if (!match) return null;
  return { url: match[1], note: match[2] || "" };
}

/** A single leaf cell in an object-array TABLE: unlike a full section body,
 * a table cell must stay a single (wrapped) string or real link — so a
 * nested object/array inside a cell is flattened via renderValueLines and
 * joined, never JSON.stringify()'d. A bare URL string becomes a real
 * clickable DocumentLink (short visible label, full href preserved) —
 * root-cause fix for the old "truncated/broken raw URL in a narrow table
 * cell" bug: the full URL was always there, it just had no way to be
 * displayed short without a dedicated link concept. */
function cellValue(value: unknown): DocumentCell {
  if (isEmptyValue(value)) return "—";
  if (typeof value === "string") {
    const parsed = parseUrlString(value);
    if (parsed) return { label: parsed.note ? `Bağlantıyı Aç (${parsed.note})` : "Bağlantıyı Aç", url: parsed.url };
    return formatPrimitiveForDisplay(value);
  }
  if (isPlainObject(value) || Array.isArray(value)) {
    const lines = renderValueLines(value);
    return lines.length ? lines.join("; ") : "—";
  }
  return formatPrimitiveForDisplay(value);
}

/** Shared by both a top-level array-of-objects field (e.g. competitor_
 * analysis, sources) and a nested one discovered inside a plain object
 * (e.g. digital_presence.sourceMatrix / .channels) — same homogeneous-
 * table detection and rendering either way, so a field's position in the
 * JSON never decides whether it gets a real table or a bullet dump. */
/** Column order for object tables: identity first (Platform / Ad /
 * Rakip), then status, then everything else, findings/notes last. Keys
 * move together with their values, so no row is ever misaligned; columns
 * with no recognisable role keep their stored order. */
function columnRank(key: string): number {
  const k = key.toLocaleLowerCase("tr");
  if (/^(platform|kanal|channel|name|ad|isim|firma|rakip|competitor|business|işletme|isletme)/.test(k)) return 0;
  if (/(durum|status|mevcut|current|var_?mi|exists)/.test(k)) return 1;
  if (/(bulgu|finding|not|note|yorum|açıklama|aciklama|detail|detay|comment|observation|gözlem|gozlem)/.test(k)) return 3;
  return 2;
}

function arrayOfObjectsToTable(rows: Array<Record<string, unknown>>): DocumentTable {
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))].slice(0, 6)
    .map((key, index) => ({ key, index, rank: columnRank(key) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((c) => c.key);
  return {
    headers: headers.map(prettifyKey),
    rows: rows.map((row) => headers.map((key) => cellValue(row[key])))
  };
}

/** True when a flat object's values are mostly/entirely URL-bearing
 * strings (e.g. digital_presence.assets: {instagram, facebook, tiktok,
 * googleBusinessProfile, ...}) — the "Assets:" bullet-dump bug the
 * supplied example reports showed: a platform name followed by a raw,
 * unshortened, often very long URL (Google Maps place links in
 * particular run to 100+ characters) drawn as plain wrapped body text. */
function isLinkBearingObject(value: Record<string, unknown>): boolean {
  const nonEmptyValues = Object.values(value).filter((v) => !isEmptyValue(v));
  if (!nonEmptyValues.length) return false;
  const urlCount = nonEmptyValues.filter((v) => typeof v === "string" && parseUrlString(v)).length;
  return urlCount > 0 && urlCount >= nonEmptyValues.length / 2;
}

function linkBearingObjectToTable(obj: Record<string, unknown>): DocumentTable {
  const entries = Object.entries(obj).filter(([, v]) => !isEmptyValue(v));
  return {
    headers: ["Platform", "Bağlantı"],
    rows: entries.map(([key, v]) => [prettifyKey(key), cellValue(v)])
  };
}

/** A plain object (e.g. digital_presence) often carries BOTH ordinary
 * scalar/text fields AND one or more nested fields that deserve their own
 * table (a homogeneous array-of-objects, or a link-bearing flat map) —
 * root-cause fix for the "Source Matrix"/"Assets"/"Channels" bullet-dump
 * bug: those nested fields were being flattened through the same
 * recursive bullet renderer as everything else, with no path to becoming
 * a table unless they happened to be the section's OWN top-level value
 * (valueToSection's array branch already handled that case correctly —
 * this handles the same shapes one level deeper). Returns the base
 * section (remaining scalar fields, if any) followed by one section per
 * extracted sub-table — never both the extracted table AND a duplicate
 * bullet rendering of the same field. */
/** A flat object whose values are ALL typed JSON numbers (e.g. a stored
 * content distribution {urun_satisi: 24, tamir: 3}) — a real two-column
 * table (and therefore chartable), never free-text parsing. */
function isNumericMap(value: Record<string, unknown>): boolean {
  const entries = Object.values(value).filter((v) => v !== null && v !== undefined);
  return entries.length >= 2 && entries.every((v) => typeof v === "number" && Number.isFinite(v));
}

function numericMapToTable(obj: Record<string, unknown>): DocumentTable {
  const entries = Object.entries(obj).filter(([, v]) => typeof v === "number" && Number.isFinite(v));
  return { headers: ["Kategori", "Değer"], rows: entries.map(([key, v]) => [prettifyKey(key), formatPrimitiveForDisplay(v)]) };
}

function objectToSections(title: string, obj: Record<string, unknown>): DocumentSection[] {
  if (isNumericMap(obj)) return [{ title, table: numericMapToTable(obj) }];
  const remaining: Record<string, unknown> = {};
  const extracted: DocumentSection[] = [];

  for (const [key, entryValue] of Object.entries(obj)) {
    if (isEmptyValue(entryValue)) continue;
    if (Array.isArray(entryValue)) {
      const rows = entryValue.filter((item): item is Record<string, unknown> => isPlainObject(item));
      const nonEmptyCount = entryValue.filter((item) => !isEmptyValue(item)).length;
      if (rows.length && rows.length === nonEmptyCount) {
        extracted.push({ title: `${title} — ${prettifyKey(key)}`, table: arrayOfObjectsToTable(rows) });
        continue;
      }
    } else if (isPlainObject(entryValue) && isNumericMap(entryValue)) {
      extracted.push({ title: `${title} — ${prettifyKey(key)}`, table: numericMapToTable(entryValue) });
      continue;
    } else if (isPlainObject(entryValue) && isLinkBearingObject(entryValue)) {
      extracted.push({ title: `${title} — ${prettifyKey(key)}`, table: linkBearingObjectToTable(entryValue) });
      continue;
    }
    remaining[key] = entryValue;
  }

  const baseItems = renderValueLines(remaining);
  const sections: DocumentSection[] = [];
  if (baseItems.length) sections.push({ title, items: baseItems });
  sections.push(...extracted);
  return sections;
}

/** Any stored JSON value -> readable document sections (tables for arrays
 * of objects, clickable link tables, bullet lists, nested sub-sections).
 * Shared with Rapor Merkezi for other stored analyses (Instagram profil
 * analizi, aylık raporlar) so they render with the same rules. */
export function structuredValueSections(title: string, value: unknown): DocumentSection[] {
  return valueToSection(title, value);
}

function valueToSection(title: string, value: unknown): DocumentSection[] {
  if (isEmptyValue(value)) return [];

  if (typeof value === "string") return [{ title, text: textValue(value) }];

  if (Array.isArray(value)) {
    const objectCount = value.filter((item) => isPlainObject(item)).length;
    if (objectCount === 0) {
      // Every entry is a primitive (or a nested array) — a plain bullet
      // list; formatPrimitiveForDisplay applies Turkish number/boolean
      // formatting instead of a naive String().
      const items = renderValueLines(value);
      return items.length ? [{ title, items }] : [];
    }
    if (objectCount === value.filter((item) => !isEmptyValue(item)).length) {
      // Every non-empty entry is an object with a broadly similar shape
      // (e.g. competitor_analysis) — render as a professional table
      // instead of a bullet dump. Never fabricates a column the data
      // doesn't have; never JSON.stringify()'s a nested cell (root cause
      // of "Competitors: [object Object], [object Object]").
      const rows = value.filter((item): item is Record<string, unknown> => isPlainObject(item));
      return [{ title, table: arrayOfObjectsToTable(rows) }];
    }
    // A genuinely mixed array (some objects, some plain strings/numbers) —
    // no single schema to tabulate. Falls back to the same recursive
    // bullet renderer, which (unlike the old code) never silently drops
    // the non-object entries.
    const items = renderValueLines(value);
    return items.length ? [{ title, items }] : [];
  }

  if (isPlainObject(value)) return objectToSections(title, value);

  return [{ title, text: textValue(String(value)) }];
}

// A8 — CLIENT DATA FIREWALL. Even though these three fields are part of
// PRE_AUDIT_SECTION_LABELS (the "not sales-notes/scripts" list), they
// carry package name/price/classification and internal ad-budget
// figures — CLIENT_REPORT must never render them, no matter what the
// row contains. Enforced structurally here (buildClientSections simply
// never reads these keys), not by a regex/keyword scrub — the same
// defence-in-depth pattern already used for PRE_AUDIT_INTERNAL_SECTION_LABELS.
// They move to buildInternalOnlySections instead, so INTERNAL_REPORT
// still shows them in full.
const CLIENT_FIREWALL_KEYS = new Set(["recommended_package", "budget_plan", "ad_strategy"]);

// A6 — customer-first reading order for the client document (digital
// footprint first, then competitive context, then opportunities/next
// steps). Every key here is still one of PRE_AUDIT_SECTION_LABELS — this
// only resequences existing, already-vetted client-safe sections; it
// never adds a field that wasn't already client-visible.
const CLIENT_SECTION_ORDER = [
  "digital_presence", "google_analysis", "maps_analysis", "website_analysis", "seo_analysis",
  "social_analysis", "meta_ads_analysis", "google_ads_analysis", "market_analysis", "competitor_analysis",
  "digital_gaps", "opportunities", "recommended_services", "sources"
];

const CLIENT_ABOUT_TEXT = "Bu ön inceleme, işletmenin erişilebilen dijital varlıkları ve doğrulanabilen açık veriler üzerinden hazırlanmıştır. Amaç; mevcut güçlü yönleri, geliştirilebilecek alanları ve dijital büyüme fırsatlarını ortaya koymaktır.";
const CLIENT_NEXT_STEP_TEXT = "Ön incelemede belirlenen fırsatların işletmenin mevcut kapasitesi, hedefleri ve öncelikleriyle birlikte değerlendirilmesi için kısa bir görüşme öneriyoruz. Görüşme sonrasında ihtiyaçlara uygun çalışma kapsamı ve teklif hazırlanabilir.";

function buildClientSections(report: PreAuditReport, isInternal: boolean): DocumentSection[] {
  const sections: DocumentSection[] = [];
  if (!isInternal) sections.push({ title: "Bu Rapor Hakkında", text: CLIENT_ABOUT_TEXT });
  const order = isInternal ? PRE_AUDIT_SECTION_LABELS.map(([key]) => key) : CLIENT_SECTION_ORDER;
  const byKey = new Map(PRE_AUDIT_SECTION_LABELS);
  for (const key of order) {
    if (key === "executive_summary") continue; // rendered as the document's executive summary, not a repeated section
    if (!isInternal && CLIENT_FIREWALL_KEYS.has(key)) continue; // structurally unreachable for CLIENT_REPORT
    const label = byKey.get(key);
    if (!label) continue;
    sections.push(...valueToSection(label, (report as unknown as Record<string, unknown>)[key]));
  }
  // SWOT is not one of PRE_AUDIT_SECTION_LABELS (report.swot is a separate
  // column) — same placement as PreAuditCenter.tsx's ReportDetail, which
  // renders <SwotSection> right after the SECTION_LABELS loop. Client
  // quadrant labels (A7): constructive terminology, same underlying data.
  const swotSection = swotToSection(report.swot, isInternal);
  if (swotSection) sections.push(swotSection);
  if (!isInternal) sections.push({ title: "Sonraki Adım", text: CLIENT_NEXT_STEP_TEXT });
  return sections;
}

// sales_notes/sales_script/instagram_dm/whatsapp_initial/whatsapp_with_pdf/
// objections — the PRE_AUDIT_INTERNAL_SECTION_LABELS fields. The 3
// client-firewalled PRE_AUDIT_SECTION_LABELS fields (recommended_package/
// budget_plan/ad_strategy) are already included for INTERNAL_REPORT by
// buildClientSections(report, true) in their natural section order —
// never duplicated here.
function buildInternalOnlySections(report: PreAuditReport): DocumentSection[] {
  const sections: DocumentSection[] = [];
  for (const [key, label] of PRE_AUDIT_INTERNAL_SECTION_LABELS) {
    sections.push(...valueToSection(label, (report as unknown as Record<string, unknown>)[key]));
  }
  return sections;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\s*\d+([.,]\d+)?\s*$/.test(value)) return Number(value.replace(",", "."));
  return null;
}

function pick(obj: unknown, ...keys: string[]): number | null {
  if (!isPlainObject(obj)) return null;
  for (const key of keys) {
    const direct = finiteNumber(obj[key]);
    if (direct !== null) return direct;
  }
  return null;
}

/** Premium V3 headline cards — only publicly observable figures that the
 * saved report states as plain numbers at a known key (Google rating /
 * review count, Instagram followers). Anything else stays in the text;
 * nothing is parsed out of prose or estimated. Exported for tests. */
export function preAuditHeadlineMetrics(report: PreAuditReport): DocumentMetric[] {
  const out: DocumentMetric[] = [];
  const maps = report.maps_analysis as Record<string, unknown>;
  const google = report.google_analysis as Record<string, unknown>;
  const social = report.social_analysis as Record<string, unknown>;
  const rating = pick(maps, "rating", "googleRating") ?? pick(google, "rating", "googleRating");
  const reviews = pick(maps, "reviewCount", "reviewsCount", "reviews") ?? pick(google, "reviewCount", "reviewsCount");
  if (rating !== null && rating > 0 && rating <= 5) out.push({ label: "Google Puanı", value: `${formatNumberTrDigits(rating, 1)} / 5`, note: reviews !== null ? `${formatNumberTrDigits(reviews, 0)} yorum` : undefined });
  const followers = pick(isPlainObject(social) ? social.instagram : null, "followers") ?? pick(social, "instagramFollowers", "followers");
  if (followers !== null) out.push({ label: "Instagram Takipçi", value: formatNumberTrDigits(followers, 0) });
  return out;
}

/** INTERNAL only (budget_plan never reaches a client document): a donut of
 * the plan's own per-channel monthly amounts, labelled as a proposal. */
export function preAuditBudgetChart(report: PreAuditReport): DocumentChart | null {
  if (!isPlainObject(report.budget_plan)) return null;
  const data = Object.entries(report.budget_plan)
    .filter(([key]) => /meta|facebook|instagram|google|tiktok|youtube|remarketing|yeniden/i.test(key) && !/total|toplam|daily|günlük|gunluk/i.test(key))
    .map(([key, value]) => ({ label: prettifyKey(key), value: finiteNumber(value) }));
  if (data.filter((d) => d.value !== null && d.value > 0).length < 2) return null;
  return { type: "donut", title: "Önerilen Aylık Bütçe Dağılımı", valueFormat: "currency", data, caption: "Ön incelemede önerilen dağılımdır; gerçekleşen harcama değildir." };
}

/** Source of truth for BOTH PDF and DOCX — one payload, two renderers
 * (generatePdfBuffer/generateDocxBuffer), so the two formats can never
 * drift into different content. */
export function buildPreAuditDocumentPayload(report: PreAuditReport, companyDisplayName: string): DocumentPayload {
  const isInternal = report.report_type === "INTERNAL_REPORT";
  // created_at/updated_at (timestamptz) carry real time-of-day; report_date
  // is a bare date column, so the document's "Rapor Tarihi" uses created_at
  // to let the operator tell same-day re-checks apart.
  const createdLabel = formatTurkishDateTime(report.created_at);
  const updatedLabel = formatTurkishDateTime(report.updated_at);
  const meaningfullyUpdated = Boolean(report.created_at && report.updated_at) &&
    Math.abs(new Date(report.updated_at).getTime() - new Date(report.created_at).getTime()) >= 60000;

  // A8: since recommended_package/budget_plan/ad_strategy never reach the
  // CLIENT document body at all, a "... ve Teklif Raporu" title/filename
  // would promise offer content the document no longer contains — both
  // report types now use one plain, honest title regardless of what the
  // underlying report data happens to hold.
  const sections = buildClientSections(report, isInternal);
  if (isInternal) {
    const budgetChart = preAuditBudgetChart(report);
    if (budgetChart) {
      const index = sections.findIndex((section) => section.title === "Bütçe Planı");
      const chartSection: DocumentSection = { title: "Bütçe Planı — Dağılım", charts: [budgetChart] };
      if (index >= 0) sections.splice(index + 1, 0, chartSection); else sections.push(chartSection);
    }
    const internalSections = buildInternalOnlySections(report);
    if (internalSections.length) sections.push(...internalSections);
  }

  return {
    title: isInternal ? "HK Dijital — Dahili Ön İnceleme Raporu" : "HK Dijital — Ön İnceleme Raporu",
    customerName: companyDisplayName,
    period: createdLabel,
    executiveSummary: textValue(report.executive_summary || ""),
    headlineMetrics: preAuditHeadlineMetrics(report),
    sections,
    footerNote: isInternal
      ? "HK Dijital · Dahili Kullanım · Müşteriyle Paylaşılmaz"
      : "HK Dijital · Dijital Pazarlama & Büyüme Çözümleri · hkdijital.com.tr",
    logo: true,
    confidentialLabel: isInternal ? "Dahili Kullanım" : undefined,
    metaLines: [
      `Firma: ${companyDisplayName}`,
      `Rapor Tarihi: ${createdLabel}`,
      ...(meaningfullyUpdated ? [`Son Güncelleme: ${updatedLabel}`] : []),
      "Hazırlayan: HK Dijital",
      isInternal ? "Rapor Türü: Dahili Satış & Toplantı Hazırlığı" : "Rapor Türü: Dijital Ön İnceleme"
    ]
  };
}

export function buildPreAuditFileName(report: PreAuditReport, companyDisplayName: string, format: "pdf" | "docx"): string {
  const isInternal = report.report_type === "INTERNAL_REPORT";
  const company = safeFileNameSegment(companyDisplayName);
  const suffix = isInternal ? "Dahili-On-Inceleme-Raporu" : "On-Inceleme-Raporu";
  return `HK-Dijital-${company}-${suffix}.${format}`;
}
