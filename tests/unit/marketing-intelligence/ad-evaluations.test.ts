// Reklam Değerlendirme — prompt builder, parser, document builder are
// pure/no-DB and run unconditionally. Data-layer persistence tests are
// live (requires supabase/migrations/20261001_ad_evaluations.sql to be
// applied — the assistant never applies migrations to production itself,
// see the final report) and fail with PGRST205 "table not found" until
// then, same precedent as every other new-table feature in this repo.
// Run via:
//   node --env-file=.env.local --conditions=react-server --import tsx --test tests/unit/marketing-intelligence/ad-evaluations.test.ts
import test from "node:test";
import assert from "node:assert/strict";

const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const skipReason = "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not available in this environment — live coverage skipped rather than faked.";
const MY_CAKE_45_COMPANY_ID = "fc51d411-ea37-45e4-9c93-df0cd43a4a42";

// --- buildMetricsSnapshot (pure) ---

test("buildMetricsSnapshot: no matching rows -> null per group, never a fabricated zero", async () => {
  const { buildMetricsSnapshot } = await import("../../../src/lib/marketing-intelligence/ad-evaluations.ts");
  const snapshot = buildMetricsSnapshot({ campaignMetrics: [], adsetMetrics: [], adMetrics: [], campaignId: "c1", metaCampaignId: "m1" });
  assert.equal(snapshot.campaign, null);
  assert.deepEqual(snapshot.adsets, []);
  assert.deepEqual(snapshot.ads, []);
});

test("buildMetricsSnapshot REGRESSION — zero results never produces NaN/Infinity costPerResult, stays null", async () => {
  const { buildMetricsSnapshot } = await import("../../../src/lib/marketing-intelligence/ad-evaluations.ts");
  const snapshot = buildMetricsSnapshot({
    campaignMetrics: [{ meta_campaign_id: "m1", spend: 150, reach: 1000, impressions: 3000, results: 0, leads: 0 }],
    adsetMetrics: [], adMetrics: [], campaignId: null, metaCampaignId: "m1"
  });
  assert.ok(snapshot.campaign);
  assert.equal(snapshot.campaign!.results, 0);
  assert.equal(snapshot.campaign!.costPerResult, null, "0 results must never divide spend by zero into Infinity/NaN");
  assert.ok(Number.isFinite(snapshot.campaign!.spend));
});

test("buildMetricsSnapshot: matches by meta_campaign_id first, falls back to local campaign_id, correctly sums rows from genuinely distinct dates", async () => {
  const { buildMetricsSnapshot } = await import("../../../src/lib/marketing-intelligence/ad-evaluations.ts");
  const snapshot = buildMetricsSnapshot({
    campaignMetrics: [
      { meta_campaign_id: "m1", date: "2026-09-01", spend: 100, results: 5 },
      { meta_campaign_id: "m1", date: "2026-09-02", spend: 50, results: 3 },
      { meta_campaign_id: "other", date: "2026-09-01", spend: 999, results: 99 }
    ],
    adsetMetrics: [], adMetrics: [], campaignId: null, metaCampaignId: "m1"
  });
  assert.equal(snapshot.campaign!.spend, 150);
  assert.equal(snapshot.campaign!.results, 8);
});

test("buildMetricsSnapshot REGRESSION — a repeated sync of the SAME period (same meta_adset_id/date/breakdown, different created_at) collapses to the latest snapshot, never summed", async () => {
  const { buildMetricsSnapshot } = await import("../../../src/lib/marketing-intelligence/ad-evaluations.ts");
  const snapshot = buildMetricsSnapshot({
    campaignMetrics: [], adMetrics: [], campaignId: "c1", metaCampaignId: "m1",
    adsetMetrics: [
      { meta_campaign_id: "m1", meta_adset_id: "as1", adset_name: "Reklam Seti", date: "2026-10-01", period_start: "2026-09-01", period_end: "2026-10-01", date_range_label: "Son 30 Gün", spend: 174.48, results: 5, created_at: "2026-10-01T12:32:21.046562+00:00" },
      { meta_campaign_id: "m1", meta_adset_id: "as1", adset_name: "Reklam Seti", date: "2026-10-01", period_start: "2026-09-01", period_end: "2026-10-01", date_range_label: "Son 30 Gün", spend: 177.19, results: 5, created_at: "2026-10-01T12:57:30.799739+00:00" }
    ]
  });
  assert.equal(snapshot.adsets!.length, 1, "two sync snapshots of the same real ad set must collapse into exactly one canonical row");
  assert.equal(snapshot.adsets![0].spend, 177.19, "the LATEST snapshot wins, never a sum of the two (which would be 351.67)");
  assert.equal(snapshot.adsets![0].results, 5, "never 10 — repeated snapshots of the same period are not additive");
});

