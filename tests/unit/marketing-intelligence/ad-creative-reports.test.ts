// Reklam Kreatif Raporu — data layer + document export. Run via:
//   node --env-file=.env.local --conditions=react-server --import tsx --test tests/unit/marketing-intelligence/ad-creative-reports.test.ts
//
// NOTE: tests marked "requires ad_creative_reports migration" depend on
// supabase/migrations/20260927_ad_creative_reports.sql having been
// applied (the assistant never applies migrations to production itself —
// see the final report). Until then they fail with PGRST205 "table not
// found", same as every other new-table feature in this codebase before
// its migration is applied.
import test from "node:test";
import assert from "node:assert/strict";

const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const skipReason = "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not available in this environment — live coverage skipped rather than faked.";

async function makeFixtureCompany(label: string) {
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const unique = `QA-AdCreative-${label}-${Date.now()}`;
  const [company] = await supabaseRest<Array<{ id: string }>>("companies", { method: "POST", body: JSON.stringify({ name: unique, email: `${unique.toLocaleLowerCase("en")}@example.test`, is_test: true }) });
  return company.id as string;
}

async function cleanup(companyId: string) {
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const { AD_CREATIVE_REPORTS_TABLE } = await import("../../../src/lib/marketing-intelligence/ad-creative-reports.ts");
  await supabaseRest(`${AD_CREATIVE_REPORTS_TABLE}?company_id=eq.${companyId}`, { method: "DELETE" }).catch(() => {});
  await supabaseRest(`companies?id=eq.${companyId}`, { method: "DELETE" }).catch(() => {});
}

const SAMPLE_CREATIVE = {
  order: 1, format: "reels", title: "Uzaktan pasta, yakından işçilik", hook: "Uzaktan pasta. Yakından işçilik.",
  cta: "Yorum bırak", details: "0-2sn tam pasta, yavaş yaklaşma.", internalNotes: "Kreatif yorgunluğu riski düşük."
};

// --- Pure / no-DB coverage ---

test("saveCreativeReportDraft REGRESSION — rejects invalid input before any network call", async () => {
  const { saveCreativeReportDraft, AdCreativeReportValidationError } = await import("../../../src/lib/marketing-intelligence/ad-creative-reports.ts");
  await assert.rejects(() => saveCreativeReportDraft({}), AdCreativeReportValidationError);
  await assert.rejects(() => saveCreativeReportDraft({ companyId: "x", creatives: "not-an-array" }), AdCreativeReportValidationError);
});

test("validateCreativeReportPatch REGRESSION — rejects unknown fields and malformed arrays", async () => {
  const { validateCreativeReportPatch, AdCreativeReportPatchValidationError } = await import("../../../src/lib/marketing-intelligence/ad-creative-reports.ts");
  assert.throws(() => validateCreativeReportPatch({ company_id: "x" }), AdCreativeReportPatchValidationError);
  assert.throws(() => validateCreativeReportPatch({ creatives: "nope" }), AdCreativeReportPatchValidationError);
  const patch = validateCreativeReportPatch({ creatives: [SAMPLE_CREATIVE] });
  assert.equal(patch.creatives?.length, 1);
});

test("buildCreativeReportDocumentPayload: client mode excludes internal-only creative fields; internal mode includes them", async () => {
  const { buildCreativeReportDocumentPayload } = await import("../../../src/lib/marketing-intelligence/ad-creative-report-document.ts");
  const report = {
    id: "r1", company_id: "c1", ad_strategy_id: null, ad_strategy_version: null, version: 1, status: "draft", report_title: "Test",
    strategy_summary: { campaignGoal: "Lead üretimi", funnelStage: "TOFU", awarenessLevel: "Unaware" },
    creatives: [SAMPLE_CREATIVE],
    ab_test_plan: [{ hypothesis: "Hook A > Hook B" }],
    required_materials: [{ name: "Ürün fotoğrafı", quantity: "5" }],
    production_checklist: [{ label: "Logo hazır", checked: true }],
    internal_report: { executiveSummary: "İç özet", sections: [{ title: "Strateji", content: "İç gerekçe metni" }] },
    client_report: { executiveSummary: "Müşteri özet", sections: [{ title: "Yaklaşım", content: "Müşteri metni" }] },
    full_payload: {}, previous_report_id: null, source: "hk_admin",
    created_at: "2026-09-27T00:00:00.000Z", updated_at: "2026-09-27T00:00:00.000Z", approved_at: null, activated_at: null, archived_at: null
  } as any;

  const client = buildCreativeReportDocumentPayload("MY CAKE 45", report, "client");
  const clientText = client.sections.map((s) => [s.title, s.text, ...(s.items || []), ...((s.table?.rows || []).flat())].join("\n")).join("\n");
  assert.match(clientText, /Uzaktan pasta. Yakından işçilik./);
  assert.doesNotMatch(clientText, /Kreatif yorgunluğu riski düşük/, "internalNotes must never appear in the client document");
  assert.doesNotMatch(clientText, /TOFU/, "internal-only funnel stage must not appear in the client strategy summary");
  assert.doesNotMatch(clientText, /A > Hook B/, "A/B test plan is internal-only");

  const internal = buildCreativeReportDocumentPayload("MY CAKE 45", report, "internal");
  const internalText = internal.sections.map((s) => [s.title, s.text, ...(s.items || []), ...((s.table?.rows || []).flat())].join("\n")).join("\n");
  assert.match(internalText, /Kreatif yorgunluğu riski düşük/);
  assert.match(internalText, /TOFU/);
  assert.match(internalText, /A > Hook B/, "the A\\/B hypothesis text itself must survive (Hook gets its own Turkish explanation inline, never dropped)");
  assert.equal(internal.confidentialLabel, "Dahili Kullanım");
});

