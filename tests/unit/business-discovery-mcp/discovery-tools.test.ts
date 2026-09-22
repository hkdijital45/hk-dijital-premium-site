// Run via `npm run test:business-discovery-mcp`. Originally covered the
// Claude/MCP customer-discovery tools (search_customer_discovery/
// get_customer_discovery_candidate/save_discovery_as_lead), which have
// been removed — the main Google Maps/Places Müşteri Keşfi screen, HK
// Opportunity Score, Lead'e Kaydet and Ön İnceleme flows are unaffected;
// only the Claude/MCP layer on top of them was removed. This file now
// guards against regression: the 3 tools must stay gone, the rest of the
// MCP connector must stay intact, and the admin route must keep working.
import test from "node:test";
import assert from "node:assert/strict";

test("REGRESSION — Claude customer-discovery MCP tools have been removed (23 tools remain, no duplicate names)", async () => {
  const { tools } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  const names = tools.map((t: any) => t.name);
  assert.equal(names.length, 23);
  assert.equal(new Set(names).size, names.length, "no duplicate tool names");
  for (const removed of ["search_customer_discovery", "get_customer_discovery_candidate", "save_discovery_as_lead"]) {
    assert.ok(!names.includes(removed), `${removed} must no longer be registered`);
  }
  for (const existing of ["get_pre_audit_context", "customer_list", "meta_ads_account", "get_instagram_account", "save_marketing_intelligence", "get_ads_strategy_context"]) {
    assert.ok(names.includes(existing), `pre-existing tool ${existing} must still be registered`);
  }
});

test("REGRESSION — execute() rejects the removed tool names as UNKNOWN_TOOL rather than silently handling them", async () => {
  const { execute, ControlError } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  for (const removed of ["search_customer_discovery", "get_customer_discovery_candidate", "save_discovery_as_lead"]) {
    await assert.rejects(
      () => execute(removed, {}),
      (error: unknown) => error instanceof ControlError && (error as InstanceType<typeof ControlError>).code === "UNKNOWN_TOOL"
    );
  }
});

test("REGRESSION — business-discovery.ts no longer exports the MCP-only discovery helpers", async () => {
  const discoveryModule = await import("../../../src/lib/business-discovery.ts");
  assert.equal((discoveryModule as any).getDiscoveryCandidateByPlaceId, undefined);
  assert.equal((discoveryModule as any).toDiscoverySummary, undefined);
  assert.equal((discoveryModule as any).toDiscoveryDetail, undefined);
  // Shared logic the admin route (and formerly the MCP tools) both used must remain.
  assert.equal(typeof discoveryModule.searchDiscoveryBusinesses, "function");
  assert.equal(typeof discoveryModule.saveDiscoveredBusinessesAsLeads, "function");
  assert.equal(typeof discoveryModule.businessesFromBody, "function");
});

test("REGRESSION — the admin business-discovery route still exports POST/PUT (UI path unaffected by the MCP cleanup)", async () => {
  const routeModule = await import("../../../src/app/api/admin/business-discovery/route.ts");
  assert.equal(typeof routeModule.POST, "function");
  assert.equal(typeof routeModule.PUT, "function");
});
