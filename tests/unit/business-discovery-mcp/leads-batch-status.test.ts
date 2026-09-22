// Değerlendirme Havuzu / Potansiyel Müşteriler "Toplu Onayla"/"Toplu
// Reddet" batch endpoint. requireModuleAccess() calls next/headers
// cookies(), which only works inside a real Next.js request scope — not
// callable directly from a plain node:test process (calling the route
// handler outside Next's runtime throws before auth even runs) — so
// auth-gated behavior is covered by manual/production verification
// instead, same limitation as this codebase's other route handlers.
import test from "node:test";
import assert from "node:assert/strict";

test("REGRESSION — /api/admin/leads/batch-status exports a POST handler", async () => {
  const route = await import("../../../src/app/api/admin/leads/batch-status/route.ts");
  assert.equal(typeof route.POST, "function");
});