test("generatePdfBuffer/generateDocxBuffer smoke test for a creative report: both formats produce real valid binaries with Turkish characters", async () => {
  const { buildCreativeReportDocumentPayload } = await import("../../../src/lib/marketing-intelligence/ad-creative-report-document.ts");
  const { generatePdfBuffer, generateDocxBuffer } = await import("../../../src/lib/server/document-generator.ts");
  const report = {
    id: "r1", company_id: "c1", ad_strategy_id: null, ad_strategy_version: null, version: 1, status: "draft", report_title: "Türkçe çÇğĞıİöÖşŞüÜ",
    strategy_summary: {}, creatives: [SAMPLE_CREATIVE, { ...SAMPLE_CREATIVE, order: 2, format: "static", title: "Türkçe başlık çÇğĞ" }],
    ab_test_plan: [], required_materials: [], production_checklist: [],
    internal_report: {}, client_report: {}, full_payload: {}, previous_report_id: null, source: "hk_admin",
    created_at: "2026-09-27T00:00:00.000Z", updated_at: "2026-09-27T00:00:00.000Z", approved_at: null, activated_at: null, archived_at: null
  } as any;
  for (const mode of ["client", "internal"] as const) {
    const payload = buildCreativeReportDocumentPayload("MY CAKE 45", report, mode);
    const pdf = await generatePdfBuffer(payload);
    assert.equal(pdf.subarray(0, 5).toString("latin1"), "%PDF-");
    const docx = await generateDocxBuffer(payload);
    assert.equal(docx.subarray(0, 2).toString("latin1"), "PK");
  }
});

