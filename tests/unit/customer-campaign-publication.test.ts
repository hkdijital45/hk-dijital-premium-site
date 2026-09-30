// Customer profile campaign publication ("Müşteriye görünür mü?") —
// getCustomerCenterData() is the single, existing, company-scoped
// customer-portal data loader (src/app/musteri-paneli/page.tsx derives
// companyId strictly from session.companyId, never a request param, for
// the customer role — see PRIMARY TASK 1). These tests cover the data
// layer's own contract directly: visibility on/off, cross-customer
// isolation, and that internal/technical fields never leave the
// function, using disposable QA-prefixed fixtures. Run via:
//   node --env-file=.env.local --conditions=react-server --import tsx --test tests/unit/customer-campaign-publication.test.ts
import test from "node:test";
import assert from "node:assert/strict";

const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const skipReason = "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not available in this environment — live coverage skipped rather than faked.";

async function makeCompany(label: string) {
  const { supabaseRest } = await import("../../src/lib/supabase.ts");
  const unique = `QA-CustomerPub-${label}-${Date.now()}`;
  const [company] = await supabaseRest<Array<{ id: string }>>("companies", { method: "POST", body: JSON.stringify({ name: unique, email: `${unique.toLocaleLowerCase("en")}@example.test`, is_test: true }) });
  return company.id as string;
}

async function cleanup(companyId: string) {
  const { supabaseRest } = await import("../../src/lib/supabase.ts");
  await supabaseRest(`campaigns?company_id=eq.${companyId}`, { method: "DELETE" }).catch(() => {});
  await supabaseRest(`campaign_metrics?company_id=eq.${companyId}`, { method: "DELETE" }).catch(() => {});
  await supabaseRest(`companies?id=eq.${companyId}`, { method: "DELETE" }).catch(() => {});
}

test("getCustomerCenterData REGRESSION — visible campaign shows a safe performance summary; hidden campaign never appears; cross-customer isolation holds", { skip: hasSupabase ? false : skipReason }, async () => {
  const { supabaseRest } = await import("../../src/lib/supabase.ts");
  const { getCustomerCenterData } = await import("../../src/lib/customer-center.ts");
  const companyA = await makeCompany("A");
  const companyB = await makeCompany("B");
  try {
    const [visibleCampaign] = await supabaseRest<Array<{ id: string }>>("campaigns", {
      method: "POST", headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        company_id: companyA, name: "Görünür Kampanya", platform: "Meta Ads", objective: "Lead", status: "Aktif",
        meta_campaign_id: "meta_123", external_id: "meta_123", source: "Meta", visible_to_customer: true,
        internal_notes: "GİZLİ AJANS NOTU — asla müşteriye gitmemeli", notes: "Müşteriye güvenle gösterilebilir not",
        settings: { meta_lifecycle: { access_token: "should-never-leak" } }
      })
    });
    const [hiddenCampaign] = await supabaseRest<Array<{ id: string }>>("campaigns", {
      method: "POST", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ company_id: companyA, name: "Gizli Kampanya", platform: "Meta Ads", status: "Aktif", visible_to_customer: false })
    });
    await supabaseRest("campaign_metrics", {
      method: "POST",
      body: JSON.stringify({
        company_id: companyA, meta_campaign_id: "meta_123", campaign_id: visibleCampaign.id, date: new Date().toISOString().slice(0, 10),
        spend: 150, reach: 2000, impressions: 5000, clicks: 40, ctr: 0.8, cpc: 3.75, cpm: 30, results: 5, leads: 5, messages: 3,
        visible_to_customer: true, raw_data: { access_token: "should-never-leak", graph_debug: true }
      })
    });

    const dataA = await getCustomerCenterData(companyA);
    const visible = dataA.campaigns.find((c: any) => c.id === visibleCampaign.id);
    assert.ok(visible, "visible_to_customer=true campaign must appear");
    assert.ok(!dataA.campaigns.some((c: any) => c.id === hiddenCampaign.id), "visible_to_customer=false campaign must never appear");

    // Internal/technical fields must never reach the customer object at all.
    assert.equal(visible.internal_notes, undefined);
    assert.equal(visible.meta_campaign_id, undefined);
    assert.equal(visible.external_id, undefined);
    assert.equal(visible.settings, undefined);
    assert.equal(visible.notes, "Müşteriye güvenle gösterilebilir not");

    // Safe performance summary, matched via the (now-stripped) meta_campaign_id server-side.
    assert.ok(visible.performanceSummary, "a matched campaign_metrics row must produce a performanceSummary");
    assert.equal(visible.performanceSummary.spend, 150);
    assert.equal(visible.performanceSummary.results, 5);
    assert.equal(visible.performanceSummary.messages, 3);

    const rawMetric = dataA.metrics.find((m: any) => m.campaign_id === visibleCampaign.id);
    assert.ok(rawMetric);
    assert.equal(rawMetric.raw_data, undefined, "raw_data (contains graph debug payload) must never reach the customer object");

    // Cross-customer isolation: company B must never see company A's campaigns.
    const dataB = await getCustomerCenterData(companyB);
    assert.equal(dataB.campaigns.length, 0);
  } finally {
    await cleanup(companyA);
    await cleanup(companyB);
  }
});

test("getCustomerCenterData: a visible campaign with no matching metrics rows gets performanceSummary: null, never a fake zero", { skip: hasSupabase ? false : skipReason }, async () => {
  const { supabaseRest } = await import("../../src/lib/supabase.ts");
  const { getCustomerCenterData } = await import("../../src/lib/customer-center.ts");
  const companyId = await makeCompany("NoMetrics");
  try {
    await supabaseRest("campaigns", {
      method: "POST",
      body: JSON.stringify({ company_id: companyId, name: "Yeni Kampanya", platform: "Meta Ads", status: "Planlandı", visible_to_customer: true })
    });
    const data = await getCustomerCenterData(companyId);
    assert.equal(data.campaigns.length, 1);
    assert.equal(data.campaigns[0].performanceSummary, null, "no matching metrics must be null, never a fabricated zero-value summary");
  } finally {
    await cleanup(companyId);
  }
});
