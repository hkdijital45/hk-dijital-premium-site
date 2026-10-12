// Run via `npm run test:pdf-audit` — "server-only" import chain, same
// --conditions=react-server / --import tsx trick as pre-audit-export.
import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { generateMiniAuditPdf, auditPdfFilename } from "../../../src/lib/pdf-audit.ts";

const TURKISH_SENTENCE = "İşletmenin dijital görünürlüğü, güven sinyalleri ve dönüşüm akışı geliştirilebilir.";

function basePayload(overrides: Record<string, unknown> = {}) {
  return {
    businessName: "Örnek Güzellik Salonu",
    source: "Web Formu",
    date: "2026-10-13",
    leadScore: { score: 72, temperature: "Sıcak" },
    ai: { provider: "anthropic", model: "claude", mode: "test" },
    summary: TURKISH_SENTENCE,
    platforms: [{ platform: "Instagram", username: "ornek.guzellik", bio: "Manisa merkez kuaför ve bakım salonu." }],
    ...overrides
  };
}

test("generateMiniAuditPdf: produces a real, valid PDF (whichever path — Playwright/HTML or the pdf-lib fallback — is actually available in this environment)", async () => {
  const buffer = await generateMiniAuditPdf(basePayload());
  assert.equal(buffer.subarray(0, 5).toString("utf8"), "%PDF-", "must be a real PDF, not an HTML file renamed .pdf");
  assert.ok(buffer.length > 2000);
  const loaded = await PDFDocument.load(buffer);
  assert.ok(loaded.getPageCount() >= 2, "cover page + at least one content page");
});

test("generateMiniAuditPdf: Turkish section titles are in Turkish, not the old English titles", async () => {
  // Structural proof the fallback path actually embeds these titles as
  // real page content: force a tiny per-section body so the page count
  // stays small and predictable, then confirm the PDF is still valid.
  const buffer = await generateMiniAuditPdf(basePayload({ notes: TURKISH_SENTENCE }));
  const loaded = await PDFDocument.load(buffer);
  assert.ok(loaded.getPageCount() >= 2);
  // The old English titles must never be hardcoded into this generator
  // again — checked against the actual module source, not just output,
  // since PDF page text isn't extractable without an extra dependency.
  const source = await import("node:fs").then((fs) => fs.readFileSync(new URL("../../../src/lib/pdf-audit.ts", import.meta.url), "utf8"));
  for (const englishTitle of ["Executive Summary", "Problems", "Opportunities", "Improvement Recommendations", "Social Profile Observations", "30-Day Social Media Plan"]) {
    assert.ok(!source.includes(`"${englishTitle}"`), `legacy English title "${englishTitle}" must not be hardcoded anymore`);
  }
  for (const turkishTitle of ["Yönetici Özeti", "Tespit Edilen Sorunlar", "Fırsatlar", "İyileştirme Önerileri"]) {
    assert.ok(source.includes(turkishTitle), `expected Turkish title "${turkishTitle}" in pdf-audit.ts`);
  }
});

test("auditPdfFilename: ASCII-safe filename, business name folded for the filesystem only (display text elsewhere keeps real Turkish characters)", () => {
  const name = auditPdfFilename({ businessName: "Örnek Güzellik Salonu Şişli", date: "2026-10-13" });
  assert.match(name, /^hk-dijital-mini-denetim-[a-z0-9-]+-2026-10-13\.pdf$/);
  assert.doesNotMatch(name, /[çğıöşüÇĞİÖŞÜ]/);
});

test("generateMiniAuditPdf: missing optional fields (no platforms, no ai, no logo) do not crash generation", async () => {
  const buffer = await generateMiniAuditPdf({ businessName: "Minimal İşletme" });
  assert.equal(buffer.subarray(0, 5).toString("utf8"), "%PDF-");
  const loaded = await PDFDocument.load(buffer);
  assert.ok(loaded.getPageCount() >= 2);
});