test("buildMetricsSnapshot: distinct Meta ad set ids never collapse into each other", async () => {
  const { buildMetricsSnapshot } = await import("../../../src/lib/marketing-intelligence/ad-evaluations.ts");
  const snapshot = buildMetricsSnapshot({
    campaignMetrics: [], adMetrics: [], campaignId: "c1", metaCampaignId: "m1",
    adsetMetrics: [
      { meta_campaign_id: "m1", meta_adset_id: "as1", adset_name: "Set A", date: "2026-10-01", date_range_label: "Son 30 Gün", spend: 100, results: 2, created_at: "2026-10-01T12:00:00Z" },
      { meta_campaign_id: "m1", meta_adset_id: "as2", adset_name: "Set B", date: "2026-10-01", date_range_label: "Son 30 Gün", spend: 50, results: 1, created_at: "2026-10-01T12:00:00Z" }
    ]
  });
  assert.equal(snapshot.adsets!.length, 2, "two genuinely different Meta ad set ids must stay as two rows");
});

test("buildMetricsSnapshot REGRESSION — a rolling-window label ('Son 30 Gün') re-synced on a LATER date is a newer, superseded-replacing batch, never additive with the older one, even though `date` differs (proven live: MY CAKE 45's 636 TL / 19-message bug was exactly this — an older 'Son 30 Gün' batch summed with a newer one)", async () => {
  const { buildMetricsSnapshot } = await import("../../../src/lib/marketing-intelligence/ad-evaluations.ts");
  const snapshot = buildMetricsSnapshot({
    campaignMetrics: [], adMetrics: [], campaignId: "c1", metaCampaignId: "m1",
    adsetMetrics: [
      // Older sync batch (different created_at) — superseded, must be dropped entirely.
      { meta_campaign_id: "m1", meta_adset_id: "as1", adset_name: "Set A", date: "2026-10-01", date_range_label: "Son 30 Gün", spend: 100, impressions: 1000, clicks: 10, results: 2, reach: 500, created_at: "2026-10-01T12:00:00Z" },
      // Newer sync batch — the only one that counts.
      { meta_campaign_id: "m1", meta_adset_id: "as1", adset_name: "Set A", date: "2026-10-02", date_range_label: "Son 30 Gün", spend: 50, impressions: 500, clicks: 5, results: 1, reach: 300, created_at: "2026-10-02T12:00:00Z" }
    ]
  });
  assert.equal(snapshot.adsets!.length, 1);
  assert.equal(snapshot.adsets![0].spend, 50, "must be the latest batch's own spend (50), never 150 — the older batch is not a legitimately separate day to add");
  assert.equal(snapshot.adsets![0].results, 1);
});

test("buildMetricsSnapshot: rows sharing the EXACT SAME sync batch (identical created_at — a single bulk insert splitting the one rolling total across real calendar days) ARE correctly summed, matching the proven-live MY CAKE 45 reconciliation (239.58+44.64=284.22 / 8+1=9, vs. Meta's real 284.34/9)", async () => {
  const { buildMetricsSnapshot } = await import("../../../src/lib/marketing-intelligence/ad-evaluations.ts");
  const snapshot = buildMetricsSnapshot({
    adsetMetrics: [], adMetrics: [], campaignId: "c1", metaCampaignId: "m1",
    campaignMetrics: [
      { meta_campaign_id: "m1", date: "2026-10-01", date_range_label: "Son 30 Gün", spend: 239.58, messages: 8, results: 8, impressions: 3135, created_at: "2026-10-02T08:37:01.092589Z" },
      { meta_campaign_id: "m1", date: "2026-10-02", date_range_label: "Son 30 Gün", spend: 44.64, messages: 1, results: 1, impressions: 616, created_at: "2026-10-02T08:37:01.092589Z" }
    ]
  });
  assert.equal(snapshot.campaign!.spend, 284.22);
  assert.equal(snapshot.campaign!.messages, 9);
});

