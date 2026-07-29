import { NextResponse } from "next/server";
import { estimateAdBudget, formatTRY, type PackageRecommendationInput } from "@/lib/packages";
import { executeAiTask, type IntelligenceProviderKey } from "@/lib/server/ai-router";
import { isGenericBusinessCategory, resolvedBusinessCategoryOrFallback } from "@/lib/business-category";
import { normalizePlatformSelection, platformSelectionLabel, platformSelectionReadableList, type PlatformKey } from "@/lib/platform-selection";
import { getSectorProfile } from "@/lib/sector-signal";

export const runtime = "nodejs";

const requestWindows = new Map<string, { count: number; resetAt: number }>();
const REQUEST_LIMIT = 6;
const REQUEST_WINDOW_MS = 10 * 60_000;

type BudgetResearchInput = Omit<PackageRecommendationInput, "platform"> & {
  platform: PlatformKey[];
  city?: string;
  marketLocation?: string;
  platforms?: unknown;
  platformNeed?: string;
  monthlyAdBudget?: string | number;
  startTiming?: string;
  selectedPackageSlug?: string;
  selectedPackageName?: string;
  packageBasePrice?: number;
};

// The raw, untrusted request body — every field optional/unknown since it
// comes straight from request.json(). `platform` is deliberately loosely
// typed here (unlike the normalized BudgetResearchInput above) because a
// legacy or current client may send it as a string, an array, or omit it
// entirely; normalizePlatformSelection() accepts all of those.
type RawBudgetRequestBody = Partial<Omit<BudgetResearchInput, "platform">> & { platform?: unknown };

type BudgetResearchResponse = {
  source: IntelligenceProviderKey | "fallback";
  providerLabel?: string;
  fallbackUsed?: boolean;
  providerNotice?: string | null;
  marketSummary: string;
  recommendedBudget: {
    minimum: number;
    ideal: number;
    aggressive: number;
    dailyIdeal: number;
  };
  platformSplit: Array<{ label: string; percent: number; note: string }>;
  reasoningBullets: string[];
  first30DaysPlan: string[];
  risks: string[];
  extraServiceSuggestions: string[];
  disclaimer: string;
};

function cleanText(value: unknown, maxLength = 180) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function cleanNumber(value: unknown) {
  return Number(String(value || "").replace(/[^\d]/g, "")) || 0;
}

function midpoint([min, max]: [number, number]) {
  return Math.round((Number(min || 0) + Number(max || 0)) / 2);
}

function fallbackResponse(input: BudgetResearchInput): BudgetResearchResponse {
  const estimate = estimateAdBudget({
    sector: input.sector,
    goal: input.goal,
    platform: input.platform,
    budget: input.budget || input.monthlyAdBudget,
    contentNeed: input.contentNeed,
    urgency: input.urgency || input.startTiming,
    socialStatus: input.socialStatus
  });
  const ideal = midpoint(estimate.idealRange);
  const minimum = midpoint(estimate.minimumRange);
  const aggressive = midpoint(estimate.aggressiveRange);
  const location = cleanText(input.marketLocation || input.city || "Türkiye", 80) || "Türkiye";
  const sector = cleanText(input.sector || "belirtilen sektör", 120) || "belirtilen sektör";
  const platformsLabel = platformSelectionLabel(input.platform);
  const sectorProfile = getSectorProfile(input.sector);

  return {
    source: "fallback",
    marketSummary: `${location} pazarı için ${sector} odağında ${sectorProfile.customerIntent}; seçilen ${platformsLabel} hizmetlerine yönelik medya bütçesi bu davranışa ve hedef/içerik/başlangıç seviyesine göre HK Dijital analiz modeliyle tahmini olarak hesaplandı. Öne çıkan dönüşüm eylemi: ${sectorProfile.conversionFocus}.`,
    recommendedBudget: {
      minimum,
      ideal,
      aggressive,
      dailyIdeal: Math.round(ideal / 30)
    },
    platformSplit: estimate.platformSplit.map((item) => ({
      label: item.label,
      percent: item.percent,
      note: item.note || "Bütçe dağılımı hedef ve platform ihtiyacına göre önerildi."
    })),
    reasoningBullets: [
      estimate.reason,
      estimate.budgetFit,
      `Önerilen ideal medya bütçesi yaklaşık ${formatTRY(ideal)} / ay seviyesindedir.`,
      "Hizmet bedeli ve medya/reklam bütçesi ayrı kalemler olarak değerlendirilmelidir."
    ],
    first30DaysPlan: estimate.first30DaysPlan,
    risks: [
      "Minimum bütçenin altında başlanırsa öğrenme ve optimizasyon süresi uzayabilir.",
      "Kreatif kalitesi ve ölçüm kurulumu performansı doğrudan etkiler.",
      "Bu analiz kesin satış, lead veya ciro garantisi vermez.",
      sectorProfile.riskNote
    ],
    extraServiceSuggestions: estimate.extraServices.length ? estimate.extraServices : ["Dönüşüm ölçüm kontrolü", "Kreatif test planı", "Aylık performans raporlama düzeni"],
    disclaimer: "Bu çıktı HK Dijital analiz modeli / piyasa varsayımıdır. Canlı piyasa verisi veya kesin sonuç garantisi olarak yorumlanmamalıdır."
  };
}

