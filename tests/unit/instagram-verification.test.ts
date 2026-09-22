import test from "node:test";
import assert from "node:assert/strict";
import { extractInstagramProfile } from "../../src/lib/website-signal-scan.ts";
import { buildInstagramVerification, computeHkDigitalNeedLevel } from "../../src/lib/instagram-verification.ts";

test("extractInstagramProfile: finds a real business profile link and normalizes the username", () => {
  const html = `<html><body><a href="https://www.instagram.com/manisanailstudio/">Instagram</a></body></html>`.toLocaleLowerCase("en-US");
  const result = extractInstagramProfile(html);
  assert.deepEqual(result, { username: "manisanailstudio", url: "https://www.instagram.com/manisanailstudio/" });
});

test("extractInstagramProfile: ignores non-profile Instagram paths (p/, reel/, explore/, share/)", () => {
  for (const path of ["p/abc123", "reel/xyz", "explore/tags/nails", "share/abcd"]) {
    const html = `<a href="https://instagram.com/${path}">link</a>`.toLocaleLowerCase("en-US");
    assert.equal(extractInstagramProfile(html), null, `expected ${path} to be excluded`);
  }
});

test("extractInstagramProfile: returns null when no Instagram link is present", () => {
  assert.equal(extractInstagramProfile("<html><body>no social links here</body></html>"), null);
});

test("extractInstagramProfile: rejects rsrc.php and other Meta internal/static resource paths (regression)", () => {
  const cases = [
    `<script src="https://www.instagram.com/rsrc.php/v3/yx/r/abc123.js"></script>`,
    `<link href="https://www.instagram.com/static/bundles/comet/Loader.css">`,
    `<a href="https://www.instagram.com/robots.txt">robots</a>`,
    `<a href="https://www.instagram.com/favicon.ico">icon</a>`,
    `<a href="https://www.instagram.com/graphql/query">api</a>`,
    `<a href="https://www.instagram.com/oauth/authorize">auth</a>`,
    `<img src="https://www.instagram.com/some-bundle-name.png">`
  ];
  for (const html of cases) {
    assert.equal(extractInstagramProfile(html.toLocaleLowerCase("en-US")), null, `expected "${html}" to be rejected`);
  }
});

test("extractInstagramProfile: rsrc.php appearing BEFORE a real profile link does not block finding the real one", () => {
  const html = `<script src="https://www.instagram.com/rsrc.php/v3/yy/r/x.js"></script><a href="https://www.instagram.com/realsalonhandle/">Instagram</a>`.toLocaleLowerCase("en-US");
  const result = extractInstagramProfile(html);
  assert.deepEqual(result, { username: "realsalonhandle", url: "https://www.instagram.com/realsalonhandle/" });
});

test("extractInstagramProfile: still accepts valid usernames containing dots/underscores (not just bare alphanumerics)", () => {
  const html = `<a href="https://www.instagram.com/ai.digitalagency">ig</a>`.toLocaleLowerCase("en-US");
  assert.deepEqual(extractInstagramProfile(html), { username: "ai.digitalagency", url: "https://www.instagram.com/ai.digitalagency/" });
});

test("buildInstagramVerification: found profile is HIGH confidence, never fabricates follower/media data", () => {
  const result = buildInstagramVerification({ username: "example", url: "https://www.instagram.com/example/" }, "2026-09-22T00:00:00.000Z");
  assert.equal(result.profileFound, true);
  assert.equal(result.matchConfidence, "HIGH");
  assert.equal(result.dataAvailable, false);
  assert.equal(result.analysisConfidence, "manual_check_required");
  assert.ok(!("followersCount" in result), "must never claim to have real follower data");
});

test("buildInstagramVerification: no profile found is NOT_FOUND, not a fabricated guess", () => {
  const result = buildInstagramVerification(null, "2026-09-22T00:00:00.000Z");
  assert.equal(result.profileFound, false);
  assert.equal(result.matchConfidence, "NOT_FOUND");
  assert.equal(result.username, null);
});

test("computeHkDigitalNeedLevel: HIGH — strong reputation AND both real gaps confirmed on an EXISTING website (no Instagram link, no tracking)", () => {
  const result = computeHkDigitalNeedLevel({
    hasWebsite: true, websiteScanFailed: false, instagramFound: false,
    metaPixelDetected: false, googleTagDetected: false, googleRating: 4.7, reviewCount: 128
  });
  assert.equal(result.level, "HIGH");
  assert.ok(result.reasons.length > 0);
});

