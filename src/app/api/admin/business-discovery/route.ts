/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { recordActivity } from "@/lib/activity-log";
import {
  buildOutreachMessages,
  buildSalesRecommendation,
  calculateHkOpportunityScore,
  calculateMetaSuitability,
  evaluateAdvertisingSignals,
  getHkOpportunityTier,
  scoreDiscoveredBusiness,
  type AdvertisingEvidence,
  type DiscoveredBusiness
} from "@/lib/lead-scoring";
import { normalizeSectorInput } from "@/lib/sector-signal";
import { scanWebsiteForAdSignals } from "@/lib/website-signal-scan";
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

/**
 * Attaches every derived intelligence field a result card / detail panel /
 * CRM transfer needs: the legacy heat/maturity scores (scoreDiscoveredBusiness),
 * the canonical HK Opportunity Score and tier, advertising evidence (real
 * website scan, never fabricated), Meta suitability, a sales recommendation,
 * and outreach message drafts. All computed once, here, and reused
 * everywhere downstream — no duplicated scoring logic.
 */
async function enrichBusiness(business: DiscoveredBusiness): Promise<Record<string, any>> {
  const scored = scoreDiscoveredBusiness(business);
  const scan = business.isDemo
    ? { metaPixelDetected: null, googleTagDetected: null, whatsappLinkDetected: null, scanFailed: false, checkedAt: new Date().toISOString() }
    : await scanWebsiteForAdSignals(business.website).catch(() => ({ metaPixelDetected: null, googleTagDetected: null, whatsappLinkDetected: null, scanFailed: true, checkedAt: new Date().toISOString() }));
  const advertising: AdvertisingEvidence = evaluateAdvertisingSignals({
    website: business.website,
    metaPixelDetected: scan.metaPixelDetected,
    googleTagDetected: scan.googleTagDetected,
    scanFailed: scan.scanFailed,
    checkedAt: scan.checkedAt
  });
  const businessWithWhatsapp: DiscoveredBusiness = {
    ...business,
    whatsapp: business.whatsapp || (scan.whatsappLinkDetected ? business.phone : undefined)
  };
  const opportunityScore = calculateHkOpportunityScore(businessWithWhatsapp, advertising);
  const tier = getHkOpportunityTier(opportunityScore);
  const metaSuitability = calculateMetaSuitability(businessWithWhatsapp);
  const salesRecommendation = buildSalesRecommendation(businessWithWhatsapp, opportunityScore);
  const outreach = buildOutreachMessages(businessWithWhatsapp, opportunityScore);

  const websiteMissing = !business.website;
  const digitalGapScore = Math.min(100, Math.max(0, 100 - scored.digitalMaturityScore + (websiteMissing ? 12 : 0) + (!business.phone ? 6 : 0)));

  return {
    ...businessWithWhatsapp,
    ...scored,
    opportunityScore,
    hkOpportunityTier: tier.key,
    hkOpportunityLabel: tier.label,
    hkOpportunityAction: tier.recommendedAction,
    digitalGapScore,
    adPotentialScore: scored.leadHeatScore,
    metaSuitabilityScore: metaSuitability.score,
    metaSuitabilityReasons: metaSuitability.reasons,
    metaSuitabilityNote: metaSuitability.primaryChannelNote,
    metaAdsStatus: advertising.metaAdsStatus,
    metaAdsEvidence: advertising.metaAdsEvidence,
    googleAdsStatus: advertising.googleAdsStatus,
    googleAdsEvidence: advertising.googleAdsEvidence,
    metaPixelDetected: advertising.metaPixelDetected,
    googleTagDetected: advertising.googleTagDetected,
    advertisingConfidence: advertising.advertisingConfidence,
    advertisingSource: advertising.advertisingSource,
    advertisingLastCheckedAt: advertising.advertisingLastCheckedAt,
    salesRecommendation,
    outreach,
    crmStatus: business.crmStatus || "CRM'de yok"
  };
}

