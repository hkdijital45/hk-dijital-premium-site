// Final customer-scoped Instagram data fix — regression coverage.
//
// Real production bug: get_instagram_profile_audit_context only ever
// returned company/sector/location/website/username/connection-status —
// never actual Instagram profile metadata or recent media. Worse, the
// separate legacy tools (get_instagram_account/get_instagram_recent_posts/
// get_instagram_analysis) have no companyId input at all and always read
// HK Dijital's own single agency-level Instagram account (social_
// integrations, workspace_id "hk-dijital"), so a customer profile audit
// could never safely reuse them without risking cross-account data (e.g.
// MY CAKE 45's audit accidentally returning hk.dijital45's profile).
//
// Fix: getInstagramProfileAuditContext() now resolves each company's own
// OAuth-connected instagram_business asset (customer_integrations,
// scoped strictly by company_id, the same table/pattern already proven
// correct for Meta Ads account resolution — see
// tests/unit/marketing-intelligence/ad-accounts.test.ts) and reads real
// Graph API profile metadata + up to 12 recent media items through that
// company's own token. No new table, no new MCP tool, no changes to the
// legacy get_instagram_* tools.
//
// Run via:
//   node --env-file=.env.local --conditions=react-server --import tsx --test tests/unit/instagram-profile-audits/*.test.ts
import test from "node:test";
import assert from "node:assert/strict";

const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const skipReason = "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not available in this environment — live regression coverage skipped rather than faked.";

// Real, existing production company used to confirm this exact bug —
// read-only checks only (context reads), no data is created/modified/
// deleted. Same company id already used and confirmed in
// tests/unit/marketing-intelligence/ad-accounts.test.ts.
const MY_CAKE_45_COMPANY_ID = "fc51d411-ea37-45e4-9c93-df0cd43a4a42";

function withMockedFetch(handler: (url: URL) => { ok: boolean; status?: number; json: unknown }, run: () => Promise<void>) {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: unknown) => {
    const url = new URL(String(input));
    const result = handler(url);
    return { ok: result.ok, status: result.status ?? (result.ok ? 200 : 400), json: async () => result.json } as Response;
  }) as typeof globalThis.fetch;
  return run().finally(() => {
    globalThis.fetch = original;
  });
}

// --- TEST 1 + 2 — MY CAKE 45 company + Instagram asset resolution ---

test("resolveInstagramIdentity REGRESSION — MY CAKE 45 resolves its own real, OAuth-connected Instagram Business asset (never HK Dijital's agency account)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { resolveInstagramIdentity } = await import("../../../src/lib/instagram-profile-audits.ts");
  const identity = await resolveInstagramIdentity(MY_CAKE_45_COMPANY_ID);
  assert.equal(identity.source, "oauth");
  assert.equal(identity.username, "my_cake_45");
  assert.equal(identity.igUserId, "17841401837015122", "must resolve MY CAKE 45's own real IG business account id, not a fabricated or shared one");
  assert.notEqual(identity.username, "hk.dijital45", "must never resolve to HK Dijital's own agency Instagram account");
});

test("getInstagramProfileAuditContext REGRESSION — MY CAKE 45's context resolves the real company + real connected Instagram username via HK Connect", { skip: hasSupabase ? false : skipReason }, async () => {
  const { getInstagramProfileAuditContext } = await import("../../../src/lib/instagram-profile-audits.ts");
  const context = await getInstagramProfileAuditContext(MY_CAKE_45_COMPANY_ID);
  assert.equal(context.company.id, MY_CAKE_45_COMPANY_ID);
  assert.equal(context.company.name, "MY CAKE 45");
  assert.equal(context.instagram.username, "my_cake_45");
  assert.equal(context.instagram.usernameSource, "oauth");
  assert.equal(context.instagram.connectionStatus, "CONNECTED");
  assert.notEqual(context.instagram.username, "hk.dijital45");
  // Whatever the profile/recentMedia outcome (live Graph reachability
  // depends on this environment being able to decrypt/refresh the real
  // token — see API LIMITATIONS in the final report), it must never be
  // silently fabricated: either a real, tagged hk_connect_graph_api
  // result, or explicitly null/unavailable — never anything in between.
  if (context.instagram.profile) assert.equal(context.instagram.profile.source, "hk_connect_graph_api");
});

