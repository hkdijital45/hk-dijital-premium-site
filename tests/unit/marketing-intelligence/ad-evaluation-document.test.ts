// Reklam Değerlendirme report rendering — markdown-table-to-real-table
// parsing, single report-generation timestamp (date+time, never just
// date), separate "Son Veri Senkronizasyonu", no duplicated "Nihai
// Karar", and the status-color visual system. Run via
// --conditions=react-server --import tsx (document-generator.ts is
// "server-only").
import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { buildAdEvaluationDocumentPayload } from "../../../src/lib/marketing-intelligence/ad-evaluation-document.ts";
import { generatePdfBuffer, generateDocxBuffer } from "../../../src/lib/server/document-generator.ts";
import type { AdEvaluationRecord } from "../../../src/lib/marketing-intelligence/ad-evaluations.ts";

async function extractDocxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = zip.file("word/document.xml");
  assert.ok(documentXml, "word/document.xml must exist inside a real DOCX");
  return documentXml!.async("string");
}

// Synthetic fixture only — never real customer data. Exercises exactly
// the live-proven failure shapes: a Markdown pipe-table in a section's
// content, a ⚪ Referans Yok status cell, and a Claude-authored "Nihai
// Karar" heading alongside the record's own structured decision fields.
function fakeEvaluation(overrides: Partial<AdEvaluationRecord> = {}): AdEvaluationRecord {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    company_id: "22222222-2222-4222-8222-222222222222",
    campaign_id: null, meta_campaign_id: "m1", ad_account_id: null,
    strategy_id: null, creative_strategy_id: null, previous_evaluation_id: null,
    evaluation_period_start: "2026-10-01", evaluation_period_end: "2026-10-02", campaign_age_hours: 30,
    metrics_snapshot: { syncedAt: "2026-10-02T11:44:00.000Z" },
    prompt_text: "x", claude_raw_response: "raw",
    internal_report: {
      executiveSummary: "✓ 10 mesaj sonucu kaydedildi.",
      sections: [
        {
          title: "Ana Metrikler",
          content: "| Metrik | Mevcut Değer | Ne Anlama Gelir? | Referans / Hedef Aralık | Durum | Değerlendirme |\n|---|---|---|---|---|---|\n| Frekans | 1,65 | Bir kişinin reklamı ortalama kaç kez gördüğü. | Güvenilir referans yok | ⚪ Referans Yok | Bu metrik takip ediliyor. |\n| Bağlantı CTR | %0,71 | Gösterimlerin bağlantı tıklamasına dönüşme oranı. | Güvenilir referans yok | ⚪ Referans Yok | Veri toplanmaya devam ediyor. |"
        },
        { title: "Nihai Karar", content: "Claude'un kendi yazdığı serbest metin — bu satır render'a ASLA girmemeli." }
      ]
    },
    client_report: {
      executiveSummary: "",
      sections: [
        {
          title: "Performans Özeti",
          content: "| Metrik | Değer | Durum | Kısa Açıklama |\n|---|---|---|---|\n| Bağlantı CTR | %0,71 | ⚪ Referans Yok | Güvenilir karşılaştırma bulunmuyor. |"
        }
      ]
    },
    decision: "OBSERVE", next_review_at: "2026-10-05", next_review_note: "72. saat kontrolü",
    status: "evaluated",
    internal_pdf_path: null, internal_docx_path: null, client_pdf_path: null, client_docx_path: null,
    source: "test", created_at: "2026-10-02T13:27:00.000Z", updated_at: "2026-10-02T13:27:00.000Z",
    ...overrides
  } as AdEvaluationRecord;
}

const TIMESTAMP_FORMAT = /\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}/;

test("buildAdEvaluationDocumentPayload: report timestamp includes date AND time (never date-only), uses evaluation.created_at as the single source, and is identical between internal and client payloads (section 9/26)", () => {
  const evaluation = fakeEvaluation();
  const internal = buildAdEvaluationDocumentPayload("MY CAKE 45", "MYCAKE-IG-DM-01", evaluation, "internal");
  const client = buildAdEvaluationDocumentPayload("MY CAKE 45", "MYCAKE-IG-DM-01", evaluation, "client");
  const internalLine = internal.metaLines!.find((l) => l.startsWith("Rapor Tarihi ve Saati"));
  const clientLine = client.metaLines!.find((l) => l.startsWith("Rapor Tarihi ve Saati"));
  assert.ok(internalLine && TIMESTAMP_FORMAT.test(internalLine), `expected DD.MM.YYYY HH:mm, got: ${internalLine}`);
  assert.equal(internalLine, clientLine, "internal and client must show the exact same report generation timestamp");
  assert.doesNotMatch(internalLine!, /\d{2}:\d{2}:\d{2}/, "must never include seconds");
  assert.doesNotMatch(internalLine!, /\dT\d{2}:\d{2}:\d{2}/, "must never expose a raw ISO/UTC string to the reader");
});