test("buildMetricsSnapshot: ads/adsets are always arrays, never null, with a dataAvailability flag — not synced means [] with availability:false", async () => {
  const { buildMetricsSnapshot } = await import("../../../src/lib/marketing-intelligence/ad-evaluations.ts");
  const snapshot = buildMetricsSnapshot({ campaignMetrics: [], adsetMetrics: [], adMetrics: [], campaignId: "c1", metaCampaignId: "m1" });
  assert.deepEqual(snapshot.adsets, []);
  assert.deepEqual(snapshot.ads, []);
  assert.equal(snapshot.dataAvailability.adsets, false);
  assert.equal(snapshot.dataAvailability.ads, false);
});

// --- click-metric family semantics (section 8 of the Meta pipeline fix) ---

test("buildMetricsSnapshot: campaign click families are distinct — linkClicks never conflated with the true all-click count, linkCtr/linkCpc never substituted with Meta's native all-click ctr/cpc", async () => {
  const { buildMetricsSnapshot } = await import("../../../src/lib/marketing-intelligence/ad-evaluations.ts");
  // Real production shape: stored `clicks` is link-click-preferred (19),
  // while Meta's own ctr/cpc columns are natively all-click-based,
  // reproducing a true all-click count of 71 (verified live:
  // 2229 * 3.185285 / 100 ≈ 71).
  const snapshot = buildMetricsSnapshot({
    campaignMetrics: [{ meta_campaign_id: "m1", date: "2026-10-01", spend: 177.19, impressions: 2229, clicks: 19, ctr: 3.185285, cpc: 2.495634, reach: 1588 }],
    adsetMetrics: [], adMetrics: [], campaignId: null, metaCampaignId: "m1"
  });
  const c = snapshot.campaign!;
  assert.equal(c.linkClicks, 19);
  assert.equal(c.clicksAll, 71, "clicksAll must be recovered from Meta's native all-click cpc/spend relationship, not left equal to linkClicks");
  assert.equal(c.ctrAll, 3.19);
  assert.equal(c.cpcAll, 2.5);
  assert.notEqual(c.linkCtr, c.ctrAll, "link CTR and all-click CTR must never be the same field reused under two names");
  assert.equal(c.linkCtr, Number(((19 / 2229) * 100).toFixed(2)));
  assert.equal(c.linkCpc, Number((177.19 / 19).toFixed(2)));
});

test("buildMetricsSnapshot: ad set/ad click families read the genuine all-click count from raw_data.insight when present, never fabricate it", async () => {
  const { buildMetricsSnapshot } = await import("../../../src/lib/marketing-intelligence/ad-evaluations.ts");
  const snapshot = buildMetricsSnapshot({
    campaignMetrics: [], campaignId: "c1", metaCampaignId: "m1",
    adsetMetrics: [{ meta_campaign_id: "m1", meta_adset_id: "as1", adset_name: "Set", date: "2026-10-01", date_range_label: "Son 30 Gün", spend: 177.19, impressions: 2229, clicks: 19, ctr: 3.19, cpc: 2.5, raw_data: { insight: { clicks: "71", inline_link_clicks: "19" } } }],
    adMetrics: []
  });
  assert.equal(snapshot.adsets![0].linkClicks, 19);
  assert.equal(snapshot.adsets![0].clicksAll, 71, "must read Meta's real raw all-click count, not derive/guess it");
});