test("buildCreativeReportDocumentPayload REDESIGN — no combined paragraphs, no duplicate headings, jargon always explained in Turkish, client/internal separation intact", async () => {
  const { buildCreativeReportDocumentPayload } = await import("../../../src/lib/marketing-intelligence/ad-creative-report-document.ts");
  const report = {
    id: "r1", company_id: "c1", ad_strategy_id: null, ad_strategy_version: null, version: 3, status: "draft", report_title: "MY CAKE 45 — Kreatif Raporu",
    strategy_summary: {
      campaignGoal: "Lead üretimi", creativeRole: "Soğuk kitleyi ısıtmak", targetAudience: "25-45 yaş İstanbul",
      funnelStage: "TOFU", awarenessLevel: "Unaware", keyMessage: "El yapımı pasta kalitesi", primaryCta: "Yorum bırak",
      creativeAngles: ["Kalite", "Süreç"]
    },
    creatives: [
      {
        order: 1, format: "reels", title: "Uzaktan pasta, yakından işçilik", campaign: "Awareness", adSet: "Reels-1", priority: "Yüksek",
        videoDuration: "15sn", hook: "Uzaktan pasta. Yakından işçilik.", cta: "Yorum bırak", funnelStage: "TOFU", angle: "Süreç odaklı",
        videoScenes: [{ order: 1, visual: "Pasta yakın çekim", onScreenText: "El yapımı", voiceover: "—", purpose: "Dikkat çekmek" }],
        details: "Çekim: Telefon dikey konumda, 30 FPS ile çekilecek, tripod kullanılacak.\nKurgu: Sahneler hızlı kesim ile birleştirilecek, son CTA ekranı eklenecek.",
        internalNotes: "Kreatif yorgunluğu riski düşük."
      }
    ],
    ab_test_plan: [{ hypothesis: "Hook A > Hook B", variable: "Hook", constants: "Video, bütçe", expectedBehavior: "3sn izlenme artışı", evaluationCriteria: "Yeterli veri sonrası" }],
    required_materials: [{ name: "Ürün Fotoğrafı", quantity: "5", format: "JPEG", instructions: "Doğal ışıkta çekilecek" }],
    production_checklist: [{ label: "Logo hazır", checked: true }, { label: "Video onayı", checked: false }],
    internal_report: { executiveSummary: "İç özet: Funnel TOFU aşamasında CTA netleştirildi.", sections: [] },
    client_report: { executiveSummary: "Müşteri özeti", sections: [] },
    full_payload: {}, previous_report_id: null, source: "hk_admin",
    created_at: "2026-09-27T00:00:00.000Z", updated_at: "2026-09-27T00:00:00.000Z", approved_at: null, activated_at: null, archived_at: null
  } as any;

  const client = buildCreativeReportDocumentPayload("MY CAKE 45", report, "client");
  const clientTitles = client.sections.map((s) => s.title.toLocaleUpperCase("tr"));
  const strategyHeadingCount = clientTitles.filter((t) => t === "KREATİF STRATEJİ ÖZETİ").length;
  assert.ok(strategyHeadingCount <= 1, "Kreatif Strateji Özeti must never be rendered more than once");

  const strategySection = client.sections.find((s) => s.title === "Kreatif Strateji Özeti");
  assert.ok(strategySection && Array.isArray(strategySection.items) && strategySection.items.length > 1, "strategy summary must be individual bullets, not one combined text block");
  assert.ok(!strategySection?.text, "strategy summary must not also render as one paragraph");

  const clientText = client.sections.map((s) => [s.title, s.text, ...(s.items || []), ...((s.table?.rows || []).flat())].join("\n")).join("\n");
  assert.match(clientText, /CTA \(Eylem çağrısı\)/, "CTA must always carry its Turkish explanation");
  assert.match(clientText, /Hook \(Dikkat çekici açılış\)/, "Hook must always carry its Turkish explanation");
  assert.match(clientText, /FPS \(Saniyedeki kare sayısı\)/, "FPS must carry its Turkish explanation when it appears in production notes");
  assert.doesNotMatch(clientText, /Kreatif yorgunluğu riski düşük/, "internalNotes must never appear in the client report");
  assert.doesNotMatch(clientText, /TOFU/, "internal-only funnel stage must not leak into the client report");

  const internal = buildCreativeReportDocumentPayload("MY CAKE 45", report, "internal");
  const internalText = internal.sections.map((s) => [s.title, s.text, ...(s.items || []), ...((s.table?.rows || []).flat())].join("\n")).join("\n");
  assert.match(internalText, /A\/B Testi \(İki farklı versiyonu karşılaştırma testi\)/, "A/B Testi must always carry its Turkish explanation in the internal report");
  assert.match(internalText, /Kreatif yorgunluğu riski düşük/);
  assert.match(internalText, /TOFU/);

  const usageSection = client.sections.find((s) => s.title === "Bu Rapor Nasıl Kullanılır?");
  assert.ok(usageSection && (usageSection.items?.length || 0) <= 4 && (usageSection.items?.length || 0) > 0);
  const actionSection = internal.sections.find((s) => s.title === "Ajans İçin Hızlı Aksiyon Özeti");
  assert.ok(actionSection && (actionSection.items?.length || 0) > 0 && (actionSection.items?.length || 0) <= 8);
});

