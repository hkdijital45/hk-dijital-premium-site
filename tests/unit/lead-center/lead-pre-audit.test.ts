// Manual Lead + Ön İnceleme Hazırlığı. Duplicate-check and normalization
// are pure/live against the already-existing public.leads table and run
// unconditionally. lead_pre_audit_preparations tests require
// supabase/migrations/20261002_manual_lead_pre_audit_preparation.sql to
// be applied (the assistant never applies migrations to production
// itself — see the final report) and fail with PGRST205 "table not
// found" until then, same precedent as every other new-table feature in
// this repo.
// Run via:
//   node --env-file=.env.local --conditions=react-server --import tsx --test tests/unit/lead-center/lead-pre-audit.test.ts
import test from "node:test";
import assert from "node:assert/strict";

const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const skipReason = "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not available in this environment — live coverage skipped rather than faked.";

async function makeFixtureLead(label: string, extra: Record<string, unknown> = {}) {
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const unique = `QA-Lead-${label}-${Date.now()}`;
  const [lead] = await supabaseRest<Array<{ id: string }>>("leads", { method: "POST", body: JSON.stringify({ company: unique, name: unique, source: "Manuel Giriş", status: "Yeni Başvuru", is_test: true, ...extra }) });
  return lead.id as string;
}

async function cleanupLead(leadId: string) {
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  await supabaseRest(`lead_pre_audit_preparations?lead_id=eq.${leadId}`, { method: "DELETE" }).catch(() => {});
  await supabaseRest(`leads?id=eq.${leadId}`, { method: "DELETE" }).catch(() => {});
}

// --- normalization (pure) ---

test("normalizePhone: strips formatting and country/trunk prefixes so +90/0/bare forms all match", async () => {
  const { normalizePhone } = await import("../../../src/lib/lead-duplicate-check.ts");
  const bare = normalizePhone("5321234567");
  assert.equal(normalizePhone("+90 532 123 45 67"), bare);
  assert.equal(normalizePhone("0532 123 45 67"), bare);
  assert.equal(normalizePhone("(532) 123-45-67"), bare);
});

test("normalizeInstagram: handles @handle, bare handle, and full profile URL identically", async () => {
  const { normalizeInstagram } = await import("../../../src/lib/lead-duplicate-check.ts");
  const bare = normalizeInstagram("mycake45");
  assert.equal(normalizeInstagram("@mycake45"), bare);
  assert.equal(normalizeInstagram("https://instagram.com/mycake45"), bare);
  assert.equal(normalizeInstagram("https://instagram.com/mycake45/"), bare);
});

test("normalizeDomain: strips protocol, www, and path so different URL forms of the same site match", async () => {
  const { normalizeDomain } = await import("../../../src/lib/lead-duplicate-check.ts");
  const bare = normalizeDomain("example.com");
  assert.equal(normalizeDomain("https://www.example.com/"), bare);
  assert.equal(normalizeDomain("http://example.com/iletisim"), bare);
});

// --- duplicate check (live, real leads table) ---

test("checkLeadDuplicate: exact phone match blocks, exact instagram match blocks, exact domain match blocks", { skip: hasSupabase ? false : skipReason }, async () => {
  const { checkLeadDuplicate } = await import("../../../src/lib/lead-duplicate-check.ts");
  const leadId = await makeFixtureLead("ExactMatch", { phone: "05321112233", instagram: "qa_unique_handle_xyz", website: "https://qa-unique-domain-xyz.test" });
  try {
    const byPhone = await checkLeadDuplicate({ phone: "+90 532 111 22 33" });
    assert.equal(byPhone.exactMatch?.id, leadId);

    const byInstagram = await checkLeadDuplicate({ instagram: "@qa_unique_handle_xyz" });
    assert.equal(byInstagram.exactMatch?.id, leadId);

    const byDomain = await checkLeadDuplicate({ website: "http://www.qa-unique-domain-xyz.test/page" });
    assert.equal(byDomain.exactMatch?.id, leadId);
  } finally {
    await cleanupLead(leadId);
  }
});

