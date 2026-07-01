/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { recordActivity } from "@/lib/activity-log";
import { scoreDiscoveredBusiness, type DiscoveredBusiness } from "@/lib/lead-scoring";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { requireModuleAccess } from "@/lib/permissions";

async function requireStaff() {
  return await requireModuleAccess("business_discovery") || requireModuleAccess("maps");
}

function textSearchUrl(query: string) {
  const key = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) throw new Error("Google Maps API anahtarı eksik.");
  const params = new URLSearchParams({ query, key, language: "tr", region: "tr" });
  return `https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`;
}

async function getPlaceDetails(placeId: string) {
  const key = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) throw new Error("Google Maps API anahtarı eksik.");
  const params = new URLSearchParams({
    place_id: placeId,
    fields: "formatted_phone_number,website,url,geometry,types,name,formatted_address",
    key,
    language: "tr"
  });
  const response = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${params}`, { cache: "no-store" });
  if (!response.ok) return {};
  const data = await response.json();
  return data.result || {};
}

function numberFilter(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clean(value: unknown) {
  return String(value || "").trim();
}

function phoneKey(value: unknown) {
  return clean(value).replace(/\D/g, "");
}

function opportunityPayload(business: Record<string, any>) {
  const scored = scoreDiscoveredBusiness(business);
  const heat = Number(scored.leadHeatScore || business.leadHeatScore || business.lead_heat_score || 0);
  const maturity = Number(scored.digitalMaturityScore || business.digitalMaturityScore || business.digital_maturity_score || 0);
  const reviews = Number(business.reviewCount || business.google_review_count || 0);
  const rating = Number(business.googleRating || business.google_rating || business.rating || 0);
  const websiteMissing = !business.website;
  const phoneMissing = !business.phone;
  const digitalGapScore = Math.min(100, Math.max(0, 100 - maturity + (websiteMissing ? 12 : 0) + (phoneMissing ? 6 : 0)));
  const adPotentialScore = Math.min(100, Math.round(heat * 0.7 + (rating >= 4 ? 8 : 0) + (reviews < 30 ? 10 : 0) + (websiteMissing ? 10 : 0)));
  const opportunityScore = Math.min(100, Math.round((heat + digitalGapScore + adPotentialScore) / 3));
  const aiSuggestion = websiteMissing
    ? "Web sitesi veya açılış sayfası teklifiyle başlanmalı; Google profil ve reklam potansiyeli birlikte anlatılmalı."
    : reviews < 25
      ? "Google yorum artırma ve yerel reklam paketiyle temas kurulmalı."
      : "Reklam performansı, teklif dili ve dönüşüm takibi üzerinden teklif hazırlanmalı.";
  return {
    ...scored,
    opportunityScore,
    digitalGapScore,
    adPotentialScore,
    crmStatus: business.crmStatus || "CRM’de yok",
    aiSuggestion
  };
}

function demoBusinesses(input: { city: string; district: string; businessType: string }) {
  const city = input.city || "Manisa";
  const district = input.district || "Yunusemre";
  const category = input.businessType || "güzellik merkezi";
  return [
    {
      placeId: `demo-${city}-${district}-1`,
      name: `${district} ${category} Plus`,
      city,
      district,
      address: `${district}, ${city}`,
      phone: "0236 000 00 01",
      website: "",
      rating: 4.6,
      googleRating: 4.6,
      reviewCount: 18,
      category,
      source: "Demo Veri",
      isDemo: true
    },
    {
      placeId: `demo-${city}-${district}-2`,
      name: `${city} ${category} Atölyesi`,
      city,
      district,
      address: `${district} merkez, ${city}`,
      phone: "0236 000 00 02",
      website: `https://example.com/${encodeURIComponent(category.replace(/\s+/g, "-"))}`,
      rating: 4.2,
      googleRating: 4.2,
      reviewCount: 74,
      category,
      source: "Demo Veri",
      isDemo: true
    },
    {
      placeId: `demo-${city}-${district}-3`,
      name: `${district} Yeni ${category}`,
      city,
      district,
      address: `${district} cadde, ${city}`,
      phone: "",
      website: "",
      rating: 3.8,
      googleRating: 3.8,
      reviewCount: 7,
      category,
      source: "Demo Veri",
      isDemo: true
    }
  ].map((business) => ({ ...business, ...opportunityPayload(business) }));
}

