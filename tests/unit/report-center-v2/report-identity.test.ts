// Business identity of a report (V3.2): branch / related-brand reports are
// named after that business, never the parent. In-memory PostgREST only.
import test from "node:test";
import assert from "node:assert/strict";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://identity-test.supabase.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test";

const original = globalThis.fetch;
const calls: string[] = [];
test.before(() => {
  globalThis.fetch = (async (input: unknown) => {
    const path = decodeURIComponent(new URL(String(input)).pathname + new URL(String(input)).search);
    calls.push(path);
    const body = path.includes("business_units") ? (path.includes("unit-robotik") ? [{ name: "Robotik45" }] : [])
      : path.includes("leads") ? [{ company: "Zirve AKADEMİ", name: "Yetkili" }]
      : path.includes("companies") ? [{ name: "MY CAKE 45" }] : [];
    const text = JSON.stringify(body);
    return { ok: true, status: 200, text: async () => text } as Response;
  }) as typeof fetch;
});
test.after(() => { globalThis.fetch = original; });

test("a Robotik45 business-unit report under the Zirve AKADEMİ lead is titled Robotik45", async () => {
  const { resolveReportDisplayName } = await import("../../../src/lib/report-identity.ts");
  assert.equal(await resolveReportDisplayName({ businessUnitId: "unit-robotik", leadId: "lead-zirve" }, "Rapor"), "Robotik45");
});

test("a report without a business unit keeps its verified owner (no guessing from text)", async () => {
  const { resolveReportDisplayName } = await import("../../../src/lib/report-identity.ts");
  assert.equal(await resolveReportDisplayName({ leadId: "lead-zirve" }, "Robotik45 analizi"), "Zirve AKADEMİ");
  assert.equal(await resolveReportDisplayName({ companyId: "c1", leadId: "lead-zirve" }, "x"), "MY CAKE 45");
});

test("an unknown unit id falls back to the owner, never to the free-text title", async () => {
  const { resolveReportDisplayName } = await import("../../../src/lib/report-identity.ts");
  assert.equal(await resolveReportDisplayName({ businessUnitId: "unit-missing", leadId: "lead-zirve" }, "Robotik45"), "Zirve AKADEMİ");
});
