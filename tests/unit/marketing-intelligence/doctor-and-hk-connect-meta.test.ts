// Task A — Reklam Doktoru (ad-insights.ts) canonical Meta aggregation
// regression (same dedup rule as ad-evaluations.ts's buildMetricsSnapshot,
// reused via meta-metrics-aggregation.ts's dedupeMetaMetricSnapshots).
// Task B — HK Connect customer Meta identity resolver
// (resolveHkConnectMetaIdentity in ad-accounts.ts).
// Run via:
//   node --env-file=.env.local --conditions=react-server --import tsx --test tests/unit/marketing-intelligence/doctor-and-hk-connect-meta.test.ts
import test from "node:test";
import assert from "node:assert/strict";

const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const skipReason = "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not available in this environment — live coverage skipped rather than faked.";

async function makeFixtureCompany(label: string) {
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const unique = `QA-DoctorHkConnect-${label}-${Date.now()}`;
  const [company] = await supabaseRest<Array<{ id: string }>>("companies", { method: "POST", body: JSON.stringify({ name: unique, email: `${unique.toLocaleLowerCase("en")}@example.test`, is_test: true }) });
  return company.id as string;
}

async function cleanup(companyId: string) {
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  await supabaseRest(`campaign_metrics?company_id=eq.${companyId}`, { method: "DELETE" }).catch(() => {});
  await supabaseRest(`customer_integrations?company_id=eq.${companyId}`, { method: "DELETE" }).catch(() => {});
  await supabaseRest(`companies?id=eq.${companyId}`, { method: "DELETE" }).catch(() => {});
}

// --- Task A: Reklam Doktoru canonical aggregation ---

test("getAdInsightsData REGRESSION — two cumulative snapshots for the same campaign+period collapse to the LATEST value, never summed (spend/impressions/reach/clicks/messages not doubled)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { getAdInsightsData } = await import("../../../src/lib/ad-insights.ts");
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const companyId = await makeFixtureCompany("DoubleCount");
  try {
    const today = new Date().toISOString().slice(0, 10);
    const metaCampaignId = `doctor-meta-${Date.now()}`;
    const older = { company_id: companyId, meta_campaign_id: metaCampaignId, date: today, date_range_label: "Son 30 Gün", spend: 174.48, results: 5, messages: 5, leads: 5, conversions: 5, reach: 1554, impressions: 2182, clicks: 19, raw_data: { leads: 0, purchases: 0 } };
    const newer = { company_id: companyId, meta_campaign_id: metaCampaignId, date: today, date_range_label: "Son 30 Gün", spend: 177.19, results: 5, messages: 5, leads: 5, conversions: 5, reach: 1588, impressions: 2229, clicks: 19, raw_data: { leads: 0, purchases: 0 } };
    await supabaseRest("campaign_metrics", { method: "POST", body: JSON.stringify(older) });
    // created_at is server-assigned; this row is inserted after the first,
    // so it will carry a later created_at and win the dedup.
    await supabaseRest("campaign_metrics", { method: "POST", body: JSON.stringify(newer) });

    const data = await getAdInsightsData({ companyId, range: "last_30d" });
    assert.equal(data.metrics.spend, 177.19, "must be the latest snapshot's spend, never 351.67");
    assert.equal(data.metrics.impressions, 2229, "must never be ~2x (4411)");
    assert.equal(data.metrics.reach, 1588, "must never be ~2x (3142)");
    assert.equal(data.metrics.clicks, 19, "must never be ~2x (38)");
    assert.equal(data.metrics.messages, 5, "must never be ~2x (10)");
  } finally {
    await cleanup(companyId);
  }
});