function applyDiscoveryFilters(
  businesses: Array<Record<string, any>>,
  filters: {
    minimumRating: number;
    minimumReviewCount: number;
    website: string;
    phone: string;
    hideSaved?: boolean;
    knownPlaceIds?: Set<string>;
    instagram?: string;
    highOpportunity?: boolean;
    highAdPotential?: boolean;
  }
) {
  return businesses.filter((business) => {
    if (filters.hideSaved && business.placeId && filters.knownPlaceIds?.has(business.placeId)) return false;
    if (Number(business.googleRating || business.rating || 0) < filters.minimumRating) return false;
    if (Number(business.reviewCount || 0) < filters.minimumReviewCount) return false;
    if (filters.website === "var" && !business.website) return false;
    if (filters.website === "yok" && business.website) return false;
    if (filters.phone === "var" && !business.phone) return false;
    if (filters.phone === "yok" && business.phone) return false;
    if (filters.instagram === "var" && !String(business.website || "").toLocaleLowerCase("tr-TR").includes("instagram")) return false;
    if (filters.instagram === "yok" && String(business.website || "").toLocaleLowerCase("tr-TR").includes("instagram")) return false;
    if (filters.highOpportunity && Number(business.opportunityScore || business.leadHeatScore || 0) < 70) return false;
    if (filters.highAdPotential && Number(business.adPotentialScore || 0) < 70) return false;
    return true;
  });
}

async function knownPlaceIds(hideSaved: boolean) {
  if (!hideSaved || !hasSupabaseConfig()) return new Set<string>();
  const rows = await supabaseRest<Array<{ google_place_id?: string }>>("leads?select=google_place_id&google_place_id=not.is.null").catch(() => []);
  return new Set(rows.map((lead) => lead.google_place_id).filter(Boolean) as string[]);
}

