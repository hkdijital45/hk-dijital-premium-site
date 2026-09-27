// Reklam Kreatif Raporu MCP integration — get_ad_creative_context,
// save_ad_creative_report, update_ad_creative_report,
// get_latest_ad_creative_report. Reuses the exact same execute()
// dispatcher, ControlError codes, and company-ownership pattern already
// proven for save_ads_strategy_plan/update_ads_strategy_content.
//
// NOTE: live tests depend on BOTH supabase/migrations/20260925_ad_strategies.sql
// AND 20260927_ad_creative_reports.sql being applied (the assistant
// never applies migrations to production itself — see the final report).
// Run via:
//   node --env-file=.env.local --conditions=react-server --import tsx --test tests/unit/marketing-intelligence/ad-creative-report-mcp.test.ts
import test from "node:test";
import assert from "node:assert/strict";

const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const skipReason = "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not available in this environment — live coverage skipped rather than faked.";

async function makeFixtureCompany(label: string) {
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const unique = `QA-AdCreativeMcp-${label}-${Date.now()}`;
  const [company] = await supabaseRest<Array<{ id: string }>>("companies", { method: "POST", body: JSON.stringify({ name: unique, email: `${unique.toLocaleLowerCase("en")}@example.test`, is_test: true }) });
  return company.id as string;
}

async function cleanup(companyId: string) {
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const { AD_CREATIVE_REPORTS_TABLE } = await import("../../../src/lib/marketing-intelligence/ad-creative-reports.ts");
  await supabaseRest(`${AD_CREATIVE_REPORTS_TABLE}?company_id=eq.${companyId}`, { method: "DELETE" }).catch(() => {});
  await supabaseRest(`companies?id=eq.${companyId}`, { method: "DELETE" }).catch(() => {});
}

const SAMPLE_CREATIVE = { order: 1, format: "reels", title: "Test kreatifi", hook: "Test hook", cta: "Test CTA", details: "Sahne planı burada." };

// --- Tool registry ---

test("MCP REGISTRY — get_ad_creative_context/save_ad_creative_report/update_ad_creative_report/get_latest_ad_creative_report are all registered with correct permissions and required fields", async () => {
  const { tools } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  const byName = Object.fromEntries(tools.map((t: any) => [t.name, t]));
  assert.equal(byName.get_ad_creative_context.permission, "READ_ONLY");
  assert.deepEqual(byName.get_ad_creative_context.inputSchema.required, ["companyId"]);
  assert.equal(byName.save_ad_creative_report.permission, "WRITE_SAFE");
  assert.deepEqual(byName.save_ad_creative_report.inputSchema.required, ["companyId"]);
  assert.equal(byName.update_ad_creative_report.permission, "WRITE_SAFE");
  assert.deepEqual(byName.update_ad_creative_report.inputSchema.required, ["companyId", "reportId", "patch"]);
  assert.equal(byName.get_latest_ad_creative_report.permission, "READ_ONLY");
  assert.deepEqual(byName.get_latest_ad_creative_report.inputSchema.required, ["companyId"]);
});

// --- get_ad_creative_context ---

test("get_ad_creative_context: real company, real strategy linkage, no cross-company leakage (requires ad_strategies + ad_creative_reports migrations)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { execute } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  const MY_CAKE_45 = "fc51d411-ea37-45e4-9c93-df0cd43a4a42";
  const context: any = await execute("get_ad_creative_context", { companyId: MY_CAKE_45 });
  assert.equal(context.company.id, MY_CAKE_45);
  if (context.adStrategy) assert.ok(context.adStrategy.id, "linked strategy must carry a real id, never a fabricated one");
});

test("get_ad_creative_context: a company with no ad strategy is never blocked — adStrategy is null, not an error (requires ad_creative_reports migration)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { execute } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  const companyId = await makeFixtureCompany("NoStrategy");
  try {
    const context: any = await execute("get_ad_creative_context", { companyId });
    assert.equal(context.adStrategy, null);
    assert.equal(context.latestCreativeReport, null);
  } finally {
    await cleanup(companyId);
  }
});

test("get_ad_creative_context: cross-company isolation — two companies each get only their own data (requires ad_creative_reports migration)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { execute } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  const companyA = await makeFixtureCompany("CtxA");
  const companyB = await makeFixtureCompany("CtxB");
  try {
    await execute("save_ad_creative_report", { companyId: companyA, creatives: [SAMPLE_CREATIVE] });
    const contextB: any = await execute("get_ad_creative_context", { companyId: companyB });
    assert.equal(contextB.latestCreativeReport, null, "company B must never see company A's creative report");
  } finally {
    await cleanup(companyA);
    await cleanup(companyB);
  }
});

// --- save_ad_creative_report ---

test("save_ad_creative_report: creates a new DRAFT with correct company_id and version, tagged source claude_project (requires ad_creative_reports migration)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { execute } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  const companyId = await makeFixtureCompany("Save");
  try {
    const report: any = await execute("save_ad_creative_report", { companyId, reportTitle: "MCP Test Raporu", creatives: [SAMPLE_CREATIVE] });
    assert.equal(report.status, "draft", "Claude must never auto-approve/activate a saved report");
    assert.equal(report.company_id, companyId);
    assert.equal(report.version, 1);
    assert.equal(report.source, "claude_project");
    assert.equal(report.creatives.length, 1);
  } finally {
    await cleanup(companyId);
  }
});

