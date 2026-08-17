import { ApiError, GoogleGenAI, ThinkingLevel } from "@google/genai";
import type { HKAIModel, HKReasoningEffort } from "@/lib/hk-ai-router";

// Single, centralized Gemini API integration point — every HK AI production
// call goes through callGeminiGenerate(). GEMINI_API_KEY is read here only,
// never logged, never echoed in a response body. Import this module only
// through src/lib/gemini-client.ts, which adds the server-only guard — this
// core module has no bundle guard of its own so it stays importable from
// tests/unit/gemini-client.test.ts (the real "server-only" npm package
// throws unconditionally outside Next's bundler, including in plain Node
// test runs, so the guard has to live one layer up).

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  // GOOGLE_API_KEY is accepted as a fallback for consistency with
  // configuredByEnvironment() in ai-router.ts and the legacy env var some
  // deployments already had configured — GEMINI_API_KEY is the documented,
  // primary name (.env.example).
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("Gemini API anahtarı yapılandırılmadı.");
  if (!client) client = new GoogleGenAI({ apiKey });
  return client;
}

export type GeminiGenerateResult = {
  text: string;
  model: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  totalTokens: number;
  responseMs: number;
  citations: string[];
};

export type GeminiGenerateRequest = {
  model: HKAIModel;
  /** Stable developer/system instructions — kept first in the request so
   * Gemini's implicit context caching can key off it across repeated calls.
   * Never randomize this per request. */
  instructions: string;
  /** Dynamic, per-request user/customer content — kept last. */
  input: string;
  reasoning: HKReasoningEffort;
  maxOutputTokens: number;
  allowWeb: boolean;
  timeoutMs: number;
  /** Optional JSON Schema for machine-readable results (lead score,
   * classification, router output, ...). When set, the response is
   * constrained to application/json shaped by this schema. */
  responseSchema?: Record<string, unknown>;
  /** Used only if the primary `model` above returns a model-not-found
   * error (404) — at most one fallback attempt, never chained further. */
  fallbackModel?: HKAIModel;
  fallbackReasoning?: HKReasoningEffort;
};

// Preview/pro-tier models can reject a fully-disabled thinking budget
// (thinkingBudget 0) — "none"/"low" essentially never route to POWERFUL in
// practice since that tier's actions always carry medium/high complexity,
// but MINIMAL is the safe floor if it ever does.
const CANNOT_DISABLE_THINKING = new Set<HKAIModel>(["gemini-3.1-pro-preview"]);

function thinkingConfigFor(model: HKAIModel, reasoning: HKReasoningEffort) {
  if (reasoning === "none") {
    if (CANNOT_DISABLE_THINKING.has(model)) return { thinkingLevel: ThinkingLevel.MINIMAL };
    return { thinkingBudget: 0 };
  }
  const level: Partial<Record<HKReasoningEffort, ThinkingLevel>> = {
    low: ThinkingLevel.LOW,
    medium: ThinkingLevel.MEDIUM,
    high: ThinkingLevel.HIGH,
    xhigh: ThinkingLevel.HIGH,
    max: ThinkingLevel.HIGH
  };
  return { thinkingLevel: level[reasoning] || ThinkingLevel.LOW };
}

function isRetryableStatus(status: number | undefined) {
  return status === 429 || (typeof status === "number" && status >= 500 && status < 600);
}

function redactError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Gemini sağlayıcı hatası";
  return message
    .replace(/AIza[A-Za-z0-9_-]{10,}/g, "[redacted]")
    .replace(/key=[A-Za-z0-9_-]+/gi, "key=[redacted]")
    .slice(0, 400);
}

async function once(payload: GeminiGenerateRequest, model: HKAIModel, reasoning: HKReasoningEffort, signal: AbortSignal): Promise<GeminiGenerateResult> {
  const started = Date.now();
  const ai = getClient();
  const response = await ai.models.generateContent({
    model,
    contents: payload.input,
    config: {
      abortSignal: signal,
      systemInstruction: payload.instructions,
      maxOutputTokens: payload.maxOutputTokens,
      thinkingConfig: thinkingConfigFor(model, reasoning),
      ...(payload.allowWeb ? { tools: [{ googleSearch: {} }] } : {}),
      ...(payload.responseSchema
        ? { responseMimeType: "application/json", responseJsonSchema: payload.responseSchema }
        : {})
    }
  });

  const text = response.text || "";
  const usage = response.usageMetadata;
  const citations = (response.candidates?.[0]?.groundingMetadata?.groundingChunks || [])
    .map((chunk) => chunk.web?.uri)
    .filter((uri): uri is string => Boolean(uri));

  return {
    text,
    model: response.modelVersion || model,
    inputTokens: usage?.promptTokenCount || 0,
    cachedInputTokens: usage?.cachedContentTokenCount || 0,
    outputTokens: usage?.candidatesTokenCount || 0,
    thinkingTokens: usage?.thoughtsTokenCount || 0,
    totalTokens: usage?.totalTokenCount || 0,
    responseMs: Date.now() - started,
    citations
  };
}

// Triggers the one-time model-level fallback: 404 (model deprecated/removed
// for this account) or a 429 that has *already* survived attemptModel's own
// transient retry — a 429 that persists through a retry is a real quota
// limit on that specific model/tier (confirmed in production: a preview
// model's own quota exhausted while the stable models still had headroom),
// not a momentary rate spike, so trying a different model is the right move.
function shouldTryFallbackModel(status: number | undefined) {
  return status === 404 || status === 429;
}

// One model attempt, with its own single controlled retry for transient
// failures (429 / 5xx / network) — never for auth/validation errors. Retry
// uses a short fixed backoff, not an open loop.
async function attemptModel(payload: GeminiGenerateRequest, model: HKAIModel, reasoning: HKReasoningEffort, signal: AbortSignal): Promise<GeminiGenerateResult> {
  try {
    return await once(payload, model, reasoning, signal);
  } catch (error) {
    const status = error instanceof ApiError ? error.status : undefined;
    const isAbort = error instanceof Error && error.name === "AbortError";
    if (isAbort || !isRetryableStatus(status)) throw error;
    await new Promise((resolve) => setTimeout(resolve, 500));
    return await once(payload, model, reasoning, signal);
  }
}

/**
 * Calls the Gemini API for the primary model, with a hard timeout so a
 * stuck request can't hang the UI. If the primary model is not found (404)
 * or still rate/quota-limited after its own transient retry (429), falls
 * back to `payload.fallbackModel` exactly once, never chained further.
 */
export async function callGeminiGenerate(payload: GeminiGenerateRequest): Promise<GeminiGenerateResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), payload.timeoutMs);
  try {
    try {
      return await attemptModel(payload, payload.model, payload.reasoning, controller.signal);
    } catch (error) {
      const status = error instanceof ApiError ? error.status : undefined;
      const isAbort = error instanceof Error && error.name === "AbortError";
      if (isAbort || !shouldTryFallbackModel(status) || !payload.fallbackModel) throw error;
      return await attemptModel(payload, payload.fallbackModel, payload.fallbackReasoning || payload.reasoning, controller.signal);
    }
  } catch (error) {
    throw new Error(redactError(error));
  } finally {
    clearTimeout(timer);
  }
}
