export type UnifiedAiProviderKey =
  | "auto"
  | "openai"
  | "gemini"
  | "groq"
  | "anthropic"
  | "manus"
  | "openrouter"
  | "ollama"
  | "demo";

export type UnifiedAiProviderOption = {
  key: UnifiedAiProviderKey;
  legacyLabels: string[];
  label: string;
  shortLabel: string;
  description: string;
  recommendedFor: string;
  badge?: string;
  env: string[];
  statusKind: "auto" | "live" | "local" | "demo";
};

export const unifiedAiProviderOptions: UnifiedAiProviderOption[] = [
  {
    key: "auto",
    legacyLabels: ["Otomatik", "Auto", "Automatic", "Auto AI Router"],
    label: "Auto AI Router / Otomatik Seçim",
    shortLabel: "Otomatik Seçim",
    description: "Görev tipine göre en uygun sağlayıcıyı otomatik seçer.",
    recommendedFor: "Tüm analiz, rapor ve içerik görevlerinde önerilen varsayılan seçim.",
    badge: "Önerilen",
    env: [],
    statusKind: "auto"
  },
  {
    key: "openai",
    legacyLabels: ["OpenAI", "ChatGPT", "OpenAI / ChatGPT"],
    label: "OpenAI / ChatGPT",
    shortLabel: "OpenAI",
    description: "Reklam yorumu, rapor, müşteri özeti ve genel analiz için güçlü sağlayıcı.",
    recommendedFor: "Reklam analizi, CRM özeti, müşteri raporu.",
    env: ["OPENAI_API_KEY"],
    statusKind: "live"
  },
  {
    key: "gemini",
    legacyLabels: ["Gemini", "Google Gemini"],
    label: "Google Gemini",
    shortLabel: "Gemini",
    description: "Google ekosistemi, SEO ve arama görünürlüğü analizleri için uygun sağlayıcı.",
    recommendedFor: "Google İstihbarat, SEO, arama görünürlüğü.",
    env: ["GEMINI_API_KEY"],
    statusKind: "live"
  },
  {
    key: "groq",
    legacyLabels: ["Groq"],
    label: "Groq",
    shortLabel: "Groq",
    description: "Hızlı ve düşük maliyetli kısa cevaplar için uygun sağlayıcı.",
    recommendedFor: "Hızlı özet ve kısa cevap.",
    env: ["GROQ_API_KEY"],
    statusKind: "live"
  },
  {
    key: "anthropic",
    legacyLabels: ["Claude", "Anthropic", "Anthropic / Claude"],
    label: "Anthropic / Claude",
    shortLabel: "Claude",
    description: "Teklif, uzun rapor, metin düzenleme ve detaylı değerlendirme için uygun sağlayıcı.",
    recommendedFor: "Teklif, uzun rapor, detaylı metin düzenleme.",
    env: ["ANTHROPIC_API_KEY"],
    statusKind: "live"
  },
  {
    key: "manus",
    legacyLabels: ["Manus", "Manus AI"],
    label: "Manus AI",
    shortLabel: "Manus",
    description: "Derin araştırma, rakip analizi, pazar araştırması ve kapsamlı rapor görevleri için kullanılır. Kısa cevaplarda varsayılan değildir.",
    recommendedFor: "Rakip analizi, pazar araştırması, sektör keşfi.",
    env: ["MANUS_API_KEY", "MANUS_API_BASE_URL", "MANUS_API_ENDPOINT"],
    statusKind: "live"
  },
  {
    key: "openrouter",
    legacyLabels: ["OpenRouter"],
    label: "OpenRouter",
    shortLabel: "OpenRouter",
    description: "Farklı modelleri tek geçit üzerinden kullanmak için alternatif sağlayıcı.",
    recommendedFor: "Alternatif model ve yedek akış.",
    env: ["OPENROUTER_API_KEY"],
    statusKind: "live"
  },
  {
    key: "ollama",
    legacyLabels: ["Ollama", "Yerel", "Yerel Mod", "Local", "local"],
    label: "Ollama / Yerel Model",
    shortLabel: "Ollama",
    description: "Yerel bilgisayar veya özel sunucudaki modeller için kullanılır.",
    recommendedFor: "Yerel veya özel ağ modeli.",
    env: ["OLLAMA_BASE_URL"],
    statusKind: "local"
  },
  {
    key: "demo",
    legacyLabels: ["Demo", "Demo Modu", "Demo / Yerel Yedek Akış"],
    label: "Demo / Yerel Yedek Akış",
    shortLabel: "Demo",
    description: "API anahtarı yoksa güvenli örnek çıktı üretir.",
    recommendedFor: "API anahtarı olmayan güvenli deneme modu.",
    env: [],
    statusKind: "demo"
  }
];

