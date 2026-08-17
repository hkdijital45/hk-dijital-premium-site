import test from "node:test";
import assert from "node:assert/strict";

// All Gemini API calls in this suite are stubbed at the global fetch layer —
// zero real network calls, zero tokens burned. This exercises the actual
// @google/genai SDK request-building/response-parsing code against a fake
// transport, not an application-level mock, so retry/timeout/error-mapping
// behavior is genuinely verified.

const originalFetch = globalThis.fetch;
const originalKey = process.env.GEMINI_API_KEY;
const originalGoogleKey = process.env.GOOGLE_API_KEY;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function successBody(overrides: Record<string, unknown> = {}) {
  return {
    candidates: [{ content: { parts: [{ text: "merhaba dünya" }], role: "model" }, finishReason: "STOP" }],
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 17, thoughtsTokenCount: 2, cachedContentTokenCount: 1 },
    modelVersion: "gemini-3.6-flash",
    ...overrides
  };
}

test.after(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalKey;
  if (originalGoogleKey === undefined) delete process.env.GOOGLE_API_KEY;
  else process.env.GOOGLE_API_KEY = originalGoogleKey;
});

delete process.env.GEMINI_API_KEY;
delete process.env.GOOGLE_API_KEY;
const { callGeminiGenerate } = await import("../../src/lib/gemini-client-core.ts");

test("throws a clear, generic error when GEMINI_API_KEY/GOOGLE_API_KEY are both missing — makes zero network calls", async () => {
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_API_KEY;
  let calls = 0;
  globalThis.fetch = (async () => { calls++; return jsonResponse({}); }) as typeof fetch;
  await assert.rejects(
    () => callGeminiGenerate({ model: "gemini-3.6-flash", instructions: "sys", input: "hi", reasoning: "low", maxOutputTokens: 100, allowWeb: false, timeoutMs: 5000 }),
    /Gemini API anahtarı yapılandırılmadı/
  );
  assert.equal(calls, 0);
  process.env.GEMINI_API_KEY = "test-key-for-unit-tests";
});

test("maps a successful response's text and usage metadata", async () => {
  let calls = 0;
  globalThis.fetch = (async () => { calls++; return jsonResponse(successBody()); }) as typeof fetch;
  const result = await callGeminiGenerate({ model: "gemini-3.6-flash", instructions: "sys", input: "hi", reasoning: "medium", maxOutputTokens: 500, allowWeb: false, timeoutMs: 5000 });
  assert.equal(calls, 1);
  assert.equal(result.text, "merhaba dünya");
  assert.equal(result.model, "gemini-3.6-flash");
  assert.equal(result.inputTokens, 10);
  assert.equal(result.outputTokens, 5);
  assert.equal(result.cachedInputTokens, 1);
  assert.equal(result.thinkingTokens, 2);
  assert.equal(result.totalTokens, 17);
  assert.deepEqual(result.citations, []);
});

test("a malformed/empty response does not crash — returns empty text instead", async () => {
  globalThis.fetch = (async () => jsonResponse({})) as typeof fetch;
  const result = await callGeminiGenerate({ model: "gemini-3.6-flash", instructions: "sys", input: "hi", reasoning: "low", maxOutputTokens: 500, allowWeb: false, timeoutMs: 5000 });
  assert.equal(result.text, "");
  assert.equal(result.inputTokens, 0);
});

test("429 triggers exactly one retry, then succeeds", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    if (calls === 1) return jsonResponse({ error: { message: "rate limited", code: 429, status: "RESOURCE_EXHAUSTED" } }, 429);
    return jsonResponse(successBody());
  }) as typeof fetch;
  const result = await callGeminiGenerate({ model: "gemini-3.5-flash-lite", instructions: "sys", input: "hi", reasoning: "none", maxOutputTokens: 300, allowWeb: false, timeoutMs: 5000 });
  assert.equal(calls, 2);
  assert.equal(result.text, "merhaba dünya");
});

test("500 retries exactly once total, then gives up (no unbounded retry loop)", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return jsonResponse({ error: { message: "internal", code: 500, status: "INTERNAL" } }, 500);
  }) as typeof fetch;
  await assert.rejects(() =>
    callGeminiGenerate({ model: "gemini-3.1-pro-preview", instructions: "sys", input: "hi", reasoning: "high", maxOutputTokens: 2000, allowWeb: false, timeoutMs: 5000 })
  );
  assert.equal(calls, 2);
});

