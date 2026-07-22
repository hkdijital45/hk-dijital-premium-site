import { test, expect } from "@playwright/test";
import { createHmac } from "crypto";
import { hasQaAdminCredentials, loginAsQaAdmin, qaSkipReason } from "./fixtures/qa-auth";

test("login page (/giris -> /digital-center) loads with real username/password controls", async ({ page }) => {
  const response = await page.goto("/giris", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBeLessThan(400);
  await expect(page).toHaveURL(/digital-center/);
  await expect(page.locator('input[type="text"]').first()).toBeVisible();
  await expect(page.locator('input[type="password"]').first()).toBeVisible();
});

test("unauthenticated request to a protected admin route is rejected", async ({ page }) => {
  const response = await page.goto("/hk-admin", { waitUntil: "domcontentloaded" });
  // proxy.ts redirects unauthenticated /hk-admin traffic to /giris.
  expect(response?.status()).toBeLessThan(400);
  await expect(page).toHaveURL(/giris|digital-center/);
});

test("invalid credentials do not grant access", async ({ request }) => {
  const response = await request.post("/api/auth/login", {
    data: { identity: "definitely-not-a-real-user@hkdijital.invalid", password: "wrong-password-123", userType: "admin" }
  });
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body.ok).toBeFalsy();
});

test("a session cookie forged with the known local fallback secret is rejected", async ({ page, baseURL }) => {
  // This is the exact concrete regression test for the Sprint C hardening:
  // before the fix, ADMIN_SESSION_SECRET/SUPABASE_SERVICE_ROLE_KEY being
  // unset meant this well-known string signed a fully trusted admin
  // session. `npm run start` always runs the app in production mode, so if
  // this test fails, the production fallback has regressed.
  const fallbackSecret = "local-development-session-secret";
  const session = { email: "forged@hkdijital.invalid", role: "admin", fullName: "Forged Session" };
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const signature = createHmac("sha256", fallbackSecret).update(payload).digest("base64url");
  const forgedCookie = `${payload}.${signature}`;

  await page.context().addCookies([
    { name: "hk_auth_session", value: forgedCookie, url: baseURL || "http://127.0.0.1:4173" }
  ]);
  const response = await page.goto("/hk-admin", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBeLessThan(400);
  await expect(page, "a forged session must never reach the admin shell").not.toHaveURL(/\/hk-admin$/);
});

test("authenticated admin login succeeds when real QA credentials are supplied", async ({ request }) => {
  test.skip(!hasQaAdminCredentials(), qaSkipReason);
  const response = await loginAsQaAdmin(request);
  const body = await response.json();
  expect(body.ok).toBeTruthy();
  expect(body.redirectTo).toBe("/hk-admin");
});