test("buildCreativeReportDocumentPayload FIX — every creative renders its own unique main heading, even with only static/table content (no bare-heading collapse)", async () => {
  const { buildCreativeReportDocumentPayload } = await import("../../../src/lib/marketing-intelligence/ad-creative-report-document.ts");
  const report = {
    id: "r1", company_id: "c1", ad_strategy_id: null, ad_strategy_version: null, version: 1, status: "draft", report_title: "Test",
    strategy_summary: {},
    creatives: [
      { order: 1, format: "reels", title: "Birinci Kreatif", hook: "Merhaba", cta: "Yaz" },
      { order: 2, format: "carousel", title: "İkinci Kreatif", carouselSlides: [{ order: 1, title: "Slayt" }] },
      { order: 3, format: "static", title: "Üçüncü Kreatif", staticFields: { headline: "Başlık" } },
      { order: 4, format: "reels", title: "Dördüncü Kreatif", hook: "Tekrar hook", cta: "Tekrar CTA" }
    ],
    ab_test_plan: [], required_materials: [], production_checklist: [],
    internal_report: {}, client_report: {}, full_payload: {}, previous_report_id: null, source: "hk_admin",
    created_at: "2026-09-27T00:00:00.000Z", updated_at: "2026-09-27T00:00:00.000Z", approved_at: null, activated_at: null, archived_at: null
  } as any;

  for (const mode of ["client", "internal"] as const) {
    const payload = buildCreativeReportDocumentPayload("MY CAKE 45", report, mode);
    for (const [i, name] of ["BİRİNCİ KREATİF", "İKİNCİ KREATİF", "ÜÇÜNCÜ KREATİF", "DÖRDÜNCÜ KREATİF"].entries()) {
      const heading = payload.sections.find((s) => s.title === `${i + 1}. ${name}`);
      assert.ok(heading, `creative ${i + 1}'s own main heading must be present`);
      assert.ok(heading!.text || heading!.items?.length || heading!.table, "the main heading must carry real content or the renderer silently skips it");
    }
    const kisaOzetCount = payload.sections.filter((s) => s.title === "Kısa Özet").length;
    assert.equal(kisaOzetCount, 2, "creatives 1 and 4 both have hook/cta and must each keep their own Kısa Özet — dedup must never remove a different creative's repeated subheading");
  }
});

test("annotate() (via document payload) REGRESSION — idempotent: never re-wraps a term the source text already explained, in either order", async () => {
  const { buildCreativeReportDocumentPayload } = await import("../../../src/lib/marketing-intelligence/ad-creative-report-document.ts");
  const report = {
    id: "r1", company_id: "c1", ad_strategy_id: null, ad_strategy_version: null, version: 1, status: "draft", report_title: "Test",
    strategy_summary: { campaignGoal: "1 reklam seti (ad set), günde 150 TL bütçe" },
    creatives: [{
      order: 1, format: "reels", title: "Kreatif",
      details: "Kare hızı (FPS - saniyedeki kare sayısı): 30 FPS.\nÖğrenme aşaması (learning phase) uzayabilir.\nGün 15+ (Remarketing - yeniden hedefleme) planlanacak."
    }],
    ab_test_plan: [], required_materials: [], production_checklist: [],
    internal_report: {}, client_report: {}, full_payload: {}, previous_report_id: null, source: "hk_admin",
    created_at: "2026-09-27T00:00:00.000Z", updated_at: "2026-09-27T00:00:00.000Z", approved_at: null, activated_at: null, archived_at: null
  } as any;

  const internal = buildCreativeReportDocumentPayload("MY CAKE 45", report, "internal");
  const text = internal.sections.map((s) => [s.text, ...(s.items || [])].join("\n")).join("\n");
  assert.doesNotMatch(text, /\(Ad Set \(Reklam seti\)\)|Ad Set \(Reklam seti \(Reklam seti\)\)/, "Ad Set must never be nested/double-explained");
  assert.doesNotMatch(text, /saniyedeki kare sayısı\)[\s\S]*saniyedeki kare sayısı/, "FPS explanation must never repeat within the same field");
  assert.doesNotMatch(text, /Learning Phase \(Öğrenme aşaması\)[\s\S]*Learning Phase \(Öğrenme aşaması\)/, "Learning Phase must never be explained twice");
  assert.doesNotMatch(text, /\)\)/, "no nested double-closing-parens from combining an author's own parens with our label's parens");
});

test("buildCreativeReportDocumentPayload FIX — no literal Markdown leaks through (no '**', no bullet-marker-inside-bullet)", async () => {
  const { buildCreativeReportDocumentPayload } = await import("../../../src/lib/marketing-intelligence/ad-creative-report-document.ts");
  const report = {
    id: "r1", company_id: "c1", ad_strategy_id: null, ad_strategy_version: null, version: 1, status: "draft", report_title: "Test",
    strategy_summary: {}, creatives: [],
    ab_test_plan: [], required_materials: [], production_checklist: [],
    internal_report: {
      executiveSummary: "- Madde bir.\n- Madde iki.",
      sections: [{ title: "Bütçe / Öğrenme Riski", content: "- **Günlük bütçe:** 150 TL\n- **Risk:** Veri geç oluşabilir." }]
    },
    client_report: {}, full_payload: {}, previous_report_id: null, source: "hk_admin",
    created_at: "2026-09-27T00:00:00.000Z", updated_at: "2026-09-27T00:00:00.000Z", approved_at: null, activated_at: null, archived_at: null
  } as any;

  const internal = buildCreativeReportDocumentPayload("MY CAKE 45", report, "internal");
  const text = internal.sections.map((s) => [s.text, ...(s.items || [])].join("\n")).join("\n");
  assert.doesNotMatch(text, /\*\*/, "literal Markdown bold markers must never reach the rendered document");
  assert.doesNotMatch(text, /•?\s*-\s+\*/, "literal Markdown list markers must never reach the rendered document");
  assert.match(text, /Günlük bütçe: 150 TL/);
  const summarySection = internal.sections.find((s) => s.title === "Yönetici Özeti");
  assert.ok(summarySection && (summarySection.items?.length || 0) >= 2, "executive summary must render as real bullets, not one joined paragraph");
});

