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

test("validateContactAndSocials: rejects a bare platform-domain URL (no real account path) — the exact live bug this fixes", () => {
  assert.match(validateContactAndSocials({}, { instagram: "https://instagram.com/" }) ?? "", /instagram/);
  assert.match(validateContactAndSocials({}, { instagram: "https://instagram.com" }) ?? "", /instagram/);
  assert.match(validateContactAndSocials({}, { youtube: "https://youtube.com/" }) ?? "", /youtube/);
});

test("validateContactAndSocials: accepts a real profile/channel path for every platform shape", () => {
  assert.equal(validateContactAndSocials({}, { instagram: "https://instagram.com/hkdijital" }), null);
  assert.equal(validateContactAndSocials({}, { youtube: "https://youtube.com/@hkdijital" }), null);
  assert.equal(validateContactAndSocials({}, { youtube: "https://youtube.com/channel/UC12345" }), null);
  assert.equal(validateContactAndSocials({}, { linkedin: "https://linkedin.com/company/hkdijital" }), null);
});

test("validateContactAndSocials: a bare-domain whatsapp link is NOT rejected by the platform-root check (whatsappNumber validates the real channel instead)", () => {
  assert.equal(validateContactAndSocials({}, { whatsapp: "https://wa.me/" }), null);
});

// Every real-account URL shape named in the "ACİL DÜZELTME" brief must be
// accepted, never mistaken for a placeholder — the ?id= query string and
// the leading @ must both survive untouched (isSafeHttpUrl/
// isGenericPlatformRootUrl only ever inspect url.pathname, never rewrite
// or drop url.search).
test("validateContactAndSocials: accepts every real-account URL shape named in the fix request", () => {
  assert.equal(validateContactAndSocials({}, { facebook: "https://facebook.com/profile.php?id=100012345678901" }), null);
  assert.equal(validateContactAndSocials({}, { linkedin: "https://linkedin.com/in/hayrikamali" }), null);
  assert.equal(validateContactAndSocials({}, { youtube: "https://youtube.com/@hkdijital" }), null);
  assert.equal(validateContactAndSocials({}, { tiktok: "https://tiktok.com/@hkdijital" }), null);
  assert.equal(validateContactAndSocials({}, { twitter: "https://x.com/hkdijital" }), null);
  assert.equal(validateContactAndSocials({}, { twitter: "https://twitter.com/hkdijital" }), null);
});

test("validateContactAndSocials: a Facebook profile.php URL keeps its ?id= query string intact (not stripped by validation)", () => {
  const facebook = "https://facebook.com/profile.php?id=100012345678901";
  assert.equal(validateContactAndSocials({}, { facebook }), null);
  // isSafeHttpUrl/isGenericPlatformRootUrl must never rewrite the value —
  // the caller always persists the original string, this just proves the
  // parsed URL still carries the full query string these checks read.
  const parsed = new URL(facebook);
  assert.equal(parsed.search, "?id=100012345678901");
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