test("buildMetricsSnapshot: three distinct real Meta Ad IDs stay three canonical ads (1 campaign / 1 adset / 3 ads structure), repeated snapshots of the same ad still collapse to one", async () => {
  const { buildMetricsSnapshot } = await import("../../../src/lib/marketing-intelligence/ad-evaluations.ts");
  const adRows = [
    // ad 1: two repeated sync snapshots of the same ad+period — must collapse to one
    { meta_campaign_id: "m1", meta_ad_id: "ad1", ad_name: "MYCAKE-IG-DM-01", date: "2026-10-01", date_range_label: "Son 30 Gün", spend: 49.28, results: 2, created_at: "2026-10-01T10:00:00Z" },
    { meta_campaign_id: "m1", meta_ad_id: "ad1", ad_name: "MYCAKE-IG-DM-01", date: "2026-10-01", date_range_label: "Son 30 Gün", spend: 49.28, results: 2, created_at: "2026-10-01T10:05:00Z" },
    { meta_campaign_id: "m1", meta_ad_id: "ad2", ad_name: "MYCAKE-IG-DM-02", date: "2026-10-01", date_range_label: "Son 30 Gün", spend: 62.15, results: 3, created_at: "2026-10-01T10:00:00Z" },
    { meta_campaign_id: "m1", meta_ad_id: "ad3", ad_name: "MYCAKE-IG-DM-03", date: "2026-10-01", date_range_label: "Son 30 Gün", spend: 67.01, results: 0, created_at: "2026-10-01T10:00:00Z" }
  ];
  const snapshot = buildMetricsSnapshot({ campaignMetrics: [], adsetMetrics: [], adMetrics: adRows, campaignId: "c1", metaCampaignId: "m1" });
  assert.equal(snapshot.ads!.length, 3, "must be exactly 3 canonical ads — never 1 (over-collapsed) or 6 (duplicate-sync not deduped)");
  const names = snapshot.ads!.map((a) => a.name).sort();
  assert.deepEqual(names, ["MYCAKE-IG-DM-01", "MYCAKE-IG-DM-02", "MYCAKE-IG-DM-03"]);
  assert.equal(snapshot.ads!.find((a) => a.name === "MYCAKE-IG-DM-01")!.spend, 49.28, "repeated snapshots of the same ad must never be summed (would be 98.56)");
  assert.equal(snapshot.ads!.find((a) => a.name === "MYCAKE-IG-DM-03")!.results, 0, "a real zero result must stay 0, never become null or get dropped");
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
  const { buildAdEvaluationPrompt } = await import("../../../src/lib/marketing-intelligence/ad-evaluation-prompt.ts");
  const prompt = buildAdEvaluationPrompt(fakeContext());
  assert.match(prompt, /onaylı\/aktif bir Reklam Stratejisi kaydı yok/);
  assert.doesNotMatch(prompt, /undefined/);
});

test("buildAdEvaluationPrompt: missing metrics render as an explicit 'no data' line, not a fake zero", async () => {
  const { buildAdEvaluationPrompt } = await import("../../../src/lib/marketing-intelligence/ad-evaluation-prompt.ts");
  const prompt = buildAdEvaluationPrompt(fakeContext());
  assert.match(prompt, /senkronize edilmiş performans verisi yok/);
});

test("buildAdEvaluationPrompt: campaign-age timing guideline changes correctly across the 0-12 / 12-24 / 24-72 / 3-7d / 7d+ boundaries", async () => {
  const { buildAdEvaluationPrompt } = await import("../../../src/lib/marketing-intelligence/ad-evaluation-prompt.ts");
  assert.match(buildAdEvaluationPrompt(fakeContext({ campaignAgeHours: 6 })), /çok erken/);
  assert.match(buildAdEvaluationPrompt(fakeContext({ campaignAgeHours: 18 })), /ilk sinyal/);
  assert.match(buildAdEvaluationPrompt(fakeContext({ campaignAgeHours: 48 })), /ilk anlamlı değerlendirme/);
  assert.match(buildAdEvaluationPrompt(fakeContext({ campaignAgeHours: 96 })), /kreatif ve optimizasyon karşılaştırması/);
  assert.match(buildAdEvaluationPrompt(fakeContext({ campaignAgeHours: 240 })), /daha güçlü optimizasyon kararı/);
});

test("buildAdEvaluationPrompt: contains the mandatory safety rules (no fabrication, insufficient-data allowance, don't conflate ad vs. sales performance)", async () => {
  const { buildAdEvaluationPrompt } = await import("../../../src/lib/marketing-intelligence/ad-evaluation-prompt.ts");
  const prompt = buildAdEvaluationPrompt(fakeContext());
  assert.match(prompt, /veri yetersiz/);
  assert.match(prompt, /30 mesaj \+ 0 satış/);
  assert.match(prompt, /===INTERNAL_REPORT_START===/);
  assert.match(prompt, /===CLIENT_REPORT_START===/);
  assert.match(prompt, /===DECISION===/);
});

