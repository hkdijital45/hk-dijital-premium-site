import test from "node:test";
import assert from "node:assert/strict";
import { isValidHttpUrl, isEmptyCompetitor, sanitizeCompetitorsForPrompt } from "../../../src/lib/proposals/competitors.ts";
import type { ProposalCompetitor } from "../../../src/lib/proposals/schema.ts";

test("isValidHttpUrl: rejects a malformed URL (the real 'ttps://...' / missing-scheme bug class)", () => {
  assert.equal(isValidHttpUrl("ttps://www.manisadabeyazesyaservisi.com.tr"), false);
  assert.equal(isValidHttpUrl("www.example.com"), false);
  assert.equal(isValidHttpUrl(""), false);
  assert.equal(isValidHttpUrl(undefined), false);
  assert.equal(isValidHttpUrl("https://www.example.com"), true);
  assert.equal(isValidHttpUrl("http://example.com"), true);
});

test("isEmptyCompetitor: a fully-blank row (added by the wizard's 'Rakip Ekle' button and never filled) is detected as empty", () => {
  assert.equal(isEmptyCompetitor({ name: "", verified: false } as ProposalCompetitor), true);
  assert.equal(isEmptyCompetitor({ name: "Rakip A", verified: false } as ProposalCompetitor), false);
  assert.equal(isEmptyCompetitor({ name: "", website: "https://x.com", verified: false } as ProposalCompetitor), false);
});

test("sanitizeCompetitorsForPrompt: TEST 7 — empty competitor records are excluded, with a warning", () => {
  const result = sanitizeCompetitorsForPrompt([
    { name: "Rakip A", verified: false },
    { name: "", verified: false }
  ] as ProposalCompetitor[]);
  assert.equal(result.competitors.length, 1);
  assert.equal(result.competitors[0].name, "Rakip A");
  assert.ok(result.warnings.some((w) => w.includes("boş rakip")));
});

test("sanitizeCompetitorsForPrompt: TEST 6 — a malformed competitor URL produces a warning and is NEVER auto-rewritten", () => {
  const malformed = "ttps://www.manisadabeyazesyaservisi.com.tr";
  const result = sanitizeCompetitorsForPrompt([{ name: "Manisa Beyaz Eşya Servisi", website: malformed, verified: false }] as ProposalCompetitor[]);
  assert.equal(result.competitors[0].website, malformed, "the URL itself must be left untouched, never silently corrected");
  assert.ok(result.competitors[0].urlWarning, "a warning must be attached");
  assert.ok(result.warnings.some((w) => w.includes(malformed)));
});

test("sanitizeCompetitorsForPrompt: a malformed URL can never be marked verified, even if the user checked the box", () => {
  const result = sanitizeCompetitorsForPrompt([
    { name: "Rakip B", sourceUrl: "ttps://broken-url.com", verified: true }
  ] as ProposalCompetitor[]);
  assert.equal(result.competitors[0].verified, false);
  assert.ok(result.warnings.some((w) => w.includes("doğrulanmamış")));
});

test("sanitizeCompetitorsForPrompt: verified:true with NO sourceUrl at all is also downgraded (never an unearned verified claim)", () => {
  const result = sanitizeCompetitorsForPrompt([{ name: "Rakip C", verified: true }] as ProposalCompetitor[]);
  assert.equal(result.competitors[0].verified, false);
});

test("sanitizeCompetitorsForPrompt: a real, well-formed, verified URL passes through unchanged with no warning", () => {
  const result = sanitizeCompetitorsForPrompt([
    { name: "Rakip D", sourceUrl: "https://www.google.com/maps/place/example", verified: true }
  ] as ProposalCompetitor[]);
  assert.equal(result.competitors[0].verified, true);
  assert.equal(result.competitors[0].urlWarning, undefined);
  assert.equal(result.warnings.length, 0);
});