function demoBusinesses(input: { city: string; district: string; businessType: string }) {
  const city = input.city || "Manisa";
  const district = input.district || "";
  const districtLabel = district || "Yunusemre";
  const category = input.businessType || "güzellik merkezi";
  return [
    {
      placeId: `demo-${city}-${districtLabel}-1`,
      name: `${districtLabel} ${category} Plus`,
      city,
      district,
      address: `${districtLabel}, ${city}`,
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
      placeId: `demo-${city}-${districtLabel}-2`,
      name: `${city} ${category} Atölyesi`,
      city,
      district,
      address: `${districtLabel} merkez, ${city}`,
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
      placeId: `demo-${city}-${districtLabel}-3`,
      name: `${districtLabel} Yeni ${category}`,
      city,
      district,
      address: `${districtLabel} cadde, ${city}`,
      phone: "",
      website: "",
      rating: 3.8,
      googleRating: 3.8,
      reviewCount: 7,
      category,
      source: "Demo Veri",
      isDemo: true
    }
  ];
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

/** Default list order: highest HK Opportunity Score first. */
function sortByOpportunity(businesses: Array<Record<string, any>>) {
  return [...businesses].sort((a, b) => Number(b.opportunityScore || 0) - Number(a.opportunityScore || 0));
}

async function knownPlaceIds(hideSaved: boolean) {
  if (!hideSaved || !hasSupabaseConfig()) return new Set<string>();
  const rows = await supabaseRest<Array<{ google_place_id?: string }>>("leads?select=google_place_id&google_place_id=not.is.null").catch(() => []);
  return new Set(rows.map((lead) => lead.google_place_id).filter(Boolean) as string[]);
}

export async function POST(request: Request) {
  if (!(await requireStaff())) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });

  const body = await request.json();
  const keyword = clean(body.keyword);
  const city = clean(body.city);
  const district = clean(body.district);
  const neighborhood = clean(body.neighborhood);
  // Sektör is required independently of anahtar kelime — a keyword alone
  // (e.g. only "protez tırnak" typed into the keyword box with no sector)
  // must not satisfy the requirement, matching the non-negotiable form spec.
  const sector = normalizeSectorInput(body.sector || body.businessType);
  const minimumRating = numberFilter(body.minimumRating || body.minRating);
  const minimumReviewCount = numberFilter(body.minimumReviewCount || body.minReviewCount);
  const website = clean(body.website || body.websiteStatus);
  const phone = clean(body.phone || body.phoneStatus);
  const instagram = clean(body.instagram || body.instagramStatus);
  const hideSaved = Boolean(body.hideSaved);
  const highOpportunity = Boolean(body.highOpportunity);
  const highAdPotential = Boolean(body.highAdPotential);
  const limit = Math.max(1, Math.min(50, Number(body.limit || body.requestedCount || body.count || 20) || 20));

  if (!sector) return NextResponse.json({ error: "Sektör alanı zorunludur." }, { status: 400 });
  if (!city) return NextResponse.json({ error: "İl seçin veya yazın." }, { status: 400 });

  const filters = { minimumRating, minimumReviewCount, website, phone, instagram, hideSaved, highOpportunity, highAdPotential, knownPlaceIds: await knownPlaceIds(hideSaved) };
  const districtLabel = district || "Tüm ilçeler";

  const demoFallback = async (apiError?: string) => {
    const enriched = await Promise.all(demoBusinesses({ city, district, businessType: sector }).map(enrichBusiness));
    const businesses = sortByOpportunity(applyDiscoveryFilters(enriched, filters));
    return NextResponse.json({
      businesses,
      count: businesses.length,
      districtLabel,
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
    const businesses = await Promise.all(baseResults.map(async (place: any) => {
      const details = await getPlaceDetails(place.place_id).catch(() => ({}));
      const business: DiscoveredBusiness = {
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
      return enrichBusiness(business);
    }));
    // A real, legitimate zero-results response (Google returned ZERO_RESULTS
    // or every result was filtered out) is intentionally returned with no
    // "warning"/"isDemoFallback" flag — the frontend must be able to tell
    // this apart from an API failure, which always sets those fields.
    const filtered = sortByOpportunity(applyDiscoveryFilters(businesses, filters));
    return NextResponse.json({ businesses: filtered, count: filtered.length, districtLabel });
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
    const existing = await supabaseRest<Array<{ id: string; google_place_id?: string; company?: string; phone?: string; website?: string; district?: string }>>("leads?select=id,google_place_id,company,phone,website,district");
    const knownPlaceIds = new Map(existing.filter((lead) => lead.google_place_id).map((lead) => [lead.google_place_id as string, lead]));
    const knownNamePhones = new Map(existing.filter((lead) => lead.company && lead.phone).map((lead) => [`${clean(lead.company).toLocaleLowerCase("tr-TR")}::${phoneKey(lead.phone)}`, lead]));
    const knownWebsites = new Map(existing.filter((lead) => lead.website).map((lead) => [clean(lead.website).toLocaleLowerCase("tr-TR").replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, ""), lead]));
    const knownNameDistricts = new Map(existing.filter((lead) => lead.company && lead.district).map((lead) => [`${clean(lead.company).toLocaleLowerCase("tr-TR")}::${clean(lead.district).toLocaleLowerCase("tr-TR")}`, lead]));

    function findDuplicate(business: DiscoveredBusiness) {
      if (business.placeId && knownPlaceIds.has(business.placeId)) return knownPlaceIds.get(business.placeId);
      const namePhone = `${clean(business.name).toLocaleLowerCase("tr-TR")}::${phoneKey(business.phone)}`;
      if (business.name && business.phone && knownNamePhones.has(namePhone)) return knownNamePhones.get(namePhone);
      const website = clean(business.website).toLocaleLowerCase("tr-TR").replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
      if (website && knownWebsites.has(website)) return knownWebsites.get(website);
      const nameDistrict = `${clean(business.name).toLocaleLowerCase("tr-TR")}::${clean(business.district || body.district).toLocaleLowerCase("tr-TR")}`;
      if (business.name && (business.district || body.district) && knownNameDistricts.has(nameDistrict)) return knownNameDistricts.get(nameDistrict);
      return null;
    }

    const duplicates = businesses.map((business) => ({ business, existingLead: findDuplicate(business) })).filter((entry) => entry.existingLead);
    const rows = businesses.filter((business) => !findDuplicate(business)).map((business) => {
      const scores = scoreDiscoveredBusiness(business);
      const opportunityScore = business.opportunityScore ?? calculateHkOpportunityScore(business);
      return {
        source: "Google Maps / Müşteri Keşfi",
        company: business.name || "",
        phone: business.phone || "",
        whatsapp: business.whatsapp || "",
        website: business.website || "",
        instagram: business.instagram || "",
        business_type: business.category || body.sector || "",
        city: business.city || body.city || "",
        district: business.district || body.district || "",
        neighborhood: business.neighborhood || body.neighborhood || "",
        sector: business.category || body.sector || "",
        address: business.address || "",
        google_rating: business.googleRating ?? null,
        google_review_count: Number(business.reviewCount || 0),
        google_place_id: business.placeId || "",
        google_maps_url: business.googleMapsUrl || business.google_maps_url || (business.placeId ? `https://www.google.com/maps/place/?q=place_id:${business.placeId}` : ""),
        opportunity_score: opportunityScore,
        digital_gap_score: business.digitalGapScore ?? Math.max(0, 100 - Number(scores.digitalMaturityScore || 0)),
        ad_potential_score: business.adPotentialScore ?? scores.leadHeatScore,
        meta_suitability_score: business.metaSuitabilityScore ?? null,
        digital_maturity_score: scores.digitalMaturityScore,
        lead_heat_score: scores.leadHeatScore,
        meta_ads_status: business.metaAdsStatus || null,
        meta_ads_evidence: business.metaAdsEvidence || null,
        google_ads_status: business.googleAdsStatus || null,
        google_ads_evidence: business.googleAdsEvidence || null,
        meta_pixel_detected: business.metaPixelDetected ?? null,
        google_tag_detected: business.googleTagDetected ?? null,
        advertising_confidence: business.advertisingConfidence || null,
        advertising_source: business.advertisingSource || null,
        advertising_last_checked_at: business.advertisingLastCheckedAt || null,
        discovery_evidence: {
          salesRecommendation: business.salesRecommendation || null,
          outreach: business.outreach || null,
          metaSuitabilityReasons: business.metaSuitabilityReasons || [],
          metaSuitabilityNote: business.metaSuitabilityNote || "",
          scoreReasons: scores.scoreReasons || {},
          scoreBreakdown: scores.scoreBreakdown || {}
        },
        discovery_last_checked_at: new Date().toISOString(),
        notes: [business.notes, body.notes, "Google Maps işletme keşfi ile kaydedildi.", ...(scores.scoreReasons?.heat || [])].filter(Boolean).join("\n"),
        status: "Yeni Lead",
        lead_stage: "Yeni Lead"
      };
    });

    if (!rows.length) {
      return NextResponse.json({
        leads: [],
        count: 0,
        skipped: businesses.length,
        duplicates: duplicates.map((entry) => ({ name: entry.business.name, existingLeadId: entry.existingLead?.id })),
        message: "Seçilen işletmeler daha önce CRM listesine eklenmiş."
      });
    }
    let leads;
    try {
      leads = await supabaseRest<any[]>("leads", { method: "POST", body: JSON.stringify(rows) });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("schema cache") && !message.includes("column")) throw error;
      leads = await supabaseRest<any[]>("leads", { method: "POST", body: JSON.stringify(rows.map(stripOptionalDiscoveryColumns)) });
    }
    await recordActivity({ session, action: "Oluşturma", entity: "Müşteri Bulucu", details: { message: `${leads.length} işletme CRM listesine eklendi`, count: leads.length } });
    return NextResponse.json({
      leads,
      count: leads.length,
      skipped: businesses.length - leads.length,
      duplicates: duplicates.map((entry) => ({ name: entry.business.name, existingLeadId: entry.existingLead?.id })),
      message: `${leads.length} işletme CRM listesine eklendi.${duplicates.length ? ` ${duplicates.length} işletme zaten CRM'de kayıtlı olduğu için atlandı.` : ""}`
    });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    console.error("[business-discovery] Lead kayıt hatası", safe.detail);
    return NextResponse.json({ error: safe.title, supabaseError: safe.detail }, { status: 500 });
  }
}

