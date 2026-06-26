import { generateAiText } from "@/lib/ai-provider";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

export type AgentProviderKey = "openai" | "anthropic" | "gemini" | "groq" | "manus" | "openrouter" | "ollama" | "demo";

export type AgentTaskType =
  | "ad_analysis"
  | "crm_summary"
  | "content_generation"
  | "seo_analysis"
  | "competitor_research"
  | "market_research"
  | "pricing_research"
  | "sector_discovery"
  | "deep_report"
  | "proposal_generation"
  | "customer_report"
  | "code_review"
  | "fast_answer"
  | "workflow_task";

export type AgentProviderStatus = "active" | "passive" | "error" | "not_configured";

export type AgentProvider = {
  provider_key: AgentProviderKey;
  provider_name: string;
  role_label?: string | null;
  status: AgentProviderStatus;
  default_model?: string | null;
  purpose?: string | null;
  daily_limit?: number | null;
  monthly_limit?: number | null;
  estimated_monthly_cost?: number | null;
  success_rate?: number | null;
  avg_response_ms?: number | null;
  last_used_at?: string | null;
  notes?: string | null;
  secret_mask?: string | null;
  configured?: boolean;
};

export type AgentRunInput = {
  customerId?: string | null;
  taskType: AgentTaskType;
  priority?: "düşük" | "normal" | "yüksek" | "kritik";
  requestedProvider?: AgentProviderKey | "auto";
  prompt: string;
  outputFormat?: string;
  createdBy?: string | null;
};

export const agentTaskLabels: Record<AgentTaskType, string> = {
  ad_analysis: "Reklam analizi",
  crm_summary: "CRM özeti",
  content_generation: "İçerik üretimi",
  seo_analysis: "SEO analizi",
  competitor_research: "Rakip araştırması",
  market_research: "Pazar araştırması",
  pricing_research: "Fiyat karşılaştırması",
  sector_discovery: "Yeni sektör keşfi",
  deep_report: "Kapsamlı rapor",
  proposal_generation: "Teklif üretimi",
  customer_report: "Müşteri raporu",
  code_review: "Kod inceleme",
  fast_answer: "Hızlı cevap",
  workflow_task: "Workflow görevi"
};

export const defaultAgentProviders: AgentProvider[] = [
  {
    provider_key: "openai",
    provider_name: "OpenAI / ChatGPT",
    role_label: "Günlük analiz ve raporlama",
    status: process.env.OPENAI_API_KEY ? "active" : "not_configured",
    default_model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    purpose: "Reklam yorumlama, CRM özeti, müşteri raporu ve genel analiz."
  },
  {
    provider_key: "anthropic",
    provider_name: "Anthropic / Claude",
    role_label: "Teklif ve uzun metin uzmanı",
    status: process.env.ANTHROPIC_API_KEY ? "active" : "not_configured",
    default_model: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet",
    purpose: "Teklif, müşteri raporu, uzun doküman ve kod inceleme."
  },
  {
    provider_key: "gemini",
    provider_name: "Google Gemini",
    role_label: "SEO ve çok yönlü analiz",
    status: process.env.GEMINI_API_KEY ? "active" : "not_configured",
    default_model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
    purpose: "SEO analizi, reklam yorumlama ve pazar sinyali özetleri."
  },
  {
    provider_key: "groq",
    provider_name: "Groq",
    role_label: "Hızlı cevap motoru",
    status: process.env.GROQ_API_KEY ? "active" : "not_configured",
    default_model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    purpose: "Kısa cevap, hızlı özet ve düşük gecikmeli görevler."
  },
  {
    provider_key: "manus",
    provider_name: "Manus AI",
    role_label: "Derin Araştırma Uzmanı",
    status: process.env.MANUS_API_KEY ? "active" : "not_configured",
    default_model: "manus-deep-research",
    purpose: "Rakip analizi, pazar araştırması, fiyat karşılaştırması, sektör keşfi ve kapsamlı rapor üretimi."
  },
  {
    provider_key: "openrouter",
    provider_name: "OpenRouter",
    role_label: "Alternatif model geçidi",
    status: process.env.OPENROUTER_API_KEY ? "active" : "not_configured",
    default_model: process.env.OPENROUTER_MODEL || "auto",
    purpose: "Alternatif model denemeleri ve yedek sağlayıcı akışı."
  },
  {
    provider_key: "ollama",
    provider_name: "Ollama",
    role_label: "Yerel model",
    status: process.env.OLLAMA_BASE_URL ? "active" : "not_configured",
    default_model: process.env.OLLAMA_MODEL || "local",
    purpose: "Yerel veya özel ağ içinde çalışan model fallback akışı."
  },
  {
    provider_key: "demo",
    provider_name: "Demo / Local fallback",
    role_label: "Güvenli fallback",
    status: "active",
    default_model: "local-rules",
    purpose: "API anahtarı yoksa Türkçe ve kural tabanlı güvenli çıktı üretir."
  }
];

