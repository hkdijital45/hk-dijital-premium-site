// Instagram Profil Optimizasyonu — data layer + MCP registration +
// prompt-copy regression tests. Run via:
//   node --env-file=.env.local --conditions=react-server --import tsx --test tests/unit/instagram-profile-audits/*.test.ts
import test from "node:test";
import assert from "node:assert/strict";

const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const skipReason = "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not available in this environment — live regression coverage skipped rather than faked.";

// --- Pure validation (no network) ---

test("saveInstagramProfileAudit REGRESSION — rejects a missing companyId before any network call", async () => {
  const { saveInstagramProfileAudit, InstagramProfileAuditValidationError } = await import("../../../src/lib/instagram-profile-audits.ts");
  await assert.rejects(() => saveInstagramProfileAudit({ instagramUsername: "test", overallSummary: "Yeterince uzun bir özet metni." }), InstagramProfileAuditValidationError);
});

test("saveInstagramProfileAudit REGRESSION — rejects a missing/too-short overallSummary", async () => {
  const { saveInstagramProfileAudit, InstagramProfileAuditValidationError } = await import("../../../src/lib/instagram-profile-audits.ts");
  await assert.rejects(() => saveInstagramProfileAudit({ companyId: "00000000-0000-4000-8000-000000000000", instagramUsername: "test", overallSummary: "kısa" }), InstagramProfileAuditValidationError);
});

test("saveInstagramProfileAudit REGRESSION — rejects an invalid status value", async () => {
  const { saveInstagramProfileAudit, InstagramProfileAuditValidationError } = await import("../../../src/lib/instagram-profile-audits.ts");
  await assert.rejects(
    () => saveInstagramProfileAudit({ companyId: "00000000-0000-4000-8000-000000000000", instagramUsername: "test", overallSummary: "Yeterince uzun bir özet metni burada.", status: "published" }),
    InstagramProfileAuditValidationError
  );
});

test("INSTAGRAM_PROFILE_AUDIT_STATUS_LABELS: covers exactly the 3 required statuses with Turkish labels", async () => {
  const { INSTAGRAM_PROFILE_AUDIT_STATUSES, INSTAGRAM_PROFILE_AUDIT_STATUS_LABELS } = await import("../../../src/lib/instagram-profile-audits.ts");
  assert.deepEqual([...INSTAGRAM_PROFILE_AUDIT_STATUSES].sort(), ["approved", "completed", "draft"]);
  assert.equal(INSTAGRAM_PROFILE_AUDIT_STATUS_LABELS.draft, "Taslak");
  assert.equal(INSTAGRAM_PROFILE_AUDIT_STATUS_LABELS.approved, "Onaylandı");
  assert.equal(INSTAGRAM_PROFILE_AUDIT_STATUS_LABELS.completed, "Tamamlandı");
});

// --- MCP registration ---

test("MCP REGRESSION — the 3 Instagram Profil Optimizasyonu tools are registered exactly once, no duplicate names anywhere", async () => {
  const { tools } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  const names = tools.map((t: any) => t.name);
  assert.equal(new Set(names).size, names.length, "no duplicate tool names");
  for (const name of ["get_instagram_profile_audit_context", "save_instagram_profile_audit", "get_instagram_profile_audits"]) {
    assert.equal(names.filter((n: string) => n === name).length, 1, `${name} must be registered exactly once`);
  }
  assert.equal(names.length, 26);
});

test("MCP REGRESSION — save_instagram_profile_audit requires companyId/instagramUsername/overallSummary and is WRITE_SAFE", async () => {
  const { tools } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  const tool = tools.find((t: any) => t.name === "save_instagram_profile_audit")!;
  assert.equal(tool.permission, "WRITE_SAFE");
  assert.deepEqual(tool.inputSchema.required, ["companyId", "instagramUsername", "overallSummary"]);
  assert.match(tool.description, /explicitly/i);
});

test("MCP REGRESSION — get_instagram_profile_audit_context and get_instagram_profile_audits are READ_ONLY", async () => {
  const { tools } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  const byName = Object.fromEntries(tools.map((t: any) => [t.name, t]));
  assert.equal(byName.get_instagram_profile_audit_context.permission, "READ_ONLY");
  assert.equal(byName.get_instagram_profile_audits.permission, "READ_ONLY");
});

test("MCP REGRESSION — execute() rejects unknown tool names as UNKNOWN_TOOL", async () => {
  const { execute, ControlError } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  await assert.rejects(() => execute("get_instagram_profile_audit", {}), (error: unknown) => error instanceof ControlError && (error as InstanceType<typeof ControlError>).code === "UNKNOWN_TOOL");
});

// --- Prompt copy ---

test("buildInstagramProfileAuditPrompt: contains the real company name, real company_id, and the connected Instagram username, never a secret", async () => {
  const { buildInstagramProfileAuditPrompt } = await import("../../../src/lib/instagram-profile-audit-prompt.ts");
  const prompt = buildInstagramProfileAuditPrompt({ id: "abc-123-company-id", name: "RS Beauty" }, "rsbeauty_manisa");
  assert.match(prompt, /RS Beauty/);
  assert.match(prompt, /abc-123-company-id/);
  assert.match(prompt, /@rsbeauty_manisa/);
  assert.match(prompt, /save_instagram_profile_audit/);
  assert.match(prompt, /Kaydet/);
  assert.doesNotMatch(prompt.toLocaleLowerCase("tr"), /token|secret|access_token|api_key|şifre/);
});