test("getAdInsightsData REGRESSION — leads/conversions reflect Meta's real raw_data action counts, never the messages-fallback column value", { skip: hasSupabase ? false : skipReason }, async () => {
  const { getAdInsightsData } = await import("../../../src/lib/ad-insights.ts");
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const companyId = await makeFixtureCompany("LeadSemantics");
  try {
    const today = new Date().toISOString().slice(0, 10);
    // Simulates the sync writer's own fallback behavior: leads/conversions
    // columns mirror messages (5) because Meta reported no distinct lead/
    // purchase action, but raw_data preserves the true, separate values.
    const row = { company_id: companyId, meta_campaign_id: `lead-${Date.now()}`, date: today, date_range_label: "Son 30 Gün", spend: 100, messages: 5, leads: 5, conversions: 5, results: 5, reach: 500, impressions: 1000, clicks: 10, raw_data: { leads: 0, purchases: 0 } };
    await supabaseRest("campaign_metrics", { method: "POST", body: JSON.stringify(row) });

    const data = await getAdInsightsData({ companyId, range: "last_30d" });
    assert.equal(data.metrics.messages, 5, "real messaging result");
    assert.equal(data.metrics.leads, 0, "must reflect Meta's real 0 lead actions, not the messages-fallback value of 5");
    assert.equal(data.metrics.conversions, 0, "must reflect Meta's real 0 purchase actions, not the messages-fallback value of 5");
  } finally {
    await cleanup(companyId);
  }
});

test("getAdInsightsData REGRESSION — Reklam Doktoru's click family is explicitly link-click-based, never silently relabeled as all-clicks", { skip: hasSupabase ? false : skipReason }, async () => {
  const { getAdInsightsData } = await import("../../../src/lib/ad-insights.ts");
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const companyId = await makeFixtureCompany("ClickSemantics");
  try {
    const today = new Date().toISOString().slice(0, 10);
    const row = { company_id: companyId, meta_campaign_id: `click-${Date.now()}`, date: today, date_range_label: "Son 30 Gün", spend: 177.19, impressions: 2229, clicks: 19, ctr: 3.185285, cpc: 2.495634, reach: 1588 };
    await supabaseRest("campaign_metrics", { method: "POST", body: JSON.stringify(row) });

    const data = await getAdInsightsData({ companyId, range: "last_30d" });
    assert.equal(data.metrics.linkClicks, 19);
    assert.equal(data.metrics.clicksAll, 71, "the true all-click count must be recovered, not left equal to the link-click count");
    assert.notEqual(data.metrics.ctr, data.metrics.ctrAll, "the displayed Doctor ctr (link-based) must differ from the genuine all-click ctrAll — they are not the same metric");
  } finally {
    await cleanup(companyId);
  }
});

test("getAdInsightsData REGRESSION — a brand-new campaign with no prior-period rows shows 'insufficient comparison data', never a fabricated +100% trend", { skip: hasSupabase ? false : skipReason }, async () => {
  const { getAdInsightsData } = await import("../../../src/lib/ad-insights.ts");
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const companyId = await makeFixtureCompany("NoTrendBaseline");
  try {
    const today = new Date().toISOString().slice(0, 10);
    await supabaseRest("campaign_metrics", { method: "POST", body: JSON.stringify({ company_id: companyId, meta_campaign_id: `trend-${Date.now()}`, date: today, date_range_label: "Son 30 Gün", spend: 100, messages: 5, reach: 500, impressions: 1000, clicks: 10 }) });

    const data = await getAdInsightsData({ companyId, range: "last_30d" });
    assert.deepEqual(data.trendAnalysis.rules, ["Karşılaştırma için yeterli geçmiş veri yok."]);
    assert.equal(data.weeklyChange.spend, null, "must never fabricate +100% when there is no real previous period to compare");
  } finally {
    await cleanup(companyId);
  }
});

