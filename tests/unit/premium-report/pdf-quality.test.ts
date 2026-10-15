// Premium PDF V3.1 quality regressions — run via `npm run test:premium-report`.
// Real PDFs are generated and their extracted text (pdftotext) is checked;
// fictional fixtures only. Covers: complete table of contents with correct
// page numbers (5/10/20/40 sections, very long titles), no truncation
// summary ("… ve N bölüm daha"), no empty/branding-only pages, Turkish
// capitalization of generated labels, brand-name preservation, glossary
// instead of in-sentence term expansion, long/wide table handling.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
import { generatePdfBuffer, type DocumentPayload, type DocumentSection } from "../../../src/lib/server/document-generator.ts";
import { isBrandingOnlyNote } from "../../../src/lib/server/premium-pdf.ts";
import { buildAdEvaluationDocumentPayload } from "../../../src/lib/marketing-intelligence/ad-evaluation-document.ts";
import { buildPreAuditDocumentPayload } from "../../../src/lib/pre-audit/document.ts";
import { capitalizeWordsTr, humanizeKeyTr, cleanTurkishTypography, findUsedGlossaryTerms } from "../../../src/lib/turkish-text.ts";
import { AD_METRIC_GLOSSARY } from "../../../src/lib/report-glossary.ts";

function hasPdftotext() {
  try { execFileSync("pdftotext", ["-v"], { stdio: "ignore" }); return true; } catch { return false; }
}

function pagesText(buffer: Buffer, count: number): string[] {
  const dir = mkdtempSync(join(tmpdir(), "hkq-"));
  const file = join(dir, "r.pdf");
  writeFileSync(file, buffer);
  const out: string[] = [];
  for (let p = 1; p <= count; p += 1) out.push(execFileSync("pdftotext", ["-layout", "-f", String(p), "-l", String(p), file, "-"]).toString("utf8"));
  return out;
}

async function pageCount(buffer: Buffer) {
  return (await PDFDocument.load(buffer)).getPageCount();
}

const LONG = "ve dijital pazarlama performansının Instagram, Google Ads ve WhatsApp kanallarında ayrıntılı olarak değerlendirilmesi ile önceliklendirilmiş eylem planı";

function manySections(n: number, longTitles = false): DocumentSection[] {
  return Array.from({ length: n }, (_, i) => {
    const code = `S${String(i + 1).padStart(2, "0")}Q`;
    const body = Array.from({ length: 4 + (i % 6) * 3 }, (_, j) => `${code} madde ${j + 1}: Örnek açıklama metni çğıöşü ÇĞİÖŞÜ.`);
    return { title: `${code} Bölüm ${i + 1}${longTitles && i % 3 === 0 ? ` ${LONG}` : ""}`, items: body };
  });
}

function basePayload(sections: DocumentSection[], overrides: Partial<DocumentPayload> = {}): DocumentPayload {
  return {
    title: "HK Dijital — Ön İnceleme Raporu",
    customerName: "Zirve AKADEMİ",
    period: "15 Ekim 2026",
    executiveSummary: "Kısa yönetici özeti.",
    metaLines: ["Firma: Zirve AKADEMİ", "Rapor Tarihi: 15 Ekim 2026"],
    sections,
    ...overrides
  };
}

/** The page (1-based) where each section heading is printed — the first
 * page AFTER the contents pages whose text starts a line with the code. */
function headingPages(pages: string[], codes: string[], firstContentPage: number): Map<string, number> {
  const map = new Map<string, number>();
  for (const code of codes) {
    for (let p = firstContentPage; p <= pages.length; p += 1) {
      if (new RegExp(`(^|\\n)\\s*${code} Bölüm`).test(pages[p - 1])) { map.set(code, p); break; }
    }
  }
  return map;
}

/** Page label printed for each code in the contents: the first line at or
 * after the code's line that ends with a number (wrapped titles carry the
 * number on their last line). */
