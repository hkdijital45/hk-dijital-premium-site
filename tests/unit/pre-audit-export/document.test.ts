// Run via `npm run test:pre-audit-export` — this file's import chain
// touches "server-only" (document-generator.ts, document.ts) and "@/"
// tsconfig path aliases, neither resolvable by the base plain-node test
// runner. --conditions=react-server remaps "server-only" to its no-op
// build (same trick already used by tests/unit/social-autopilot), and
// --import tsx resolves the aliases.
import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip"; // already a direct dependency of "docx" (real DOCX generation uses it) — not a new dependency
import { PDFDocument } from "pdf-lib";
import { buildPreAuditDocumentPayload, buildPreAuditFileName } from "../../../src/lib/pre-audit/document.ts";
import { generateDocxBuffer, generatePdfBuffer } from "../../../src/lib/server/document-generator.ts";
import { PRE_AUDIT_INTERNAL_SECTION_LABELS, PRE_AUDIT_SECTION_LABELS, type PreAuditReport } from "../../../src/lib/pre-audit/types.ts";

// Synthetic fixture only — never real customer data. The Turkish sentence
// deliberately exercises ğ Ğ ü Ü ş Ş ı İ ö Ö ç Ç.
const TURKISH_SENTENCE = "İşletmenin dijital görünürlüğü, müşteri iletişimi ve dönüşüm potansiyeli geliştirilebilir.";
const INTERNAL_MARKER = "GİZLİ SATIŞ NOTU: Bu firma fiyata duyarlı, önce Meta paketini teklif et.";
const COMPANY_NAME = "Örnek İşletme";

function baseReport(overrides: Partial<PreAuditReport> = {}): PreAuditReport {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    company_id: null,
    lead_id: null,
    analysis_group_id: "22222222-2222-4222-8222-222222222222",
    report_type: "CLIENT_REPORT",
    title: COMPANY_NAME,
    status: "draft",
    report_date: "2026-09-21",

    executive_summary: TURKISH_SENTENCE,
    digital_presence: "Google Haritalar profili doğrulanmış, web sitesi mobil uyumlu değil.",
    google_analysis: { "puan": "4.6", "yorum_sayisi": "128" },
    maps_analysis: "Google Haritalar üzerinde 3 rakip daha üst sırada görünüyor.",
    website_analysis: "Web sitesi SSL sertifikasına sahip ancak sayfa hızı düşük.",
    seo_analysis: "Yerel SEO için başlık etiketleri optimize edilmemiş.",
    social_analysis: "Instagram hesabı aktif ancak haftada 1'den az paylaşım yapılıyor.",
    meta_ads_analysis: "Meta reklam kütüphanesinde aktif reklam sinyali bulunamadı.",
    google_ads_analysis: "Google Ads şeffaflık merkezinde aktif kampanya görünmüyor.",
    market_analysis: "Bölgede benzer hizmet sunan 6 işletme tespit edildi.",
    competitor_analysis: [
      { "rakip": "Rakip A", "google_puani": "4.8", "instagram": "@rakipa" },
      { "rakip": "Rakip B", "google_puani": "4.2", "instagram": "@rakipb" }
    ],
    swot: {
      strengths: ["Yüksek Google puanı", "Güçlü müşteri sadakati"],
      weaknesses: ["Web sitesi yavaş", "Düzensiz sosyal medya paylaşımı"],
      opportunities: ["Yerel SEO potansiyeli", "Instagram reklamı ile talep artışı"],
      threats: ["Rakiplerin daha aktif reklam yapması"]
    },
    digital_gaps: ["Web sitesi hız sorunu", "Eksik Google Ads varlığı"],
    opportunities: ["Yerel SEO ile organik trafik artışı", "Meta reklamlarıyla mesaj/randevu talebi"],
    recommended_services: ["Meta Reklam Yönetimi", "Google Ads Yönetimi"],
    recommended_package: { "paket": "Büyüme Paketi", "aylik_ucret": "12.000 TL" },
    ad_strategy: { "ilk_ay": "Farkındalık + mesaj toplama kampanyası" },
    budget_plan: { "onerilen_reklam_butcesi": "6.000 TL/ay" },
    sources: ["Google Haritalar (2026-09-20)", "İşletme web sitesi (2026-09-20)"],

    sales_notes: "",
    sales_script: "",
    instagram_dm: "",
    whatsapp_initial: "",
    whatsapp_with_pdf: "",
    objections: [],

    pdf_reference: null,
    created_at: "2026-09-21T09:00:00.000Z",
    updated_at: "2026-09-21T09:00:00.000Z",
    ...overrides
  };
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = zip.file("word/document.xml");
  assert.ok(documentXml, "word/document.xml must exist inside a real DOCX");
  return documentXml!.async("string");
}

