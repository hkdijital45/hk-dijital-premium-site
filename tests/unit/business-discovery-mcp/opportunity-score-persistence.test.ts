// HK Opportunity Score explainability — persistence regression. Run via
// `npm run test:business-discovery-mcp` (needs the react-server condition
// for business-discovery.ts's @/ imports; buildLeadRowFromBusiness makes
// no network/DB call, so no credentials are required).
import test from "node:test";
import assert from "node:assert/strict";

test("buildLeadRowFromBusiness REGRESSION — opportunityScoreBreakdown/levelLabel/unknownSignals are persisted into discovery_evidence (existing JSONB column, no migration)", async () => {
  const { buildLeadRowFromBusiness } = await import("../../../src/lib/business-discovery.ts");
  const business = {
    name: "Test Nail Studio", placeId: "abc123", city: "Manisa", district: "Şehzadeler", category: "Nail Salon",
    googleRating: 4.7, reviewCount: 10, phone: "0532 000 00 00", address: "Manisa, Şehzadeler",
    opportunityScoreBreakdown: [{ key: "heat-0", label: "Temel fırsat sinyali", points: 15, reason: "...", status: "neutral" }],
    opportunityScoreLevelLabel: "Yüksek Fırsat",
    opportunityScoreUnknownSignals: ["Instagram hesabı doğrulanamadı."]
  };
  const row = buildLeadRowFromBusiness(business, { sector: "Nail Salon", city: "Manisa" });
  assert.ok(Array.isArray(row.discovery_evidence.opportunityScoreBreakdown));
  assert.ok(row.discovery_evidence.opportunityScoreBreakdown.length > 0);
  assert.equal(row.discovery_evidence.opportunityScoreLevelLabel, "Yüksek Fırsat");
  assert.deepEqual(row.discovery_evidence.opportunityScoreUnknownSignals, ["Instagram hesabı doğrulanamadı."]);
});

test("buildLeadRowFromBusiness REGRESSION — missing opportunityScoreBreakdown (legacy caller) never crashes, just persists an empty array", async () => {
  const { buildLeadRowFromBusiness } = await import("../../../src/lib/business-discovery.ts");
  const row = buildLeadRowFromBusiness({ name: "Legacy İşletme", placeId: "xyz" }, { sector: "Kuaför", city: "Manisa" });
  assert.deepEqual(row.discovery_evidence.opportunityScoreBreakdown, []);
});
