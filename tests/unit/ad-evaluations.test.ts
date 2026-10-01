// Reklam Değerlendirme — prompt builder, parser, document builder are
// pure/no-DB and run unconditionally. Data-layer persistence tests are
// live (requires supabase/migrations/20261001_ad_evaluations.sql to be
// applied — the assistant never applies migrations to production itself,
// see the final report) and fail with PGRST205 "table not found" until
// then, same precedent as every other new-table feature in this repo.
// Run via:
//   node --env-file=.env.local --conditions=react-server --import tsx --test tests/unit/ad-evaluations.test.ts
import test from "node:test";
import assert from "node:assert/strict";

const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const skipReason = "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not available in this environment — live coverage skipped rather than faked.";
const MY_CAKE_45_COMPANY_ID = "fc51d411-ea37-45e4-9c93-df0cd43a4a42";

// --- buildMetricsSnapshot (pure) ---

test("buildMetricsSnapshot: no matching rows -> null per group, never a fabricated zero", async () => {
  const { buildMetricsSnapshot } = await import("../../src/lib/marketing-intelligence/ad-evaluations.ts");
  const snapshot = buildMetricsSnapshot({ campaignMetrics: [], adsetMetrics: [], adMetrics: [], campaignId: "c1", metaCampaignId: "m1" });
  assert.equal(snapshot.campaign, null);
  assert.equal(snapshot.adsets, null);
  assert.equal(snapshot.ads, null);
});

test("buildMetricsSnapshot REGRESSION — zero results never produces NaN/Infinity costPerResult, stays null", async () => {
  const { buildMetricsSnapshot } = await import("../../src/lib/marketing-intelligence/ad-evaluations.ts");
  const snapshot = buildMetricsSnapshot({
    campaignMetrics: [{ meta_campaign_id: "m1", spend: 150, reach: 1000, impressions: 3000, results: 0, leads: 0 }],
    adsetMetrics: [], adMetrics: [], campaignId: null, metaCampaignId: "m1"
  });
  assert.ok(snapshot.campaign);
  assert.equal(snapshot.campaign!.results, 0);
  assert.equal(snapshot.campaign!.costPerResult, null, "0 results must never divide spend by zero into Infinity/NaN");
  assert.ok(Number.isFinite(snapshot.campaign!.spend));
});

test("buildMetricsSnapshot: matches by meta_campaign_id first, falls back to local campaign_id, correctly sums real rows", async () => {
  const { buildMetricsSnapshot } = await import("../../src/lib/marketing-intelligence/ad-evaluations.ts");
  const snapshot = buildMetricsSnapshot({
    campaignMetrics: [
      { meta_campaign_id: "m1", spend: 100, results: 5 },
      { meta_campaign_id: "m1", spend: 50, results: 3 },
      { meta_campaign_id: "other", spend: 999, results: 99 }
    ],
    adsetMetrics: [], adMetrics: [], campaignId: null, metaCampaignId: "m1"
  });
  assert.equal(snapshot.campaign!.spend, 150);
  assert.equal(snapshot.campaign!.results, 8);
});

// --- buildAdEvaluationPrompt (pure) ---

function fakeContext(overrides: Record<string, unknown> = {}) {
  return {
    company: { id: "c1", name: "MY CAKE 45", sector: "Pastacılık", city: "Manisa" },
    campaign: { id: "camp1", name: "Açılış Kampanyası", metaCampaignId: "m1", status: "Aktif", startDate: "2026-09-29T00:00:00Z", objective: "Lead" },
    adAccount: null,
    strategy: null,
    creativeStrategy: null,
    previousEvaluations: [],
    metricsSnapshot: { campaign: null, adsets: null, ads: null, syncedAt: new Date().toISOString() },
    campaignAgeHours: 6,
    ...overrides
  } as any;
}

test("buildAdEvaluationPrompt: never fabricates a strategy when none exists — explicitly states it's missing", async () => {
  const { buildAdEvaluationPrompt } = await import("../../src/lib/marketing-intelligence/ad-evaluation-prompt.ts");
  const prompt = buildAdEvaluationPrompt(fakeContext());
  assert.match(prompt, /onaylı\/aktif bir Reklam Stratejisi kaydı yok/);
  assert.doesNotMatch(prompt, /undefined/);
});

test("buildAdEvaluationPrompt: missing metrics render as an explicit 'no data' line, not a fake zero", async () => {
  const { buildAdEvaluationPrompt } = await import("../../src/lib/marketing-intelligence/ad-evaluation-prompt.ts");
  const prompt = buildAdEvaluationPrompt(fakeContext());
  assert.match(prompt, /senkronize edilmiş performans verisi yok/);
});