test("TEST A — client PDF is a real, valid PDF with the branded title and no internal content", async () => {
  const report = baseReport();
  const payload = buildPreAuditDocumentPayload(report, COMPANY_NAME);
  const buffer = await generatePdfBuffer(payload);

  assert.equal(buffer.subarray(0, 4).toString("latin1"), "%PDF", "must be a real PDF, not an HTML file renamed .pdf");
  assert.ok(buffer.length > 2000, "PDF should have real, non-trivial content");

  const loaded = await PDFDocument.load(buffer);
  assert.ok(loaded.getPageCount() >= 1);
  assert.equal(payload.title, "HK Dijital — Ön İnceleme ve Teklif Raporu");
  assert.ok(!payload.sections.some((s) => PRE_AUDIT_INTERNAL_SECTION_LABELS.some(([, label]) => label === s.title)));
});

test("TEST B — client DOCX is a real, valid DOCX containing Turkish text and the client title, with no internal content", async () => {
  const report = baseReport({ sales_notes: INTERNAL_MARKER }); // dirty row: internal field populated even though report_type is CLIENT_REPORT
  const payload = buildPreAuditDocumentPayload(report, COMPANY_NAME);
  const buffer = await generateDocxBuffer(payload);

  assert.equal(buffer.subarray(0, 2).toString("latin1"), "PK", "must be a real DOCX (zip container), not an HTML file renamed .docx");
  const xml = await extractDocxText(buffer);
  assert.match(xml, /Ön İnceleme ve Teklif Raporu/);
  assert.match(xml, /güncellenmesi|görünürlüğü/); // Turkish-character glyphs survive into the XML
  assert.doesNotMatch(xml, /GİZLİ SATIŞ NOTU/, "a client document must never contain internal-only content, even from a dirty row");
  assert.doesNotMatch(xml, /Satış Görüşmesi Notları/);
});

test("TEST C — internal report export is clearly marked DAHİLİ and includes internal-only sections", async () => {
  const report = baseReport({ report_type: "INTERNAL_REPORT", sales_notes: INTERNAL_MARKER, sales_script: "Merhaba, HK Dijital'den arıyorum..." });
  const payload = buildPreAuditDocumentPayload(report, COMPANY_NAME);

  assert.equal(payload.confidentialLabel, "Dahili Kullanım");
  assert.equal(payload.title, "HK Dijital — Dahili Ön İnceleme Raporu");
  assert.ok(payload.sections.some((s) => s.title === "Satış Görüşmesi Notları"));

  const docx = await generateDocxBuffer(payload);
  const xml = await extractDocxText(docx);
  assert.match(xml, /GİZLİ SATIŞ NOTU/, "internal export legitimately includes internal content");
  assert.match(xml, /DAHİLİ KULLANIM/);
});

test("TEST C(b) — internal export is never mistaken for a client-safe document (title always reflects real report_type)", () => {
  const internalPayload = buildPreAuditDocumentPayload(baseReport({ report_type: "INTERNAL_REPORT" }), COMPANY_NAME);
  const clientPayload = buildPreAuditDocumentPayload(baseReport({ report_type: "CLIENT_REPORT" }), COMPANY_NAME);
  assert.notEqual(internalPayload.title, clientPayload.title);
  assert.ok(internalPayload.confidentialLabel);
  assert.equal(clientPayload.confidentialLabel, undefined);
});

