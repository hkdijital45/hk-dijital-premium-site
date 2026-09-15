import { test, expect } from "@playwright/test";
import { hasQaAdminCredentials, loginAsQaAdmin, qaAdminStorageState, qaSkipReason } from "./fixtures/qa-auth";

// Regression coverage for the "HK Admin gets kicked to the login screen when
// starting a provider OAuth connection from Analiz & Raporlama Merkezi" bug.
//
// Root cause (see src/lib/customer-integration-oauth.ts and src/proxy.ts):
//   1. The "Bağlantıyı Yönet" link pointed at /musteri-paneli with no
//      ?company= param, which tripped the middleware's staff-preview gate
//      (an admin/staff role visiting /musteri-paneli without ?company= is
//      not a customer session, so it got redirected to the login screen —
//      the underlying hk_auth_session cookie was never touched, but the
//      admin still landed on a login form).
//   2. Even with a valid staff-preview visit, the actual OAuth entry/exit
//      points (oauthConnect/oauthCallback) hard-required a customer-role
//      session (requireCustomerSession()), so a staff session got an
//      immediate SESSION_MISSING/COMPANY_MISMATCH error.
//
// This suite exercises the real, deployed /api/integrations/{provider}/connect
// and /api/integrations/callback/{provider} endpoints directly (the same
// endpoints CustomerAccountConnectCenter's "Meta ile Giriş Yap" / "Google ile
// Bağlan" buttons call), with maxRedirects: 0 so the outgoing redirect can be
// inspected without ever actually contacting facebook.com or google.com — no
// real OAuth consent screen or token exchange is hit in these tests. The two
// paths (providerError=access_denied and an invalid/tampered state) both
// return before any network call to the provider, matching the module's own
// early-return order (see oauthCallback).

const CUSTOMER_A_EMAIL = process.env.QA_CUSTOMER_A_EMAIL;
const CUSTOMER_A_PASSWORD = process.env.QA_CUSTOMER_A_PASSWORD;
const hasQaCustomerCredentials = Boolean(CUSTOMER_A_EMAIL && CUSTOMER_A_PASSWORD);
const qaCustomerSkipReason =
  "QA_CUSTOMER_A_EMAIL / QA_CUSTOMER_A_PASSWORD not supplied — customer-panel OAuth regression coverage requires a real, seeded test customer account and is skipped rather than forged.";

async function getRealCompanyId(request: import("@playwright/test").APIRequestContext): Promise<string | undefined> {
  const response = await request.get("/api/admin/companies");
  if (!response.ok()) return undefined;
  const body = await response.json();
  return body.companies?.[0]?.id;
}

