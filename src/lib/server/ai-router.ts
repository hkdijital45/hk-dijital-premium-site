import "server-only";

import { createHash } from "crypto";
import { createAgentRunLog, getAgentProviders, type AgentProviderKey, type AgentTaskType } from "@/lib/agent-hub";
import { runRealAgentProvider } from "@/lib/agent-providers";
import {
  classifyAiTask,
  buildProviderOrder,
  intelligenceTaskToAgentTask,
  type IntelligenceProviderKey,
  type IntelligenceTaskType
} from "@/lib/ai-task-routing";
import type { HKOutputSize, HKRouteComplexity } from "@/lib/hk-ai-router";
import { getSiteContent } from "@/lib/content";
import type { ProviderFailure } from "@/lib/discovery-report-schema";

export { classifyAiTask } from "@/lib/ai-task-routing";
export type { IntelligenceProviderKey, IntelligenceTaskType } from "@/lib/ai-task-routing";

type ProviderHealthStatus = "available" | "degraded" | "unavailable" | "missing_configuration";
type HealthState = { failures: number; lastFailureAt: number; lastSuccessAt: number; lastError?: string };

export type AiRouterInput = {
  taskType?: IntelligenceTaskType | string;
  module?: string;
  endpoint?: string;
  prompt: string;
  expectedOutput?: string;
  systemPrompt?: string;
  fallbackText: string;
  customerId?: string | null;
  createdBy?: string | null;
  // Optional HK AI Smart Router signals — consulted only for the Gemini/
  // OpenAI smart-routed provider paths (src/lib/hk-ai-router.ts). Callers
  // that don't know these yet can omit them entirely; the router falls back
  // to safe defaults.
  action?: string;
  complexity?: HKRouteComplexity;
  multiStep?: boolean;
  needsWeb?: boolean;
  hasFiles?: boolean;
  toolCount?: number;
  expectedOutputSize?: HKOutputSize;
};

export type AiRouterOptions = {
  requestedProvider?: IntelligenceProviderKey | "auto";
  timeoutMs?: number;
  cacheTtlMs?: number;
  recordExecution?: boolean;
};

export type AiRouterResult = {
  text: string;
  taskType: IntelligenceTaskType;
  provider: IntelligenceProviderKey;
  providerLabel: string;
  model: string;
  mode: "Canlı" | "Yerel" | "Demo";
  fallbackUsed: boolean;
  providerChain: IntelligenceProviderKey[];
  notice: string | null;
  responseTimeMs: number;
  tokensUsed: number;
  // Safe, non-leaking per-provider failure classification (see
  // discovery-report-schema.ts) — lets callers build a differentiated,
  // secret-safe user-facing message instead of one generic string.
  failureDetails: ProviderFailure[];
  // Populated for real Gemini/OpenAI smart-routed calls only.
  reasoningEffort?: string;
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
  thinkingTokens?: number;
};

const health = new Map<IntelligenceProviderKey, HealthState>();
const responseCache = new Map<string, { expiresAt: number; result: AiRouterResult }>();
const pendingRequests = new Map<string, Promise<AiRouterResult>>();

// Minimal in-memory sliding-window rate limit per caller (spec section 28) —
// protects against unauthenticated abuse and a single user firing dozens of
// concurrent AI requests, without a new dependency. Deliberately generous so
// legitimate customer usage isn't throttled; double-submit is separately
// handled by the pendingRequests dedup above.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;
const rateLimitHits = new Map<string, number[]>();

function checkRateLimit(key: string) {
  const now = Date.now();
  const hits = (rateLimitHits.get(key) || []).filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
  if (hits.length >= RATE_LIMIT_MAX_REQUESTS) {
    rateLimitHits.set(key, hits);
    return false;
  }
  hits.push(now);
  rateLimitHits.set(key, hits);
  return true;
}

const providerLabels: Record<IntelligenceProviderKey, string> = {
  gemini: "Araştırma ve Google Analiz Motoru",
  groq: "Hızlı İçerik Motoru",
  openai: "Strateji Motoru",
  anthropic: "Uzun Doküman Motoru",
  manus: "Derin Araştırma Ajanı",
  openrouter: "Alternatif Model Geçidi",
  ollama: "Yerel Yedek",
  demo: "Demo / Yerel Yedek"
};

