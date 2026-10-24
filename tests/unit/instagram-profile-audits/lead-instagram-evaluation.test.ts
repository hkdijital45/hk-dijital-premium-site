// Instagram Değerlendirme for a registered CRM lead (direct-MCP-save path)
// — data layer + MCP registration regression tests. Run via:
//   node --env-file=.env.local --conditions=react-server --import tsx --test tests/unit/instagram-profile-audits/*.test.ts
import test from "node:test";
import assert from "node:assert/strict";

const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const skipReason = "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not available in this environment — live regression coverage skipped rather than faked.";

// --- Pure validation (no network) ---

test("saveLeadInstagramEvaluation REGRESSION — rejects a missing leadId before any network call", async () => {
  const { saveLeadInstagramEvaluation, LeadInstagramEvaluationValidationError } = await import("../../../src/lib/instagram-intelligence/lead-evaluation.ts");
  await assert.rejects(() => saveLeadInstagramEvaluation({ leadId: "" }), LeadInstagramEvaluationValidationError);
});

test("saveLeadInstagramEvaluation REGRESSION — rejects an unknown data field before any network call (never silently invents a field)", async () => {
  const { saveLeadInstagramEvaluation, LeadInstagramEvaluationValidationError } = await import("../../../src/lib/instagram-intelligence/lead-evaluation.ts");
  await assert.rejects(
    () => saveLeadInstagramEvaluation({ leadId: "00000000-0000-4000-8000-000000000000", data: { notARealField: 1 } }),
    LeadInstagramEvaluationValidationError
  );
});

// --- MCP registration ---

test("MCP REGRESSION — the 3 Lead Instagram Değerlendirme tools are registered exactly once, no duplicate names anywhere", async () => {
  const { tools } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  const names = tools.map((t: any) => t.name);
  assert.equal(new Set(names).size, names.length, "no duplicate tool names");
  for (const name of ["get_lead_instagram_evaluation_context", "save_lead_instagram_evaluation", "get_lead_instagram_evaluations"]) {
    assert.equal(names.filter((n: string) => n === name).length, 1, `${name} must be registered exactly once`);
  }
  assert.equal(names.length, 45); // +get_company_logo_status, +discover_company_logo (Premium Report System V3)
});

test("MCP REGRESSION — get_lead_instagram_evaluation_context and get_lead_instagram_evaluations are READ_ONLY, save_lead_instagram_evaluation is WRITE_SAFE", async () => {
  const { tools } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  const byName = Object.fromEntries(tools.map((t: any) => [t.name, t]));
  assert.equal(byName.get_lead_instagram_evaluation_context.permission, "READ_ONLY");
  assert.equal(byName.get_lead_instagram_evaluations.permission, "READ_ONLY");
  assert.equal(byName.save_lead_instagram_evaluation.permission, "WRITE_SAFE");
  assert.deepEqual(byName.get_lead_instagram_evaluation_context.inputSchema.required, ["leadId"]);
  assert.deepEqual(byName.save_lead_instagram_evaluation.inputSchema.required, ["leadId"]);
  assert.match(byName.save_lead_instagram_evaluation.description, /explicitly/i);
  assert.match(byName.save_lead_instagram_evaluation.description, /save_instagram_profile_audit/, "must clearly disambiguate from the connected-customer tool");
});

test("MCP REGRESSION — execute() rejects unknown tool names as UNKNOWN_TOOL (sanity check still holds with the new tools registered)", async () => {
  const { execute, ControlError } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  await assert.rejects(() => execute("get_lead_instagram_evaluation", {}), (error: unknown) => error instanceof ControlError && (error as InstanceType<typeof ControlError>).code === "UNKNOWN_TOOL");
});

// --- 4000-char MCP wire limit fix: save_lead_instagram_evaluation.reportText
// needed to accept a full, real 15,726-character Instagram Değerlendirme
// report (18 sections) without truncation — the shared validateArguments()
// in social-autopilot/control/protocol.ts hard-coded every string field to
// 4000 chars. Fixed by adding an opt-in `maxLength` to the field type
// (default stays 4000 for every field that doesn't set it); reportText is
// now the one field that opts into 50000. ---

test("MCP REGRESSION — save_lead_instagram_evaluation's reportText field is registered with a 50000-char maxLength, notes keeps the shared 4000-char default", async () => {
  const { tools } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  const tool = tools.find((t: any) => t.name === "save_lead_instagram_evaluation")!;
  assert.equal(tool.inputSchema.properties.reportText.maxLength, 50000);
  assert.equal(tool.inputSchema.properties.notes.maxLength, undefined, "notes must keep the shared 4000-char default, never widened");
});