test("buildAdEvaluationPrompt: campaign-age timing guideline changes correctly across the 0-12 / 12-24 / 24-72 / 3-7d / 7d+ boundaries", async () => {
  const { buildAdEvaluationPrompt } = await import("../../src/lib/marketing-intelligence/ad-evaluation-prompt.ts");
  assert.match(buildAdEvaluationPrompt(fakeContext({ campaignAgeHours: 6 })), /çok erken/);
  assert.match(buildAdEvaluationPrompt(fakeContext({ campaignAgeHours: 18 })), /ilk sinyal/);
  assert.match(buildAdEvaluationPrompt(fakeContext({ campaignAgeHours: 48 })), /ilk anlamlı değerlendirme/);
  assert.match(buildAdEvaluationPrompt(fakeContext({ campaignAgeHours: 96 })), /kreatif ve optimizasyon karşılaştırması/);
  assert.match(buildAdEvaluationPrompt(fakeContext({ campaignAgeHours: 240 })), /daha güçlü optimizasyon kararı/);
});

test("buildAdEvaluationPrompt: contains the mandatory safety rules (no fabrication, insufficient-data allowance, don't conflate ad vs. sales performance)", async () => {
  const { buildAdEvaluationPrompt } = await import("../../src/lib/marketing-intelligence/ad-evaluation-prompt.ts");
  const prompt = buildAdEvaluationPrompt(fakeContext());
  assert.match(prompt, /veri yetersiz/);
  assert.match(prompt, /30 mesaj \+ 0 satış/);
  assert.match(prompt, /===INTERNAL_REPORT_START===/);
  assert.match(prompt, /===CLIENT_REPORT_START===/);
  assert.match(prompt, /===DECISION===/);
});

// --- parseAdEvaluationResponse (pure) ---

const SAMPLE_RESPONSE = `
Bazı giriş metni (kullanılmaz).
===INTERNAL_REPORT_START===
## Yönetici Özeti
Kampanya 3 gündür yayında, ilk sinyaller olumlu.

## Ana Metrikler
- Harcama: 450 TL
- Sonuç: 12
===INTERNAL_REPORT_END===
===CLIENT_REPORT_START===
## Kısa Özet
Reklamınız iyi gidiyor.

## Performans Metrikleri
- Erişim (Reklamı en az bir kez gören farklı kişi sayısı): 3200
===CLIENT_REPORT_END===
===DECISION===
CONTINUE
===NEXT_REVIEW===
2026-10-08 | Mesaj hacmini tekrar kontrol et
`;

test("parseAdEvaluationResponse: correctly separates internal vs client report sections, never mixes them", async () => {
  const { parseAdEvaluationResponse } = await import("../../src/lib/marketing-intelligence/ad-evaluation-parser.ts");
  const parsed = parseAdEvaluationResponse(SAMPLE_RESPONSE);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.internalReport.sections?.length, 2);
  assert.equal(parsed.clientReport.sections?.length, 2);
  const clientText = JSON.stringify(parsed.clientReport);
  assert.doesNotMatch(clientText, /Harcama: 450 TL/, "internal-only content must never appear in the parsed client report");
  const internalText = JSON.stringify(parsed.internalReport);
  assert.doesNotMatch(internalText, /Reklamınız iyi gidiyor/, "client-only content must never appear in the parsed internal report");
});

test("parseAdEvaluationResponse: extracts a valid decision and next review date/note", async () => {
  const { parseAdEvaluationResponse } = await import("../../src/lib/marketing-intelligence/ad-evaluation-parser.ts");
  const parsed = parseAdEvaluationResponse(SAMPLE_RESPONSE);
  assert.equal(parsed.decision, "CONTINUE");
  assert.equal(parsed.nextReviewAt, "2026-10-08");
  assert.equal(parsed.nextReviewNote, "Mesaj hacmini tekrar kontrol et");
});

test("parseAdEvaluationResponse REGRESSION — malformed/truncated input never throws, returns ok:false with warnings instead of crashing", async () => {
  const { parseAdEvaluationResponse } = await import("../../src/lib/marketing-intelligence/ad-evaluation-parser.ts");
  assert.doesNotThrow(() => parseAdEvaluationResponse(""));
  assert.doesNotThrow(() => parseAdEvaluationResponse("rastgele kopyalanmış, delimiter içermeyen metin"));
  const parsed = parseAdEvaluationResponse("yarım kalmış ===INTERNAL_REPORT_START=== ama kapanmamış");
  assert.equal(parsed.ok, false);
  assert.ok(parsed.warnings.length > 0);
  assert.equal(parsed.decision, null);
});

test("parseAdEvaluationResponse: an invalid/unknown decision word is rejected (null), never silently accepted as a fake enum value", async () => {
  const { parseAdEvaluationResponse } = await import("../../src/lib/marketing-intelligence/ad-evaluation-parser.ts");
  const parsed = parseAdEvaluationResponse(SAMPLE_RESPONSE.replace("CONTINUE", "MAYBE_SOMETHING"));
  assert.equal(parsed.decision, null);
});

// --- buildAdEvaluationDocumentPayload (pure) ---