function sanitizeText(value: unknown, maxLength = 50_000) {
  return String(value || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function sanitizeAiInput(input: AiRouterInput): AiRouterInput {
  return {
    ...input,
    module: sanitizeText(input.module, 100),
    endpoint: sanitizeText(input.endpoint, 180),
    prompt: sanitizeText(input.prompt),
    expectedOutput: sanitizeText(input.expectedOutput, 500),
    systemPrompt: sanitizeText(input.systemPrompt, 8_000),
    fallbackText: sanitizeText(input.fallbackText, 20_000)
  };
}

function configuredByEnvironment(provider: IntelligenceProviderKey) {
  if (provider === "demo") return true;
  if (provider === "gemini") return Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  if (provider === "groq") return Boolean(process.env.GROQ_API_KEY);
  if (provider === "openai") return Boolean(process.env.OPENAI_API_KEY);
  if (provider === "anthropic") return Boolean(process.env.ANTHROPIC_API_KEY);
  if (provider === "openrouter") return Boolean(process.env.OPENROUTER_API_KEY);
  if (provider === "ollama") return Boolean(process.env.OLLAMA_BASE_URL);
  return Boolean(process.env.MANUS_API_KEY && process.env.MANUS_API_BASE_URL && process.env.MANUS_API_ENDPOINT);
}

function healthStatus(provider: IntelligenceProviderKey, configured: boolean): ProviderHealthStatus {
  if (!configured) return "missing_configuration";
  const state = health.get(provider);
  if (!state?.failures) return "available";
  if (state.failures >= 3 && Date.now() - state.lastFailureAt < 5 * 60_000) return "unavailable";
  return "degraded";
}

export async function getProviderAvailability() {
  const providers = await getAgentProviders();
  const knownProviders = new Set<IntelligenceProviderKey>(Object.keys(providerLabels) as IntelligenceProviderKey[]);
  return providers.filter((provider) => knownProviders.has(provider.provider_key as IntelligenceProviderKey)).map((provider) => {
    const key = provider.provider_key as IntelligenceProviderKey;
    const configured = configuredByEnvironment(key);
    const disabled = provider.status === "passive";
    return {
      provider: key,
      label: providerLabels[key],
      configured,
      enabled: !disabled,
      status: disabled ? "unavailable" as const : healthStatus(key, configured),
      model: provider.default_model || null,
      lastSuccessAt: health.get(key)?.lastSuccessAt || null,
      lastError: health.get(key)?.lastError || null
    };
  });
}

function normalizePriority(value: unknown): IntelligenceProviderKey[] {
  const allowed = new Set<IntelligenceProviderKey>(["gemini", "groq", "openai", "anthropic", "manus", "openrouter", "ollama", "demo"]);
  const list = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(list.map((item) => String(item) === "local" ? "ollama" : String(item)).filter((item): item is IntelligenceProviderKey => allowed.has(item as IntelligenceProviderKey)))];
}

export async function selectAiProvider(task: IntelligenceTaskType, options: AiRouterOptions = {}) {
  const content = await getSiteContent();
  const settings = content.settings.api || {};
  const configuredMode = String(settings.active_ai_provider || settings.activeProvider || "automatic").toLocaleLowerCase("tr");
  const requested = options.requestedProvider && options.requestedProvider !== "auto"
    ? options.requestedProvider
    : configuredMode !== "automatic" && configuredMode !== "auto"
      ? (configuredMode === "local" ? "ollama" : configuredMode) as IntelligenceProviderKey
      : null;
  const customFallback = normalizePriority(settings.ai_provider_priority);
  const order = buildProviderOrder(task, {
    requestedProvider: requested,
    customFallback,
    demoOnly: String(settings.ai_mode || "").toLocaleLowerCase("tr") === "demo"
  });
  const availability = await getProviderAvailability();
  const selected = order.find((key) => {
    const item = availability.find((candidate) => candidate.provider === key);
    return item?.enabled && !["unavailable", "missing_configuration"].includes(item.status);
  }) || "demo";
  return { selected, order, availability, requested };
}

function cacheKey(input: AiRouterInput, options: AiRouterOptions) {
  return createHash("sha256").update(JSON.stringify({
    taskType: input.taskType,
    module: input.module,
    prompt: input.prompt,
    expectedOutput: input.expectedOutput,
    requestedProvider: options.requestedProvider || "auto"
  })).digest("hex");
}

function markFailure(provider: IntelligenceProviderKey, message?: string) {
  const previous = health.get(provider);
  health.set(provider, {
    failures: (previous?.failures || 0) + 1,
    lastFailureAt: Date.now(),
    lastSuccessAt: previous?.lastSuccessAt || 0,
    lastError: sanitizeText(message, 240) || "Sağlayıcı yanıt vermedi."
  });
}

function markSuccess(provider: IntelligenceProviderKey) {
  health.set(provider, { failures: 0, lastFailureAt: 0, lastSuccessAt: Date.now() });
}

export async function executeWithFallback(input: AiRouterInput, options: AiRouterOptions = {}): Promise<AiRouterResult> {
  const startedAt = Date.now();
  const taskType = classifyAiTask(input);
  const selection = await selectAiProvider(taskType, options);
  const providerRows = await getAgentProviders();
  const attempted: IntelligenceProviderKey[] = [];
  const failures: string[] = [];
  const failureDetails: ProviderFailure[] = [];

  let liveAttempts = 0;
  for (const provider of selection.order) {
    const availability = selection.availability.find((item) => item.provider === provider);
    if (provider !== "demo" && (!availability?.enabled || ["unavailable", "missing_configuration"].includes(availability.status))) {
      if (!availability?.configured) {
        failureDetails.push({ provider: providerLabels[provider], category: "missing_configuration" });
      }
      continue;
    }
    if (provider !== "demo" && liveAttempts >= 5) continue;
    attempted.push(provider);
    if (provider === "demo") break;
    liveAttempts += 1;

    const providerRow = providerRows.find((item) => item.provider_key === provider);
    const manusTimeout = Math.max(45_000, Math.min(Number(process.env.MANUS_TIMEOUT_MS || 60_000), Number(process.env.MANUS_MAX_TASK_MS || 120_000)));
    const result = await runRealAgentProvider({
      provider: provider as AgentProviderKey,
      taskType: intelligenceTaskToAgentTask(taskType) as AgentTaskType,
      prompt: input.prompt,
      systemPrompt: input.systemPrompt || "Türkçe, güvenli, ölçülü ve uygulanabilir bir HK Dijital çıktısı üret. Kesin sonuç garantisi verme.",
      model: providerRow?.default_model,
      // For the smart-routed providers (Gemini production, OpenAI rollback),
      // an explicit caller timeout wins, otherwise leave it unset so the HK
      // AI Router's own per-tier default applies (FAST gets a shorter
      // timeout than POWERFUL). Other providers keep the previous flat default.
      timeoutMs: provider === "manus"
        ? Math.max(options.timeoutMs || manusTimeout, 45_000)
        : provider === "gemini" || provider === "openai" ? options.timeoutMs : options.timeoutMs || 24_000,
      action: input.action,
      complexity: input.complexity,
      multiStep: input.multiStep,
      needsWeb: input.needsWeb,
      hasFiles: input.hasFiles,
      toolCount: input.toolCount,
      expectedOutputSize: input.expectedOutputSize
    });
    if (result.usedFallback) {
      markFailure(provider, result.errorMessage);
      failures.push(`${providerLabels[provider]} yanıt vermedi`);
      failureDetails.push({ provider: providerLabels[provider], category: result.errorCategory || "provider_error" });
      // Structured, secret-safe: category + redacted message only, never
      // the raw provider error/response body or any credential.
      console.error(`[HK-AI] provider=${provider} category=${result.errorCategory || "provider_error"} module=${input.module || "-"} reason=${result.errorMessage}`);
      continue;
    }

    markSuccess(provider);
    return {
      text: result.text,
      taskType,
      provider,
      providerLabel: providerLabels[provider],
      model: result.model,
      mode: provider === "ollama" ? "Yerel" : "Canlı",
      fallbackUsed: attempted.length > 1 || Boolean(selection.requested && selection.requested !== provider),
      providerChain: attempted,
      notice: attempted.length > 1 ? `${providerLabels[attempted[0]]} yanıt vermedi, ${providerLabels[provider]} ile devam edildi.` : null,
      responseTimeMs: Date.now() - startedAt,
      tokensUsed: result.tokensUsed,
      failureDetails,
      reasoningEffort: result.reasoningEffort,
      inputTokens: result.inputTokens,
      cachedInputTokens: result.cachedInputTokens,
      outputTokens: result.outputTokens,
      thinkingTokens: result.thinkingTokens
    };
  }

  return {
    text: input.fallbackText,
    taskType,
    provider: "demo",
    providerLabel: providerLabels.demo,
    model: "local-rules",
    mode: "Demo",
    fallbackUsed: true,
    providerChain: attempted.includes("demo") ? attempted : [...attempted, "demo"],
    failureDetails,
    notice: failures.length ? "Canlı sağlayıcılar kullanılamadı; güvenli yerel yedek kullanıldı." : "Canlı sağlayıcı yapılandırılmadı; güvenli yerel yedek kullanıldı.",
    responseTimeMs: Date.now() - startedAt,
    tokensUsed: 0
  };
}

export function normalizeAiResponse(result: AiRouterResult) {
  return {
    ...result,
    providerKey: result.provider,
    isDemo: result.provider === "demo",
    isLocal: result.provider === "ollama",
    badge: result.fallbackUsed ? "Yedek sağlayıcıyla tamamlandı" : `${result.providerLabel} ile tamamlandı`
  };
}

export async function recordAiExecution(input: AiRouterInput, result: AiRouterResult) {
  if (result.provider === "demo" && !input.createdBy && !input.customerId) return;
  await createAgentRunLog({
    customer_id: input.customerId || null,
    task_type: intelligenceTaskToAgentTask(result.taskType) as AgentTaskType,
    requested_provider: "auto",
    selected_provider: result.providerChain[0] || result.provider,
    actual_provider: result.provider,
    provider_mode: "intelligence_router",
    fallback_provider: result.fallbackUsed ? result.provider : null,
    status: result.fallbackUsed ? "completed_with_fallback" : "completed",
    input_summary: input.prompt.slice(0, 500),
    output_summary: result.text.slice(0, 700),
    response_ms: result.responseTimeMs,
    tokens_used: result.tokensUsed,
    created_by: input.createdBy || null,
    provider_chain: result.providerChain,
    completed_at: new Date().toISOString(),
    model: result.model || null,
    reasoning_effort: result.reasoningEffort || null,
    input_tokens: result.inputTokens ?? null,
    cached_input_tokens: result.cachedInputTokens ?? null,
    output_tokens: result.outputTokens ?? null,
    thinking_tokens: result.thinkingTokens ?? null,
    error_code: result.fallbackUsed ? "fallback" : null
  }).catch(() => null);
}

export async function executeAiTask(rawInput: AiRouterInput, options: AiRouterOptions = {}) {
  const input = sanitizeAiInput(rawInput);
  if (!input.prompt) throw new Error("Yapay zekâ görevi için açıklama gereklidir.");
  const rateLimitKey = input.createdBy || input.customerId || "anonymous";
  if (!checkRateLimit(rateLimitKey)) throw new Error("Çok fazla istek gönderildi. Lütfen birkaç saniye sonra tekrar deneyin.");
  const key = cacheKey(input, options);
  const cached = responseCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return normalizeAiResponse(cached.result);
  const pending = pendingRequests.get(key);
  if (pending) return normalizeAiResponse(await pending);

  const execution = executeWithFallback(input, options);
  pendingRequests.set(key, execution);
  try {
    const result = await execution;
    // A "demo" result means every real provider failed for this request —
    // caching that for the caller's full TTL (often minutes) would keep
    // serving the same stale failure long after a transient outage/rate
    // limit has cleared. Only successful, real-provider results get the
    // requested TTL; fallback results get a short window just long enough
    // to absorb an accidental rapid double-click.
    const ttl = result.provider === "demo" ? 10_000 : (options.cacheTtlMs ?? 5 * 60_000);
    responseCache.set(key, { expiresAt: Date.now() + ttl, result });
    if (options.recordExecution !== false) await recordAiExecution(input, result);
    return normalizeAiResponse(result);
  } finally {
    pendingRequests.delete(key);
  }
}

export async function getProviderHealthSummary() {
  const providers = await getProviderAvailability();
  return providers.map((provider) => ({
    ...provider,
    statusLabel: provider.status === "available" ? "Bağlantı Hazır" : provider.status === "degraded" ? "Geçici Sorun" : provider.status === "unavailable" ? "Devre Dışı" : "Yapılandırma Eksik"
  }));
}
