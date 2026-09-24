// HK Instagram Stratejisti / İçerik Takip MCP tools — customer isolation
// fix (get_content_tracking_history, get_upcoming_content_plan,
// create_content_plan).
//
// Real production bug: none of these three MCP tools accepted a
// companyId. get_content_tracking_history/get_upcoming_content_plan
// (fetchPlanRows in protocol.ts) and create_content_plan
// (createContentPlanItems in instagram-intelligence/plan.ts) always
// resolved and used HK Dijital's own company_id internally
// (resolveHkDijitalCompanyId()), so running the Instagram Stratejisti
// workflow for MY CAKE 45 saw HK Dijital's own 11 upcoming items and had
// no way to guarantee a new plan would be written to MY CAKE 45 instead
// of HK Dijital.
//
// Fix: companyId is now a REQUIRED MCP tool argument for all three tools.
// fetchContentPlanRows/createContentPlanItems (instagram-intelligence/
// plan.ts) both require an explicit companyId and validate it against a
// real public.companies row via one shared assertCompanyExists() gate
// before any read or write — no implicit HK Dijital (or any other)
// fallback exists anywhere in this path any more. HK Dijital's own
// Instagram Intelligence admin route (/api/admin/instagram-intelligence/
// plan) now explicitly resolves and passes its own real companyId itself.
//
// Run via:
//   node --env-file=.env.local --conditions=react-server --import tsx --test tests/unit/instagram-profile-audits/*.test.ts
import test from "node:test";
import assert from "node:assert/strict";

const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const skipReason = "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not available in this environment — live regression coverage skipped rather than faked.";

// Real, existing production company — read-only checks only (this suite
// never calls create_content_plan against it, per the task's explicit
// "do not touch MY CAKE 45's real 13-item plan" instruction).
const MY_CAKE_45_COMPANY_ID = "fc51d411-ea37-45e4-9c93-df0cd43a4a42";
const NONEXISTENT_COMPANY_ID = "00000000-0000-4000-8000-000000000000";

// --- TEST 1/2 — MY CAKE 45 history + upcoming, customer-scoped ---

test("fetchContentPlanRows REGRESSION — MY CAKE 45's upcoming plan never includes HK Dijital's own rows", { skip: hasSupabase ? false : skipReason }, async () => {
  const { fetchContentPlanRows } = await import("../../../src/lib/instagram-intelligence/plan.ts");
  const { resolveHkDijitalCompanyId } = await import("../../../src/lib/content-plan/hk-dijital-company.ts");

  const hkDijitalCompanyId = await resolveHkDijitalCompanyId();
  assert.notEqual(hkDijitalCompanyId, MY_CAKE_45_COMPANY_ID, "sanity check — these must be two distinct real companies");

  const myCakeUpcoming = await fetchContentPlanRows("upcoming", MY_CAKE_45_COMPANY_ID, 20);
  assert.ok(myCakeUpcoming.every((row) => row.company_id === MY_CAKE_45_COMPANY_ID), "every row returned for MY CAKE 45 must actually belong to MY CAKE 45");

  const myCakeHistory = await fetchContentPlanRows("history", MY_CAKE_45_COMPANY_ID, 20);
  assert.ok(myCakeHistory.every((row) => row.company_id === MY_CAKE_45_COMPANY_ID));
});

// --- TEST 3 — HK Dijital's own agency workflow is unaffected ---

test("fetchContentPlanRows REGRESSION — HK Dijital's own real company_id still returns its own upcoming/history rows (agency workflow unbroken)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { fetchContentPlanRows } = await import("../../../src/lib/instagram-intelligence/plan.ts");
  const { resolveHkDijitalCompanyId } = await import("../../../src/lib/content-plan/hk-dijital-company.ts");
  const hkDijitalCompanyId = await resolveHkDijitalCompanyId();

  const upcoming = await fetchContentPlanRows("upcoming", hkDijitalCompanyId, 20);
  assert.ok(upcoming.every((row) => row.company_id === hkDijitalCompanyId));
  assert.ok(!upcoming.some((row) => row.company_id === MY_CAKE_45_COMPANY_ID), "HK Dijital's own read must never include MY CAKE 45's rows");
});

// --- TEST 4 — cross-customer isolation, explicit pairing ---

test("fetchContentPlanRows REGRESSION — cross-customer read isolation: MY CAKE 45's query and HK Dijital's query never leak into each other", { skip: hasSupabase ? false : skipReason }, async () => {
  const { fetchContentPlanRows } = await import("../../../src/lib/instagram-intelligence/plan.ts");
  const { resolveHkDijitalCompanyId } = await import("../../../src/lib/content-plan/hk-dijital-company.ts");
  const hkDijitalCompanyId = await resolveHkDijitalCompanyId();

  const [myCake, hkDijital] = await Promise.all([
    fetchContentPlanRows("upcoming", MY_CAKE_45_COMPANY_ID, 20),
    fetchContentPlanRows("upcoming", hkDijitalCompanyId, 20)
  ]);
  const myCakeIds = new Set(myCake.map((r) => r.id));
  const hkDijitalIds = new Set(hkDijital.map((r) => r.id));
  assert.equal([...myCakeIds].some((id) => hkDijitalIds.has(id)), false, "no row id may appear in both companies' result sets");
});

// --- TEST 5 — create_content_plan writes only to the supplied companyId (disposable fixture, never real MY CAKE 45 data) ---