// Reads the OAuth state's own public claims (provider/origin/companyId/
// returnTo/nonce/exp) without verifying its HMAC signature — fine for test
// assertions on our own freshly-generated state, never used to authorize
// anything. The real signature check happens server-side in oauthCallback.
function decodeStatePayload(rawState: string): Record<string, unknown> | null {
  try {
    const [payload] = rawState.split(".");
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

test.describe("HK Admin OAuth origin/session regression", () => {
  test.use({ storageState: qaAdminStorageState });
  test.beforeEach(() => {
    test.skip(!hasQaAdminCredentials(), qaSkipReason);
  });

  for (const provider of ["meta", "google"] as const) {
    const authHost = provider === "meta" ? "https://www.facebook.com/" : "https://accounts.google.com/";

    test(`1. authenticated admin starts ${provider} OAuth and reaches the real provider redirect (session preserved)`, async ({ request }) => {
      await loginAsQaAdmin(request);
      const companyId = await getRealCompanyId(request);
      test.skip(!companyId, "No company available in this environment to test against.");

      const response = await request.get(`/api/integrations/${provider}/connect?company=${companyId}`, { maxRedirects: 0 });
      expect([302, 303, 307]).toContain(response.status());
      const location = response.headers()["location"] || "";
      // This exact call previously short-circuited to a session_missing/
      // company_mismatch error for a staff session — that's the one thing
      // asserted unconditionally here. Reaching the *real* provider
      // redirect additionally requires provider OAuth credentials to be
      // configured in this environment (not the case in every local/CI
      // environment — see docs/analytics-center/setup.md), so that part is
      // asserted only when possible.
      expect(location).not.toContain("integration_error=session_missing");
      expect(location).not.toContain("integration_error=company_mismatch");
      if (location.startsWith(authHost)) {
        // Provider credentials configured: proves the request reached the
        // very end of oauthConnect (past every session/company guard).
        const setCookie = response.headers()["set-cookie"] || "";
        expect(setCookie).toContain(`hk_oauth_state_${provider}`);
        // TEST A/B (provider routing): the signed state itself must name the
        // SAME provider that was requested — this is what stops a Google
        // click from ever completing a Meta handshake (or vice versa) even
        // if the redirect host were somehow right by coincidence.
        const stateParam = new URL(location).searchParams.get("state") || "";
        const decoded = decodeStatePayload(stateParam);
        expect(decoded?.provider).toBe(provider);
        expect(decoded?.origin).toBe("hk_admin");
        expect(decoded?.customerId).toBe(companyId);
      } else {
        // Provider credentials not configured in this environment: still
        // proves the session/company checks passed, and that the
        // origin-aware return route (hk_admin) was used even for this
        // config error, not the customer-panel default.
        expect(location).toContain(`integration_error=${provider}_env_missing`);
        expect(location).toContain("/hk-admin/analiz-raporlama");
      }
    });
  }

  test("3. admin start without ?company= is rejected (no privilege escalation to an unscoped connect)", async ({ request }) => {
    await loginAsQaAdmin(request);
    const response = await request.get("/api/integrations/meta/connect", { maxRedirects: 0 });
    expect([302, 303, 307]).toContain(response.status());
    const location = response.headers()["location"] || "";
    expect(location).toContain("integration_error=session_missing");
    // Never a bounce to a login screen — the admin's own session is untouched.
    expect(location).not.toContain("/digital-center");
    expect(location).not.toContain("/giris");
  });

  test("4. admin start with a non-existent company id is rejected (company_mismatch, not silently accepted)", async ({ request }) => {
    await loginAsQaAdmin(request);
    const response = await request.get("/api/integrations/meta/connect?company=00000000-0000-0000-0000-000000000000", { maxRedirects: 0 });
    expect([302, 303, 307]).toContain(response.status());
    const location = response.headers()["location"] || "";
    expect(location).toContain("integration_error=company_mismatch");
  });

  test("9a. callback with providerError=access_denied for an hk_admin-origin state returns to the HK Admin route, admin stays authenticated, no token exchange attempted", async ({ request, context }) => {
    await loginAsQaAdmin(request);
    const companyId = await getRealCompanyId(request);
    test.skip(!companyId, "No company available in this environment to test against.");

    const cookiesBefore = await context.cookies();
    const authCookieBefore = cookiesBefore.find((c) => c.name.includes("auth_session"));
    expect(authCookieBefore).toBeTruthy();

    // Matches the returnTo CustomerAccountConnectCenter's isHkAdminOrigin
    // branch actually sends in production (see its "from=hk-admin" handling)
    // — without it, oauthConnect falls back to the bare
    // /hk-admin/analiz-raporlama default (still safe, just without the
    // company preselected), which isn't what this test is verifying.
    const returnTo = `/hk-admin/analiz-raporlama?company=${companyId}#hesaplar`;
    const connectResponse = await request.get(`/api/integrations/meta/connect?company=${companyId}&returnTo=${encodeURIComponent(returnTo)}`, { maxRedirects: 0 });
    const providerUrl = new URL(connectResponse.headers()["location"] || "");
    const realSignedState = providerUrl.searchParams.get("state") || "";
    // A real signed state is only produced once oauthConnect gets past the
    // provider-credentials check — not configured in every environment
    // (see the "1." test above). Skip rather than fail when that's the
    // case; this exact scenario runs for real wherever Meta credentials
    // are configured (production included).
    test.skip(!realSignedState, "META_* OAuth credentials not configured in this environment — oauthConnect never reached state generation.");

    // Simulate the user cancelling Meta's consent dialog: Meta redirects
    // back to our callback with error=access_denied and no code — this
    // branch returns before exchangeCode() ever runs, so no real network
    // call to Meta happens here.
    const callbackResponse = await request.get(
      `/api/integrations/callback/meta?state=${encodeURIComponent(realSignedState)}&error=access_denied&error_description=user_cancelled`,
      { maxRedirects: 0 }
    );
    expect([302, 303, 307]).toContain(callbackResponse.status());
    const location = callbackResponse.headers()["location"] || "";
    expect(location).toContain("/hk-admin/analiz-raporlama");
    expect(location).toContain(`company=${companyId}`);
    expect(location).not.toContain("/digital-center");
    expect(location).not.toContain("/giris");

    const cookiesAfter = await context.cookies();
    const authCookieAfter = cookiesAfter.find((c) => c.name.includes("auth_session"));
    expect(authCookieAfter?.value).toBe(authCookieBefore?.value);
  });

  for (const provider of ["meta", "google"] as const) {
    test(`9a2. ${provider}: a real code param pushes execution past state validation into the real token exchange (deepest boundary reachable without real provider consent)`, async ({ request, context }) => {
      await loginAsQaAdmin(request);
      const companyId = await getRealCompanyId(request);
      test.skip(!companyId, "No company available in this environment to test against.");

      const cookiesBefore = await context.cookies();
      const authCookieBefore = cookiesBefore.find((c) => c.name.includes("auth_session"));

      const returnTo = `/hk-admin/analiz-raporlama?company=${companyId}#hesaplar`;
      // Same context.request as the login above — its cookie jar carries the
      // hk_oauth_state_{provider} nonce cookie this response sets forward
      // into the callback request below, exactly like a real browser would.
      const connectResponse = await request.get(`/api/integrations/${provider}/connect?company=${companyId}&returnTo=${encodeURIComponent(returnTo)}`, { maxRedirects: 0 });
      const providerUrl = new URL(connectResponse.headers()["location"] || "");
      const realSignedState = providerUrl.searchParams.get("state") || "";
      test.skip(!realSignedState, `${provider.toUpperCase()}_* OAuth credentials not configured in this environment.`);

      // A syntactically present but fake code + the real nonce cookie is
      // enough to satisfy every check before exchangeCode() (code present,
      // state decodes+signature valid, provider matches, nonce matches the
      // cookie) — pushing execution into the real token-exchange network
      // call, which fails fast with invalid_grant (no real consent/account
      // involved, just a real OAuth client rejecting a bad code, the same
      // as any invalid request to that endpoint would get).
      const callbackResponse = await request.get(
        `/api/integrations/callback/${provider}?state=${encodeURIComponent(realSignedState)}&code=not-a-real-authorization-code`,
        { maxRedirects: 0 }
      );
      expect([302, 303, 307]).toContain(callbackResponse.status());
      const location = callbackResponse.headers()["location"] || "";
      // Must NOT be state_invalid/session_missing — those would mean it
      // never reached the token exchange at all.
      expect(location).not.toContain("integration_error=state_invalid");
      expect(location).not.toContain("integration_error=session_missing");
      expect(location).toContain("integration_error=token_exchange_failed");
      expect(location).toContain("/hk-admin/analiz-raporlama");
      expect(location).toContain(`company=${companyId}`);
      expect(location).not.toContain("/digital-center");
      expect(location).not.toContain("/giris");

      const cookiesAfter = await context.cookies();
      const authCookieAfter = cookiesAfter.find((c) => c.name.includes("auth_session"));
      expect(authCookieAfter?.value).toBe(authCookieBefore?.value);
    });
  }

  test("9b. real /hk-admin/analiz-raporlama?company= return route loads normally as the admin (no redirect loop)", async ({ page, request }) => {
    await loginAsQaAdmin(request);
    const companyId = await getRealCompanyId(request);
    test.skip(!companyId, "No company available in this environment to test against.");

    const response = await page.goto(`/hk-admin/analiz-raporlama?company=${companyId}#hesaplar`, { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    expect(page.url()).toContain("/hk-admin/analiz-raporlama");
    await expect(page.getByRole("tab", { name: "Hesaplar" })).toBeVisible();
  });

  test("10. an attacker-supplied external returnTo is sanitized before it ever reaches a redirect (no open redirect)", async ({ request }) => {
    await loginAsQaAdmin(request);
    const companyId = await getRealCompanyId(request);
    test.skip(!companyId, "No company available in this environment to test against.");

    const evil = "https://evil.example.com/phish";
    const connectResponse = await request.get(`/api/integrations/meta/connect?company=${companyId}&returnTo=${encodeURIComponent(evil)}`, { maxRedirects: 0 });
    const providerUrl = new URL(connectResponse.headers()["location"] || "");
    const realSignedState = providerUrl.searchParams.get("state") || "";

    const callbackResponse = await request.get(
      `/api/integrations/callback/meta?state=${encodeURIComponent(realSignedState)}&error=access_denied`,
      { maxRedirects: 0 }
    );
    const location = callbackResponse.headers()["location"] || "";
    expect(location).not.toContain("evil.example.com");
  });

  test("tampered state is rejected as state_invalid; for a live admin session it falls back to the HK Admin route, never a login page", async ({ request, context }) => {
    await loginAsQaAdmin(request);
    const cookiesBefore = await context.cookies();
    const authCookieBefore = cookiesBefore.find((c) => c.name.includes("auth_session"));

    const response = await request.get(
      "/api/integrations/callback/meta?state=not-a-real-state&code=fake-code",
      { maxRedirects: 0 }
    );
    expect([302, 303, 307]).toContain(response.status());
    const location = response.headers()["location"] || "";
    // oauthCallback checks missingProviderEnv() before state validity (same
    // order the original code used) — in an environment without Meta
    // credentials configured (not every local/CI environment — see the "1."
    // test above) that fires first as meta_env_missing instead of
    // state_invalid. Either way the state was never trusted/decoded.
    expect(["integration_error=state_invalid", "integration_error=meta_env_missing"].some((code) => location.includes(code))).toBeTruthy();
    // An undecodable state can't tell us the real origin, so this falls
    // back to whichever session is live right now — an admin session here,
    // so the fallback must be the HK Admin route, never a login page (the
    // old customer-panel-only fallback would have bounced a staff role
    // toward /giris via the /musteri-paneli staff-preview gate).
    expect(location).toContain("/hk-admin/analiz-raporlama");
    expect(location).not.toContain("/digital-center");
    expect(location).not.toContain("/giris");

    const cookiesAfter = await context.cookies();
    const authCookieAfter = cookiesAfter.find((c) => c.name.includes("auth_session"));
    expect(authCookieAfter?.value).toBe(authCookieBefore?.value);
  });

  test("selectOAuthAccount no longer hard-rejects a staff session on role alone (falls through to the oauth-session check instead)", async ({ request }) => {
    await loginAsQaAdmin(request);
    // No hk_oauth_session_google cookie present (no OAuth flow completed in
    // this test) — before the fix this failed at the very first line with
    // 403 "Müşteri oturumu gerekir" purely because the session is staff, not
    // customer, even though requireIntegrationSession() already authorizes
    // staff. After the fix it should get past that role check and fail
    // later, for the real reason (no oauth session to verify against): 401.
    const response = await request.post("/api/integrations/accounts/select", {
      data: { provider: "google", platform: "google", account_type: "google_profile", provider_account_id: "does-not-matter" }
    });
    expect(response.status()).toBe(401);
    const body = await response.json().catch(() => ({}));
    expect(body.error).not.toBe("Müşteri oturumu gerekir.");
  });

  test("TEST D — provider isolation: clicking Meta, then Google, then Meta again from the real UI never carries over stale provider state", async ({ page, context, request }) => {
    await loginAsQaAdmin(request);
    const companyId = await getRealCompanyId(request);
    test.skip(!companyId, "No company available in this environment to test against.");

    await page.goto(`/musteri-paneli?company=${companyId}&from=hk-admin&branch=all#hesap-bagla`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);

    const sequence: Array<{ cardTitle: string; buttonPattern: RegExp; connectFragment: string; expectedProvider: "meta" | "google" }> = [
      { cardTitle: "Meta / Facebook", buttonPattern: /Meta ile Giriş Yap/, connectFragment: "/api/integrations/meta/connect", expectedProvider: "meta" },
      { cardTitle: "Google", buttonPattern: /Google ile Giriş Yap|Google ile Bağlan/, connectFragment: "/api/integrations/google/connect", expectedProvider: "google" },
      { cardTitle: "Meta / Facebook", buttonPattern: /Meta ile Giriş Yap/, connectFragment: "/api/integrations/meta/connect", expectedProvider: "meta" }
    ];

    for (const [index, step] of sequence.entries()) {
      const card = page.locator("button").filter({ has: page.getByText(step.cardTitle, { exact: true }) }).first();
      await card.click();
      await page.waitForTimeout(400);
      const connectButton = page.getByRole("button", { name: step.buttonPattern }).first();
      await expect(connectButton).toBeVisible();

      const [popup] = await Promise.all([
        context.waitForEvent("page", { timeout: 8000 }).catch(() => null),
        page.waitForRequest((r) => r.url().includes(step.connectFragment), { timeout: 8000 }).catch(() => null),
        connectButton.click()
      ]);
      await page.waitForTimeout(1500);
      const finalUrl = (popup || page).url();
      const finalUrlHostname = new URL(finalUrl).hostname;
      // Meta serves a mobile-optimized login host (m.facebook.com) on
      // narrow/mobile viewports instead of www.facebook.com — both are the
      // real, expected Meta consent host, just device-dependent.
      const isRealAuthHost = step.expectedProvider === "meta"
        ? /(^|\.)facebook\.com$/.test(finalUrlHostname)
        : finalUrlHostname === "accounts.google.com";
      // Requires real Meta/Google OAuth credentials configured (not every
      // local/CI environment — see the "1." test above); only meaningful to
      // skip on the FIRST step, since a mid-sequence failure would itself be
      // the bug this test exists to catch.
      if (index === 0) test.skip(!isRealAuthHost, "META_*/GOOGLE_* OAuth credentials not configured in this environment.");
      expect(isRealAuthHost).toBeTruthy();
      // Google exposes `state` directly on its top-level login URL. Meta's
      // login.php interstitial instead nests the real authorize URL (state
      // included) inside a `cancel_url` param.
      const finalUrlParsed = new URL(finalUrl);
      let stateParam = finalUrlParsed.searchParams.get("state") || "";
      if (!stateParam) {
        const cancelUrl = finalUrlParsed.searchParams.get("cancel_url");
        if (cancelUrl) stateParam = new URL(cancelUrl).searchParams.get("state") || "";
      }
      const decoded = decodeStatePayload(stateParam);
      expect(decoded?.provider).toBe(step.expectedProvider);

      if (popup) await popup.close();
      else await page.goBack({ waitUntil: "domcontentloaded" }).catch(() => {});
      await page.waitForTimeout(500);
    }
  });

  test("hidden-access courtesy refresh: oauthConnect refreshes an already-valid Secret Access session before sending the browser off-site", async ({ context }) => {
    test.skip(!hasQaAdminCredentials(), qaSkipReason);
    // context.request shares the SAME cookie jar as context (unlike the
    // separate, worker-scoped `request` fixture) — required here since we
    // mutate cookies on this context directly.
    const request = context.request;
    await loginAsQaAdmin(request);
    const companyId = await getRealCompanyId(request);
    test.skip(!companyId, "No company available in this environment to test against.");

    const cookiesBefore = await context.cookies();
    const secretBefore = cookiesBefore.find((c) => c.name === "hk_secret_access_session");
    test.skip(!secretBefore, "No hk_secret_access_session on this QA session to test a refresh against.");

    const response = await request.get(`/api/integrations/meta/connect?company=${companyId}`, { maxRedirects: 0 });
    expect([302, 303, 307]).toContain(response.status());
    const location = response.headers()["location"] || "";
    // The refresh only runs once oauthConnect is actually about to send the
    // browser off-site — if META_* isn't configured in this environment
    // (not every local/CI environment — see the "1." test above), it never
    // gets that far, and there is nothing to refresh (correctly: nothing
    // off-site is happening either).
    test.skip(!location.startsWith("https://www.facebook.com/"), "META_* OAuth credentials not configured in this environment.");
    const setCookieHeader = response.headers()["set-cookie"] || "";
    // A fresh hk_secret_access_session must have been issued on this exact
    // response — the fix for "OAuth approval kicks the admin to the public
    // homepage" (src/proxy.ts's Secret Access Control Center gate expiring
    // during a long external consent flow, unrelated to hk_auth_session).
    expect(setCookieHeader).toContain("hk_secret_access_session");

    const cookiesAfter = await context.cookies();
    const secretAfter = cookiesAfter.find((c) => c.name === "hk_secret_access_session");
    expect(secretAfter?.value).not.toBe(secretBefore?.value);

    // And the refreshed session actually works: even simulating that the
    // OLD one would have expired by now, the gate lets the real return
    // route through using the freshly-issued cookie.
    const returnCheck = await request.get("/hk-admin/analiz-raporlama?company=" + companyId, { maxRedirects: 0 });
    expect(returnCheck.status()).toBe(200);
  });

  test("unauthenticated connect attempt is rejected safely, not a crash or an open redirect", async ({ browser }) => {
    // storageState: undefined overrides this describe block's
    // test.use({ storageState: qaAdminStorageState }) default — Playwright
    // Test applies the current test's configured `use` options (including
    // storageState) to a manually created browser.newContext() unless a
    // call explicitly overrides them, so omitting this would silently
    // create an authenticated context instead of a genuinely fresh one.
    const freshContext = await browser.newContext({ storageState: undefined });
    const response = await freshContext.request.get("/api/integrations/meta/connect?company=00000000-0000-0000-0000-000000000000", { maxRedirects: 0 });
    expect([302, 303, 307]).toContain(response.status());
    const location = response.headers()["location"] || "";
    expect(location).toContain("integration_error=session_missing");
    await freshContext.close();
  });
});

test.describe("customer-panel OAuth behavior is unaffected (regression check)", () => {
  test.beforeEach(() => {
    test.skip(!hasQaCustomerCredentials, qaCustomerSkipReason);
  });

  test("8. customer session starting Meta OAuth (no ?company=) still redirects straight to the real provider, unchanged", async ({ request }) => {
    const login = await request.post("/api/auth/login", { data: { identity: CUSTOMER_A_EMAIL, password: CUSTOMER_A_PASSWORD, userType: "customer" } });
    test.skip(!login.ok(), "QA customer login failed — check QA_CUSTOMER_A_EMAIL/PASSWORD.");

    const response = await request.get("/api/integrations/meta/connect", { maxRedirects: 0 });
    expect([302, 303, 307]).toContain(response.status());
    const location = response.headers()["location"] || "";
    expect(location.startsWith("https://www.facebook.com/")).toBeTruthy();
  });

  test("8b. customer session providing a foreign ?company= is still rejected with company_mismatch, unchanged", async ({ request }) => {
    const login = await request.post("/api/auth/login", { data: { identity: CUSTOMER_A_EMAIL, password: CUSTOMER_A_PASSWORD, userType: "customer" } });
    test.skip(!login.ok(), "QA customer login failed — check QA_CUSTOMER_A_EMAIL/PASSWORD.");

    const response = await request.get("/api/integrations/meta/connect?company=00000000-0000-0000-0000-000000000000", { maxRedirects: 0 });
    const location = response.headers()["location"] || "";
    expect(location).toContain("integration_error=company_mismatch");
  });
});
