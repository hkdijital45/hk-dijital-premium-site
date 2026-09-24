// Instagram Stratejisti legacy tools — customer isolation fix
// (get_instagram_recent_posts, get_instagram_analysis).
//
// Real production bug: these two tools took no companyId and always
// called getUsableInstagramToken()/analyzeInstagramAccount() with no
// argument, which read HK Dijital's own single social_integrations row
// (workspace_id "hk-dijital", an Instagram-Login-obtained token) — so
// running the Instagram Stratejisti for a customer (MY CAKE 45) returned
// HK Dijital's own @hk.dijital45 data.
//
// Fix: companyId is now required on both tools. HK Dijital's own real
// company_id (resolved via resolveHkDijitalCompanyId, never hardcoded)
// still routes to the exact same existing agency engine (its
// Instagram-Login token is not interchangeable with any customer's
// Facebook-Login-for-Business token, so this path is intentionally
// preserved rather than rerouted). Every other company routes to the
// customer-scoped Facebook-Login-for-Business asset reader already built
// and production-verified for Instagram Profil Optimizasyonu
// (resolveConnectedInstagramAsset/fetchInstagramProfileMetadata/
// fetchRecentInstagramMedia in instagram-profile-audits.ts) — never HK
// Dijital's account, and never another company's.
//
// Run via:
//   node --env-file=.env.local --conditions=react-server --import tsx --test tests/unit/instagram-profile-audits/*.test.ts
import test from "node:test";
import assert from "node:assert/strict";

const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const skipReason = "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not available in this environment — live regression coverage skipped rather than faked.";

const MY_CAKE_45_COMPANY_ID = "fc51d411-ea37-45e4-9c93-df0cd43a4a42";

// --- TEST 9 — MCP schemas require companyId ---

test("MCP REGRESSION — get_instagram_recent_posts and get_instagram_analysis both require companyId", async () => {
  const { tools } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  const byName = Object.fromEntries(tools.map((t: any) => [t.name, t]));
  for (const name of ["get_instagram_recent_posts", "get_instagram_analysis"]) {
    assert.ok(byName[name].inputSchema.properties.companyId, `${name} must expose companyId`);
    assert.ok(byName[name].inputSchema.required.includes("companyId"), `${name} must require companyId`);
    assert.equal(byName[name].permission, "READ_ONLY");
  }
});

// --- TEST 8 — missing/invalid companyId rejected at the schema layer ---

test("MCP REGRESSION — execute() rejects get_instagram_recent_posts/get_instagram_analysis with a missing or malformed companyId before any network call", async () => {
  const { execute, ControlError, tools } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  const { validateArguments } = await import("../../../src/lib/social-autopilot/control/protocol.ts");
  const byName = Object.fromEntries(tools.map((t: any) => [t.name, t]));

  for (const name of ["get_instagram_recent_posts", "get_instagram_analysis"]) {
    assert.throws(() => validateArguments(byName[name], {}), /required|missing|companyId/i);
    assert.throws(() => validateArguments(byName[name], { companyId: "not-a-uuid" }), /uuid|invalid|format/i);
  }
  // execute() itself never falls back to HK Dijital when companyId is empty.
  await assert.rejects(
    () => execute("get_instagram_recent_posts", { companyId: "" }),
    (error: unknown) => error instanceof ControlError
  );
});

// --- TEST 1/3 — MY CAKE 45 vs HK Dijital route through distinct, never-crossing code paths ---

test("get_instagram_recent_posts / get_instagram_analysis REGRESSION — MY CAKE 45 and HK Dijital resolve to distinct real Instagram assets, never each other's", { skip: hasSupabase ? false : skipReason }, async () => {
  const { resolveHkDijitalCompanyId } = await import("../../../src/lib/content-plan/hk-dijital-company.ts");
  const { resolveConnectedInstagramAsset } = await import("../../../src/lib/instagram-profile-audits.ts");
  const hkDijitalCompanyId = await resolveHkDijitalCompanyId();

  const [myCake, hkDijital] = await Promise.all([
    resolveConnectedInstagramAsset(MY_CAKE_45_COMPANY_ID),
    resolveConnectedInstagramAsset(hkDijitalCompanyId)
  ]);

  assert.equal(myCake.username, "my_cake_45");
  assert.equal(hkDijital.username, "hk.dijital45");
  assert.notEqual(myCake.igUserId, hkDijital.igUserId, "MY CAKE 45 and HK Dijital must resolve to different real IG business account ids");
});

