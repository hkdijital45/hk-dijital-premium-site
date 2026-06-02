import { getSiteContent } from "./content";

export type AiProviderKey = "automatic" | "openai" | "groq" | "gemini" | "demo" | "local";

type AiSettings = {
  activeProvider?: string;
  active_ai_provider?: string;
  model?: string;
  active_ai_model?: string;
  demoMode?: boolean;
  ai_mode?: string;
};

const providerLabels: Record<AiProviderKey, string> = {
  automatic: "Otomatik",
  openai: "OpenAI",
  groq: "Groq",
  gemini: "Gemini",
  demo: "Demo Modu",
  local: "Yerel Mod"
};

const defaultModels: Record<AiProviderKey, string> = {
  automatic: "automatic-fallback",
  openai: process.env.OPENAI_MODEL || "gpt-4.1-mini",
  groq: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
  gemini: process.env.GEMINI_MODEL || "gemini-2.0-flash",
  demo: "demo-local",
  local: "local-rules"
};

export function normalizeAiProvider(value?: string | null, demoMode = false): AiProviderKey {
  const normalized = String(value || "").toLocaleLowerCase("tr").trim();
  if (["automatic", "auto", "otomatik"].includes(normalized)) return "automatic";
  if (["openai", "open ai"].includes(normalized)) return "openai";
  if (normalized === "groq") return "groq";
  if (normalized === "gemini") return "gemini";
  if (["demo", "demo mode", "demo modu"].includes(normalized)) return "demo";
  if (["local", "local mode", "yerel", "yerel mod"].includes(normalized)) return "local";
  return demoMode ? "demo" : "automatic";
}

export function aiMetadata(provider: AiProviderKey, model?: string) {
  const isDemo = provider === "demo";
  const isLocal = provider === "local";
  const mode = isLocal ? "Yerel" : isDemo ? "Demo" : "Canlı";
  const label = providerLabels[provider];
  return {
    provider: label,
    providerKey: provider,
    model: model || defaultModels[provider],
    mode,
    isDemo,
    isLocal,
    badge: `${label} ile üretildi`
  };
}

export function aiSettingsMetadata(settings: AiSettings = {}) {
  const provider = normalizeAiProvider(settings.active_ai_provider || settings.activeProvider, settings.demoMode);
  const model = settings.active_ai_model || settings.model || defaultModels[provider];
  return aiMetadata(provider, model === "demo-local" && provider !== "demo" ? defaultModels[provider] : model);
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
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], temperature: 0.35 })
  });
  if (!response.ok) throw new Error(`Groq yanıt vermedi (${response.status}).`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
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
  const model = configuredModel && configuredModel !== "demo-local" ? configuredModel : defaultModels[provider];
  if (provider === "openai") return { text: await requestOpenAi(prompt, model), ...aiMetadata(provider, model) };
  if (provider === "groq") return { text: await requestGroq(prompt, model), ...aiMetadata(provider, model) };
  if (provider === "gemini") return { text: await requestGemini(prompt, model), ...aiMetadata(provider, model) };
  if (provider === "local") return { text: fallbackText, ...aiMetadata("local", defaultModels.local) };
  return { text: fallbackText, ...aiMetadata("demo", defaultModels.demo) };
}

export async function generateAiText(prompt: string, fallbackText: string, settings?: AiSettings) {
  const runtimeSettings = settings || await getAiRuntimeSettings();
  const selected = normalizeAiProvider(runtimeSettings.active_ai_provider || runtimeSettings.activeProvider, runtimeSettings.demoMode);
  const model = runtimeSettings.active_ai_model || runtimeSettings.model;

  if (selected !== "automatic") {
    try {
      return await generateWithProvider(selected, prompt, fallbackText, model);
    } catch (error) {
      throw new Error(`Seçilen AI sağlayıcısı kullanılamadı. Lütfen API ayarlarını kontrol edin. ${error instanceof Error ? error.message : ""}`.trim());
    }
  }

  for (const provider of ["openai", "groq", "gemini", "demo", "local"] as AiProviderKey[]) {
    try {
      const result = await generateWithProvider(provider, prompt, fallbackText, provider === "demo" || provider === "local" ? undefined : model);
      if (result.text) return result;
    } catch (error) {
      console.error(`[ai-provider] ${providerLabels[provider]} sağlayıcısı atlandı`, error instanceof Error ? error.message : error);
    }
  }

  return { text: fallbackText, ...aiMetadata("local", defaultModels.local) };
}
