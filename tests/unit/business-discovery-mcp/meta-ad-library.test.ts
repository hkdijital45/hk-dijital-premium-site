import test from "node:test";
import assert from "node:assert/strict";

// checkMetaAdLibraryByName() is exercised against a stubbed global fetch —
// zero real Graph API calls. Verifies: cache hit/bypass, bounded retry on
// transient failures (429/5xx) vs no-retry on permanent auth failures
// (401/403-equivalent Graph error codes), and the distinct-page-id
// ambiguity check (false-positive protection for generic business names).

const originalFetch = globalThis.fetch;
const originalToken = process.env.META_AD_LIBRARY_ACCESS_TOKEN;
process.env.META_AD_LIBRARY_ACCESS_TOKEN = "test-token";

test.after(() => {
  globalThis.fetch = originalFetch;
  if (originalToken === undefined) delete process.env.META_AD_LIBRARY_ACCESS_TOKEN;
  else process.env.META_AD_LIBRARY_ACCESS_TOKEN = originalToken;
});

const { checkMetaAdLibraryByName } = await import("../../../src/lib/business-discovery.ts");

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function adsArchiveBody(ads: Array<{ page_name: string; page_id: string }>) {
  return { data: ads };
}

test("checkMetaAdLibraryByName: a successful single-business match is cached — the second call for the same name makes no new fetch", async () => {
  let calls = 0;
  globalThis.fetch = (async () => { calls += 1; return jsonResponse(adsArchiveBody([{ page_name: "Görke Tasarım", page_id: "111" }])); }) as typeof fetch;

  const first = await checkMetaAdLibraryByName("Görke Tasarım Cache Test");
  const second = await checkMetaAdLibraryByName("Görke Tasarım Cache Test");

  assert.equal(first.status, "active_signal");
  assert.deepEqual(second, first);
  assert.equal(calls, 1, "second call should be served from cache, not a new fetch");
});

test("checkMetaAdLibraryByName: forceRefresh bypasses the cache and makes a real new fetch", async () => {
  let calls = 0;
  globalThis.fetch = (async () => { calls += 1; return jsonResponse(adsArchiveBody([{ page_name: "Force Refresh Test", page_id: "222" }])); }) as typeof fetch;

  await checkMetaAdLibraryByName("Force Refresh Test");
  await checkMetaAdLibraryByName("Force Refresh Test", { forceRefresh: true });

  assert.equal(calls, 2);
});

test("checkMetaAdLibraryByName: a 429 rate limit is retried once and succeeds on the second attempt (bounded retry)", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    if (calls === 1) return jsonResponse({ error: { code: "4", message: "User request limit reached" } }, 429);
    return jsonResponse(adsArchiveBody([{ page_name: "Retry Success Test", page_id: "333" }]));
  }) as typeof fetch;

  const result = await checkMetaAdLibraryByName("Retry Success Test");

  assert.equal(calls, 2, "a rate-limited request should be retried exactly once");
  assert.equal(result.status, "active_signal");
});

test("checkMetaAdLibraryByName: a 401/token-invalid error is NEVER retried (no retry storm) and surfaces source_unavailable", async () => {
  let calls = 0;
  globalThis.fetch = (async () => { calls += 1; return jsonResponse({ error: { code: "190", message: "Error validating access token" } }, 401); }) as typeof fetch;

  const result = await checkMetaAdLibraryByName("Token Invalid Test");

  assert.equal(calls, 1, "a permanent auth failure must not be retried");
  assert.equal(result.status, "source_unavailable");
});

test("checkMetaAdLibraryByName: multiple distinct page_ids matching a generic name produce AMBIGUOUS, not a false active_signal", async () => {
  globalThis.fetch = (async () => jsonResponse(adsArchiveBody([
    { page_name: "Nail Studio Ambiguous Test", page_id: "aaa" },
    { page_name: "Nail Studio Ambiguous Test", page_id: "bbb" }
  ]))) as typeof fetch;

  const result = await checkMetaAdLibraryByName("Nail Studio Ambiguous Test");

  assert.equal(result.status, "ambiguous");
});

test("checkMetaAdLibraryByName: the same page_id repeated across multiple ads is a single confident business, not ambiguous", async () => {
  globalThis.fetch = (async () => jsonResponse(adsArchiveBody([
    { page_name: "Single Business Many Ads Test", page_id: "same-id" },
    { page_name: "Single Business Many Ads Test", page_id: "same-id" }
  ]))) as typeof fetch;

  const result = await checkMetaAdLibraryByName("Single Business Many Ads Test");

  assert.equal(result.status, "active_signal");
});
