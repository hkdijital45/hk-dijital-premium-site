import { join } from "node:path";
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

// Written once by tests/e2e/global-setup.ts (a single real
// POST /api/auth/login) and reused by every describe block below via
// `test.use({ storageState: qaAdminStorageState })`. This is what lets a
// full suite run perform ONE real Supabase Auth (GoTrue) sign-in instead of
// the ~37 call-site real logins the suite used to make — GoTrue enforces
// its own per-account sign-in rate limit, and the old pattern (a real login
// on every single loginAsQaAdmin() call) was exhausting it mid-run, which
// surfaced as spurious 401s that looked like an application bug but weren't.
// Built from process.cwd() (Playwright is always invoked from the repo
// root) rather than __dirname/import.meta.url — this file is loaded under
// whichever module system Playwright's own TS transform picks for this
// project (observed to be ESM here, where __dirname isn't defined), so
// cwd-relative is the one path construction that works either way.
export const QA_ADMIN_STORAGE_STATE_PATH = join(process.cwd(), "tests", "e2e", ".auth", "qa-admin.json");

// undefined (never a path to a file that may not exist) when QA credentials
// aren't configured in this environment — global-setup.ts skips creating
// the file in that case, and `test.use({ storageState: undefined })` is a
// safe no-op (falls back to a fresh, unauthenticated context, exactly like
// today), rather than crashing every test on a missing file.
export const qaAdminStorageState = hasQaAdminCredentials() ? QA_ADMIN_STORAGE_STATE_PATH : undefined;

export async function loginAsQaAdmin(request: APIRequestContext) {
  // Cheap probe first: if this context's current cookies already represent
  // a valid admin session — because a describe block bound
  // `qaAdminStorageState` (the session saved once by global-setup.ts), or
  // because an earlier real login already happened within this same test —
  // skip the real login entirely.
  const probe = await request.get("/api/auth/me");
  if (probe.ok()) {
    return probe;
  }

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
