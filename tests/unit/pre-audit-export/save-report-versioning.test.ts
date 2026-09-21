// Run via `npm run test:pre-audit-versioning` — a real integration test
// against Supabase (needs SUPABASE_SERVICE_ROLE_KEY/NEXT_PUBLIC_SUPABASE_URL,
// loaded via --env-file=.env.local; skips gracefully if not configured, the
// same pattern tests/e2e/fixtures/qa-auth.ts uses for QA_ADMIN_* creds).
// Exercises the REAL savePreAuditReport() function (the one both the admin
// UI and the MCP save_pre_audit_report tool call) against a disposable test
// lead, proving the insert-vs-update fix end to end rather than only at the
// payload-shape level. All rows/lead created here are deleted again in a
// `finally`, regardless of pass/fail.
import test from "node:test";
import assert from "node:assert/strict";

const hasSupabaseConfig = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const skipReason = "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not available in this environment — live save-versioning coverage skipped rather than faked.";

test("savePreAuditReport: new pass inserts, reportId updates in place, analysisGroupId retry updates too, a real new pass still inserts", { skip: !hasSupabaseConfig ? skipReason : false }, async () => {
  const { savePreAuditReport } = await import("../../../src/lib/pre-audit/reports.ts");
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  type LeadRow = { id: string };
  const [lead] = await supabaseRest<LeadRow[]>("leads", {
    method: "POST",
    body: JSON.stringify({ name: `QA Versioning Test ${suffix}`, company: `QA Versioning Co ${suffix}`, email: `qa-versioning-${suffix}@example.com`, source: "contact", status: "Yeni" })
  });
  assert.ok(lead?.id);

  const createdIds: string[] = [];
  try {
    // 1) genuinely new research pass -> INSERT
    const first = await savePreAuditReport({ lead_id: lead.id, report_type: "INTERNAL_REPORT", title: "QA Versioning", executive_summary: "İlk analiz." });
    createdIds.push(first.report_id);
    assert.equal(first.updated, false, "a brand new research pass must insert, not update");

    await new Promise((resolve) => setTimeout(resolve, 1100)); // ensure updated_at (bumped later) differs from created_at at second granularity

    // 2) explicit reportId -> UPDATE the exact same row
    const second = await savePreAuditReport({ lead_id: lead.id, report_type: "INTERNAL_REPORT", title: "QA Versioning", executive_summary: "Güncellenmiş analiz (reportId ile)." }, undefined, first.report_id);
    assert.equal(second.updated, true, "an explicit reportId save must update, not insert");
    assert.equal(second.report_id, first.report_id, "the report id must be preserved across an update");

    // 3) same analysisGroupId + same report_type without reportId -> UPDATE (retry/duplicate-click protection)
    const third = await savePreAuditReport({ lead_id: lead.id, report_type: "INTERNAL_REPORT", title: "QA Versioning", executive_summary: "Tekrar deneme (analysisGroupId ile)." }, first.analysis_group_id);
    assert.equal(third.updated, true, "a retried save under the same analysis_group_id + report_type must update, not create a duplicate");
    assert.equal(third.report_id, first.report_id);

    // Exactly ONE row exists for this lead+report_type so far.
    const afterUpdates = await supabaseRest<Array<{ id: string; created_at: string; updated_at: string }>>(
      `pre_audit_reports?lead_id=eq.${lead.id}&report_type=eq.INTERNAL_REPORT&select=id,created_at,updated_at`
    );
    assert.equal(afterUpdates.length, 1, "updates must never create a duplicate row");
    assert.equal(afterUpdates[0].id, first.report_id);
    assert.equal(afterUpdates[0].created_at, first.created_at, "created_at must never change across updates");
    assert.notEqual(afterUpdates[0].updated_at, afterUpdates[0].created_at, "updated_at must change after a real update");

    // 4) a genuinely new, later research pass (no reportId, no analysisGroupId) -> a real second row
    const fourth = await savePreAuditReport({ lead_id: lead.id, report_type: "INTERNAL_REPORT", title: "QA Versioning — Yeni Analiz", executive_summary: "Tamamen yeni bir araştırma turu." });
    createdIds.push(fourth.report_id);
    assert.equal(fourth.updated, false, "a deliberate new pass (no reportId/analysisGroupId match) must insert a real second row");
    assert.notEqual(fourth.report_id, first.report_id);

    const finalRows = await supabaseRest<Array<{ id: string }>>(`pre_audit_reports?lead_id=eq.${lead.id}&report_type=eq.INTERNAL_REPORT&select=id`);
    assert.equal(finalRows.length, 2, "one updated report + one genuinely new report = two rows total, not three or four");
  } finally {
    for (const id of createdIds) await supabaseRest(`pre_audit_reports?id=eq.${id}`, { method: "DELETE" }).catch(() => {});
    await supabaseRest(`leads?id=eq.${lead.id}`, { method: "DELETE" }).catch(() => {});
  }
});

test("listPreAuditReports: returns updated_at alongside created_at for list-view timestamps", { skip: !hasSupabaseConfig ? skipReason : false }, async () => {
  const { listPreAuditReports } = await import("../../../src/lib/pre-audit/reports.ts");
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  type LeadRow = { id: string };
  const [lead] = await supabaseRest<LeadRow[]>("leads", {
    method: "POST",
    body: JSON.stringify({ name: `QA List Test ${suffix}`, company: `QA List Co ${suffix}`, email: `qa-list-${suffix}@example.com`, source: "contact", status: "Yeni" })
  });

  try {
    const { savePreAuditReport } = await import("../../../src/lib/pre-audit/reports.ts");
    const saved = await savePreAuditReport({ lead_id: lead.id, report_type: "CLIENT_REPORT", title: "QA List", executive_summary: "Test." });
    const rows = await listPreAuditReports(undefined, undefined, 200, lead.id);
    const row = rows.find((r) => r.id === saved.report_id);
    assert.ok(row, "saved report must appear in listPreAuditReports");
    assert.ok(row!.created_at, "created_at must be present");
    assert.ok(row!.updated_at, "updated_at must now be selected for the report list");
    await supabaseRest(`pre_audit_reports?id=eq.${saved.report_id}`, { method: "DELETE" }).catch(() => {});
  } finally {
    await supabaseRest(`leads?id=eq.${lead.id}`, { method: "DELETE" }).catch(() => {});
  }
});