test("createContentPlanItems REGRESSION — every inserted row's company_id is exactly the supplied companyId, and it is cleaned up after the test", { skip: hasSupabase ? false : skipReason }, async () => {
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const { createContentPlanItems } = await import("../../../src/lib/instagram-intelligence/plan.ts");
  const { CONTENT_PLAN_TABLE } = await import("../../../src/lib/content-plan/types.ts");

  const unique = `QA-ContentPlan-${Date.now()}`;
  const [company] = await supabaseRest<Array<{ id: string }>>("companies", {
    method: "POST", body: JSON.stringify({ name: unique, email: `${unique.toLocaleLowerCase("en")}@example.test`, is_test: true })
  });

  try {
    const result = await createContentPlanItems(
      [{ scheduled_date: "2027-01-01", topic: `${unique} — konu`, theme: "test" }],
      company.id
    );
    assert.equal(result.inserted, 1);
    assert.equal(result.items[0].company_id, company.id);

    const rows = await supabaseRest<Array<{ company_id: string }>>(`${CONTENT_PLAN_TABLE}?company_id=eq.${company.id}&select=company_id`);
    assert.equal(rows.length, 1);
    assert.ok(rows.every((r) => r.company_id === company.id), "no row may have been written to any company other than the one supplied");
  } finally {
    await supabaseRest(`${CONTENT_PLAN_TABLE}?company_id=eq.${company.id}`, { method: "DELETE" }).catch(() => {});
    await supabaseRest(`companies?id=eq.${company.id}`, { method: "DELETE" }).catch(() => {});
  }
});

// --- TEST 6 — missing companyId fails closed, no HK Dijital fallback ---

test("assertCompanyExists / createContentPlanItems REGRESSION — a missing companyId is rejected before any read or write, never falls back to HK Dijital", async () => {
  const { createContentPlanItems, ContentPlanCompanyNotFoundError } = await import("../../../src/lib/instagram-intelligence/plan.ts");
  await assert.rejects(
    () => createContentPlanItems([{ scheduled_date: "2027-01-01", topic: "x" }], "" as unknown as string),
    ContentPlanCompanyNotFoundError
  );
  await assert.rejects(
    () => createContentPlanItems([{ scheduled_date: "2027-01-01", topic: "x" }], undefined as unknown as string),
    ContentPlanCompanyNotFoundError
  );
});

// --- TEST 7 — invalid/nonexistent companyId: no write, no read leakage, explicit error ---

test("createContentPlanItems REGRESSION — a syntactically valid but nonexistent companyId writes nothing and throws ContentPlanCompanyNotFoundError", { skip: hasSupabase ? false : skipReason }, async () => {
  const { createContentPlanItems, ContentPlanCompanyNotFoundError } = await import("../../../src/lib/instagram-intelligence/plan.ts");
  await assert.rejects(
    () => createContentPlanItems([{ scheduled_date: "2027-01-01", topic: "x" }], NONEXISTENT_COMPANY_ID),
    ContentPlanCompanyNotFoundError
  );
});

test("fetchContentPlanRows REGRESSION — a nonexistent companyId throws instead of silently returning another company's rows", { skip: hasSupabase ? false : skipReason }, async () => {
  const { fetchContentPlanRows, ContentPlanCompanyNotFoundError } = await import("../../../src/lib/instagram-intelligence/plan.ts");
  await assert.rejects(() => fetchContentPlanRows("upcoming", NONEXISTENT_COMPANY_ID, 20), ContentPlanCompanyNotFoundError);
});

// --- TEST 8 — a real, connection-empty customer gets an empty result, not an agency fallback ---

test("fetchContentPlanRows REGRESSION — a real company with no content plan rows gets an empty list, never HK Dijital's rows", { skip: hasSupabase ? false : skipReason }, async () => {
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const { fetchContentPlanRows } = await import("../../../src/lib/instagram-intelligence/plan.ts");

  const unique = `QA-ContentPlan-Empty-${Date.now()}`;
  const [company] = await supabaseRest<Array<{ id: string }>>("companies", {
    method: "POST", body: JSON.stringify({ name: unique, email: `${unique.toLocaleLowerCase("en")}@example.test`, is_test: true })
  });

  try {
    const upcoming = await fetchContentPlanRows("upcoming", company.id, 20);
    const history = await fetchContentPlanRows("history", company.id, 20);
    assert.deepEqual(upcoming, []);
    assert.deepEqual(history, []);
  } finally {
    await supabaseRest(`companies?id=eq.${company.id}`, { method: "DELETE" }).catch(() => {});
  }
});

// --- TEST 9 — MCP tool schema exposes companyId as required ---

test("MCP REGRESSION — get_content_tracking_history/get_upcoming_content_plan/create_content_plan all require companyId", async () => {
  const { tools } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  const byName = Object.fromEntries(tools.map((t: any) => [t.name, t]));
  for (const name of ["get_content_tracking_history", "get_upcoming_content_plan", "create_content_plan"]) {
    assert.ok(byName[name], `${name} must still be registered`);
    assert.ok(byName[name].inputSchema.properties.companyId, `${name} must expose a companyId property`);
    assert.ok(byName[name].inputSchema.required.includes("companyId"), `${name} must require companyId`);
  }
  assert.equal(byName.get_content_tracking_history.permission, "READ_ONLY");
  assert.equal(byName.get_upcoming_content_plan.permission, "READ_ONLY");
  assert.equal(byName.create_content_plan.permission, "WRITE_SAFE");
});

test("MCP REGRESSION — execute() rejects get_content_tracking_history for a nonexistent companyId as NOT_FOUND, not SERVICE_UNAVAILABLE", { skip: hasSupabase ? false : skipReason }, async () => {
  const { execute, ControlError } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  await assert.rejects(
    () => execute("get_content_tracking_history", { companyId: NONEXISTENT_COMPANY_ID }),
    (error: unknown) => error instanceof ControlError && (error as InstanceType<typeof ControlError>).code === "NOT_FOUND"
  );
});
