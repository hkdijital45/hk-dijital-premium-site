import { runRealAgentProvider } from "@/lib/agent-providers";
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
  | "workflow_task"
  | "long_web_research";

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
  multiAgent?: boolean;
  createdBy?: string | null;
  parentRunId?: string | null;
  retryCount?: number;
};

export type AgentFinalReport = {
  providerChain: AgentProviderKey[];
  selectedProvider: AgentProviderKey | "";
  confidence: number;
  executiveSummary: string;
  findings: string[];
  risks: string[];
  opportunities: string[];
  recommendedActions: string[];
  sevenDayPlan: string[];
  customerMessageDraft: string;
  internalNotes: string;
  dataSources?: string[];
  unavailableProviders?: string[];
  rawOutputs: unknown[];
};

export type AgentRouterDecision = {
  selectedProvider: AgentProviderKey | "";
  providerLabel: string;
  routerDecisionReason: string;
  rejectedProviders: Array<{ provider: AgentProviderKey; label: string; reason: string }>;
  fallbackReason: string | null;
  dataSourcesUsed: string[];
  confidenceScore: number;
  missingApiKeys: string[];
  recommendedFix: string;
};

type AgentMemoryRow = {
  id?: string;
  company_id?: string | null;
  customer_id?: string | null;
  memory_type?: string | null;
  title?: string | null;
  content?: string | null;
  impact_score?: number | null;
  tags?: unknown;
  is_active?: boolean | null;
  created_at?: string | null;
};

type AgentTrainingRuleRow = {
  id?: string;
  rule_type?: string | null;
  title?: string | null;
  content?: string | null;
  is_active?: boolean | null;
  priority?: number | null;
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
  workflow_task: "Workflow görevi",
  long_web_research: "Uzun web araştırması"
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
  long_web_research: ["manus", "gemini", "openai", "demo"],
  proposal_generation: ["anthropic", "openai", "gemini", "demo"],
  customer_report: ["openai", "anthropic", "gemini", "demo"],
  code_review: ["anthropic", "openai", "demo"],
  fast_answer: ["groq", "openai", "gemini", "demo"],
  workflow_task: ["openai", "gemini", "anthropic", "demo"]
};

const multiAgentChains: Partial<Record<AgentTaskType, AgentProviderKey[]>> = {
  competitor_research: ["manus", "gemini", "openai"],
  market_research: ["manus", "gemini", "openai"],
  pricing_research: ["manus", "gemini", "openai"],
  sector_discovery: ["manus", "gemini", "openai"],
  deep_report: ["manus", "anthropic", "openai"],
  proposal_generation: ["openai", "anthropic"],
  customer_report: ["openai", "anthropic"]
};

const manusTaskTypes: AgentTaskType[] = ["competitor_research", "market_research", "pricing_research", "sector_discovery", "deep_report", "long_web_research"];

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

const pricingPerThousandTextUnits: Record<AgentProviderKey, number> = {
  openai: 0.025,
  anthropic: 0.035,
  gemini: 0.015,
  groq: 0.006,
  manus: 0.08,
  openrouter: 0.02,
  ollama: 0,
  demo: 0
};

function maskSecret(value?: string | null) {
  if (!value) return null;
  return value.length <= 4 ? "****" : `${"*".repeat(12)}${value.slice(-4)}`;
}

function envConfigured(provider: AgentProviderKey) {
  return envSecretKeys[provider].some((key) => Boolean(process.env[key]));
}

function providerDisplayName(provider: AgentProviderKey) {
  return defaultAgentProviders.find((item) => item.provider_key === provider)?.provider_name || provider;
}

function missingApiKeysFor(provider: AgentProviderKey) {
  if (provider === "demo") return [];
  return envSecretKeys[provider].filter((key) => !process.env[key]);
}

export function getProviderPriority(taskType: AgentTaskType) {
  return taskPriority[taskType] || taskPriority.workflow_task;
}

