import { getSiteContent } from "./content";

export type AiProviderKey = "automatic" | "auto" | "openai" | "groq" | "gemini" | "anthropic" | "manus" | "openrouter" | "demo" | "local" | "ollama";

type AiSettings = {
  activeProvider?: string;
  active_ai_provider?: string;
  model?: string;
  active_ai_model?: string;
  demoMode?: boolean;
  ai_mode?: string;
  ai_provider_priority?: string[] | string;
};

const providerLabels: Record<AiProviderKey, string> = {
  automatic: "Auto AI Router / Otomatik Seçim",
  auto: "Auto AI Router / Otomatik Seçim",
  openai: "OpenAI / ChatGPT",
  groq: "Groq",
  gemini: "Google Gemini",
  anthropic: "Anthropic / Claude",
  manus: "Manus AI",
  openrouter: "OpenRouter",
  demo: "Demo / Yerel Yedek Akış",
  local: "Ollama / Yerel Model",
  ollama: "Ollama / Yerel Model"
};

const defaultModels: Record<AiProviderKey, string> = {
  automatic: "automatic-fallback",
  auto: "automatic-fallback",
  openai: process.env.OPENAI_MODEL || "gpt-4.1-mini",
  groq: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
  gemini: process.env.GEMINI_MODEL || "gemini-2.0-flash",
  anthropic: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest",
  manus: "manus-deep-research",
  openrouter: process.env.OPENROUTER_MODEL || "openrouter/auto",
  demo: "demo-local",
  local: process.env.OLLAMA_MODEL || "local-rules",
  ollama: process.env.OLLAMA_MODEL || "local-rules"
};

export const defaultAiProviderPriority: AiProviderKey[] = ["gemini", "openai", "anthropic", "groq", "openrouter", "demo", "local"];

export const professionalAiInstruction =
  "Analyze and provide recommendations as a senior digital marketing consultant, social media strategist, media buyer, growth marketer, agency owner, and business development expert. Focus on practical actions, conversion optimization, lead generation, funnel strategy, advertising opportunities, customer psychology, positioning, branding, realistic growth recommendations, expectation management, and client communication.";

export function normalizeAiProvider(value?: string | null, demoMode = false): AiProviderKey {
  const normalized = String(value || "").toLocaleLowerCase("tr").trim();
  if (["automatic", "auto", "otomatik", "auto ai router", "auto ai router / otomatik seçim"].includes(normalized)) return "automatic";
  if (["openai", "open ai", "chatgpt", "openai / chatgpt"].includes(normalized)) return "openai";
  if (normalized === "groq") return "groq";
  if (["gemini", "google gemini"].includes(normalized)) return "gemini";
  if (["anthropic", "claude", "anthropic / claude"].includes(normalized)) return "anthropic";
  if (["manus", "manus ai"].includes(normalized)) return "manus";
  if (normalized === "openrouter") return "openrouter";
  if (["demo", "demo mode", "demo modu", "demo / yerel yedek akış"].includes(normalized)) return "demo";
  if (["local", "local mode", "yerel", "yerel mod", "ollama", "ollama / yerel model"].includes(normalized)) return "local";
  return demoMode ? "demo" : "automatic";
}

function normalizePriority(value?: string[] | string): AiProviderKey[] {
  const raw = Array.isArray(value) ? value : String(value || "").split(",");
  const normalized = raw.map((item) => normalizeAiProvider(item)).filter((item) => item !== "automatic");
  return [...new Set([...normalized, ...defaultAiProviderPriority])];
}

function configuredProvider(settings: AiSettings = {}) {
  const primary = normalizeAiProvider(settings.active_ai_provider, settings.demoMode);
  const legacy = normalizeAiProvider(settings.activeProvider, settings.demoMode);
  if (primary === "automatic" && legacy !== "automatic" && settings.active_ai_provider && settings.active_ai_provider !== "automatic") return legacy;
  if (["demo", "local"].includes(primary) && ["openai", "groq", "gemini", "anthropic", "openrouter"].includes(legacy) && !settings.demoMode) return legacy;
  return settings.active_ai_provider || settings.activeProvider || "automatic";
}

export function aiMetadata(provider: AiProviderKey, model?: string) {
  const isDemo = provider === "demo";
  const normalizedProvider = provider === "auto" ? "automatic" : provider === "ollama" ? "local" : provider;
  const isLocal = normalizedProvider === "local";
  const mode = isLocal ? "Yerel" : isDemo ? "Demo" : normalizedProvider === "automatic" ? "Otomatik" : "Canlı";
  const label = providerLabels[normalizedProvider];
  return {
    provider: label,
    providerKey: normalizedProvider,
    model: model || defaultModels[normalizedProvider],
    mode,
    isDemo,
    isLocal,
    badge: `${label} ile üretildi`
  };
}

export function aiSettingsMetadata(settings: AiSettings = {}) {
  const provider = normalizeAiProvider(configuredProvider(settings), settings.demoMode);
  const model = settings.active_ai_model || settings.model || defaultModels[provider];
  return aiMetadata(provider, model === "demo-local" && provider !== "demo" ? defaultModels[provider] : model);
}

