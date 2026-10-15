// Run via `npm run test:premium-report` (server-only import chain:
// --conditions=react-server --import tsx). Fictional fixtures only.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PDFDocument, PDFName, PDFDict } from "pdf-lib";
import { createCanvas } from "@napi-rs/canvas";
import { generatePdfBuffer, generateDocxBuffer, type DocumentPayload } from "../../../src/lib/server/document-generator.ts";
import { normalizeLogoImage, LogoImageError } from "../../../src/lib/server/logo-image.ts";
import { assertPublicHttpUrl, SafeFetchError } from "../../../src/lib/server/safe-fetch.ts";
import { adEvaluationPerformanceSection } from "../../../src/lib/marketing-intelligence/ad-evaluation-document.ts";
import { buildMiniAuditDocumentPayload } from "../../../src/lib/pdf-audit.ts";
import { reportHeadlineMetrics } from "../../../src/lib/reports/report-exports.ts";

function hasPdftotext() {
  try { execFileSync("pdftotext", ["-v"], { stdio: "ignore" }); return true; } catch { return false; }
}

function pdfText(buffer: Buffer): string {
  const dir = mkdtempSync(join(tmpdir(), "hkpdf-"));
  const file = join(dir, "r.pdf");
  writeFileSync(file, buffer);
  return execFileSync("pdftotext", ["-layout", file, "-"]).toString("utf8");
}

async function logoPng(width: number, height: number, transparent = true) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!transparent) { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, width, height); }
  ctx.fillStyle = "#1F3A5F";
  ctx.fillRect(width * 0.1, height * 0.2, width * 0.8, height * 0.6);
  const n = await normalizeLogoImage(Buffer.from(await canvas.encode("png")));
  return { png: new Uint8Array(n.png), width: n.width, height: n.height };
}

function imageCountOnPage(doc: PDFDocument, index: number): number {
  const resources = doc.getPage(index).node.Resources();
  const xobjects = resources?.lookup(PDFName.of("XObject"));
  return xobjects instanceof PDFDict ? xobjects.keys().length : 0;
}

const TURKISH = "Çğışöü ÇĞİŞÖÜ — İşletmenin Google İşletme Profili güncel.";

function payload(overrides: Partial<DocumentPayload> = {}): DocumentPayload {
  return {
    title: "HK Dijital — Ön İnceleme Raporu",
    customerName: "Örnek Çiğköfte Şubesi",
    period: "15 Ekim 2026",
    executiveSummary: TURKISH,
    metaLines: ["Firma: Örnek Çiğköfte Şubesi", "Rapor Tarihi: 15 Ekim 2026"],
    sections: [
      { title: "Dijital Varlıklar", items: ["Instagram: aktif", "Web sitesi: mevcut"] },
      { title: "Bütçe", charts: [{ type: "donut", title: "Bütçe Dağılımı", valueFormat: "currency", data: [{ label: "Meta Ads", value: 1250.5 }, { label: "Google Ads", value: 800 }] }] },
      { title: "Tablo", table: { headers: ["Kanal", "Durum"], rows: [["Google", "Doğrulandı"], ["Facebook", "Bulunamadı"]] } }
    ],
    ...overrides
  };
}

test("renders a real multi-page A4 PDF with cover + content pages", async () => {
  const buffer = await generatePdfBuffer(payload());
  assert.equal(buffer.subarray(0, 5).toString("utf8"), "%PDF-");
  const doc = await PDFDocument.load(buffer);
  assert.ok(doc.getPageCount() >= 2);
  const { width, height } = doc.getPage(0).getSize();
  assert.ok(Math.abs(width - 595.28) < 1 && Math.abs(height - 841.89) < 1, "A4 portrait");
});

test("dual-logo cover: HK Dijital + verified client logo side by side; HK alone when missing", async () => {
  const withClient = await PDFDocument.load(await generatePdfBuffer(payload({ clientLogo: await logoPng(900, 220) })));
  assert.equal(imageCountOnPage(withClient, 0), 2, "cover shows both logos");
  const without = await PDFDocument.load(await generatePdfBuffer(payload({ clientLogo: null })));
  assert.equal(imageCountOnPage(without, 0), 1, "cover shows HK Dijital logo only (no placeholder)");
  const broken = await PDFDocument.load(await generatePdfBuffer(payload({ clientLogo: { png: new Uint8Array([1, 2, 3]), width: 10, height: 10 } })));
  assert.equal(imageCountOnPage(broken, 0), 1, "an unusable logo never breaks generation");
});

test("square, wide and transparent client logos all render", async () => {
  for (const logo of [await logoPng(400, 400), await logoPng(1200, 200, false), await logoPng(700, 260)]) {
    const doc = await PDFDocument.load(await generatePdfBuffer(payload({ clientLogo: logo })));
    assert.equal(imageCountOnPage(doc, 0), 2);
  }
});

test("Turkish characters are embedded and extractable; TL / % / date formatting", { skip: hasPdftotext() ? false : "pdftotext not installed" }, async () => {
  const text = pdfText(await generatePdfBuffer(payload()));
  for (const fragment of ["Çğışöü", "ÇĞİŞÖÜ", "Örnek Çiğköfte Şubesi", "Ön İnceleme Raporu", "Yönetici Özeti".toLocaleUpperCase("tr").replace(/ /g, " "), "1.250,50 TL", "Doğrulandı", "Sayfa 2 /"]) {
    assert.ok(text.replace(/\s+/g, " ").includes(fragment.replace(/\s+/g, " ")) || text.includes(fragment), `missing: ${fragment}`);
  }
  assert.ok(/· %\d+/.test(text), "Turkish percent sign before the number in the donut legend");
  assert.ok(!/\d%/.test(text.replace(/\s/g, "")), "never the English 12% form");
});