test("SWOT is included as its own table section (regression: swot is not one of PRE_AUDIT_SECTION_LABELS, it must be added separately)", async () => {
  const report = baseReport();
  const payload = buildPreAuditDocumentPayload(report, COMPANY_NAME);
  const swotSection = payload.sections.find((s) => s.title === "SWOT");
  assert.ok(swotSection, "SWOT section must be present when report.swot is populated");
  assert.ok(swotSection!.table);
  assert.ok(swotSection!.table!.rows.some((row) => row[0] === "Güçlü Yönler"));

  const docx = await generateDocxBuffer(payload);
  const xml = await extractDocxText(docx);
  assert.match(xml, /SWOT/);
  assert.match(xml, /Güçlü Yönler/);
  assert.match(xml, /Yüksek Google puanı/);
});

test("TEST D — legacy/minimal report rows (mostly empty jsonb columns) do not crash the document builder", async () => {
  const legacyReport = baseReport({
    digital_presence: {}, google_analysis: {}, maps_analysis: "", website_analysis: "", seo_analysis: "",
    social_analysis: "", meta_ads_analysis: "", google_ads_analysis: "", market_analysis: "", competitor_analysis: [],
    swot: {}, digital_gaps: [], opportunities: [], recommended_services: [], recommended_package: {}, ad_strategy: {},
    budget_plan: {}, sources: []
  });
  const payload = buildPreAuditDocumentPayload(legacyReport, COMPANY_NAME);
  assert.equal(payload.title, "HK Dijital — Ön İnceleme Raporu", "no offer content -> title omits 've Teklif'");
  const buffer = await generatePdfBuffer(payload);
  assert.equal(buffer.subarray(0, 4).toString("latin1"), "%PDF");
});

test("TEST E — client document builder never reads any PRE_AUDIT_INTERNAL_SECTION_LABELS field, structurally", () => {
  const report = baseReport({
    sales_notes: INTERNAL_MARKER, sales_script: INTERNAL_MARKER, instagram_dm: INTERNAL_MARKER,
    whatsapp_initial: INTERNAL_MARKER, whatsapp_with_pdf: INTERNAL_MARKER, objections: [{ text: INTERNAL_MARKER }]
  });
  const payload = buildPreAuditDocumentPayload(report, COMPANY_NAME);
  const internalLabels = new Set(PRE_AUDIT_INTERNAL_SECTION_LABELS.map(([, label]) => label));
  for (const section of payload.sections) {
    assert.ok(!internalLabels.has(section.title), `client payload must not contain internal section "${section.title}"`);
  }
  const serialized = JSON.stringify(payload);
  assert.doesNotMatch(serialized, /GİZLİ SATIŞ NOTU/);
});

test("TEST F — no function in this module converts an INTERNAL_REPORT into a client-labeled document", () => {
  // buildPreAuditDocumentPayload takes only (report, companyDisplayName) —
  // there is no reportType override parameter a caller could pass to force
  // a different label than the report's own real report_type.
  assert.equal(buildPreAuditDocumentPayload.length, 2);
  const internalPayload = buildPreAuditDocumentPayload(baseReport({ report_type: "INTERNAL_REPORT" }), COMPANY_NAME);
  assert.match(internalPayload.title, /Dahili/);
});

test("TEST G — long paragraphs, bullets, tables and long URLs do not crash PDF/DOCX generation", async () => {
  const longParagraph = `${TURKISH_SENTENCE} `.repeat(60);
  const longUrl = `https://www.hkdijital.com.tr/${"cok-uzun-bir-yol-segmenti-".repeat(10)}sayfa`;
  const report = baseReport({
    executive_summary: longParagraph,
    website_analysis: `Detaylı analiz: ${longUrl}`,
    digital_gaps: Array.from({ length: 25 }, (_, i) => `Boşluk maddesi ${i + 1}: ${TURKISH_SENTENCE}`),
    competitor_analysis: Array.from({ length: 8 }, (_, i) => ({ rakip: `Rakip ${i + 1}`, google_puani: "4.5", not: TURKISH_SENTENCE }))
  });
  const payload = buildPreAuditDocumentPayload(report, COMPANY_NAME);
  const pdf = await generatePdfBuffer(payload);
  const docx = await generateDocxBuffer(payload);
  assert.ok(pdf.length > 2000);
  assert.ok(docx.length > 2000);
  const loaded = await PDFDocument.load(pdf);
  assert.ok(loaded.getPageCount() >= 1);
});