test("400 (validation-shaped error) is never retried", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return jsonResponse({ error: { message: "invalid argument", code: 400, status: "INVALID_ARGUMENT" } }, 400);
  }) as typeof fetch;
  await assert.rejects(() =>
    callGeminiGenerate({ model: "gemini-3.6-flash", instructions: "sys", input: "hi", reasoning: "low", maxOutputTokens: 500, allowWeb: false, timeoutMs: 5000 })
  );
  assert.equal(calls, 1);
});

test("401 (auth error) is never retried", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return jsonResponse({ error: { message: "unauthenticated", code: 401, status: "UNAUTHENTICATED" } }, 401);
  }) as typeof fetch;
  await assert.rejects(() =>
    callGeminiGenerate({ model: "gemini-3.6-flash", instructions: "sys", input: "hi", reasoning: "low", maxOutputTokens: 500, allowWeb: false, timeoutMs: 5000 })
  );
  assert.equal(calls, 1);
});

test("a 429 that persists through the primary model's own retry falls back to fallbackModel (real production case: preview-model quota exhausted)", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    if (calls <= 2) return jsonResponse({ error: { message: "quota exceeded", code: 429, status: "RESOURCE_EXHAUSTED" } }, 429);
    return jsonResponse(successBody({ modelVersion: "gemini-3.6-flash" }));
  }) as typeof fetch;
  const result = await callGeminiGenerate({
    model: "gemini-3.1-pro-preview",
    fallbackModel: "gemini-3.6-flash",
    fallbackReasoning: "high",
    instructions: "sys",
    input: "hi",
    reasoning: "high",
    maxOutputTokens: 2000,
    allowWeb: false,
    timeoutMs: 5000
  });
  // 2 calls for the primary model (1 + its own transient retry), then 1 for the fallback model.
  assert.equal(calls, 3);
  assert.equal(result.model, "gemini-3.6-flash");
});

test("a 429 with no fallback model configured still fails after its own single retry (no unbounded retry)", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return jsonResponse({ error: { message: "quota exceeded", code: 429, status: "RESOURCE_EXHAUSTED" } }, 429);
  }) as typeof fetch;
  await assert.rejects(() =>
    callGeminiGenerate({ model: "gemini-3.6-flash", instructions: "sys", input: "hi", reasoning: "low", maxOutputTokens: 500, allowWeb: false, timeoutMs: 5000 })
  );
  assert.equal(calls, 2);
});

test("404 (model unavailable) with no fallback configured is never retried and is not treated as transient", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return jsonResponse({ error: { message: "model not found", code: 404, status: "NOT_FOUND" } }, 404);
  }) as typeof fetch;
  await assert.rejects(() =>
    callGeminiGenerate({ model: "gemini-3.6-flash", instructions: "sys", input: "hi", reasoning: "low", maxOutputTokens: 500, allowWeb: false, timeoutMs: 5000 })
  );
  assert.equal(calls, 1);
});

test("404 (model unavailable) falls back to fallbackModel exactly once, then succeeds", async () => {
  let calls = 0;
  const requestedModels: string[] = [];
  globalThis.fetch = ((_url: string) => {
    calls++;
    const url = String(_url);
    requestedModels.push(url.match(/models\/([^:]+):/)?.[1] || "");
    if (calls === 1) return Promise.resolve(jsonResponse({ error: { message: "model not found", code: 404, status: "NOT_FOUND" } }, 404));
    return Promise.resolve(jsonResponse(successBody({ modelVersion: "gemini-3.5-flash" })));
  }) as typeof fetch;
  const result = await callGeminiGenerate({
    model: "gemini-3.5-flash-lite",
    fallbackModel: "gemini-3.5-flash",
    instructions: "sys",
    input: "hi",
    reasoning: "none",
    maxOutputTokens: 300,
    allowWeb: false,
    timeoutMs: 5000
  });
  assert.equal(calls, 2);
  assert.equal(result.model, "gemini-3.5-flash");
  assert.deepEqual(requestedModels, ["gemini-3.5-flash-lite", "gemini-3.5-flash"]);
});

test("404 fallback never chains to a third model (fallback attempt failing again just fails)", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return jsonResponse({ error: { message: "model not found", code: 404, status: "NOT_FOUND" } }, 404);
  }) as typeof fetch;
  await assert.rejects(() =>
    callGeminiGenerate({
      model: "gemini-3.5-flash-lite",
      fallbackModel: "gemini-3.5-flash",
      instructions: "sys",
      input: "hi",
      reasoning: "none",
      maxOutputTokens: 300,
      allowWeb: false,
      timeoutMs: 5000
    })
  );
  assert.equal(calls, 2, "primary + one fallback attempt, no further chaining");
});

