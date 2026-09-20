import test from "node:test";
import assert from "node:assert/strict";
import { ASSET_TYPE_TO_CAPABILITY, CONNECT_CAPABILITIES, META_CAPABILITIES, GOOGLE_CAPABILITIES, TIKTOK_CAPABILITIES } from "../../src/lib/connect-capabilities.ts";

// Regression test for the false-success bug: selecting only a GA4 property
// must resolve to exactly the "ga4" capability — never also "google_ads" or
// "search_console" — since that bundled-completion bug is exactly what let
// the public /connect page show "Bağlantılar tamamlandı ✓" while HK Connect
// still correctly reported Google Ads as unmapped.

test("ASSET_TYPE_TO_CAPABILITY: each Google/Meta asset type maps to exactly one, correct capability", () => {
  assert.equal(ASSET_TYPE_TO_CAPABILITY.ga4_property, "ga4");
  assert.equal(ASSET_TYPE_TO_CAPABILITY.google_ads_customer, "google_ads");
  assert.equal(ASSET_TYPE_TO_CAPABILITY.search_console_site, "search_console");
  assert.equal(ASSET_TYPE_TO_CAPABILITY.youtube_channel, "youtube");
  assert.equal(ASSET_TYPE_TO_CAPABILITY.facebook_page, "facebook");
  assert.equal(ASSET_TYPE_TO_CAPABILITY.instagram_business, "instagram");
  assert.equal(ASSET_TYPE_TO_CAPABILITY.meta_ad_account, "meta_ads");
});

test("ASSET_TYPE_TO_CAPABILITY: parent/profile-only asset types resolve to no capability", () => {
  assert.equal(ASSET_TYPE_TO_CAPABILITY.google_profile, undefined);
  assert.equal(ASSET_TYPE_TO_CAPABILITY.meta_business, undefined);
});

test("selecting only a GA4 property computes only the ga4 capability as complete, not the whole Google bundle", () => {
  const selectedAssetTypes = ["ga4_property"];
  const completed = Array.from(new Set(selectedAssetTypes.map((t) => ASSET_TYPE_TO_CAPABILITY[t]).filter(Boolean)));
  assert.deepEqual(completed, ["ga4"]);
  assert.ok(!completed.includes("google_ads"));
  assert.ok(!completed.includes("search_console"));
});

test("selecting a Google Ads customer and a GA4 property together completes exactly those two capabilities", () => {
  const selectedAssetTypes = ["google_ads_customer", "ga4_property"];
  const completed = Array.from(new Set(selectedAssetTypes.map((t) => ASSET_TYPE_TO_CAPABILITY[t]).filter(Boolean)));
  assert.deepEqual(completed.sort(), ["ga4", "google_ads"]);
  assert.ok(!completed.includes("search_console"));
});

test("CONNECT_CAPABILITIES includes tiktok and youtube, and the group constants agree with it", () => {
  assert.ok(CONNECT_CAPABILITIES.includes("tiktok"));
  assert.ok(CONNECT_CAPABILITIES.includes("youtube"));
  for (const cap of [...META_CAPABILITIES, ...GOOGLE_CAPABILITIES, ...TIKTOK_CAPABILITIES]) {
    assert.ok(CONNECT_CAPABILITIES.includes(cap), `${cap} should be a member of CONNECT_CAPABILITIES`);
  }
});