export function shouldUseManus(taskType: AgentTaskType, input = "") {
  const text = input.toLocaleLowerCase("tr");
  return manusTaskTypes.includes(taskType) || text.includes("rakip") || text.includes("pazar araştır") || text.includes("fiyat karşılaştır") || text.includes("derin araştır");
}

export function shouldUseMultiAgent(taskType: AgentTaskType, outputFormat = "", priority = "normal") {
  return Boolean(multiAgentChains[taskType]) || outputFormat.includes("detaylı") || outputFormat.includes("rapor") || priority === "kritik";
}

export async function buildProviderChain(taskType: AgentTaskType, options: { requestedProvider?: AgentProviderKey | "auto"; providers?: AgentProvider[]; outputFormat?: string; priority?: string; multiAgent?: boolean; input?: string } = {}) {
  const providers = options.providers || await getAgentProviders();
  if (options.requestedProvider && options.requestedProvider !== "auto") {
    const manual = providers.find((provider) => provider.provider_key === options.requestedProvider);
    return manual ? [manual] : [];
  }
  const chainKeys = options.multiAgent || shouldUseMultiAgent(taskType, options.outputFormat, options.priority)
    ? multiAgentChains[taskType] || getProviderPriority(taskType).slice(0, 2)
    : getProviderPriority(taskType).slice(0, 1);
  const chain = chainKeys
    .map((key) => providers.find((provider) => provider.provider_key === key))
    .filter((provider): provider is AgentProvider => Boolean(provider && !shouldFallbackProvider(provider)));
  return chain.length ? chain : [providers.find((provider) => provider.provider_key === "demo") || defaultAgentProviders[defaultAgentProviders.length - 1]];
}

export function shouldFallbackProvider(provider?: Pick<AgentProvider, "status" | "provider_key"> | null) {
  if (!provider) return true;
  if (provider.provider_key === "demo") return false;
  return provider.status === "passive" || provider.status === "error" || provider.status === "not_configured";
}

export function estimateProviderCost(provider: AgentProviderKey, inputSize = 1000) {
  const unit = pricingPerThousandTextUnits[provider] || 0;
  return Number(((Math.max(inputSize, 1) / 1000) * unit).toFixed(4));
}