test("checkLeadDuplicate: a weak name-only similarity never blocks — reported as possibleMatches only", { skip: hasSupabase ? false : skipReason }, async () => {
  const { checkLeadDuplicate } = await import("../../../src/lib/lead-duplicate-check.ts");
  const unique = `QA-WeakMatch-${Date.now()}`;
  const leadId = await makeFixtureLead("WeakBase", { company: unique, district: "Kadıköy" });
  try {
    const result = await checkLeadDuplicate({ company: unique, district: "Kadıköy" });
    assert.equal(result.exactMatch, null, "a name+district match alone must never be treated as a blocking exact duplicate");
    assert.ok(result.possibleMatches.some((m) => m.id === leadId));
  } finally {
    await cleanupLead(leadId);
  }
});

test("checkLeadDuplicate: genuinely distinct businesses never match", { skip: hasSupabase ? false : skipReason }, async () => {
  const { checkLeadDuplicate } = await import("../../../src/lib/lead-duplicate-check.ts");
  const result = await checkLeadDuplicate({ phone: "+90 500 000 00 00", instagram: "qa_definitely_not_a_real_handle_000", website: "https://qa-definitely-not-real-000.test", company: "QA Definitely Not A Real Business 000" });
  assert.equal(result.exactMatch, null);
  assert.deepEqual(result.possibleMatches, []);
});

// --- get_pre_audit_context MCP regression: lead instagram + preparation notes ---

test("get_pre_audit_context REGRESSION — a lead's instagram/phone/district/source and its Ön İncelemeye Hazırla preparation notes are all included in the MCP context, not silently dropped", { skip: hasSupabase ? false : skipReason }, async () => {
  const { execute } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  const { savePreparation } = await import("../../../src/lib/lead-pre-audit-preparation.ts");
  const leadId = await makeFixtureLead("McpContext", {
    instagram: "https://www.instagram.com/testgurme", phone: "05551112233", district: "Yunusemre",
    source_detail: "Instagram", sector: "Şarküteri"
  });
  try {
    await savePreparation(leadId, {
      social_observations: "test sosyal gözlem", business_notes: "test işletme notu",
      advertising_status: "no", potential_reason: "yeni işletme", status: "ready"
    });

    const context: any = await execute("get_pre_audit_context", { leadId });
    assert.equal(context.status, "resolved");
    assert.equal(context.lead.instagram, "https://www.instagram.com/testgurme", "instagram must never be dropped from the MCP context");
    assert.equal(context.lead.phone, "05551112233");
    assert.equal(context.lead.district, "Yunusemre");
    assert.equal(context.lead.sourceDetail, "Instagram");
    assert.ok(context.preparation, "preparation must be present when a prep row exists");
    assert.equal(context.preparation.socialObservations, "test sosyal gözlem");
    assert.equal(context.preparation.businessNotes, "test işletme notu");
    assert.equal(context.preparation.advertisingStatus, "no");
    assert.equal(context.preparation.potentialReason, "yeni işletme");
    assert.equal(context.preparation.status, "ready");
  } finally {
    await cleanupLead(leadId);
  }
});

test("get_pre_audit_context REGRESSION — a lead with no preparation row yet returns preparation: null, never a fabricated empty object; cross-lead isolation holds", { skip: hasSupabase ? false : skipReason }, async () => {
  const { execute } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  const { savePreparation } = await import("../../../src/lib/lead-pre-audit-preparation.ts");
  const leadA = await makeFixtureLead("IsolationA", { instagram: "https://www.instagram.com/leada_secret" });
  const leadB = await makeFixtureLead("IsolationB");
  try {
    await savePreparation(leadA, { social_observations: "Lead A'ya özel gizli not", status: "ready" });

    const contextB: any = await execute("get_pre_audit_context", { leadId: leadB });
    assert.equal(contextB.preparation, null, "a lead with no preparation row must return null, not a fabricated object");
    assert.equal(JSON.stringify(contextB).includes("Lead A"), false, "lead B's context must never contain lead A's data");
    assert.equal(JSON.stringify(contextB).includes("leada_secret"), false);
  } finally {
    await cleanupLead(leadA);
    await cleanupLead(leadB);
  }
});

