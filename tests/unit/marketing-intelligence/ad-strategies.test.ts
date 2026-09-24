// Reklam Stratejisi Operasyon Sistemi — ad_strategies data layer, MCP
// registration, and document export. Run via:
//   node --env-file=.env.local --conditions=react-server --import tsx --test tests/unit/marketing-intelligence/ad-strategies.test.ts
//
// NOTE: tests marked "requires ad_strategies migration" depend on
// supabase/migrations/20260925_ad_strategies.sql having been applied to
// this environment's database (the assistant never applies migrations to
// production itself — see the final report). Until then they fail with a
// PGRST205 "table not found" error, same as every other new-table feature
// in this codebase before its migration is applied.
import test from "node:test";
import assert from "node:assert/strict";

const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const skipReason = "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not available in this environment — live coverage skipped rather than faked.";
const MY_CAKE_45_COMPANY_ID = "fc51d411-ea37-45e4-9c93-df0cd43a4a42";

function validStrategyInput(companyId: string) {
  return {
    companyId,
    dataSources: ["instagram", "meta_ads"],
    dataPeriod: { start: "2026-08-01", end: "2026-09-01" },
    confidence: "medium",
    businessSummary: "Butik pasta işletmesi için yerel farkındalık ve lead üretimi hedefleniyor.",
    metaStrategy: { recommended: true, rationale: "Instagram Direct üzerinden lead toplama uygun.", audience: "25-40 yaş yerel kadın" },
    googleStrategy: { recommended: false, rationale: "Arama hacmi düşük, öncelik değil." },
    budget: { hasHistoricalPerformance: false, totalMonthlyRecommended: 15000, platformSplit: { meta: 100, google: 0 }, rationale: "Test bütçesi." },
    kpis: ["CPL", "Qualified Lead"],
    thirtyDayPlan: [{ phase: "Hafta 1-2", description: "Kreatif test ve öğrenme fazı." }]
  };
}

// --- Pure / no-DB coverage ---

test("MCP REGRESSION — save_ads_strategy_plan/get_latest_ads_strategy_plan/update_ads_strategy_status are registered with the right permissions and required fields", async () => {
  const { tools } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  const byName = Object.fromEntries(tools.map((t: any) => [t.name, t]));
  assert.equal(byName.save_ads_strategy_plan.permission, "WRITE_SAFE");
  assert.deepEqual(byName.save_ads_strategy_plan.inputSchema.required, ["strategy"]);
  assert.equal(byName.get_latest_ads_strategy_plan.permission, "READ_ONLY");
  assert.ok(byName.update_ads_strategy_status, "update_ads_strategy_status must be registered");
  assert.equal(byName.update_ads_strategy_status.permission, "WRITE_SAFE");
  assert.deepEqual(byName.update_ads_strategy_status.inputSchema.required, ["companyId", "strategyId", "status"]);
});

test("AD_STRATEGY_STATUSES/LABELS cover exactly the 5 required Turkish-labeled statuses", async () => {
  const { AD_STRATEGY_STATUSES, AD_STRATEGY_STATUS_LABELS } = await import("../../../src/lib/marketing-intelligence/ad-strategies.ts");
  assert.deepEqual([...AD_STRATEGY_STATUSES].sort(), ["active", "approved", "archived", "draft", "updated"]);
  assert.equal(AD_STRATEGY_STATUS_LABELS.draft, "Taslak");
  assert.equal(AD_STRATEGY_STATUS_LABELS.approved, "Onaylandı");
  assert.equal(AD_STRATEGY_STATUS_LABELS.active, "Uygulanıyor");
  assert.equal(AD_STRATEGY_STATUS_LABELS.updated, "Güncellendi");
  assert.equal(AD_STRATEGY_STATUS_LABELS.archived, "Arşivlendi");
});

test("saveAdStrategyDraft REGRESSION — rejects an invalid strategy before any network call", async () => {
  const { saveAdStrategyDraft, AdsStrategyValidationError } = await import("../../../src/lib/marketing-intelligence/ad-strategies.ts");
  await assert.rejects(() => saveAdStrategyDraft({ companyId: "00000000-0000-4000-8000-000000000000" }), AdsStrategyValidationError);
});