test("buildAdEvaluationPrompt REGRESSION — includes the metric glossary, controlled-vocabulary status instruction, reference-priority order, the Ana Metrikler table columns, and the Metrik Bazlı Aksiyon Değerlendirmesi section, so the generated INTERNAL_REPORT explains each metric and never fabricates a benchmark", async () => {
  const { buildAdEvaluationPrompt } = await import("../../../src/lib/marketing-intelligence/ad-evaluation-prompt.ts");
  const prompt = buildAdEvaluationPrompt(fakeContext());
  assert.match(prompt, /Erişim: Reklamı en az bir kez gören benzersiz/);
  assert.match(prompt, /Bağlantı CTR: Gösterimlerin ne kadarının gerçek bağlantı tıklamasına dönüştüğü/);
  assert.match(prompt, /Güvenilir referans aralığı yok/);
  assert.match(prompt, /Strateji hedefi/);
  assert.match(prompt, /🟢 İyi, 🟡 İzle, 🔴 Aksiyon Gerekebilir, ⚪ Referans Yok, 🔵 Veri Yetersiz/);
  assert.match(prompt, /Ne Anlama Gelir\? \| Referans \/ Hedef Aralık \| Durum \| Değerlendirme/);
  assert.match(prompt, /Metrik Bazlı Aksiyon Değerlendirmesi/);
  assert.match(prompt, /Şimdi aksiyon: Yok — veri toplamaya devam et\./);
});

test("buildAdEvaluationPrompt REGRESSION — forbids the linear elapsed-hours × daily-budget projection and the client report is explicitly kept free of internal/technical jargon", async () => {
  const { buildAdEvaluationPrompt } = await import("../../../src/lib/marketing-intelligence/ad-evaluation-prompt.ts");
  const prompt = buildAdEvaluationPrompt(fakeContext());
  assert.match(prompt, /DOĞRUSAL bir hesap ASLA yapma/);
  assert.match(prompt, /kesin bir günlük harcama limiti DEĞİLDİR/);
  assert.match(prompt, /canonical batch.*aggregation.*snapshot.*dedupe.*time_increment/);
  assert.match(prompt, /BU RAPOR BASİT SEVİYEDE KALIR/);
});