test("getAdInsightsData REGRESSION — cross-company isolation is preserved by the dedup/aggregation fix", { skip: hasSupabase ? false : skipReason }, async () => {
  const { getAdInsightsData } = await import("../../../src/lib/ad-insights.ts");
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const companyA = await makeFixtureCompany("IsoDoctorA");
  const companyB = await makeFixtureCompany("IsoDoctorB");
  try {
    const today = new Date().toISOString().slice(0, 10);
    await supabaseRest("campaign_metrics", { method: "POST", body: JSON.stringify({ company_id: companyA, meta_campaign_id: `iso-${Date.now()}`, date: today, date_range_label: "Son 30 Gün", spend: 500, messages: 20 }) });
    const dataB = await getAdInsightsData({ companyId: companyB, range: "last_30d" });
    assert.notEqual(dataB.metrics.spend, 500, "company B must never see company A's campaign_metrics rows");
  } finally {
    await cleanup(companyA);
    await cleanup(companyB);
  }
});

// --- Task B: HK Connect customer Meta identity ---

const SAMPLE_ASSETS = [
  { provider: "meta", platform: "meta", asset_type: "meta_business", account_type: "meta_business", provider_account_id: "biz-123", status: "connected_oauth", last_synced_at: "2026-10-01T10:00:00Z" },
  { provider: "meta", platform: "meta", asset_type: "meta_ad_account", account_type: "meta_ad_account", provider_account_id: "act_999", status: "connected_oauth", last_synced_at: "2026-10-01T10:05:00Z" },
  { provider: "meta", platform: "facebook", asset_type: "facebook_page", account_type: "facebook_page", provider_account_id: "page-456", status: "connected_oauth", last_synced_at: "2026-10-01T10:10:00Z" },
  { provider: "meta", platform: "instagram", asset_type: "instagram_business", account_type: "instagram_business", provider_account_id: "ig-789", status: "connected_oauth", last_synced_at: "2026-10-01T10:15:00Z" }
];

test("resolveHkConnectMetaIdentity: maps real connected assets by type, never fabricates pixel/dataset", { skip: hasSupabase ? false : skipReason }, async () => {
  const { resolveHkConnectMetaIdentity } = await import("../../../src/lib/marketing-intelligence/ad-accounts.ts");
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const companyId = await makeFixtureCompany("MapAssets");
  try {
    await supabaseRest("customer_integrations", { method: "POST", body: JSON.stringify({ company_id: companyId, integration_assets: SAMPLE_ASSETS, access_token_encrypted: "irrelevant-ciphertext", token_expires_at: new Date(Date.now() + 86400000).toISOString() }) });
    const identity = await resolveHkConnectMetaIdentity(companyId);
    assert.equal(identity.connected, true);
    assert.equal(identity.businessId, "biz-123");
    assert.equal(identity.adAccountId, "act_999");
    assert.equal(identity.pageId, "page-456");
    assert.equal(identity.instagramBusinessId, "ig-789");
    assert.equal(identity.pixelAvailable, false);
    assert.equal(identity.datasetAvailable, false);
    assert.equal(identity.tokenStatus, "connected");
    assert.ok(identity.lastSyncedAt);
  } finally {
    await cleanup(companyId);
  }
});

test("resolveHkConnectMetaIdentity: missing fields stay null, never fabricated — a company with no HK Connect row at all", { skip: hasSupabase ? false : skipReason }, async () => {
  const { resolveHkConnectMetaIdentity } = await import("../../../src/lib/marketing-intelligence/ad-accounts.ts");
  const companyId = await makeFixtureCompany("NoConnect");
  try {
    const identity = await resolveHkConnectMetaIdentity(companyId);
    assert.equal(identity.connected, false);
    assert.equal(identity.businessId, null);
    assert.equal(identity.adAccountId, null);
    assert.equal(identity.pageId, null);
    assert.equal(identity.instagramBusinessId, null);
    assert.equal(identity.tokenStatus, "not_connected");
  } finally {
    await cleanup(companyId);
  }
});

