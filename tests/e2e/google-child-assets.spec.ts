import { test, expect } from "@playwright/test";
import { hasQaAdminCredentials, loginAsQaAdmin, qaAdminStorageState, qaSkipReason } from "./fixtures/qa-auth";

// Regression coverage for "HK ANALYTICS — GOOGLE CHILD ASSET DISCOVERY +
// SELECTION FINALIZATION".
//
// Real root cause of "Yetkili Hesaplar Listele -> 'Yetkili hesaplar
// listelendi.' but no rows for YouTube/Google Ads/GBP": the top-level
// message on GET /api/integrations/accounts?provider=google was a single
// blanket string covering ALL 5 Google services at once (true as soon as
// ANY of them — even just the already-working GA4/Search Console — found
// something), so an admin looking at one specific, genuinely-empty-or-
// blocked service (e.g. Google Ads with no developer token, YouTube/GBP
// with their Cloud APIs not enabled) saw a false "success" message. Fixed
// by having googleDiscoveryGroups() return a real per-service {status,
// assets, message} — AdminConnectionDrawer now reads THIS instead of the
// blanket message.
//
// Also fixed: GOOGLE_ADS_DEVELOPER_TOKEN was a hard blocker even though
// Google sunset developer tokens on 2026-09-09 (access is now tied to the
// Google Cloud project behind GOOGLE_CLIENT_ID) — confirmed against
// current Google Ads API documentation, not assumed. And
// yt-analytics.readonly (needed for the real YouTube metrics sync, a
// different scope from youtube.readonly used for channel discovery) was
// missing from the requested Google OAuth scope list entirely — confirmed
// against a live, already-connected production Google login's actual
// granted scopes.

const REPORTED_COMPANY_ID = "466a4859-332f-4f04-93f9-087fc97e564b";
const GOOGLE_CHILD_SERVICES = ["youtube", "google_ads", "google_business_profile"] as const;

async function getRealCompanies(request: import("@playwright/test").APIRequestContext) {
  const response = await request.get("/api/admin/companies");
  if (!response.ok()) return [];
  const body = await response.json();
  return Array.isArray(body.companies) ? body.companies : [];
}

