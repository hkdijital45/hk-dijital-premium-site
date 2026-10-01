// Rapor Merkezi — aggregation layer + ad_evaluations status/delete
// management. Live, requires Supabase env (same precedent as the other
// marketing-intelligence suites). Run via:
//   node --env-file=.env.local --conditions=react-server --import tsx --test tests/unit/marketing-intelligence/report-center.test.ts
import test from "node:test";
import assert from "node:assert/strict";

const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const skipReason = "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not available in this environment — live coverage skipped rather than faked.";

async function makeFixtureCompany(label: string) {
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const unique = `QA-ReportCenter-${label}-${Date.now()}`;
  const [company] = await supabaseRest<Array<{ id: string }>>("companies", { method: "POST", body: JSON.stringify({ name: unique, email: `${unique.toLocaleLowerCase("en")}@example.test`, is_test: true }) });
  return company.id as string;
}

async function cleanup(companyId: string) {
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const { AD_EVALUATIONS_TABLE } = await import("../../../src/lib/marketing-intelligence/ad-evaluations.ts");
  await supabaseRest(`${AD_EVALUATIONS_TABLE}?company_id=eq.${companyId}`, { method: "DELETE" }).catch(() => {});
  await supabaseRest(`companies?id=eq.${companyId}`, { method: "DELETE" }).catch(() => {});
}

const SAMPLE_INTERNAL = { executiveSummary: "Dahili özet.", sections: [{ title: "Ana Metrikler", content: "Harcama: 100 TL" }] };
const SAMPLE_CLIENT = { executiveSummary: "Müşteri özeti.", sections: [{ title: "Performans", content: "Erişim: 1.000" }] };

test("getReportCenterItems: a company with no reports anywhere returns an empty, zeroed result — never fabricated", { skip: hasSupabase ? false : skipReason }, async () => {
  const { getReportCenterItems } = await import("../../../src/lib/report-center.ts");
  const companyId = await makeFixtureCompany("Empty");
  try {
    const result = await getReportCenterItems(companyId);
    assert.deepEqual(result.items, []);
    assert.equal(result.summary.total, 0);
  } finally {
    await cleanup(companyId);
  }
});

test("getReportCenterItems: an ad_evaluations row appears as a correctly normalized ad_evaluation item with full capabilities", { skip: hasSupabase ? false : skipReason }, async () => {
  const { createAdEvaluationDraft, saveParsedEvaluation } = await import("../../../src/lib/marketing-intelligence/ad-evaluations.ts");
  const { getReportCenterItems } = await import("../../../src/lib/report-center.ts");
  const companyId = await makeFixtureCompany("WithEval");
  try {
    const draft = await createAdEvaluationDraft({ companyId, promptText: "test" });
    await saveParsedEvaluation(companyId, draft.id, { claudeRawResponse: "raw", internalReport: SAMPLE_INTERNAL, clientReport: SAMPLE_CLIENT, decision: "CONTINUE" });

    const result = await getReportCenterItems(companyId);
    const item = result.items.find((i) => i.sourceType === "ad_evaluation" && i.sourceId === draft.id);
    assert.ok(item, "the saved evaluation must appear in the aggregated list");
    assert.equal(item!.companyId, companyId);
    assert.equal(item!.clientVisible, true);
    assert.equal(item!.decisionLabel, "Devam Et");
    assert.equal(item!.capabilities.edit, true);
    assert.equal(item!.capabilities.archive, true);
    assert.equal(item!.capabilities.delete, true);
    assert.equal(result.summary.total >= 1, true);
    assert.equal(result.summary.clientVisible >= 1, true);
  } finally {
    await cleanup(companyId);
  }
});

test("getReportCenterItems: cross-company isolation — company B never sees company A's evaluation", { skip: hasSupabase ? false : skipReason }, async () => {
  const { createAdEvaluationDraft, saveParsedEvaluation } = await import("../../../src/lib/marketing-intelligence/ad-evaluations.ts");
  const { getReportCenterItems } = await import("../../../src/lib/report-center.ts");
  const companyA = await makeFixtureCompany("IsoA");
  const companyB = await makeFixtureCompany("IsoB");
  try {
    const draft = await createAdEvaluationDraft({ companyId: companyA, promptText: "test" });
    await saveParsedEvaluation(companyA, draft.id, { claudeRawResponse: "raw", internalReport: SAMPLE_INTERNAL, clientReport: SAMPLE_CLIENT });
    const resultB = await getReportCenterItems(companyB);
    assert.equal(resultB.items.some((i) => i.sourceId === draft.id), false, "company B must never see company A's evaluation");
  } finally {
    await cleanup(companyA);
    await cleanup(companyB);
  }
});