test("resolveHkConnectMetaIdentity: cross-company isolation — company B never resolves company A's connection", { skip: hasSupabase ? false : skipReason }, async () => {
  const { resolveHkConnectMetaIdentity } = await import("../../../src/lib/marketing-intelligence/ad-accounts.ts");
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const companyA = await makeFixtureCompany("OwnerA");
  const companyB = await makeFixtureCompany("OwnerB");
  try {
    await supabaseRest("customer_integrations", { method: "POST", body: JSON.stringify({ company_id: companyA, integration_assets: SAMPLE_ASSETS }) });
    const identityB = await resolveHkConnectMetaIdentity(companyB);
    assert.equal(identityB.connected, false, "company B must never see company A's connected assets");
    assert.equal(identityB.adAccountId, null);
  } finally {
    await cleanup(companyA);
    await cleanup(companyB);
  }
});

test("resolveHkConnectMetaIdentity: multiple connected ad accounts never cause random assignment — first is used and reported as ambiguous", { skip: hasSupabase ? false : skipReason }, async () => {
  const { resolveHkConnectMetaIdentity } = await import("../../../src/lib/marketing-intelligence/ad-accounts.ts");
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const companyId = await makeFixtureCompany("MultiAccount");
  try {
    const assets = [
      ...SAMPLE_ASSETS,
      { provider: "meta", platform: "meta", asset_type: "meta_ad_account", account_type: "meta_ad_account", provider_account_id: "act_second", status: "connected_oauth" }
    ];
    await supabaseRest("customer_integrations", { method: "POST", body: JSON.stringify({ company_id: companyId, integration_assets: assets }) });
    const identity = await resolveHkConnectMetaIdentity(companyId);
    assert.equal(identity.adAccountId, "act_999", "must deterministically use the first connected asset, never a random one");
    assert.equal(identity.multipleAdAccounts, true, "ambiguity must be reported, not silently hidden");
  } finally {
    await cleanup(companyId);
  }
});

test("resolveHkConnectMetaIdentity: expired token is reported as 'expired', never as 'connected'", { skip: hasSupabase ? false : skipReason }, async () => {
  const { resolveHkConnectMetaIdentity } = await import("../../../src/lib/marketing-intelligence/ad-accounts.ts");
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const companyId = await makeFixtureCompany("ExpiredToken");
  try {
    await supabaseRest("customer_integrations", { method: "POST", body: JSON.stringify({ company_id: companyId, integration_assets: SAMPLE_ASSETS, access_token_encrypted: "irrelevant-ciphertext", token_expires_at: new Date(Date.now() - 86400000).toISOString() }) });
    const identity = await resolveHkConnectMetaIdentity(companyId);
    assert.equal(identity.tokenStatus, "expired");
  } finally {
    await cleanup(companyId);
  }
});

test("HK Connect Meta route: never returns the raw access token field", { skip: hasSupabase ? false : skipReason }, async () => {
  const { resolveHkConnectMetaIdentity } = await import("../../../src/lib/marketing-intelligence/ad-accounts.ts");
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const companyId = await makeFixtureCompany("NoTokenLeak");
  try {
    await supabaseRest("customer_integrations", { method: "POST", body: JSON.stringify({ company_id: companyId, integration_assets: SAMPLE_ASSETS, access_token_encrypted: "super-secret-ciphertext-value" }) });
    const identity = await resolveHkConnectMetaIdentity(companyId);
    const serialized = JSON.stringify(identity);
    assert.ok(!serialized.includes("super-secret-ciphertext-value"), "the encrypted token value must never appear in the identity payload");
    assert.ok(!("accessToken" in identity), "no token field of any kind in the identity object");
  } finally {
    await cleanup(companyId);
  }
});

test("PRODUCTION SAFETY — MY CAKE 45's real ad_strategies record is unaffected by this suite", { skip: hasSupabase ? false : skipReason }, async () => {
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const rows = await supabaseRest<Array<{ id: string; version: number }>>("ad_strategies?id=eq.f0861d43-fd8f-44d9-9d02-00f1c581af3d&select=id,version");
  if (rows.length) assert.equal(rows[0].version, 1);
});
