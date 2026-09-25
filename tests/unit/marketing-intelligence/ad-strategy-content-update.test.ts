// update_ads_strategy_content MCP tool — lets Claude fill in/update an
// EXISTING ad_strategies record's content fields (e.g. campaign_sequence)
// in place, without save_ads_strategy_plan's "always creates a new
// draft/version" behavior. Reuses the exact same updateAdStrategy()
// function the HK Admin PATCH route already uses (same canonical
// approved/active -> updated business rule), via one new shared
// validator (validateAdStrategyPatch) + allowlist
// (AD_STRATEGY_EDITABLE_FIELDS) both the admin route and this MCP tool
// import — no duplicated update logic.
//
// Run via:
//   node --env-file=.env.local --conditions=react-server --import tsx --test tests/unit/marketing-intelligence/ad-strategy-content-update.test.ts
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

const REAL_CAMPAIGN_SEQUENCE = [
  { order: 1, name: "Mesaj Kampanyası", objective: "Engagement", conversionLocation: "Instagram Direct / WhatsApp", dailyBudget: 150, purpose: "İlk müşteri kazanım kampanyası", transitionCondition: "Yeterli veri oluştuğunda kreatif performansını değerlendir" },
  { order: 2, name: "Kreatif Değerlendirme/Optimizasyon", purpose: "Kazanan kreatif devam eder, zayıf kreatif durdurulur" },
  { order: 3, name: "Remarketing", transitionCondition: "Yalnızca yeterli sıcak kitle oluştuğunda başlatılır" },
  { order: 4, name: "Ölçekleme", transitionCondition: "Sipariş başı maliyet kabul edilebilir olduğunda bütçe kademeli artırılır" }
];

async function makeFixtureCompany(label: string) {
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const unique = `QA-AdContent-${label}-${Date.now()}`;
  const [company] = await supabaseRest<Array<{ id: string }>>("companies", { method: "POST", body: JSON.stringify({ name: unique, email: `${unique.toLocaleLowerCase("en")}@example.test`, is_test: true }) });
  return company.id as string;
}

async function cleanup(companyId: string) {
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const { AD_STRATEGIES_TABLE } = await import("../../../src/lib/marketing-intelligence/ad-strategies.ts");
  await supabaseRest(`${AD_STRATEGIES_TABLE}?company_id=eq.${companyId}`, { method: "DELETE" }).catch(() => {});
  await supabaseRest(`companies?id=eq.${companyId}`, { method: "DELETE" }).catch(() => {});
}

// --- 1. Draft record's campaign_sequence is updated ---

test("1. updateAdStrategy: a DRAFT record's campaign_sequence is updated in place (requires ad_strategies migration)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { saveAdStrategyDraft, updateAdStrategy, validateAdStrategyPatch } = await import("../../../src/lib/marketing-intelligence/ad-strategies.ts");
  const companyId = await makeFixtureCompany("Draft");
  try {
    const created = await saveAdStrategyDraft(baseStrategyInput(companyId));
    assert.deepEqual(created.campaign_sequence, []);
    const patch = validateAdStrategyPatch({ campaign_sequence: REAL_CAMPAIGN_SEQUENCE });
    const updated = await updateAdStrategy(companyId, created.id, patch);
    assert.equal(updated.campaign_sequence.length, 4);
    assert.equal(updated.campaign_sequence[0].name, "Mesaj Kampanyası");
    assert.equal(updated.status, "draft", "a draft stays draft after a content update");
  } finally {
    await cleanup(companyId);
  }
});

// --- 2. Approved/active record content update follows the same canonical rule as HK Admin ---

test("2. updateAdStrategy: updating an APPROVED/ACTIVE record's content marks it UPDATED — same canonical rule as the HK Admin PATCH route (requires ad_strategies migration)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { saveAdStrategyDraft, updateAdStrategy, updateAdStrategyStatus, validateAdStrategyPatch } = await import("../../../src/lib/marketing-intelligence/ad-strategies.ts");
  const companyId = await makeFixtureCompany("Active");
  try {
    const created = await saveAdStrategyDraft(baseStrategyInput(companyId));
    await updateAdStrategyStatus(companyId, created.id, "approved");
    const active = await updateAdStrategyStatus(companyId, created.id, "active");
    assert.equal(active.status, "active");

    const patch = validateAdStrategyPatch({ campaign_sequence: REAL_CAMPAIGN_SEQUENCE });
    const updated = await updateAdStrategy(companyId, created.id, patch);
    assert.equal(updated.status, "updated", "an ACTIVE strategy edited via content update must become UPDATED, exactly like the admin PATCH route already does");
    assert.equal(updated.id, created.id, "same row, not a new one");
  } finally {
    await cleanup(companyId);
  }
});

