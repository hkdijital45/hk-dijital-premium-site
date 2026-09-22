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

test("computeHkDigitalNeedLevel: HIGH — strong real-world reputation but weak digital presence", () => {
  const result = computeHkDigitalNeedLevel({
    hasWebsite: false, websiteScanFailed: false, instagramFound: false,
    metaPixelDetected: null, googleTagDetected: null, googleRating: 4.7, reviewCount: 128
  });
  assert.equal(result.level, "HIGH");
  assert.ok(result.reasons.length > 0);
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