test("computeHkDigitalNeedLevel REGRESSION — missing website + Instagram not found alone is NOT auto-HIGH (real false-positive case, e.g. 137-review business)", () => {
  const result = computeHkDigitalNeedLevel({
    hasWebsite: false, websiteScanFailed: false, instagramFound: false,
    metaPixelDetected: null, googleTagDetected: null, googleRating: 4.6, reviewCount: 137
  });
  assert.notEqual(result.level, "HIGH", "no website alone (Instagram-not-found is trivially implied, not an independent second signal) must never reach HIGH");
});

test("computeHkDigitalNeedLevel REGRESSION — a very strong Google reputation signal (1221 reviews) with no CONFIRMED digital weakness is not auto-HIGH", () => {
  const result = computeHkDigitalNeedLevel({
    hasWebsite: true, websiteScanFailed: false, instagramFound: true,
    metaPixelDetected: null, googleTagDetected: null, googleRating: 4.8, reviewCount: 1221
  });
  assert.notEqual(result.level, "HIGH", "website + Instagram both confirmed present — no real gap was found, so this must not be HIGH regardless of review volume");
});

test("computeHkDigitalNeedLevel REGRESSION — missing tracking alone (website+Instagram both present) never reaches HIGH", () => {
  const result = computeHkDigitalNeedLevel({
    hasWebsite: true, websiteScanFailed: false, instagramFound: true,
    metaPixelDetected: false, googleTagDetected: false, googleRating: 4.9, reviewCount: 300
  });
  assert.notEqual(result.level, "HIGH");
});

test("computeHkDigitalNeedLevel: reason text for missing tracking never claims 'no ads' or 'does not advertise' — only the verified fact", () => {
  const result = computeHkDigitalNeedLevel({
    hasWebsite: true, websiteScanFailed: false, instagramFound: false,
    metaPixelDetected: false, googleTagDetected: false, googleRating: 4.7, reviewCount: 50
  });
  const trackingReason = result.reasons.find((r) => r.includes("Pixel") || r.includes("Tag"));
  assert.ok(trackingReason);
  assert.doesNotMatch(trackingReason!, /reklam vermiyor|kullanmıyor|dönüşüm ölçemiyor/i);
  assert.match(trackingReason!, /tespit edilmedi/);
});

test("computeHkDigitalNeedLevel: NOT_FOUND Instagram reason never claims the account doesn't exist", () => {
  const result = computeHkDigitalNeedLevel({
    hasWebsite: true, websiteScanFailed: false, instagramFound: false,
    metaPixelDetected: false, googleTagDetected: false, googleRating: 4.7, reviewCount: 50
  });
  const igReason = result.reasons.find((r) => r.includes("Instagram"));
  assert.ok(igReason);
  assert.match(igReason!, /anlamına gelmez/);
});

test("computeHkDigitalNeedLevel: LOW — website + Instagram + ad tracking all present (already well set up)", () => {
  const result = computeHkDigitalNeedLevel({
    hasWebsite: true, websiteScanFailed: false, instagramFound: true,
    metaPixelDetected: true, googleTagDetected: true, googleRating: 4.5, reviewCount: 40
  });
  assert.equal(result.level, "LOW");
});

test("computeHkDigitalNeedLevel: UNKNOWN when there is no real signal at all — never guesses HIGH", () => {
  const result = computeHkDigitalNeedLevel({
    hasWebsite: false, websiteScanFailed: true, instagramFound: false,
    metaPixelDetected: null, googleTagDetected: null, googleRating: null, reviewCount: 0
  });
  assert.equal(result.level, "UNKNOWN");
});

test("computeHkDigitalNeedLevel: MEDIUM for mixed/partial signals that are neither clearly HIGH nor LOW", () => {
  const result = computeHkDigitalNeedLevel({
    hasWebsite: true, websiteScanFailed: false, instagramFound: false,
    metaPixelDetected: false, googleTagDetected: false, googleRating: 3.8, reviewCount: 5
  });
  assert.equal(result.level, "MEDIUM");
});