test("buildAdEvaluationDocumentPayload: 'Son Veri Senkronizasyonu' is a SEPARATE line from the report timestamp, sourced from metrics_snapshot.syncedAt (no new DB field), and is omitted (not guessed) when genuinely absent (section 10)", () => {
  const withSync = buildAdEvaluationDocumentPayload("MY CAKE 45", "Kampanya", fakeEvaluation(), "internal");
  const syncLine = withSync.metaLines!.find((l) => l.startsWith("Son Veri Senkronizasyonu"));
  assert.ok(syncLine && TIMESTAMP_FORMAT.test(syncLine));
  const reportLine = withSync.metaLines!.find((l) => l.startsWith("Rapor Tarihi ve Saati"));
  assert.notEqual(syncLine, reportLine);

  const withoutSync = buildAdEvaluationDocumentPayload("MY CAKE 45", "Kampanya", fakeEvaluation({ metrics_snapshot: {} }), "internal");
  assert.equal(withoutSync.metaLines!.some((l) => l.startsWith("Son Veri Senkronizasyonu")), false, "must never invent a sync timestamp when none is recorded");
});

test("buildAdEvaluationDocumentPayload: a Markdown pipe-table in Claude's section content becomes a real DocumentSection.table (headers+rows), never literal '|'/'---' text in items (section 14/15)", () => {
  const payload = buildAdEvaluationDocumentPayload("MY CAKE 45", "Kampanya", fakeEvaluation(), "internal");
  const metricsSection = payload.sections.find((s) => s.title === "Ana Metrikler");
  assert.ok(metricsSection?.table, "Ana Metrikler must produce a real table, not prose items");
  assert.deepEqual(metricsSection!.table!.headers, ["Metrik", "Mevcut Değer", "Ne Anlama Gelir?", "Referans / Hedef Aralık", "Durum", "Değerlendirme"]);
  assert.equal(metricsSection!.table!.rows.length, 2);
  assert.equal(metricsSection!.table!.rows[0][0], "Frekans");
  assert.equal(metricsSection!.table!.rows[0][4], "⚪ Referans Yok");
  // No raw markdown artifacts anywhere in the final payload.
  const serialized = JSON.stringify(payload);
  assert.doesNotMatch(serialized, /\|---+\|/, "a literal Markdown separator row must never survive into the rendered payload");
  assert.doesNotMatch(serialized, /^\s*\|.*\|\s*$/m, "a literal pipe-table row must never survive as plain text");
});

test("buildAdEvaluationDocumentPayload: CLIENT_REPORT's own Markdown table (Performans Özeti) is also parsed into a real table", () => {
  const payload = buildAdEvaluationDocumentPayload("MY CAKE 45", "Kampanya", fakeEvaluation(), "client");
  const section = payload.sections.find((s) => s.title === "Performans Özeti");
  assert.ok(section?.table);
  assert.deepEqual(section!.table!.headers, ["Metrik", "Değer", "Durum", "Kısa Açıklama"]);
  assert.equal(section!.table!.rows[0][2], "⚪ Referans Yok");
});

test("buildAdEvaluationDocumentPayload: 'Nihai Karar' is never duplicated — Claude's own freeform 'Nihai Karar' heading is excluded from internal sections, leaving exactly the one structured decision section this module appends", () => {
  const payload = buildAdEvaluationDocumentPayload("MY CAKE 45", "Kampanya", fakeEvaluation(), "internal");
  const nihaiKararSections = payload.sections.filter((s) => s.title === "Nihai Karar");
  assert.equal(nihaiKararSections.length, 1, "exactly one Nihai Karar section must exist, never two");
  assert.ok(nihaiKararSections[0].items?.some((i) => i.startsWith("Karar:")), "the one remaining Nihai Karar section must be the structured one derived from evaluation.decision");
  assert.equal(JSON.stringify(payload).includes("Claude'un kendi yazdığı serbest metin"), false, "Claude's own freeform Nihai Karar prose must never reach the rendered document");
});

test("buildAdEvaluationDocumentPayload: HK Dijital letterhead/antet fields are always present — confidentialLabel for internal, logo, footer referencing hkdijital.com.tr", () => {
  const internal = buildAdEvaluationDocumentPayload("MY CAKE 45", "Kampanya", fakeEvaluation(), "internal");
  const client = buildAdEvaluationDocumentPayload("MY CAKE 45", "Kampanya", fakeEvaluation(), "client");
  assert.equal(internal.confidentialLabel, "Dahili Kullanım");
  assert.equal(internal.logo, true);
  assert.match(internal.footerNote!, /hkdijital\.com\.tr/);
  assert.equal(client.confidentialLabel, undefined, "client report must never be marked DAHİLİ");
  assert.equal(client.logo, true);
  assert.match(client.footerNote!, /hkdijital\.com\.tr/);
});

// --- End-to-end smoke export (section 35) — real PDF/DOCX, never saved to production ---