test("buildInstagramProfileAuditPrompt: never fabricates a username when the account isn't connected — asks Claude to resolve it via the context tool instead", async () => {
  const { buildInstagramProfileAuditPrompt } = await import("../../../src/lib/instagram-profile-audit-prompt.ts");
  const prompt = buildInstagramProfileAuditPrompt({ id: "abc-123", name: "RS Beauty" }, null);
  assert.doesNotMatch(prompt, /Instagram kullanıcı adı: @/);
  assert.match(prompt, /get_instagram_profile_audit_context ile doğrula/);
});

test("buildInstagramProfileAuditPrompt: requires the explicit approval condition before save_instagram_profile_audit is ever called", async () => {
  const { buildInstagramProfileAuditPrompt } = await import("../../../src/lib/instagram-profile-audit-prompt.ts");
  const prompt = buildInstagramProfileAuditPrompt({ id: "x", name: "Y" }, "y");
  assert.match(prompt, /açıkça onaylayıp 'Kaydet' demeden save_instagram_profile_audit kullanma/);
});

// --- Live, self-provisioning integration coverage (real Supabase, disposable QA-prefixed data only) ---

test("Instagram Profil Optimizasyonu — full context/save/list/get cycle against a disposable test company", { skip: hasSupabase ? false : skipReason }, async () => {
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const {
    getInstagramProfileAuditContext, saveInstagramProfileAudit, getInstagramProfileAudits, INSTAGRAM_PROFILE_AUDITS_TABLE
  } = await import("../../../src/lib/instagram-profile-audits.ts");

  const unique = `QA-IG-Audit-${Date.now()}`;
  const [company] = await supabaseRest<Array<{ id: string }>>("companies", {
    method: "POST",
    body: JSON.stringify({ name: unique, email: `${unique.toLocaleLowerCase("en")}@example.test`, is_test: true, instagram: "qa_manual_handle" })
  });
  const companyId = company.id;

  try {
    // 1) Context resolves the real company + the manual-entry Instagram
    // fallback (no OAuth connection exists for this disposable test row).
    const context = await getInstagramProfileAuditContext(companyId);
    assert.equal(context.company.id, companyId);
    assert.equal(context.instagram.username, "qa_manual_handle");
    assert.equal(context.instagram.usernameSource, "manual");
    assert.equal(context.latestAudit, null);

    // 2) A real company_id + valid payload saves successfully.
    const saved = await saveInstagramProfileAudit({
      companyId, instagramUsername: "@qa_manual_handle", overallSummary: "Genel görünüm iyi; bio ve link/CTA geliştirilebilir.",
      currentBio: "Eski bio metni.", recommendedBio: "Yeni önerilen bio metni.",
      priorities: [{ level: "high", title: "Bio güncelle" }], checklist: [{ text: "Yeni bio'yu kullan" }]
    });
    assert.equal(saved.company_id, companyId);
    assert.equal(saved.instagram_username, "qa_manual_handle", "leading @ must be stripped");
    assert.equal(saved.status, "draft", "default status must be draft when not specified");
    assert.equal(saved.previous_audit_id, null, "first audit for this company has no previous_audit_id");

    // 3) A second analysis creates a NEW row and chains to the first
    // (history preserved, never overwritten).
    const secondSaved = await saveInstagramProfileAudit({
      companyId, instagramUsername: "qa_manual_handle", overallSummary: "İkinci analiz — bio güncellendi, link/CTA hâlâ eksik.", status: "approved"
    });
    assert.notEqual(secondSaved.id, saved.id);
    assert.equal(secondSaved.previous_audit_id, saved.id);
    assert.equal(secondSaved.status, "approved");

    // 4) History list returns both, newest first, without the heavy fields.
    const history = await getInstagramProfileAudits(companyId, { limit: 10 });
    assert.ok(Array.isArray(history));
    const list = history as Array<{ id: string }>;
    assert.equal(list.length, 2);
    assert.equal(list[0].id, secondSaved.id, "newest audit must come first");
    assert.ok(!("priorities" in list[0]), "list view must not include heavy JSONB fields");

    // 5) Single-report fetch returns the full detail, and is verified to
    // belong to this exact company (company isolation).
    const detail = await getInstagramProfileAudits(companyId, { id: saved.id });
    assert.equal((detail as { id: string }).id, saved.id);
    assert.deepEqual((detail as { priorities: unknown }).priorities, [{ level: "high", title: "Bio güncelle" }]);

    // 6) A mismatched company_id must never return another company's report.
    const otherCompanyId = "00000000-0000-4000-8000-000000000000";
    await assert.rejects(() => getInstagramProfileAudits(otherCompanyId, { id: saved.id }));
  } finally {
    await supabaseRest(`${INSTAGRAM_PROFILE_AUDITS_TABLE}?company_id=eq.${companyId}`, { method: "DELETE" }).catch(() => {});
    await supabaseRest(`companies?id=eq.${companyId}`, { method: "DELETE" }).catch(() => {});
  }
});

test("saveInstagramProfileAudit REGRESSION — rejects a company_id that does not exist", { skip: hasSupabase ? false : skipReason }, async () => {
  const { saveInstagramProfileAudit, InstagramProfileAuditNotFoundError } = await import("../../../src/lib/instagram-profile-audits.ts");
  await assert.rejects(
    () => saveInstagramProfileAudit({ companyId: "00000000-0000-4000-8000-000000000000", instagramUsername: "test", overallSummary: "Yeterince uzun bir özet metni burada." }),
    InstagramProfileAuditNotFoundError
  );
});
