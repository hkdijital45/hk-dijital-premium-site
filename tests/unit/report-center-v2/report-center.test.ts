// Rapor Merkezi V2 — server-side access rules over the existing report
// tables. Every database call goes to an in-memory PostgREST stand-in (no
// real Supabase project is contacted, nothing is written anywhere).
//
// Covered: owner-scoped list queries, business-unit scoping, unsupported
// owner types, IDOR (foreign / wrong-type / wrong-business ids are rejected
// with the same generic 404), search sanitizing, viewer payload stripping,
// role-based type visibility, parameter parsing and error messages that
// never leak internals.
//
// Run via:
//   node --conditions=react-server --import tsx --test tests/unit/report-center-v2/*.test.ts
import test from "node:test";
import assert from "node:assert/strict";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://report-center-test.supabase.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";

const LEAD_A = "11111111-1111-4111-8111-111111111111";
const LEAD_B = "22222222-2222-4222-8222-222222222222";
const COMPANY_A = "33333333-3333-4333-8333-333333333333";
const COMPANY_B = "44444444-4444-4444-8444-444444444444";
const UNIT_A = "55555555-5555-4555-8555-555555555555";
const UNIT_X = "66666666-6666-4666-8666-666666666666";
const R_CLIENT_A = "aaaaaaa1-0000-4000-8000-000000000001";
const R_CLIENT_B = "aaaaaaa1-0000-4000-8000-000000000002";
const R_INTERNAL_A = "aaaaaaa1-0000-4000-8000-000000000003";
const R_UNIT_A = "aaaaaaa1-0000-4000-8000-000000000004";

type Row = Record<string, unknown>;

const preAudits: Row[] = [
  { id: R_CLIENT_A, lead_id: LEAD_A, company_id: null, business_unit_id: null, report_type: "CLIENT_REPORT", title: "Zirve AKADEMİ Ön İnceleme", status: "approved", report_date: "2026-10-01", created_at: "2026-10-01T09:00:00Z", sections: { executiveSummary: "Özet" } },
  { id: R_CLIENT_B, lead_id: LEAD_B, company_id: null, business_unit_id: null, report_type: "CLIENT_REPORT", title: "Başka Lead Raporu", status: "approved", report_date: "2026-10-02", created_at: "2026-10-02T09:00:00Z", sections: {} },
  { id: R_INTERNAL_A, lead_id: LEAD_A, company_id: null, business_unit_id: null, report_type: "INTERNAL_REPORT", title: "Dahili", status: "approved", report_date: "2026-10-03", created_at: "2026-10-03T09:00:00Z", sections: {} },
  { id: R_UNIT_A, lead_id: LEAD_A, company_id: null, business_unit_id: UNIT_A, report_type: "CLIENT_REPORT", title: "Şube Raporu", status: "approved", report_date: "2026-10-04", created_at: "2026-10-04T09:00:00Z", sections: {} }
];

const requests: string[] = [];

/** Minimal PostgREST stand-in: answers id lookups from the fixtures (so a
 * foreign id IS found by the database — the server must reject it itself)
 * and returns the fixtures for list queries. */