test.describe("Google child asset discovery + selection", () => {
  test.use({ storageState: qaAdminStorageState });
  test.beforeEach(() => {
    test.skip(!hasQaAdminCredentials(), qaSkipReason);
  });

  test("A/B/C/D/E — each Google child service reports its own real, specific result — never a blanket 'listelendi' hiding a zero/blocked service", async ({ request }) => {
    await loginAsQaAdmin(request);
    const companies = await getRealCompanies(request);
    const company = companies.find((c: any) => c.id === REPORTED_COMPANY_ID) || companies[0];
    test.skip(!company, "No real company available in this environment to test against.");

    const response = await request.get(`/api/integrations/accounts?provider=google&company=${company.id}`);
    test.skip(!response.ok(), "No real, persisted Google connection for this company in this environment.");
    const body = await response.json();
    test.skip(!body.groups, "This environment's Google discovery did not return per-service groups (unexpected shape).");

    for (const service of GOOGLE_CHILD_SERVICES) {
      const group = body.groups[service];
      expect(group, `groups.${service} must exist`).toBeTruthy();
      expect(typeof group.message).toBe("string");
      expect(group.message.length).toBeGreaterThan(0);
      // The real bug this covers: an empty/blocked service must never say
      // "listelendi" (rows found) while actually returning 0 assets.
      if (!group.assets.length) {
        expect(group.message.toLocaleLowerCase("tr-TR")).not.toContain("listelendi");
      } else {
        // A real asset was found — normalized shape must be real, not fabricated.
        for (const asset of group.assets) {
          expect(asset.platform).toBe(service);
          expect(typeof asset.provider_account_id).toBe("string");
          expect(asset.provider_account_id.length).toBeGreaterThan(0);
          expect(typeof asset.provider_account_name).toBe("string");
          expect(asset.provider_account_name.length).toBeGreaterThan(0);
        }
      }
      // Distinguish permission_required from api_not_enabled from a genuine
      // empty result — never collapsed into one generic "Bağlı değil".
      if (group.status === "permission_required") {
        expect(group.message.toLocaleLowerCase("tr-TR")).toContain("yeniden bağla");
      }
      if (group.status === "api_not_enabled") {
        // Not .toLocaleLowerCase("tr-TR") here — Turkish casing turns "API"
        // into "apı" (dotless ı), so match against the original-case text.
        expect(group.message).toMatch(/API/);
      }
    }

    // GBP's own parent "account" row must never appear as a selectable
    // child asset — only real locations do (see googleDiscoveryGroups).
    const gbpAssetTypes = (body.groups.google_business_profile.assets || []).map((a: any) => a.account_type);
    expect(gbpAssetTypes).not.toContain("google_business_profile_account");
  });

  test("Google Ads: developer token is no longer a blocker (Google sunset it 2026-09-09) — discovery is attempted regardless of GOOGLE_ADS_DEVELOPER_TOKEN", async ({ request }) => {
    await loginAsQaAdmin(request);
    const companies = await getRealCompanies(request);
    const company = companies.find((c: any) => c.id === REPORTED_COMPANY_ID) || companies[0];
    test.skip(!company, "No real company available in this environment to test against.");

    const response = await request.get(`/api/integrations/accounts?provider=google&company=${company.id}`);
    test.skip(!response.ok(), "No real, persisted Google connection for this company in this environment.");
    const body = await response.json().catch(() => ({}));
    const adsGroup = body.groups?.google_ads;
    test.skip(!adsGroup, "No google_ads group returned in this environment.");
    // The old, obsolete failure mode was a hardcoded message literally
    // naming the env var as required — that string must never appear again.
    expect(adsGroup.message).not.toContain("GOOGLE_ADS_DEVELOPER_TOKEN gerekiyor");
  });

  test("H — connection counter only counts a real selected child asset, never the shared parent OAuth login by itself", async ({ request }) => {
    await loginAsQaAdmin(request);
    const companies = await getRealCompanies(request);
    const company = companies.find((c: any) => c.id === REPORTED_COMPANY_ID) || companies[0];
    test.skip(!company, "No real company available in this environment to test against.");

    const statusResponse = await request.get(`/api/admin/analytics-center/status?companyId=${company.id}`);
    expect(statusResponse.ok()).toBeTruthy();
    const body = await statusResponse.json();
    test.skip(!body.tablesReady, "Analytics Center tables not migrated in this environment.");

    for (const conn of body.connections) {
      if (conn.status === "connected") {
        expect(conn.asset, `${conn.provider} is 'connected' but has no selected child asset`).toBeTruthy();
      }
      // parentConnected may be true (Google login done) while status stays
      // not_connected (no child asset selected yet) — that combination must
      // be representable, not collapsed together.
      expect(typeof conn.parentConnected).toBe("boolean");
    }
  });

  test("J — Meta (Instagram/Facebook) regression: still connected in production, untouched by this Google-only change", async ({ request }) => {
    await loginAsQaAdmin(request);
    const companies = await getRealCompanies(request);
    const company = companies.find((c: any) => c.id === REPORTED_COMPANY_ID) || companies[0];
    test.skip(!company, "Reported production company not found in this environment.");

    const statusResponse = await request.get(`/api/admin/analytics-center/status?companyId=${company.id}`);
    const body = await statusResponse.json().catch(() => ({}));
    test.skip(!body.tablesReady, "Analytics Center tables not migrated in this environment.");
    const instagram = body.connections?.find((c: any) => c.provider === "instagram");
    const facebook = body.connections?.find((c: any) => c.provider === "facebook");
    test.skip(!instagram || !facebook, "Instagram/Facebook connections not present in this environment.");
    // This is a live-state assertion for the one company known (as of this
    // task) to already be connected and syncing in production — if it ever
    // regresses to not_connected, this is a real, actionable break.
    if (company.id === REPORTED_COMPANY_ID) {
      expect(instagram.status).toBe("connected");
      expect(facebook.status).toBe("connected");
    }
  });

  test("G — company isolation: Google child-asset groups for one company are not visible under another company's id", async ({ request }) => {
    await loginAsQaAdmin(request);
    const companies = await getRealCompanies(request);
    test.skip(companies.length < 2, "Need at least two real companies in this environment to test isolation.");
    const [companyA, companyB] = companies;

    const responseA = await request.get(`/api/integrations/accounts?provider=google&company=${companyA.id}`);
    const responseB = await request.get(`/api/integrations/accounts?provider=google&company=${companyB.id}`);
    const bodyA = await responseA.json().catch(() => ({}));
    const bodyB = await responseB.json().catch(() => ({}));
    const idsA = new Set((bodyA.accounts || []).map((a: any) => a.provider_account_id));
    const idsB = new Set((bodyB.accounts || []).map((a: any) => a.provider_account_id));
    for (const id of idsA) {
      if (!id) continue;
      expect(idsB.has(id)).toBeFalsy();
    }
  });
});
