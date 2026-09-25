// save_ads_strategy_plan budget schema/validation fix — regression
// coverage for the real production bug (7 consecutive Claude Project
// save attempts failing with "budget alanları zorunludur." because the
// MCP tool's `strategy` argument can only be declared as a generic
// object, so Claude had no machine-readable way to learn the exact
// budget field names and guessed reasonable-but-different ones, e.g.
// { monthlyTotal, meta, google } instead of { totalMonthlyRecommended,
// platformSplit: { meta, google } }).
//
// Fix: (1) normalizeBudgetInput (ad-strategies.ts) repairs common
// structural aliases before validation — never fabricates `rationale`.
// (2) validateAdsStrategy (ads-strategy.ts) now gives a specific error
// per missing/malformed budget sub-field instead of one generic message.
// (3) save_ads_strategy_plan's MCP description now spells out the exact
// canonical budget shape with an example.
//
// Run via:
//   node --env-file=.env.local --conditions=react-server --import tsx --test tests/unit/marketing-intelligence/ad-strategy-budget-schema.test.ts
import test from "node:test";
import assert from "node:assert/strict";

const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const skipReason = "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not available in this environment — live coverage skipped rather than faked.";

function baseStrategyInput(companyId: string, budget: unknown) {
  return {
    companyId,
    dataSources: ["instagram", "meta_ads"],
    dataPeriod: { start: "2026-08-01", end: "2026-09-01" },
    confidence: "medium",
    businessSummary: "Butik pasta işletmesi için yerel farkındalık ve lead üretimi hedefleniyor, gerçek üretim testi.",
    metaStrategy: { recommended: true, rationale: "Instagram Direct üzerinden lead toplama uygun." },
    googleStrategy: { recommended: false, rationale: "Arama hacmi düşük, öncelik değil." },
    budget,
    thirtyDayPlan: [{ phase: "Hafta 1-2", description: "Kreatif test ve öğrenme fazı." }]
  };
}

async function makeFixtureCompany(label: string) {
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const unique = `QA-AdBudget-${label}-${Date.now()}`;
  const [company] = await supabaseRest<Array<{ id: string }>>("companies", { method: "POST", body: JSON.stringify({ name: unique, email: `${unique.toLocaleLowerCase("en")}@example.test`, is_test: true }) });
  return company.id as string;
}

async function cleanup(companyId: string) {
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const { AD_STRATEGIES_TABLE } = await import("../../../src/lib/marketing-intelligence/ad-strategies.ts");
  await supabaseRest(`${AD_STRATEGIES_TABLE}?company_id=eq.${companyId}`, { method: "DELETE" }).catch(() => {});
  await supabaseRest(`companies?id=eq.${companyId}`, { method: "DELETE" }).catch(() => {});
}

// --- SENARYO A — Meta-only, canonical shape ---

test("SENARYO A — Meta-only canonical budget (monthly>0, meta>0, google=0) saves successfully (requires ad_strategies migration)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { saveAdStrategyDraft } = await import("../../../src/lib/marketing-intelligence/ad-strategies.ts");
  const companyId = await makeFixtureCompany("A");
  try {
    const strategy = await saveAdStrategyDraft(baseStrategyInput(companyId, {
      hasHistoricalPerformance: false, totalMonthlyRecommended: 15000, platformSplit: { meta: 100, google: 0 }, rationale: "Sadece Meta önerilir."
    }));
    assert.equal(strategy.status, "draft");
    assert.equal(strategy.monthly_ad_budget, 15000);
    assert.equal(strategy.meta_budget, 15000);
    assert.equal(strategy.google_budget, null, "0% split correctly derives to no Google budget, not an error");
  } finally {
    await cleanup(companyId);
  }
});

// --- SENARYO B — Meta + Google both > 0 ---

test("SENARYO B — Meta + Google both > 0 saves successfully with correct split (requires ad_strategies migration)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { saveAdStrategyDraft } = await import("../../../src/lib/marketing-intelligence/ad-strategies.ts");
  const companyId = await makeFixtureCompany("B");
  try {
    const strategy = await saveAdStrategyDraft(baseStrategyInput(companyId, {
      hasHistoricalPerformance: true, totalMonthlyRecommended: 20000, platformSplit: { meta: 60, google: 40 }, rationale: "İkisi de önerilir."
    }));
    assert.equal(strategy.meta_budget, 12000);
    assert.equal(strategy.google_budget, 8000);
  } finally {
    await cleanup(companyId);
  }
});

// --- SENARYO C — Google explicitly 0 must never be treated as "missing" ---

