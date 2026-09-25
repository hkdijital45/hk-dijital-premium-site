// Reklam Stratejisi durum yönetimi — HK Admin ↔ Claude MCP synchronization.
// Proves there is exactly ONE source of truth (the ad_strategies row's
// own `status` column, read/written by updateAdStrategyStatus for BOTH
// the HK Admin "Durumu Değiştir" control and the update_ads_strategy_status
// MCP tool) — no separate status table, no client-only shadow state, no
// polling/webhook needed since both sides hit the same row.
//
// Run via:
//   node --env-file=.env.local --conditions=react-server --import tsx --test tests/unit/marketing-intelligence/ad-strategy-status-sync.test.ts
import test from "node:test";
import assert from "node:assert/strict";

const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const skipReason = "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not available in this environment — live coverage skipped rather than faked.";

function baseStrategyInput(companyId: string) {
  return {
    companyId,
    dataSources: ["instagram", "meta_ads"],
    dataPeriod: { start: "2026-08-01", end: "2026-09-01" },
    confidence: "medium",
    businessSummary: "Butik pasta işletmesi için yerel farkındalık ve lead üretimi hedefleniyor, gerçek üretim testi.",
    metaStrategy: { recommended: true, rationale: "Instagram Direct üzerinden lead toplama uygun." },
    googleStrategy: { recommended: false, rationale: "Arama hacmi düşük, öncelik değil." },
    budget: { hasHistoricalPerformance: false, totalMonthlyRecommended: 15000, platformSplit: { meta: 100, google: 0 }, rationale: "Test bütçesi." },
    thirtyDayPlan: [{ phase: "Hafta 1-2", description: "Kreatif test ve öğrenme fazı." }]
  };
}

async function makeFixtureCompany(label: string) {
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const unique = `QA-AdStatusSync-${label}-${Date.now()}`;
  const [company] = await supabaseRest<Array<{ id: string }>>("companies", { method: "POST", body: JSON.stringify({ name: unique, email: `${unique.toLocaleLowerCase("en")}@example.test`, is_test: true }) });
  return company.id as string;
}

async function cleanup(companyId: string) {
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const { AD_STRATEGIES_TABLE } = await import("../../../src/lib/marketing-intelligence/ad-strategies.ts");
  await supabaseRest(`${AD_STRATEGIES_TABLE}?company_id=eq.${companyId}`, { method: "DELETE" }).catch(() => {});
  await supabaseRest(`companies?id=eq.${companyId}`, { method: "DELETE" }).catch(() => {});
}

// --- TEST 2/3/4/5/6/7 — HK-Admin-style pure status change draft->active ---

test("TEST 2-7 — a pure status change (draft -> active, simulating HK Admin's Durumu Değiştir control) preserves id/version/content and never reverts to 'updated' (requires ad_strategies migration)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const { saveAdStrategyDraft, updateAdStrategyStatus, AD_STRATEGIES_TABLE } = await import("../../../src/lib/marketing-intelligence/ad-strategies.ts");
  const companyId = await makeFixtureCompany("PureStatus");
  try {
    const created = await saveAdStrategyDraft(baseStrategyInput(companyId));
    assert.equal(created.status, "draft");

    const rowsBefore = await supabaseRest<Array<{ id: string }>>(`${AD_STRATEGIES_TABLE}?company_id=eq.${companyId}&select=id`);

    // TEST 2 — draft -> active directly (no forced intermediate "approved").
    const activated = await updateAdStrategyStatus(companyId, created.id, "active");

    // TEST 3 — same row id.
    assert.equal(activated.id, created.id);
    // TEST 4 — version unchanged.
    assert.equal(activated.version, created.version);
    // TEST 5 — no new row created.
    const rowsAfter = await supabaseRest<Array<{ id: string }>>(`${AD_STRATEGIES_TABLE}?company_id=eq.${companyId}&select=id`);
    assert.equal(rowsAfter.length, rowsBefore.length);
    // TEST 6 — content fields (campaign_sequence/budget/reports/payload) untouched.
    assert.deepEqual(activated.campaign_sequence, created.campaign_sequence);
    assert.equal(activated.monthly_ad_budget, created.monthly_ad_budget);
    assert.deepEqual(activated.internal_report, created.internal_report);
    assert.deepEqual(activated.client_report, created.client_report);
    assert.deepEqual(activated.full_strategy_payload, created.full_strategy_payload);
    // TEST 7 — status is exactly "active", never silently reverted to "updated".
    assert.equal(activated.status, "active");
    assert.ok(activated.activated_at);
  } finally {
    await cleanup(companyId);
  }
});

// --- TEST 8 — real content update still triggers the existing "updated" rule ---

