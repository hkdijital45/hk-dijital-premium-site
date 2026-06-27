import type { AgentProviderKey, AgentTaskType } from "@/lib/agent-hub";

export type AgentProviderPayload = {
  provider: AgentProviderKey;
  taskType: AgentTaskType;
  prompt: string;
  systemPrompt: string;
  model?: string | null;
  timeoutMs?: number;
};

export type AgentProviderResult = {
  provider: AgentProviderKey;
  model: string;
  text: string;
  tokensUsed: number;
  responseMs: number;
  usedFallback: boolean;
  errorMessage?: string;
};

const defaultModels: Record<AgentProviderKey, string> = {
  openai: process.env.OPENAI_MODEL || "gpt-4.1-mini",
  anthropic: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022",
  gemini: process.env.GEMINI_MODEL || "gemini-1.5-flash",
  groq: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
  manus: "manus-deep-research",
  openrouter: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
  ollama: process.env.OLLAMA_MODEL || "llama3.1",
  demo: "local-rules"
};

function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

function redactError(error: unknown) {
  const message = error instanceof Error ? error.message : "AI sağlayıcı hatası";
  return message
    .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .slice(0, 400);
}

async function fetchJson(url: string, init: RequestInit, timeoutMs = 22000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    let json: Record<string, unknown> = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { text };
    }
    if (!response.ok) {
      const error = typeof json.error === "object" && json.error && "message" in json.error
        ? String((json.error as { message?: string }).message || "Sağlayıcı isteği başarısız oldu.")
        : String(json.message || text || "Sağlayıcı isteği başarısız oldu.");
      throw new Error(error);
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

function buildDemoText(payload: AgentProviderPayload, reason = "API anahtarı yapılandırılmadı") {
  return [
    `${payload.taskType} görevi için güvenli demo/yedek akış kullanıldı.`,
    `Neden: ${reason}.`,
    "HK Intelligence çıktısı; satış garantisi vermez, riskleri ölçülü açıklar ve uygulanabilir 7 günlük aksiyon planı üretir.",
    `Görev özeti: ${payload.prompt.slice(0, 700)}`
  ].join("\n");
}

async function runOpenAICompatible(payload: AgentProviderPayload, config: { apiKey?: string; baseUrl: string; model: string; provider: AgentProviderKey; extraHeaders?: Record<string, string> }) {
  if (!config.apiKey) throw new Error("API anahtarı yapılandırılmadı");
  const started = Date.now();
  const json = await fetchJson(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      ...config.extraHeaders
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.3,
      messages: [
        { role: "system", content: payload.systemPrompt },
        { role: "user", content: payload.prompt }
      ]
    })
  }, payload.timeoutMs);
  const choices = Array.isArray(json.choices) ? json.choices : [];
  const first = choices[0] as { message?: { content?: string } } | undefined;
  const text = first?.message?.content || "Sağlayıcı boş yanıt döndürdü.";
  const usage = json.usage as { total_tokens?: number } | undefined;
  return {
    provider: config.provider,
    model: config.model,
    text,
    tokensUsed: Number(usage?.total_tokens || estimateTokens(`${payload.systemPrompt}\n${payload.prompt}\n${text}`)),
    responseMs: Date.now() - started,
    usedFallback: false
  };
}

async function runGemini(payload: AgentProviderPayload) {
  if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) throw new Error("Gemini API anahtarı yapılandırılmadı");
  const started = Date.now();
  const model = payload.model || defaultModels.gemini;
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const json = await fetchJson(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key || "")}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: payload.systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: payload.prompt }] }],
      generationConfig: { temperature: 0.3 }
    })
  }, payload.timeoutMs);
  const candidates = Array.isArray(json.candidates) ? json.candidates : [];
  const content = candidates[0] as { content?: { parts?: Array<{ text?: string }> } } | undefined;
  const text = content?.content?.parts?.map((part) => part.text || "").join("\n").trim() || "Gemini boş yanıt döndürdü.";
  return {
    provider: "gemini" as const,
    model,
    text,
    tokensUsed: estimateTokens(`${payload.systemPrompt}\n${payload.prompt}\n${text}`),
    responseMs: Date.now() - started,
    usedFallback: false
  };
}

