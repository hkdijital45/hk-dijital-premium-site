import test from "node:test";
import assert from "node:assert/strict";
import { extractInstagramProfile, parseInstagramProfileUrl } from "../../src/lib/website-signal-scan.ts";
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

test("extractInstagramProfile PRODUCTION REGRESSION — real false-positive fixtures from a 20-business sample must all be rejected", () => {
  // Each fixture reproduces the actual shape that previously slipped
  // through for Umut Ekinci Hair Dresser / Yeliz Dinçer Hair&Makeup
  // Studio / Ceren Yazgan Nail Studio / Feyza Haras NAIL STUDIO
  // (username "_n") and the earlier rsrc.php/static-resource cases.
  const fixtures: Record<string, string> = {
    "_n internal fragment (share-sheet / embed script)": `<script src="https://www.instagram.com/embed.js?variant=_n"></script>`,
    "_n as a bare short link": `<a href="https://www.instagram.com/_n">x</a>`,
    "rsrc.php resource loader": `<script src="https://www.instagram.com/rsrc.php/v3/yx/r/abc123.js"></script>`,
    "static/resource bundle URL": `<link href="https://www.instagram.com/static/bundles/comet/Loader.css">`,
    "redirect/query tracking URL (share-sheet redirect)": `<a href="https://l.instagram.com/?u=https%3A%2F%2Fwww.instagram.com%2F&e=abc">Instagram</a>`,
    "query-string-only URL with no real path": `<a href="https://www.instagram.com/?hl=tr&utm_source=ig_web_button_share_sheet">Instagram</a>`,
    "/p/ single post permalink": `<a href="https://www.instagram.com/p/CxYz123Abc/">post</a>`,
    "/reel/ permalink": `<a href="https://www.instagram.com/reel/CxYz123Abc/">reel</a>`,
    "/stories/ permalink": `<a href="https://www.instagram.com/stories/somehandle/123456/">story</a>`,
    "/explore/ discovery page": `<a href="https://www.instagram.com/explore/tags/nails/">explore</a>`
  };
  for (const [label, html] of Object.entries(fixtures)) {
    const result = extractInstagramProfile(html.toLocaleLowerCase("en-US"));
    assert.equal(result, null, `expected "${label}" to be rejected, got ${JSON.stringify(result)}`);
  }
});

test("extractInstagramProfile PRODUCTION REGRESSION — a real plain username and a real dotted username are both still found", () => {
  const plain = extractInstagramProfile(`<a href="https://www.instagram.com/salonmerveirmak/">Instagram</a>`.toLocaleLowerCase("en-US"));
  assert.deepEqual(plain, { username: "salonmerveirmak", url: "https://www.instagram.com/salonmerveirmak/" });

  const dotted = extractInstagramProfile(`<a href="https://www.instagram.com/ai.digitalagency/">Instagram</a>`.toLocaleLowerCase("en-US"));
  assert.deepEqual(dotted, { username: "ai.digitalagency", url: "https://www.instagram.com/ai.digitalagency/" });
});

test("extractInstagramProfile PRODUCTION REGRESSION — a /stories/ or /reel/ link never blocks a genuine profile link elsewhere on the same page", () => {
  const html = `<a href="https://www.instagram.com/stories/somehandle/123/">story</a><a href="https://www.instagram.com/salonmerveirmak/">profile</a>`.toLocaleLowerCase("en-US");
  assert.deepEqual(extractInstagramProfile(html), { username: "salonmerveirmak", url: "https://www.instagram.com/salonmerveirmak/" });
});

test("parseInstagramProfileUrl: rejects non-instagram.com hosts (l.instagram.com redirect, cdninstagram.com static, graph.instagram.com API)", () => {
  assert.equal(parseInstagramProfileUrl("https://l.instagram.com/?u=https://instagram.com/realuser"), null);
  assert.equal(parseInstagramProfileUrl("https://scontent.cdninstagram.com/v/t51/realuser.jpg"), null);
  assert.equal(parseInstagramProfileUrl("https://graph.instagram.com/realuser"), null);
});

test("parseInstagramProfileUrl: directly parses when the Google Places website field IS an Instagram profile URL", () => {
  const result = parseInstagramProfileUrl("https://www.instagram.com/salonmerveirmak");
  assert.deepEqual(result, { username: "salonmerveirmak", url: "https://www.instagram.com/salonmerveirmak/" });
});

