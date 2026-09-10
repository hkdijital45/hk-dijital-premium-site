// Thin content-generation wrapper around the existing multi-provider
// dispatcher (src/lib/agent-providers.ts::runRealAgentProvider) — reused
// as-is rather than building a second AI client. Adds: (1) a preferred-
// provider order so Claude is used when ANTHROPIC_API_KEY is configured,
// falling back through the existing HK AI Smart Router (Gemini, the actual
// production provider) rather than straight to the demo/local fallback;
// (2) strict JSON-schema parsing so free-form AI output is never trusted
// directly for DB writes or publishing; (3) an explicit allowRuntimeAi gate
// — this is the ONE thing every call site must pass, and it must be false
// whenever app_settings.ai_operating_mode isn't "optional_api_ai" (see
// readiness.ts / orchestrator.ts), so daily autonomous execution can never
// silently reach a paid provider.
import { runRealAgentProvider, type AgentProviderResult } from "@/lib/agent-providers";
import type { AgentProviderKey } from "@/lib/agent-hub";
import type { AgentTaskType } from "@/lib/agent-hub";
import type { HKOutputSize, HKRouteComplexity } from "@/lib/hk-ai-router";
import type { SocialAiProviderPreference } from "./types";

export type SocialGenerationRequest = {
  action: string;
  systemPrompt: string;
  prompt: string;
  taskType?: AgentTaskType;
  preference?: SocialAiProviderPreference;
  complexity?: HKRouteComplexity;
  expectedOutputSize?: HKOutputSize;
  timeoutMs?: number;
};

export type SocialGenerationOutcome = AgentProviderResult & { providersAttempted: AgentProviderKey[] };

function providerOrder(preference: SocialAiProviderPreference = "auto"): AgentProviderKey[] {
  const claudeConfigured = Boolean(process.env.ANTHROPIC_API_KEY);
  if (preference === "gemini") return ["gemini"];
  if (preference === "anthropic") return claudeConfigured ? ["anthropic", "gemini"] : ["gemini"];
  return claudeConfigured ? ["anthropic", "gemini"] : ["gemini"];
}

/** Calls the preferred provider(s) in order, stopping at the first real
 * (non-demo) success. Only returns a demo result if every real provider in
 * the order failed — callers should treat a demo result as "AI unavailable"
 * and route the content item to NEEDS_REVIEW rather than publish it.
 *
 * `allowRuntimeAi` gates this before anything else happens (no provider
 * resolution, no network call) — every caller computes it from
 * app_settings.ai_operating_mode and must pass it through explicitly. */
export async function generateSocialContent(request: SocialGenerationRequest & { allowRuntimeAi: boolean }): Promise<SocialGenerationOutcome> {
  if (!request.allowRuntimeAi) {
    throw new Error("Runtime AI çağrıları bu modda devre dışı (ai_operating_mode CLAUDE_CODE_ASSISTED veya NO_RUNTIME_AI iken hiçbir AI sağlayıcısı çağrılmaz).");
  }
  const order = providerOrder(request.preference);
  const attempted: AgentProviderKey[] = [];
  let lastResult: AgentProviderResult | null = null;

  for (const provider of order) {
    attempted.push(provider);
    const result = await runRealAgentProvider({
      provider,
      taskType: request.taskType || "content_generation",
      prompt: request.prompt,
      systemPrompt: request.systemPrompt,
      action: request.action,
      complexity: request.complexity || "normal",
      expectedOutputSize: request.expectedOutputSize || "medium",
      timeoutMs: request.timeoutMs
    });
    lastResult = result;
    if (result.provider !== "demo") return { ...result, providersAttempted: attempted };
  }

  return { ...(lastResult as AgentProviderResult), providersAttempted: attempted };
}

/** Strips markdown code fences AI models routinely wrap JSON in, then
 * parses and validates with the caller's guard. Throws (never returns
 * partial/untyped data) so the caller's retry loop can regenerate. */
export function parseStructuredJson<T>(rawText: string, validate: (value: unknown) => value is T): T {
  const stripped = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const firstBrace = stripped.indexOf("{");
  const firstBracket = stripped.indexOf("[");
  const start = firstBrace === -1 ? firstBracket : firstBracket === -1 ? firstBrace : Math.min(firstBrace, firstBracket);
  const candidate = start > 0 ? stripped.slice(start) : stripped;

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    throw new Error("AI yanıtı geçerli JSON değil — yeniden üretim gerekiyor.");
  }
  if (!validate(parsed)) {
    throw new Error("AI yanıtı beklenen şemaya uymuyor — yeniden üretim gerekiyor.");
  }
  return parsed;
}
