import test from "node:test";
import assert from "node:assert/strict";
import { isArchivedPreAuditReport, validatePreAuditReportPatch } from "../../src/lib/pre-audit/report-actions.ts";

test("archive and restore map to the existing status column without touching content", () => {
  assert.deepEqual(validatePreAuditReportPatch({ archived: true }), { ok: true, patch: { status: "archived" } });
  assert.deepEqual(validatePreAuditReportPatch({ archived: false }), { ok: true, patch: { status: "draft" } });
  assert.equal(isArchivedPreAuditReport({ status: "archived" }), true);
  assert.equal(isArchivedPreAuditReport({ status: "draft" }), false);
});

test("title and sales notes are trimmed and length-limited", () => {
  const ok = validatePreAuditReportPatch({ title: "  Yeni Başlık  ", sales_notes: "  not  " });
  assert.deepEqual(ok, { ok: true, patch: { title: "Yeni Başlık", sales_notes: "not" } });
  assert.equal(validatePreAuditReportPatch({ title: "   " }).ok, false);
  assert.equal(validatePreAuditReportPatch({ title: "a".repeat(201) }).ok, false);
  assert.equal(validatePreAuditReportPatch({ sales_notes: "a".repeat(5001) }).ok, false);
});

test("an empty or unknown-only patch is rejected, so nothing is written by accident", () => {
  assert.equal(validatePreAuditReportPatch({}).ok, false);
  assert.equal(validatePreAuditReportPatch({ company_id: "x" }).ok, false);
  assert.equal(validatePreAuditReportPatch(null).ok, false);
  assert.equal(validatePreAuditReportPatch({ archived: "yes" }).ok, false);
});
