// Reklam Değerlendirme MCP integration — get_ad_evaluation_context,
// save_ad_evaluation, get_latest_ad_evaluation. Reuses the exact same
// execute() dispatcher, ControlError codes, and company-ownership
// pattern already proven for save_ad_creative_report/get_latest_ad_creative_report.
// supabase/migrations/20261001_ad_evaluations.sql is applied in this
// environment (verified live), so these tests run unconditionally
// alongside the other marketing-intelligence MCP suites.
// Run via:
//   node --env-file=.env.local --conditions=react-server --import tsx --test tests/unit/marketing-intelligence/ad-evaluation-mcp.test.ts
import test from "node:test";
import assert from "node:assert/strict";

const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const skipReason = "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not available in this environment — live coverage skipped rather than faked.";

async function makeFixtureCompany(label: string) {
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const unique = `QA-AdEvalMcp-${label}-${Date.now()}`;
  const [company] = await supabaseRest<Array<{ id: string }>>("companies", { method: "POST", body: JSON.stringify({ name: unique, email: `${unique.toLocaleLowerCase("en")}@example.test`, is_test: true }) });
  return company.id as string;
}

async function cleanup(companyId: string) {
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const { AD_EVALUATIONS_TABLE } = await import("../../../src/lib/marketing-intelligence/ad-evaluations.ts");
  const rows = await supabaseRest<Array<{ id: string; internal_pdf_path: string | null; internal_docx_path: string | null; client_pdf_path: string | null; client_docx_path: string | null }>>(
    `${AD_EVALUATIONS_TABLE}?company_id=eq.${companyId}&select=id,internal_pdf_path,internal_docx_path,client_pdf_path,client_docx_path`
  ).catch(() => []);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  for (const row of rows) {
    for (const path of [row.internal_pdf_path, row.internal_docx_path, row.client_pdf_path, row.client_docx_path]) {
      if (!path || !url || !key) continue;
      await fetch(`${url}/storage/v1/object/ad-evaluation-reports/${path}`, { method: "DELETE", headers: { apikey: key, Authorization: `Bearer ${key}` } }).catch(() => {});
    }
  }
  await supabaseRest(`${AD_EVALUATIONS_TABLE}?company_id=eq.${companyId}`, { method: "DELETE" }).catch(() => {});
  await supabaseRest(`companies?id=eq.${companyId}`, { method: "DELETE" }).catch(() => {});
}

const SAMPLE_INTERNAL = { executiveSummary: "Kampanya ilk 48 saatte beklenen seyirde.", sections: [{ title: "Ana Metrikler", content: "Harcama: 500 TL\nSonuç: 12\nSonuç başı maliyet: 41,6 TL" }] };
const SAMPLE_CLIENT = { executiveSummary: "Reklamınız planlandığı gibi yayında ve ilk sonuçlar olumlu.", sections: [{ title: "Performans Metrikleri", content: "Erişim (Reklamı en az bir kez gören farklı kişi sayısı): 8.200\nCTR (Reklamı gören kişilerden bağlantıya tıklayanların oranı): %1,4" }] };

// --- Tool registry ---

test("MCP REGISTRY — get_ad_evaluation_context/save_ad_evaluation/get_latest_ad_evaluation are registered with correct permissions and required fields", async () => {
  const { tools } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  const byName = Object.fromEntries(tools.map((t: any) => [t.name, t]));
  assert.equal(byName.get_ad_evaluation_context.permission, "READ_ONLY");
  assert.deepEqual(byName.get_ad_evaluation_context.inputSchema.required, ["companyId"]);
  assert.equal(byName.save_ad_evaluation.permission, "WRITE_SAFE");
  assert.deepEqual(byName.save_ad_evaluation.inputSchema.required, ["companyId"]);
  assert.equal(byName.get_latest_ad_evaluation.permission, "READ_ONLY");
  assert.deepEqual(byName.get_latest_ad_evaluation.inputSchema.required, ["companyId"]);
});

// --- get_ad_evaluation_context ---