test("parseInstagramProfileUrl PRODUCTION REGRESSION — real Google Places 'website' field values with igshid/utm tracking query strings", () => {
  assert.deepEqual(
    parseInstagramProfileUrl("https://instagram.com/feyzaharasnailstudio?igshid=MmVlMjlkMTBhMg==&utm_source=qr"),
    { username: "feyzaharasnailstudio", url: "https://www.instagram.com/feyzaharasnailstudio/" }
  );
  assert.deepEqual(
    parseInstagramProfileUrl("https://instagram.com/ay.guzellikmerkezi?igshid=M25xd29mNzF5NnFx"),
    { username: "ay.guzellikmerkezi", url: "https://www.instagram.com/ay.guzellikmerkezi/" }
  );
  assert.equal(parseInstagramProfileUrl("https://instagram.com/"), null, "bare root URL with no handle must not produce a fabricated username");
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

test("computeHkDigitalNeedLevel REGRESSION — website + no Instagram link + no tracking + strong Google reputation is NOT, by itself, HIGH (real production false positives: Manisa Cix 5.0/1221, Emre Özlük 5.0/260, Mesmerica 4.8/248)", () => {
  const result = computeHkDigitalNeedLevel({
    hasWebsite: true, websiteScanFailed: false, instagramFound: false,
    metaPixelDetected: false, googleTagDetected: false, googleRating: 4.7, reviewCount: 128
  });
  assert.equal(result.level, "MEDIUM", "two unconfirmed technical gaps plus a reputation number is not proof of direct commercial need — this dataset cannot reliably confirm HIGH");
  assert.ok(result.reasons.length > 0);
  assert.ok(
    result.reasons.some((r) => r.includes("doğrulanamıyor")),
    "reasons must explicitly say direct commercial need could not be confirmed, not silently downgrade"
  );
});

test("computeHkDigitalNeedLevel REGRESSION — the exact real 20-business production sample's 3 HIGH cases (Manisa Cix, Emre Özlük, Mesmerica) no longer resolve to HIGH", () => {
  const productionCases = [
    { name: "Manisa Cix", googleRating: 5.0, reviewCount: 1221 },
    { name: "Emre Özlük", googleRating: 5.0, reviewCount: 260 },
    { name: "Mesmerica", googleRating: 4.8, reviewCount: 248 }
  ];
  for (const business of productionCases) {
    const result = computeHkDigitalNeedLevel({
      hasWebsite: true, websiteScanFailed: false, instagramFound: false,
      metaPixelDetected: false, googleTagDetected: false,
      googleRating: business.googleRating, reviewCount: business.reviewCount
    });
    assert.notEqual(result.level, "HIGH", `${business.name} must no longer be flagged HIGH from unconfirmed gaps alone`);
  }
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

test("computeHkDigitalNeedLevel: reasons never ASSERT revenue, business size, saturation, or 'needs new customers' as a fact from review count (explicit disclaimers naming these concepts to rule them out are fine)", () => {
  const result = computeHkDigitalNeedLevel({
    hasWebsite: true, websiteScanFailed: false, instagramFound: false,
    metaPixelDetected: false, googleTagDetected: false, googleRating: 5.0, reviewCount: 1221
  });
  const allReasons = result.reasons.join(" ");
  assert.doesNotMatch(allReasons, /büyük bir işletme|yüksek ciro|düşük ciro|pazar doygunluğu|kesinlikle yeni müşteriye ihtiyacı/i);
  assert.match(allReasons, /bir çıkarım içermez/, "should explicitly disclaim the inference rather than silently omitting it");
});

test("computeHkDigitalNeedLevel: LOW is never forced — an UNKNOWN-eligible candidate stays UNKNOWN, not LOW", () => {
  const result = computeHkDigitalNeedLevel({
    hasWebsite: false, websiteScanFailed: true, instagramFound: false,
    metaPixelDetected: null, googleTagDetected: null, googleRating: null, reviewCount: 0
  });
  assert.notEqual(result.level, "LOW");
  assert.equal(result.level, "UNKNOWN");
});
