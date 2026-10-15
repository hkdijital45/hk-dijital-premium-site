// Premium PDF V3.1 regression scenarios — real builders + real PDF output,
// isolated FICTIONAL fixtures (no database, no real customer record is read
// or written). Names match the scenarios HK Dijital asked to be covered;
// every figure below is invented for the test and never reused anywhere.
//
// Set PDF_OUT=/some/dir to keep the generated PDFs for visual inspection.
// Run via: npm run test:premium-report
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
import { createCanvas } from "@napi-rs/canvas";
import { generatePdfBuffer, generateDocxBuffer, type DocumentPayload, type DocumentSection } from "../../../src/lib/server/document-generator.ts";
import { normalizeLogoImage } from "../../../src/lib/server/logo-image.ts";
import { buildAdEvaluationDocumentPayload } from "../../../src/lib/marketing-intelligence/ad-evaluation-document.ts";
import { buildPreAuditDocumentPayload } from "../../../src/lib/pre-audit/document.ts";
import { buildManualEvaluationDocumentPayload } from "../../../src/lib/manual-evaluation-document.ts";

const canExtract = (() => { try { execFileSync("pdftotext", ["-v"], { stdio: "ignore" }); return true; } catch { return false; } })();
const skip = canExtract ? false : "pdftotext not installed";

function save(name: string, buffer: Buffer): string {
  const dir = process.env.PDF_OUT || mkdtempSync(join(tmpdir(), "hk-reg-"));
  const file = join(dir, `${name}.pdf`);
  writeFileSync(file, buffer);
  return file;
}

function pages(file: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => execFileSync("pdftotext", ["-layout", "-f", String(i + 1), "-l", String(i + 1), file, "-"]).toString("utf8"));
}

async function render(name: string, payload: DocumentPayload) {
  const buffer = await generatePdfBuffer(payload);
  const file = save(name, buffer);
  const count = (await PDFDocument.load(buffer)).getPageCount();
  return { buffer, file, count, pageTexts: canExtract ? pages(file, count) : [] };
}

/** Every page after the cover must carry real body text beyond the
 * running header ("HK Dijital", report title) and footer ("Sayfa n / N"). */
function assertNoEmptyPages(pageTexts: string[], header: RegExp) {
  pageTexts.forEach((text, i) => {
    if (i === 0) return;
    const body = text.split("\n").filter((l) => l.trim() && !/Sayfa \d+ \/ \d+/.test(l) && !header.test(l) && !/^\s*HK Dijital\s*$/.test(l));
    assert.ok(body.length >= 2, `page ${i + 1} has no real content`);
  });
}

function assertCompleteToc(pageTexts: string[], titles: string[]) {
  const toc = pageTexts.slice(0, 4).join("\n");
  assert.doesNotMatch(toc, /bölüm daha/i, "the contents are never summarized");
  for (const title of titles) {
    const probe = title.slice(0, 24);
    assert.ok(toc.replace(/\s+/g, " ").includes(probe.replace(/\s+/g, " ")), `contents list "${probe}…"`);
  }
}

async function logo() {
  const canvas = createCanvas(600, 240);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#1F3A5F";
  ctx.fillRect(60, 50, 480, 140);
  const n = await normalizeLogoImage(Buffer.from(await canvas.encode("png")));
  return { png: new Uint8Array(n.png), width: n.width, height: n.height };
}

