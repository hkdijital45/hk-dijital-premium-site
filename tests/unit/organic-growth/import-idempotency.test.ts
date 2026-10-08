import test from "node:test";
import assert from "node:assert/strict";
import { insertArticleAsDraft } from "../../../src/lib/organic-growth/article-import.ts";

// Regression coverage for the production bug: "duplicate key value violates
// unique constraint" after Claude'dan Taslak İçe Aktar → Doğrula → Taslak
// Olarak Kaydet, plus the content-plan status/dropdown desync that
// accompanied it. insertArticleAsDraft talks to Supabase exclusively through
// supabaseRest's global `fetch` call, so these tests stub `fetch` directly
// rather than mocking the module — no network, fully deterministic.

const ARTICLE = {
  title: "Manisa'da Dijital Pazarlama Nasıl Yapılır?",
  slug: "manisada-dijital-pazarlama-nasil-yapilir",
  excerpt: "Manisa'daki işletmeler için dijital pazarlama stratejisi kurmanın adımlarını anlatan rehber.",
  content: "Manisa'da dijital pazarlama ".repeat(60),
  meta_title: "Manisa'da Dijital Pazarlama Rehberi",
  meta_description: "Manisa'daki işletmeler için adım adım dijital pazarlama rehberi.",
  primary_keyword: "manisa dijital pazarlama",
  secondary_keywords: ["manisa reklam ajansı"],
  search_intent: "informational"
};

function withFetch(handler: (url: string, init: RequestInit) => any, run: () => Promise<void>) {
  const original = globalThis.fetch;
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://stub.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "stub-key";
  // @ts-expect-error - test stub, not a full Fetch implementation
  globalThis.fetch = async (input: string, init: RequestInit = {}) => {
    const url = String(input).replace("https://stub.supabase.co/rest/v1/", "");
    const result = await handler(url, init);
    const status = result?.status ?? 201;
    const body = result?.body === undefined ? [] : result.body;
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => (body === null ? "" : JSON.stringify(body))
    } as Response;
  };
  return run().finally(() => {
    globalThis.fetch = original;
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  });
}

// TEST 1 + TEST 5: a fresh import creates exactly one blog_posts row and
// persists the content-plan item's status as DRAFT, linked to that row.
test("insertArticleAsDraft: fresh import inserts once and links+persists DRAFT status", async () => {
  const calls: Array<{ url: string; method: string }> = [];
  await withFetch(
    (url, init) => {
      calls.push({ url, method: init.method || "GET" });
      if (url.startsWith("organic_content_plan_items?select") && (init.method || "GET") === "GET") {
        return { body: [{ id: "item-1", blog_post_id: null, status: "WAITING_FOR_CLAUDE" }] };
      }
      if (url.startsWith("blog_posts?slug=eq")) return { body: [] }; // slug free
      if (url === "blog_posts" && init.method === "POST") return { body: [{ id: "post-1" }] };
      if (url.startsWith("organic_content_plan_items?id=eq") && init.method === "PATCH") {
        assert.equal(JSON.parse(init.body as string).status, "DRAFT");
        assert.equal(JSON.parse(init.body as string).blog_post_id, "post-1");
        return { body: [{ id: "item-1", status: "DRAFT", blog_post_id: "post-1" }] };
      }
      throw new Error(`unexpected request: ${init.method} ${url}`);
    },
    async () => {
      const result = await insertArticleAsDraft(ARTICLE, "item-1");
      assert.equal(result.post.id, "post-1");
    }
  );
  const inserts = calls.filter((c) => c.url === "blog_posts" && c.method === "POST");
  assert.equal(inserts.length, 1, "exactly one blog_posts row must be created");
});