const taskPriority: Record<AgentTaskType, AgentProviderKey[]> = {
  ad_analysis: ["openai", "gemini", "anthropic", "demo"],
  crm_summary: ["openai", "gemini", "groq", "demo"],
  content_generation: ["openai", "anthropic", "gemini", "demo"],
  seo_analysis: ["gemini", "openai", "demo"],
  competitor_research: ["manus", "gemini", "openai", "demo"],
  market_research: ["manus", "gemini", "openai", "demo"],
  pricing_research: ["manus", "gemini", "openai", "demo"],
  sector_discovery: ["manus", "gemini", "openai", "demo"],
  deep_report: ["manus", "anthropic", "openai", "demo"],
  proposal_generation: ["anthropic", "openai", "gemini", "demo"],
  customer_report: ["openai", "anthropic", "gemini", "demo"],
  code_review: ["anthropic", "openai", "demo"],
  fast_answer: ["groq", "openai", "gemini", "demo"],
  workflow_task: ["openai", "gemini", "anthropic", "demo"]
};

const envSecretKeys: Record<AgentProviderKey, string[]> = {
  openai: ["OPENAI_API_KEY"],
  anthropic: ["ANTHROPIC_API_KEY"],
  gemini: ["GEMINI_API_KEY"],
  groq: ["GROQ_API_KEY"],
  manus: ["MANUS_API_KEY"],
  openrouter: ["OPENROUTER_API_KEY"],
  ollama: ["OLLAMA_BASE_URL"],
  demo: []
};

function maskSecret(value?: string | null) {
  if (!value) return null;
  return value.length <= 4 ? "****" : `${"*".repeat(12)}${value.slice(-4)}`;
}

function envConfigured(provider: AgentProviderKey) {
  return envSecretKeys[provider].some((key) => Boolean(process.env[key]));
}

export function getProviderPriority(taskType: AgentTaskType) {
  return taskPriority[taskType] || taskPriority.workflow_task;
}

export function shouldFallbackProvider(provider?: Pick<AgentProvider, "status" | "provider_key"> | null) {
  if (!provider) return true;
  if (provider.provider_key === "demo") return false;
  return provider.status === "passive" || provider.status === "error" || provider.status === "not_configured";
}

export function estimateProviderCost(provider: AgentProviderKey, inputSize = 1000) {
  const unit = provider === "manus" ? 0.08 : provider === "anthropic" ? 0.035 : provider === "openai" ? 0.025 : provider === "gemini" ? 0.015 : provider === "groq" ? 0.006 : 0;
  return Number(((Math.max(inputSize, 1) / 1000) * unit).toFixed(4));
}

export async function getAgentProviders(): Promise<AgentProvider[]> {
  const fallback = defaultAgentProviders.map((provider) => ({
    ...provider,
    configured: provider.provider_key === "demo" || envConfigured(provider.provider_key),
    secret_mask: maskSecret(envSecretKeys[provider.provider_key].map((key) => process.env[key]).find(Boolean))
  }));

  if (!hasSupabaseConfig()) return fallback;

  const rows = await supabaseRest<AgentProvider[]>("agent_providers?select=*&order=provider_name.asc").catch(() => []);
  const merged = fallback.map((provider) => {
    const row = rows.find((item) => item.provider_key === provider.provider_key);
    const configured = provider.provider_key === "demo" || envConfigured(provider.provider_key) || row?.status === "active";
    return {
      ...provider,
      ...row,
      status: configured && row?.status !== "passive" ? row?.status || provider.status : row?.status || provider.status,
      configured,
      secret_mask: provider.secret_mask || (row?.status === "active" ? "Sunucuda kayıtlı / maskeli" : null)
    };
  });
  const extras = rows.filter((row) => !merged.some((provider) => provider.provider_key === row.provider_key));
  return [...merged, ...extras];
}

export async function getRecommendedProvider(taskType: AgentTaskType, options: { requestedProvider?: AgentProviderKey | "auto"; providers?: AgentProvider[] } = {}) {
  const providers = options.providers || await getAgentProviders();
  if (options.requestedProvider && options.requestedProvider !== "auto") {
    const requested = providers.find((provider) => provider.provider_key === options.requestedProvider);
    if (requested && !shouldFallbackProvider(requested)) return requested;
  }
  for (const key of getProviderPriority(taskType)) {
    const provider = providers.find((item) => item.provider_key === key);
    if (provider && !shouldFallbackProvider(provider)) return provider;
  }
  return providers.find((provider) => provider.provider_key === "demo") || defaultAgentProviders[defaultAgentProviders.length - 1];
}