export function aiSettingsForProviderChoice(choice?: string | null): AiSettings | undefined {
  const provider = normalizeAiProvider(choice || "automatic");
  if (provider === "automatic") return { active_ai_provider: "automatic", activeProvider: "automatic", demoMode: false, ai_provider_priority: defaultAiProviderPriority };
  if (provider === "demo") return { active_ai_provider: "demo", activeProvider: "demo", demoMode: true, ai_mode: "demo", active_ai_model: defaultModels.demo, model: defaultModels.demo };
  if (provider === "local") return { active_ai_provider: "local", activeProvider: "local", demoMode: false, ai_mode: "local", active_ai_model: defaultModels.local, model: defaultModels.local };
  if (["anthropic", "manus", "openrouter"].includes(provider)) return { active_ai_provider: provider, activeProvider: provider, demoMode: false, ai_mode: "live", active_ai_model: defaultModels[provider], model: defaultModels[provider] };
  return { active_ai_provider: provider, activeProvider: provider, demoMode: false, ai_mode: "live", active_ai_model: defaultModels[provider], model: defaultModels[provider] };
}

export async function getAiRuntimeSettings() {
  const content = await getSiteContent();
  return content.settings.api as AiSettings;
}

async function requestOpenAi(prompt: string, model: string) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OpenAI API anahtarı eksik.");
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], temperature: 0.35 })
  });
  if (!response.ok) throw new Error(`OpenAI yanıt vermedi (${response.status}).`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

async function requestGroq(prompt: string, model: string) {
  if (!process.env.GROQ_API_KEY) throw new Error("Groq API anahtarı eksik.");
  const fallbackModel = process.env.GROQ_FALLBACK_MODEL || "llama-3.1-8b-instant";
  const modelsToTry = [...new Set([model || defaultModels.groq, fallbackModel])];
  let lastError = "";

  for (const modelToTry of modelsToTry) {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: modelToTry, messages: [{ role: "user", content: prompt }], temperature: 0.35 })
    });
    if (response.ok) {
      const data = await response.json();
      return { text: data.choices?.[0]?.message?.content || "", model: modelToTry };
    }
    lastError = `Groq yanıt vermedi (${response.status}).`;
  }

  throw new Error(lastError || "Groq yanıt vermedi.");
}

async function requestGemini(prompt: string, model: string) {
  if (!process.env.GEMINI_API_KEY) throw new Error("Gemini API anahtarı eksik.");
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
  });
  if (!response.ok) throw new Error(`Gemini yanıt vermedi (${response.status}).`);
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function generateWithProvider(provider: AiProviderKey, prompt: string, fallbackText: string, configuredModel?: string) {
  const startedAt = Date.now();
  const normalizedProvider = normalizeAiProvider(provider);
  const model = configuredModel && configuredModel !== "demo-local" ? configuredModel : defaultModels[normalizedProvider];
  const withTiming = <T extends ReturnType<typeof aiMetadata> & { text: string }>(result: T) => ({ ...result, responseTimeMs: Date.now() - startedAt });
  if (normalizedProvider === "openai") return withTiming({ text: await requestOpenAi(prompt, model), ...aiMetadata(normalizedProvider, model) });
  if (normalizedProvider === "groq") {
    const result = await requestGroq(prompt, model);
    return withTiming({ text: result.text, ...aiMetadata(normalizedProvider, result.model) });
  }
  if (normalizedProvider === "gemini") return withTiming({ text: await requestGemini(prompt, model), ...aiMetadata(normalizedProvider, model) });
  if (["anthropic", "manus", "openrouter"].includes(normalizedProvider)) return withTiming({ text: fallbackText, ...aiMetadata(normalizedProvider, model) });
  if (normalizedProvider === "local") return withTiming({ text: fallbackText, ...aiMetadata("local", defaultModels.local) });
  return withTiming({ text: fallbackText, ...aiMetadata("demo", defaultModels.demo) });
}

export async function generateAiText(prompt: string, fallbackText: string, settings?: AiSettings) {
  const runtimeSettings = settings || await getAiRuntimeSettings();
  const selected = normalizeAiProvider(configuredProvider(runtimeSettings), runtimeSettings.demoMode);
  const model = runtimeSettings.active_ai_model || runtimeSettings.model;
  const professionalPrompt = `${professionalAiInstruction}\n\n${prompt}`;

  if (selected !== "automatic") {
    try {
      return await generateWithProvider(selected, professionalPrompt, fallbackText, model);
    } catch (error) {
      throw new Error(`Seçilen AI sağlayıcısı kullanılamadı. Lütfen API ayarlarını kontrol edin. ${error instanceof Error ? error.message : ""}`.trim());
    }
  }

  for (const provider of normalizePriority(runtimeSettings.ai_provider_priority)) {
    try {
      const result = await generateWithProvider(provider, professionalPrompt, fallbackText, provider === "demo" || provider === "local" ? undefined : model);
      if (result.text) return result;
    } catch (error) {
      console.error(`[ai-provider] ${providerLabels[provider]} sağlayıcısı atlandı`, error instanceof Error ? error.message : error);
    }
  }

  return { text: fallbackText, ...aiMetadata("local", defaultModels.local) };
}