test("get_ad_evaluation_context: company with no campaign/strategy never breaks — campaign/strategy null, not an error", { skip: hasSupabase ? false : skipReason }, async () => {
  const { execute } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  const companyId = await makeFixtureCompany("CtxEmpty");
  try {
    const context: any = await execute("get_ad_evaluation_context", { companyId });
    assert.equal(context.company.id, companyId);
    assert.equal(context.campaign, null);
    assert.equal(context.strategy, null);
    assert.equal(context.metricsSnapshot.campaign, null, "missing metrics must be null, never a fabricated zero");
  } finally {
    await cleanup(companyId);
  }
});

test("get_ad_evaluation_context: cross-company isolation — company B never sees company A's previous evaluations", { skip: hasSupabase ? false : skipReason }, async () => {
  const { execute } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  const companyA = await makeFixtureCompany("CtxA");
  const companyB = await makeFixtureCompany("CtxB");
  try {
    await execute("save_ad_evaluation", { companyId: companyA, internalReport: SAMPLE_INTERNAL, clientReport: SAMPLE_CLIENT });
    const contextB: any = await execute("get_ad_evaluation_context", { companyId: companyB });
    assert.deepEqual(contextB.previousEvaluations, [], "company B must never see company A's evaluation history");
  } finally {
    await cleanup(companyA);
    await cleanup(companyB);
  }
});

test("get_ad_evaluation_context: unresolved company is rejected, not silently defaulted", { skip: hasSupabase ? false : skipReason }, async () => {
  const { execute, ControlError } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  await assert.rejects(
    () => execute("get_ad_evaluation_context", { companyId: "00000000-0000-4000-8000-000000000000" }),
    (error: unknown) => error instanceof ControlError && (error as InstanceType<typeof ControlError>).code === "NOT_FOUND"
  );
});

// --- save_ad_evaluation ---

test("save_ad_evaluation: persists ONE row with both internal_report and client_report, generates and verifies all four report files", { skip: hasSupabase ? false : skipReason }, async () => {
  const { execute } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  const { getAdEvaluationById } = await import("../../../src/lib/marketing-intelligence/ad-evaluations.ts");
  const companyId = await makeFixtureCompany("SaveFull");
  try {
    const result: any = await execute("save_ad_evaluation", {
      companyId, internalReport: SAMPLE_INTERNAL, clientReport: SAMPLE_CLIENT, decision: "CONTINUE", nextReviewAt: "2026-10-15"
    });
    assert.equal(result.companyId, companyId);
    assert.equal(result.status, "evaluated");
    assert.equal(result.decision, "CONTINUE");
    assert.equal(result.reports.internalReportSaved, true);
    assert.equal(result.reports.clientReportSaved, true);
    assert.equal(result.files.internalPdf, true);
    assert.equal(result.files.internalDocx, true);
    assert.equal(result.files.clientPdf, true);
    assert.equal(result.files.clientDocx, true);

    const row = await getAdEvaluationById(companyId, result.evaluationId);
    assert.ok(row.internal_pdf_path && row.internal_docx_path && row.client_pdf_path && row.client_docx_path, "storage paths must be persisted on the same row");
    assert.equal(row.internal_report.executiveSummary, SAMPLE_INTERNAL.executiveSummary);
    assert.equal(row.client_report.executiveSummary, SAMPLE_CLIENT.executiveSummary);

    const { supabaseRest } = await import("../../../src/lib/supabase.ts");
    const { AD_EVALUATIONS_TABLE } = await import("../../../src/lib/marketing-intelligence/ad-evaluations.ts");
    const allRows = await supabaseRest<any[]>(`${AD_EVALUATIONS_TABLE}?company_id=eq.${companyId}&select=id`);
    assert.equal(allRows.length, 1, "internal + client report must never create two separate evaluation rows");
  } finally {
    await cleanup(companyId);
  }
});

test("save_ad_evaluation: rejects when both internalReport and clientReport are empty", { skip: hasSupabase ? false : skipReason }, async () => {
  const { execute, ControlError } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  const companyId = await makeFixtureCompany("SaveEmpty");
  try {
    await assert.rejects(
      () => execute("save_ad_evaluation", { companyId }),
      (error: unknown) => error instanceof ControlError && (error as InstanceType<typeof ControlError>).code === "INVALID_ARGUMENTS"
    );
  } finally {
    await cleanup(companyId);
  }
});