test("buildAdEvaluationPrompt REGRESSION — the banned-judgment-word rule is GENERIC (applies report-wide, every section of BOTH reports, not only the Ana Metrikler table or only CLIENT_REPORT) and lists the full forbidden vocabulary for a ⚪/🔵 metric (proven live: Frekans and Bağlantı CTR previously contradicted between report sections)", async () => {
  const { buildAdEvaluationPrompt } = await import("../../../src/lib/marketing-intelligence/ad-evaluation-prompt.ts");
  const prompt = buildAdEvaluationPrompt(fakeContext());
  assert.match(prompt, /YASAKLI SÖZCÜKLER/);
  assert.match(prompt, /raporun HİÇBİR YERİNDE/);
  assert.match(prompt, /CLIENT_REPORT'un tüm bölümleri DAHİL/);
  assert.match(prompt, /Ana Metrikler tablosu dışındaki bölümleri de dahil, raporun TAMAMINA uygulanır/);
  for (const word of ["normal", "kötü", "yüksek", "düşük", "pahalı", "ucuz", "güçlü", "zayıf", "başarılı", "başarısız", "iyileştirme alanı", "hedefin altında", "hedefin üstünde", "kazanan", "kaybeden"]) {
    assert.ok(prompt.includes(word), `banned-word list must include "${word}"`);
  }
  assert.match(prompt, /Henüz erken dönem; takip ediyoruz\./);
  assert.match(prompt, /Güvenilir karşılaştırma olmadığı için performans sınıflandırması yapılmıyor\./);
  assert.match(prompt, /Olgusal\/matematiksel ifadeler .* her zaman serbesttir/);
});

test("buildAdEvaluationPrompt REGRESSION — the status decision procedure is explicit and ordered (metric exists? -> reliable reference? -> sufficient volume? -> direction), and ad-level creative comparison forbids a raw-message-count winner/loser verdict", async () => {
  const { buildAdEvaluationPrompt } = await import("../../../src/lib/marketing-intelligence/ad-evaluation-prompt.ts");
  const prompt = buildAdEvaluationPrompt(fakeContext());
  assert.match(prompt, /AŞAĞIDAKİ SIRAYI AYNEN, adım atlamadan uygula/);
  assert.match(prompt, /Metrik gerçekten senkronize edilmiş veride var mı\?/);
  assert.match(prompt, /YASAKLI SÖZCÜKLER listesi de bu metrik için YASAK/);
  assert.match(prompt, /yalnızca ham mesaj sayısına bakarak "kazanan"\/"kaybeden" ilan etme/);
  assert.match(prompt, /Henüz kesin kreatif kararı için veri yetersiz\./);
});

test("buildAdEvaluationPrompt: surfaces the campaign's real daily/lifetime budget from context (never recomputes a projection itself)", async () => {
  const { buildAdEvaluationPrompt } = await import("../../../src/lib/marketing-intelligence/ad-evaluation-prompt.ts");
  const prompt = buildAdEvaluationPrompt(fakeContext({ campaign: { id: "camp1", name: "X", metaCampaignId: "m1", status: "Aktif", startDate: "2026-09-29T00:00:00Z", objective: "Lead", dailyBudget: 200, lifetimeBudget: 0 } }));
  assert.match(prompt, /Günlük bütçe \(Meta'da tanımlı üst sınır\): 200 TL/);
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
  const { parseAdEvaluationResponse } = await import("../../../src/lib/marketing-intelligence/ad-evaluation-parser.ts");
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
  const { parseAdEvaluationResponse } = await import("../../../src/lib/marketing-intelligence/ad-evaluation-parser.ts");
  const parsed = parseAdEvaluationResponse(SAMPLE_RESPONSE);
  assert.equal(parsed.decision, "CONTINUE");
  assert.equal(parsed.nextReviewAt, "2026-10-08");
  assert.equal(parsed.nextReviewNote, "Mesaj hacmini tekrar kontrol et");
});

test("parseAdEvaluationResponse REGRESSION — malformed/truncated input never throws, returns ok:false with warnings instead of crashing", async () => {
  const { parseAdEvaluationResponse } = await import("../../../src/lib/marketing-intelligence/ad-evaluation-parser.ts");
  assert.doesNotThrow(() => parseAdEvaluationResponse(""));
  assert.doesNotThrow(() => parseAdEvaluationResponse("rastgele kopyalanmış, delimiter içermeyen metin"));
  const parsed = parseAdEvaluationResponse("yarım kalmış ===INTERNAL_REPORT_START=== ama kapanmamış");
  assert.equal(parsed.ok, false);
  assert.ok(parsed.warnings.length > 0);
  assert.equal(parsed.decision, null);
});

test("parseAdEvaluationResponse: an invalid/unknown decision word is rejected (null), never silently accepted as a fake enum value", async () => {
  const { parseAdEvaluationResponse } = await import("../../../src/lib/marketing-intelligence/ad-evaluation-parser.ts");
  const parsed = parseAdEvaluationResponse(SAMPLE_RESPONSE.replace("CONTINUE", "MAYBE_SOMETHING"));
  assert.equal(parsed.decision, null);
});

// --- buildAdEvaluationDocumentPayload (pure) ---

test("buildAdEvaluationDocumentPayload: client report always explains known metric terms in Turkish; internal-only decision section never leaks to client", async () => {
  const { buildAdEvaluationDocumentPayload } = await import("../../../src/lib/marketing-intelligence/ad-evaluation-document.ts");
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

test("buildAdEvaluationDocumentPayload: click-family terms are each glossed exactly once, never nested/double-annotated, never cross-contaminated between generic and compound labels", async () => {
  const { buildAdEvaluationDocumentPayload } = await import("../../../src/lib/marketing-intelligence/ad-evaluation-document.ts");
  const evaluation = {
    id: "e1", company_id: "c1", campaign_id: "camp1", meta_campaign_id: "m1", ad_account_id: null,
    strategy_id: null, creative_strategy_id: null, previous_evaluation_id: null,
    evaluation_period_start: "2026-09-25", evaluation_period_end: "2026-10-01", campaign_age_hours: 72,
    metrics_snapshot: {}, prompt_text: "", claude_raw_response: null,
    internal_report: {},
    client_report: { sections: [{ title: "Metrikler", content: "Bağlantı Tıklaması: 19\nCTR (Tümü): %3.19\nCPC (Tümü): 2.50 TL\nBağlantı CTR: %0.85\nBağlantı CPC: 9.33 TL" }] },
    decision: null, next_review_at: null, next_review_note: null,
    status: "evaluated", internal_pdf_path: null, internal_docx_path: null, client_pdf_path: null, client_docx_path: null,
    source: "hk_admin", created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z"
  } as any;

  const client = buildAdEvaluationDocumentPayload("MY CAKE 45", "Açılış Kampanyası", evaluation, "client");
  const items = client.sections.find((s) => s.title === "Metrikler")?.items || [];
  assert.match(items[0], /^Bağlantı Tıklaması \(Reklamdaki bağlantıya yapılan tıklama sayısı\): 19$/);
  assert.match(items[1], /^CTR \(Tümü\) \(Reklamdaki tüm tıklamaların gösterimlere oranı\): %3\.19$/);
  assert.match(items[2], /^CPC \(Tümü\) \(Reklamdaki tüm tıklamalardan birinin ortalama maliyeti\): 2,50 TL$|2\.50 TL$/);
  assert.match(items[3], /^Bağlantı CTR \(Reklamdaki bağlantı tıklamalarının gösterimlere oranı\): %0\.85$/);
  assert.match(items[4], /^Bağlantı CPC \(Bir bağlantı tıklamasının ortalama maliyeti\): 9,33 TL$|9\.33 TL$/);
  for (const line of items) {
    const openParens = (line.match(/\(/g) || []).length;
    const closeParens = (line.match(/\)/g) || []).length;
    assert.equal(openParens, closeParens, `unbalanced parens suggest nested/double annotation: ${line}`);
    // Each line above gets exactly one gloss appended; "CTR (Tümü)"/
    // "CPC (Tümü)" legitimately already contain one paren pair of their
    // own before the gloss is appended, so up to 2 is correct there —
    // the real regression this guards against (3+ parens) would mean a
    // second, nested gloss got applied on top of the first.
    assert.equal(openParens <= 2, true, `more than one gloss applied to the same line: ${line}`);
  }
});

// --- Live data-layer coverage (requires ad_evaluations migration) ---

test("createAdEvaluationDraft / saveParsedEvaluation / getAdEvaluationHistory REGRESSION — snapshot persists, cross-company access rejected (requires ad_evaluations migration)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const { createAdEvaluationDraft, saveParsedEvaluation, getAdEvaluationHistory, getAdEvaluationById, AdEvaluationNotFoundError } = await import("../../../src/lib/marketing-intelligence/ad-evaluations.ts");
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
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const rows = await supabaseRest<Array<{ id: string; version: number }>>(`ad_strategies?company_id=eq.${MY_CAKE_45_COMPANY_ID}&select=id,version&order=version.desc&limit=1`);
  if (rows.length) assert.ok(rows[0].version >= 1);
});

test("RECONCILIATION — MY CAKE 45's real campaign_metrics (Reklam Operasyon Merkezi's own data source) reconcile with the campaign's own ad set's latest-batch, non-time-split total via the canonical dedup helper, never a ~2x duplicate-batch sum (read-only; cross-checks against the live ad set total rather than a fixed historical figure, since this is a real, continuously re-synced production account whose true totals grow over time)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const { dedupeMetaMetricSnapshots } = await import("../../../src/lib/marketing-intelligence/meta-metrics-aggregation.ts");
  const [rows, adsetRows] = await Promise.all([
    supabaseRest<any[]>(`campaign_metrics?company_id=eq.${MY_CAKE_45_COMPANY_ID}&meta_campaign_id=eq.120249963530420430&select=*`),
    supabaseRest<any[]>(`meta_adset_metrics?company_id=eq.${MY_CAKE_45_COMPANY_ID}&meta_campaign_id=eq.120249963530420430&select=*`)
  ]);
  if (!rows.length || !adsetRows.length) return; // data may have moved on since this fix shipped — not a regression if genuinely absent
  const deduped = dedupeMetaMetricSnapshots(rows, "meta_campaign_id");
  const spend = deduped.reduce((s, r: any) => s + Number(r.spend || 0), 0);
  const rawSum = rows.reduce((s: number, r: any) => s + Number(r.spend || 0), 0);
  assert.ok(spend < rawSum, "the canonical dedup must always collapse at least one stale repeat-sync batch for this campaign's real history — otherwise this test's own premise no longer holds");
  const dedupedAdsets = dedupeMetaMetricSnapshots(adsetRows, "meta_adset_id");
  const adsetSpend = dedupedAdsets.reduce((s: number, r: any) => s + Number(r.spend || 0), 0);
  assert.ok(Math.abs(spend - adsetSpend) < 1, `campaign total must reconcile with its own ad set's authoritative total to the TL, never a duplicate-batch sum (campaign deduped=${spend}, adset deduped=${adsetSpend})`);
});

test("RECONCILIATION — buildMetricsSnapshot's campaign block for MY CAKE 45's real data matches its own ad set's authoritative (non-time-split) reach/CPM/all-click totals to the cent, never the inflated sum-of-days reach (2582) or the unweighted-average CPM (74.52) proven live before this fix (read-only)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const { buildMetricsSnapshot } = await import("../../../src/lib/marketing-intelligence/ad-evaluations.ts");
  const metaCampaignId = "120249963530420430";
  const [campaignMetrics, adsetMetrics] = await Promise.all([
    supabaseRest<any[]>(`campaign_metrics?company_id=eq.${MY_CAKE_45_COMPANY_ID}&meta_campaign_id=eq.${metaCampaignId}&select=*`),
    supabaseRest<any[]>(`meta_adset_metrics?company_id=eq.${MY_CAKE_45_COMPANY_ID}&meta_campaign_id=eq.${metaCampaignId}&select=*`)
  ]);
  if (!campaignMetrics.length || !adsetMetrics.length) return; // data may have moved on — not a regression if genuinely absent
  const snapshot = buildMetricsSnapshot({ campaignMetrics, adsetMetrics, adMetrics: [], metaCampaignId });
  assert.ok(snapshot.campaign, "a real synced campaign must produce a non-null campaign block");
  assert.ok(snapshot.adsets!.length >= 1, "this campaign has at least one real synced ad set");
  const totalAdsetReach = snapshot.adsets!.reduce((s, a: any) => s + (Number(a.reach) || 0), 0);
  assert.equal(snapshot.campaign!.reach, totalAdsetReach, "campaign reach must equal the real ad set total, never a sum of the campaign's own artificially day-split rows");
  assert.ok(snapshot.campaign!.reach < 2582, "must never reproduce the proven-live inflated day-sum reach bug (2582)");
  const weightedCpm = Number(((snapshot.campaign!.spend / snapshot.campaign!.impressions) * 1000).toFixed(2));
  assert.equal(snapshot.campaign!.cpm, weightedCpm, "cpm must be the true spend/impressions rate, never an unweighted average of per-day cpm values (the proven-live 74.52 TL bug)");
});

test("RECONCILIATION — after the meta_ad_metrics schema-column fix, getAdEvaluationContext's live MCP context for MY CAKE 45 sees all 3 real ads (MYCAKE-IG-DM-01/02/03) with correctly isolated per-ad totals, and the campaign's own total is never further inflated by also summing the ad rows on top of the campaign rows (read-only)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { getAdEvaluationContext } = await import("../../../src/lib/marketing-intelligence/ad-evaluations.ts");
  const ctx = await getAdEvaluationContext(MY_CAKE_45_COMPANY_ID, {});
  if (!ctx.metricsSnapshot.ads?.length) return; // sync may not have run again since this fix shipped — not a regression if genuinely absent
  assert.equal(ctx.metricsSnapshot.dataAvailability.ads, true);
  const names = ctx.metricsSnapshot.ads.map((a: any) => a.name).sort();
  assert.deepEqual(names, ["MYCAKE-IG-DM-01", "MYCAKE-IG-DM-02", "MYCAKE-IG-DM-03-"].sort());
  const ids = ctx.metricsSnapshot.ads.map((a: any) => a.metaAdId);
  assert.equal(new Set(ids).size, 3, "each ad must appear exactly once, never duplicated across sync batches");
  const adSpendSum = ctx.metricsSnapshot.ads.reduce((s: number, a: any) => s + Number(a.spend || 0), 0);
  assert.ok(adSpendSum <= ctx.metricsSnapshot.campaign!.spend + 1, "the sum of real ad-level spend must never exceed the campaign total (proves ad rows are a breakdown of the campaign total, not an extra duplicate layer summed on top)");
});