// --- TEST 3 — cross-account protection (critical) ---

test("getInstagramProfileAuditContext REGRESSION — cross-account protection: two companies each with their own connected Instagram asset never bleed into each other", { skip: hasSupabase ? false : skipReason }, async () => {
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const { getInstagramProfileAuditContext } = await import("../../../src/lib/instagram-profile-audits.ts");

  const unique = `QA-IG-CrossAccount-${Date.now()}`;
  const makeAsset = (igUserId: string, username: string) => ([{
    asset_type: "instagram_business", account_type: "instagram_business", status: "connected_oauth", oauth_status: "connected",
    account_id: igUserId, asset_id: igUserId, metadata: { username }
  }]);

  const [companyA] = await supabaseRest<Array<{ id: string }>>("companies", {
    method: "POST", body: JSON.stringify({ name: `${unique}-A`, email: `${unique.toLocaleLowerCase("en")}-a@example.test`, is_test: true })
  });
  const [companyB] = await supabaseRest<Array<{ id: string }>>("companies", {
    method: "POST", body: JSON.stringify({ name: `${unique}-B`, email: `${unique.toLocaleLowerCase("en")}-b@example.test`, is_test: true })
  });

  try {
    await supabaseRest("customer_integrations?on_conflict=company_id", {
      method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ company_id: companyA.id, integration_assets: makeAsset("111111111", "company_a_handle") })
    });
    await supabaseRest("customer_integrations?on_conflict=company_id", {
      method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ company_id: companyB.id, integration_assets: makeAsset("222222222", "company_b_handle") })
    });

    const [contextA, contextB] = await Promise.all([
      getInstagramProfileAuditContext(companyA.id),
      getInstagramProfileAuditContext(companyB.id)
    ]);

    assert.equal(contextA.instagram.username, "company_a_handle");
    assert.equal(contextB.instagram.username, "company_b_handle");
    assert.notEqual(contextA.instagram.username, contextB.instagram.username, "company A must never receive company B's Instagram identity or vice versa");
  } finally {
    await supabaseRest(`customer_integrations?company_id=eq.${companyA.id}`, { method: "DELETE" }).catch(() => {});
    await supabaseRest(`customer_integrations?company_id=eq.${companyB.id}`, { method: "DELETE" }).catch(() => {});
    await supabaseRest(`companies?id=eq.${companyA.id}`, { method: "DELETE" }).catch(() => {});
    await supabaseRest(`companies?id=eq.${companyB.id}`, { method: "DELETE" }).catch(() => {});
  }
});

// --- TEST 4 — profile metadata mapping (mocked Graph response) ---

test("fetchInstagramProfileMetadata: maps real Graph API fields and never fabricates a field the API didn't return", async () => {
  const { fetchInstagramProfileMetadata } = await import("../../../src/lib/instagram-profile-audits.ts");
  await withMockedFetch(
    () => ({ ok: true, json: { id: "17841401837015122", username: "my_cake_45", name: "My Cake 45", biography: "El yapımı butik pasta", followers_count: 4200, media_count: 87 } }),
    async () => {
      const profile = await fetchInstagramProfileMetadata("17841401837015122", "fake-token");
      assert.equal(profile.available, true);
      assert.equal(profile.source, "hk_connect_graph_api");
      assert.equal(profile.username, "my_cake_45");
      assert.equal(profile.biography, "El yapımı butik pasta");
      assert.equal(profile.followersCount, 4200);
      // Graph API did NOT return website/profile_picture_url/follows_count
      // in this response — TEST 5: must stay null, never fabricated.
      assert.equal(profile.website, null);
      assert.equal(profile.profilePictureUrl, null);
      assert.equal(profile.followsCount, null);
      assert.equal(profile.error, null);
    }
  );
});