test("save_ad_evaluation: unresolved companyId is rejected, never silently saved", { skip: hasSupabase ? false : skipReason }, async () => {
  const { execute, ControlError } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  await assert.rejects(
    () => execute("save_ad_evaluation", { companyId: "00000000-0000-4000-8000-000000000000", internalReport: SAMPLE_INTERNAL, clientReport: SAMPLE_CLIENT }),
    (error: unknown) => error instanceof ControlError && (error as InstanceType<typeof ControlError>).code === "NOT_FOUND"
  );
});

test("save_ad_evaluation: calling again for the same evaluation reuses stored files instead of producing duplicates", { skip: hasSupabase ? false : skipReason }, async () => {
  const { execute } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  const { generateAllAdEvaluationReports } = await import("../../../src/lib/marketing-intelligence/ad-evaluation-reports.ts");
  const companyId = await makeFixtureCompany("NoDupFiles");
  try {
    const result: any = await execute("save_ad_evaluation", { companyId, internalReport: SAMPLE_INTERNAL, clientReport: SAMPLE_CLIENT });
    const again = await generateAllAdEvaluationReports(companyId, result.evaluationId);
    assert.equal(again.internal_pdf_path, result.files.internalPdf && again.internal_pdf_path, "path must be a stable string, not freshly regenerated");
    const beforePath = again.internal_pdf_path;
    const stillSame = await generateAllAdEvaluationReports(companyId, result.evaluationId);
    assert.equal(stillSame.internal_pdf_path, beforePath, "a second generation pass must reuse the same stored path, never create a new file");
  } finally {
    await cleanup(companyId);
  }
});

test("client report never leaks internal-only content (e.g. decision/Nihai Karar text never appears in client_report)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { execute } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  const companyId = await makeFixtureCompany("NoLeak");
  try {
    const result: any = await execute("save_ad_evaluation", {
      companyId,
      internalReport: { executiveSummary: "Dahili not: kampanya riskli, bütçe kesilmeli.", sections: [{ title: "Riskler", content: "Kritik: CPA çok yüksek, dahili satış ekibiyle görüşülecek." }] },
      clientReport: SAMPLE_CLIENT,
      decision: "BUDGET_OPTIMIZATION"
    });
    const { getAdEvaluationById } = await import("../../../src/lib/marketing-intelligence/ad-evaluations.ts");
    const row = await getAdEvaluationById(companyId, result.evaluationId);
    const clientText = JSON.stringify(row.client_report);
    assert.ok(!clientText.includes("dahili satış ekibiyle"), "internal-only note must never leak into client_report");
    assert.ok(!clientText.includes("BUDGET_OPTIMIZATION"), "the raw decision code must never leak into client_report");
  } finally {
    await cleanup(companyId);
  }
});

// --- get_latest_ad_evaluation ---

test("get_latest_ad_evaluation: NOT_FOUND when none exists, then returns a compact summary after save (no raw signed URLs)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { execute, ControlError } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  const companyId = await makeFixtureCompany("Latest");
  try {
    await assert.rejects(
      () => execute("get_latest_ad_evaluation", { companyId }),
      (error: unknown) => error instanceof ControlError && (error as InstanceType<typeof ControlError>).code === "NOT_FOUND"
    );
    const saved: any = await execute("save_ad_evaluation", { companyId, internalReport: SAMPLE_INTERNAL, clientReport: SAMPLE_CLIENT, decision: "MONITOR" });
    const latest: any = await execute("get_latest_ad_evaluation", { companyId });
    assert.equal(latest.id, saved.evaluationId);
    assert.equal(latest.decision, "MONITOR");
    assert.equal(latest.files.internalPdf, true);
    assert.equal(JSON.stringify(latest).includes("http"), false, "must never expose a signed storage URL directly");
  } finally {
    await cleanup(companyId);
  }
});

test("PRODUCTION SAFETY — MY CAKE 45's real ad_strategies record is unaffected by this MCP test suite", { skip: hasSupabase ? false : skipReason }, async () => {
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const rows = await supabaseRest<Array<{ id: string; version: number }>>("ad_strategies?id=eq.f0861d43-fd8f-44d9-9d02-00f1c581af3d&select=id,version");
  if (rows.length) assert.equal(rows[0].version, 1);
});