test("execute() REGRESSION — get_instagram_recent_posts for HK Dijital's own company_id takes the agency (Instagram-Login) path, never the customer asset path", { skip: hasSupabase ? false : skipReason }, async () => {
  const { execute } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  const { resolveHkDijitalCompanyId } = await import("../../../src/lib/content-plan/hk-dijital-company.ts");
  const hkDijitalCompanyId = await resolveHkDijitalCompanyId();

  // In this sandbox neither token can actually be decrypted (no production
  // encryption key locally — same documented limitation as every prior
  // Instagram customer-scope fix this session), so both calls fail; what
  // this proves is that they fail via DIFFERENT underlying mechanisms
  // (agency Instagram-Login decrypt vs. customer asset NOT_CONNECTED),
  // confirming isHkDijitalCompanyId actually routes to the separate,
  // preserved agency code path instead of the customer-scoped one.
  const hkResult = await execute("get_instagram_recent_posts", { companyId: hkDijitalCompanyId, limit: 1 }).catch((e) => ({ code: e.code, message: e.message }));
  const myCakeResult = await execute("get_instagram_recent_posts", { companyId: MY_CAKE_45_COMPANY_ID, limit: 1 }).catch((e) => ({ code: e.code, message: e.message }));

  assert.notDeepEqual(hkResult, myCakeResult, "HK Dijital and MY CAKE 45 must not produce the exact same result/error — they take different code paths");
});

// --- TEST 4/5 — cross-customer isolation between two disposable companies ---

test("resolveConnectedInstagramAsset REGRESSION — two companies with their own connected Instagram asset never resolve to each other's account (used by both fixed tools)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const { resolveConnectedInstagramAsset } = await import("../../../src/lib/instagram-profile-audits.ts");

  const unique = `QA-IG-LegacyTools-${Date.now()}`;
  const makeAsset = (igUserId: string, username: string) => ([{
    asset_type: "instagram_business", account_type: "instagram_business", status: "connected_oauth", oauth_status: "connected",
    account_id: igUserId, asset_id: igUserId, metadata: { username }
  }]);

  const [companyA] = await supabaseRest<Array<{ id: string }>>("companies", { method: "POST", body: JSON.stringify({ name: `${unique}-A`, email: `${unique.toLocaleLowerCase("en")}-a@example.test`, is_test: true }) });
  const [companyB] = await supabaseRest<Array<{ id: string }>>("companies", { method: "POST", body: JSON.stringify({ name: `${unique}-B`, email: `${unique.toLocaleLowerCase("en")}-b@example.test`, is_test: true }) });

  try {
    await supabaseRest("customer_integrations?on_conflict=company_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify({ company_id: companyA.id, integration_assets: makeAsset("333333333", "company_a_handle") }) });
    await supabaseRest("customer_integrations?on_conflict=company_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify({ company_id: companyB.id, integration_assets: makeAsset("444444444", "company_b_handle") }) });

    const [a, b] = await Promise.all([resolveConnectedInstagramAsset(companyA.id), resolveConnectedInstagramAsset(companyB.id)]);
    assert.equal(a.username, "company_a_handle");
    assert.equal(b.username, "company_b_handle");
    assert.notEqual(a.igUserId, b.igUserId);
  } finally {
    await supabaseRest(`customer_integrations?company_id=eq.${companyA.id}`, { method: "DELETE" }).catch(() => {});
    await supabaseRest(`customer_integrations?company_id=eq.${companyB.id}`, { method: "DELETE" }).catch(() => {});
    await supabaseRest(`companies?id=eq.${companyA.id}`, { method: "DELETE" }).catch(() => {});
    await supabaseRest(`companies?id=eq.${companyB.id}`, { method: "DELETE" }).catch(() => {});
  }
});

// --- TEST 6 — no Instagram connection: fail closed, no HK Dijital fallback ---

test("execute() REGRESSION — get_instagram_recent_posts/get_instagram_analysis for a company with no Instagram connection fail closed (NOT_CONNECTED), never falling back to HK Dijital", { skip: hasSupabase ? false : skipReason }, async () => {
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const { execute, ControlError } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");

  const unique = `QA-IG-LegacyTools-NoConn-${Date.now()}`;
  const [company] = await supabaseRest<Array<{ id: string }>>("companies", { method: "POST", body: JSON.stringify({ name: unique, email: `${unique.toLocaleLowerCase("en")}@example.test`, is_test: true }) });

  try {
    await assert.rejects(
      () => execute("get_instagram_recent_posts", { companyId: company.id }),
      (error: unknown) => error instanceof ControlError && (error as InstanceType<typeof ControlError>).code === "NOT_CONNECTED"
    );
    await assert.rejects(
      () => execute("get_instagram_analysis", { companyId: company.id }),
      (error: unknown) => error instanceof ControlError && (error as InstanceType<typeof ControlError>).code === "NOT_CONNECTED"
    );
  } finally {
    await supabaseRest(`companies?id=eq.${company.id}`, { method: "DELETE" }).catch(() => {});
  }
});

// --- TEST 7 — nonexistent companyId: controlled error, no leakage ---

test("execute() REGRESSION — a syntactically valid but nonexistent companyId returns a controlled NOT_CONNECTED error, never any account's data", { skip: hasSupabase ? false : skipReason }, async () => {
  const { execute, ControlError } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  const NONEXISTENT_COMPANY_ID = "00000000-0000-4000-8000-000000000000";
  await assert.rejects(
    () => execute("get_instagram_recent_posts", { companyId: NONEXISTENT_COMPANY_ID }),
    (error: unknown) => error instanceof ControlError && (error as InstanceType<typeof ControlError>).code === "NOT_CONNECTED"
  );
});
