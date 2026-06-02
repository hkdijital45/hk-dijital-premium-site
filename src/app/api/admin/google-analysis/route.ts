import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";

function demoGoogleResults(city: string, district: string, sector: string) {
  return [
    {
      id: "google-demo-1",
      name: `${district} ${sector} Arama Fırsatı`,
      website: "",
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
      website: "",
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
    fields: "website,business_status",
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

  if (!key) {
    return NextResponse.json({
      warning: "Google API bağlantısı bulunamadı. Demo sonuçlar gösteriliyor.",
      results: demoGoogleResults(city, district, sector)
    });
  }

  try {
    const params = new URLSearchParams({ query: `${sector} ${district} ${city}`, key, language: "tr", region: "tr" });
    const response = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok || !["OK", "ZERO_RESULTS"].includes(data.status)) {
      console.error("[google-analysis] Google API hatası", data);
      return NextResponse.json({
        warning: "Google API bağlantısı bulunamadı. Demo sonuçlar gösteriliyor.",
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
        website: details.website || "",
        googleBusinessPresence: place.business_status === "OPERATIONAL" ? "Aktif Google Business varlığı" : "Profil durumu kontrol edilmeli",
        searchVisibilityScore: visibility,
        adActivitySignal: visibility >= 75 ? "Yüksek ticari niyet ve reklam fırsatı" : visibility >= 55 ? "Orta düzey reklam fırsatı" : "Düşük görünürlük, temel optimizasyon önerilir",
        keywordOpportunities: [`${district} ${sector}`, `${city} ${sector}`, `${sector} fiyatları`, `${sector} yakınında`],
        suggestedCampaignType: visibility >= 75 ? "Arama Ağı + Yeniden Pazarlama" : "Yerel Arama + Harita Reklamı",
        competitionLevel: visibility >= 80 ? "Yüksek" : visibility >= 55 ? "Orta" : "Düşük"
      };
    }));
    return NextResponse.json({ results });
  } catch (error) {
    console.error("[google-analysis] Analiz hatası", error);
    return NextResponse.json({ error: "Analiz sırasında bir hata oluştu." }, { status: 500 });
  }
}
