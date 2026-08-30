import "server-only";
import { supabaseRest } from "@/lib/supabase";
import { executeAiTask } from "@/lib/server/ai-router";
import { HK_SERVICE_PACKAGES } from "@/lib/packages";

const WON_STATUSES = ["Kazanıldı", "Kazandı", "Dönüştürüldü", "Müşteri Oldu"];
const LOST_STATUSES = ["Kaybedildi", "Reddedildi"];

async function safeFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    return await supabaseRest<T>(path);
  } catch {
    return fallback;
  }
}

async function historicalCloseRate() {
  const rows = await safeFetch<Array<{ status: string; proposal_status: string | null }>>(
    "leads?select=status,proposal_status&limit=2000",
    []
  );
  const won = rows.filter((row) => WON_STATUSES.includes(row.status) || WON_STATUSES.includes(row.proposal_status || "")).length;
  const lost = rows.filter((row) => LOST_STATUSES.includes(row.status) || LOST_STATUSES.includes(row.proposal_status || "")).length;
  const total = won + lost;
  if (!total) return 0.35; // no closed-deal history yet — a neutral, clearly-labeled default, not a fabricated stat
  return Math.min(0.9, Math.max(0.1, won / total));
}

export async function computePricingRecommendation(params: { serviceSlugs: string[]; leadId?: string | null; companyId?: string | null; createdBy?: string | null }) {
  const services = params.serviceSlugs
    .map((slug) => HK_SERVICE_PACKAGES.find((pkg) => pkg.slug === slug))
    .filter((pkg): pkg is (typeof HK_SERVICE_PACKAGES)[number] => Boolean(pkg));

  if (!services.length) throw new Error("Geçerli hizmet paketi seçilmedi.");

  const basePrice = services.reduce((sum, pkg) => sum + pkg.monthlyPrice, 0);
  const closeRate = await historicalCloseRate();

  const recommendedPrice = basePrice;
  const rangeMin = Math.round(basePrice * 0.9);
  const rangeMax = Math.round(basePrice * 1.05);
  const closeProbability = Math.round(closeRate * 100);

  const ai = await executeAiTask({
    taskType: "strategy",
    module: "Dynamic Pricing",
    endpoint: "/api/admin/pricing/recommend",
    prompt: `Seçilen hizmetler: ${services.map((pkg) => pkg.title).join(", ")}. Toplam liste fiyatı: ${basePrice} TL. Önerilen aralık: ${rangeMin}-${rangeMax} TL. Tarihsel kapanış oranı: %${closeProbability}. Bu teklif için kısa bir satış pozisyonlama notu ve pazarlık stratejisi öner (max 80 kelime). Fiyat garantisi verme.`,
    expectedOutput: "Kısa satış pozisyonlama ve pazarlık notu",
    fallbackText: "Fiyatı hizmet kapsamı ve beklenen sonuçlarla birlikte sunun; indirim talebinde süre veya ek hizmet karşılığı değerlendirin.",
    createdBy: params.createdBy || null
  }, { cacheTtlMs: 5 * 60_000 });

  const inserted = await supabaseRest<Array<Record<string, unknown>>>("pricing_recommendations", {
    method: "POST",
    body: JSON.stringify({
      lead_id: params.leadId || null,
      company_id: params.companyId || null,
      selected_services: services.map((pkg) => ({ slug: pkg.slug, title: pkg.title, price: pkg.monthlyPrice })),
      recommended_price: recommendedPrice,
      recommended_range_min: rangeMin,
      recommended_range_max: rangeMax,
      expected_margin: null,
      close_probability: closeProbability,
      ai_rationale: ai.text,
      actual_outcome: "pending",
      created_by: params.createdBy || null
    })
  });

  return inserted[0];
}

export async function recordPricingOutcome(id: string, outcome: "won" | "lost", actualAmount: number | null) {
  return supabaseRest(`pricing_recommendations?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ actual_outcome: outcome, actual_amount: actualAmount })
  });
}