// TEST 2 + TEST 7: re-importing for a content-plan item that's already
// linked to a draft must UPDATE that same row, never INSERT a second one —
// this is also the recovery path for an item left at blog_post_id=null.
test("insertArticleAsDraft: re-import for an already-linked draft updates in place, no second insert", async () => {
  const calls: Array<{ url: string; method: string }> = [];
  await withFetch(
    (url, init) => {
      calls.push({ url, method: init.method || "GET" });
      if (url.startsWith("organic_content_plan_items?select")) {
        return { body: [{ id: "item-1", blog_post_id: "post-1", status: "DRAFT" }] };
      }
      if (url.startsWith("blog_posts?id=eq.post-1&select=id,status,slug")) {
        return { body: [{ id: "post-1", status: "draft", slug: "manisada-dijital-pazarlama-nasil-yapilir" }] };
      }
      if (url.startsWith("blog_posts?id=eq.post-1&select=id") && init.method === "PATCH") {
        const payload = JSON.parse(init.body as string);
        assert.ok(!("slug" in payload), "slug must never be sent on an update (URL must not drift)");
        return { body: [{ id: "post-1" }] };
      }
      if (url.startsWith("organic_content_plan_items?id=eq") && init.method === "PATCH") {
        return { body: [{ id: "item-1", status: "DRAFT" }] };
      }
      if (url === "blog_posts" && init.method === "POST") throw new Error("must not insert a new blog_posts row on reuse");
      throw new Error(`unexpected request: ${init.method} ${url}`);
    },
    async () => {
      const result = await insertArticleAsDraft(ARTICLE, "item-1");
      assert.equal(result.post.id, "post-1");
    }
  );
  assert.equal(calls.filter((c) => c.method === "POST" && c.url === "blog_posts").length, 0);
});

// TEST 3 + data-safety requirement B: never overwrite an already-published
// article just because its content-plan item is re-imported.
test("insertArticleAsDraft: refuses to overwrite a non-draft (published/scheduled) linked article", async () => {
  await withFetch(
    (url) => {
      if (url.startsWith("organic_content_plan_items?select")) {
        return { body: [{ id: "item-1", blog_post_id: "post-1", status: "PUBLISHED" }] };
      }
      if (url.startsWith("blog_posts?id=eq.post-1")) {
        return { body: [{ id: "post-1", status: "published", slug: "x" }] };
      }
      throw new Error(`unexpected request: ${url}`);
    },
    async () => {
      await assert.rejects(() => insertArticleAsDraft(ARTICLE, "item-1"), /yayınlanmış|zamanlanmış/);
    }
  );
});

// TEST 4: a genuine duplicate-key race (two concurrent first-time imports)
// is retried once with a suffixed slug instead of surfacing a raw DB error.
test("insertArticleAsDraft: retries once with a suffixed slug on a unique-constraint race", async () => {
  let insertAttempts = 0;
  await withFetch(
    (url, init) => {
      if (url.startsWith("organic_content_plan_items?select")) return { body: [{ id: "item-1", blog_post_id: null, status: "WAITING_FOR_CLAUDE" }] };
      if (url.startsWith("blog_posts?slug=eq")) return { body: [] };
      if (url === "blog_posts" && init.method === "POST") {
        insertAttempts += 1;
        if (insertAttempts === 1) {
          return { status: 409, body: { message: "duplicate key value violates unique constraint \"blog_posts_slug_key\"", code: "23505" } };
        }
        return { body: [{ id: "post-2" }] };
      }
      if (url.startsWith("organic_content_plan_items?id=eq") && init.method === "PATCH") return { body: [{ id: "item-1" }] };
      throw new Error(`unexpected request: ${init.method} ${url}`);
    },
    async () => {
      const result = await insertArticleAsDraft(ARTICLE, "item-1");
      assert.equal(result.post.id, "post-2");
    }
  );
  assert.equal(insertAttempts, 2);
});

// TEST 8: a content-plan item not found (e.g. stale/deleted id) fails
// clearly instead of silently creating an orphaned blog post.
test("insertArticleAsDraft: missing content-plan item throws a clear Turkish error, no insert attempted", async () => {
  await withFetch(
    (url, init) => {
      if (url.startsWith("organic_content_plan_items?select")) return { body: [] };
      if (url === "blog_posts" && init.method === "POST") throw new Error("must not insert when the content-plan item is missing");
      throw new Error(`unexpected request: ${url}`);
    },
    async () => {
      await assert.rejects(() => insertArticleAsDraft(ARTICLE, "missing-item"), /bulunamadı/);
    }
  );
});