function tocPageLabels(tocText: string, codes: string[]): Map<string, number> {
  const lines = tocText.split("\n");
  const map = new Map<string, number>();
  for (const code of codes) {
    const start = lines.findIndex((l) => l.includes(code));
    if (start < 0) continue;
    for (let i = start; i < Math.min(lines.length, start + 6); i += 1) {
      const m = lines[i].match(/\s(\d+)\s*$/);
      if (m) { map.set(code, Number(m[1])); break; }
    }
  }
  return map;
}

for (const n of [5, 10, 20, 40]) {
  for (const longTitles of [false, true]) {
    test(`TOC lists all ${n} sections${longTitles ? " (long titles)" : ""} with page numbers matching the PDF`, { skip: !hasPdftotext() && "pdftotext missing" }, async () => {
      const sections = manySections(n, longTitles);
      const buffer = await generatePdfBuffer(basePayload(sections));
      const count = await pageCount(buffer);
      const pages = pagesText(buffer, count);
      const all = pages.join("\n");
      assert.doesNotMatch(all, /bölüm daha/i, "the contents must never be summarized as '… ve N bölüm daha'");
      // V3.2 cover-first: page 1 is the cover only, contents start on page 2.
      assert.doesNotMatch(pages[0], /İçindekiler|RAPOR İÇERİĞİ|RAPOR BİLGİLERİ|YÖNETİCİ ÖZETİ|S01Q/, "the cover carries no contents, info card or report text");
      assert.match(pages[1], /İçindekiler/, "the table of contents starts on page 2");
      const tocPageNumbers = pages.map((t, i) => (/İçindekiler|İÇİNDEKİLER \(DEVAM\)/.test(t) ? i + 1 : 0)).filter(Boolean);
      assert.deepEqual(tocPageNumbers, tocPageNumbers.map((_, i) => i + 2), "contents pages are consecutive from page 2");
      const tocText = tocPageNumbers.map((p) => pages[p - 1]).join("\n");
      const codes = sections.map((s) => s.title.slice(0, 4));
      for (const code of codes) assert.ok(tocText.includes(code), `${code} must appear in the table of contents`);
      const firstContentPage = Math.max(...tocPageNumbers) + 1;
      const actual = headingPages(pages, codes, firstContentPage);
      const printed = tocPageLabels(tocText, codes);
      for (const code of codes) {
        assert.ok(actual.has(code), `${code} heading must be printed in the body`);
        assert.equal(printed.get(code), actual.get(code), `${code}: contents says page ${printed.get(code)}, heading is on page ${actual.get(code)}`);
      }
      // Footer numbering matches the real page count on every page.
      for (let p = 2; p <= count; p += 1) assert.match(pages[p - 1], new RegExp(`Sayfa ${p} / ${count}`));
    });
  }
}

const FOOTER_NOISE = [/Sayfa \d+ \/ \d+/g, /HK Dijital · hkdijital\.com\.tr/g, /Zirve AKADEMİ/g, /ÖN İNCELEME RAPORU/g, /DAHİLİ KULLANIM · MÜŞTERİYLE PAYLAŞILMAZ/g];

test("no page is left with only header/footer branding — across many layouts with a branding-only closing note", { skip: !hasPdftotext() && "pdftotext missing" }, async () => {
  for (let bullets = 1; bullets <= 70; bullets += 3) {
    const sections: DocumentSection[] = [
      { title: "Performans", items: Array.from({ length: bullets }, (_, i) => `Madde ${i + 1}: harcama ve sonuç değerlendirmesi.`) }
    ];
    const buffer = await generatePdfBuffer(basePayload(sections, { footerNote: "HK Dijital · hkdijital.com.tr" }));
    const count = await pageCount(buffer);
    const pages = pagesText(buffer, count);
    pages.slice(1).forEach((text, i) => {
      let rest = text;
      for (const re of FOOTER_NOISE) rest = rest.replace(re, "");
      assert.ok(rest.trim().length > 0, `${bullets} bullets: page ${i + 2} carries no content (only header/footer)`);
    });
  }
});

