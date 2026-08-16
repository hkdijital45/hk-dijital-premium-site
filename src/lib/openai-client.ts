import "server-only";

import OpenAI from "openai";
import type { HKAIModel, HKReasoningEffort } from "@/lib/hk-ai-router";

// Single, centralized OpenAI Responses API integration point — every HK AI
// call in production goes through callOpenAiResponses(). OPENAI_API_KEY is
// read here only (server-only import above enforces this can never end up
// in a client bundle), never logged, never echoed in a response body.

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) throw new Error("OpenAI API anahtarı yapılandırılmadı.");
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

export type OpenAiResponsesResult = {
  text: string;
  model: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  totalTokens: number;
  responseMs: number;
};

export type OpenAiResponsesRequest = {
  model: HKAIModel;
  /** Stable developer/system instructions — kept first in the request so
   * OpenAI's prompt caching can key off it across repeated calls (spec
   * section 15). Never randomize this per request. */
  instructions: string;
  /** Dynamic, per-request user/customer content — kept last. */
  input: string;
  reasoning: HKReasoningEffort;
  maxOutputTokens: number;
  allowWeb: boolean;
  timeoutMs: number;
};

function isRetryableStatus(status: number | undefined) {
  return status === 429 || (typeof status === "number" && status >= 500 && status < 600);
}

function redactError(error: unknown): string {
  const message = error instanceof Error ? error.message : "OpenAI sağlayıcı hatası";
  return message
    .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .slice(0, 400);
}

async function once(payload: OpenAiResponsesRequest, signal: AbortSignal): Promise<OpenAiResponsesResult> {
  const started = Date.now();
  const openai = getClient();
  // reasoning "none" maps to omitting the parameter entirely — Luna's
  // lightest jobs don't pay for any reasoning tokens at all.
  const reasoning = payload.reasoning === "none" ? undefined : { effort: payload.reasoning };
  const response = await openai.responses.create(
    {
      model: payload.model,
      instructions: payload.instructions,
      input: payload.input,
      max_output_tokens: payload.maxOutputTokens,
      ...(reasoning ? { reasoning } : {}),
      ...(payload.allowWeb ? { tools: [{ type: "web_search" }] } : {})
    },
    { signal }
  );

  const text = response.output_text || "";
  const usage = response.usage;
  return {
    text,
    model: response.model || payload.model,
    inputTokens: usage?.input_tokens || 0,
    cachedInputTokens: usage?.input_tokens_details?.cached_tokens || 0,
    outputTokens: usage?.output_tokens || 0,
    totalTokens: usage?.total_tokens || 0,
    responseMs: Date.now() - started
  };
}

/**
 * Calls the OpenAI Responses API with a single, controlled retry for
 * transient failures (429 / 5xx / network) — never for auth or validation
 * errors — and a hard timeout so a stuck request can't hang the UI (spec
 * sections 17–18). Retry uses a short fixed backoff, not an open loop.
 */
export async function callOpenAiResponses(payload: OpenAiResponsesRequest): Promise<OpenAiResponsesResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), payload.timeoutMs);
  try {
    try {
      return await once(payload, controller.signal);
    } catch (error) {
      const status = error instanceof OpenAI.APIError ? error.status : undefined;
      const isAbort = error instanceof Error && error.name === "AbortError";
      if (isAbort || !isRetryableStatus(status)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500));
      return await once(payload, controller.signal);
    }
  } catch (error) {
    throw new Error(redactError(error));
  } finally {
    clearTimeout(timer);
  }
}
