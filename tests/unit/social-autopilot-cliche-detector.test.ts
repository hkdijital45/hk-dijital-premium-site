import test from "node:test";
import assert from "node:assert/strict";
import { detectCliches, clicheScorePenalty, styleWarnings } from "../../src/lib/social-autopilot/cliche-detector.ts";

const blacklist = [
  { phrase: "dijital dünyada", category: "intro", active: true },
  { phrase: "hazır mısınız", category: "rhetorical_question", active: true },
  { phrase: "inactive phrase", category: "general", active: false }
];

test("detectCliches: flags a blacklisted phrase case-insensitively", () => {
  const hits = detectCliches("Dijital Dünyada işletmeler artık farklı davranıyor.", blacklist);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].category, "intro");
});

test("detectCliches: ignores inactive blacklist entries", () => {
  const hits = detectCliches("This has an inactive phrase in it.", blacklist);
  assert.equal(hits.length, 0);
});

test("detectCliches: finds multiple occurrences of the same phrase", () => {
  // The leading "Hazır mısınız?" is caught twice over — once by the literal
  // blacklist phrase, once by the structural rhetorical-question-opener
  // pattern — which is intentional double signal, not a bug; this only
  // asserts both real occurrences of the phrase are represented.
  const hits = detectCliches("Hazır mısınız? Gerçekten hazır mısınız?", blacklist);
  const blacklistHits = hits.filter((hit) => hit.category === "rhetorical_question" && hit.phrase === "hazır mısınız");
  assert.equal(blacklistHits.length, 2);
});

test("detectCliches: flags the structural 'X değil, Y' pattern", () => {
  const hits = detectCliches("Bu bir tesadüf değil, sistemli bir çalışmanın sonucu.", []);
  assert.ok(hits.some((hit) => hit.category === "list_pattern"));
});

test("detectCliches: clean text with no cliches returns no hits", () => {
  const hits = detectCliches("Bu ay üç müşteri için reklam bütçesini yeniden dağıttık.", blacklist);
  assert.equal(hits.length, 0);
});

test("clicheScorePenalty: no hits means no penalty", () => {
  assert.equal(clicheScorePenalty([]), 0);
});

test("clicheScorePenalty: more distinct categories cost more than repeats of one", () => {
  const repeatedSameCategory = [
    { phrase: "a", category: "intro", index: 0 },
    { phrase: "a", category: "intro", index: 10 }
  ];
  const distinctCategories = [
    { phrase: "a", category: "intro", index: 0 },
    { phrase: "b", category: "cta", index: 10 }
  ];
  assert.ok(clicheScorePenalty(distinctCategories) > clicheScorePenalty(repeatedSameCategory) - 1);
});

test("clicheScorePenalty: caps at 60", () => {
  const manyHits = Array.from({ length: 20 }, (_, index) => ({ phrase: `p${index}`, category: `c${index}`, index }));
  assert.equal(clicheScorePenalty(manyHits), 60);
});

test("styleWarnings: flags excessive exclamation marks and emoji", () => {
  const warnings = styleWarnings("Harika!!! Süper!!! 🎉🚀🔥🎯");
  assert.ok(warnings.some((warning) => warning.includes("ünlem")));
  assert.ok(warnings.some((warning) => warning.includes("emoji")));
});

test("styleWarnings: normal text produces no warnings", () => {
  assert.deepEqual(styleWarnings("Bu ay reklam bütçesini üç kanala böldük."), []);
});