export function buildAgentFallback(input: AgentRunInput, provider: AgentProvider) {
  const taskLabel = agentTaskLabels[input.taskType] || input.taskType;
  const isResearch = ["manus", "anthropic"].includes(provider.provider_key);
  return {
    provider: provider.provider_key,
    taskType: input.taskType,
    confidence: provider.provider_key === "demo" ? 0.72 : 0.84,
    summary: `${taskLabel} için ${provider.provider_name} yönlendirmesi hazırlandı. API anahtarı yoksa bu çıktı güvenli demo/fallback olarak üretilir.`,
    findings: [
      isResearch ? "Bu görev uzun araştırma ve çok adımlı kıyaslama gerektiriyor." : "Bu görev kısa analiz ve hızlı aksiyon planı formatına uygundur.",
      "Çıktı müşteri dostu Türkçe formatta hazırlanmalıdır.",
      "Satış garantisi veren ifadeler kullanılmamalıdır."
    ],
    risks: ["Eksik veri varsa sonuç tahmini kabul edilmelidir.", "API anahtarı veya sağlayıcı limiti yoksa fallback kullanılmalıdır."],
    opportunities: ["Görev çıktısı CRM notu, teklif metni veya müşteri raporu için kullanılabilir.", "7 günlük aksiyon planına dönüştürülebilir."],
    recommendedActions: [
      "Öncelikle müşteri bağlamını doğrula.",
      "Çıktıyı ilgili modüle kaydetmeden önce teknik ve ticari riskleri kontrol et.",
      "Uygunsa takip görevi oluştur."
    ],
    nextSteps: ["Sonucu incele", "Gerekirse sağlayıcıyı manuel değiştir", "Aksiyon planını görev veya rapora dönüştür"],
    rawOutput: input.prompt
  };
}

export async function createAgentRunLog(payload: {
  customer_id?: string | null;
  task_type: AgentTaskType;
  priority?: string;
  requested_provider?: string | null;
  selected_provider?: string | null;
  fallback_provider?: string | null;
  status?: string;
  input_summary?: string | null;
  output_summary?: string | null;
  output_payload?: unknown;
  error_message?: string | null;
  estimated_cost?: number;
  tokens_used?: number;
  response_ms?: number;
  created_by?: string | null;
}) {
  if (!hasSupabaseConfig()) return null;
  const rows = await supabaseRest<unknown[]>("agent_runs", {
    method: "POST",
    body: JSON.stringify(payload)
  }).catch(() => null);
  return rows;
}

export async function runAgentTask(input: AgentRunInput) {
  const startedAt = Date.now();
  const provider = await getRecommendedProvider(input.taskType, { requestedProvider: input.requestedProvider });
  const estimatedCost = estimateProviderCost(provider.provider_key, input.prompt.length);
  const fallbackPayload = buildAgentFallback(input, provider);
  let outputPayload = fallbackPayload;
  let outputText = fallbackPayload.summary;
  let status = "completed";
  let errorMessage: string | null = null;

  if (["openai", "groq", "gemini", "demo"].includes(provider.provider_key)) {
    try {
      const generated = await generateAiText(
        `Yanıtı tamamen Türkçe ver. Teknik terim kullanırsan parantez içinde kısa açıklamasını yaz.\nGörev tipi: ${agentTaskLabels[input.taskType]}\nÖncelik: ${input.priority || "normal"}\nÇıktı formatı: ${input.outputFormat || "aksiyon planı"}\nGörev açıklaması:\n${input.prompt}`,
        [
          fallbackPayload.summary,
          "",
          "HK Intelligence Son Yorumu:",
          fallbackPayload.findings.join("\n"),
          "",
          "Öncelikli Aksiyonlar:",
          fallbackPayload.recommendedActions.map((item) => `- ${item}`).join("\n")
        ].join("\n")
      );
      outputText = generated.text;
      outputPayload = { ...fallbackPayload, provider: provider.provider_key, summary: generated.text, rawOutput: generated.text };
    } catch (error) {
      status = "completed_with_fallback";
      errorMessage = error instanceof Error ? error.message : "AI sağlayıcısı kullanılamadı.";
    }
  }

  const responseMs = Date.now() - startedAt;
  await createAgentRunLog({
    customer_id: input.customerId || null,
    task_type: input.taskType,
    priority: input.priority || "normal",
    requested_provider: input.requestedProvider || "auto",
    selected_provider: provider.provider_key,
    fallback_provider: status === "completed_with_fallback" ? "demo" : null,
    status,
    input_summary: input.prompt.slice(0, 500),
    output_summary: outputText.slice(0, 700),
    output_payload: outputPayload,
    error_message: errorMessage,
    estimated_cost: estimatedCost,
    response_ms: responseMs,
    created_by: input.createdBy || null
  }).catch(() => null);

  return {
    ok: true,
    selectedProvider: provider,
    status,
    errorMessage,
    estimatedCost,
    responseMs,
    output: outputPayload
  };
}