export const unifiedAiProviderLabels = unifiedAiProviderOptions.map((item) => item.label);
export const unifiedAiProviderShortLabels = unifiedAiProviderOptions.map((item) => item.shortLabel);
export const unifiedAiPriorityKeys = unifiedAiProviderOptions.filter((item) => item.key !== "auto").map((item) => item.key);

export function normalizeUnifiedAiProvider(value?: string | null): UnifiedAiProviderKey {
  const normalized = String(value || "").toLocaleLowerCase("tr").trim();
  const option = unifiedAiProviderOptions.find((item) =>
    item.key === normalized ||
    item.label.toLocaleLowerCase("tr") === normalized ||
    item.shortLabel.toLocaleLowerCase("tr") === normalized ||
    item.legacyLabels.some((label) => label.toLocaleLowerCase("tr") === normalized)
  );
  if (option) return option.key;
  if (normalized.includes("demo")) return "demo";
  if (normalized.includes("auto") || normalized.includes("otomatik")) return "auto";
  if (normalized.includes("openai") || normalized.includes("chatgpt")) return "openai";
  if (normalized.includes("gemini")) return "gemini";
  if (normalized.includes("groq")) return "groq";
  if (normalized.includes("claude")) return "anthropic";
  if (normalized.includes("manus")) return "manus";
  if (normalized.includes("openrouter")) return "openrouter";
  if (normalized.includes("local") || normalized.includes("yerel")) return "ollama";
  return "auto";
}

export function labelForAiProvider(value?: string | null, mode: "label" | "short" = "label") {
  const key = normalizeUnifiedAiProvider(value);
  const option = unifiedAiProviderOptions.find((item) => item.key === key) || unifiedAiProviderOptions[0];
  return mode === "short" ? option.shortLabel : option.label;
}

export function legacyLabelForAiProvider(value?: string | null) {
  const key = normalizeUnifiedAiProvider(value);
  if (key === "auto") return "Otomatik";
  if (key === "anthropic") return "Claude";
  if (key === "ollama") return "Yerel Mod";
  if (key === "demo") return "Demo Modu";
  return unifiedAiProviderOptions.find((item) => item.key === key)?.shortLabel || "Otomatik";
}

export function aiProviderKeyForApi(value?: string | null) {
  const key = normalizeUnifiedAiProvider(value);
  if (key === "auto") return "automatic";
  if (key === "ollama") return "local";
  return key;
}

export function buildAiSelectionReason(moduleLabel: string, selected?: string, fallbackReason?: string | null) {
  const key = normalizeUnifiedAiProvider(selected);
  const option = unifiedAiProviderOptions.find((item) => item.key === key) || unifiedAiProviderOptions[0];
  const base = key === "auto"
    ? `${moduleLabel} görevi için Auto Router / Otomatik Seçim önerilir. HK Intelligence görev tipini, aktif API anahtarlarını, hız/maliyet dengesini ve yedek akışı kontrol eder.`
    : `${moduleLabel} görevi için ${option.label} seçildi. ${option.description}`;
  return {
    selectedProvider: option.label,
    reason: fallbackReason ? `${base} ${fallbackReason}` : base,
    fallbackUsed: Boolean(fallbackReason),
    missingApiKeys: option.env,
    recommendedFix: option.env.length ? `${option.env.join(", ")} değerlerini Vercel Environment Variables alanında doğrulayın.` : "Ek API anahtarı gerektirmez."
  };
}