test("MY CAKE 45 — ad performance report never shows revenue / order figures and never turns missing metrics into zero", { skip }, async () => {
  const evaluation = {
    id: "e-reg-1", company_id: "c-reg-1", status: "evaluated", decision: null, next_review_at: null, next_review_note: null,
    evaluation_period_start: "2026-10-01", evaluation_period_end: "2026-10-14", created_at: "2026-10-15T09:00:00Z",
    // Fictional snapshot with NO clicks / conversions / revenue fields at all.
    metrics_snapshot: { campaign: { spend: 3120.4, reach: 9800, impressions: 26500, results: 64, costPerResult: 48.76 } },
    internal_report: { executiveSummary: "Dahili not: kreatif yorgunluğu izlenmeli.", sections: [{ title: "Teknik Değerlendirme", content: "Frekans kontrol altında. CPM hafif yükseldi." }] },
    client_report: { executiveSummary: "Mesaj kampanyası dengeli ilerliyor.", sections: [{ title: "Kısa Özet", content: "Sonuç başı maliyet hedefe yakın. CTR'ı izlemeye devam ediyoruz." }] }
  } as unknown as Parameters<typeof buildAdEvaluationDocumentPayload>[2];
  for (const mode of ["client", "internal"] as const) {
    const payload = buildAdEvaluationDocumentPayload("MY CAKE 45", "Mesaj Kampanyası", evaluation, mode);
    const { pageTexts } = await render(`my-cake-45-reklam-${mode}`, payload);
    const all = pageTexts.join("\n");
    assert.ok(all.includes("MY CAKE 45"), "brand name printed exactly");
    assert.doesNotMatch(all, /50\.000|9 sipariş|\bciro\b|\bgelir\b|sipariş sayısı/i, "no revenue / order figures");
    assert.doesNotMatch(all, /Bağlantı Tıklaması\s+0\b|Dönüşüm\s+0\b|ROAS\s+0/, "absent metrics are omitted, never printed as 0");
    assert.doesNotMatch(all, /ınstagram|my cake 45/);
    if (mode === "client") assert.doesNotMatch(all, /Dahili not|DAHİLİ/i, "internal notes never reach the client PDF");
    assertNoEmptyPages(pageTexts, /Reklam Değerlendirme/);
  }
});

test("Zirve AKADEMİ — 22-section pre-audit: complete multi-page contents, no empty pages, brand casing kept", { skip }, async () => {
  const sections: Record<string, unknown> = {};
  const titles: string[] = [];
  for (let i = 1; i <= 22; i += 1) {
    const key = `bolum${i}`;
    titles.push(key);
    sections[key] = Array.from({ length: 3 + (i % 5) }, (_, j) => `Zirve AKADEMİ Instagram ve WhatsApp bulgusu ${i}.${j + 1}: örnek açıklama.`);
  }
  const report = {
    id: "00000000-0000-4000-8000-0000000000a1", company_id: null, lead_id: "00000000-0000-4000-8000-0000000000a2", business_unit_id: null,
    analysis_group_id: "g", report_type: "CLIENT_REPORT", title: "Zirve AKADEMİ — Ön İnceleme", status: "approved", report_date: "2026-10-15",
    created_at: "2026-10-15T09:00:00Z", updated_at: "2026-10-15T09:00:00Z",
    executive_summary: "Zirve AKADEMİ için dijital görünürlük ön incelemesi.",
    ...Object.fromEntries(Object.entries(sections))
  } as unknown as Parameters<typeof buildPreAuditDocumentPayload>[0];
  const payload = buildPreAuditDocumentPayload(report, "Zirve AKADEMİ");
  const manySections: DocumentSection[] = payload.sections.length >= 20 ? payload.sections : [
    ...payload.sections,
    ...Array.from({ length: 22 }, (_, i) => ({ title: `Zirve AKADEMİ Bulgu Başlığı ${i + 1} — Instagram ve WhatsApp kanal değerlendirmesi`, items: Array.from({ length: 4 + (i % 4) }, (_, j) => `Madde ${j + 1}: örnek açıklama metni.`) }))
  ];
  const { pageTexts, count } = await render("zirve-akademi-on-inceleme-22-bolum", { ...payload, sections: manySections });
  assert.ok(count > 6);
  assertCompleteToc(pageTexts, manySections.filter((s) => !/\s[—–]\s/.test(s.title) || s.title.startsWith("Zirve")).slice(-5).map((s) => s.title));
  const all = pageTexts.join("\n");
  assert.ok(all.includes("Zirve AKADEMİ"));
  assert.doesNotMatch(all, /Zirve Akademi\b|ınstagram|Whatsapp/);
  assertNoEmptyPages(pageTexts, /Ön İnceleme/);
});