async function runClaude(payload: AgentProviderPayload) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Claude API anahtarı yapılandırılmadı");
  const started = Date.now();
  const model = payload.model || defaultModels.anthropic;
  const json = await fetchJson("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model,
      max_tokens: 1800,
      temperature: 0.3,
      system: payload.systemPrompt,
      messages: [{ role: "user", content: payload.prompt }]
    })
  }, payload.timeoutMs);
  const content = Array.isArray(json.content) ? json.content : [];
  const text = content.map((item) => typeof item === "object" && item && "text" in item ? String((item as { text?: string }).text || "") : "").join("\n").trim() || "Claude boş yanıt döndürdü.";
  const usage = json.usage as { input_tokens?: number; output_tokens?: number } | undefined;
  return {
    provider: "anthropic" as const,
    model,
    text,
    tokensUsed: Number(usage?.input_tokens || 0) + Number(usage?.output_tokens || 0) || estimateTokens(`${payload.systemPrompt}\n${payload.prompt}\n${text}`),
    responseMs: Date.now() - started,
    usedFallback: false
  };
}

async function runManus(payload: AgentProviderPayload) {
  if (!process.env.MANUS_API_KEY) throw new Error("Manus API anahtarı yapılandırılmadı");
  if (!process.env.MANUS_API_BASE_URL || !process.env.MANUS_API_ENDPOINT) throw new Error("Manus API endpoint yapılandırması bekleniyor");
  const started = Date.now();
  const url = `${process.env.MANUS_API_BASE_URL.replace(/\/$/, "")}/${process.env.MANUS_API_ENDPOINT.replace(/^\//, "")}`;
  const json = await fetchJson(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.MANUS_API_KEY}`
    },
    body: JSON.stringify({
      model: payload.model || defaultModels.manus,
      task_type: payload.taskType,
      instructions: payload.systemPrompt,
      input: payload.prompt
    })
  }, Math.max(payload.timeoutMs || 22000, 45000));
  const text = String(json.output || json.text || json.result || json.summary || "Manus boş yanıt döndürdü.");
  return {
    provider: "manus" as const,
    model: payload.model || defaultModels.manus,
    text,
    tokensUsed: estimateTokens(`${payload.systemPrompt}\n${payload.prompt}\n${text}`),
    responseMs: Date.now() - started,
    usedFallback: false
  };
}

async function runOllama(payload: AgentProviderPayload) {
  if (!process.env.OLLAMA_BASE_URL) throw new Error("Ollama base URL yapılandırılmadı");
  const started = Date.now();
  const model = payload.model || defaultModels.ollama;
  const json = await fetchJson(`${process.env.OLLAMA_BASE_URL.replace(/\/$/, "")}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      prompt: `${payload.systemPrompt}\n\n${payload.prompt}`
    })
  }, payload.timeoutMs);
  const text = String(json.response || json.text || "Ollama boş yanıt döndürdü.");
  return {
    provider: "ollama" as const,
    model,
    text,
    tokensUsed: estimateTokens(`${payload.systemPrompt}\n${payload.prompt}\n${text}`),
    responseMs: Date.now() - started,
    usedFallback: false
  };
}

export async function runRealAgentProvider(payload: AgentProviderPayload): Promise<AgentProviderResult> {
  const started = Date.now();
  try {
    if (payload.provider === "openai") {
      return await runOpenAICompatible(payload, { provider: "openai", apiKey: process.env.OPENAI_API_KEY, baseUrl: "https://api.openai.com/v1", model: payload.model || defaultModels.openai });
    }
    if (payload.provider === "groq") {
      return await runOpenAICompatible(payload, { provider: "groq", apiKey: process.env.GROQ_API_KEY, baseUrl: "https://api.groq.com/openai/v1", model: payload.model || defaultModels.groq });
    }
    if (payload.provider === "openrouter") {
      return await runOpenAICompatible(payload, {
        provider: "openrouter",
        apiKey: process.env.OPENROUTER_API_KEY,
        baseUrl: "https://openrouter.ai/api/v1",
        model: payload.model || defaultModels.openrouter,
        extraHeaders: { "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://www.hkdijital.com.tr", "X-Title": "HK Agent Hub" }
      });
    }
    if (payload.provider === "gemini") return await runGemini(payload);
    if (payload.provider === "anthropic") return await runClaude(payload);
    if (payload.provider === "manus") return await runManus(payload);
    if (payload.provider === "ollama") return await runOllama(payload);
    throw new Error("Demo sağlayıcı seçildi");
  } catch (error) {
    const reason = redactError(error);
    return {
      provider: "demo",
      model: defaultModels.demo,
      text: buildDemoText(payload, reason),
      tokensUsed: estimateTokens(`${payload.systemPrompt}\n${payload.prompt}`),
      responseMs: Date.now() - started,
      usedFallback: true,
      errorMessage: reason
    };
  }
}
