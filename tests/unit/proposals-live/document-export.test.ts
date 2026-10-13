// Live regression test for the real "PDF indirilemedi" bug reported
// against production records TKL-2026-0001 (ce4187fc-b531-4adf-957e-
// ab8c78d84387) and TKL-2026-0002 (9f5ce810-71a5-4bda-85d1-6883f0579176)
// — both real, user-created Abdulmalik proposals. Confirmed root cause:
// Claude's real response stored budget_scenarios[].risks as a string[]
// (ProposalBudgetScenario declares it `string`) which crashed
// generatePdfBuffer with "text.split is not a function". This test reads
// the actual rows and generates actual documents — never modifies them.
import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { supabaseRest } from "../../../src/lib/supabase.ts";
import { buildProposalDocumentPayload } from "../../../src/lib/proposals/document.ts";
import { generatePdfBuffer, generateDocxBuffer } from "../../../src/lib/server/document-generator.ts";
import type { ProposalRecord } from "../../../src/lib/proposals/store.ts";

const REAL_PROPOSAL_IDS = ["ce4187fc-b531-4adf-957e-ab8c78d84387", "9f5ce810-71a5-4bda-85d1-6883f0579176"];

test("both real production Abdulmalik proposals export real, valid PDF and DOCX in both modes without crashing", async () => {
  for (const id of REAL_PROPOSAL_IDS) {
    const rows = await supabaseRest<ProposalRecord[]>(`proposals?id=eq.${id}&limit=1`);
    const proposal = rows[0];
    assert.ok(proposal, `expected to find real proposal ${id}`);
    for (const mode of ["client", "internal"] as const) {
      const payload = buildProposalDocumentPayload(proposal, mode);
      const pdf = await generatePdfBuffer(payload);
      assert.equal(pdf.subarray(0, 4).toString("latin1"), "%PDF");
      const loaded = await PDFDocument.load(pdf);
      assert.ok(loaded.getPageCount() >= 1);
      const docx = await generateDocxBuffer(payload);
      assert.equal(docx.subarray(0, 2).toString("latin1"), "PK");
    }
  }
});
