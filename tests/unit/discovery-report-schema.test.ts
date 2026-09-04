import test from "node:test";
import assert from "node:assert/strict";
import { buildProviderFailureMessage, classifyProviderError, validateAndBackfillSections } from "../../src/lib/discovery-report-schema.ts";

const requiredSwotTitles = ["Güçlü Yönler", "Zayıf Yönler", "Fırsatlar", "Tehditler", "Önerilen İlk 3 Aksiyon"];
const fallbackSections = requiredSwotTitles.map((title) => ({ title, items: [`${title} için yeterli veri yok.`] }));

test("classifyProviderError: an explicitly tagged missing_configuration error is preserved", () => {
  const error = Object.assign(new Error("API anahtarı yapılandırılmadı"), { category: "missing_configuration" });
  assert.equal(classifyProviderError(error), "missing_configuration");
});

test("classifyProviderError: HTTP 401 and 403 are classified as auth_error", () => {
  assert.equal(classifyProviderError(Object.assign(new Error("Unauthorized"), { status: 401 })), "auth_error");
  assert.equal(classifyProviderError(Object.assign(new Error("Forbidden"), { status: 403 })), "auth_error");
});

test("classifyProviderError: HTTP 429 is classified as rate_limit", () => {
  assert.equal(classifyProviderError(Object.assign(new Error("Too Many Requests"), { status: 429 })), "rate_limit");
});

test("classifyProviderError: an AbortError (fetch timeout) is classified as timeout", () => {
  const error = new Error("The operation was aborted");
  error.name = "AbortError";
  assert.equal(classifyProviderError(error), "timeout");
});

test("classifyProviderError: an unrecognized failure falls back to provider_error, never leaks message text", () => {
  const category = classifyProviderError(new Error("sk-verysecrettoken123 rejected by upstream"));
  assert.equal(category, "provider_error");
});

test("buildProviderFailureMessage: no failures still returns the original generic message", () => {
  const message = buildProviderFailureMessage([]);
  assert.match(message, /AI ayarlarını kontrol/);
});

test("buildProviderFailureMessage: differentiates providers and categories, de-duplicates repeated categories", () => {
  const message = buildProviderFailureMessage([
    { provider: "Hızlı İçerik Motoru", category: "missing_configuration" },
    { provider: "Araştırma ve Google Analiz Motoru", category: "auth_error" },
    { provider: "Strateji Motoru", category: "auth_error" }
  ]);
  assert.match(message, /Hızlı İçerik Motoru: yapılandırma eksik/);
  assert.match(message, /Araştırma ve Google Analiz Motoru: yetkilendirme hatası/);
  // Never leaks raw provider/API error text — only the safe category label.
  assert.doesNotMatch(message, /sk-|Bearer|token/i);
});

test("validateAndBackfillSections: a well-formed AI response with all required sections passes through unchanged", () => {
  const aiSections = requiredSwotTitles.map((title) => ({ title, items: [`${title} gerçek AI maddesi.`] }));
  const { sections, backfilledTitles } = validateAndBackfillSections(aiSections, requiredSwotTitles, fallbackSections);
  assert.equal(backfilledTitles.length, 0);
  assert.deepEqual(sections.map((s) => s.title), requiredSwotTitles);
  assert.equal(sections[0].items[0], "Güçlü Yönler gerçek AI maddesi.");
});

test("validateAndBackfillSections: empty discovery data (no AI sections at all) backfills every required section from real fallback data, never fabricates", () => {
  const { sections, backfilledTitles } = validateAndBackfillSections([], requiredSwotTitles, fallbackSections);
  assert.equal(backfilledTitles.length, requiredSwotTitles.length);
  assert.deepEqual(sections.map((s) => s.title), requiredSwotTitles);
  for (const section of sections) assert.match(section.items[0], /yeterli veri yok/);
});

test("validateAndBackfillSections: a partial/invalid-JSON-recovery response only backfills the missing titles, keeps what the AI actually provided", () => {
  const aiSections = [
    { title: "Güçlü Yönler", items: ["Google puanı yüksek."] },
    { title: "Fırsatlar", items: ["Yerel görünürlük artırılabilir."] }
  ];
  const { sections, backfilledTitles } = validateAndBackfillSections(aiSections, requiredSwotTitles, fallbackSections);
  assert.deepEqual(backfilledTitles.sort(), ["Zayıf Yönler", "Tehditler", "Önerilen İlk 3 Aksiyon"].sort());
  const strengths = sections.find((s) => s.title === "Güçlü Yönler");
  assert.equal(strengths?.items[0], "Google puanı yüksek."); // untouched, not overwritten
  const weaknesses = sections.find((s) => s.title === "Zayıf Yönler");
  assert.match(weaknesses?.items[0] || "", /yeterli veri yok/); // backfilled from real fallback, not invented
});

test("validateAndBackfillSections: matches titles case/diacritic-insensitively so a near-identical AI title isn't wrongly backfilled over", () => {
  const aiSections = [{ title: "güçlü yönler", items: ["Gerçek madde."] }];
  const { sections, backfilledTitles } = validateAndBackfillSections(aiSections, ["Güçlü Yönler"], fallbackSections);
  assert.equal(backfilledTitles.length, 0);
  assert.equal(sections[0].items[0], "Gerçek madde.");
});
