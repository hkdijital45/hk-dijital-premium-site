import type { APIRequestContext, Page } from "@playwright/test";

// Real-authentication strategy for admin-only Playwright coverage.
//
// Priority order (highest first), per the Sprint D requirement to never
// forge or bypass authentication in tests:
//   1. Real login via the actual POST /api/auth/login route, using
//      QA_ADMIN_EMAIL / QA_ADMIN_PASSWORD supplied through environment
//      variables (never hard-coded, never committed).
//   2. If those variables are not supplied, authenticated tests must skip
//      with an explicit reason — they must not fail ambiguously and must
//      never fall back to forging a cookie with a known secret.
export function hasQaAdminCredentials() {
  return Boolean(process.env.QA_ADMIN_EMAIL && process.env.QA_ADMIN_PASSWORD);
}

export const qaSkipReason =
  "QA_ADMIN_EMAIL / QA_ADMIN_PASSWORD not supplied in this environment — authenticated coverage requires a real, seeded test admin account and is skipped rather than forged.";

export async function loginAsQaAdmin(request: APIRequestContext) {
  const response = await request.post("/api/auth/login", {
    data: {
      identity: process.env.QA_ADMIN_EMAIL,
      password: process.env.QA_ADMIN_PASSWORD,
      userType: "admin"
    }
  });
  if (!response.ok()) {
    throw new Error(`QA admin login failed with status ${response.status()} — check QA_ADMIN_EMAIL/QA_ADMIN_PASSWORD against a real, active admin account.`);
  }
  return response;
}

export async function gotoAsQaAdmin(page: Page, path: string) {
  await loginAsQaAdmin(page.request);
  await page.goto(path);
}
