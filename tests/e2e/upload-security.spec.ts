import { test, expect, type Page } from "@playwright/test";
import { hasQaAdminCredentials, loginAsQaAdmin, qaSkipReason } from "./fixtures/qa-auth";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const MALICIOUS_SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

// This sandbox's plain-HTTP local server still marks the session cookie
// Secure (matches NODE_ENV=production). A real browser's own network stack
// (in-page fetch via page.evaluate) correctly treats 127.0.0.1 as a
// potentially trustworthy loopback origin and sends it back; Playwright's
// Node-side request context does not and silently drops the cookie on later
// calls — so the multipart upload must be built and submitted from inside
// the real page, not via request.post({ multipart: ... }).
function inPageUpload(page: Page) {
  return (opts: { fileName: string; mimeType: string; bytesBase64: string; purpose: string }) =>
    page.evaluate(
      async ({ fileName, mimeType, bytesBase64, purpose }) => {
        const binary = atob(bytesBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
        const file = new File([bytes], fileName, { type: mimeType });
        const form = new FormData();
        form.append("file", file);
        form.append("purpose", purpose);
        const response = await fetch("/api/media", { method: "POST", body: form });
        const body = await response.json().catch(() => ({}));
        return { status: response.status, ok: response.ok, body };
      },
      opts
    );
}

test.describe("authenticated upload validation (POST /api/media)", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasQaAdminCredentials(), qaSkipReason);
    // A page navigation is required before in-page fetch() calls with
    // relative URLs will resolve — page.evaluate runs against about:blank
    // until the page actually navigates somewhere.
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await loginAsQaAdmin(page.request);
  });

  test("a permitted, correctly-signed file type succeeds", async ({ page }) => {
    const response = await inPageUpload(page)({
      fileName: "qa-fixture.png",
      mimeType: "image/png",
      bytesBase64: PNG_SIGNATURE.toString("base64"),
      purpose: "media"
    });
    expect(response.ok, JSON.stringify(response.body)).toBeTruthy();
  });

  test("a disallowed file extension/type is rejected", async ({ page }) => {
    const response = await inPageUpload(page)({
      fileName: "qa-fixture.exe",
      mimeType: "application/x-msdownload",
      bytesBase64: Buffer.from("MZ").toString("base64"),
      purpose: "media"
    });
    expect(response.status).toBe(400);
  });

  test("a MIME-type mismatch (declared PNG, real content is not PNG) is rejected for logo uploads", async ({ page }) => {
    const response = await inPageUpload(page)({
      fileName: "fake.png",
      mimeType: "image/png",
      bytesBase64: Buffer.from("this is not a real png file").toString("base64"),
      purpose: "logo"
    });
    expect(response.status).toBe(400);
  });

  test("an oversized upload is rejected", async ({ page }) => {
    const oversized = Buffer.alloc(11 * 1024 * 1024, 1);
    const response = await inPageUpload(page)({
      fileName: "too-big.png",
      mimeType: "image/png",
      bytesBase64: oversized.toString("base64"),
      purpose: "media"
    });
    expect(response.status).toBe(400);
  });

  test("an SVG containing a <script> tag is rejected", async ({ page }) => {
    const response = await inPageUpload(page)({
      fileName: "malicious.svg",
      mimeType: "image/svg+xml",
      bytesBase64: MALICIOUS_SVG.toString("base64"),
      purpose: "media"
    });
    expect(response.status).toBe(400);
  });
});