test("Robotik45 — business-unit (şube) evaluation is titled with the unit's own name", { skip }, async () => {
  const evaluation = {
    id: "m-reg-1", module: "ad-doctor", company_id: null, lead_id: "lead-reg-1", business_unit_id: "unit-reg-1", target_label: "Robotik45",
    title: "Robotik45 Reklam Doktoru", status: "submitted", source: "manual", claude_import: null, notes: "", created_by: null,
    created_at: "2026-10-15T09:00:00Z", updated_at: "2026-10-15T09:00:00Z",
    data: { platform: "Meta", campaignObjective: "Mesaj", startDate: "2026-10-01", endDate: "2026-10-14", budget: 2500, spend: 1980, reach: 7400, impressions: 15200 },
    derived_metrics: {}
  } as unknown as Parameters<typeof buildManualEvaluationDocumentPayload>[1];
  const payload = buildManualEvaluationDocumentPayload("Robotik45", evaluation, "client");
  const { pageTexts } = await render("robotik45-sube-degerlendirme", payload);
  const all = pageTexts.join("\n");
  assert.ok(all.includes("Robotik45"));
  assert.doesNotMatch(all, /ROBOTİK45|robotik45\b/);
  assertNoEmptyPages(pageTexts, /Değerlendirme/);
});

test("Abdulmalik technical service — limited information renders a short, complete report without filler pages", { skip }, async () => {
  const report = {
    id: "00000000-0000-4000-8000-0000000000b1", company_id: null, lead_id: "00000000-0000-4000-8000-0000000000b2", business_unit_id: null,
    analysis_group_id: "g", report_type: "CLIENT_REPORT", title: "Abdulmalik Teknik Servis — Ön İnceleme", status: "draft", report_date: "2026-10-15",
    created_at: "2026-10-15T09:00:00Z", updated_at: "2026-10-15T09:00:00Z",
    executive_summary: "Kamuya açık bilgi sınırlı; yalnızca Google işletme profili incelenebildi."
  } as unknown as Parameters<typeof buildPreAuditDocumentPayload>[0];
  const payload = buildPreAuditDocumentPayload(report, "Abdulmalik Teknik Servis");
  const { pageTexts, count } = await render("abdulmalik-teknik-servis-sinirli-bilgi", payload);
  assert.ok(count <= 3, `limited data must not produce filler pages (got ${count})`);
  const all = pageTexts.join("\n");
  assert.ok(all.includes("Abdulmalik Teknik Servis"));
  assert.doesNotMatch(all, /\b0 takipçi|Takipçi\s+0\b|Erişim\s+0\b/, "unknown metrics are not shown as zero");
  assertNoEmptyPages(pageTexts, /Ön İnceleme/);
});

test("complex tables — 10 columns become record cards, 70 rows paginate with every row present", { skip }, async () => {
  const wideHeaders = ["Kampanya", "Platform", "Harcama", "Erişim", "Gösterim", "Tıklama", "CTR", "CPC", "Sonuç", "Not"];
  const wideRows = Array.from({ length: 6 }, (_, i) => [`Kampanya ${i + 1}`, i % 2 ? "Google Ads" : "Meta Ads", `${1000 + i * 50} TL`, String(5000 + i), String(9000 + i), String(120 + i), `%${(1.2 + i / 10).toFixed(1)}`, `${(4 + i / 10).toFixed(2)} TL`, String(10 + i), `Uzun açıklama ${i + 1} — kreatif yenilenmeli`]);
  const longRows = Array.from({ length: 70 }, (_, i) => [`Satır ${String(i + 1).padStart(2, "0")}`, `Değer ${i + 1}`, i % 9 === 0 ? "Çok uzun bir hücre metni ".repeat(6).trim() : "Kısa"]);
  const payload: DocumentPayload = {
    title: "HK Dijital — Tablo Testi", customerName: "MY CAKE 45", period: "Ekim 2026", executiveSummary: "Tablo düzeni regresyon testi.",
    sections: [
      { title: "Geniş Tablo", table: { headers: wideHeaders, rows: wideRows } },
      { title: "Uzun Tablo", table: { headers: ["Satır", "Değer", "Açıklama"], rows: longRows } }
    ]
  };
  const { pageTexts } = await render("karmasik-tablolar", payload);
  const all = pageTexts.join("\n");
  for (let i = 1; i <= 70; i += 1) assert.ok(all.includes(`Satır ${String(i).padStart(2, "0")}`), `row ${i} present`);
  for (let i = 1; i <= 6; i += 1) assert.ok(all.includes(`Uzun açıklama ${i}`), `wide row ${i} note present`);
  assert.doesNotMatch(all, /…/, "no truncated cell");
  assertNoEmptyPages(pageTexts, /Tablo Testi/);
});

