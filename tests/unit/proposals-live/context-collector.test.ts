// Real-data integration test — run via `npm run test:proposals-live`
// (--env-file=.env.local, like test:pre-audit-versioning). Uses a real,
// known production lead (Abdulmalik Beyaz Eşya Teknik Servis,
// company_id IS NULL — never converted to a customer) confirmed present
// via a direct REST query before writing this test. This is exactly
// TEST 1/2 from the brief: a lead with a real pre-audit report but no
// company_id, so Instagram/ad-evaluation data structurally cannot exist
// and must be honestly reported as unavailable, never fabricated.
import test from "node:test";
import assert from "node:assert/strict";
import { collectLeadProposalContext } from "../../../src/lib/proposals/context-collector.ts";

const ABDULMALIK_LEAD_ID = "ae298378-783c-48e2-be92-764e8060a512";

test("collectLeadProposalContext: a real lead with no company_id yet — pre-audit may be present, Instagram/ad-eval are honestly unavailable, never fabricated", async () => {
  const context = await collectLeadProposalContext(ABDULMALIK_LEAD_ID);
  assert.equal(context.lead.id, ABDULMALIK_LEAD_ID);
  assert.equal(context.lead.company_id, null);
  assert.equal(context.completeness.instagram, false);
  assert.equal(context.completeness.adEvaluation, false);
  assert.ok(context.notes.some((n) => n.includes("müşteriye dönüştürülmediği için Instagram")));
  assert.ok(context.notes.some((n) => n.includes("müşteriye dönüştürülmediği için reklam değerlendirmesi")));
  assert.equal(context.instagram, null);
  assert.equal(context.adEvaluation, null);
});

test("collectLeadProposalContext: throws a clear error for a non-existent lead id rather than returning fabricated data", async () => {
  await assert.rejects(() => collectLeadProposalContext("00000000-0000-4000-8000-000000000000"), /Lead bulunamadı/);
});