test("a hung request is aborted at the configured timeout", async () => {
  globalThis.fetch = ((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
    const signal = init?.signal;
    if (signal?.aborted) return reject(new DOMException("Aborted", "AbortError"));
    signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  })) as typeof fetch;
  const startedAt = Date.now();
  await assert.rejects(() =>
    callGeminiGenerate({ model: "gemini-3.1-pro-preview", instructions: "sys", input: "hi", reasoning: "high", maxOutputTokens: 2000, allowWeb: false, timeoutMs: 80 })
  );
  assert.ok(Date.now() - startedAt < 3000, "should abort promptly rather than hang");
});

test("error messages surfaced to the caller never contain a raw API key", async () => {
  globalThis.fetch = (async () => jsonResponse({ error: { message: "bad key=AIzaSyFAKEKEYFORTESTINGDONOTUSE1234567890", code: 400, status: "INVALID_ARGUMENT" } }, 400)) as typeof fetch;
  await assert.rejects(
    () => callGeminiGenerate({ model: "gemini-3.6-flash", instructions: "sys", input: "hi", reasoning: "low", maxOutputTokens: 500, allowWeb: false, timeoutMs: 5000 }),
    (error: Error) => {
      assert.doesNotMatch(error.message, /AIzaSyFAKEKEYFORTESTINGDONOTUSE1234567890/);
      return true;
    }
  );
});

test("Google Search grounding tool is only sent when allowWeb=true", async () => {
  let capturedBody: Record<string, unknown> | null = null;
  globalThis.fetch = ((_url: string, init?: RequestInit) => {
    capturedBody = JSON.parse(String(init?.body || "{}"));
    return Promise.resolve(jsonResponse(successBody()));
  }) as typeof fetch;

  await callGeminiGenerate({ model: "gemini-3.6-flash", instructions: "sys", input: "hi", reasoning: "low", maxOutputTokens: 500, allowWeb: false, timeoutMs: 5000 });
  assert.equal(capturedBody!.tools, undefined);

  await callGeminiGenerate({ model: "gemini-3.6-flash", instructions: "sys", input: "hi", reasoning: "low", maxOutputTokens: 500, allowWeb: true, timeoutMs: 5000 });
  assert.deepEqual(capturedBody!.tools, [{ googleSearch: {} }]);
});

test("structured output schema is forwarded as responseJsonSchema + application/json mimetype", async () => {
  let capturedBody: Record<string, unknown> | null = null;
  globalThis.fetch = ((_url: string, init?: RequestInit) => {
    capturedBody = JSON.parse(String(init?.body || "{}"));
    return Promise.resolve(jsonResponse(successBody()));
  }) as typeof fetch;

  const schema = { type: "object", properties: { score: { type: "number" } }, required: ["score"] };
  await callGeminiGenerate({ model: "gemini-3.5-flash-lite", instructions: "sys", input: "hi", reasoning: "none", maxOutputTokens: 300, allowWeb: false, timeoutMs: 5000, responseSchema: schema });
  const generationConfig = capturedBody!.generationConfig as Record<string, unknown>;
  assert.equal(generationConfig.responseMimeType, "application/json");
  assert.deepEqual(generationConfig.responseJsonSchema, schema);
});

test("thinking config: FAST/DEFAULT disable via thinkingBudget:0, preview Pro uses MINIMAL (cannot fully disable)", async () => {
  let capturedBody: Record<string, unknown> | null = null;
  globalThis.fetch = ((_url: string, init?: RequestInit) => {
    capturedBody = JSON.parse(String(init?.body || "{}"));
    return Promise.resolve(jsonResponse(successBody()));
  }) as typeof fetch;
  const thinkingConfig = () => (capturedBody!.generationConfig as Record<string, unknown>).thinkingConfig;

  await callGeminiGenerate({ model: "gemini-3.5-flash-lite", instructions: "sys", input: "hi", reasoning: "none", maxOutputTokens: 300, allowWeb: false, timeoutMs: 5000 });
  assert.deepEqual(thinkingConfig(), { thinkingBudget: 0 });

  await callGeminiGenerate({ model: "gemini-3.1-pro-preview", instructions: "sys", input: "hi", reasoning: "none", maxOutputTokens: 300, allowWeb: false, timeoutMs: 5000 });
  assert.deepEqual(thinkingConfig(), { thinkingLevel: "MINIMAL" });

  await callGeminiGenerate({ model: "gemini-3.1-pro-preview", instructions: "sys", input: "hi", reasoning: "high", maxOutputTokens: 2000, allowWeb: false, timeoutMs: 5000 });
  assert.deepEqual(thinkingConfig(), { thinkingLevel: "HIGH" });
});