test("validateArguments (the real MCP wire-level check) — accepts a real 15,726-char reportText, accepts exactly 50,000, rejects 50,001, while notes still rejects over 4000", async () => {
  const { tools, validateArguments } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  const tool = tools.find((t: any) => t.name === "save_lead_instagram_evaluation")!;
  const leadId = "00000000-0000-4000-8000-000000000000";
  assert.doesNotThrow(() => validateArguments(tool, { leadId, reportText: "a".repeat(15726) }), "the real ALTIN SEYİT report length (15,726 chars) must pass");
  assert.doesNotThrow(() => validateArguments(tool, { leadId, reportText: "a".repeat(50000) }));
  assert.throws(() => validateArguments(tool, { leadId, reportText: "a".repeat(50001) }));
  assert.doesNotThrow(() => validateArguments(tool, { leadId, notes: "a".repeat(4000) }));
  assert.throws(() => validateArguments(tool, { leadId, notes: "a".repeat(4001) }), "notes must still reject over 4000 — this field was never widened");
});

test("MCP REGRESSION — every OTHER registered tool's string fields are unaffected (no field anywhere else silently gained a maxLength)", async () => {
  const { tools } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  for (const tool of tools) {
    if (tool.name === "save_lead_instagram_evaluation") continue;
    for (const [key, field] of Object.entries(tool.inputSchema.properties) as Array<[string, any]>) {
      if (field.type === "string") assert.equal(field.maxLength, undefined, `${tool.name}.${key} must not have gained a maxLength — only save_lead_instagram_evaluation.reportText should`);
    }
  }
});

// --- Prompt copy (HK Admin -> Claude, no copy-paste back required) ---

test("AdInsightsCenter's lead prompt references the real get_lead_instagram_evaluation_context/save_lead_instagram_evaluation tool names and the real leadId, never a secret", async () => {
  const fs = await import("node:fs");
  const source = fs.readFileSync(new URL("../../../src/components/admin/AdInsightsCenter.tsx", import.meta.url), "utf8");
  assert.match(source, /get_lead_instagram_evaluation_context/);
  assert.match(source, /save_lead_instagram_evaluation/);
  assert.match(source, /leadId: \$\{lead\.id\}/);
  assert.doesNotMatch(source.toLocaleLowerCase("tr"), /service_role|service role key/);
});

// --- Live, self-provisioning integration coverage (real Supabase, disposable QA-prefixed data only) ---

// Regression for a real production save (Opus Sanat Akademi, 2026-10-23)
// that lost several qualitative fields: the caller sent natural values
// ("Hayır" for isExistingCustomer, "Yüksek" for a quality field) that did
// not exactly match the rigid canonical option strings, got a vague error,
// and gave up on those fields rather than retry correctly. Confirms the
// actual save path (not just the pure normalize function) now accepts and
// correctly canonicalizes these exact real-world values end-to-end.
test("saveLeadInstagramEvaluation — naturally-phrased select values are normalized and persisted as the exact canonical strings, not rejected or silently dropped", { skip: hasSupabase ? false : skipReason }, async () => {
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const { saveLeadInstagramEvaluation } = await import("../../../src/lib/instagram-intelligence/lead-evaluation.ts");

  const unique = `QA Lead IG Synonyms ${Date.now()}`;
  const [lead] = await supabaseRest<Array<{ id: string }>>("leads", { method: "POST", body: JSON.stringify({ company: unique, status: "yeni" }) });
  const leadId = lead.id;

  try {
    const saved = await saveLeadInstagramEvaluation({
      leadId,
      data: {
        businessName: unique,
        isExistingCustomer: "Hayır",
        profilePhotoQuality: "Yüksek",
        whatsappAvailable: "false"
      }
    });
    assert.equal(saved.data.isExistingCustomer, "Hayır (Aday / Halka Açık Profil)", "the verbose canonical string must be reachable from the natural 'Hayır'");
    assert.equal(saved.data.profilePhotoQuality, "İyi");
    assert.equal(saved.data.whatsappAvailable, "Hayır");
  } finally {
    await supabaseRest(`manual_evaluations?lead_id=eq.${leadId}`, { method: "DELETE" });
    await supabaseRest(`leads?id=eq.${leadId}`, { method: "DELETE" });
  }
});

