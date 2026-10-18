// Run via `npm run test:pre-audit-export`. Synthetic text only.
import test from "node:test";
import assert from "node:assert/strict";
import { findIndexingOverclaims, NOINDEX_EVIDENCE_RULE } from "../../../src/lib/pre-audit/evidence-wording.ts";
import { buildPreAuditLeadPrompt } from "../../../src/lib/pre-audit-lead-prompt.ts";
import { buildClaudePrompt } from "../../../src/lib/pre-audit/lead-prompts.ts";

test("flags the absolute, site-wide indexing claims from the Altın Seyit report", () => {
  const report = {
    executive_summary: "Web sitesi: Online satışa hazır; ancak kontrolde Google'da hiçbir sayfası görünmüyor.",
    digital_presence: { "Dijital Varlıklar": [{ Kanal: "Web sitesi", Durum: "Aktif online mağaza. Google'da görünmüyor." }] },
    seo_analysis: { "SEO": "Sitenin Google'da görünmemesi, organik (ücretsiz) arama trafiğinin şu an fiilen kapalı olduğu anlamına gelir." },
    google_analysis: { "Önerilen Aksiyon": "Sitenin Google'a açılması ve takip edilmesi." }
  };
  const warnings = findIndexingOverclaims(report);
  const phrases = warnings.map((w) => w.phrase.toLocaleLowerCase("tr"));
  assert.ok(phrases.some((p) => p.includes("hiçbir sayfası görünmüyor")));
  assert.ok(phrases.some((p) => p.includes("google'da görünmüyor")));
  assert.ok(phrases.some((p) => p.includes("fiilen kapalı")));
  assert.ok(phrases.some((p) => p.includes("google'a açılması")));
  assert.ok(warnings.every((w) => w.path && w.guidance));
  assert.ok(warnings.some((w) => w.path === "digital_presence.Dijital Varlıklar[0].Durum"));
});

test("does not flag correctly scoped, evidence-limited wording", () => {
  const report = {
    seo_analysis: "18.10.2026 tarihinde yapılan kontrolde web sitesinin ana sayfasında arama motorlarına indekslememe talimatı veren noindex etiketi tespit edilmiştir. Bu ayar ana sayfanın Google arama sonuçlarında görünmesini engelleyebilir. Diğer sayfaların indekslenme durumu Google Search Console üzerinden ayrıca doğrulanmalıdır.",
    google_analysis: "18.10.2026 tarihli site: sorgusunda sonuç listelenmedi; bu tek bir zaman noktasındaki gözlemdir."
  };
  assert.deepEqual(findIndexingOverclaims(report), []);
});

test("never mutates the input report", () => {
  const report = { seo_analysis: "Google'da hiçbir sayfası görünmüyor." };
  const before = JSON.stringify(report);
  findIndexingOverclaims(report);
  assert.equal(JSON.stringify(report), before);
});

test("both Ön İnceleme prompts carry the evidence-scope rule and the example sentence", () => {
  const leadPrompt = buildPreAuditLeadPrompt("lead-1", { company: "Örnek" });
  const claudePrompt = buildClaudePrompt({ id: "lead-1", company: "Örnek" });
  for (const prompt of [leadPrompt, claudePrompt]) {
    assert.ok(prompt.includes(NOINDEX_EVIDENCE_RULE));
    assert.match(prompt, /ana sayfasında arama motorlarına indekslememe/);
    assert.match(prompt, /Google Search Console/);
  }
});
