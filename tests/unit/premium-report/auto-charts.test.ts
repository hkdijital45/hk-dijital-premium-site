// Premium PDF V3.2 — automatic charts: validation rules + real PDF output.
// Fictional fixtures only. Run via: npm run test:premium-report
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseNumericCell, withAutomaticCharts } from "../../../src/lib/report-auto-charts.ts";
import { buildPreAuditDocumentPayload } from "../../../src/lib/pre-audit/document.ts";
import { generatePdfBuffer, type DocumentPayload, type DocumentSection } from "../../../src/lib/server/document-generator.ts";

const canExtract = (() => { try { execFileSync("pdftotext", ["-v"], { stdio: "ignore" }); return true; } catch { return false; } })();

function payload(sections: DocumentSection[]): DocumentPayload {
  return { title: "HK Dijital — Ön İnceleme Raporu", customerName: "Test İşletmesi", period: "-", executiveSummary: "Özet.", sections };
}

test("parseNumericCell — whole-cell numbers only; sentences, ranges and mixed text are rejected", () => {
  assert.deepEqual(parseNumericCell("24"), { value: 24, unit: "count" });
  assert.deepEqual(parseNumericCell("1.250"), { value: 1250, unit: "count" });
  assert.deepEqual(parseNumericCell("4,8"), { value: 4.8, unit: "count" });
  assert.deepEqual(parseNumericCell("4.8"), { value: 4.8, unit: "count" });
  assert.deepEqual(parseNumericCell("3.120,40 TL"), { value: 3120.4, unit: "currency" });
  assert.deepEqual(parseNumericCell("%12,5"), { value: 12.5, unit: "percent" });
  assert.deepEqual(parseNumericCell("33 gönderi"), { value: 33, unit: "count" });
  for (const bad of ["Yaklaşık 24", "24 ürün satışı paylaşımı yapılmış", "10-20", "—", "Bilgi bulunamadı", "", "24 / 33", "0532 000 00 00"]) {
    assert.equal(parseNumericCell(bad), null, bad);
  }
});

test("content distribution with a matching Toplam row becomes a donut; the total row is not drawn", () => {
  const out = withAutomaticCharts(payload([{ title: "Sosyal Medya — Instagram İçerik Dağılımı", table: { headers: ["Kategori", "Değer"], rows: [["Ürün Satışı", "24"], ["Tamir", "3"], ["Teslimat", "4"], ["Genel İçerik", "2"], ["Toplam", "33"]] } }]));
  const chart = out.sections[0].charts?.[0];
  assert.ok(chart);
  assert.equal(chart!.type, "donut");
  assert.deepEqual(chart!.data.map((d) => d.label), ["Ürün Satışı", "Tamir", "Teslimat", "Genel İçerik"]);
  assert.deepEqual(chart!.data.map((d) => d.value), [24, 3, 4, 2]);
  assert.match(chart!.caption || "", /en küçük pay Genel İçerik/);
  assert.match(chart!.caption || "", /Toplam 33/);
});

test("a Toplam row that does not match the categories cancels the chart (table kept)", () => {
  const out = withAutomaticCharts(payload([{ title: "İçerik Dağılımı", table: { headers: ["Kategori", "Değer"], rows: [["Ürün Satışı", "24"], ["Tamir", "3"], ["Toplam", "40"]] } }]));
  assert.equal(out.sections[0].charts, undefined);
  assert.ok(out.sections[0].table);
});

test("missing, mixed-unit, negative or single values never produce a chart", () => {
  const cases: DocumentSection[] = [
    { title: "Dağılım A", table: { headers: ["Kategori", "Değer"], rows: [["A", "24"], ["B", "—"]] } },
    { title: "Dağılım B", table: { headers: ["Kategori", "Değer"], rows: [["A", "24 TL"], ["B", "%5"]] } },
    { title: "Dağılım C", table: { headers: ["Kategori", "Değer"], rows: [["A", "-3"], ["B", "4"]] } },
    { title: "Dağılım D", table: { headers: ["Kategori", "Değer"], rows: [["A", "4"]] } },
    { title: "Hesap Özeti", table: { headers: ["Alan", "Değer"], rows: [["Takipçi", "5.200"], ["Gönderi", "120"]] } }
  ];
  const out = withAutomaticCharts(payload(cases));
  out.sections.forEach((s) => assert.equal(s.charts, undefined, s.title));
});

test("competitors: rating and review count become two separate charts, never one mixed axis", () => {
  const out = withAutomaticCharts(payload([{ title: "Rakip Analizi", table: { headers: ["Rakip", "Google Puanı", "Yorum Sayısı", "Not"], rows: [["Usta Teknik Servis Merkezi", "4,6", "212", "Aktif"], ["Hızlı Tamir", "4,1", "58", "Az paylaşım"], ["Beyaz Eşya Servisi", "4,8", "131", "—"]] } }]));
  const charts = out.sections[0].charts || [];
  assert.equal(charts.length, 2);
  assert.deepEqual(charts.map((c) => c.title), ["Rakip Analizi — Google Puanı", "Rakip Analizi — Yorum Sayısı"]);
  assert.ok(charts.every((c) => c.type === "hbar"), "long competitor names use horizontal bars");
  assert.deepEqual(charts[1].data.map((d) => d.value), [212, 58, 131]);
});