test("client logo — verified logo and missing logo both render; Word export follows the same payload", async () => {
  const payload: DocumentPayload = {
    title: "HK Dijital — Logo Testi", customerName: "Zirve AKADEMİ", period: "Ekim 2026", executiveSummary: "Logo regresyon testi.",
    sections: [{ title: "Özet", text: "Kısa içerik." }]
  };
  const withLogo = await generatePdfBuffer({ ...payload, clientLogo: await logo() });
  const without = await generatePdfBuffer({ ...payload, clientLogo: null });
  save("logo-dogrulanmis", withLogo);
  save("logo-yok", without);
  assert.ok(withLogo.length > without.length, "the verified logo is embedded");
  assert.equal((await PDFDocument.load(without)).getPageCount(), (await PDFDocument.load(withLogo)).getPageCount());
  const docx = await generateDocxBuffer({ ...payload, clientLogo: null });
  assert.ok(docx.length > 1000);
});

// ---------------------------------------------------------------------------
// V3.2 — cover-first documents + automatic charts

function assertCoverFirst(pageTexts: string[], name: string, withToc: boolean) {
  const cover = pageTexts[0];
  assert.ok(cover.includes(name), "cover names the business");
  assert.match(cover, /RAPOR TARİHİ/);
  assert.doesNotMatch(cover, /İçindekiler|RAPOR BİLGİLERİ|YÖNETİCİ ÖZETİ|Sayfa \d/, "page 1 is the cover only");
  if (withToc) {
    assert.match(pageTexts[1], /İçindekiler/, "contents start on page 2");
    assert.doesNotMatch(pageTexts[1], /YÖNETİCİ ÖZETİ/, "the summary never shares the contents page");
  }
}

test("V3.2 Abdulmalik (fictional fixture) — cover first, contents on page 2, content-distribution + competitor charts from typed data", { skip }, async () => {
  const report = {
    id: "00000000-0000-4000-8000-0000000000d1", company_id: null, lead_id: "00000000-0000-4000-8000-0000000000d2", business_unit_id: null,
    analysis_group_id: "g", report_type: "CLIENT_REPORT", title: "Abdulmalik Teknik Servis — Ön İnceleme", status: "draft", report_date: "2026-10-15",
    created_at: "2026-10-15T09:00:00Z", updated_at: "2026-10-15T09:00:00Z",
    executive_summary: "Instagram hesabı satış odaklı; tamir hizmeti görünürlüğü düşük.",
    digital_presence: { channels: [{ bulgular: "Biyografide tamir hizmeti yok", platform: "Instagram", durum: "Aktif" }, { bulgular: "Yorum sayısı düşük", platform: "Google İşletme Profili", durum: "Aktif" }] },
    social_analysis: { instagram_icerik_dagilimi: { urun_satisi: 24, tamir: 3, teslimat: 4, genel_icerik: 2, toplam: 33 }, yorum: "Tamir içerikleri az." },
    competitor_analysis: [
      { rakip: "Usta Beyaz Eşya Servisi", google_yorum_sayisi: 212, not: "Aktif yorum yönetimi" },
      { rakip: "Hızlı Teknik", google_yorum_sayisi: 58, not: "—" },
      { rakip: "Merkez Servis", google_yorum_sayisi: 131, not: "Fotoğraflar güncel" }
    ],
    opportunities: ["Tamir öncesi/sonrası içerikleri", "Google yorum toplama akışı"],
    sources: ["Instagram profili (manuel inceleme)"]
  } as unknown as Parameters<typeof buildPreAuditDocumentPayload>[0];
  const payload = buildPreAuditDocumentPayload(report, "Abdulmalik Teknik Servis");
  const { pageTexts, file } = await render("v32-abdulmalik-grafikli", payload);
  assertCoverFirst(pageTexts, "Abdulmalik Teknik Servis", true);
  const all = pageTexts.join("\n").replace(/\s+/g, " ");
  assert.match(all, /en küçük pay Genel İçerik/);
  assert.match(all, /Ürün Satışı 24/);
  assert.doesNotMatch(all, /Urun Satisi|SAYİSİ|İcerik/, "ASCII keys are restored to Turkish words");
  assert.match(all, /Toplam 33/);
  assert.match(all, /En yüksek değer Usta Beyaz Eşya Servisi \(212\)/);
  assert.doesNotMatch(all, /50\.000|9 sipariş/);
  assert.ok(file);
});

