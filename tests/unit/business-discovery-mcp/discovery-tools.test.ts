// Run via `npm run test:business-discovery-mcp` — a real integration test
// (real Google Maps API + real Supabase, loaded via --env-file=.env.local)
// against the actual MCP dispatcher (execute() in protocol.ts), the same
// path Claude's "HK Dijital — Müşteri Keşfi" connector calls through. Skips
// gracefully without GOOGLE_MAPS_API_KEY/Supabase credentials, same pattern
// as tests/e2e/fixtures/qa-auth.ts and the existing
// tests/unit/pre-audit-export/save-report-versioning.test.ts.
import test from "node:test";
import assert from "node:assert/strict";

const hasGoogleMaps = Boolean(process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY);
const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const skip = !hasGoogleMaps || !hasSupabase;
const skipReason = "GOOGLE_MAPS_API_KEY / Supabase credentials not available in this environment — live discovery-tools coverage skipped rather than faked.";

test("REGRESSION — all 26 MCP tools registered (23 existing + 3 new discovery tools), no duplicate names", async () => {
  const { tools } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  const names = tools.map((t: any) => t.name);
  assert.equal(names.length, 26);
  assert.equal(new Set(names).size, names.length, "no duplicate tool names");
  for (const existing of ["get_pre_audit_context", "customer_list", "meta_ads_account", "get_instagram_account"]) {
    assert.ok(names.includes(existing), `pre-existing tool ${existing} must still be registered`);
  }
  for (const added of ["search_customer_discovery", "get_customer_discovery_candidate", "save_discovery_as_lead"]) {
    assert.ok(names.includes(added));
  }
});

test("SECURITY — search/candidate tools are READ_ONLY, save is WRITE_SAFE, save requires placeId", async () => {
  const { tools } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  const byName = Object.fromEntries(tools.map((t: any) => [t.name, t]));
  assert.equal(byName.search_customer_discovery.permission, "READ_ONLY");
  assert.equal(byName.get_customer_discovery_candidate.permission, "READ_ONLY");
  assert.equal(byName.save_discovery_as_lead.permission, "WRITE_SAFE");
  assert.deepEqual(byName.save_discovery_as_lead.inputSchema.required, ["placeId"]);
  assert.match(byName.save_discovery_as_lead.description, /explicitly/i);
});

test("A) SEARCH — real Google Maps results, compact shape, no fake data", { skip: skip ? skipReason : false }, async () => {
  const { execute } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  const result: any = await execute("search_customer_discovery", { sector: "Güzellik Merkezi", city: "Manisa", limit: 3 });
  assert.ok(Array.isArray(result.businesses));
  assert.ok(result.businesses.length <= 3);
  assert.equal(typeof result.districtLabel, "string");
  for (const business of result.businesses) {
    assert.ok(business.placeId, "every real result must carry a real Google placeId");
    assert.ok(business.name);
    // compact shape: heavy/noisy fields must NOT leak into search results
    assert.equal(business.outreach, undefined);
    assert.equal(business.scoreBreakdown, undefined);
    assert.equal(business.salesRecommendation, undefined);
  }
});

test("A2) SEARCH — sector/city are required, matching the admin UI's own validation", async () => {
  const { execute, ControlError } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  await assert.rejects(() => execute("search_customer_discovery", { city: "Manisa" }), (error: unknown) => {
    assert.ok(error instanceof ControlError || error instanceof Error);
    return true;
  });
});

test("B) CANDIDATE — a real placeId returns full detail; an invalid placeId returns not_found, never a crash or fake data", { skip: skip ? skipReason : false }, async () => {
  const { execute } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  const search: any = await execute("search_customer_discovery", { sector: "Güzellik Merkezi", city: "Manisa", limit: 1 });
  if (!search.businesses.length) return; // legitimate zero-results — nothing to fetch detail for
  const placeId = search.businesses[0].placeId;

  const candidate: any = await execute("get_customer_discovery_candidate", { placeId, sector: "Güzellik Merkezi", city: "Manisa" });
  assert.equal(candidate.placeId, placeId);
  assert.ok(candidate.name);
  assert.equal(typeof candidate.opportunityScore, "number");

  const notFound: any = await execute("get_customer_discovery_candidate", { placeId: "ChIJ_totally_invalid_place_id_00000" });
  assert.equal(notFound.status, "not_found");
});

test("C) SAVE — saving a real candidate creates exactly one lead, and saving it again returns already_exists (no duplicate)", { skip: skip ? skipReason : false }, async () => {
  const { execute } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");

  const search: any = await execute("search_customer_discovery", { sector: "Güzellik Merkezi", city: "Manisa", limit: 1 });
  if (!search.businesses.length) return;
  const placeId = search.businesses[0].placeId;
  let leadId: string | null = null;

  try {
    const first: any = await execute("save_discovery_as_lead", { placeId, sector: "Güzellik Merkezi", city: "Manisa" });
    assert.equal(first.ok, true);
    assert.equal(first.already_exists, false);
    assert.ok(first.lead_id);
    leadId = first.lead_id;

    const rows = await supabaseRest<Array<{ id: string; google_place_id: string }>>(`leads?google_place_id=eq.${encodeURIComponent(placeId)}&select=id,google_place_id`);
    assert.equal(rows.length, 1, "exactly one lead row must exist for this placeId");
    assert.equal(rows[0].id, leadId);

    // Calling save again for the SAME business must not create a second lead.
    const second: any = await execute("save_discovery_as_lead", { placeId, sector: "Güzellik Merkezi", city: "Manisa" });
    assert.equal(second.already_exists, true);
    assert.equal(second.lead_id, leadId);

    const rowsAfter = await supabaseRest<Array<{ id: string }>>(`leads?google_place_id=eq.${encodeURIComponent(placeId)}&select=id`);
    assert.equal(rowsAfter.length, 1, "a retried save must never create a duplicate lead");
  } finally {
    if (leadId) await supabaseRest(`leads?id=eq.${leadId}`, { method: "DELETE" }).catch(() => {});
  }
});

test("REGRESSION — the admin business-discovery route still exports POST/PUT (UI path unaffected by the extraction)", async () => {
  const routeModule = await import("../../../src/app/api/admin/business-discovery/route.ts");
  assert.equal(typeof routeModule.POST, "function");
  assert.equal(typeof routeModule.PUT, "function");
});