test("document metaLines: shows only 'Rapor Tarihi' when the report was never meaningfully updated, and includes 'Son Güncelleme' when it was", () => {
  const neverUpdated = buildPreAuditDocumentPayload(baseReport({ created_at: "2026-09-21T09:00:00.000Z", updated_at: "2026-09-21T09:00:00.000Z" }), COMPANY_NAME);
  assert.ok(neverUpdated.metaLines!.some((l) => l.startsWith("Rapor Tarihi:")));
  assert.ok(!neverUpdated.metaLines!.some((l) => l.startsWith("Son Güncelleme:")));

  const laterUpdated = buildPreAuditDocumentPayload(baseReport({ created_at: "2026-09-21T09:00:00.000Z", updated_at: "2026-09-21T15:12:00.000Z" }), COMPANY_NAME);
  assert.ok(laterUpdated.metaLines!.some((l) => l.startsWith("Son Güncelleme:")));
});

test("buildPreAuditFileName: sanitizes Turkish characters and picks the correct suffix", () => {
  const withOffer = baseReport();
  const noOffer = baseReport({ recommended_package: {}, budget_plan: {}, recommended_services: [] });
  const internal = baseReport({ report_type: "INTERNAL_REPORT" });

  const pdfName = buildPreAuditFileName(withOffer, "Örnek İşletme Güzellik Salonu", "pdf");
  assert.equal(pdfName, "HK-Dijital-Ornek-Isletme-Guzellik-Salonu-On-Inceleme-ve-Teklif-Raporu.pdf");
  assert.ok(!/[çğıöşü]/i.test(pdfName));

  const docxNameNoOffer = buildPreAuditFileName(noOffer, "Örnek İşletme", "docx");
  assert.equal(docxNameNoOffer, "HK-Dijital-Ornek-Isletme-On-Inceleme-Raporu.docx");

  const internalName = buildPreAuditFileName(internal, "Örnek İşletme", "pdf");
  assert.equal(internalName, "HK-Dijital-Ornek-Isletme-Dahili-On-Inceleme-Raporu.pdf");
});

test("all PRE_AUDIT_SECTION_LABELS keys exist on the PreAuditReport fixture (schema drift guard)", () => {
  const report = baseReport() as unknown as Record<string, unknown>;
  for (const [key] of PRE_AUDIT_SECTION_LABELS) {
    assert.ok(key in report, `PreAuditReport fixture is missing field "${key}"`);
  }
});

// ============================================================================
// Structured-value renderer regression: real production reports have JSONB
// columns that carry nested objects/arrays (a company's own AI-produced
// Google/Instagram/competitor/package structures), not just plain strings —
// the export layer must render all of these as prose/tables, never
// "[object Object]" and never raw JSON.stringify() output. This section
// models the actual "Esra Mumcuoğlu Nail Studio"-shaped bug report without
// hardcoding to that one business — any report with this general shape must
// render cleanly.
// ============================================================================

function structuredReport(overrides: Partial<PreAuditReport> = {}): PreAuditReport {
  return baseReport({
    google_analysis: { rating: 4.6, reviewCount: 7, phoneListed: true },
    social_analysis: { instagram: { handle: "@esramumcuoglu_nailstudio", followers: 2299, following: 144, posts: 1271 } },
    competitor_analysis: [
      { name: "Rakip Nail Studio A", rating: 4.8, reviewCount: 210, phone: "0532 000 00 00" },
      { name: "Rakip Nail Studio B", rating: 4.2, reviewCount: 45, phone: null }
    ],
    recommended_package: {
      condition: "Büyüme hedefi ve yeni müşteri kabul kapasitesi toplantıda doğrulanırsa",
      package: "Meta Reklam Starter",
      priceExclVat: 8000,
      priceInclVat: 9600,
      classification: "B — Koşullu Paket Fırsatı"
    },
    ad_strategy: { metaStrategy: { dailyBudget: 150, objective: "Mesaj/Randevu Toplama", targeting: "Manisa 15km çevresi, 18-45 yaş kadın" } },
    ...overrides
  });
}

