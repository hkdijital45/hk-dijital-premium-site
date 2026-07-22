import { test, expect } from "@playwright/test";
import { hasQaAdminCredentials, loginAsQaAdmin, qaSkipReason } from "./fixtures/qa-auth";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const MALICIOUS_SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

test.describe("authenticated upload validation (POST /api/media)", () => {
  test.beforeEach(async ({ request }) => {
    test.skip(!hasQaAdminCredentials(), qaSkipReason);
    await loginAsQaAdmin(request);
  });

  test("a permitted, correctly-signed file type succeeds", async ({ request }) => {
    const response = await request.post("/api/media", {
      multipart: { file: { name: "qa-fixture.png", mimeType: "image/png", buffer: PNG_SIGNATURE }, purpose: "media" }
    });
    expect(response.ok(), await response.text()).toBeTruthy();
  });

  test("a disallowed file extension/type is rejected", async ({ request }) => {
    const response = await request.post("/api/media", {
      multipart: { file: { name: "qa-fixture.exe", mimeType: "application/x-msdownload", buffer: Buffer.from("MZ") }, purpose: "media" }
    });
    expect(response.status()).toBe(400);
  });

  test("a MIME-type mismatch (declared PNG, real content is not PNG) is rejected for logo uploads", async ({ request }) => {
    const response = await request.post("/api/media", {
      multipart: { file: { name: "fake.png", mimeType: "image/png", buffer: Buffer.from("this is not a real png file") }, purpose: "logo" }
    });
    expect(response.status()).toBe(400);
  });

  test("an oversized upload is rejected", async ({ request }) => {
    const oversized = Buffer.alloc(11 * 1024 * 1024, 1);
    const response = await request.post("/api/media", {
      multipart: { file: { name: "too-big.png", mimeType: "image/png", buffer: oversized }, purpose: "media" }
    });
    expect(response.status()).toBe(400);
  });

  test("an SVG containing a <script> tag is rejected", async ({ request }) => {
    const response = await request.post("/api/media", {
      multipart: { file: { name: "malicious.svg", mimeType: "image/svg+xml", buffer: MALICIOUS_SVG }, purpose: "media" }
    });
    expect(response.status()).toBe(400);
  });
});