test("SMOKE — internal PDF/DOCX and client PDF/DOCX all generate as real, valid binaries with no literal Markdown table syntax anywhere in the DOCX text", async () => {
  const evaluation = fakeEvaluation();
  const internalPayload = buildAdEvaluationDocumentPayload("MY CAKE 45", "MYCAKE-IG-DM-01", evaluation, "internal");
  const clientPayload = buildAdEvaluationDocumentPayload("MY CAKE 45", "MYCAKE-IG-DM-01", evaluation, "client");

  const internalPdf = await generatePdfBuffer(internalPayload);
  const clientPdf = await generatePdfBuffer(clientPayload);
  assert.equal(internalPdf.subarray(0, 4).toString("latin1"), "%PDF");
  assert.equal(clientPdf.subarray(0, 4).toString("latin1"), "%PDF");
  assert.ok((await PDFDocument.load(internalPdf)).getPageCount() >= 1);
  assert.ok((await PDFDocument.load(clientPdf)).getPageCount() >= 1);

  const internalDocx = await generateDocxBuffer(internalPayload);
  const clientDocx = await generateDocxBuffer(clientPayload);
  assert.equal(internalDocx.subarray(0, 2).toString("latin1"), "PK", "must be a real DOCX, not an HTML file renamed .docx");

  const internalXml = await extractDocxText(internalDocx);
  const clientXml = await extractDocxText(clientDocx);
  for (const xml of [internalXml, clientXml]) {
    assert.ok(xml.includes("<w:tbl>"), "a real Word table element must exist, not a text paragraph");
    assert.doesNotMatch(xml, /\|---+\|/, "no literal Markdown separator row in the exported DOCX text");
    assert.ok(xml.includes("HK D") , "HK Dijital letterhead text must be present"); // "HK DİJİTAL" — Turkish İ may be XML-entity-escaped, match the stable ASCII prefix
  }
  assert.ok(internalXml.includes("DAHİLİ") || internalXml.toLocaleUpperCase("tr").includes("DAHILI"), "internal DOCX must visibly mark DAHİLİ KULLANIM");
  assert.equal((clientXml.match(/<w:tbl>/g) || []).length >= 1, true);
});

// --- Status color visual system (section 17/33) ---

test("SMOKE — all 5 controlled statuses in a 'Durum' column render with a distinct visible color in the DOCX (text + color together, never color alone — the status text itself always survives verbatim)", async () => {
  const evaluation = fakeEvaluation({
    internal_report: {
      sections: [{
        title: "Ana Metrikler",
        content: [
          "| Metrik | Durum | Not |",
          "|---|---|---|",
          "| A | 🟢 İyi | x |",
          "| B | 🟡 İzle | x |",
          "| C | 🔴 Aksiyon Gerekebilir | x |",
          "| D | ⚪ Referans Yok | x |",
          "| E | 🔵 Veri Yetersiz | x |"
        ].join("\n")
      }]
    }
  } as any);
  const payload = buildAdEvaluationDocumentPayload("MY CAKE 45", "Kampanya", evaluation, "internal");
  const docx = await generateDocxBuffer(payload);
  const xml = await extractDocxText(docx);
  const colorHexes = ["168A48", "B47A0C", "B43434", "74778A", "1A69B4"];
  for (const hex of colorHexes) {
    assert.ok(xml.includes(hex), `expected the DOCX to contain the status color ${hex}`);
  }
  for (const statusText of ["İyi", "İzle", "Aksiyon Gerekebilir", "Referans Yok", "Veri Yetersiz"]) {
    assert.ok(xml.includes(statusText), `status text "${statusText}" must survive verbatim — color is never the only signal`);
  }

  const pdf = await generatePdfBuffer(payload);
  assert.equal(pdf.subarray(0, 4).toString("latin1"), "%PDF", "PDF with all 5 statuses in a Durum column must still generate as a valid PDF (colored status dots drawn without error)");
});

test("statusColorHexFor / statusColorFor matching order: 'Aksiyon Gerekebilir' never falls through to matching bare 'İyi'/'İzle' inside it, and a non-status cell (wrong column) never gets colored", async () => {
  const evaluation = fakeEvaluation({
    internal_report: {
      sections: [{
        title: "Ana Metrikler",
        // "Değerlendirme" column deliberately contains the word "iyi"
        // in ordinary prose — this must NEVER be colored, since only
        // the "Durum" column is the controlled-vocabulary column.
        content: [
          "| Metrik | Durum | Değerlendirme |",
          "|---|---|---|",
          "| A | 🔴 Aksiyon Gerekebilir | Henüz iyi bir sinyal yok, izlemeye devam. |"
        ].join("\n")
      }]
    }
  } as any);
  const payload = buildAdEvaluationDocumentPayload("MY CAKE 45", "Kampanya", evaluation, "internal");
  const docx = await generateDocxBuffer(payload);
  const xml = await extractDocxText(docx);
  assert.ok(xml.includes("B43434"), "Aksiyon Gerekebilir must be colored red");
  assert.equal(xml.includes("168A48"), false, "the prose 'Değerlendirme' cell containing the word 'iyi' must never be colored green");
});
