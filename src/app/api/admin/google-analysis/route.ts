import { NextResponse } from "next/server";
import { aiMetadata } from "@/lib/ai-provider";
import { requireModuleAccess } from "@/lib/permissions";

const googleAnalysisCache = new Map<string, { expires: number; value: any }>();

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

function scorePlace(place: any) {
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
  if (!response.ok) return {};
  const data = await response.json();
  return data.result || {};
}

export async function POST(request: Request) {
  const session = await requireModuleAccess("google-analiz");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const city = String(body.city || "Manisa");
  const district = String(body.district || "Yunusemre");
  const sector = String(body.sector || "Restoran");
  const key = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY;
  const cacheKey = `${city}:${district}:${sector}`.toLocaleLowerCase("tr");
  const cached = googleAnalysisCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return NextResponse.json(cached.value);

  if (!key) {
    const value = {
      warning: "Google API bağlantısı bulunamadı. Demo sonuçlar gösteriliyor.",
      ai: aiMetadata("demo", "google-analysis-demo"),
      results: demoGoogleResults(city, district, sector)
    };
    googleAnalysisCache.set(cacheKey, { expires: Date.now() + 1000 * 60 * 5, value });
    return NextResponse.json(value);
  }

  try {
    const params = new URLSearchParams({ query: `${sector} ${district} ${city}`, key, language: "tr", region: "tr" });
    const response = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok || !["OK", "ZERO_RESULTS"].includes(data.status)) {
      console.error("[google-analysis] Google API hatası", data);
      return NextResponse.json({
        warning: "Google API bağlantısı bulunamadı. Demo sonuçlar gösteriliyor.",
        ai: aiMetadata("demo", "google-analysis-demo"),
        results: demoGoogleResults(city, district, sector)
      });
    }
    const places = (data.results || []).slice(0, 8);
    const results = await Promise.all(places.map(async (place: any) => {
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
    const value = { ai: aiMetadata("local", "google-maps-signals"), results };
    googleAnalysisCache.set(cacheKey, { expires: Date.now() + 1000 * 60 * 5, value });
    return NextResponse.json(value);
  } catch (error) {
    console.error("[google-analysis] Analiz hatası", error);
    return NextResponse.json({ error: "Analiz sırasında bir hata oluştu." }, { status: 500 });
  }
}