test("setAdEvaluationStatus: archives and restores without deleting data; archiveAdEvaluation still works as a thin wrapper", { skip: hasSupabase ? false : skipReason }, async () => {
  const { createAdEvaluationDraft, saveParsedEvaluation, setAdEvaluationStatus, archiveAdEvaluation, getAdEvaluationById } = await import("../../../src/lib/marketing-intelligence/ad-evaluations.ts");
  const companyId = await makeFixtureCompany("ArchiveFlow");
  try {
    const draft = await createAdEvaluationDraft({ companyId, promptText: "test" });
    await saveParsedEvaluation(companyId, draft.id, { claudeRawResponse: "raw", internalReport: SAMPLE_INTERNAL, clientReport: SAMPLE_CLIENT });

    const archived = await archiveAdEvaluation(companyId, draft.id);
    assert.equal(archived.status, "archived");

    const restored = await setAdEvaluationStatus(companyId, draft.id, "evaluated");
    assert.equal(restored.status, "evaluated");
    assert.equal(restored.internal_report.executiveSummary, SAMPLE_INTERNAL.executiveSummary, "archiving/restoring must never touch report content");

    const stillThere = await getAdEvaluationById(companyId, draft.id);
    assert.ok(stillThere, "archive must never delete the row");
  } finally {
    await cleanup(companyId);
  }
});

test("setAdEvaluationStatus: rejects an invalid status and cross-company access", { skip: hasSupabase ? false : skipReason }, async () => {
  const { createAdEvaluationDraft, saveParsedEvaluation, setAdEvaluationStatus, AdEvaluationValidationError, AdEvaluationNotFoundError } = await import("../../../src/lib/marketing-intelligence/ad-evaluations.ts");
  const companyA = await makeFixtureCompany("StatusA");
  const companyB = await makeFixtureCompany("StatusB");
  try {
    const draft = await createAdEvaluationDraft({ companyId: companyA, promptText: "test" });
    await saveParsedEvaluation(companyA, draft.id, { claudeRawResponse: "raw", internalReport: SAMPLE_INTERNAL, clientReport: SAMPLE_CLIENT });
    await assert.rejects(() => setAdEvaluationStatus(companyA, draft.id, "not_a_real_status" as never), AdEvaluationValidationError);
    await assert.rejects(() => setAdEvaluationStatus(companyB, draft.id, "archived"), AdEvaluationNotFoundError);
  } finally {
    await cleanup(companyA);
    await cleanup(companyB);
  }
});

test("deleteAdEvaluation: physically removes the row (and only that row), company-scoped", { skip: hasSupabase ? false : skipReason }, async () => {
  const { createAdEvaluationDraft, saveParsedEvaluation, deleteAdEvaluation, getAdEvaluationById, AdEvaluationNotFoundError } = await import("../../../src/lib/marketing-intelligence/ad-evaluations.ts");
  const companyId = await makeFixtureCompany("DeleteFlow");
  try {
    const draft1 = await createAdEvaluationDraft({ companyId, promptText: "test" });
    await saveParsedEvaluation(companyId, draft1.id, { claudeRawResponse: "raw", internalReport: SAMPLE_INTERNAL, clientReport: SAMPLE_CLIENT });
    const draft2 = await createAdEvaluationDraft({ companyId, promptText: "test" });
    await saveParsedEvaluation(companyId, draft2.id, { claudeRawResponse: "raw", internalReport: SAMPLE_INTERNAL, clientReport: SAMPLE_CLIENT });

    await deleteAdEvaluation(companyId, draft1.id);
    await assert.rejects(() => getAdEvaluationById(companyId, draft1.id), AdEvaluationNotFoundError);
    const survivor = await getAdEvaluationById(companyId, draft2.id);
    assert.ok(survivor, "deleting one evaluation must never remove a sibling");
  } finally {
    await cleanup(companyId);
  }
});

test("deleteAdEvaluation: cross-company delete is rejected, never deletes another company's row", { skip: hasSupabase ? false : skipReason }, async () => {
  const { createAdEvaluationDraft, saveParsedEvaluation, deleteAdEvaluation, getAdEvaluationById, AdEvaluationNotFoundError } = await import("../../../src/lib/marketing-intelligence/ad-evaluations.ts");
  const companyA = await makeFixtureCompany("DelOwnA");
  const companyB = await makeFixtureCompany("DelOwnB");
  try {
    const draft = await createAdEvaluationDraft({ companyId: companyA, promptText: "test" });
    await saveParsedEvaluation(companyA, draft.id, { claudeRawResponse: "raw", internalReport: SAMPLE_INTERNAL, clientReport: SAMPLE_CLIENT });
    await assert.rejects(() => deleteAdEvaluation(companyB, draft.id), AdEvaluationNotFoundError);
    const stillThere = await getAdEvaluationById(companyA, draft.id);
    assert.ok(stillThere, "company B's failed delete attempt must never remove company A's row");
  } finally {
    await cleanup(companyA);
    await cleanup(companyB);
  }
});

test("PRODUCTION SAFETY — MY CAKE 45's real ad_strategies record is unaffected by this suite", { skip: hasSupabase ? false : skipReason }, async () => {
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const rows = await supabaseRest<Array<{ id: string; version: number }>>("ad_strategies?id=eq.f0861d43-fd8f-44d9-9d02-00f1c581af3d&select=id,version");
  if (rows.length) assert.equal(rows[0].version, 1);
});