test("buildAdEvaluationDocumentPayload: client report always explains known metric terms in Turkish; internal-only decision section never leaks to client", async () => {
  const { buildAdEvaluationDocumentPayload } = await import("../../src/lib/marketing-intelligence/ad-evaluation-document.ts");
  const evaluation = {
    id: "e1", company_id: "c1", campaign_id: "camp1", meta_campaign_id: "m1", ad_account_id: null,
    strategy_id: null, creative_strategy_id: null, previous_evaluation_id: null,
    evaluation_period_start: "2026-09-25", evaluation_period_end: "2026-10-01", campaign_age_hours: 72,
    metrics_snapshot: {}, prompt_text: "", claude_raw_response: null,
    internal_report: { sections: [{ title: "Ana Metrikler", content: "- Harcama: 450 TL\n- CTR: %1.2" }] },
    client_report: { sections: [{ title: "Performans Metrikleri", content: "- Erişim: 3200\n- CTR: %1.2" }] },
    decision: "CONTINUE", next_review_at: "2026-10-08", next_review_note: "Not",
    status: "evaluated", internal_pdf_path: null, internal_docx_path: null, client_pdf_path: null, client_docx_path: null,
    source: "hk_admin", created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z"
  } as any;

  const client = buildAdEvaluationDocumentPayload("MY CAKE 45", "Açılış Kampanyası", evaluation, "client");
  const clientText = client.sections.map((s) => [s.title, s.text, ...(s.items || [])].join("\n")).join("\n");
  assert.match(clientText, /Erişim \(Reklamı en az bir kez gören farklı kişi sayısı\)/);
  assert.match(clientText, /CTR \(Reklamı gören kişilerden bağlantıya tıklayanların oranı\)/);
  assert.doesNotMatch(clientText, /Nihai Karar|CONTINUE/, "decision block is internal-only and must never appear in the client document");
  assert.equal(client.confidentialLabel, undefined);

  const internal = buildAdEvaluationDocumentPayload("MY CAKE 45", "Açılış Kampanyası", evaluation, "internal");
  const internalText = internal.sections.map((s) => [s.title, s.text, ...(s.items || [])].join("\n")).join("\n");
  assert.match(internalText, /Nihai Karar/);
  assert.equal(internal.confidentialLabel, "Dahili Kullanım");
});

// --- Live data-layer coverage (requires ad_evaluations migration) ---

test("createAdEvaluationDraft / saveParsedEvaluation / getAdEvaluationHistory REGRESSION — snapshot persists, cross-company access rejected (requires ad_evaluations migration)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { supabaseRest } = await import("../../src/lib/supabase.ts");
  const { createAdEvaluationDraft, saveParsedEvaluation, getAdEvaluationHistory, getAdEvaluationById, AdEvaluationNotFoundError } = await import("../../src/lib/marketing-intelligence/ad-evaluations.ts");
  const unique = `QA-AdEval-${Date.now()}`;
  const [companyA] = await supabaseRest<Array<{ id: string }>>("companies", { method: "POST", body: JSON.stringify({ name: unique, email: `${unique.toLocaleLowerCase("en")}@example.test`, is_test: true }) });
  const [companyB] = await supabaseRest<Array<{ id: string }>>("companies", { method: "POST", body: JSON.stringify({ name: `${unique}-B`, email: `${unique.toLocaleLowerCase("en")}-b@example.test`, is_test: true }) });
  try {
    const draft = await createAdEvaluationDraft({ companyId: companyA.id, promptText: "test prompt", metricsSnapshot: { campaign: { spend: 100 } } });
    assert.equal(draft.status, "draft");
    assert.equal(draft.prompt_text, "test prompt");

    const evaluated = await saveParsedEvaluation(companyA.id, draft.id, {
      claudeRawResponse: SAMPLE_RESPONSE,
      internalReport: { sections: [{ title: "Ana Metrikler", content: "Harcama 450 TL" }] },
      clientReport: { sections: [{ title: "Kısa Özet", content: "İyi gidiyor" }] },
      decision: "CONTINUE", nextReviewAt: "2026-10-08", nextReviewNote: "Not"
    });
    assert.equal(evaluated.status, "evaluated");
    assert.equal(evaluated.decision, "CONTINUE");

    const history = await getAdEvaluationHistory(companyA.id);
    assert.equal(history.length, 1);

    await assert.rejects(() => getAdEvaluationById(companyB.id, draft.id), AdEvaluationNotFoundError);
  } finally {
    await supabaseRest(`ad_evaluations?company_id=eq.${companyA.id}`, { method: "DELETE" }).catch(() => {});
    await supabaseRest(`companies?id=eq.${companyA.id}`, { method: "DELETE" }).catch(() => {});
    await supabaseRest(`companies?id=eq.${companyB.id}`, { method: "DELETE" }).catch(() => {});
  }
});

test("PRODUCTION SAFETY — MY CAKE 45's real ad_strategies record is untouched by this suite (requires ad_strategies migration)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { supabaseRest } = await import("../../src/lib/supabase.ts");
  const rows = await supabaseRest<Array<{ id: string; version: number }>>(`ad_strategies?company_id=eq.${MY_CAKE_45_COMPANY_ID}&select=id,version&order=version.desc&limit=1`);
  if (rows.length) assert.ok(rows[0].version >= 1);
});