test("TEST 8 — a genuine content update on an ACTIVE strategy still marks it UPDATED (the existing rule is untouched by the new status control)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { saveAdStrategyDraft, updateAdStrategyStatus, updateAdStrategy, validateAdStrategyPatch } = await import("../../../src/lib/marketing-intelligence/ad-strategies.ts");
  const companyId = await makeFixtureCompany("ContentRule");
  try {
    const created = await saveAdStrategyDraft(baseStrategyInput(companyId));
    await updateAdStrategyStatus(companyId, created.id, "active");
    const patch = validateAdStrategyPatch({ primary_goal: "Yeni gerçek hedef" });
    const edited = await updateAdStrategy(companyId, created.id, patch);
    assert.equal(edited.status, "updated", "editing content on an active strategy must still auto-mark it updated — unchanged existing rule");
  } finally {
    await cleanup(companyId);
  }
});

// --- TEST 9 — Claude MCP read path sees an HK-Admin-style status change ---

test("TEST 9 — Claude MCP's read path (getAdStrategyForActivation) sees a status change made the same way HK Admin's control makes it — same row, no polling/sync job needed", { skip: hasSupabase ? false : skipReason }, async () => {
  const { saveAdStrategyDraft, updateAdStrategyStatus, getAdStrategyForActivation } = await import("../../../src/lib/marketing-intelligence/ad-strategies.ts");
  const companyId = await makeFixtureCompany("McpRead");
  try {
    const created = await saveAdStrategyDraft(baseStrategyInput(companyId));
    const beforeActivation = await getAdStrategyForActivation(companyId);
    assert.equal(beforeActivation.strategy, null, "a bare draft is not yet usable for Meta/Google setup");

    await updateAdStrategyStatus(companyId, created.id, "active"); // "HK Admin" side
    const afterActivation = await getAdStrategyForActivation(companyId); // "Claude MCP" side
    assert.equal(afterActivation.strategy?.id, created.id);
    assert.equal(afterActivation.strategy?.status, "active");
  } finally {
    await cleanup(companyId);
  }
});

// --- Reverse direction: "Claude MCP" changes status, "HK Admin" re-read sees it ---

test("Reverse sync — a status change made via updateAdStrategyStatus (the same function the MCP tool calls) is immediately visible to a fresh getAdStrategyById read (simulating HK Admin's page refresh/GET)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { saveAdStrategyDraft, updateAdStrategyStatus, getAdStrategyById } = await import("../../../src/lib/marketing-intelligence/ad-strategies.ts");
  const companyId = await makeFixtureCompany("ReverseSync");
  try {
    const created = await saveAdStrategyDraft(baseStrategyInput(companyId));
    await updateAdStrategyStatus(companyId, created.id, "approved"); // "Claude MCP" side
    const rereadAfterRefresh = await getAdStrategyById(companyId, created.id); // "HK Admin" GET on page refresh
    assert.equal(rereadAfterRefresh.status, "approved", "a fresh read must reflect backend truth — no separate client/shadow state exists to diverge");
  } finally {
    await cleanup(companyId);
  }
});

// --- TEST 10 — archiving unaffected ---

test("TEST 10 — archiving via the status control still works and is correctly excluded from getAdStrategyForActivation (requires ad_strategies migration)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { saveAdStrategyDraft, updateAdStrategyStatus, getAdStrategyForActivation } = await import("../../../src/lib/marketing-intelligence/ad-strategies.ts");
  const companyId = await makeFixtureCompany("Archive");
  try {
    const created = await saveAdStrategyDraft(baseStrategyInput(companyId));
    await updateAdStrategyStatus(companyId, created.id, "active");
    const archived = await updateAdStrategyStatus(companyId, created.id, "archived");
    assert.equal(archived.status, "archived");
    assert.ok(archived.archived_at);
    const activation = await getAdStrategyForActivation(companyId);
    assert.equal(activation.strategy, null, "an archived-only company must never be offered for Meta/Google setup");
  } finally {
    await cleanup(companyId);
  }
});

// --- Security: cross-company status change rejected ---

test("Cross-company status change is rejected — company B cannot change company A's strategy status (requires ad_strategies migration)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { saveAdStrategyDraft, updateAdStrategyStatus, AdStrategyNotFoundError } = await import("../../../src/lib/marketing-intelligence/ad-strategies.ts");
  const companyA = await makeFixtureCompany("SecA");
  const companyB = await makeFixtureCompany("SecB");
  try {
    const created = await saveAdStrategyDraft(baseStrategyInput(companyA));
    await assert.rejects(() => updateAdStrategyStatus(companyB, created.id, "archived"), AdStrategyNotFoundError);
  } finally {
    await cleanup(companyA);
    await cleanup(companyB);
  }
});

// --- HK Admin PATCH route must never be used for a pure status change (architecture check) ---

test("ARCHITECTURE — the admin content-patch validator (validateAdStrategyPatch) rejects a 'status' field outright, so a pure status change can only go through the dedicated status endpoint/tool", async () => {
  const { validateAdStrategyPatch, AdStrategyPatchValidationError } = await import("../../../src/lib/marketing-intelligence/ad-strategies.ts");
  assert.throws(() => validateAdStrategyPatch({ status: "active" }), AdStrategyPatchValidationError);
});
