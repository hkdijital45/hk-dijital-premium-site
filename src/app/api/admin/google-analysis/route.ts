import { NextResponse } from "next/server";
import { aiExecutionMetadata, generateAiText, normalizeAiProvider, type AiProviderKey } from "@/lib/ai-provider";
import { requireModuleAccess } from "@/lib/permissions";

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

function demoGoogleResults(city: string, district: string, sector: string) {
  return [
    {
      id: "google-demo-1",
      name: `${district} ${sector} Arama Fırsatı`,
      city,
      district,
      sector,
      website: "",
      phone: "",
      email: "",
      address: "",
      googleMapsUrl: `https://www.google.com/search?q=${encodeURIComponent(`${district} ${sector} ${city}`)}`,
      googleSearchUrl: `https://www.google.com/search?q=${encodeURIComponent(`${district} ${sector} ${city}`)}`,
      googleRating: null,
      googleReviewCount: 0,
      googlePlaceId: "",
      googleBusinessPresence: "Google Business profili kontrol edilmeli",
      searchVisibilityScore: 72,
      adActivitySignal: "Orta düzey fırsat sinyali",
      keywordOpportunities: [`${district} ${sector}`, `${city} ${sector} fiyat`, `yakınımdaki ${sector}`],
      suggestedCampaignType: "Yerel Arama + Harita Reklamı",
      competitionLevel: "Orta"
    },
    {
      id: "google-demo-2",
      name: `${city} Yerel Dönüşüm Sinyali`,
      city,
      district,
      sector,
      website: "",
      phone: "",
      email: "",
      address: "",
      googleMapsUrl: `https://www.google.com/search?q=${encodeURIComponent(`${city} ${sector} reklam fırsatı`)}`,
      googleSearchUrl: `https://www.google.com/search?q=${encodeURIComponent(`${city} ${sector} reklam fırsatı`)}`,
      googleRating: null,
      googleReviewCount: 0,
      googlePlaceId: "",
      googleBusinessPresence: "Harita görünürlüğü geliştirilebilir",
      searchVisibilityScore: 61,
      adActivitySignal: "Landing page ve arama niyeti çalışılmalı",
      keywordOpportunities: [`${sector} kampanya`, `${sector} randevu`, `${district} en iyi ${sector}`],
      suggestedCampaignType: "Performans Maksimum + Marka Arama",
      competitionLevel: "Yüksek"
    }
  ];
}

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

function cleanProviderError(error: unknown) {
  return (error instanceof Error ? error.message : "AI sağlayıcısı çalıştırılamadı.")
    .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .slice(0, 260);
}

function providerEnvMissing(provider: AiProviderKey) {
  if (provider === "groq") return !process.env.GROQ_API_KEY ? "GROQ_API_KEY eksik." : "";
  if (provider === "gemini") return !(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) ? "GEMINI_API_KEY eksik." : "";
  if (provider === "openai") return !process.env.OPENAI_API_KEY ? "OPENAI_API_KEY eksik." : "";
  if (provider === "anthropic") return !process.env.ANTHROPIC_API_KEY ? "ANTHROPIC_API_KEY eksik." : "";
  if (provider === "openrouter") return !process.env.OPENROUTER_API_KEY ? "OPENROUTER_API_KEY eksik." : "";
  if (provider === "manus") return !(process.env.MANUS_API_KEY && process.env.MANUS_API_BASE_URL && process.env.MANUS_API_ENDPOINT) ? "Manus API yapılandırması eksik." : "";
  if (provider === "local" || provider === "ollama") return !process.env.OLLAMA_BASE_URL ? "OLLAMA_BASE_URL eksik." : "";
  return "";
}

