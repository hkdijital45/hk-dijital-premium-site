import test from "node:test";
import assert from "node:assert/strict";
import { detectCliches, clicheScorePenalty, styleWarnings } from "../../src/lib/social-autopilot/cliche-detector.ts";

const BLACKLIST = [
  { phrase: "dijital dünyada", category: "intro", active: true },
  { phrase: "günümüzde", category: "intro", active: true },
  { phrase: "markanızı bir üst seviyeye taşıyın", category: "cta", active: true },
  { phrase: "hazır mısınız", category: "rhetorical_question", active: true },
  { phrase: "rakiplerinizden bir adım öne geçin", category: "cta", active: true },
  { phrase: "sadece bir ... değil", category: "list_pattern", active: false }
];

test("detectCliches: flags each seeded spec-example phrase", () => {
  for (const phrase of ["dijital dünyada", "günümüzde", "markanızı bir üst seviyeye taşıyın", "hazır mısınız", "rakiplerinizden bir adım öne geçin"]) {
    const hits = detectCliches(`Bu bir örnek cümle: ${phrase} devam eder.`, BLACKLIST);
    assert.ok(hits.some((hit) => hit.phrase.toLocaleLowerCase("tr") === phrase), `expected a hit for "${phrase}"`);
  }
});

test("detectCliches: case/diacritic-insensitive (Turkish locale)", () => {
  const hits = detectCliches("DİJİTAL DÜNYADA yeni bir dönem başlıyor.", BLACKLIST);
  assert.ok(hits.some((hit) => hit.category === "intro"));
});

test("detectCliches: inactive blacklist entries are never matched", () => {
  const hits = detectCliches("Bu sadece bir başlangıç değil, bir dönüşümdür.", BLACKLIST);
  assert.ok(!hits.some((hit) => hit.phrase === "sadece bir ... değil"));
});

test("detectCliches: structural 'X değil, Y' pattern is caught even without a blacklist entry", () => {
  const hits = detectCliches("Bu bir hizmet değil, bir ortaklıktır.", []);
  assert.ok(hits.some((hit) => hit.category === "list_pattern"));
});

test("detectCliches: clean, non-cliché copy produces no hits", () => {
  const hits = detectCliches("Geçen ay 3 müşteri için Meta Ads bütçesini %18 daha verimli hale getirdik.", BLACKLIST);
  assert.deepEqual(hits, []);
});

test("clicheScorePenalty: more distinct categories increases the penalty beyond raw count alone", () => {
  const singleCategory = [{ phrase: "a", category: "intro", index: 0 }, { phrase: "b", category: "intro", index: 5 }];
  const twoCategories = [{ phrase: "a", category: "intro", index: 0 }, { phrase: "b", category: "cta", index: 5 }];
  assert.ok(clicheScorePenalty(twoCategories) > clicheScorePenalty(singleCategory));
});

test("clicheScorePenalty: caps at 60 regardless of hit volume", () => {
  const manyHits = Array.from({ length: 20 }, (_, i) => ({ phrase: `p${i}`, category: "intro", index: i }));
  assert.equal(clicheScorePenalty(manyHits), 60);
});

test("styleWarnings: flags excessive exclamation marks and emoji", () => {
  const warnings = styleWarnings("Harika!!! Süper!!! 🎉🎉🎉🎉 Kaçırmayın!!!");
  assert.ok(warnings.some((w) => w.includes("ünlem")));
  assert.ok(warnings.some((w) => w.includes("emoji")));
});

test("styleWarnings: normal copy has no warnings", () => {
  assert.deepEqual(styleWarnings("Bu ay 12 yeni müşteri kazandık ve dönüşüm oranını %4 artırdık."), []);
});