test("Lead Instagram Değerlendirme — full context/save/update/list/get cycle against a disposable test lead", { skip: hasSupabase ? false : skipReason }, async () => {
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const { getLeadInstagramEvaluationContext, saveLeadInstagramEvaluation, LeadInstagramEvaluationNotFoundError } = await import("../../../src/lib/instagram-intelligence/lead-evaluation.ts");
  const { listManualEvaluations } = await import("../../../src/lib/manual-evaluations.ts");

  const unique = `QA Lead IG ${Date.now()}`;
  const [lead] = await supabaseRest<Array<{ id: string }>>("leads", {
    method: "POST",
    body: JSON.stringify({ company: unique, business_type: "Güzellik Salonu", city: "İzmir", district: "Bornova", instagram: "qa_lead_handle", status: "yeni" })
  });
  const leadId = lead.id;

  try {
    // 1) Context resolves the real lead, with no prior evaluation.
    const context = await getLeadInstagramEvaluationContext(leadId);
    assert.equal(context.status, "resolved");
    if (context.status !== "resolved") throw new Error("unreachable");
    assert.equal(context.lead.id, leadId);
    assert.equal(context.lead.instagramUsername, "qa_lead_handle");
    assert.equal(context.lead.isExistingCustomer, false);
    assert.equal(context.existingEvaluation, null);

    // 2) A real leadId + valid data saves successfully, source tagged
    // claude_import (never silently "manual") for honest provenance.
    const saved = await saveLeadInstagramEvaluation({
      leadId,
      title: "QA Instagram Değerlendirmesi",
      data: { businessName: unique, instagramUsername: "qa_lead_handle", sector: "Güzellik Salonu" },
      notes: "Profil fotoğrafı net; bio'da CTA eksik."
    });
    assert.equal(saved.lead_id, leadId);
    assert.equal(saved.company_id, null);
    assert.equal(saved.module, "instagram");
    assert.equal(saved.source, "claude_import");
    assert.equal(saved.status, "submitted", "default status must be submitted (this is the finished-evaluation path, not a draft form)");

    // 3) Context now reports the saved evaluation back.
    const contextAfter = await getLeadInstagramEvaluationContext(leadId);
    if (contextAfter.status !== "resolved") throw new Error("unreachable");
    assert.equal(contextAfter.existingEvaluation?.id, saved.id);

    // 4) evaluationId lets Claude update the SAME row (no duplicate).
    const updated = await saveLeadInstagramEvaluation({
      leadId, evaluationId: saved.id,
      data: { businessName: unique, instagramUsername: "qa_lead_handle", sector: "Güzellik Salonu", bioQuality: "Orta" },
      notes: "Bio güncellendi, CTA hâlâ eksik."
    });
    assert.equal(updated.id, saved.id, "must update in place, never create a second row");
    assert.equal(updated.data.bioQuality, "Orta");

    const history = await listManualEvaluations("instagram", { leadId });
    assert.equal(history.length, 1, "update must never duplicate — exactly one row for this lead");

    // 5) An evaluationId that belongs to a DIFFERENT lead is refused.
    const [otherLead] = await supabaseRest<Array<{ id: string }>>("leads", { method: "POST", body: JSON.stringify({ company: `${unique}-OTHER`, status: "yeni" }) });
    try {
      await assert.rejects(
        () => saveLeadInstagramEvaluation({ leadId: otherLead.id, evaluationId: saved.id, data: {} }),
        LeadInstagramEvaluationNotFoundError
      );
    } finally {
      await supabaseRest(`leads?id=eq.${otherLead.id}`, { method: "DELETE" });
    }
  } finally {
    await supabaseRest(`manual_evaluations?lead_id=eq.${leadId}`, { method: "DELETE" });
    await supabaseRest(`leads?id=eq.${leadId}`, { method: "DELETE" });
  }
});

test("Lead Instagram Değerlendirme — a full 15,726-char long-form report survives the save/read-back cycle with zero truncation (API -> DB -> read)", { skip: hasSupabase ? false : skipReason }, async () => {
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const { saveLeadInstagramEvaluation } = await import("../../../src/lib/instagram-intelligence/lead-evaluation.ts");
  const { getManualEvaluation } = await import("../../../src/lib/manual-evaluations.ts");

  const unique = `QA Lead IG LongReport ${Date.now()}`;
  const [lead] = await supabaseRest<Array<{ id: string }>>("leads", { method: "POST", body: JSON.stringify({ company: unique, status: "yeni" }) });
  const leadId = lead.id;

  // A real-shaped 18-section long-form report, built to land at exactly
  // 15,726 characters — the length of the actual ALTIN SEYİT report that
  // the shared 4000-char limit was rejecting before this fix.
  const sectionBody = "Bu bölümde gerçek, uzun biçimli Instagram Değerlendirme analiz metni yer alır. ".repeat(12);
  let longReport = Array.from({ length: 18 }, (_, i) => `BÖLÜM ${i + 1}\n${sectionBody}`).join("\n\n");
  longReport = longReport.length >= 15726 ? longReport.slice(0, 15726) : longReport.padEnd(15726, "x");
  assert.equal(longReport.length, 15726);

  try {
    const saved = await saveLeadInstagramEvaluation({ leadId, title: "ALTIN SEYİT Instagram Değerlendirmesi", reportText: longReport });
    assert.equal(saved.claude_import?.text.length, 15726, "the saved row must preserve the full report length, not a truncated/summarized version");
    assert.equal(saved.claude_import?.text, longReport, "content must be byte-for-byte identical, never silently altered");

    const readBack = await getManualEvaluation(saved.id);
    assert.equal(readBack.claude_import?.text.length, 15726, "reading the row back from the database must still return the full, untruncated report");
    assert.equal(readBack.claude_import?.text, longReport);
  } finally {
    await supabaseRest(`manual_evaluations?lead_id=eq.${leadId}`, { method: "DELETE" });
    await supabaseRest(`leads?id=eq.${leadId}`, { method: "DELETE" });
  }
});