test("planned budgets are labelled as plans, monthly series become a line, existing charts are not duplicated", () => {
  const out = withAutomaticCharts(payload([
    { title: "Bütçe Planı", table: { headers: ["Kanal", "Aylık Bütçe"], rows: [["Meta Ads", "6.000 TL"], ["Google Ads", "4.000 TL"]] } },
    { title: "Erişim Trendi", table: { headers: ["Ay", "Erişim"], rows: [["Ocak", "1.200"], ["Şubat", "1.650"], ["Mart", "2.100"]] } },
    { title: "Bütçe — Dağılım", charts: [{ type: "donut", title: "Var", data: [{ label: "Meta Ads", value: 4000 }, { label: "Google Ads", value: 6000 }] }] }
  ]));
  assert.equal(out.sections[0].charts, undefined, "same values as an existing chart → not duplicated");
  assert.equal(out.sections[1].charts?.[0].type, "line");
  const budget = withAutomaticCharts(payload([{ title: "Bütçe Planı", table: { headers: ["Kanal", "Aylık Bütçe"], rows: [["Meta Ads", "6.000 TL"], ["Google Ads", "4.000 TL"]] } }]));
  assert.match(budget.sections[0].charts?.[0].caption || "", /^Planlanan \/ önerilen değerlerdir, gerçekleşmiş performans değildir/);
  assert.equal(budget.sections[0].charts?.[0].valueFormat, "currency");
});

test("pre-audit: a stored numeric map becomes a chartable table; columns are ordered Platform → Durum → Bulgular", () => {
  const report = {
    id: "00000000-0000-4000-8000-0000000000c1", company_id: null, lead_id: "00000000-0000-4000-8000-0000000000c2", business_unit_id: null,
    analysis_group_id: "g", report_type: "CLIENT_REPORT", title: "Örnek Teknik Servis — Ön İnceleme", status: "draft", report_date: "2026-10-15",
    created_at: "2026-10-15T09:00:00Z", updated_at: "2026-10-15T09:00:00Z", executive_summary: "Özet.",
    social_analysis: { instagram_icerik_dagilimi: { urun_satisi: 24, tamir: 3, teslimat: 4, genel: 2 }, yorum: "Satış odaklı içerik ağırlıkta." },
    digital_presence: { channels: [{ bulgular: "Profil eksik", platform: "Instagram", durum: "Aktif" }, { bulgular: "Kayıt yok", platform: "Google", durum: "Yok" }] }
  } as unknown as Parameters<typeof buildPreAuditDocumentPayload>[0];
  const doc = withAutomaticCharts(buildPreAuditDocumentPayload(report, "Örnek Teknik Servis"));
  const dist = doc.sections.find((s) => /Dagilimi|Dağılımı/i.test(s.title));
  assert.ok(dist?.charts?.length, "content distribution chart generated from typed numbers");
  assert.deepEqual(dist!.charts![0].data.map((d) => d.value), [24, 3, 4, 2]);
  const channels = doc.sections.find((s) => s.table?.headers.includes("Platform"));
  assert.deepEqual(channels?.table?.headers, ["Platform", "Durum", "Bulgular"]);
  assert.deepEqual(channels?.table?.rows[0], ["Instagram", "Aktif", "Profil eksik"], "values move with their column");
});

test("PDF: automatic charts are rendered with titles, values and captions", { skip: !canExtract && "pdftotext missing" }, async () => {
  const buffer = await generatePdfBuffer(payload([
    { title: "Instagram İçerik Dağılımı", table: { headers: ["Kategori", "Değer"], rows: [["Ürün Satışı", "24"], ["Tamir", "3"], ["Teslimat", "4"], ["Genel İçerik", "2"], ["Toplam", "33"]] } },
    { title: "Rakip Analizi", table: { headers: ["Rakip", "Yorum Sayısı"], rows: [["Usta Teknik Servis Merkezi", "212"], ["Hızlı Tamir", "58"]] } }
  ]));
  const dir = process.env.PDF_OUT || mkdtempSync(join(tmpdir(), "hk-charts-"));
  const file = join(dir, "otomatik-grafikler.pdf");
  writeFileSync(file, buffer);
  const text = execFileSync("pdftotext", [file, "-"]).toString("utf8").replace(/\s+/g, " ");
  assert.match(text, /en küçük pay Genel İçerik/);
  assert.match(text, /En yüksek değer Usta Teknik Servis Merkezi/);
  assert.match(text, /Kaynak: rapordaki "Instagram İçerik Dağılımı" tablosu/);
});
