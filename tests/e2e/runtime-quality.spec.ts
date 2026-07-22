import { test, expect } from "@playwright/test";

const ROUTES_TO_CHECK = ["/", "/hakkimda", "/hizmetler", "/paketler", "/blog", "/iletisim", "/giris"];

test("no tested public route returns a 500 and no same-origin request fails unexpectedly", async ({ page }) => {
  const failedRequests: string[] = [];
  page.on("response", (response) => {
    const url = response.url();
    const sameOrigin = url.startsWith(page.url().split("/").slice(0, 3).join("/")) || url.startsWith("/");
    if (sameOrigin && response.status() >= 500) {
      failedRequests.push(`${response.status()} ${url}`);
    }
  });

  for (const path of ROUTES_TO_CHECK) {
    const response = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(response?.status(), `${path} must not return a 5xx`).toBeLessThan(500);
    await page.waitForLoadState("domcontentloaded");
  }

  expect(failedRequests, "no same-origin request should fail with a 5xx while browsing public routes").toEqual([]);
});

test("unauthenticated file upload is rejected", async ({ request }) => {
  const response = await request.post("/api/media", {
    multipart: {
      file: {
        name: "test.png",
        mimeType: "image/png",
        buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      }
    }
  });
  expect(response.status()).toBe(401);
});
