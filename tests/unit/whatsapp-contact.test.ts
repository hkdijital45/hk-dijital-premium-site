import test from "node:test";
import assert from "node:assert/strict";
import { resolvePublicWhatsappNumber } from "../../src/lib/whatsapp-contact.ts";

test("the placeholder content number never becomes a live WhatsApp number", () => {
  assert.equal(resolvePublicWhatsappNumber("+905550000000", undefined), null);
});

test("a real configured env number is used and normalized to digits", () => {
  assert.equal(resolvePublicWhatsappNumber("+905550000000", "+90 532 123 45 67"), "905321234567");
});

test("a real content number is used when no env number is set", () => {
  assert.equal(resolvePublicWhatsappNumber("+90 532 123 45 67", undefined), "905321234567");
});

test("empty or too-short values never produce a link", () => {
  assert.equal(resolvePublicWhatsappNumber("", undefined), null);
  assert.equal(resolvePublicWhatsappNumber(null, "123"), null);
});
