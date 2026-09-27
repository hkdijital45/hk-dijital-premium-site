// buildAdCreativeClaudePrompt() — pure prompt builder for the "Claude
// Kreatif Promptunu Kopyala" button. Run via:
//   node --env-file=.env.local --conditions=react-server --import tsx --test tests/unit/marketing-intelligence/ad-creative-report-prompt.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { buildAdCreativeClaudePrompt } from "../../../src/lib/marketing-intelligence/ad-creative-report-prompt.ts";

test("buildAdCreativeClaudePrompt: contains the real company name and company_id, and references the real MCP tool names", () => {
  const prompt = buildAdCreativeClaudePrompt({ id: "fc51d411-ea37-45e4-9c93-df0cd43a4a42", name: "MY CAKE 45" });
  assert.match(prompt, /MY CAKE 45/);
  assert.match(prompt, /fc51d411-ea37-45e4-9c93-df0cd43a4a42/);
  assert.match(prompt, /get_ad_creative_context/);
  assert.match(prompt, /save_ad_creative_report/);
  assert.match(prompt, /update_ad_creative_report/);
  assert.match(prompt, /get_latest_ad_creative_report/);
  assert.doesNotMatch(prompt.toLocaleLowerCase("tr"), /token|secret|access_token|api_key|şifre/, "must never contain a secret");
});

test("buildAdCreativeClaudePrompt: always instructs draft-only save and explicit-approval-before-approve/active", () => {
  const prompt = buildAdCreativeClaudePrompt({ id: "x", name: "Y" });
  assert.match(prompt, /draft olarak kaydedilir/);
  assert.match(prompt, /açıkça onaylamadan raporu approved\/active yapma/);
});

test("buildAdCreativeClaudePrompt: instructs strict client/internal separation", () => {
  const prompt = buildAdCreativeClaudePrompt({ id: "x", name: "Y" });
  assert.match(prompt, /Müşteri Raporu ile Dahili Rapor içeriğini kesin ayır/);
  assert.match(prompt, /internalNotes/);
});

test("buildAdCreativeClaudePrompt: with no existing report, tells Claude there is none yet and to use save (never fabricates a reportId)", () => {
  const prompt = buildAdCreativeClaudePrompt({ id: "x", name: "Y" });
  assert.match(prompt, /henüz kaydedilmiş bir kreatif rapor yok/);
  assert.doesNotMatch(prompt, /reportId: undefined/);
});

test("buildAdCreativeClaudePrompt: with an existing report, includes its real id/version/status so Claude can choose update over save", () => {
  const prompt = buildAdCreativeClaudePrompt(
    { id: "x", name: "Y" },
    { adStrategyVersion: 3, latestReport: { id: "r-123", version: 2, status: "approved" } }
  );
  assert.match(prompt, /Bağlı Reklam Stratejisi: v3/);
  assert.match(prompt, /v2 \(approved, id: r-123\)/);
});

test("buildAdCreativeClaudePrompt: never crashes and never fabricates a company name for an empty/placeholder input", () => {
  assert.doesNotThrow(() => buildAdCreativeClaudePrompt({ id: "", name: "" }));
  const prompt = buildAdCreativeClaudePrompt({ id: "", name: "" });
  assert.ok(prompt.split("\n").includes("Müşteri: "), "must render an empty (not fabricated) company name verbatim");
  assert.ok(prompt.split("\n").includes("Company ID: "), "must render an empty (not fabricated) company id verbatim");
});