// --- 3. Only campaign_sequence changes; budget/report fields untouched ---

test("3. updateAdStrategy: updating only campaign_sequence leaves budget/report/remarketing fields completely unchanged (requires ad_strategies migration)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { saveAdStrategyDraft, updateAdStrategy, validateAdStrategyPatch } = await import("../../../src/lib/marketing-intelligence/ad-strategies.ts");
  const companyId = await makeFixtureCompany("Partial");
  try {
    const created = await saveAdStrategyDraft(baseStrategyInput(companyId));
    const originalBudget = created.monthly_ad_budget;
    const originalInternalReport = created.internal_report;
    const originalClientReport = created.client_report;

    const patch = validateAdStrategyPatch({ campaign_sequence: REAL_CAMPAIGN_SEQUENCE });
    const updated = await updateAdStrategy(companyId, created.id, patch);

    assert.equal(updated.monthly_ad_budget, originalBudget, "budget must never be touched by a campaign_sequence-only update");
    assert.deepEqual(updated.internal_report, originalInternalReport, "internal_report must never be reset/overwritten by an unrelated field update");
    assert.deepEqual(updated.client_report, originalClientReport, "client_report must never be reset/overwritten by an unrelated field update");
    assert.deepEqual(updated.remarketing, created.remarketing);
  } finally {
    await cleanup(companyId);
  }
});

// --- 4. Cross-company update rejected ---

test("4. updateAdStrategy: company B cannot update company A's strategy content (requires ad_strategies migration)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { saveAdStrategyDraft, updateAdStrategy, validateAdStrategyPatch, AdStrategyNotFoundError } = await import("../../../src/lib/marketing-intelligence/ad-strategies.ts");
  const companyA = await makeFixtureCompany("CrossA");
  const companyB = await makeFixtureCompany("CrossB");
  try {
    const created = await saveAdStrategyDraft(baseStrategyInput(companyA));
    const patch = validateAdStrategyPatch({ campaign_sequence: REAL_CAMPAIGN_SEQUENCE });
    await assert.rejects(() => updateAdStrategy(companyB, created.id, patch), AdStrategyNotFoundError);
  } finally {
    await cleanup(companyA);
    await cleanup(companyB);
  }
});

// --- 5. Invalid/nonexistent strategyId rejected ---

test("5. updateAdStrategy: a nonexistent strategyId is rejected with AdStrategyNotFoundError (requires ad_strategies migration)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { updateAdStrategy, validateAdStrategyPatch, AdStrategyNotFoundError } = await import("../../../src/lib/marketing-intelligence/ad-strategies.ts");
  const companyId = await makeFixtureCompany("Invalid");
  try {
    const patch = validateAdStrategyPatch({ primary_goal: "Yeni hedef" });
    await assert.rejects(() => updateAdStrategy(companyId, "00000000-0000-4000-8000-000000000000", patch), AdStrategyNotFoundError);
  } finally {
    await cleanup(companyId);
  }
});

// --- 6. Malformed campaign_sequence rejected with a specific error ---

test("6. validateAdStrategyPatch: malformed campaign_sequence entries are rejected with a specific, actionable error", async () => {
  const { validateAdStrategyPatch, AdStrategyPatchValidationError } = await import("../../../src/lib/marketing-intelligence/ad-strategies.ts");
  assert.throws(
    () => validateAdStrategyPatch({ campaign_sequence: [{ name: "Eksik order alanı" }] }),
    (error: unknown) => error instanceof AdStrategyPatchValidationError && /order/.test((error as Error).message)
  );
  assert.throws(
    () => validateAdStrategyPatch({ campaign_sequence: "not-an-array" }),
    (error: unknown) => error instanceof AdStrategyPatchValidationError && /campaign_sequence/.test((error as Error).message)
  );
});