function sanitizeProviderResponse(parsed: Partial<BudgetResearchResponse>, fallback: BudgetResearchResponse, provider: IntelligenceProviderKey, providerLabel: string, fallbackUsed: boolean, providerNotice: string | null): BudgetResearchResponse {
  const budget = parsed.recommendedBudget || fallback.recommendedBudget;
  return {
    source: provider,
    providerLabel,
    fallbackUsed,
    providerNotice,
    marketSummary: cleanText(parsed.marketSummary, 900) || fallback.marketSummary,
    recommendedBudget: {
      minimum: cleanNumber(budget.minimum) || fallback.recommendedBudget.minimum,
      ideal: cleanNumber(budget.ideal) || fallback.recommendedBudget.ideal,
      aggressive: cleanNumber(budget.aggressive) || fallback.recommendedBudget.aggressive,
      dailyIdeal: cleanNumber(budget.dailyIdeal) || fallback.recommendedBudget.dailyIdeal
    },
    platformSplit: (Array.isArray(parsed.platformSplit) && parsed.platformSplit.length ? parsed.platformSplit : fallback.platformSplit)
      .slice(0, 6)
      .map((item) => ({
        label: cleanText(item.label, 80) || "Medya bütçesi",
        percent: Math.min(100, Math.max(0, cleanNumber(item.percent))),
        note: cleanText(item.note, 240) || "Platform dağılımı hedefe göre önerildi."
      })),
    reasoningBullets: (Array.isArray(parsed.reasoningBullets) && parsed.reasoningBullets.length ? parsed.reasoningBullets : fallback.reasoningBullets).slice(0, 7).map((item) => cleanText(item, 280)).filter(Boolean),
    first30DaysPlan: (Array.isArray(parsed.first30DaysPlan) && parsed.first30DaysPlan.length ? parsed.first30DaysPlan : fallback.first30DaysPlan).slice(0, 6).map((item) => cleanText(item, 240)).filter(Boolean),
    risks: (Array.isArray(parsed.risks) && parsed.risks.length ? parsed.risks : fallback.risks).slice(0, 6).map((item) => cleanText(item, 240)).filter(Boolean),
    extraServiceSuggestions: (Array.isArray(parsed.extraServiceSuggestions) && parsed.extraServiceSuggestions.length ? parsed.extraServiceSuggestions : fallback.extraServiceSuggestions).slice(0, 6).map((item) => cleanText(item, 180)).filter(Boolean),
    disclaimer: cleanText(parsed.disclaimer, 420) || fallback.disclaimer
  };
}

function extractJson(content: string) {
  const trimmed = content.trim();
  if (trimmed.startsWith("{")) return trimmed;
  return trimmed.match(/\{[\s\S]*\}/)?.[0] || "";
}