test("internal reports keep the confidentiality marking; client reports never show it", { skip: hasPdftotext() ? false : "pdftotext not installed" }, async () => {
  const internal = pdfText(await generatePdfBuffer(payload({ confidentialLabel: "Dahili Kullanım" })));
  assert.ok(internal.includes("MÜŞTERİYLE PAYLAŞILMAZ"));
  const client = pdfText(await generatePdfBuffer(payload()));
  assert.ok(!client.includes("MÜŞTERİYLE PAYLAŞILMAZ"));
});

test("historical (pre-V3) payloads and incomplete data render without errors", async () => {
  const legacy: DocumentPayload = { title: "Eski Rapor", customerName: "-", period: "-", executiveSummary: "", sections: [{ title: "Notlar", text: "Eski biçim." }, { title: "Boş", items: [] }] };
  assert.ok((await PDFDocument.load(await generatePdfBuffer(legacy))).getPageCount() >= 2);
  const sparse = payload({ sections: [{ title: "Grafik", charts: [{ type: "bar", title: "Veri yok", data: [{ label: "A", value: null }] }] }] });
  assert.ok((await generatePdfBuffer(sparse)).length > 1000);
  const big = payload({ sections: [{ title: "Büyük tablo", table: { headers: ["A", "B", "C", "D", "E", "F", "G", "H"], rows: Array.from({ length: 120 }, (_, i) => Array.from({ length: 8 }, (__, j) => `Hücre ${i}-${j}`)) } }] });
  assert.ok((await PDFDocument.load(await generatePdfBuffer(big))).getPageCount() >= 4, "long tables paginate");
});

test("DOCX export carries the new blocks (metrics, chart data, client logo) without failing", async () => {
  const buffer = await generateDocxBuffer(payload({ clientLogo: await logoPng(600, 200), headlineMetrics: [{ label: "Google Puanı", value: "4,7 / 5" }], sections: [{ title: "X", metrics: [{ label: "A", value: "1" }], charts: [{ type: "bar", title: "B", data: [{ label: "a", value: 1 }, { label: "b", value: 2 }] }], callout: { text: "Not" }, timeline: [{ label: "İlk 30 Gün", items: ["Kurulum"] }] }] }));
  assert.equal(buffer.subarray(0, 2).toString("utf8"), "PK");
});

test("logo normalization: decodes and re-encodes real images, rejects fakes, SVG and tiny files", async () => {
  const canvas = createCanvas(300, 120);
  canvas.getContext("2d").fillRect(0, 0, 300, 120);
  const webp = Buffer.from(await canvas.encode("webp"));
  const normalized = await normalizeLogoImage(webp);
  assert.equal(normalized.png.subarray(1, 4).toString("ascii"), "PNG");
  assert.equal(normalized.width, 300);
  await assert.rejects(() => normalizeLogoImage(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>")), LogoImageError);
  await assert.rejects(() => normalizeLogoImage(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("not really a png")])), LogoImageError);
  const tiny = createCanvas(8, 8);
  await assert.rejects(async () => normalizeLogoImage(Buffer.from(await tiny.encode("png"))), LogoImageError);
});

test("outbound URL guard rejects private/local targets before any request", () => {
  for (const url of ["http://127.0.0.1/", "http://169.254.169.254/latest/meta-data", "http://10.0.0.5/logo.png", "http://localhost/", "https://user:pass@example.com/", "https://example.com:8443/", "file:///etc/passwd", "http://[::1]/"]) {
    assert.throws(() => assertPublicHttpUrl(url), SafeFetchError, url);
  }
  assert.equal(assertPublicHttpUrl("https://www.example.com/logo.png").hostname, "www.example.com");
});

test("ad evaluation KPI section uses only metrics present in the frozen snapshot", () => {
  const section = adEvaluationPerformanceSection({ campaign: { spend: 1250.5, reach: 4000, impressions: null, linkCtr: 1.63 }, ads: [{ name: "Video", spend: 800 }, { name: "Görsel", spend: 450.5 }], adsets: [] });
  assert.ok(section);
  assert.deepEqual(section!.metrics!.map((m) => m.label), ["Harcanan Tutar", "Erişim", "Bağlantı CTR"], "null impressions omitted, not shown as 0");
  assert.equal(section!.metrics![0].value, "1.250,50 TL");
  assert.equal(section!.metrics![2].value, "%1,63");
  assert.equal(section!.charts!.length, 1);
  assert.equal(adEvaluationPerformanceSection({}), null);
});

test("monthly report KPI cards skip absent metrics; mini audit never invents content or prices", () => {
  assert.deepEqual(reportHeadlineMetrics({ spent: 1000, impressions: undefined, ctr: 1.5 }).map((m) => m.label), ["Harcama", "Tıklama Oranı (CTR)"]);
  const audit = buildMiniAuditDocumentPayload({ businessName: "Minimal İşletme" });
  const titles = audit.sections.map((s) => s.title);
  assert.ok(!titles.includes("Teklif") && !titles.includes("Fırsatlar"), "no boilerplate sections without real content");
  assert.ok(!JSON.stringify(audit).includes("10.000 TL"), "no sample prices");
});