export async function POST(request: Request) {
  if (!(await requireStaff())) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });

  const body = await request.json();
  const keyword = clean(body.keyword || body.businessType);
  const city = clean(body.city);
  const district = clean(body.district);
  const neighborhood = clean(body.neighborhood);
  const sector = clean(body.sector || body.businessType);
  const minimumRating = numberFilter(body.minimumRating || body.minRating);
  const minimumReviewCount = numberFilter(body.minimumReviewCount || body.minReviewCount);
  const website = clean(body.website || body.websiteStatus);
  const phone = clean(body.phone || body.phoneStatus);
  const instagram = clean(body.instagram || body.instagramStatus);
  const hideSaved = Boolean(body.hideSaved);
  const highOpportunity = Boolean(body.highOpportunity);
  const highAdPotential = Boolean(body.highAdPotential);
  const limit = Math.max(1, Math.min(50, Number(body.limit || body.requestedCount || body.count || 20) || 20));

  if (!keyword && !sector) return NextResponse.json({ error: "İşletme / sektör alanı zorunludur." }, { status: 400 });
  if (!city) return NextResponse.json({ error: "İl seçin veya yazın." }, { status: 400 });

  const filters = { minimumRating, minimumReviewCount, website, phone, instagram, hideSaved, highOpportunity, highAdPotential, knownPlaceIds: await knownPlaceIds(hideSaved) };
  const demoFallback = (apiError?: string) => {
    const businesses = applyDiscoveryFilters(demoBusinesses({ city, district, businessType: sector || keyword }), filters);
    return NextResponse.json({
      businesses,
      count: businesses.length,
      isDemoFallback: true,
      warning: "Google Maps verisi alınamadı. Demo veri ile devam ediliyor.",
      apiError
    });
  };

  if (!(process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY)) return demoFallback("Google Maps API anahtarı eksik.");

  try {
    const query = [keyword, sector, neighborhood, district, city].filter(Boolean).join(" ");
    const response = await fetch(textSearchUrl(query), { cache: "no-store" });
    const data = await response.json();
    if (!response.ok || !["OK", "ZERO_RESULTS"].includes(data.status)) {
      console.error("[business-discovery] Google Maps arama hatası", { status: data.status, error: data.error_message });
      return demoFallback(data.error_message || "Google Maps işletme araması başarısız oldu.");
    }

    const baseResults = (data.results || []).slice(0, limit);
    const businesses = (await Promise.all(baseResults.map(async (place: any) => {
      const details = await getPlaceDetails(place.place_id).catch(() => ({}));
      const business = {
        placeId: place.place_id,
        name: place.name,
        city,
        district,
        neighborhood,
        address: place.formatted_address || "",
        phone: details.formatted_phone_number || "",
        website: details.website || "",
        googleMapsUrl: details.url || `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
        rating: place.rating ?? null,
        googleRating: place.rating ?? null,
        reviewCount: Number(place.user_ratings_total || 0),
        category: sector || (Array.isArray(place.types) ? place.types.slice(0, 3).join(", ") : ""),
        latitude: details.geometry?.location?.lat ?? place.geometry?.location?.lat ?? null,
        longitude: details.geometry?.location?.lng ?? place.geometry?.location?.lng ?? null,
        sourceQuery: query,
        source: "Google Maps",
        isDemo: false
      };
      return { ...business, ...opportunityPayload(business) };
    }))).filter(Boolean);
    const filtered = applyDiscoveryFilters(businesses, filters);
    return NextResponse.json({ businesses: filtered, count: filtered.length });
  } catch (error) {
    console.error("[business-discovery] İşletme araması çöktü", error);
    return demoFallback(error instanceof Error ? error.message : "İşletme araması başarısız oldu.");
  }
}

export async function PUT(request: Request) {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı. Canlı ortamda kaydetme çalışmaz." }, { status: 503 });

  const body = await request.json();
  const businesses = Array.isArray(body.businesses) ? businessesFromBody(body.businesses) : [];
  if (!businesses.length) return NextResponse.json({ error: "Kaydedilecek işletme seçin." }, { status: 400 });

  try {
    const existing = await supabaseRest<Array<{ google_place_id?: string; company?: string; phone?: string }>>("leads?select=google_place_id,company,phone");
    const knownPlaceIds = new Set(existing.map((lead) => lead.google_place_id).filter(Boolean));
    const knownNamePhones = new Set(existing.map((lead) => `${clean(lead.company).toLocaleLowerCase("tr-TR")}::${phoneKey(lead.phone)}`).filter((key) => key !== "::"));
    const rows = businesses.filter((business) => {
      const namePhone = `${clean(business.name).toLocaleLowerCase("tr-TR")}::${phoneKey(business.phone)}`;
      return !((business.placeId && knownPlaceIds.has(business.placeId)) || (business.name && business.phone && knownNamePhones.has(namePhone)));
    }).map((business) => {
      const scores = scoreDiscoveredBusiness(business);
      return {
        source: "Müşteri Bulucu",
        company: business.name || "",
        phone: business.phone || "",
        website: business.website || "",
        business_type: business.category || body.sector || "",
        city: business.city || body.city || "",
        district: business.district || body.district || "",
        sector: business.category || body.sector || "",
        address: business.address || "",
        google_rating: business.googleRating ?? null,
        google_review_count: Number(business.reviewCount || 0),
        google_place_id: business.placeId || "",
        google_maps_url: business.googleMapsUrl || business.google_maps_url || (business.placeId ? `https://www.google.com/maps/place/?q=place_id:${business.placeId}` : ""),
        opportunity_score: business.opportunityScore || scores.leadHeatScore,
        digital_gap_score: business.digitalGapScore || Math.max(0, 100 - Number(scores.digitalMaturityScore || 0)),
        ad_potential_score: business.adPotentialScore || scores.leadHeatScore,
        digital_maturity_score: scores.digitalMaturityScore,
        lead_heat_score: scores.leadHeatScore,
        notes: [business.notes, body.notes, "Google Maps işletme keşfi ile kaydedildi.", ...(scores.scoreReasons?.heat || [])].filter(Boolean).join("\n"),
        status: "Yeni"
      };
    });
    if (!rows.length) return NextResponse.json({ leads: [], count: 0, skipped: businesses.length, message: "Seçilen işletmeler daha önce CRM listesine eklenmiş." });
    let leads;
    try {
      leads = await supabaseRest<any[]>("leads", { method: "POST", body: JSON.stringify(rows) });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("schema cache") && !message.includes("column")) throw error;
      leads = await supabaseRest<any[]>("leads", { method: "POST", body: JSON.stringify(rows.map(stripOptionalDiscoveryColumns)) });
    }
    await recordActivity({ session, action: "Oluşturma", entity: "Müşteri Bulucu", details: { message: `${leads.length} işletme CRM listesine eklendi`, count: leads.length } });
    return NextResponse.json({ leads, count: leads.length, skipped: businesses.length - leads.length, message: `${leads.length} işletme CRM listesine eklendi.` });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    console.error("[business-discovery] Lead kayıt hatası", safe.detail);
    return NextResponse.json({ error: safe.title, supabaseError: safe.detail }, { status: 500 });
  }
}

function businessesFromBody(value: unknown[]): DiscoveredBusiness[] {
  return value.map((business: any) => ({
    ...business,
    googleRating: business.googleRating ?? business.rating ?? null,
    reviewCount: Number(business.reviewCount || business.google_review_count || 0),
    category: business.category || business.business_type || business.sector || ""
  }));
}

function stripOptionalDiscoveryColumns(record: Record<string, any>) {
  const fallback = { ...record };
  delete fallback.city;
  delete fallback.district;
  delete fallback.sector;
  delete fallback.local_opportunity_notes;
  delete fallback.google_maps_url;
  delete fallback.opportunity_score;
  delete fallback.digital_gap_score;
  delete fallback.ad_potential_score;
  return fallback;
}
