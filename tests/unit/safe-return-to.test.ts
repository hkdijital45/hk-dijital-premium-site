import test from "node:test";
import assert from "node:assert/strict";
import { safeReturnTo } from "../../src/lib/safe-return-to.ts";

test("safeReturnTo: keeps a legitimate relative path", () => {
  assert.equal(safeReturnTo("/musteri-paneli/entegrasyonlar"), "/musteri-paneli/entegrasyonlar#hesap-bagla");
});

test("safeReturnTo: strips an attacker-supplied absolute URL down to a same-origin path", () => {
  const result = safeReturnTo("https://evil.example.com/phish?steal=1");
  assert.ok(!result.includes("evil.example.com"));
  assert.ok(result.startsWith("/"));
});

test("safeReturnTo: strips a protocol-relative host attempt", () => {
  const result = safeReturnTo("//evil.example.com/phish");
  assert.ok(!result.includes("evil.example.com"));
});

test("safeReturnTo: falls back to the default for empty input", () => {
  assert.equal(safeReturnTo(""), "/musteri-paneli#hesap-bagla");
});

test("safeReturnTo: falls back to the default for unparseable input", () => {
  assert.equal(safeReturnTo("   "), "/musteri-paneli#hesap-bagla");
});

test("safeReturnTo: preserves query string on a legitimate relative path", () => {
  assert.equal(safeReturnTo("/musteri-paneli?tab=entegrasyonlar"), "/musteri-paneli?tab=entegrasyonlar#hesap-bagla");
});
