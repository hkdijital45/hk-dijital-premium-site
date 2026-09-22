// Müşteri Avı Final Workflow — "Kaydet" must place a discovery candidate
// into the Değerlendirme Havuzu (evaluation pool), not directly into
// Lead Merkezi's sales pipeline. Run via `npm run test:business-discovery-mcp`
// (needs the react-server condition for business-discovery.ts's @/ imports;
// buildLeadRowFromBusiness itself makes no network/DB call, so no
// credentials are required).
import test from "node:test";
import assert from "node:assert/strict";

test("buildLeadRowFromBusiness REGRESSION — Kaydet sets status/lead_stage to the evaluation-gate status, not 'Yeni Lead'", async () => {
  const { buildLeadRowFromBusiness } = await import("../../../src/lib/business-discovery.ts");
  const { DISCOVERY_WORKFLOW_STATUS } = await import("../../../src/lib/discovery-workflow.ts");
  const row = buildLeadRowFromBusiness(
    { name: "Test Güzellik Salonu", placeId: "abc123", city: "Manisa", district: "Şehzadeler", category: "Güzellik Salonu", googleRating: 4.5, reviewCount: 20 },
    { sector: "Güzellik Salonu", city: "Manisa" }
  );
  assert.equal(row.status, DISCOVERY_WORKFLOW_STATUS.SAVED_FOR_REVIEW);
  assert.equal(row.lead_stage, DISCOVERY_WORKFLOW_STATUS.SAVED_FOR_REVIEW);
  assert.notEqual(row.status, "Yeni Lead");
});
