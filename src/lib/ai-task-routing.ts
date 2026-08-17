export type IntelligenceTaskType =
  | "market_research"
  | "competitor_research"
  | "deep_research"
  | "google_ads_analysis"
  | "seo_analysis"
  | "document_analysis"
  | "report_interpretation"
  | "campaign_analysis"
  | "strategy"
  | "proposal"
  | "social_content"
  | "ad_copy"
  | "customer_message"
  | "quick_summary"
  | "qa_analysis"
  | "data_extraction"
  | "general_assistant";

export type IntelligenceProviderKey =
  | "openai"
  | "anthropic"
  | "gemini"
  | "groq"
  | "manus"
  | "openrouter"
  | "ollama"
  | "demo";

const taskTypes = new Set<IntelligenceTaskType>([
  "market_research",
  "competitor_research",
  "deep_research",
  "google_ads_analysis",
  "seo_analysis",
  "document_analysis",
  "report_interpretation",
  "campaign_analysis",
  "strategy",
  "proposal",
  "social_content",
  "ad_copy",
  "customer_message",
  "quick_summary",
  "qa_analysis",
  "data_extraction",
  "general_assistant"
]);

// Pre-Smart-Router multi-provider fallback chains. Kept (not deleted) for
// reference and for the admin-only explicit-provider override path — but no
// longer used as the automatic default for any task type, since Gemini is
// now the sole active production provider (HK AI Smart Router).
const geminiFirst: IntelligenceProviderKey[] = ["gemini", "groq", "openai", "openrouter", "ollama", "demo"];
const groqFirst: IntelligenceProviderKey[] = ["groq", "gemini", "openai", "openrouter", "ollama", "demo"];
const openAiFirst: IntelligenceProviderKey[] = ["openai", "gemini", "groq", "openrouter", "ollama", "demo"];
const manusFirst: IntelligenceProviderKey[] = ["manus", "gemini", "openai", "groq", "openrouter", "demo"];
export const legacyProviderPriorities = { geminiFirst, groqFirst, openAiFirst, manusFirst };

// Gemini-only automatic default. "demo" stays as the final, non-AI, rule-based
// safety net that already exists for total-outage cases — it is not another
// AI provider, so keeping it last does not violate the "Gemini-only" rule.
// OpenAI is deliberately NOT an automatic fallback here (two separate billing
// systems, different behavior) — it remains reachable only via an explicit
// admin-only requestedProvider override (see buildProviderOrder below).
export const defaultIntelligenceProviderPriority: IntelligenceProviderKey[] = ["gemini", "demo"];

export function isIntelligenceTaskType(value: unknown): value is IntelligenceTaskType {
  return taskTypes.has(String(value || "") as IntelligenceTaskType);
}

export function classifyAiTask(input: {
  taskType?: string | null;
  module?: string | null;
  endpoint?: string | null;
  prompt?: string | null;
  expectedOutput?: string | null;
}): IntelligenceTaskType {
  if (isIntelligenceTaskType(input.taskType)) return input.taskType;

  const text = [input.module, input.endpoint, input.prompt, input.expectedOutput]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("tr")
    .replaceAll("ı", "i");

  if (/derin araştır|deep research|çok adımlı|uzun web araştır/.test(text)) return "deep_research";
  if (/rakip|competitor/.test(text)) return "competitor_research";
  if (/pazar|market research|piyasa/.test(text)) return "market_research";
  if (/google ads|adwords|anahtar kelime/.test(text)) return "google_ads_analysis";
  if (/seo|search console|arama görünür/.test(text)) return "seo_analysis";
  if (/doküman|document|pdf|uzun metin/.test(text)) return "document_analysis";
  if (/rapor yorum|report interpretation|raporu yorum/.test(text)) return "report_interpretation";
  if (/kampanya analiz|reklam performans|campaign analysis/.test(text)) return "campaign_analysis";
  if (/teklif|proposal/.test(text)) return "proposal";
  if (/strateji|büyüme plan|karar deste/.test(text)) return "strategy";
  if (/instagram|sosyal medya|içerik plan|caption|reels/.test(text)) return "social_content";
  if (/reklam metni|ad copy|başlık varyasyon/.test(text)) return "ad_copy";
  if (/müşteri mesaj|whatsapp|e-posta tasla/.test(text)) return "customer_message";
  if (/qa|kalite|broken|hata tara/.test(text)) return "qa_analysis";
  if (/veri çıkar|extract|json|tabloya dönüştür/.test(text)) return "data_extraction";
  if (/özet|summary|kısaca/.test(text)) return "quick_summary";
  return "general_assistant";
}

export function providerOrderForTask(_task: IntelligenceTaskType): IntelligenceProviderKey[] {
  // Gemini is the sole active production provider for every task type — see
  // defaultIntelligenceProviderPriority above.
  return defaultIntelligenceProviderPriority;
}

export function buildProviderOrder(task: IntelligenceTaskType, options: {
  requestedProvider?: IntelligenceProviderKey | null;
  customFallback?: IntelligenceProviderKey[];
  demoOnly?: boolean;
} = {}) {
  if (options.demoOnly) return ["demo" as const];
  const preferred = providerOrderForTask(task);
  return [...new Set([
    ...(options.requestedProvider ? [options.requestedProvider] : []),
    ...(options.requestedProvider ? options.customFallback || [] : []),
    ...preferred,
    ...defaultIntelligenceProviderPriority
  ])];
}

export function agentTaskToIntelligenceTask(task: string): IntelligenceTaskType {
  const mapping: Record<string, IntelligenceTaskType> = {
    ad_analysis: "campaign_analysis",
    crm_summary: "quick_summary",
    content_generation: "social_content",
    seo_analysis: "seo_analysis",
    competitor_research: "competitor_research",
    market_research: "market_research",
    pricing_research: "market_research",
    sector_discovery: "market_research",
    deep_report: "deep_research",
    proposal_generation: "proposal",
    customer_report: "report_interpretation",
    code_review: "qa_analysis",
    fast_answer: "quick_summary",
    workflow_task: "strategy",
    long_web_research: "deep_research"
  };
  return mapping[task] || classifyAiTask({ taskType: task, prompt: task });
}

export function intelligenceTaskToAgentTask(task: IntelligenceTaskType) {
  const mapping: Record<IntelligenceTaskType, string> = {
    market_research: "market_research",
    competitor_research: "competitor_research",
    deep_research: "long_web_research",
    google_ads_analysis: "ad_analysis",
    seo_analysis: "seo_analysis",
    document_analysis: "deep_report",
    report_interpretation: "customer_report",
    campaign_analysis: "ad_analysis",
    strategy: "workflow_task",
    proposal: "proposal_generation",
    social_content: "content_generation",
    ad_copy: "content_generation",
    customer_message: "crm_summary",
    quick_summary: "fast_answer",
    qa_analysis: "code_review",
    data_extraction: "workflow_task",
    general_assistant: "fast_answer"
  };
  return mapping[task];
}
