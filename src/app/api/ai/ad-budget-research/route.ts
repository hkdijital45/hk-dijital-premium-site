import { NextResponse } from "next/server";
import { estimateAdBudget, formatTRY, type PackageRecommendationInput } from "@/lib/packages";

export const runtime = "nodejs";

type BudgetResearchInput = PackageRecommendationInput & {
  city?: string;
  marketLocation?: string;
  platformNeed?: string;
  monthlyAdBudget?: string | number;
  startTiming?: string;
  selectedPackageSlug?: string;
  selectedPackageName?: string;
  packageBasePrice?: number;
};

type BudgetResearchResponse = {
  source: "groq" | "fallback";
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
    platform: input.platform || input.platformNeed,
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

  return {
    source: "fallback",
    marketSummary: `${location} pazarı için ${sector} odağında medya bütçesi; hedef, platform, içerik ihtiyacı ve başlangıç seviyesine göre HK Dijital analiz modeliyle tahmini olarak hesaplandı.`,
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
      "Bu analiz kesin satış, lead veya ciro garantisi vermez."
    ],
    extraServiceSuggestions: estimate.extraServices.length ? estimate.extraServices : ["Dönüşüm ölçüm kontrolü", "Kreatif test planı", "Aylık performans raporlama düzeni"],
    disclaimer: "Bu çıktı HK Dijital analiz modeli / piyasa varsayımıdır. Canlı piyasa verisi veya kesin sonuç garantisi olarak yorumlanmamalıdır."
  };
}

function sanitizeGroqResponse(parsed: Partial<BudgetResearchResponse>, fallback: BudgetResearchResponse): BudgetResearchResponse {
  const budget = parsed.recommendedBudget || fallback.recommendedBudget;
  return {
    source: "groq",
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
  let body: BudgetResearchInput = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const input: BudgetResearchInput = {
    sector: cleanText(body.sector, 120),
    city: cleanText(body.city, 80),
    marketLocation: cleanText(body.marketLocation || body.city || "Türkiye", 80),
    goal: cleanText(body.goal, 120),
    platform: cleanText(body.platform || body.platformNeed, 120),
    platformNeed: cleanText(body.platformNeed || body.platform, 120),
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
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return NextResponse.json(fallback);

  const prompt = [
    "HK Dijital için Türkçe reklam bütçesi ve piyasa yorumu üret.",
    "Kesin satış, lead, ciro veya sonuç garantisi verme. Canlı internet verisi kullanıyormuş gibi davranma; piyasa varsayımı ve ajans deneyimi dili kullan.",
    "Reklam bütçesinin hizmet bedelinden ayrı olduğunu açıkça belirt.",
    "Sadece geçerli JSON döndür. Markdown kullanma.",
    `Girdi: ${JSON.stringify(input)}`,
    `Fallback bütçe tabanı: ${JSON.stringify(fallback.recommendedBudget)}`,
    "JSON şeması: {\"marketSummary\":\"string\",\"recommendedBudget\":{\"minimum\":number,\"ideal\":number,\"aggressive\":number,\"dailyIdeal\":number},\"platformSplit\":[{\"label\":\"string\",\"percent\":number,\"note\":\"string\"}],\"reasoningBullets\":[\"string\"],\"first30DaysPlan\":[\"string\"],\"risks\":[\"string\"],\"extraServiceSuggestions\":[\"string\"],\"disclaimer\":\"string\"}"
  ].join("\n");

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
        temperature: 0.35,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Sen HK Dijital için çalışan güvenli, gerçekçi ve profesyonel bir medya bütçesi danışmanısın." },
          { role: "user", content: prompt }
        ]
      })
    });
    if (!response.ok) return NextResponse.json(fallback);
    const data = await response.json();
    const content = String(data?.choices?.[0]?.message?.content || "");
    const parsed = JSON.parse(extractJson(content));
    return NextResponse.json(sanitizeGroqResponse(parsed, fallback));
  } catch {
    return NextResponse.json(fallback);
  }
}
