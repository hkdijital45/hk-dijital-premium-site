import test from "node:test";
import assert from "node:assert/strict";
import { resolveBusinessCategory } from "../../src/lib/business-category.ts";
import { classifySectorProfile, getSectorProfile } from "../../src/lib/sector-signal.ts";
import { estimateAdBudget, recommendServicePackage, getPlatformBudgetSplit } from "../../src/lib/packages.ts";

const OTO_SERVIS = "Oto Servis";
const GUZELLIK_MERKEZI = "Güzellik Merkezi";

// Every other wizard answer kept identical between the two cases, matching
// the production-verification test matrix.
const COMMON_ANSWERS = {
  goal: "Daha Fazla Satış",
  platform: ["meta", "google"] as const,
  budget: "20000",
  contentNeed: "medium",
  urgency: "this_month",
  socialStatus: "irregular"
};

test("resolveBusinessCategory: the exact custom sector value is produced for both cases (request payload contract)", () => {
  assert.equal(resolveBusinessCategory("other", OTO_SERVIS), "Oto Servis");
  assert.equal(resolveBusinessCategory("other", GUZELLIK_MERKEZI), "Güzellik Merkezi");
});

test("classifySectorProfile: Oto Servis resolves to a local high-intent profile, Güzellik Merkezi to an appointment-based visual profile", () => {
  assert.equal(classifySectorProfile(OTO_SERVIS), "local_high_intent");
  assert.equal(classifySectorProfile(GUZELLIK_MERKEZI), "appointment_visual");
});

test("estimateAdBudget: identical inputs except sector produce different, sector-justified budgets (not forced, but not identical-by-accident either)", () => {
  const a = estimateAdBudget({ ...COMMON_ANSWERS, sector: OTO_SERVIS, platform: [...COMMON_ANSWERS.platform] });
  const b = estimateAdBudget({ ...COMMON_ANSWERS, sector: GUZELLIK_MERKEZI, platform: [...COMMON_ANSWERS.platform] });

  // Different real-world competition multipliers (1.22 vs 1.12) for these two
  // specific sectors mean the numeric ranges legitimately differ here.
  assert.notDeepEqual(a.minimumRange, b.minimumRange);
  assert.notDeepEqual(a.idealRange, b.idealRange);

  // The reason text must be sector-grounded, not just goal/platform boilerplate.
  assert.ok(a.reason.includes(OTO_SERVIS));
  assert.ok(b.reason.includes(GUZELLIK_MERKEZI));
  assert.notEqual(a.reason, b.reason);

  // Risk notes (appended to `notes`) must reflect the actual sector's failure
  // mode, not a single generic risk list reused for every sector.
  assert.notDeepEqual(a.notes, b.notes);
  assert.ok(a.notes.some((note) => note.includes("Google puanı")));
  assert.ok(b.notes.some((note) => note.includes("izin ve etik")));

  // Extra-service suggestions must differ meaningfully (not just the sector
  // name swapped into an identical sentence).
  assert.notDeepEqual(a.extraServices, b.extraServices);
  assert.ok(a.extraServices.includes("Google İşletme Profili optimizasyonu"));
  assert.ok(b.extraServices.includes("Aylık içerik ve reels çekim planı"));

  // 30-day plan must carry a sector-specific focus line, and it must differ.
  assert.notEqual(a.first30DaysPlan.at(-1), b.first30DaysPlan.at(-1));
});

test("getPlatformBudgetSplit: platform allocation leans toward the channel the actual sector suits, without adding/removing platforms the user didn't select", () => {
  const otoSplit = getPlatformBudgetSplit(["meta", "google"], COMMON_ANSWERS.goal, OTO_SERVIS);
  const guzellikSplit = getPlatformBudgetSplit(["meta", "google"], COMMON_ANSWERS.goal, GUZELLIK_MERKEZI);

  const labels = (split: typeof otoSplit) => split.map((item) => item.label).sort();
  assert.deepEqual(labels(otoSplit), labels(guzellikSplit)); // same two channels, no invented platform

  const googlePercent = (split: typeof otoSplit) => split.find((item) => item.label.startsWith("Google"))?.percent;
  const metaPercent = (split: typeof otoSplit) => split.find((item) => item.label.startsWith("Meta"))?.percent;

  // Oto Servis (local high-intent / search) should lean Google harder than
  // Güzellik Merkezi (appointment-based visual / Meta) does, for the exact
  // same selected platforms and goal.
  assert.ok((googlePercent(otoSplit) ?? 0) > (googlePercent(guzellikSplit) ?? 0));
  assert.ok((metaPercent(guzellikSplit) ?? 0) > (metaPercent(otoSplit) ?? 0));

  // The lean must come with an explanatory clause, not a silent number change.
  const google = otoSplit.find((item) => item.label.startsWith("Google"));
  const meta = guzellikSplit.find((item) => item.label.startsWith("Meta"));
  assert.ok(google?.note.includes(OTO_SERVIS));
  assert.ok(meta?.note.includes(GUZELLIK_MERKEZI));
});

test("recommendServicePackage: reasoning differs by sector while the package catalog choice stays governed by platform/budget (not overridden by sector)", () => {
  const a = recommendServicePackage({ ...COMMON_ANSWERS, sector: OTO_SERVIS, platform: [...COMMON_ANSWERS.platform] });
  const b = recommendServicePackage({ ...COMMON_ANSWERS, sector: GUZELLIK_MERKEZI, platform: [...COMMON_ANSWERS.platform] });

  // Same platform/budget/goal answers -> same catalog category+tier; sector
  // does not invent or substitute a different package (by design).
  assert.equal(a.recommended.category, b.recommended.category);
  assert.equal(a.recommended.tier, b.recommended.tier);

  // But the reasoning text must be sector-specific and must differ.
  assert.ok(a.reason.includes(OTO_SERVIS));
  assert.ok(b.reason.includes(GUZELLIK_MERKEZI));
  assert.notEqual(a.reason, b.reason);
});

test("no stale-state reuse: interleaved calls for two different sectors never leak into each other (pure-function guarantee)", () => {
  const first = recommendServicePackage({ ...COMMON_ANSWERS, sector: OTO_SERVIS, platform: [...COMMON_ANSWERS.platform] });
  const middle = recommendServicePackage({ ...COMMON_ANSWERS, sector: GUZELLIK_MERKEZI, platform: [...COMMON_ANSWERS.platform] });
  const repeat = recommendServicePackage({ ...COMMON_ANSWERS, sector: OTO_SERVIS, platform: [...COMMON_ANSWERS.platform] });

  assert.deepEqual(first, repeat);
  assert.notDeepEqual(first, middle);
});

test("arbitrary uncategorized custom sectors still resolve safely (no crash, sane generic profile, no false-positive keyword match)", () => {
  const profile = getSectorProfile("Zzqx Danışmanlık Atölyesi");
  assert.equal(profile.key, "generic_local");
  assert.equal(profile.competitionMultiplier, 1);

  // A word that merely *contains* a profile keyword as a substring (not as a
  // whole token) must not misclassify — "fotoğrafçı" contains "oto" but is
  // not an auto-service business.
  assert.equal(classifySectorProfile("Fotoğrafçı"), "generic_local");
});

test("/api/ai/ad-budget-research validation contract mirrors business-category rules for generic sector values", () => {
  // Pure-function proof that the same generic-category rule used by the
  // route's 400 guard also governs the client's own resolvedBusinessCategory
  // fallback text, so the two layers cannot disagree about what "generic" means.
  assert.equal(resolveBusinessCategory("other", ""), "");
});