function route(path: string): unknown {
  const [table, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  const idEq = params.get("id")?.replace(/^eq\./, "");
  switch (table) {
    case "pre_audit_reports":
      if (idEq) return preAudits.filter((r) => r.id === idEq);
      return preAudits.slice(0, 2);
    case "leads":
      if (params.get("id")?.startsWith("in.")) {
        const ids = params.get("id")!.slice(4, -1).split(",");
        return ids.filter((id) => id === LEAD_A || id === LEAD_B).map((id) => ({ id, company: id === LEAD_A ? "Zirve AKADEMİ" : "Lead B", name: null, company_id: null }));
      }
      if (idEq) return [{ company: "Zirve AKADEMİ", name: "Yetkili" }];
      return [{ id: LEAD_A, company: "Zirve AKADEMİ", name: "Yetkili", status: "Yeni", company_id: null }];
    case "companies":
      if (idEq) return [{ name: "MY CAKE 45" }];
      return [
        { id: COMPANY_A, name: "MY CAKE 45", status: "active", deleted_at: null },
        { id: COMPANY_B, name: "Robotik45", status: "archived", archived_at: "2026-01-01T00:00:00Z", deleted_at: null }
      ];
    case "business_units":
      if (params.get("id")?.startsWith("in.")) {
        const ids = params.get("id")!.slice(4, -1).split(",");
        return ids.filter((id) => id === UNIT_A || id === UNIT_X).map((id) => ({ id, name: id === UNIT_A ? "Zirve AKADEMİ Kampüs" : "Yabancı Şube", unit_kind: "branch" }));
      }
      return [];
    case "business_relationships":
      return [{ id: "rel-1", relationship_type: "branch", parent_lead_id: LEAD_A, parent_company_id: null, parent_unit_id: null, child_lead_id: null, child_company_id: null, child_unit_id: UNIT_A, created_at: "2026-01-01T00:00:00Z" }];
    case "social_content_plan_items":
      return [{ scheduled_date: "2026-10-20" }];
    default:
      return [];
  }
}

const originalFetch = globalThis.fetch;
test.before(() => {
  globalThis.fetch = (async (input: unknown) => {
    const url = new URL(String(input));
    const path = decodeURIComponent(url.pathname.replace(/^\/rest\/v1\//, "")) + (url.search ? `?${url.search.slice(1)}` : "");
    requests.push(path);
    const body = JSON.stringify(route(path));
    return { ok: true, status: 200, text: async () => body, json: async () => JSON.parse(body) } as Response;
  }) as typeof globalThis.fetch;
});
test.after(() => {
  globalThis.fetch = originalFetch;
});
test.beforeEach(() => {
  requests.length = 0;
});

const server = () => import("../../../src/lib/report-center-v2/server.ts");

function lastQuery(table: string) {
  const found = [...requests].reverse().find((r) => r.startsWith(`${table}?`));
  assert.ok(found, `${table} must be queried`);
  return decodeURIComponent(found!);
}

test("list — the owner filter is part of the database query (lead + report type + Ana İşletme + archived hidden)", async () => {
  const { listReports } = await server();
  const result = await listReports("pre_audit_client", { owner: { type: "lead", id: LEAD_A }, business: "main", limit: 1, offset: 0 });
  const query = lastQuery("pre_audit_reports");
  assert.match(query, new RegExp(`lead_id=eq\\.${LEAD_A}`));
  assert.match(query, /report_type=eq\.CLIENT_REPORT/);
  assert.match(query, /business_unit_id=is\.null/);
  assert.match(query, /or=\(status\.is\.null,status\.neq\.archived\)/);
  assert.match(query, /order=report_date\.desc/);
  assert.match(query, /limit=2&offset=0/, "fetches limit+1 to know whether another page exists");
  assert.equal(result.items.length, 1);
  assert.equal(result.hasMore, true);
  assert.equal(result.items[0].ref, `pre_audit_client:${R_CLIENT_A}`, "compound sourceType:sourceId identity");
});

test("list — a customer owner uses company_id, never lead_id", async () => {
  const { listReports } = await server();
  await listReports("pre_audit_client", { owner: { type: "company", id: COMPANY_A }, business: "all", limit: 20, offset: 0 });
  const query = lastQuery("pre_audit_reports");
  assert.match(query, new RegExp(`company_id=eq\\.${COMPANY_A}`));
  assert.doesNotMatch(query, /lead_id=/);
  assert.doesNotMatch(query, /business_unit_id=/, "'Tüm işletmeler' adds no unit filter but stays owner-scoped");
});

test("list — a linked branch is filtered by its id; an unlinked business is refused with 403", async () => {
  const { listReports } = await server();
  await listReports("pre_audit_client", { owner: { type: "lead", id: LEAD_A }, business: UNIT_A, limit: 20, offset: 0 });
  assert.match(lastQuery("pre_audit_reports"), new RegExp(`business_unit_id=eq\\.${UNIT_A}`));

  requests.length = 0;
  await assert.rejects(
    listReports("pre_audit_client", { owner: { type: "lead", id: LEAD_A }, business: UNIT_X, limit: 20, offset: 0 }),
    (error: Error & { status?: number }) => error.status === 403 && /bağlı değil/.test(error.message)
  );
  assert.ok(!requests.some((r) => r.startsWith("pre_audit_reports?")), "no report query runs for a foreign business");
});

test("list — unsupported owner type and malformed ids are rejected before any report query", async () => {
  const { listReports } = await server();
  await assert.rejects(
    listReports("ad_evaluation", { owner: { type: "lead", id: LEAD_A }, business: "all", limit: 20, offset: 0 }),
    /yalnızca müşteri kayıtları için tutulur/
  );
  await assert.rejects(
    listReports("pre_audit_client", { owner: { type: "lead", id: "1 or 1=1" }, business: "all", limit: 20, offset: 0 }),
    /Geçerli bir lead veya müşteri seçin/
  );
  await assert.rejects(
    listReports("pre_audit_client", { owner: { type: "lead", id: LEAD_A }, business: "main,deleted_at.is.null", limit: 20, offset: 0 }),
    /Geçerli bir işletme/
  );
  assert.ok(!requests.some((r) => r.startsWith("pre_audit_reports?")));
});

test("list — search text is sanitized (no PostgREST operator injection) and dates must be ISO", async () => {
  const { listReports } = await server();
  await listReports("pre_audit_client", { owner: { type: "lead", id: LEAD_A }, business: "all", q: "zirve*),or=(id.neq.x", from: "2026-01-01", to: "not-a-date", limit: 20, offset: 0 });
  const query = lastQuery("pre_audit_reports");
  assert.match(query, /title=ilike\.\*zirve or= id\.neq\.x\*/);
  assert.doesNotMatch(query, /\),or=\(id/);
  assert.match(query, /report_date=gte\.2026-01-01/);
  assert.doesNotMatch(query, /not-a-date/);
});

test("load — IDOR: another lead's report id is refused even though the database returns the row", async () => {
  const { loadReport } = await server();
  await assert.rejects(
    loadReport("pre_audit_client", R_CLIENT_B, { type: "lead", id: LEAD_A }, "all"),
    (error: Error & { status?: number }) => error.status === 404 && error.message === "Rapor bulunamadı veya seçilen kayda ait değil."
  );
});

test("load — an internal report cannot be opened through the customer-facing type (and vice versa)", async () => {
  const { loadReport } = await server();
  await assert.rejects(loadReport("pre_audit_client", R_INTERNAL_A, { type: "lead", id: LEAD_A }, "all"), /Rapor bulunamadı/);
  await assert.rejects(loadReport("pre_audit_internal", R_CLIENT_A, { type: "lead", id: LEAD_A }, "all"), /Rapor bulunamadı/);
});

test("load — business scope is enforced on the loaded row (Ana İşletme vs şube)", async () => {
  const { loadReport } = await server();
  await assert.rejects(loadReport("pre_audit_client", R_UNIT_A, { type: "lead", id: LEAD_A }, "main"), /Rapor bulunamadı/);
  await assert.rejects(loadReport("pre_audit_client", R_CLIENT_A, { type: "lead", id: LEAD_A }, UNIT_A), /Rapor bulunamadı/);
  const loaded = await loadReport("pre_audit_client", R_UNIT_A, { type: "lead", id: LEAD_A }, UNIT_A);
  assert.equal(loaded.sourceId, R_UNIT_A);
  assert.deepEqual(loaded.logoScope, { companyId: null, leadId: LEAD_A, businessUnitId: UNIT_A });
});

test("load — the owner's own report loads with its own builder and file name", async () => {
  const { loadReport } = await server();
  const loaded = await loadReport("pre_audit_client", R_CLIENT_A, { type: "lead", id: LEAD_A }, "all");
  assert.equal(loaded.title, "Zirve AKADEMİ Ön İnceleme");
  assert.deepEqual(loaded.variants, ["client"]);
  assert.match(loaded.fileBase, /\S/);
});

test("load — non-uuid ids and the virtual content plan of another customer are refused", async () => {
  const { loadReport } = await server();
  await assert.rejects(loadReport("pre_audit_client", "../../etc", { type: "lead", id: LEAD_A }, "all"), /Rapor bulunamadı/);
  await assert.rejects(loadReport("content_plan", COMPANY_B, { type: "company", id: COMPANY_A }, "all"), /Rapor bulunamadı/);
});

test("viewer payload never carries the client logo bytes", async () => {
  const { viewerPayload } = await server();
  const view = viewerPayload({ title: "T", customerName: "C", period: "-", executiveSummary: "", sections: [], clientLogo: { png: new Uint8Array([1, 2]), width: 1, height: 1 } });
  assert.equal("clientLogo" in view, false);
});

test("owners — leads and customers are separate lists; archived customers are labelled", async () => {
  const { listOwners } = await server();
  const leads = await listOwners("lead", "zirve");
  assert.match(lastQuery("leads"), /deleted_at=is\.null/);
  assert.match(lastQuery("leads"), /or=\(company\.ilike\.\*zirve\*,name\.ilike\.\*zirve\*\)/);
  assert.deepEqual(leads.map((o) => o.id), [LEAD_A]);
  requests.length = 0;
  const companies = await listOwners("company", null);
  assert.ok(requests.every((r) => r.startsWith("companies?")), "the customer list never reads leads");
  assert.deepEqual(companies.map((c) => c.id), [COMPANY_A, COMPANY_B]);
  assert.equal(companies.find((c) => c.id === COMPANY_B)?.detail, "Arşivli müşteri");
});

test("businesses — only units linked through real relationship rows are offered", async () => {
  const { listOwnerBusinesses } = await server();
  const units = await listOwnerBusinesses({ type: "lead", id: LEAD_A });
  assert.deepEqual(units, [{ id: UNIT_A, name: "Zirve AKADEMİ Kampüs", relationship: "Şube" }]);
});

test("access — report types follow the source module permissions of each role", async () => {
  const { accessibleReportTypes } = await import("../../../src/lib/report-center-v2/access.ts");
  const keys = (role: string, allowedModules?: string[]) => accessibleReportTypes({ role, allowedModules } as never).map((t) => t.key);
  assert.ok(keys("admin").includes("pre_audit_internal"));
  assert.equal(keys("admin").length, 15);
  const editor = keys("editor");
  assert.ok(!editor.includes("pre_audit_internal"), "editors have no Ön İnceleme access, so no internal pre-audits");
  assert.ok(!editor.includes("ad_evaluation"));
  assert.ok(editor.includes("customer_report"));
  assert.deepEqual(keys("musteri"), [], "customer accounts never reach Rapor Merkezi");
  assert.deepEqual(keys("finance"), []);
  assert.deepEqual(accessibleReportTypes(null), []);
});

test("errors — unknown errors become a generic Turkish message (no table names / ids leak)", async () => {
  const { reportCenterErrorResponse } = await import("../../../src/lib/report-center-v2/access.ts");
  const original = console.error;
  console.error = () => {};
  try {
    const response = reportCenterErrorResponse(new Error("Supabase REST hatası (500) pre_audit_reports?id=eq.secret: boom"), "Rapor görüntülenemedi.");
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: "Rapor görüntülenemedi." });
  } finally {
    console.error = original;
  }
  const { ReportCenterError } = await server();
  const known = reportCenterErrorResponse(new ReportCenterError("Rapor bulunamadı veya seçilen kayda ait değil.", 404));
  assert.equal(known.status, 404);
});