function fakeStrategy(overrides: Record<string, unknown> = {}) {
  return {
    id: "s1", company_id: "c1", version: 2, status: "draft", strategy_title: "Reklam Stratejisi v2",
    primary_platform: "Meta Ads", primary_goal: "Lead üretimi",
    monthly_ad_budget: 15000, daily_budget_estimate: 500, meta_budget: 15000, google_budget: null,
    primary_kpi: "CPL",
    campaign_sequence: [{ order: 1, name: "Leads — Instagram Direct", objective: "Leads", conversionLocation: "Instagram Direct", dailyBudget: 300, purpose: "İlk lead akışı", transitionCondition: "10 nitelikli lead sonrası" }],
    remarketing: { required: true, status: "not_ready", condition: "Site ziyaretçi sayısı 500'ü geçince" },
    internal_report: { executiveSummary: "İç özet metni.", sections: [{ title: "Gerekçe", content: "İç stratejik gerekçe metni." }, { title: "Riskler", content: "Bütçe riski var." }] },
    client_report: { executiveSummary: "Müşteri özet metni.", sections: [{ title: "Önerilen Yaklaşım", content: "Meta Ads önceliklendirilecek." }] },
    created_at: "2026-09-01T00:00:00.000Z", updated_at: "2026-09-01T00:00:00.000Z", approved_at: null, activated_at: null, archived_at: null,
    ...overrides
  } as any;
}

test("buildAdStrategyDocumentPayload: internal report includes rationale/risks; client report only includes client_report content", async () => {
  const { buildAdStrategyDocumentPayload } = await import("../../../src/lib/marketing-intelligence/ad-strategy-document.ts");
  const strategy = fakeStrategy();

  const internal = buildAdStrategyDocumentPayload("MY CAKE 45", strategy, "internal");
  const internalText = internal.sections.map((s) => `${s.title}\n${s.text || ""}`).join("\n");
  assert.match(internalText, /İç stratejik gerekçe metni/);
  assert.match(internalText, /Bütçe riski var/);
  assert.equal(internal.confidentialLabel, "Dahili Kullanım");

  const client = buildAdStrategyDocumentPayload("MY CAKE 45", strategy, "client");
  const clientText = client.sections.map((s) => `${s.title}\n${s.text || ""}`).join("\n");
  assert.match(clientText, /Meta Ads önceliklendirilecek/);
  assert.doesNotMatch(clientText, /İç stratejik gerekçe metni/, "internal-only rationale must never appear in the client document");
  assert.equal(client.confidentialLabel, undefined);
});

test("buildAdStrategyDocumentPayload: campaign sequence table renders for both modes with correct order", async () => {
  const { buildAdStrategyDocumentPayload } = await import("../../../src/lib/marketing-intelligence/ad-strategy-document.ts");
  const strategy = fakeStrategy();
  const payload = buildAdStrategyDocumentPayload("MY CAKE 45", strategy, "internal");
  const campaignSection = payload.sections.find((s) => s.title === "Reklam Açılış Sırası");
  assert.ok(campaignSection?.table);
  assert.equal(campaignSection!.table!.rows[0][1], "Leads — Instagram Direct");
});

test("generatePdfBuffer/generateDocxBuffer smoke test for an ad strategy: both formats produce real valid binaries", async () => {
  const { buildAdStrategyDocumentPayload } = await import("../../../src/lib/marketing-intelligence/ad-strategy-document.ts");
  const { generatePdfBuffer, generateDocxBuffer } = await import("../../../src/lib/server/document-generator.ts");
  const strategy = fakeStrategy({ strategy_title: "Türkçe karakterli başlık çÇğĞıİöÖşŞüÜ" });

  for (const mode of ["internal", "client"] as const) {
    const payload = buildAdStrategyDocumentPayload("MY CAKE 45", strategy, mode);
    const pdf = await generatePdfBuffer(payload);
    assert.equal(pdf.subarray(0, 5).toString("latin1"), "%PDF-");
    const docx = await generateDocxBuffer(payload);
    assert.equal(docx.subarray(0, 2).toString("latin1"), "PK", "a real .docx is a ZIP archive (PK magic bytes)");
  }
});

// --- Live coverage (requires ad_strategies migration applied) ---

