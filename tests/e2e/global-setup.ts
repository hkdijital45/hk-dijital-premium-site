import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { request as playwrightRequest, type FullConfig } from "@playwright/test";
import { hasQaAdminCredentials, QA_ADMIN_STORAGE_STATE_PATH } from "./fixtures/qa-auth";

// Runs once before the whole suite (wired up in playwright.config.ts's
// `globalSetup`) and performs the ONE real POST /api/auth/login for the
// entire run, plus the one real Secret Access Control Center gate
// verification every protected route now also requires (src/proxy.ts),
// persisting both resulting cookies to QA_ADMIN_STORAGE_STATE_PATH. The
// authenticated describe blocks across the spec files point
// `test.use({ storageState: qaAdminStorageState })` at this same saved file
// instead of each performing their own real login — see
// tests/e2e/fixtures/qa-auth.ts for the full rationale (GoTrue's per-account
// sign-in rate limit).
//
// Consistent with the rest of the suite's "skip rather than forge"
// principle: if QA_ADMIN_EMAIL/QA_ADMIN_PASSWORD aren't supplied in this
// environment, this returns immediately without error, and every
// authenticated test skips individually via hasQaAdminCredentials()/
// qaSkipReason exactly as it already does today.
export default async function globalSetup(config: FullConfig) {
  if (!hasQaAdminCredentials()) {
    return;
  }

  const baseURL = config.projects[0]?.use?.baseURL;
  const context = await playwrightRequest.newContext({ baseURL });
  try {
    const response = await context.post("/api/auth/login", {
      data: {
        identity: process.env.QA_ADMIN_EMAIL,
        password: process.env.QA_ADMIN_PASSWORD,
        userType: "admin"
      }
    });
    if (!response.ok()) {
      throw new Error(
        `Global setup's real QA admin login failed with status ${response.status()} — check QA_ADMIN_EMAIL/QA_ADMIN_PASSWORD against a real, active admin account. The whole run depends on this one real login; every authenticated test reuses its saved session.`
      );
    }

    // /hk-admin (and /digital-center, /musteri-paneli) sit behind the
    // Secret Access Control Center gate ahead of the real login system (see
    // src/proxy.ts) — a valid hk_auth_session alone no longer reaches them.
    // Reuses (rotating its secret) a dedicated, real "Playwright QA Access"
    // key rather than the deployment's bootstrap secret, since the
    // bootstrap secret intentionally stops working the moment any real key
    // exists in production — this must keep working regardless of what
    // access keys the real admin has since created.
    const keysListResponse = await context.get("/api/admin/hidden-access/keys");
    const keysListData = keysListResponse.ok() ? await keysListResponse.json() : { keys: [] };
    const existingQaKey = (keysListData.keys || []).find((key: { name: string }) => key.name === "Playwright QA Access");

    let accessSecret: string | null = null;
    if (existingQaKey) {
      const rotateResponse = await context.patch(`/api/admin/hidden-access/keys/${existingQaKey.id}`, {
        data: { action: "change_secret", generateSecret: true }
      });
      if (rotateResponse.ok()) accessSecret = (await rotateResponse.json()).secret;
    } else {
      const createResponse = await context.post("/api/admin/hidden-access/keys", {
        data: { name: "Playwright QA Access", generateSecret: true }
      });
      if (createResponse.ok()) accessSecret = (await createResponse.json()).secret;
    }
    if (!accessSecret) {
      throw new Error("Global setup could not create/rotate the Playwright QA Access hidden-access key — every /hk-admin, /digital-center and /musteri-paneli test depends on this.");
    }
    const gateResponse = await context.post("/api/secret-access/verify", {
      data: { secret: accessSecret, triggerMethod: "bootstrap" }
    });
    if (!gateResponse.ok()) {
      throw new Error(`Global setup's Secret Access verification failed with status ${gateResponse.status()} even with a freshly created/rotated key.`);
    }

    mkdirSync(dirname(QA_ADMIN_STORAGE_STATE_PATH), { recursive: true });
    await context.storageState({ path: QA_ADMIN_STORAGE_STATE_PATH });

    // The app correctly sets `secure: true` on its session cookie under
    // `next start` (NODE_ENV=production) — required for real HTTPS
    // production, and not something to weaken in application code. But this
    // suite runs the production build over plain http://127.0.0.1 locally,
    // and Playwright (correctly emulating real cookie-security semantics)
    // silently drops a Secure-flagged cookie when replaying a saved
    // storageState over an insecure origin — every request built from the
    // reloaded state would look logged-out even though the login itself
    // just succeeded. Since we deliberately test over http:// here, strip
    // the Secure flag on the cookie as saved to disk only — the real
    // /api/auth/login response and the app's own cookie-setting code are
    // untouched, this only affects how the test runner replays its own
    // locally-captured copy.
    if (baseURL?.startsWith("http://")) {
      const state = JSON.parse(readFileSync(QA_ADMIN_STORAGE_STATE_PATH, "utf8"));
      for (const cookie of state.cookies || []) cookie.secure = false;
      writeFileSync(QA_ADMIN_STORAGE_STATE_PATH, JSON.stringify(state, null, 2));
    }
  } finally {
    await context.dispose();
  }
}
