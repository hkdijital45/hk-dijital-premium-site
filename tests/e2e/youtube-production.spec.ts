import { test, expect } from "@playwright/test";
import { hasQaAdminCredentials, qaAdminStorageState, qaSkipReason } from "./fixtures/qa-auth";
const company = "466a4859-332f-4f04-93f9-087fc97e564b";

test.describe("YouTube production connection", () => {
  test.use({ storageState: qaAdminStorageState });
  test.beforeEach(() => { test.skip(!hasQaAdminCredentials(), qaSkipReason); });

  test("real channel discovery matches persisted selectable YouTube asset", async ({ request }) => {
    const discovery = await request.get(`/api/integrations/accounts?provider=google&company=${company}`);
    expect(discovery.ok()).toBeTruthy();
    const group = (await discovery.json()).groups.youtube;
    expect(group.status).toBe("ok");
    expect(group.assets.length).toBeGreaterThan(0);
    const status = await request.get(`/api/admin/analytics-center/status?companyId=${company}`);
    const youtube = (await status.json()).connections.find((c: { provider: string }) => c.provider === "youtube");
    expect(youtube.asset.platform).toBe("youtube");
    expect(youtube.asset.asset_type).toBe("youtube_channel");
    expect(group.assets.map((a: { provider_account_id: string }) => a.provider_account_id)).toContain(youtube.asset.provider_account_id);
  });

  test("direct reconnect requests both scopes and reaches Google without a customer-panel hop", async ({ page, request }) => {
    const status = await request.get(`/api/admin/analytics-center/status?companyId=${company}`);
    const youtube = (await status.json()).connections.find((c: { provider: string }) => c.provider === "youtube");
    const response = await request.get(youtube.manageHref, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    const target = new URL(response.headers().location);
    expect(target.origin).toBe("https://accounts.google.com");
    const scopes = (target.searchParams.get("scope") || "").split(" ");
    expect(scopes).toContain("https://www.googleapis.com/auth/youtube.readonly");
    expect(scopes).toContain("https://www.googleapis.com/auth/yt-analytics.readonly");
    expect(target.searchParams.get("prompt")).toBe("consent");
    await page.goto(youtube.manageHref);
    await expect(page).toHaveURL(/accounts\.google\.com/);
    // Stop at Google: signing in/consenting belongs to the account owner.
  });
});