test("saveAdStrategyDraft REGRESSION — new strategies always start as draft, never auto-approved (requires ad_strategies migration)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const { saveAdStrategyDraft, AD_STRATEGIES_TABLE } = await import("../../../src/lib/marketing-intelligence/ad-strategies.ts");
  const unique = `QA-AdStrategy-${Date.now()}`;
  const [company] = await supabaseRest<Array<{ id: string }>>("companies", { method: "POST", body: JSON.stringify({ name: unique, email: `${unique.toLocaleLowerCase("en")}@example.test`, is_test: true }) });

  try {
    const strategy = await saveAdStrategyDraft(validStrategyInput(company.id));
    assert.equal(strategy.status, "draft");
    assert.equal(strategy.version, 1);
    assert.equal(strategy.company_id, company.id);
    assert.equal(strategy.previous_strategy_id, null);
    assert.ok(strategy.internal_report.sections?.length, "a default internal report must be derived even without explicit internalReport input");
    assert.ok(strategy.client_report.sections?.length, "a default client report must be derived even without explicit clientReport input");
  } finally {
    await supabaseRest(`${AD_STRATEGIES_TABLE}?company_id=eq.${company.id}`, { method: "DELETE" }).catch(() => {});
    await supabaseRest(`companies?id=eq.${company.id}`, { method: "DELETE" }).catch(() => {});
  }
});

test("saveAdStrategyDraft REGRESSION — a second save for the same company versions instead of overwriting (requires ad_strategies migration)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const { saveAdStrategyDraft, getAdStrategyHistory, AD_STRATEGIES_TABLE } = await import("../../../src/lib/marketing-intelligence/ad-strategies.ts");
  const unique = `QA-AdStrategy-Version-${Date.now()}`;
  const [company] = await supabaseRest<Array<{ id: string }>>("companies", { method: "POST", body: JSON.stringify({ name: unique, email: `${unique.toLocaleLowerCase("en")}@example.test`, is_test: true }) });

  try {
    const first = await saveAdStrategyDraft(validStrategyInput(company.id));
    const second = await saveAdStrategyDraft(validStrategyInput(company.id));
    assert.notEqual(first.id, second.id);
    assert.equal(second.version, 2);
    assert.equal(second.previous_strategy_id, first.id);

    const history = await getAdStrategyHistory(company.id);
    assert.equal(history.length, 2, "prior version must never be deleted/overwritten");
  } finally {
    await supabaseRest(`${AD_STRATEGIES_TABLE}?company_id=eq.${company.id}`, { method: "DELETE" }).catch(() => {});
    await supabaseRest(`companies?id=eq.${company.id}`, { method: "DELETE" }).catch(() => {});
  }
});

test("updateAdStrategyStatus REGRESSION — status flow draft->approved->active, and cross-company update is rejected (requires ad_strategies migration)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const { saveAdStrategyDraft, updateAdStrategyStatus, AdStrategyNotFoundError, AD_STRATEGIES_TABLE } = await import("../../../src/lib/marketing-intelligence/ad-strategies.ts");
  const uniqueA = `QA-AdStrategy-StatusA-${Date.now()}`;
  const uniqueB = `QA-AdStrategy-StatusB-${Date.now()}`;
  const [companyA] = await supabaseRest<Array<{ id: string }>>("companies", { method: "POST", body: JSON.stringify({ name: uniqueA, email: `${uniqueA.toLocaleLowerCase("en")}@example.test`, is_test: true }) });
  const [companyB] = await supabaseRest<Array<{ id: string }>>("companies", { method: "POST", body: JSON.stringify({ name: uniqueB, email: `${uniqueB.toLocaleLowerCase("en")}@example.test`, is_test: true }) });

  try {
    const strategy = await saveAdStrategyDraft(validStrategyInput(companyA.id));
    const approved = await updateAdStrategyStatus(companyA.id, strategy.id, "approved");
    assert.equal(approved.status, "approved");
    assert.ok(approved.approved_at);
    const active = await updateAdStrategyStatus(companyA.id, strategy.id, "active");
    assert.equal(active.status, "active");
    assert.ok(active.activated_at);

    await assert.rejects(() => updateAdStrategyStatus(companyB.id, strategy.id, "archived"), AdStrategyNotFoundError, "company B must never be able to change company A's strategy status");
  } finally {
    await supabaseRest(`${AD_STRATEGIES_TABLE}?company_id=eq.${companyA.id}`, { method: "DELETE" }).catch(() => {});
    await supabaseRest(`companies?id=eq.${companyA.id}`, { method: "DELETE" }).catch(() => {});
    await supabaseRest(`companies?id=eq.${companyB.id}`, { method: "DELETE" }).catch(() => {});
  }
});