function businessesFromBody(value: unknown[]): DiscoveredBusiness[] {
  return value.map((business: any) => ({
    ...business,
    name: String(business.name || business.company || "İsimsiz işletme"),
    googleRating: business.googleRating ?? business.rating ?? null,
    reviewCount: Number(business.reviewCount || business.google_review_count || 0),
    category: business.category || business.business_type || business.sector || ""
  }));
}

function stripOptionalDiscoveryColumns(record: Record<string, any>) {
  const fallback = { ...record };
  delete fallback.city;
  delete fallback.district;
  delete fallback.neighborhood;
  delete fallback.whatsapp;
  delete fallback.sector;
  delete fallback.local_opportunity_notes;
  delete fallback.google_maps_url;
  delete fallback.opportunity_score;
  delete fallback.digital_gap_score;
  delete fallback.ad_potential_score;
  delete fallback.meta_suitability_score;
  delete fallback.lead_stage;
  delete fallback.meta_ads_status;
  delete fallback.meta_ads_evidence;
  delete fallback.google_ads_status;
  delete fallback.google_ads_evidence;
  delete fallback.meta_pixel_detected;
  delete fallback.google_tag_detected;
  delete fallback.advertising_confidence;
  delete fallback.advertising_source;
  delete fallback.advertising_last_checked_at;
  delete fallback.discovery_evidence;
  delete fallback.discovery_last_checked_at;
  return fallback;
}