// --- Live coverage (requires ad_creative_reports migration) ---

test("saveCreativeReportDraft REGRESSION — new reports always start as draft, work without a linked ad strategy (requires ad_creative_reports migration)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { saveCreativeReportDraft } = await import("../../../src/lib/marketing-intelligence/ad-creative-reports.ts");
  const companyId = await makeFixtureCompany("NoStrategy");
  try {
    const report = await saveCreativeReportDraft({ companyId, creatives: [SAMPLE_CREATIVE] });
    assert.equal(report.status, "draft");
    assert.equal(report.version, 1);
    assert.equal(report.ad_strategy_id, null, "a company with no ad strategy must never break creative report creation");
    assert.equal(report.creatives.length, 1);
  } finally {
    await cleanup(companyId);
  }
});

test("saveCreativeReportDraft REGRESSION — versions instead of overwriting (requires ad_creative_reports migration)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { saveCreativeReportDraft, getCreativeReportHistory } = await import("../../../src/lib/marketing-intelligence/ad-creative-reports.ts");
  const companyId = await makeFixtureCompany("Versioning");
  try {
    const first = await saveCreativeReportDraft({ companyId, creatives: [SAMPLE_CREATIVE] });
    const second = await saveCreativeReportDraft({ companyId, creatives: [SAMPLE_CREATIVE] });
    assert.notEqual(first.id, second.id);
    assert.equal(second.version, 2);
    assert.equal(second.previous_report_id, first.id);
    const history = await getCreativeReportHistory(companyId);
    assert.equal(history.length, 2, "prior version must never be deleted/overwritten");
  } finally {
    await cleanup(companyId);
  }
});

test("updateCreativeReport / updateCreativeReportStatus REGRESSION — content update leaves other fields untouched; status flow works; cross-company rejected (requires ad_creative_reports migration)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { saveCreativeReportDraft, updateCreativeReport, updateCreativeReportStatus, validateCreativeReportPatch, AdCreativeReportNotFoundError } = await import("../../../src/lib/marketing-intelligence/ad-creative-reports.ts");
  const companyA = await makeFixtureCompany("UpdateA");
  const companyB = await makeFixtureCompany("UpdateB");
  try {
    const created = await saveCreativeReportDraft({ companyId: companyA, creatives: [SAMPLE_CREATIVE], requiredMaterials: [{ name: "Video" }] });
    const patch = validateCreativeReportPatch({ creatives: [{ ...SAMPLE_CREATIVE, title: "Güncellenmiş başlık" }] });
    const updated = await updateCreativeReport(companyA, created.id, patch);
    assert.equal(updated.id, created.id);
    assert.equal(updated.version, created.version);
    assert.equal(updated.creatives[0].title, "Güncellenmiş başlık");
    assert.deepEqual(updated.required_materials, created.required_materials, "unrelated fields must never be touched by a partial update");

    const approved = await updateCreativeReportStatus(companyA, created.id, "approved");
    assert.equal(approved.status, "approved");
    const active = await updateCreativeReportStatus(companyA, created.id, "active");
    assert.equal(active.status, "active");

    await assert.rejects(() => updateCreativeReport(companyB, created.id, patch), AdCreativeReportNotFoundError);
    await assert.rejects(() => updateCreativeReportStatus(companyB, created.id, "archived"), AdCreativeReportNotFoundError);
  } finally {
    await cleanup(companyA);
    await cleanup(companyB);
  }
});

test("PRODUCTION SAFETY — MY CAKE 45's real ad_strategies record is untouched by this suite (requires ad_strategies migration)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const rows = await supabaseRest<Array<{ id: string; version: number; status: string }>>("ad_strategies?id=eq.f0861d43-fd8f-44d9-9d02-00f1c581af3d&select=id,version,status");
  if (rows.length) {
    assert.equal(rows[0].id, "f0861d43-fd8f-44d9-9d02-00f1c581af3d");
    assert.equal(rows[0].version, 1);
  }
});