export function estimateAgentCost(provider: AgentProviderKey, textUnits = 1000) {
  return estimateProviderCost(provider, textUnits);
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

export function normalizeAgentOutput(raw: unknown, provider: AgentProviderKey, taskType: AgentTaskType) {
  const text = typeof raw === "string" ? raw : JSON.stringify(raw || {});
  return {
    provider,
    taskType,
    confidence: provider === "demo" ? 0.72 : provider === "manus" ? 0.86 : 0.82,
    summary: text.slice(0, 900),
    findings: [
      provider === "manus" ? "Derin araştırma ve pazar bağlamı üretildi." : "Görev bağlamına göre uygulanabilir analiz üretildi.",
      `${agentTaskLabels[taskType]} için Türkçe çıktı standardize edildi.`
    ],
    risks: ["Eksik veri varsa sonuç tahmini değerlendirilmelidir."],
    opportunities: ["Çıktı rapor, teklif, CRM notu veya görev akışına dönüştürülebilir."],
    recommendedActions: ["Sonucu kontrol et", "Müşteri diline uygunlaştır", "Uygun aksiyonları göreve çevir"],
    rawOutput: raw
  };
}

export function mergeAgentOutputs(outputs: ReturnType<typeof normalizeAgentOutput>[]) {
  const unique = (items: string[]) => [...new Set(items.filter(Boolean))].slice(0, 8);
  return {
    findings: unique(outputs.flatMap((item) => item.findings)),
    risks: unique(outputs.flatMap((item) => item.risks)),
    opportunities: unique(outputs.flatMap((item) => item.opportunities)),
    recommendedActions: unique(outputs.flatMap((item) => item.recommendedActions))
  };
}

export function buildHKIntelligenceFinalReport(outputs: ReturnType<typeof normalizeAgentOutput>[], taskContext: AgentRunInput): AgentFinalReport {
  const merged = mergeAgentOutputs(outputs);
  const chain = outputs.map((item) => item.provider);
  const taskLabel = agentTaskLabels[taskContext.taskType] || taskContext.taskType;
  const executiveSummary = `${taskLabel} görevi HK Intelligence final katmanında birleştirildi. ${chain.join(" → ")} zinciri kullanıldı; sonuçlar yönetici özeti, riskler ve 7 günlük aksiyon planı formatına çevrildi.`;
  return {
    providerChain: chain,
    selectedProvider: chain[0] || "",
    confidence: outputs.length ? Number((outputs.reduce((sum, item) => sum + item.confidence, 0) / outputs.length).toFixed(2)) : 0.7,
    executiveSummary,
    findings: merged.findings,
    risks: merged.risks,
    opportunities: merged.opportunities,
    recommendedActions: merged.recommendedActions,
    sevenDayPlan: [
      "1. gün: Veriyi ve müşteri bağlamını doğrula.",
      "2-3. gün: En yüksek etkili aksiyonları uygula.",
      "4-5. gün: Sonuçları ölç ve düşük performanslı noktaları düzelt.",
      "6-7. gün: Müşteriye sade özet ve sonraki adımı hazırla."
    ],
    customerMessageDraft: "Merhaba, mevcut verileri inceledik. Performansı güçlendirmek için ölçülü ve uygulanabilir aksiyonlar belirledik. Önceliğimiz, bütçeyi daha verimli kullanmak ve sonuçları düzenli takip etmek olacaktır.",
    internalNotes: "Bu çıktı satış garantisi içermez. API anahtarı eksik sağlayıcılarda demo/local yedek akış kullanılmış olabilir.",
    dataSources: [
      taskContext.customerId ? "Müşteri bağlamı kullanıldı" : "Müşteri seçilmedi",
      "Agent Hafızası ve eğitim kuralları varsa prompt bağlamına eklendi",
      "Meta/Google son kayıtları mevcutsa bağlam olarak kullanılabilir"
    ],
    unavailableProviders: outputs.filter((item) => item.provider === "demo").length ? ["Bazı sağlayıcılarda yedek akış kullanıldı"] : [],
    rawOutputs: outputs.map((item) => item.rawOutput)
  };
}

export function buildRouterDecision(input: AgentRunInput, providers: AgentProvider[], selectedProvider: AgentProvider, outputs: Array<ReturnType<typeof normalizeAgentOutput> & { usedFallback?: boolean; errorMessage?: string }>, finalReport: AgentFinalReport): AgentRouterDecision {
  const taskLabel = agentTaskLabels[input.taskType] || input.taskType;
  const priority = getProviderPriority(input.taskType);
  const selectedKey = selectedProvider.provider_key;
  const fallbackUsed = outputs.some((item) => item.provider === "demo" || item.usedFallback);
  const missingKeys = [...new Set(priority.flatMap((provider) => missingApiKeysFor(provider)))];
  const rejectedProviders = providers
    .filter((provider) => provider.provider_key !== selectedKey && provider.provider_key !== "demo")
    .slice(0, 6)
    .map((provider) => ({
      provider: provider.provider_key,
      label: provider.provider_name,
      reason: provider.provider_key === "manus" && !shouldUseManus(input.taskType, input.prompt)
        ? "Manus derin araştırma görevleri için ayrıldı; bu kısa/orta analizde önerilmedi."
        : shouldFallbackProvider(provider)
          ? "Sağlayıcı pasif, hatalı veya API anahtarı eksik görünüyor."
          : "Bu görev için öncelik sırasında daha uygun bir sağlayıcı seçildi."
    }));
  const reason = selectedKey === "demo"
    ? `${taskLabel} için gerçek sağlayıcı çalıştırılamadığı için Demo / Yerel Yedek Akış seçildi.`
    : `${taskLabel} için ${selectedProvider.provider_name} seçildi. Bu sağlayıcı görev tipi, hız/maliyet dengesi ve aktif yapılandırma açısından en uygun seçenek olarak değerlendirildi.`;
  return {
    selectedProvider: selectedKey,
    providerLabel: selectedProvider.provider_name,
    routerDecisionReason: selectedKey === "manus"
      ? `${reason} Manus yalnızca rakip analizi, pazar araştırması, fiyat karşılaştırması, sektör keşfi, uzun web araştırması ve kapsamlı rapor görevlerinde önceliklidir.`
      : reason,
    rejectedProviders,
    fallbackReason: fallbackUsed ? (outputs.map((item) => item.errorMessage).filter(Boolean).join(" | ") || "Seçili sağlayıcı kullanılamadığı için yedek akış devreye girdi.") : null,
    dataSourcesUsed: finalReport.dataSources || [],
    confidenceScore: Math.round(finalReport.confidence * 100),
    missingApiKeys: missingKeys,
    recommendedFix: fallbackUsed || missingKeys.length
      ? `${missingKeys.slice(0, 3).join(", ") || "ilgili sağlayıcı API anahtarı"} Vercel Environment Variables alanına eklenip redeploy yapılmalı.`
      : "Ek düzeltme gerekmiyor; seçilen sağlayıcı aktif görünüyor."
  };
}

function progressEvent(step: string, progress: number, provider?: string) {
  return { step, progress, provider, at: new Date().toISOString() };
}

async function loadAgentMemories(companyId?: string | null) {
  if (!companyId || !hasSupabaseConfig()) return [] as AgentMemoryRow[];
  return supabaseRest<AgentMemoryRow[]>(`agent_memories?company_id=eq.${encodeURIComponent(companyId)}&is_active=eq.true&select=*&order=created_at.desc&limit=8`).catch(() => []);
}

async function loadTrainingRules() {
  if (!hasSupabaseConfig()) return [] as AgentTrainingRuleRow[];
  return supabaseRest<AgentTrainingRuleRow[]>("agent_training_rules?is_active=eq.true&select=*&order=priority.asc,created_at.asc&limit=20").catch(() => []);
}

async function saveMemoryFromReport(input: AgentRunInput, runId: string, finalReport: AgentFinalReport) {
  if (!input.customerId || !hasSupabaseConfig()) return null;
  const content = [
    finalReport.executiveSummary,
    "Aksiyonlar:",
    ...finalReport.recommendedActions.map((item) => `- ${item}`),
    "Riskler:",
    ...finalReport.risks.map((item) => `- ${item}`)
  ].join("\n");
  return supabaseRest("agent_memories", {
    method: "POST",
    body: JSON.stringify({
      company_id: input.customerId,
      customer_id: input.customerId,
      memory_type: input.taskType,
      title: `Agent sonucu - ${agentTaskLabels[input.taskType]}`,
      content: content.slice(0, 5000),
      source_run_id: runId || null,
      impact_score: Math.round(finalReport.confidence * 100),
      tags: [input.taskType, input.outputFormat || "aksiyon planı"],
      is_active: true
    })
  }).catch(() => null);
}

function buildSystemPrompt(provider: AgentProvider, input: AgentRunInput, memories: AgentMemoryRow[], rules: AgentTrainingRuleRow[]) {
  const memoryContext = memories.length
    ? `\nGeçmiş müşteri bağlamı:\n${memories.map((item) => `- ${item.title}: ${item.content}`).join("\n").slice(0, 4000)}`
    : "";
  const ruleContext = rules.length
    ? `\nHK Intelligence eğitim kuralları:\n${rules.map((item) => `- ${item.title}: ${item.content}`).join("\n").slice(0, 4000)}`
    : "";
  return [
    "Yanıtı tamamen Türkçe ver.",
    "Teknik terim kullanırsan parantez içinde kısa açıklamasını yaz.",
    "Satış garantisi verme; riskleri saklama, ölçülü anlat.",
    `Sağlayıcı rolü: ${provider.role_label || provider.provider_name}`,
    `Görev tipi: ${agentTaskLabels[input.taskType]}`,
    `Öncelik: ${input.priority || "normal"}`,
    `Çıktı formatı: ${input.outputFormat || "aksiyon planı"}`,
    memoryContext,
    ruleContext
  ].join("\n");
}

async function runProvider(provider: AgentProvider, input: AgentRunInput, memories: AgentMemoryRow[], rules: AgentTrainingRuleRow[]) {
  const fallbackPayload = buildAgentFallback(input, provider);
  const result = await runRealAgentProvider({
    provider: provider.provider_key,
    taskType: input.taskType,
    model: provider.default_model,
    systemPrompt: buildSystemPrompt(provider, input, memories, rules),
    prompt: input.prompt,
    timeoutMs: provider.provider_key === "manus" ? 50000 : 24000
  });
  const normalized = normalizeAgentOutput(result.usedFallback ? { ...fallbackPayload, summary: result.text, error: result.errorMessage } : result.text, result.provider, input.taskType);
  return {
    ...normalized,
    provider: result.provider,
    tokensUsed: result.tokensUsed,
    responseMs: result.responseMs,
    usedFallback: result.usedFallback,
    model: result.model,
    errorMessage: result.errorMessage
  };
}

export async function createAgentRunLog(payload: {
  id?: string;
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
  run_mode?: string;
  provider_chain?: unknown;
  progress?: number;
  current_step?: string | null;
  progress_events?: unknown;
  final_report?: unknown;
  export_payload?: unknown;
  email_draft?: unknown;
  scheduled_task_id?: string | null;
  started_at?: string | null;
  updated_at?: string | null;
  completed_at?: string | null;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
  retry_count?: number;
  parent_run_id?: string | null;
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
  const providers = await getAgentProviders();
  const memories = await loadAgentMemories(input.customerId);
  const trainingRules = await loadTrainingRules();
  const manualManusWarning = input.requestedProvider === "manus" && !shouldUseManus(input.taskType, input.prompt)
    ? "Manus bu görev için ideal değildir. Auto Router OpenAI/Gemini/Claude önerir."
    : null;
  const chainProviders = await buildProviderChain(input.taskType, {
    providers,
    requestedProvider: input.requestedProvider,
    outputFormat: input.outputFormat,
    priority: input.priority,
    multiAgent: input.multiAgent,
    input: input.prompt
  });
  const runMode = chainProviders.length > 1 ? "multi_agent" : "single";
  const progressEvents = [
    progressEvent("Görev oluşturuldu", 10),
    progressEvent("AI Router görev tipini analiz ediyor", 25)
  ];
  let outputs: Array<ReturnType<typeof normalizeAgentOutput> & { tokensUsed?: number; responseMs?: number; usedFallback?: boolean; errorMessage?: string; model?: string }> = [];
  if (chainProviders.length > 1) {
    const [firstProvider, ...parallelProviders] = chainProviders;
    if (firstProvider?.provider_key === "manus") {
      progressEvents.push(progressEvent(`${firstProvider.provider_name} derin araştırma yapıyor`, 35, firstProvider.provider_key));
      outputs.push(await runProvider(firstProvider, input, memories, trainingRules));
    } else if (firstProvider) {
      parallelProviders.unshift(firstProvider);
    }
    progressEvents.push(progressEvent("Bağımsız sağlayıcılar paralel çalışıyor", 55));
    const settled = await Promise.allSettled(parallelProviders.map((provider) => runProvider(provider, input, memories, trainingRules)));
    outputs = [
      ...outputs,
      ...settled.map((result, index) => result.status === "fulfilled"
        ? result.value
        : {
          ...normalizeAgentOutput({ error: "Sağlayıcı kullanılamadı", provider: parallelProviders[index]?.provider_key }, "demo", input.taskType),
          tokensUsed: 0,
          responseMs: 0,
          usedFallback: true,
          errorMessage: "Sağlayıcı kullanılamadı"
        })
    ];
  } else {
    for (const [index, provider] of chainProviders.entries()) {
      progressEvents.push(progressEvent(`${provider.provider_name} çalışıyor`, 35 + index * 15, provider.provider_key));
      outputs.push(await runProvider(provider, input, memories, trainingRules));
    }
  }
  progressEvents.push(progressEvent("HK Intelligence final raporu oluşturuyor", 85));
  const finalReport = buildHKIntelligenceFinalReport(outputs, input);
  const outputText = finalReport.executiveSummary;
  const outputPayload = finalReport;
  const selectedProvider = chainProviders[0] || await getRecommendedProvider(input.taskType, { providers });
  const routerDecision = buildRouterDecision(input, providers, selectedProvider, outputs, finalReport);
  const totalTokens = outputs.reduce((sum, item) => sum + Number(item.tokensUsed || 0), 0);
  const estimatedCost = outputs.reduce((sum, item) => sum + estimateAgentCost(item.provider, Number(item.tokensUsed || input.prompt.length)), 0);
  const status = manualManusWarning ? "completed_with_warning" : outputs.some((item) => item.provider === "demo") ? "completed_with_fallback" : "completed";
  const errorMessage = [manualManusWarning, ...outputs.map((item) => item.errorMessage).filter(Boolean)].filter(Boolean).join(" | ") || null;
  progressEvents.push(progressEvent("Çıktı hazır", 100));

  const responseMs = Date.now() - startedAt;
  const logRows = await createAgentRunLog({
    customer_id: input.customerId || null,
    task_type: input.taskType,
    priority: input.priority || "normal",
    requested_provider: input.requestedProvider || "auto",
    selected_provider: selectedProvider.provider_key,
    fallback_provider: status === "completed_with_fallback" ? "demo" : null,
    status,
    input_summary: input.prompt.slice(0, 500),
    output_summary: outputText.slice(0, 700),
    output_payload: outputPayload,
    error_message: errorMessage,
    estimated_cost: estimatedCost,
    tokens_used: totalTokens,
    response_ms: responseMs,
    created_by: input.createdBy || null,
    run_mode: runMode,
    provider_chain: chainProviders.map((provider) => provider.provider_key),
    progress: 100,
    current_step: "Tamamlandı",
    progress_events: progressEvents,
    final_report: finalReport,
    export_payload: { ...buildAgentExportPayload(finalReport, input), routerDecision },
    email_draft: {},
    retry_count: input.retryCount || 0,
    parent_run_id: input.parentRunId || null,
    started_at: new Date(startedAt).toISOString(),
    updated_at: new Date().toISOString(),
    completed_at: new Date().toISOString()
  }).catch(() => null);
  const runId = Array.isArray(logRows) && logRows[0] && typeof logRows[0] === "object" && "id" in logRows[0]
    ? String((logRows[0] as { id?: string }).id || "")
    : "";
  await saveMemoryFromReport(input, runId, finalReport);

  return {
    ok: true,
    runId,
    selectedProvider,
    providerChain: chainProviders,
    status,
    errorMessage,
    estimatedCost,
    tokensUsed: totalTokens,
    responseMs,
    output: outputPayload,
    finalReport,
    routerDecision,
    selectedProviderLabel: providerDisplayName(selectedProvider.provider_key),
    progressEvents
  };
}

export function buildAgentExportPayload(finalReport: AgentFinalReport, input: AgentRunInput) {
  return {
    title: `HK Agent Hub - ${agentTaskLabels[input.taskType]}`,
    customerName: input.customerId || "Müşteri seçilmedi",
    taskType: agentTaskLabels[input.taskType],
    createdAt: new Date().toISOString(),
    executiveSummary: finalReport.executiveSummary,
    findings: finalReport.findings,
    risks: finalReport.risks,
    opportunities: finalReport.opportunities,
    recommendedActions: finalReport.recommendedActions,
    sevenDayPlan: finalReport.sevenDayPlan,
    customerMessageDraft: finalReport.customerMessageDraft,
    internalNotes: finalReport.internalNotes,
    providerChain: finalReport.providerChain
  };
}
