import test from "node:test";
import assert from "node:assert/strict";
import { campaignKeyOf, distinctCampaigns, filterRowsToVerifiedCampaigns, platformOf, sharedCampaignKeys } from "../../src/lib/business-ad-scope-shared.ts";

// Isolated fixtures — synthetic campaign rows, no real ad accounts.
const ROWS = [
  { source: "Meta Ads", meta_campaign_id: "m-1", campaign_name: "Zirve Kayıt", spend: 100 },
  { source: "Meta Ads", meta_campaign_id: "m-2", campaign_name: "Robotik Atölye", spend: 50 },
  { source: "Google Ads", campaign_id: "m-1", campaign_name: "Google aynı id", spend: 70 },
  { source: "Meta Ads", campaign_name: "", spend: 5 }
];

test("no verified campaigns -> no rows (customer totals are never attributed to a business)", () => {
  assert.deepEqual(filterRowsToVerifiedCampaigns(ROWS, []), []);
});

test("only the verified campaign's rows are kept, and Meta/Google never mix even with the same id", () => {
  const rows = filterRowsToVerifiedCampaigns(ROWS, [{ platform: "meta", campaign_key: "m-1" }]);
  assert.deepEqual(rows.map((r) => r.campaign_name), ["Zirve Kayıt"]);
  const google = filterRowsToVerifiedCampaigns(ROWS, [{ platform: "google", campaign_key: "m-1" }]);
  assert.deepEqual(google.map((r) => r.campaign_name), ["Google aynı id"]);
});

test("wrong campaign for a business is excluded", () => {
  const robotik = filterRowsToVerifiedCampaigns(ROWS, [{ platform: "meta", campaign_key: "m-2" }]);
  assert.equal(robotik.some((r) => r.campaign_name === "Zirve Kayıt"), false);
});

test("shared ad account scenario: a campaign verified by two businesses is flagged as shared", () => {
  const all = [
    { business_unit_id: "u1", platform: "meta" as const, campaign_key: "m-1" },
    { business_unit_id: "u2", platform: "meta" as const, campaign_key: "m-1" },
    { business_unit_id: "u2", platform: "meta" as const, campaign_key: "m-2" }
  ];
  assert.deepEqual(sharedCampaignKeys(all.filter((l) => l.business_unit_id === "u2"), all, "u2"), ["meta:m-1"]);
  assert.deepEqual(sharedCampaignKeys(all.filter((l) => l.business_unit_id === "u1"), all, "u1"), ["meta:m-1"]);
});

test("campaign options come from real synced rows, keyed per platform", () => {
  assert.equal(platformOf({ source: "Google Ads" }), "google");
  assert.equal(campaignKeyOf({ campaign_name: "" }), "");
  assert.deepEqual(distinctCampaigns(ROWS).map((c) => `${c.platform}:${c.campaignKey}`), ["google:m-1", "meta:m-2", "meta:m-1"]);
  assert.equal(distinctCampaigns(ROWS).length, 3);
});
