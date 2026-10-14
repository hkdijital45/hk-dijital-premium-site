// Live regression test for reversible proposal archiving — requested:
// remove TKL-2026-0001 (ce4187fc-b531-4adf-957e-ab8c78d84387) and
// TKL-2026-0002 (9f5ce810-71a5-4bda-85d1-6883f0579176), both real
// Abdulmalik test proposals, from the active Teklif Merkezi list without
// deleting them. Requires supabase/migrations/20261014_proposals_archive.sql
// to have been applied (adds archived_at/archived_by and archives these
// exact two rows) — this session has no direct Postgres/DDL access, so
// that migration could only be prepared, not executed, from here. This
// test skips itself with a clear reason if the column isn't live yet,
// rather than failing opaquely.
import test from "node:test";
import { supabaseRest } from "../../../src/lib/supabase.ts";
import { listProposals } from "../../../src/lib/proposals/store.ts";
import assert from "node:assert/strict";

const LEAD_ID = "ae298378-783c-48e2-be92-764e8060a512";
const ARCHIVED_IDS = ["ce4187fc-b531-4adf-957e-ab8c78d84387", "9f5ce810-71a5-4bda-85d1-6883f0579176"];

async function archivedColumnExists(): Promise<boolean> {
  try {
    await supabaseRest("proposals?limit=1&select=archived_at");
    return true;
  } catch {
    return false;
  }
}

test("TKL-2026-0001/0002 are archived and excluded from the default active list, while the Lead and its other data are untouched", async (t) => {
  if (!(await archivedColumnExists())) {
    t.skip("supabase/migrations/20261014_proposals_archive.sql not yet applied to production — archived_at column does not exist yet.");
    return;
  }

  const defaultList = await listProposals({ leadId: LEAD_ID });
  for (const id of ARCHIVED_IDS) {
    assert.ok(!defaultList.some((p) => p.id === id), `${id} must not appear in the default (non-archived) list`);
  }

  const fullList = await listProposals({ leadId: LEAD_ID, includeArchived: true });
  for (const id of ARCHIVED_IDS) {
    const row = fullList.find((p) => p.id === id);
    assert.ok(row, `${id} must still exist (archiving is never deletion)`);
    assert.ok(row!.archived_at, `${id} must have archived_at set`);
  }

  const leadRows = await supabaseRest<Array<{ id: string; deleted_at: string | null }>>(`leads?id=eq.${LEAD_ID}&select=id,deleted_at`);
  assert.equal(leadRows[0]?.id, LEAD_ID, "the real Abdulmalik lead itself must still exist");
  assert.equal(leadRows[0]?.deleted_at, null, "the lead must not have been soft-deleted");
});
