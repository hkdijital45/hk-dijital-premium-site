import test from "node:test";
import assert from "node:assert/strict";
import { classifyCaption } from "../../src/lib/instagram-intelligence/categorize.ts";

test("classifyCaption: recognizes a Google Ads caption", () => {
  assert.equal(classifyCaption("Google Ads kampanyanızda bütçenizi nasıl optimize edersiniz?"), "Google Ads");
});

test("classifyCaption: recognizes an SEO caption", () => {
  assert.equal(classifyCaption("SEO ile organik trafiğinizi artırmanın 5 yolu"), "SEO");
});

test("classifyCaption: returns null for unmatched captions instead of guessing", () => {
  assert.equal(classifyCaption("Bugün harika bir gün geçirdik, ekip yemeği yaptık."), null);
});

test("classifyCaption: returns null for empty captions", () => {
  assert.equal(classifyCaption(""), null);
});

test("classifyCaption: is case-insensitive", () => {
  assert.equal(classifyCaption("META ADS ile hedef kitlenizi büyütün"), "Meta Ads");
});