test("save_ad_creative_report: correctly links ad_strategy_id/ad_strategy_version when provided — the FK must reference a real ad_strategies row (requires ad_strategies + ad_creative_reports migrations)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { execute } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const { AD_STRATEGIES_TABLE } = await import("../../../src/lib/marketing-intelligence/ad-strategies.ts");
  const companyId = await makeFixtureCompany("SaveLinked");
  try {
    const strategy: any = await execute("save_ads_strategy_plan", {
      strategy: {
        companyId, dataSources: ["instagram"], dataPeriod: { start: "2026-08-01", end: "2026-09-01" }, confidence: "medium",
        businessSummary: "Test strateji özeti, gerçek üretim testi için kullanılıyor.",
        metaStrategy: { recommended: true, rationale: "Test." }, googleStrategy: { recommended: false, rationale: "Test." },
        budget: { hasHistoricalPerformance: false, totalMonthlyRecommended: 5000, platformSplit: { meta: 100, google: 0 }, rationale: "Test." },
        thirtyDayPlan: [{ phase: "Hafta 1", description: "Test." }]
      }
    });
    const report: any = await execute("save_ad_creative_report", { companyId, adStrategyId: strategy.id, adStrategyVersion: strategy.version, creatives: [SAMPLE_CREATIVE] });
    assert.equal(report.ad_strategy_id, strategy.id);
    assert.equal(report.ad_strategy_version, strategy.version);
  } finally {
    await supabaseRest(`${AD_STRATEGIES_TABLE}?company_id=eq.${companyId}`, { method: "DELETE" }).catch(() => {});
    await cleanup(companyId);
  }
});

test("save_ad_creative_report: cross-company protection — an invalid companyId is rejected, not silently saved (requires ad_creative_reports migration)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { execute, ControlError } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  await assert.rejects(
    () => execute("save_ad_creative_report", { companyId: "00000000-0000-4000-8000-000000000000", creatives: [SAMPLE_CREATIVE] }),
    (error: unknown) => error instanceof ControlError && (error as InstanceType<typeof ControlError>).code === "NOT_FOUND"
  );
});

// --- update_ad_creative_report ---

test("update_ad_creative_report: partial update on an existing draft — same id/version, unrelated fields untouched, ownership enforced (requires ad_creative_reports migration)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { execute, ControlError } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  const companyA = await makeFixtureCompany("UpdA");
  const companyB = await makeFixtureCompany("UpdB");
  try {
    const created: any = await execute("save_ad_creative_report", { companyId: companyA, creatives: [SAMPLE_CREATIVE], requiredMaterials: [{ name: "Video" }] });
    const updated: any = await execute("update_ad_creative_report", { companyId: companyA, reportId: created.id, patch: { creatives: [{ ...SAMPLE_CREATIVE, title: "Revize başlık" }] } });
    assert.equal(updated.id, created.id);
    assert.equal(updated.version, created.version, "content update must never bump version");
    assert.equal(updated.creatives[0].title, "Revize başlık");
    assert.deepEqual(updated.required_materials, created.required_materials, "unrelated fields must survive a partial update untouched");

    await assert.rejects(
      () => execute("update_ad_creative_report", { companyId: companyB, reportId: created.id, patch: { report_title: "hack" } }),
      (error: unknown) => error instanceof ControlError && (error as InstanceType<typeof ControlError>).code === "NOT_FOUND"
    );
  } finally {
    await cleanup(companyA);
    await cleanup(companyB);
  }
});

test("update_ad_creative_report: never changes status — approval/activation stays HK Admin's decision (requires ad_creative_reports migration)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { execute, ControlError } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  const companyId = await makeFixtureCompany("NoAutoApprove");
  try {
    const created: any = await execute("save_ad_creative_report", { companyId, creatives: [SAMPLE_CREATIVE] });
    await assert.rejects(
      () => execute("update_ad_creative_report", { companyId, reportId: created.id, patch: { status: "active" } }),
      (error: unknown) => error instanceof ControlError && (error as InstanceType<typeof ControlError>).code === "INVALID_ARGUMENTS"
    );
    const stillDraft: any = await execute("get_latest_ad_creative_report", { companyId });
    assert.equal(stillDraft.status, "draft");
  } finally {
    await cleanup(companyId);
  }
});

// --- get_latest_ad_creative_report ---

test("get_latest_ad_creative_report: returns the newest version with full content, NOT_FOUND when none exists (requires ad_creative_reports migration)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { execute, ControlError } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  const companyId = await makeFixtureCompany("Latest");
  try {
    await assert.rejects(
      () => execute("get_latest_ad_creative_report", { companyId }),
      (error: unknown) => error instanceof ControlError && (error as InstanceType<typeof ControlError>).code === "NOT_FOUND"
    );
    await execute("save_ad_creative_report", { companyId, creatives: [SAMPLE_CREATIVE] });
    const second: any = await execute("save_ad_creative_report", { companyId, creatives: [SAMPLE_CREATIVE] });
    const latest: any = await execute("get_latest_ad_creative_report", { companyId });
    assert.equal(latest.id, second.id);
    assert.equal(latest.version, 2);
    assert.ok(latest.creatives.length);
  } finally {
    await cleanup(companyId);
  }
});

test("PRODUCTION SAFETY — MY CAKE 45's real ad_strategies record is unaffected by this MCP test suite (requires ad_strategies migration)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const rows = await supabaseRest<Array<{ id: string; version: number }>>("ad_strategies?id=eq.f0861d43-fd8f-44d9-9d02-00f1c581af3d&select=id,version");
  if (rows.length) assert.equal(rows[0].version, 1);
});