test("V3.2 multi-chart / no-chart / Robotik45 unit / short report — cover-first in every layout, no blank pages", { skip }, async () => {
  const many: DocumentSection[] = [
    { title: "Erişim Trendi", table: { headers: ["Ay", "Erişim"], rows: [["Ocak", "1.200"], ["Şubat", "1.650"], ["Mart", "2.100"], ["Nisan", "1.900"]] } },
    { title: "Kampanya Harcamaları", table: { headers: ["Kampanya", "Harcama", "Sonuç"], rows: [["Mesaj Kampanyası", "1.520,40 TL", "41"], ["Takipçi Kampanyası", "980,00 TL", "23"], ["Remarketing", "620,00 TL", "9"]] } },
    { title: "İçerik Format Dağılımı", table: { headers: ["Format", "Adet"], rows: [["Reels", "14"], ["Carousel", "9"], ["Tekli Görsel", "6"], ["Toplam", "29"]] } },
    { title: "Değerlendirme", text: "Bu rapor kurgusal test verisi içerir." }
  ];
  const multi = await render("v32-cok-grafikli", { title: "HK Dijital — Reklam Performans Raporu", customerName: "MY CAKE 45", period: "1–30 Eylül 2026", executiveSummary: "Kurgusal özet.", sections: many, metaLines: ["Müşteri: MY CAKE 45", "Rapor Tarihi: 01.10.2026"] });
  assertCoverFirst(multi.pageTexts, "MY CAKE 45", true);
  assert.match(multi.pageTexts[0], /DÖNEM/);
  const multiText = multi.pageTexts.join(" ").replace(/\s+/g, " ");
  assert.match(multiText, /Kampanya Harcamaları — Harcama/);
  assert.match(multiText, /Kampanya Harcamaları — Sonuç/);
  assert.match(multiText, /İçerik Format Dağılımı/);
  assert.doesNotMatch(multiText, /50\.000|9 sipariş|ciro/i);
  assertNoEmptyPages(multi.pageTexts, /Reklam Performans/);

  const noChart = await render("v32-grafiksiz", { title: "HK Dijital — Ön İnceleme Raporu", customerName: "Zirve AKADEMİ", period: "-", executiveSummary: "Özet.", sections: [
    { title: "Bulgular", items: ["Instagram aktif", "Google profili eksik"] },
    { title: "Kanal Durumu", table: { headers: ["Platform", "Durum"], rows: [["Instagram", "Aktif"], ["TikTok", "Yok"]] } },
    { title: "Notlar", text: "Sayısal veri yok; grafik üretilmemeli." },
    { title: "Sonraki Adım", text: "Görüşme." }
  ] });
  assertCoverFirst(noChart.pageTexts, "Zirve AKADEMİ", true);
  assert.doesNotMatch(noChart.pageTexts.join(" "), /Kaynak: rapordaki/, "no chart without valid numeric data");

  const unit = await render("v32-robotik45-sube", { title: "HK Dijital — Ön İnceleme Raporu", customerName: "Robotik45", period: "-", executiveSummary: "Robotik45 şubesi için özet.", sections: [{ title: "Bulgular", items: ["Kurgusal bulgu"] }] });
  assertCoverFirst(unit.pageTexts, "Robotik45", false);
  assert.ok(unit.pageTexts.slice(1).every((t) => t.includes("Robotik45")), "footer carries the unit's own name");
  assert.ok(unit.pageTexts.every((t) => !t.includes("Zirve AKADEMİ")));
  assert.equal(unit.count, 2, "short report: cover + one content page, no contents page, no blank page");
});