// --- lead_pre_audit_preparations (live, requires migration) ---

test("getOrCreatePreparation / savePreparation: lazy-creates a 1:1 row, persists edits, rejects invalid enum values (requires lead_pre_audit_preparations migration)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { getOrCreatePreparation, savePreparation, LeadPreAuditPrepValidationError } = await import("../../../src/lib/lead-pre-audit-preparation.ts");
  const leadId = await makeFixtureLead("PrepFlow");
  try {
    const first = await getOrCreatePreparation(leadId);
    assert.equal(first.status, "not_prepared");

    const again = await getOrCreatePreparation(leadId);
    assert.equal(again.id, first.id, "must never create a second preparation row for the same lead");

    const saved = await savePreparation(leadId, { social_observations: "Aktif Instagram hesabı.", advertising_status: "no", status: "preparing" });
    assert.equal(saved.social_observations, "Aktif Instagram hesabı.");
    assert.equal(saved.advertising_status, "no");
    assert.equal(saved.status, "preparing");

    await assert.rejects(() => savePreparation(leadId, { advertising_status: "maybe" as never }), LeadPreAuditPrepValidationError);
  } finally {
    await cleanupLead(leadId);
  }
});

test("getOrCreatePreparation: status is reconciled to 'completed' once a pre_audit_reports row exists for the lead, without a manual status write (requires lead_pre_audit_preparations + pre_audit_reports migrations)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { getOrCreatePreparation, savePreparation } = await import("../../../src/lib/lead-pre-audit-preparation.ts");
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const leadId = await makeFixtureLead("CompletedSync");
  try {
    await savePreparation(leadId, { status: "sent_to_claude" });
    await supabaseRest("pre_audit_reports", { method: "POST", body: JSON.stringify({ lead_id: leadId, report_type: "INTERNAL_REPORT", title: "QA test report" }) }).catch(() => {});

    const reconciled = await getOrCreatePreparation(leadId);
    assert.equal(reconciled.status, "completed", "an existing saved report for this lead must always win over a stale preparation status");
  } finally {
    await supabaseRest(`pre_audit_reports?lead_id=eq.${leadId}`, { method: "DELETE" }).catch(() => {});
    await cleanupLead(leadId);
  }
});

test("buildLeadPreAuditPrompt: references the real lead ID, embeds only the stored form values (never name/email/phone), and keeps the MCP save instruction", async () => {
  const { buildLeadPreAuditPrompt } = await import("../../../src/lib/lead-pre-audit-preparation.ts");
  const prompt = buildLeadPreAuditPrompt("11111111-2222-3333-4444-555555555555", { company: "Örnek Pasta", address: "Yunusemre Mah. 1. Sokak", name: "Ayşe Yılmaz", email: "ayse@example.com" } as never);
  assert.match(prompt, /11111111-2222-3333-4444-555555555555/);
  assert.match(prompt, /Firma:\nÖrnek Pasta/);
  assert.match(prompt, /Açık Adres:\nYunusemre Mah\. 1\. Sokak/);
  assert.doesNotMatch(prompt, /Ayşe Yılmaz|ayse@example\.com/);
  assert.match(prompt, /HK Dijital MCP/);
});

test("PRODUCTION SAFETY — MY CAKE 45's real ad_strategies record is unaffected by this suite", { skip: hasSupabase ? false : skipReason }, async () => {
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const rows = await supabaseRest<Array<{ id: string; version: number }>>("ad_strategies?id=eq.f0861d43-fd8f-44d9-9d02-00f1c581af3d&select=id,version");
  if (rows.length) assert.equal(rows[0].version, 1);
});
