import { NextResponse } from "next/server";
import { aiExecutionMetadata, normalizeAiProvider, type AiProviderKey } from "@/lib/ai-provider";
import { requireModuleAccess } from "@/lib/permissions";
import { executeAiTask, type IntelligenceProviderKey } from "@/lib/server/ai-router";

type GooglePlace = Record<string, unknown> & {
  place_id?: string;
  name?: string;
  formatted_address?: string;
  business_status?: string;
  rating?: number | string | null;
  user_ratings_total?: number | string | null;
  website?: string;
  formatted_phone_number?: string;
  international_phone_number?: string;
  url?: string;
  types?: string[];
};

const googleAnalysisCache = new Map<string, { expires: number; value: Record<string, unknown> }>();

function scorePlace(place: GooglePlace) {
  const rating = Number(place.rating || 0);
  const reviews = Number(place.user_ratings_total || 0);
  const websiteBonus = place.website ? 12 : 0;
  return Math.min(100, Math.round(rating * 12 + Math.min(reviews, 250) / 5 + websiteBonus));
}

async function getPlaceDetails(placeId: string, key: string) {
  const params = new URLSearchParams({
    place_id: placeId,
    fields: "website,business_status,formatted_phone_number,international_phone_number,formatted_address,url,rating,user_ratings_total,types",
    key,
    language: "tr"
  });
  const response = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${params}`, { cache: "no-store" });
  if (!response.ok) return {} as GooglePlace;
  const data = await response.json().catch(() => ({})) as { result?: GooglePlace };
  return data.result || {} as GooglePlace;
}

async function googleAiExecutionMeta(requestedProvider: AiProviderKey, city: string, district: string, sector: string) {
  const prompt = `Google İstihbarat sağlayıcı doğrulaması yap. Bağlam: ${city} / ${district} / ${sector}. Kısa Türkçe teknik kontrol yanıtı üret.`;
  const fallback = `${city} ${district} ${sector} için Google Maps sinyalleri üzerinden analiz hazırlanıyor.`;
  try {
    const requested = requestedProvider === "automatic" || requestedProvider === "auto"
      ? "auto"
      : requestedProvider === "local" ? "ollama" : requestedProvider as IntelligenceProviderKey;
    const result = await executeAiTask({
      taskType: "google_ads_analysis",
      module: "Google İstihbarat",
      endpoint: "/api/admin/google-analysis",
      prompt,
      expectedOutput: "Kısa Google ekosistemi analiz özeti",
      fallbackText: fallback
    }, { requestedProvider: requested, cacheTtlMs: 5 * 60_000 });
    return aiExecutionMetadata({
      requestedProvider,
      actualProvider: normalizeAiProvider(result.provider),
      model: result.model,
      fallbackReason: result.fallbackUsed ? result.notice || "Yedek sağlayıcıyla tamamlandı." : null,
      routerReason: requested === "auto" ? "HK Intelligence Router Google analizi için Gemini öncelikli görev zincirini kullandı." : "Sabit sağlayıcı seçimi önce denendi; gerektiğinde güvenli fallback uygulandı.",
      dataSources: ["Google Maps API", "HK Intelligence Router"]
    });
  } catch {
    return aiExecutionMetadata({
      requestedProvider,
      actualProvider: "demo",
      model: "demo-local",
      fallbackReason: "Canlı sağlayıcılar kullanılamadı; güvenli yerel yedek kullanıldı.",
      routerReason: "HK Intelligence Router canlı sağlayıcı bulamadı.",
      dataSources: ["Google Maps API", "Demo / Yerel Yedek Akış"]
    });
  }
}

export async function POST(request: Request) {
  const session = await requireModuleAccess("google-analiz");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const city = String(body.city || "Manisa");
  const district = String(body.district || "Yunusemre");
  const sector = String(body.sector || "Restoran");
  const requestedProvider = normalizeAiProvider(body.aiProvider || "automatic");
  const key = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY;
  const cacheKey = `${city}:${district}:${sector}:${requestedProvider}`.toLocaleLowerCase("tr");
  const cached = googleAnalysisCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return NextResponse.json(cached.value);
  const ai = await googleAiExecutionMeta(requestedProvider, city, district, sector);

  if (!key) {
    return NextResponse.json({
      error: "Google Maps API anahtarı yapılandırılmamış. Sistem yöneticisiyle iletişime geçin.",
      ai,
      results: []
    }, { status: 503 });
  }

  try {
    const params = new URLSearchParams({ query: `${sector} ${district} ${city}`, key, language: "tr", region: "tr" });
    const response = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`, { cache: "no-store" });
    const data = await response.json().catch(() => ({})) as { status?: string; results?: GooglePlace[]; error_message?: string };
    if (!response.ok || !["OK", "ZERO_RESULTS"].includes(data.status || "")) {
      console.error("[google-analysis] Google API hatası", data);
      return NextResponse.json({
        error: "Google Maps analizi başarısız oldu.",
        apiError: data.error_message || data.status || "Bilinmeyen Google Maps hatası.",
        ai,
        results: []
      }, { status: 502 });
    }
    const places = (data.results || []).slice(0, 8);
    const results = await Promise.all(places.map(async (place: GooglePlace) => {
      const details: Partial<GooglePlace> = place.place_id ? await getPlaceDetails(place.place_id, key).catch(() => ({})) : {};
      const item = { ...place, ...details };
      const visibility = scorePlace(item);
      return {
        id: place.place_id,
        name: place.name,
        city,
        district,
        sector,
        website: details.website || "",
        phone: details.formatted_phone_number || details.international_phone_number || "",
        email: "",
        address: details.formatted_address || place.formatted_address || "",
        googleMapsUrl: details.url || `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
        googleSearchUrl: `https://www.google.com/search?q=${encodeURIComponent(`${place.name} ${district} ${city}`)}`,
        googleRating: item.rating || null,
        googleReviewCount: Number(item.user_ratings_total || 0),
        googlePlaceId: place.place_id || "",
        category: Array.isArray(item.types) ? item.types[0] : sector,
        googleBusinessPresence: place.business_status === "OPERATIONAL" ? "Aktif Google Business varlığı" : "Profil durumu kontrol edilmeli",
        searchVisibilityScore: visibility,
        adActivitySignal: visibility >= 75 ? "Yüksek ticari niyet ve reklam fırsatı" : visibility >= 55 ? "Orta düzey reklam fırsatı" : "Düşük görünürlük, temel optimizasyon önerilir",
        keywordOpportunities: [`${district} ${sector}`, `${city} ${sector}`, `${sector} fiyatları`, `${sector} yakınında`],
        suggestedCampaignType: visibility >= 75 ? "Arama Ağı + Yeniden Pazarlama" : "Yerel Arama + Harita Reklamı",
        competitionLevel: visibility >= 80 ? "Yüksek" : visibility >= 55 ? "Orta" : "Düşük"
      };
    }));
    const value = { ai, results };
    googleAnalysisCache.set(cacheKey, { expires: Date.now() + 1000 * 60 * 5, value });
    return NextResponse.json(value);
  } catch (error) {
    console.error("[google-analysis] Analiz hatası", error);
    return NextResponse.json({ error: "Analiz sırasında bir hata oluştu." }, { status: 500 });
  }
}
