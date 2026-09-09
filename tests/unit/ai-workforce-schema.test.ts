import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregateCostByKey, buildDirectorPrompt, classifyExecutionStatus, computeNextRunAt,
  isAiWorkforceHost, mapAgentKeyToTaskType, normalizePreferredProvider, resolveAiWorkforceHostPathname,
  rewriteAiWorkforcePath, sumEstimatedCost
} from "../../src/lib/ai-workforce-schema.ts";

test("mapAgentKeyToTaskType: known hk_virtual_agents keys map to a real AgentTaskType", () => {
  assert.equal(mapAgentKeyToTaskType("seo_specialist"), "seo_analysis");
  assert.equal(mapAgentKeyToTaskType("google_ads_specialist"), "ad_analysis");
  assert.equal(mapAgentKeyToTaskType("reporting_manager"), "customer_report");
});

test("mapAgentKeyToTaskType: an unknown agent key falls back to workflow_task instead of throwing", () => {
  assert.equal(mapAgentKeyToTaskType("unknown_future_agent"), "workflow_task");
});

test("normalizePreferredProvider: the seeded 'claude' value is aliased to the real AgentProviderKey 'anthropic'", () => {
  assert.equal(normalizePreferredProvider("claude"), "anthropic");
});

test("normalizePreferredProvider: 'auto', empty, and unrecognized values all resolve to 'auto'", () => {
  assert.equal(normalizePreferredProvider("auto"), "auto");
  assert.equal(normalizePreferredProvider(null), "auto");
  assert.equal(normalizePreferredProvider("made_up_provider"), "auto");
});

test("normalizePreferredProvider: a genuine known provider key passes through unchanged", () => {
  assert.equal(normalizePreferredProvider("gemini"), "gemini");
});

test("buildDirectorPrompt: a custom prompt is used verbatim", () => {
  assert.equal(buildDirectorPrompt({ agentName: "CEO", roleLabel: "HK Intelligence CEO", customPrompt: "Özel görev metni" }), "Özel görev metni");
});

test("buildDirectorPrompt: without a custom prompt, a real (non-fabricated-data) default prompt is generated, scoped to the company when given", () => {
  const withCompany = buildDirectorPrompt({ agentName: "SEO Uzmanı", roleLabel: "SEO ve teknik görünürlük uzmanı", companyId: "abc-123" });
  assert.match(withCompany, /bu müşteri için/);
  const withoutCompany = buildDirectorPrompt({ agentName: "SEO Uzmanı", roleLabel: "SEO ve teknik görünürlük uzmanı" });
  assert.match(withoutCompany, /ajans genelinde/);
});

test("classifyExecutionStatus: read/suggest/draft never need execution regardless of decision", () => {
  assert.equal(classifyExecutionStatus("read", "approved"), "not_applicable");
  assert.equal(classifyExecutionStatus("suggest", "approved"), "not_applicable");
  assert.equal(classifyExecutionStatus("draft", "approved"), "not_applicable");
});

test("classifyExecutionStatus: a rejected item is always not_applicable, even a destructive one", () => {
  assert.equal(classifyExecutionStatus("destructive", "rejected"), "not_applicable");
});

test("classifyExecutionStatus: an approved internal_write action is marked executed (it really runs)", () => {
  assert.equal(classifyExecutionStatus("internal_write", "approved"), "executed");
});

test("classifyExecutionStatus: approved external_write/destructive actions are honestly marked execution_unavailable, never faked as executed", () => {
  assert.equal(classifyExecutionStatus("external_write", "approved"), "execution_unavailable");
  assert.equal(classifyExecutionStatus("destructive", "approved"), "execution_unavailable");
});

test("aggregateCostByKey: sums cost/tokens per key and sorts by cost descending", () => {
  const result = aggregateCostByKey([
    { key: "gemini", estimated_cost: 0.5, tokens_used: 100 },
    { key: "groq", estimated_cost: 2, tokens_used: 50 },
    { key: "gemini", estimated_cost: 0.3, tokens_used: 80 }
  ]);
  assert.deepEqual(result.map((row) => row.key), ["groq", "gemini"]);
  const gemini = result.find((row) => row.key === "gemini");
  assert.equal(gemini?.estimatedCost, 0.8);
  assert.equal(gemini?.tokensUsed, 180);
  assert.equal(gemini?.runCount, 2);
});

test("sumEstimatedCost: null/undefined costs are treated as zero, never NaN", () => {
  assert.equal(sumEstimatedCost([{ estimated_cost: 1.5 }, { estimated_cost: null }, {}]), 1.5);
});

test("isAiWorkforceHost: exact-matches only, so a lookalike subdomain is never mistaken for it", () => {
  assert.equal(isAiWorkforceHost("ai.hkdijital.com.tr"), true);
  assert.equal(isAiWorkforceHost("ai.hkdijital.com.tr:443"), true);
  assert.equal(isAiWorkforceHost("aiden.hkdijital.com.tr"), false);
  assert.equal(isAiWorkforceHost("www.hkdijital.com.tr"), false);
  assert.equal(isAiWorkforceHost(null), false);
});

