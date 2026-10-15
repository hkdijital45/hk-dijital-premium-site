import test from "node:test";
import assert from "node:assert/strict";

// MCP backward compatibility: businessUnitId is an OPTIONAL extra input —
// never required — on every business-aware tool, and no tool was added or
// removed.
test("business-aware MCP tools accept optional businessUnitId; required inputs unchanged", async () => {
  const { tools } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  const byName = Object.fromEntries(tools.map((t: any) => [t.name, t]));
  const names = [
    "get_lead_instagram_evaluation_context", "save_lead_instagram_evaluation", "get_lead_instagram_evaluations",
    "get_pre_audit_context", "save_pre_audit_report", "get_latest_pre_audit_report",
    "get_candidate_evaluation_context", "save_candidate_evaluation", "get_latest_candidate_evaluation"
  ];
  for (const name of names) {
    const schema = byName[name]?.inputSchema;
    assert.ok(schema, `${name} registered`);
    assert.ok(schema.properties.businessUnitId, `${name} accepts businessUnitId`);
    assert.equal((schema.required || []).includes("businessUnitId"), false, `${name} must not require businessUnitId`);
  }
  assert.deepEqual(byName.save_lead_instagram_evaluation.inputSchema.required, ["leadId"]);
  assert.equal(tools.length, 43);
});