export async function POST(request: Request) {
  const clientKey = String(request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "anonymous").split(",")[0].trim().slice(0, 80);
  const now = Date.now();
  const currentWindow = requestWindows.get(clientKey);
  if (currentWindow && currentWindow.resetAt > now && currentWindow.count >= REQUEST_LIMIT) {
    return NextResponse.json({ error: "Kısa sürede çok fazla analiz istendi. Lütfen birkaç dakika sonra yeniden deneyin." }, { status: 429, headers: { "Retry-After": String(Math.ceil((currentWindow.resetAt - now) / 1000)) } });
  }
  requestWindows.set(clientKey, currentWindow && currentWindow.resetAt > now
    ? { ...currentWindow, count: currentWindow.count + 1 }
    : { count: 1, resetAt: now + REQUEST_WINDOW_MS });

  let body: RawBudgetRequestBody = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const rawSector = cleanText(body.sector, 120);
  if (!rawSector || isGenericBusinessCategory(rawSector)) {
    return NextResponse.json({ error: "Geçerli bir işletme sektörü belirtilmelidir." }, { status: 400 });
  }

  const platforms = normalizePlatformSelection(body.platforms ?? body.platform ?? body.platformNeed);
  const input: BudgetResearchInput = {
    sector: resolvedBusinessCategoryOrFallback(rawSector),
    city: cleanText(body.city, 80),
    marketLocation: cleanText(body.marketLocation || body.city || "Türkiye", 80),
    goal: cleanText(body.goal, 120),
    platform: platforms,
    platformNeed: platformSelectionLabel(platforms),
    monthlyAdBudget: cleanText(body.monthlyAdBudget || body.budget, 80),
    budget: cleanText(body.budget || body.monthlyAdBudget, 80),
    contentNeed: cleanText(body.contentNeed, 120),
    urgency: cleanText(body.urgency || body.startTiming, 120),
    startTiming: cleanText(body.startTiming || body.urgency, 120),
    socialStatus: cleanText(body.socialStatus, 120),
    selectedPackageSlug: cleanText(body.selectedPackageSlug, 120),
    selectedPackageName: cleanText(body.selectedPackageName, 160),
    packageBasePrice: cleanNumber(body.packageBasePrice)
  };

  const fallback = fallbackResponse(input);
  const sectorProfile = getSectorProfile(input.sector);
  const prompt = [
    "HK Dijital için Türkçe reklam bütçesi ve piyasa yorumu üret.",
    `İşletme sektörü: ${input.sector}`,
    "Seçilen hizmetler:",
    platformSelectionReadableList(platforms),
    "Bütçe önerisini ve piyasa yorumunu YALNIZCA yukarıda listelenen hizmetlere göre oluştur; listede olmayan bir platformu (ör. sosyal medya seçilmediyse sosyal medya yönetimini) dahil etme veya önerme.",
    "Yanıtı yazmadan ÖNCE, yalnızca bu sektör için şu noktaları kendi içinde çıkarsa (yanıtta ayrı bir bölüm olarak yazma, sonuçlara yansıt): tipik müşteri niyeti, yerel mi ulusal mı bir kazanım modeli olduğu, olası karar/satın alma döngüsü, en olası dönüşüm eylemi, arama talebiyle ilgisi, görsel içerik ile ilgisi, tekrar satın alma/tekrar ziyaret özelliği, güven ve itibar ihtiyacı, varsa mevzuat/etik kısıtlar, platform uygunluğu.",
    `Yönlendirici sinyal (kopyalama, yalnızca çıkarsamanı doğrulamak için kullan): olası müşteri niyeti "${sectorProfile.customerIntent}", olası dönüşüm eylemi "${sectorProfile.conversionFocus}". Kendi analizin bu sinyalle çelişirse kendi analizini esas al.`,
    `Değerlendirmeni özellikle "${input.sector}" sektörüne göre uyarla: bu sektördeki tipik hedef kitle davranışı, rekabet yoğunluğu, müşteri kazanma modeli, olası dönüşüm yolculuğu, en uygun reklam platformları, içerik ihtiyaçları, reklam ekonomisi ve sektöre özgü riskleri dikkate al.`,
    "Genel geçer, sektörden bağımsız yorumlar üretme (ör. \"Türkiye'de Meta platformunda reklam vermek isteyen bir işletme...\" gibi kalıp cümleler kullanma); her kategori için aynı paragrafı tekrarlama.",
    "reasoningBullets ve risks alanları bu sektöre özgü çıkarsamayı somut biçimde yansıtmalı; yalnızca sektör adını başka bir cümleye eklemek yeterli değildir.",
    "Kesin satış, lead, ciro veya sonuç garantisi verme. Canlı internet verisi kullanıyormuş gibi davranma; piyasa varsayımı ve ajans deneyimi dili kullan, tahmini olduğunu belirt.",
    "Reklam bütçesinin hizmet bedelinden ayrı olduğunu açıkça belirt.",
    "Sadece geçerli JSON döndür. Markdown kullanma.",
    `Girdi: ${JSON.stringify({ ...input, platform: platforms })}`,
    `Fallback bütçe tabanı: ${JSON.stringify(fallback.recommendedBudget)}`,
    "JSON şeması: {\"marketSummary\":\"string\",\"recommendedBudget\":{\"minimum\":number,\"ideal\":number,\"aggressive\":number,\"dailyIdeal\":number},\"platformSplit\":[{\"label\":\"string\",\"percent\":number,\"note\":\"string\"}],\"reasoningBullets\":[\"string\"],\"first30DaysPlan\":[\"string\"],\"risks\":[\"string\"],\"extraServiceSuggestions\":[\"string\"],\"disclaimer\":\"string\"}"
  ].join("\n");

  try {
    const result = await executeAiTask({
      taskType: "market_research",
      module: "Teklif Robotu",
      endpoint: "/api/ai/ad-budget-research",
      prompt,
      expectedOutput: "Geçerli JSON reklam bütçesi ve piyasa değerlendirmesi",
      systemPrompt: "Sen HK Dijital için çalışan güvenli, gerçekçi ve profesyonel bir medya bütçesi danışmanısın. Yalnız geçerli JSON döndür.",
      fallbackText: JSON.stringify(fallback)
    }, {
      cacheTtlMs: 10 * 60_000,
      recordExecution: false
    });
    if (result.provider === "demo") return NextResponse.json({ ...fallback, providerLabel: result.providerLabel, fallbackUsed: true, providerNotice: result.notice });
    const parsed = JSON.parse(extractJson(result.text));
    return NextResponse.json(sanitizeProviderResponse(parsed, fallback, result.provider, result.providerLabel, result.fallbackUsed, result.notice));
  } catch {
    return NextResponse.json(fallback);
  }
}