async function googleAiExecutionMeta(requestedProvider: AiProviderKey, city: string, district: string, sector: string) {
  const prompt = `Google İstihbarat sağlayıcı doğrulaması yap. Bağlam: ${city} / ${district} / ${sector}. Kısa Türkçe teknik kontrol yanıtı üret.`;
  const fallback = `${city} ${district} ${sector} için Google Maps sinyalleri üzerinden analiz hazırlanıyor.`;
  if (requestedProvider !== "automatic" && requestedProvider !== "auto") {
    const missing = providerEnvMissing(requestedProvider);
    if (missing) {
      return aiExecutionMetadata({
        requestedProvider,
        actualProvider: "demo",
        model: "demo-local",
        fallbackReason: `${requestedProvider.toUpperCase()} manuel seçildi ancak ${missing} Bu nedenle Demo / Yerel Yedek Akış kullanıldı.`,
        providerError: missing,
        routerReason: "Manuel seçim yapıldığı için Auto Router devreye girmedi.",
        dataSources: ["Google Maps API", "Manuel sağlayıcı seçimi"]
      });
    }
    try {
      const result = await generateAiText(prompt, fallback, {
        active_ai_provider: requestedProvider === "ollama" ? "local" : requestedProvider,
        activeProvider: requestedProvider === "ollama" ? "local" : requestedProvider,
        active_ai_model: undefined,
        model: undefined,
        demoMode: requestedProvider === "demo",
        ai_mode: requestedProvider === "demo" ? "demo" : requestedProvider === "local" || requestedProvider === "ollama" ? "local" : "live"
      });
      return aiExecutionMetadata({
        requestedProvider,
        actualProvider: normalizeAiProvider(result.providerKey || result.provider),
        model: result.model,
        fallbackReason: result.providerKey && normalizeAiProvider(result.providerKey) !== normalizeAiProvider(requestedProvider) ? "Seçilen sağlayıcı hata verdiği için yedek akış kullanıldı." : null,
        routerReason: "Manuel seçim yapıldığı için sistem önce seçilen sağlayıcıyı çalıştırdı.",
        dataSources: ["Google Maps API", "Manuel sağlayıcı seçimi"]
      });
    } catch (error) {
      const reason = cleanProviderError(error);
      return aiExecutionMetadata({
        requestedProvider,
        actualProvider: "demo",
        model: "demo-local",
        fallbackReason: `${requestedProvider.toUpperCase()} manuel seçildi ancak çalıştırılamadı: ${reason}. Raporu bozmamak için Demo / Yerel Yedek Akış kullanıldı.`,
        providerError: reason,
        routerReason: "Manuel seçim yapıldığı için Auto Router devreye girmedi.",
        dataSources: ["Google Maps API", "Demo / Yerel Yedek Akış"]
      });
    }
  }
  try {
    const result = await generateAiText(prompt, fallback, {
      active_ai_provider: "automatic",
      activeProvider: "automatic",
      ai_provider_priority: ["gemini", "openai", "groq", "anthropic", "demo", "local"],
      demoMode: false,
      ai_mode: "live"
    });
    return aiExecutionMetadata({
      requestedProvider: "automatic",
      actualProvider: normalizeAiProvider(result.providerKey || result.provider),
      model: result.model,
      fallbackReason: ["demo", "local"].includes(String(result.providerKey || "")) ? "Canlı sağlayıcı kullanılamadığı için yedek akış kullanıldı." : null,
      routerReason: "Otomatik Seçim kullanıldı. Google İstihbarat görevi için Gemini ilk sırada, OpenAI ve Groq yedek olarak değerlendirildi.",
      dataSources: ["Google Maps API", "Auto Router"]
    });
  } catch (error) {
    const reason = cleanProviderError(error);
    return aiExecutionMetadata({
      requestedProvider: "automatic",
      actualProvider: "demo",
      model: "demo-local",
      fallbackReason: `Auto Router canlı sağlayıcı bulamadı: ${reason}. Demo / Yerel Yedek Akış kullanıldı.`,
      providerError: reason,
      routerReason: "Otomatik Seçim kullanıldı ancak canlı sağlayıcılar başarısız oldu.",
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
    const value = {
      warning: "Google API bağlantısı bulunamadı. Demo sonuçlar gösteriliyor.",
      ai: ai.fallbackUsed ? ai : aiExecutionMetadata({ requestedProvider, actualProvider: "demo", model: "google-analysis-demo", fallbackReason: "Google Maps API anahtarı eksik olduğu için demo sonuçlar gösterildi.", dataSources: ["Demo Google verisi"] }),
      results: demoGoogleResults(city, district, sector)
    };
    googleAnalysisCache.set(cacheKey, { expires: Date.now() + 1000 * 60 * 5, value });
    return NextResponse.json(value);
  }

  try {
    const params = new URLSearchParams({ query: `${sector} ${district} ${city}`, key, language: "tr", region: "tr" });
    const response = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`, { cache: "no-store" });
    const data = await response.json().catch(() => ({})) as { status?: string; results?: GooglePlace[] };
    if (!response.ok || !["OK", "ZERO_RESULTS"].includes(data.status)) {
      console.error("[google-analysis] Google API hatası", data);
      return NextResponse.json({
        warning: "Google API bağlantısı bulunamadı. Demo sonuçlar gösteriliyor.",
        ai: ai.fallbackUsed ? ai : aiExecutionMetadata({ requestedProvider, actualProvider: "demo", model: "google-analysis-demo", fallbackReason: "Google Maps API yanıtı alınamadığı için demo sonuçlar gösterildi.", dataSources: ["Demo Google verisi"] }),
        results: demoGoogleResults(city, district, sector)
      });
    }
    const places = (data.results || []).slice(0, 8);
    const results = await Promise.all(places.map(async (place: GooglePlace) => {
      const details = await getPlaceDetails(place.place_id, key).catch(() => ({}));
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
