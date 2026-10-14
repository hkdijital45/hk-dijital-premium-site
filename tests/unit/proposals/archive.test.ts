import test from "node:test";
import assert from "node:assert/strict";
import { PROPOSAL_STATUSES } from "../../../src/lib/proposals/store.ts";

// archiveProposal/unarchiveProposal/listProposals's includeArchived
// filtering are thin wrappers around supabaseRest and are exercised for
// real against the actual archived Abdulmalik proposals in
// tests/unit/proposals-live/archive.test.ts. This file only asserts the
// status list itself never gained an "Arşivlendi" pseudo-status — archiving
// is a separate column (archived_at), never a CHECK-constrained status
// value, so an archived proposal keeps its real lifecycle status intact
// and reversing the archive never requires guessing what status to
// restore it to.
test("archiving is modeled as a separate column, never as a status value — PROPOSAL_STATUSES has no 'Arşivlendi' entry", () => {
  assert.ok(!(PROPOSAL_STATUSES as readonly string[]).includes("Arşivlendi"));
});