// --- TEST 5 — API failure vs. missing field are distinguishable ---

test("fetchInstagramProfileMetadata REGRESSION — a Graph API failure (permission/expired) is reported as available:false with an error, never as fabricated empty fields treated as success", async () => {
  const { fetchInstagramProfileMetadata } = await import("../../../src/lib/instagram-profile-audits.ts");
  await withMockedFetch(
    () => ({ ok: false, status: 400, json: { error: { message: "Error validating access token: Session has expired.", code: 190 } } }),
    async () => {
      const profile = await fetchInstagramProfileMetadata("17841401837015122", "expired-token");
      assert.equal(profile.available, false);
      assert.notEqual(profile.error, null);
      assert.equal(profile.username, null);
      assert.equal(profile.biography, null);
    }
  );
});

// --- TEST 6 — recent media, customer-scoped + limited ---

test("fetchRecentInstagramMedia: reads recent media through the given IG user id, applies a 9-12 range limit, and never fabricates a caption/thumbnail the API omitted", async () => {
  const { fetchRecentInstagramMedia } = await import("../../../src/lib/instagram-profile-audits.ts");
  let requestedPath = "";
  let requestedLimit = "";
  await withMockedFetch(
    (url) => {
      requestedPath = url.pathname;
      requestedLimit = url.searchParams.get("limit") || "";
      return { ok: true, json: { data: [{ id: "m1", media_type: "IMAGE", timestamp: "2026-01-01T00:00:00+0000", permalink: "https://instagram.com/p/m1" }] } };
    },
    async () => {
      const media = await fetchRecentInstagramMedia("17841401837015122", "fake-token");
      assert.ok(Array.isArray(media));
      assert.match(requestedPath, /17841401837015122\/media/, "must query recent media for the resolved customer-scoped IG user id");
      assert.ok(Number(requestedLimit) >= 9 && Number(requestedLimit) <= 12, "recent media limit must stay within the 9-12 range required for profile-showcase purposes");
      assert.equal(media![0].id, "m1");
      assert.equal(media![0].caption, null, "Graph API omitted caption for this item — must stay null, never fabricated");
      assert.equal(media![0].thumbnailUrl, null);
    }
  );
});

test("fetchRecentInstagramMedia: returns null (not a fabricated empty list) when the underlying read fails", async () => {
  const { fetchRecentInstagramMedia } = await import("../../../src/lib/instagram-profile-audits.ts");
  await withMockedFetch(
    () => ({ ok: false, json: { error: { message: "Unsupported request" } } }),
    async () => {
      const media = await fetchRecentInstagramMedia("17841401837015122", "fake-token");
      assert.equal(media, null);
    }
  );
});

// --- TEST 7 — no Instagram connection ---

test("getInstagramProfileAuditContext REGRESSION — a company with no OAuth connection and no manual Instagram field gets a safe unavailable state, never fabricated profile data", { skip: hasSupabase ? false : skipReason }, async () => {
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const { getInstagramProfileAuditContext } = await import("../../../src/lib/instagram-profile-audits.ts");

  const unique = `QA-IG-NoConnection-${Date.now()}`;
  const [company] = await supabaseRest<Array<{ id: string }>>("companies", {
    method: "POST", body: JSON.stringify({ name: unique, email: `${unique.toLocaleLowerCase("en")}@example.test`, is_test: true })
  });

  try {
    const context = await getInstagramProfileAuditContext(company.id);
    assert.equal(context.instagram.username, null);
    assert.equal(context.instagram.usernameSource, "none");
    assert.equal(context.instagram.profile, null);
    assert.equal(context.instagram.recentMedia, null);
  } finally {
    await supabaseRest(`companies?id=eq.${company.id}`, { method: "DELETE" }).catch(() => {});
  }
});