test("isBrandingOnlyNote: branding notes vs real notes", () => {
  assert.equal(isBrandingOnlyNote("HK Dijital · hkdijital.com.tr"), true);
  assert.equal(isBrandingOnlyNote("HK Dijital · Dahili Operasyon Belgesi · hkdijital.com.tr"), true);
  assert.equal(isBrandingOnlyNote("Bu teklif 30 Ekim 2026 tarihine kadar geçerlidir."), false);
  assert.equal(isBrandingOnlyNote("Sonuçlar sektör ve bütçeye göre değişebilir."), false);
});

test("long table: no cell text is truncated, header repeats, very tall rows continue on the next page", { skip: !hasPdftotext() && "pdftotext missing" }, async () => {
  const tall = Array.from({ length: 90 }, (_, i) => `satır ${i + 1} uzun hücre içeriği`).join(" ") + " SONKELIME";
  const rows = Array.from({ length: 60 }, (_, i) => [`Kalem ${i + 1}`, i === 30 ? tall : `Açıklama ${i + 1}`, "Doğrulandı"]);
  const buffer = await generatePdfBuffer(basePayload([{ title: "Büyük Tablo", table: { headers: ["Kalem", "Açıklama", "Durum"], rows } }]));
  const count = await pageCount(buffer);
  const all = pagesText(buffer, count).join("\n");
  assert.match(all, /SONKELIME/, "the end of a very tall cell must be printed, not cut with …");
  assert.match(all, /Kalem 60/);
  const headerRepeats = (all.match(/KALEM\s+AÇIKLAMA\s+DURUM/g) || []).length;
  assert.ok(headerRepeats >= 2, "the table header must repeat on continuation pages");
});

test("wide table (8 columns) is set as readable record cards with every value present", { skip: !hasPdftotext() && "pdftotext missing" }, async () => {
  const headers = ["Kampanya", "Harcama", "Erişim", "Gösterim", "Tıklama", "CTR", "CPC", "Sonuç"];
  const rows = Array.from({ length: 6 }, (_, i) => [`Kampanya ${i + 1}`, "1.250,50 TL", "12.400", "40.120", "512", "%1,28", "2,44 TL", `${30 + i}`]);
  const buffer = await generatePdfBuffer(basePayload([{ title: "Kampanya Tablosu", table: { headers, rows } }]));
  const all = pagesText(buffer, await pageCount(buffer)).join("\n");
  for (let i = 1; i <= 6; i += 1) assert.match(all, new RegExp(`Kampanya ${i}`));
  assert.match(all, /1\.250,50 TL/);
  assert.match(all, /GÖSTERİM/);
});

test("Turkish capitalization: generated labels are Unicode-aware (no 'işLetme' / 'GüçLü YöNler')", () => {
  assert.equal(capitalizeWordsTr("güçlü yönler"), "Güçlü Yönler");
  assert.equal(capitalizeWordsTr("işletme özeti"), "İşletme Özeti");
  assert.equal(capitalizeWordsTr("çağrı merkezi"), "Çağrı Merkezi");
  assert.equal(capitalizeWordsTr("instagram hesabı"), "Instagram Hesabı");
  assert.equal(capitalizeWordsTr("whatsapp iletişim"), "WhatsApp İletişim");
  assert.equal(capitalizeWordsTr("zirve AKADEMİ şube"), "Zirve AKADEMİ Şube");
  assert.equal(capitalizeWordsTr("robotik45 öğrenci"), "Robotik45 Öğrenci");
  assert.equal(capitalizeWordsTr("my cake 45 satış"), "MY CAKE 45 Satış");
  assert.equal(humanizeKeyTr("güçlüYönler"), "Güçlü Yönler");
  assert.equal(humanizeKeyTr("instagram_takipçi_sayısı"), "Instagram Takipçi Sayısı");
  assert.equal(cleanTurkishTypography("Bütçe , 1.250,50 TL ( KDV hariç ) ;sonra"), "Bütçe, 1.250,50 TL (KDV hariç); sonra");
  assert.equal(cleanTurkishTypography("Saat 12:30, oran %12,5 ve site hkdijital.com.tr"), "Saat 12:30, oran %12,5 ve site hkdijital.com.tr");
});