test("6b. validateAdStrategyPatch: an unknown/disallowed field is rejected outright (no arbitrary column writes)", async () => {
  const { validateAdStrategyPatch, AdStrategyPatchValidationError } = await import("../../../src/lib/marketing-intelligence/ad-strategies.ts");
  assert.throws(() => validateAdStrategyPatch({ company_id: "00000000-0000-4000-8000-000000000000" }), AdStrategyPatchValidationError);
  assert.throws(() => validateAdStrategyPatch({ status: "active" }), AdStrategyPatchValidationError, "status changes must go through update_ads_strategy_status, not this tool");
  assert.throws(() => validateAdStrategyPatch({ version: 99 }), AdStrategyPatchValidationError);
});

// --- 7/8/9. Same ID, same version, no new row ---

test("7/8/9. updateAdStrategy: same id, version unchanged, and no new row is created by a content update (requires ad_strategies migration)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const { saveAdStrategyDraft, updateAdStrategy, validateAdStrategyPatch, AD_STRATEGIES_TABLE } = await import("../../../src/lib/marketing-intelligence/ad-strategies.ts");
  const companyId = await makeFixtureCompany("Identity");
  try {
    const created = await saveAdStrategyDraft(baseStrategyInput(companyId));
    const patch = validateAdStrategyPatch({ campaign_sequence: REAL_CAMPAIGN_SEQUENCE });
    const updated = await updateAdStrategy(companyId, created.id, patch);

    assert.equal(updated.id, created.id, "id must be identical");
    assert.equal(updated.version, created.version, "version must not increment on a content-only update");

    const allRows = await supabaseRest<Array<{ id: string }>>(`${AD_STRATEGIES_TABLE}?company_id=eq.${companyId}&select=id`);
    assert.equal(allRows.length, 1, "a content update must never create a new row");
  } finally {
    await cleanup(companyId);
  }
});

// --- 10. get_latest_ads_strategy_plan-equivalent read sees the updated content ---

test("10. getAdStrategyForActivation reads back the updated campaign_sequence after a content-only update (requires ad_strategies migration)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { saveAdStrategyDraft, updateAdStrategy, updateAdStrategyStatus, getAdStrategyForActivation, validateAdStrategyPatch } = await import("../../../src/lib/marketing-intelligence/ad-strategies.ts");
  const companyId = await makeFixtureCompany("Readback");
  try {
    const created = await saveAdStrategyDraft(baseStrategyInput(companyId));
    await updateAdStrategyStatus(companyId, created.id, "approved");
    await updateAdStrategyStatus(companyId, created.id, "active");
    const patch = validateAdStrategyPatch({ campaign_sequence: REAL_CAMPAIGN_SEQUENCE });
    await updateAdStrategy(companyId, created.id, patch);

    const activation = await getAdStrategyForActivation(companyId);
    assert.ok(activation.strategy);
    assert.equal(activation.strategy!.campaign_sequence.length, 4);
    assert.equal(activation.strategy!.campaign_sequence[3].name, "Ölçekleme");
  } finally {
    await cleanup(companyId);
  }
});

// --- MCP registration ---

test("MCP REGRESSION — update_ads_strategy_content is registered, WRITE_SAFE, requires companyId+strategyId+patch", async () => {
  const { tools } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  const tool = tools.find((t: any) => t.name === "update_ads_strategy_content");
  assert.ok(tool, "update_ads_strategy_content must be registered");
  assert.equal(tool!.permission, "WRITE_SAFE");
  assert.deepEqual(tool!.inputSchema.required, ["companyId", "strategyId", "patch"]);
  for (const field of ["campaign_sequence", "order", "name", "remarketing"]) {
    assert.ok(tool!.description.includes(field), `description must document the ${field} shape explicitly`);
  }
});

test("MCP REGRESSION — execute() rejects update_ads_strategy_content with an unknown field as INVALID_ARGUMENTS", async () => {
  const { execute, ControlError } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  await assert.rejects(
    () => execute("update_ads_strategy_content", { companyId: "00000000-0000-4000-8000-000000000000", strategyId: "00000000-0000-4000-8000-000000000000", patch: { status: "active" } }),
    (error: unknown) => error instanceof ControlError && (error as InstanceType<typeof ControlError>).code === "INVALID_ARGUMENTS"
  );
});
