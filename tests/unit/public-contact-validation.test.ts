import test from "node:test";
import assert from "node:assert/strict";
import {
  isSafeHttpUrl,
  isSafeMapsEmbedUrl,
  isPlausiblePhoneDigits,
  normalizeWhatsappNumber,
  validateContactAndSocials
} from "../../src/lib/public-contact-validation.ts";

test("isSafeHttpUrl: allows empty (means 'not shown')", () => {
  assert.equal(isSafeHttpUrl(""), true);
  assert.equal(isSafeHttpUrl("   "), true);
});

test("isSafeHttpUrl: allows real http(s) URLs", () => {
  assert.equal(isSafeHttpUrl("https://instagram.com/hkdijital"), true);
  assert.equal(isSafeHttpUrl("http://example.com"), true);
});

test("isSafeHttpUrl: rejects dangerous schemes", () => {
  assert.equal(isSafeHttpUrl("javascript:alert(1)"), false);
  assert.equal(isSafeHttpUrl("data:text/html,<script>alert(1)</script>"), false);
  assert.equal(isSafeHttpUrl("vbscript:msgbox(1)"), false);
  assert.equal(isSafeHttpUrl("file:///etc/passwd"), false);
});

test("isSafeHttpUrl: rejects non-URL garbage and non-http protocols", () => {
  assert.equal(isSafeHttpUrl("not a url"), false);
  assert.equal(isSafeHttpUrl("ftp://example.com"), false);
});

test("isSafeMapsEmbedUrl: allows empty", () => {
  assert.equal(isSafeMapsEmbedUrl(""), true);
});

test("isSafeMapsEmbedUrl: allows a real Google Maps embed URL", () => {
  assert.equal(isSafeMapsEmbedUrl("https://www.google.com/maps/embed?pb=xyz"), true);
});

test("isSafeMapsEmbedUrl: rejects a non-Google host even if https", () => {
  assert.equal(isSafeMapsEmbedUrl("https://evil.com/maps/embed?pb=xyz"), false);
});

test("isSafeMapsEmbedUrl: rejects a Google URL that isn't the maps embed path", () => {
  assert.equal(isSafeMapsEmbedUrl("https://www.google.com/search?q=hk+dijital"), false);
});

test("normalizeWhatsappNumber: strips everything but digits", () => {
  assert.equal(normalizeWhatsappNumber("+90 (555) 000-00-00"), "905550000000");
});

test("isPlausiblePhoneDigits: allows empty, accepts 7-15 digit numbers, rejects outside that range", () => {
  assert.equal(isPlausiblePhoneDigits(""), true);
  assert.equal(isPlausiblePhoneDigits("905551234567"), true);
  assert.equal(isPlausiblePhoneDigits("123456"), false);
  assert.equal(isPlausiblePhoneDigits("1234567890123456"), false);
});

test("validateContactAndSocials: passes with all fields empty", () => {
  assert.equal(validateContactAndSocials({}, {}), null);
});

test("validateContactAndSocials: rejects a non-Google maps embed URL", () => {
  assert.match(validateContactAndSocials({ mapsEmbedUrl: "https://evil.com/x" }, {}) ?? "", /Harita/);
});

test("validateContactAndSocials: rejects an implausible whatsapp number", () => {
  assert.match(validateContactAndSocials({ whatsappNumber: "123" }, {}) ?? "", /WhatsApp/);
});

test("validateContactAndSocials: rejects an implausible phone number", () => {
  assert.match(validateContactAndSocials({ phone: "123" }, {}) ?? "", /Telefon/);
});

test("validateContactAndSocials: rejects a dangerous social URL scheme", () => {
  assert.match(validateContactAndSocials({}, { instagram: "javascript:alert(1)" }) ?? "", /instagram/);
});

test("validateContactAndSocials: accepts a fully valid payload", () => {
  assert.equal(
    validateContactAndSocials(
      { phone: "905551234567", whatsappNumber: "905551234567", mapsEmbedUrl: "https://www.google.com/maps/embed?pb=1" },
      { instagram: "https://instagram.com/hkdijital", facebook: "" }
    ),
    null
  );
});