test("pre-audit export: Turkish object keys become correctly capitalized labels and brand names survive", async () => {
  const report = {
    id: "00000000-0000-4000-8000-000000000001", company_id: null, lead_id: "00000000-0000-4000-8000-000000000002", business_unit_id: null,
    analysis_group_id: "g", report_type: "CLIENT_REPORT", title: "Zirve AKADEMİ — Ön İnceleme", status: "draft", report_date: "2026-10-15",
    created_at: "2026-10-15T09:00:00Z", updated_at: "2026-10-15T09:00:00Z",
    executive_summary: "Zirve AKADEMİ ve Robotik45 için Instagram ile WhatsApp kanalları incelendi.",
    swot: { güçlüYönler: ["Robotik45 markası güçlü"], zayıfYönler: ["Instagram paylaşım sıklığı düşük"] }
  } as unknown as Parameters<typeof buildPreAuditDocumentPayload>[0];
  const payload = buildPreAuditDocumentPayload(report, "Zirve AKADEMİ");
  const json = JSON.stringify(payload);
  assert.doesNotMatch(json, /GüçLü|YöNler|ZayıF|işLetme/, "no ASCII-boundary mixed-case labels");
  if (hasPdftotext()) {
    const buffer = await generatePdfBuffer(payload);
    const all = pagesText(buffer, await pageCount(buffer)).join("\n");
    for (const brand of ["Zirve AKADEMİ", "Robotik45", "Instagram", "WhatsApp"]) assert.ok(all.includes(brand), `${brand} must be printed exactly`);
    assert.doesNotMatch(all, /ınstagram|İnstagram|Whatsapp/);
  }
});

test("ad evaluation (client): metric terms are explained in a glossary, never spliced into sentences", () => {
  const evaluation = {
    id: "e1", company_id: "c1", status: "evaluated", decision: null, next_review_at: null, next_review_note: null,
    evaluation_period_start: "2026-10-01", evaluation_period_end: "2026-10-14", created_at: "2026-10-15T09:00:00Z",
    metrics_snapshot: { campaign: { spend: 4820.5, reach: 12000, impressions: 40000, results: 81, costPerResult: 59.5 } },
    internal_report: { executiveSummary: "", sections: [] },
    client_report: { executiveSummary: "", sections: [{ title: "Kısa Özet", content: "Harcanan Tutarın zaman içindeki seyri dengeli. CTR'si yükseldi ve Sonuç başı maliyet düştü." }] }
  } as unknown as Parameters<typeof buildAdEvaluationDocumentPayload>[2];
  const payload = buildAdEvaluationDocumentPayload("MY CAKE 45", "Mesaj Kampanyası", evaluation, "client");
  const summary = payload.sections.find((s) => s.title === "Kısa Özet");
  assert.ok(summary?.items?.length);
  for (const item of summary!.items!) assert.doesNotMatch(item, /\(/, `no explanation injected into: ${item}`);
  assert.ok(summary!.items!.some((i) => i.includes("Harcanan Tutarın zaman içindeki seyri")), "the sentence keeps its Turkish suffix intact");
  const glossary = payload.sections.find((s) => s.title === "Terimler Sözlüğü");
  assert.ok(glossary?.table, "a separate glossary section lists the terms used");
  const terms = glossary!.table!.rows.map((r) => r[0]);
  for (const t of ["Harcanan Tutar", "CTR", "Sonuç Başına Maliyet", "Erişim"]) assert.ok(terms.includes(t), `${t} explained in the glossary`);
  // No revenue/sales figures are ever introduced by the builder.
  assert.doesNotMatch(JSON.stringify(payload), /50\.000|ciro|sipariş/i);
});

test("glossary detection is suffix-tolerant and Unicode-aware", () => {
  const used = findUsedGlossaryTerms(["Harcanan Tutarın seyri, CTR'si, erişimi ve gösterimden sonra."], AD_METRIC_GLOSSARY).map((t) => t.term);
  for (const t of ["Harcanan Tutar", "CTR", "Erişim", "Gösterim"]) assert.ok(used.includes(t), `${t} detected`);
  assert.ok(!used.includes("CPM"));
});
