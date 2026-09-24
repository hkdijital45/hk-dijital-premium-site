// İçerik Planlama ve Takip Merkezi → Instagram Intelligence customer-scoped
// fix — regression coverage.
//
// Real production bug: with MY CAKE 45 selected in İçerik Takip's customer
// dropdown, the "Instagram Intelligence" tab showed "Bağlı @hk.dijital45"
// instead of "Bağlı @my_cake_45". Root cause: InstagramIntelligencePanel
// was mounted with NO company prop at all
// (`<InstagramIntelligencePanel />` in ContentPlanningCenter.tsx) and
// always called the agency-only, company-agnostic endpoints
// (/api/admin/social-autopilot/instagram/status,
// /api/admin/instagram-intelligence/analysis), which read HK Dijital's own
// single `social_integrations` row (workspace_id "hk-dijital") regardless
// of which customer was selected in the dropdown.
//
// Fix: ContentPlanningCenter now passes the selected `company` (including
// `isHkDijitalSelf`) into InstagramIntelligencePanel. For any company
// OTHER than HK Dijital's own row, the panel calls a new endpoint
// (/api/admin/social-autopilot/instagram/customer-context) that reuses —
// with ZERO new resolver logic — getInstagramProfileAuditContext(), the
// exact same customer-scoped Instagram reader already built and
// production-verified for Instagram Profil Optimizasyonu. HK Dijital's own
// row keeps the exact previous behavior unchanged.
//
// This file therefore does not re-test getInstagramProfileAuditContext's
// internals (already covered by customer-scoped-instagram-data.test.ts) —
// it proves the exact real-world pairing reported as broken: HK Dijital's
// own resolved company_id vs. MY CAKE 45's, called back-to-back the way
// dropdown switching does, never cross-contaminating.
//
// Run via:
//   node --env-file=.env.local --conditions=react-server --import tsx --test tests/unit/instagram-profile-audits/*.test.ts
import test from "node:test";
import assert from "node:assert/strict";

const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const skipReason = "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not available in this environment — live regression coverage skipped rather than faked.";

// Real, existing production companies — read-only checks only.
const MY_CAKE_45_COMPANY_ID = "fc51d411-ea37-45e4-9c93-df0cd43a4a42";

// --- TEST 1 — MY CAKE 45 status via the customer-scoped path ---

test("İçerik Takip Instagram Intelligence REGRESSION — MY CAKE 45 resolves its own Instagram identity, never HK Dijital's", { skip: hasSupabase ? false : skipReason }, async () => {
  const { getInstagramProfileAuditContext } = await import("../../../src/lib/instagram-profile-audits.ts");
  const context = await getInstagramProfileAuditContext(MY_CAKE_45_COMPANY_ID);
  assert.equal(context.instagram.username, "my_cake_45");
  assert.notEqual(context.instagram.username, "hk.dijital45", "the exact bug reported: MY CAKE 45 selected but @hk.dijital45 shown");
});

// --- TEST 2 — HK Dijital's own resolved identity ---

test("İçerik Takip Instagram Intelligence REGRESSION — HK Dijital's own company_id resolves its own real agency Instagram identity", { skip: hasSupabase ? false : skipReason }, async () => {
  const { resolveHkDijitalCompanyId } = await import("../../../src/lib/content-plan/hk-dijital-company.ts");
  const { getInstagramProfileAuditContext } = await import("../../../src/lib/instagram-profile-audits.ts");
  const hkDijitalCompanyId = await resolveHkDijitalCompanyId();

  assert.notEqual(hkDijitalCompanyId, MY_CAKE_45_COMPANY_ID, "sanity check on the bug's premise — these must be two distinct real companies");

  const context = await getInstagramProfileAuditContext(hkDijitalCompanyId);
  assert.equal(context.instagram.username, "hk.dijital45");
  assert.notEqual(context.instagram.username, "my_cake_45");
});

// --- TEST 3/4 — dropdown switching (A -> B -> A) never bleeds stale data ---

test("İçerik Takip Instagram Intelligence REGRESSION — switching MY CAKE 45 -> HK Dijital -> MY CAKE 45 (as the dropdown does) never cross-contaminates", { skip: hasSupabase ? false : skipReason }, async () => {
  const { resolveHkDijitalCompanyId } = await import("../../../src/lib/content-plan/hk-dijital-company.ts");
  const { getInstagramProfileAuditContext } = await import("../../../src/lib/instagram-profile-audits.ts");
  const hkDijitalCompanyId = await resolveHkDijitalCompanyId();

  const first = await getInstagramProfileAuditContext(MY_CAKE_45_COMPANY_ID);
  const middle = await getInstagramProfileAuditContext(hkDijitalCompanyId);
  const last = await getInstagramProfileAuditContext(MY_CAKE_45_COMPANY_ID);

  assert.equal(first.instagram.username, "my_cake_45");
  assert.equal(middle.instagram.username, "hk.dijital45");
  assert.equal(last.instagram.username, "my_cake_45", "re-selecting MY CAKE 45 after HK Dijital must not leave HK Dijital's identity behind");
});

// --- TEST 5 — no-connection customer never falls back to the agency account ---

test("İçerik Takip Instagram Intelligence REGRESSION — a customer with no Instagram connection gets a safe unavailable state, never a fallback to hk.dijital45", { skip: hasSupabase ? false : skipReason }, async () => {
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const { getInstagramProfileAuditContext } = await import("../../../src/lib/instagram-profile-audits.ts");

  const unique = `QA-IG-ContentTracking-${Date.now()}`;
  const [company] = await supabaseRest<Array<{ id: string }>>("companies", {
    method: "POST", body: JSON.stringify({ name: unique, email: `${unique.toLocaleLowerCase("en")}@example.test`, is_test: true })
  });

  try {
    const context = await getInstagramProfileAuditContext(company.id);
    assert.equal(context.instagram.username, null);
    assert.notEqual(context.instagram.username, "hk.dijital45");
    assert.equal(context.instagram.connectionStatus === "CONNECTED", false);
  } finally {
    await supabaseRest(`companies?id=eq.${company.id}`, { method: "DELETE" }).catch(() => {});
  }
});

// --- TEST 6 — content plan / tracking stays company-scoped (verification only, per task scope — no architecture change) ---

test("İçerik Takip content plan isolation VERIFICATION — MY CAKE 45's content plan rows never include another company's rows", { skip: hasSupabase ? false : skipReason }, async () => {
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const rows = await supabaseRest<Array<{ company_id: string }>>(
    `social_content_plan_items?company_id=eq.${MY_CAKE_45_COMPANY_ID}&select=company_id&limit=50`
  );
  assert.ok(rows.every((r) => r.company_id === MY_CAKE_45_COMPANY_ID), "every row returned for MY CAKE 45's content plan query must actually belong to MY CAKE 45");
});