test("SENARYO C — Google budget of exactly 0 is accepted, never rejected as missing (requires ad_strategies migration)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { saveAdStrategyDraft } = await import("../../../src/lib/marketing-intelligence/ad-strategies.ts");
  const companyId = await makeFixtureCompany("C");
  try {
    const strategy = await saveAdStrategyDraft(baseStrategyInput(companyId, {
      hasHistoricalPerformance: false, totalMonthlyRecommended: 10000, platformSplit: { meta: 100, google: 0 }, rationale: "Google kullanılmıyor."
    }));
    assert.equal(strategy.status, "draft");
  } finally {
    await cleanup(companyId);
  }
});

// --- SENARYO D — genuinely missing budget gives a clear, specific error ---

test("SENARYO D — a missing budget object gives a specific, actionable validation error, not a silent failure", async () => {
  const { saveAdStrategyDraft } = await import("../../../src/lib/marketing-intelligence/ad-strategies.ts");
  const { AdsStrategyValidationError } = await import("../../../src/lib/marketing-intelligence/ad-strategies.ts");
  await assert.rejects(
    () => saveAdStrategyDraft(baseStrategyInput("00000000-0000-4000-8000-000000000000", undefined)),
    (error: unknown) => error instanceof AdsStrategyValidationError && /budget/i.test((error as Error).message)
  );
});

test("SENARYO D2 — a budget missing only rationale gives a field-specific error (rationale is never fabricated)", async () => {
  const { saveAdStrategyDraft, AdsStrategyValidationError } = await import("../../../src/lib/marketing-intelligence/ad-strategies.ts");
  await assert.rejects(
    () => saveAdStrategyDraft(baseStrategyInput("00000000-0000-4000-8000-000000000000", { hasHistoricalPerformance: false, totalMonthlyRecommended: 5000, platformSplit: { meta: 100, google: 0 } })),
    (error: unknown) => error instanceof AdsStrategyValidationError && /rationale/i.test((error as Error).message)
  );
});

// --- SENARYO E — save then read back via get_latest_ads_strategy_plan ---

test("SENARYO E — after save, get_latest_ads_strategy_plan-equivalent read (getAdStrategyById) returns the correctly mapped budget (requires ad_strategies migration)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { saveAdStrategyDraft, getAdStrategyById } = await import("../../../src/lib/marketing-intelligence/ad-strategies.ts");
  const companyId = await makeFixtureCompany("E");
  try {
    const saved = await saveAdStrategyDraft(baseStrategyInput(companyId, {
      hasHistoricalPerformance: false, totalMonthlyRecommended: 15000, platformSplit: { meta: 100, google: 0 }, rationale: "Test."
    }));
    const reread = await getAdStrategyById(companyId, saved.id);
    assert.equal(reread.status, "draft");
    assert.equal(reread.monthly_ad_budget, 15000);
    assert.equal(reread.meta_budget, 15000);
  } finally {
    await cleanup(companyId);
  }
});

// --- Claude-guessed alias field names must also succeed (the actual reported bug) ---

test("BUDGET ALIAS — a Claude-guessed flat-number budget shape ({monthlyTotal, meta, google} instead of {totalMonthlyRecommended, platformSplit}) is normalized and saves successfully (requires ad_strategies migration)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { saveAdStrategyDraft } = await import("../../../src/lib/marketing-intelligence/ad-strategies.ts");
  const companyId = await makeFixtureCompany("Alias");
  try {
    const strategy = await saveAdStrategyDraft(baseStrategyInput(companyId, {
      monthlyTotal: 12000, dailyEstimate: 400, meta: 12000, google: 0, rationale: "Alias şekliyle gönderildi."
    }));
    assert.equal(strategy.status, "draft");
    assert.equal(strategy.monthly_ad_budget, 12000);
    assert.equal(strategy.meta_budget, 12000);
    assert.equal(strategy.google_budget, null);
  } finally {
    await cleanup(companyId);
  }
});

test("BUDGET ALIAS — a genuinely malformed platformSplit (non-numeric) is still rejected with a specific message", async () => {
  const { saveAdStrategyDraft, AdsStrategyValidationError } = await import("../../../src/lib/marketing-intelligence/ad-strategies.ts");
  await assert.rejects(
    () => saveAdStrategyDraft(baseStrategyInput("00000000-0000-4000-8000-000000000000", { hasHistoricalPerformance: false, totalMonthlyRecommended: 5000, platformSplit: { meta: "yüz", google: 0 }, rationale: "x" })),
    (error: unknown) => error instanceof AdsStrategyValidationError && /platformSplit/i.test((error as Error).message)
  );
});

// --- MCP tool description exposes the exact canonical budget shape ---

test("MCP REGRESSION — save_ads_strategy_plan's description spells out the exact required budget field names so Claude never has to guess", async () => {
  const { tools } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  const tool = tools.find((t: any) => t.name === "save_ads_strategy_plan")!;
  for (const field of ["totalMonthlyRecommended", "platformSplit", "hasHistoricalPerformance", "rationale"]) {
    assert.ok(tool.description.includes(field), `description must explicitly name budget.${field}`);
  }
});