test("rewriteAiWorkforcePath: maps clean root/section paths into the /ai-workforce route group, idempotently", () => {
  assert.equal(rewriteAiWorkforcePath("/"), "/ai-workforce");
  assert.equal(rewriteAiWorkforcePath("/agents"), "/ai-workforce/agents");
  assert.equal(rewriteAiWorkforcePath("/ai-workforce/agents"), "/ai-workforce/agents");
});

test("rewriteAiWorkforcePath: never rewrites the login passthrough paths — otherwise a visitor with no session on this host-only-cookie subdomain could never reach a login page", () => {
  assert.equal(rewriteAiWorkforcePath("/giris"), "/giris");
  assert.equal(rewriteAiWorkforcePath("/digital-center"), "/digital-center");
  assert.equal(rewriteAiWorkforcePath("/login"), "/login");
});

// Regression coverage for the production ERR_TOO_MANY_REDIRECTS bug on
// ai.hkdijital.com.tr: the Secret Access Control Center's gate-failure
// redirect target is "/", and rewriteAiWorkforcePath("/") used to
// unconditionally become "/ai-workforce" (itself a gated prefix), so an
// unauthorized visitor bounced from "/ai-workforce" to "/" would
// immediately be routed right back to "/ai-workforce" and fail the gate
// again — forever.
test("resolveAiWorkforceHostPathname: an unauthorized visitor to root stays at '/' — the exact fix for the ERR_TOO_MANY_REDIRECTS production loop", () => {
  assert.equal(resolveAiWorkforceHostPathname("/", false), "/");
});

test("resolveAiWorkforceHostPathname: an already-authorized visitor to root lands on the Control Center", () => {
  assert.equal(resolveAiWorkforceHostPathname("/", true), "/ai-workforce");
});

test("resolveAiWorkforceHostPathname: a direct deep link is unaffected by root authorization and is always rewritten/gated normally", () => {
  assert.equal(resolveAiWorkforceHostPathname("/ai-workforce", false), "/ai-workforce");
  assert.equal(resolveAiWorkforceHostPathname("/agents", false), "/ai-workforce/agents");
  assert.equal(resolveAiWorkforceHostPathname("/agents", true), "/ai-workforce/agents");
});

test("resolveAiWorkforceHostPathname: login passthrough paths are never touched regardless of root authorization, so hk_return always resolves without recursing", () => {
  assert.equal(resolveAiWorkforceHostPathname("/giris", false), "/giris");
  assert.equal(resolveAiWorkforceHostPathname("/digital-center", false), "/digital-center");
});

test("computeNextRunAt: daily frequency advances exactly one day at the configured time", () => {
  // Constructed from local-time components (not a UTC 'Z' literal) so this
  // matches computeNextRunAt's own local getDay()/setHours() arithmetic
  // regardless of the machine's timezone.
  const from = new Date(2026, 8, 8, 20, 0, 0);
  const next = new Date(computeNextRunAt({ frequency: "daily", time: "09:00", from }));
  assert.equal(next.getDate(), from.getDate() + 1);
  assert.equal(next.getHours(), 9);
});

test("computeNextRunAt: weekly frequency lands on the next occurrence of the configured weekday, not today again", () => {
  const monday = new Date(2026, 8, 7, 5, 0, 0); // local Monday (verified: 2026-09-07 is a Monday)
  assert.equal(monday.getDay(), 1);
  const next = new Date(computeNextRunAt({ frequency: "weekly", day: "Pazartesi", time: "09:00", from: monday }));
  assert.notEqual(next.toDateString(), monday.toDateString());
  const diffDays = Math.round((next.getTime() - monday.getTime()) / 86400000);
  assert.equal(diffDays, 7);
});


test("AI host preserves admin fallbacks, customer/auth flows, private paths and assets", () => {
  for (const path of ["/hk-admin", "/hk-admin/iletisim-merkezi", "/musteri-paneli", "/sifre-sifirla", "/sifre-degistir", "/private-entry", "/logo.svg", "/ai-workforce-other"]) {
    assert.equal(resolveAiWorkforceHostPathname(path, true), path);
    assert.equal(resolveAiWorkforceHostPathname(path, false), path);
  }
});

test("AI host aliases only exact product section segments", () => {
  for (const section of ["agents", "director", "tasks", "approvals", "automations", "memory", "reports", "integrations", "cost", "activity"]) {
    assert.equal(rewriteAiWorkforcePath(`/${section}`), `/ai-workforce/${section}`);
    assert.equal(rewriteAiWorkforcePath(`/${section}/detail`), `/ai-workforce/${section}/detail`);
    assert.equal(rewriteAiWorkforcePath(`/${section}-other`), `/${section}-other`);
  }
});

test("configured private login takes priority over a product alias", () => {
  assert.equal(resolveAiWorkforceHostPathname("/agents", false, "agents"), "/agents");
  assert.equal(resolveAiWorkforceHostPathname("/agents", true, "/agents"), "/agents");
});