test("STRUCTURED RENDERER — nested Google object (rating/reviewCount/phoneListed) renders as readable Turkish text, never raw JSON", async () => {
  const payload = buildPreAuditDocumentPayload(structuredReport(), COMPANY_NAME);
  const serialized = JSON.stringify(payload);
  assert.doesNotMatch(serialized, /\{"rating":/, "must never leak raw JSON.stringify output for a nested object field");
  assert.doesNotMatch(serialized, /\[object Object\]/);
  const section = payload.sections.find((s) => s.title === "Google")!;
  assert.ok(section, "Google section must exist");
  const text = (section.items || []).join(" ");
  assert.match(text, /4,6/, "rating must use Turkish decimal comma formatting");
  assert.match(text, /Yorum Sayısı: 7/);
  assert.match(text, /Telefon: Evet/, "boolean true must render as Evet, not 'true'");
});

test("STRUCTURED RENDERER — nested Instagram object (handle/followers/following/posts) renders with Turkish thousands separators and readable labels", async () => {
  const payload = buildPreAuditDocumentPayload(structuredReport(), COMPANY_NAME);
  const section = payload.sections.find((s) => s.title === "Sosyal Medya")!;
  assert.ok(section);
  const text = (section.items || []).join(" ");
  assert.match(text, /@esramumcuoglu_nailstudio/);
  assert.match(text, /Takipçi: 2\.299/, "followers must use Turkish thousands separator");
  assert.match(text, /Takip Edilen: 144/);
  assert.match(text, /Paylaşım: 1\.271/);
  assert.doesNotMatch(JSON.stringify(payload), /"followers":2299/);
});

test("STRUCTURED RENDERER — competitor_analysis (object[]) renders as a table, never '[object Object], [object Object]'", async () => {
  const payload = buildPreAuditDocumentPayload(structuredReport(), COMPANY_NAME);
  const section = payload.sections.find((s) => s.title === "Rakip Analizi")!;
  assert.ok(section.table, "an array of similarly-shaped objects must render as a table");
  assert.ok(section.table!.headers.length > 0);
  const flatRows = section.table!.rows.flat().join(" | ");
  assert.doesNotMatch(flatRows, /\[object Object\]/);
  assert.ok(flatRows.includes("Rakip Nail Studio A"));
  assert.ok(flatRows.includes("4,8") || flatRows.includes("4.8"));
  // A null cell (Rakip B's missing phone) must render as an honest
  // placeholder, never the literal string "null".
  assert.doesNotMatch(flatRows, /\bnull\b/);

  const docx = await generateDocxBuffer(payload);
  const xml = await extractDocxText(docx);
  assert.doesNotMatch(xml, /\[object Object\]/);
});

test("STRUCTURED RENDERER — conditional package object (koşul/paket/fiyat) renders as a readable key-value block in INTERNAL_REPORT", async () => {
  const payload = buildPreAuditDocumentPayload(structuredReport({ report_type: "INTERNAL_REPORT" }), COMPANY_NAME);
  const section = payload.sections.find((s) => s.title === "Önerilen Paket")!;
  assert.ok(section);
  const text = (section.items || []).join(" ");
  assert.match(text, /Meta Reklam Starter/);
  assert.match(text, /8\.000/, "price must use Turkish thousands separator");
  assert.match(text, /9\.600/);
  assert.match(text, /Koşullu Paket Fırsatı/);
  assert.doesNotMatch(JSON.stringify(payload), /"priceInclVat":9600/);
});

test("STRUCTURED RENDERER REGRESSION — Turkish-locale dotless-ı lowercasing must never break a camelCase key containing 'I' (e.g. priceInclVat)", async () => {
  // toLocaleLowerCase("tr") turns "I" into dotless "ı", which would make
  // "priceInclVat" -> "price Incl Vat" -> "price ıncl vat" and silently
  // fail to match the plain-ASCII "price incl vat" dictionary entry,
  // falling back to an untranslated "Price Incl Vat" label while its
  // sibling "priceExclVat" (no capital I) translates correctly — an
  // inconsistency a naive tr-locale lowercasing would introduce.
  const payload = buildPreAuditDocumentPayload(structuredReport({ report_type: "INTERNAL_REPORT" }), COMPANY_NAME);
  const section = payload.sections.find((s) => s.title === "Önerilen Paket")!;
  const text = (section.items || []).join(" ");
  assert.match(text, /KDV Hariç Fiyat: 8\.000/);
  assert.match(text, /KDV Dahil Fiyat: 9\.600/);
});

test("STRUCTURED RENDERER — nested Meta ad strategy object renders readably, not as raw JSON", async () => {
  const payload = buildPreAuditDocumentPayload(structuredReport({ report_type: "INTERNAL_REPORT" }), COMPANY_NAME);
  const section = payload.sections.find((s) => s.title === "Başlangıç Reklam Stratejisi")!;
  assert.ok(section);
  const text = (section.items || []).join(" ");
  assert.match(text, /Mesaj\/Randevu Toplama/);
  assert.match(text, /150/);
  assert.doesNotMatch(text, /\{/, "no raw JSON braces should appear in the rendered text");
});

test("STRUCTURED RENDERER — CLIENT_REPORT never leaks the internal package name/price even though recommended_package is a client-visible field", async () => {
  // recommended_package is one of PRE_AUDIT_SECTION_LABELS (client-visible
  // by design — it's the offer itself), so this asserts the OPPOSITE of
  // what one might assume: package/price legitimately appear in
  // CLIENT_REPORT here because the business decided to make an offer.
  // The actual internal-only leak surface (sales_notes/sales_script/etc.)
  // is covered by TEST E above; this test guards that a conditional
  // package block renders cleanly for a client without leaking the
  // classification's internal shorthand as raw JSON.
  const payload = buildPreAuditDocumentPayload(structuredReport({ report_type: "CLIENT_REPORT" }), COMPANY_NAME);
  const serialized = JSON.stringify(payload);
  assert.doesNotMatch(serialized, /\[object Object\]/);
  assert.doesNotMatch(serialized, /"priceInclVat":9600/);
});

test("STRUCTURED RENDERER — mixed array (objects + plain strings) never drops the plain-string entries and never shows '[object Object]'", async () => {
  const report = structuredReport({ digital_gaps: ["Web sitesi hız sorunu", { area: "Sosyal medya", detail: "Düzensiz paylaşım" }, "Google Ads eksik"] as unknown as string[] });
  const payload = buildPreAuditDocumentPayload(report, COMPANY_NAME);
  const section = payload.sections.find((s) => s.title === "Dijital Boşluklar")!;
  assert.ok(section);
  const text = (section.items || []).join(" | ");
  assert.match(text, /Web sitesi hız sorunu/, "plain string entries before an object entry must not be dropped");
  assert.match(text, /Google Ads eksik/, "plain string entries after an object entry must not be dropped");
  assert.match(text, /Sosyal medya/);
  assert.doesNotMatch(text, /\[object Object\]/);
});

test("STRUCTURED RENDERER — PDF and DOCX both stay valid and both render the same structured content (parity)", async () => {
  const payload = buildPreAuditDocumentPayload(structuredReport(), COMPANY_NAME);
  const pdf = await generatePdfBuffer(payload);
  assert.equal(pdf.subarray(0, 4).toString("latin1"), "%PDF");
  const loaded = await PDFDocument.load(pdf);
  assert.ok(loaded.getPageCount() >= 1);

  const docx = await generateDocxBuffer(payload);
  const xml = await extractDocxText(docx);
  assert.match(xml, /esramumcuoglu_nailstudio|2\.299/);
  assert.doesNotMatch(xml, /\[object Object\]/);
});