test("getAdStrategyForActivation REGRESSION — prefers active, then approved, then reports none found if only draft exists (requires ad_strategies migration)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const { saveAdStrategyDraft, getAdStrategyForActivation, updateAdStrategyStatus, AD_STRATEGIES_TABLE } = await import("../../../src/lib/marketing-intelligence/ad-strategies.ts");
  const unique = `QA-AdStrategy-Activation-${Date.now()}`;
  const [company] = await supabaseRest<Array<{ id: string }>>("companies", { method: "POST", body: JSON.stringify({ name: unique, email: `${unique.toLocaleLowerCase("en")}@example.test`, is_test: true }) });

  try {
    const draft = await saveAdStrategyDraft(validStrategyInput(company.id));
    const onlyDraft = await getAdStrategyForActivation(company.id);
    assert.equal(onlyDraft.strategy, null, "a DRAFT alone must never be treated as ready for setup");

    await updateAdStrategyStatus(company.id, draft.id, "approved");
    const withApproved = await getAdStrategyForActivation(company.id);
    assert.equal(withApproved.strategy?.status, "approved");

    const second = await saveAdStrategyDraft(validStrategyInput(company.id));
    await updateAdStrategyStatus(company.id, second.id, "active");
    const withActive = await getAdStrategyForActivation(company.id);
    assert.equal(withActive.strategy?.status, "active", "ACTIVE must be preferred over an older APPROVED version");
  } finally {
    await supabaseRest(`${AD_STRATEGIES_TABLE}?company_id=eq.${company.id}`, { method: "DELETE" }).catch(() => {});
    await supabaseRest(`companies?id=eq.${company.id}`, { method: "DELETE" }).catch(() => {});
  }
});

test("updateAdStrategy REGRESSION — editing an APPROVED strategy marks it UPDATED, and refresh (re-read) reflects the saved change (requires ad_strategies migration)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const { saveAdStrategyDraft, updateAdStrategyStatus, updateAdStrategy, getAdStrategyById, AD_STRATEGIES_TABLE } = await import("../../../src/lib/marketing-intelligence/ad-strategies.ts");
  const unique = `QA-AdStrategy-Edit-${Date.now()}`;
  const [company] = await supabaseRest<Array<{ id: string }>>("companies", { method: "POST", body: JSON.stringify({ name: unique, email: `${unique.toLocaleLowerCase("en")}@example.test`, is_test: true }) });

  try {
    const strategy = await saveAdStrategyDraft(validStrategyInput(company.id));
    await updateAdStrategyStatus(company.id, strategy.id, "approved");
    const edited = await updateAdStrategy(company.id, strategy.id, { primary_goal: "Güncellenmiş hedef metni" });
    assert.equal(edited.status, "updated", "editing an approved strategy must mark it UPDATED, not silently keep it APPROVED");

    const reread = await getAdStrategyById(company.id, strategy.id);
    assert.equal(reread.primary_goal, "Güncellenmiş hedef metni", "a re-read after save must reflect the change (refresh must not lose it)");
  } finally {
    await supabaseRest(`${AD_STRATEGIES_TABLE}?company_id=eq.${company.id}`, { method: "DELETE" }).catch(() => {});
    await supabaseRest(`companies?id=eq.${company.id}`, { method: "DELETE" }).catch(() => {});
  }
});

test("MY CAKE 45 company isolation REGRESSION — a fresh disposable company's strategy never appears in MY CAKE 45's history (requires ad_strategies migration)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const { saveAdStrategyDraft, getAdStrategyHistory, AD_STRATEGIES_TABLE } = await import("../../../src/lib/marketing-intelligence/ad-strategies.ts");
  const unique = `QA-AdStrategy-Isolation-${Date.now()}`;
  const [company] = await supabaseRest<Array<{ id: string }>>("companies", { method: "POST", body: JSON.stringify({ name: unique, email: `${unique.toLocaleLowerCase("en")}@example.test`, is_test: true }) });

  try {
    const created = await saveAdStrategyDraft(validStrategyInput(company.id));
    const myCakeHistory = await getAdStrategyHistory(MY_CAKE_45_COMPANY_ID);
    assert.ok(!myCakeHistory.some((s) => s.id === created.id), "a QA fixture company's strategy must never appear in MY CAKE 45's own history");
  } finally {
    await supabaseRest(`${AD_STRATEGIES_TABLE}?company_id=eq.${company.id}`, { method: "DELETE" }).catch(() => {});
    await supabaseRest(`companies?id=eq.${company.id}`, { method: "DELETE" }).catch(() => {});
  }
});
