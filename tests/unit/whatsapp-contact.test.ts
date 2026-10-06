import test from "node:test";
import assert from "node:assert/strict";
import { realPhoneDigits, resolvePublicPhoneNumber, resolvePublicTelHref, resolvePublicWhatsappNumber, resolvePublicWhatsappUrl } from "../../src/lib/public-contact.ts";

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

test("resolvePublicWhatsappUrl: the placeholder never produces a link from any source", () => {
  assert.equal(resolvePublicWhatsappUrl("", "+905550000000", undefined), null);
  assert.equal(resolvePublicWhatsappUrl("https://wa.me/905550000000", "+905550000000", undefined), null);
  assert.equal(resolvePublicWhatsappUrl(null, null, undefined), null);
});

test("resolvePublicWhatsappUrl: env number wins and is the only link when valid", () => {
  assert.equal(resolvePublicWhatsappUrl("https://wa.me/905111111111", "+905550000000", "+90 532 123 45 67"), "https://wa.me/905321234567");
});

test("resolvePublicWhatsappUrl: a real socials URL is used when no env number is set", () => {
  assert.equal(resolvePublicWhatsappUrl("https://wa.me/905111111111", "+905550000000", undefined), "https://wa.me/905111111111");
});

test("resolvePublicWhatsappUrl: a real content number is used last", () => {
  assert.equal(resolvePublicWhatsappUrl("", "+90 532 123 45 67", undefined), "https://wa.me/905321234567");
});
