import test from "node:test";
import assert from "node:assert/strict";

// runOrganicGrowthAutopilot() exercised against a stubbed global fetch —
// zero real Supabase/AI calls. Run via `npm run test:organic-growth-autopilot`
// (needs the react-server condition for its @/ imports).

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fake-project.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "fake-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "fake-service-role-key";
delete process.env.ANTHROPIC_API_KEY;
delete process.env.GEMINI_API_KEY;
delete process.env.GOOGLE_API_KEY;
delete process.env.OPENAI_API_KEY;

const originalFetch = globalThis.fetch;
test.after(() => { globalThis.fetch = originalFetch; });

const { runOrganicGrowthAutopilot } = await import("../../../src/lib/organic-growth/autopilot.ts");

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** A minimal, deterministic fake of the exact Supabase REST calls this
 * safety-path exercises — settings read + one generation-run insert/patch —
 * nothing further, since the provider check must short-circuit everything
 * after it (content-plan items, blog_posts, notifications are never
 * touched when no AI provider is configured). */
function fakeFetch(calls: string[]) {
  return (async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    calls.push(url);
    if (url.includes("/rest/v1/organic_growth_settings")) {
      return jsonResponse([{ id: "default", automation_enabled: true, generation_days: ["mon", "thu"], default_language: "tr", min_word_count: 500, updated_at: "2026-10-08T00:00:00.000Z", updated_by: null }]);
    }
    if (url.includes("/rest/v1/organic_generation_runs")) {
      return jsonResponse([{ id: "run-1", trigger: "manual", run_date: "2026-10-08", status: "running", started_at: "2026-10-08T00:00:00.000Z" }]);
    }
    throw new Error(`Unexpected fetch in provider-unavailable test: ${url}`);
  }) as typeof fetch;
}

test("runOrganicGrowthAutopilot: with no AI provider configured, fails at provider-check BEFORE touching any content-plan/blog data (never fabricates a draft)", async () => {
  const calls: string[] = [];
  globalThis.fetch = fakeFetch(calls);

  const outcome = await runOrganicGrowthAutopilot("manual", "qa.admin@hkdijital.com.tr");

  assert.equal(outcome.status, "failed");
  if (outcome.status === "failed") {
    assert.equal(outcome.step, "provider-check");
    assert.match(outcome.error, /AI sağlayıcısı/);
  }
  assert.ok(!calls.some((url) => url.includes("organic_content_plan_items")), "must never load the content-plan backlog without a usable provider");
  assert.ok(!calls.some((url) => url.includes("blog_posts")), "must never touch blog_posts without a usable provider");
});

test("runOrganicGrowthAutopilot: a cron trigger with automation disabled in settings is skipped before any lock/run row is created", async () => {
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    calls.push(url);
    if (url.includes("/rest/v1/organic_growth_settings")) {
      return jsonResponse([{ id: "default", automation_enabled: false, generation_days: ["mon", "thu"], default_language: "tr", min_word_count: 500, updated_at: "2026-10-08T00:00:00.000Z", updated_by: null }]);
    }
    throw new Error(`Unexpected fetch when automation is disabled: ${url}`);
  }) as typeof fetch;

  const outcome = await runOrganicGrowthAutopilot("cron");

  assert.equal(outcome.status, "skipped");
  assert.ok(!calls.some((url) => url.includes("organic_generation_runs")), "must not even start a run row when automation is disabled for the scheduled trigger");
});
