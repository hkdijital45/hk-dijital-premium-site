/* eslint-disable @typescript-eslint/no-explicit-any */
// Canonical Müşteri Keşfi (Google Maps/Places business discovery) engine —
// extracted from src/app/api/admin/business-discovery/route.ts so the
// admin UI route's search/enrich/dedupe/save logic lives in one place.
// Behavior here is byte-for-byte the same logic the route previously had
// inline. (Previously also reused by a Claude MCP customer-discovery
// integration — search_customer_discovery/get_customer_discovery_candidate/
// save_discovery_as_lead — which has been removed; saveDiscoveredBusinessesAsLeads
// is still shared with the admin route's own Lead'e Kaydet action.)
import { recordActivity } from "@/lib/activity-log";
import type { AppSession } from "@/lib/auth";
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
import { dedupePlacesById } from "@/lib/discovery-dedupe";
import { scanWebsiteForAdSignals } from "@/lib/website-signal-scan";
import { buildInstagramVerification, computeHkDigitalNeedLevel } from "@/lib/instagram-verification";
import { DISCOVERY_WORKFLOW_STATUS } from "@/lib/discovery-workflow";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

export class DiscoveryConfigError extends Error {}
export class DiscoveryApiError extends Error {
  apiError?: string;
  status: number;
  constructor(message: string, apiError?: string, status = 502) {
    super(message);
    this.apiError = apiError;
    this.status = status;
  }
}

const GOOGLE_TEXT_SEARCH_PAGE_SIZE = 20;
const GOOGLE_TEXT_SEARCH_MAX_PAGES = 3;
const NEXT_PAGE_TOKEN_DELAY_MS = 2100;

function googleMapsKey(): string {
  const key = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) throw new DiscoveryConfigError("Google Maps API anahtarı eksik.");
  return key;
}

async function fetchTextSearchPage(params: URLSearchParams) {
  const response = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`, { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, data };
}

async function fetchTextSearchResults(query: string, targetCount: number): Promise<{ pages: any[]; firstPageFailed: boolean }> {
  const key = googleMapsKey();
  const first = await fetchTextSearchPage(new URLSearchParams({ query, key, language: "tr", region: "tr" }));
  if (!first.ok || !["OK", "ZERO_RESULTS"].includes(first.data.status)) return { pages: [first.data], firstPageFailed: true };

  const pages = [first.data];
  let collected = (first.data.results || []).length;
  let nextPageToken = first.data.next_page_token;
  let pagesFetched = 1;

  while (nextPageToken && collected < targetCount && pagesFetched < GOOGLE_TEXT_SEARCH_MAX_PAGES) {
    await new Promise((resolve) => setTimeout(resolve, NEXT_PAGE_TOKEN_DELAY_MS));
    const next = await fetchTextSearchPage(new URLSearchParams({ pagetoken: nextPageToken, key, language: "tr", region: "tr" }));
    pagesFetched += 1;
    if (!next.ok || next.data.status !== "OK") break;
    pages.push(next.data);
    collected += (next.data.results || []).length;
    nextPageToken = next.data.next_page_token;
  }

  return { pages, firstPageFailed: false };
}

async function getPlaceDetails(placeId: string) {
  const key = googleMapsKey();
  const params = new URLSearchParams({
    place_id: placeId,
    fields: "formatted_phone_number,website,url,geometry,types,name,formatted_address,rating,user_ratings_total",
    key,
    language: "tr"
  });
  const response = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${params}`, { cache: "no-store" });
  if (!response.ok) return {};
  const data = await response.json();
  return data.result || {};
}

export function clean(value: unknown) {
  return String(value || "").trim();
}

export function phoneKey(value: unknown) {
  return clean(value).replace(/\D/g, "");
}

function numberFilter(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function enrichBusiness(business: DiscoveredBusiness): Promise<Record<string, any>> {
  const scored = scoreDiscoveredBusiness(business);
  const scan = await scanWebsiteForAdSignals(business.website).catch(() => ({ metaPixelDetected: null, googleTagDetected: null, whatsappLinkDetected: null, instagramProfile: null, scanFailed: true, checkedAt: new Date().toISOString() }));
  const advertising: AdvertisingEvidence = evaluateAdvertisingSignals({
    website: business.website,
    metaPixelDetected: scan.metaPixelDetected,
    googleTagDetected: scan.googleTagDetected,
    scanFailed: scan.scanFailed,
    checkedAt: scan.checkedAt
  });
  const businessWithWhatsapp: DiscoveredBusiness = {
    ...business,
    whatsapp: business.whatsapp || (scan.whatsappLinkDetected ? business.phone : undefined),
    instagram: business.instagram || scan.instagramProfile?.url || undefined
  };
  const instagramVerification = buildInstagramVerification(scan.instagramProfile, scan.checkedAt);
  const hkDigitalNeed = computeHkDigitalNeedLevel({
    hasWebsite: Boolean(business.website),
    websiteScanFailed: scan.scanFailed,
    instagramFound: instagramVerification.profileFound,
    metaPixelDetected: scan.metaPixelDetected,
    googleTagDetected: scan.googleTagDetected,
    googleRating: typeof business.googleRating === "number" ? business.googleRating : typeof business.rating === "number" ? business.rating : null,
    reviewCount: Number(business.reviewCount || 0)
  });
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
    crmStatus: business.crmStatus || "CRM'de yok",
    instagramVerification,
    hkDigitalNeedLevel: hkDigitalNeed.level,
    hkDigitalNeedReasons: hkDigitalNeed.reasons
  };
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

function sortByOpportunity(businesses: Array<Record<string, any>>) {
  return [...businesses].sort((a, b) => Number(b.opportunityScore || 0) - Number(a.opportunityScore || 0));
}

async function knownPlaceIds(hideSaved: boolean) {
  if (!hideSaved || !hasSupabaseConfig()) return new Set<string>();
  const rows = await supabaseRest<Array<{ google_place_id?: string }>>("leads?select=google_place_id&google_place_id=not.is.null").catch(() => []);
  return new Set(rows.map((lead) => lead.google_place_id).filter(Boolean) as string[]);
}

export type DiscoverySearchParams = {
  keyword?: string;
  city: string;
  district?: string;
  neighborhood?: string;
  sector?: string;
  businessType?: string;
  minimumRating?: number;
  minimumReviewCount?: number;
  website?: string;
  phone?: string;
  instagram?: string;
  hideSaved?: boolean;
  highOpportunity?: boolean;
  highAdPotential?: boolean;
  limit?: number;
};

export type DiscoverySearchResult = {
  businesses: Array<Record<string, any>>;
  count: number;
  totalFound: number;
  hiddenAlreadyInCrm: number;
  requestedLimit: number;
  districtLabel: string;
  warning?: string;
};

/** Same search/enrich/filter/sort pipeline the admin Müşteri Keşfi UI's
 * POST /api/admin/business-discovery has always used — real Google Places
 * data only, no mock/demo fallback. Throws DiscoveryConfigError (API key
 * missing) or DiscoveryApiError (a real Google Maps failure) instead of
 * returning a Response — callers (the HTTP route, the MCP tool) map these
 * to their own response shape. */
export async function searchDiscoveryBusinesses(params: DiscoverySearchParams): Promise<DiscoverySearchResult> {
  const keyword = clean(params.keyword);
  const city = clean(params.city);
  const district = clean(params.district);
  const neighborhood = clean(params.neighborhood);
  const sector = normalizeSectorInput(params.sector || params.businessType);
  const minimumRating = numberFilter(params.minimumRating);
  const minimumReviewCount = numberFilter(params.minimumReviewCount);
  const website = clean(params.website);
  const phone = clean(params.phone);
  const instagram = clean(params.instagram);
  const hideSaved = Boolean(params.hideSaved);
  const highOpportunity = Boolean(params.highOpportunity);
  const highAdPotential = Boolean(params.highAdPotential);
  const limit = Math.max(1, Math.min(100, Number(params.limit || 20) || 20));

  if (!sector) throw new DiscoveryApiError("Sektör alanı zorunludur.", undefined, 400);
  if (!city) throw new DiscoveryApiError("İl seçin veya yazın.", undefined, 400);

  googleMapsKey(); // throws DiscoveryConfigError early, matching the route's pre-check

  const filters = { minimumRating, minimumReviewCount, website, phone, instagram, hideSaved, highOpportunity, highAdPotential, knownPlaceIds: await knownPlaceIds(hideSaved) };
  const districtLabel = district || "Tüm ilçeler";

  const query = [keyword, sector, neighborhood, district, city].filter(Boolean).join(" ");
  const { pages, firstPageFailed } = await fetchTextSearchResults(query, limit);
  const primary = pages[0] || {};
  if (firstPageFailed) {
    console.error("[business-discovery] Google Maps arama hatası", { status: primary.status, error: primary.error_message });
    if (primary.status === "OVER_QUERY_LIMIT") {
      throw new DiscoveryApiError("Google Maps API kota sınırına ulaşıldı. Kısa süre sonra tekrar deneyin veya API kotanızı kontrol edin.", primary.error_message || primary.status);
    }
    throw new DiscoveryApiError("Google Maps işletme araması başarısız oldu.", primary.error_message || primary.status || "Bilinmeyen Google Maps hatası.");
  }

  const uniquePlaces = dedupePlacesById(pages.flatMap((page) => page.results || []));
  const totalFound = uniquePlaces.length;
  const baseResults = uniquePlaces.slice(0, limit);
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
      source: "Google Maps"
    };
    return enrichBusiness(business);
  }));

  const filtered = sortByOpportunity(applyDiscoveryFilters(businesses, filters));
  const hiddenAlreadyInCrm = filters.hideSaved
    ? businesses.filter((b) => b.placeId && filters.knownPlaceIds?.has(b.placeId)).length
    : 0;
  const warning = limit > GOOGLE_TEXT_SEARCH_PAGE_SIZE && totalFound < limit
    ? `${totalFound} benzersiz aday bulundu (istenen: ${limit}). Google Places bu arama için daha fazla sonuç döndürmedi — en yüksek skorlu adaylar gösteriliyor.`
    : undefined;

  return { businesses: filtered, count: filtered.length, totalFound, hiddenAlreadyInCrm, requestedLimit: limit, districtLabel, warning };
}

export function findDuplicateLead(
  business: Record<string, any>,
  existing: Array<{ id: string; google_place_id?: string; company?: string; phone?: string; website?: string; district?: string }>,
  fallbackDistrict?: string
) {
  const knownPlaceIds = new Map(existing.filter((lead) => lead.google_place_id).map((lead) => [lead.google_place_id as string, lead]));
  const knownNamePhones = new Map(existing.filter((lead) => lead.company && lead.phone).map((lead) => [`${clean(lead.company).toLocaleLowerCase("tr-TR")}::${phoneKey(lead.phone)}`, lead]));
  const knownWebsites = new Map(existing.filter((lead) => lead.website).map((lead) => [clean(lead.website).toLocaleLowerCase("tr-TR").replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, ""), lead]));
  const knownNameDistricts = new Map(existing.filter((lead) => lead.company && lead.district).map((lead) => [`${clean(lead.company).toLocaleLowerCase("tr-TR")}::${clean(lead.district).toLocaleLowerCase("tr-TR")}`, lead]));

  if (business.placeId && knownPlaceIds.has(business.placeId)) return knownPlaceIds.get(business.placeId);
  const namePhone = `${clean(business.name).toLocaleLowerCase("tr-TR")}::${phoneKey(business.phone)}`;
  if (business.name && business.phone && knownNamePhones.has(namePhone)) return knownNamePhones.get(namePhone);
  const website = clean(business.website).toLocaleLowerCase("tr-TR").replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
  if (website && knownWebsites.has(website)) return knownWebsites.get(website);
  const nameDistrict = `${clean(business.name).toLocaleLowerCase("tr-TR")}::${clean(business.district || fallbackDistrict).toLocaleLowerCase("tr-TR")}`;
  if (business.name && (business.district || fallbackDistrict) && knownNameDistricts.has(nameDistrict)) return knownNameDistricts.get(nameDistrict);
  return null;
}

export function buildLeadRowFromBusiness(business: Record<string, any>, meta: { sector?: string; city?: string; district?: string; neighborhood?: string; notes?: string }) {
  const scores = scoreDiscoveredBusiness(business as DiscoveredBusiness);
  const opportunityScore = business.opportunityScore ?? calculateHkOpportunityScore(business as DiscoveredBusiness);
  return {
    source: "Google Maps / Müşteri Keşfi",
    company: business.name || "",
    phone: business.phone || "",
    whatsapp: business.whatsapp || "",
    website: business.website || "",
    instagram: business.instagram || "",
    business_type: business.category || meta.sector || "",
    city: business.city || meta.city || "",
    district: business.district || meta.district || "",
    neighborhood: business.neighborhood || meta.neighborhood || "",
    sector: business.category || meta.sector || "",
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
    notes: [business.notes, meta.notes, "Google Maps işletme keşfi ile kaydedildi.", ...(scores.scoreReasons?.heat || [])].filter(Boolean).join("\n"),
    // "Kaydet" places a candidate into the Değerlendirme Havuzu (evaluation
    // pool), not directly into the sales-pipeline Lead Merkezi — it only
    // becomes a worked lead once explicitly approved (Onayla ->
    // Potansiyel Müşteri) and later promoted via the existing pre-review
    // "Teklif Gönder" action. See src/lib/discovery-workflow.ts.
    status: DISCOVERY_WORKFLOW_STATUS.SAVED_FOR_REVIEW,
    lead_stage: DISCOVERY_WORKFLOW_STATUS.SAVED_FOR_REVIEW
  };
}

export function stripOptionalDiscoveryColumns(record: Record<string, any>) {
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

export type SaveDiscoveryResult = {
  leads: any[];
  count: number;
  skipped: number;
  duplicates: Array<{ name: string; existingLeadId?: string }>;
  message: string;
};

/** Same duplicate-detection + insert logic the admin UI's PUT
 * /api/admin/business-discovery has always used (place_id, then
 * name+phone, then website, then name+district) — never a second
 * algorithm. Also used by save_discovery_as_lead so the MCP tool can never
 * create a lead the UI would have treated as a duplicate, or vice versa. */
export async function saveDiscoveredBusinessesAsLeads(
  businesses: Array<DiscoveredBusiness | Record<string, any>>,
  meta: { sector?: string; city?: string; district?: string; neighborhood?: string; notes?: string },
  actorSession?: AppSession | null
): Promise<SaveDiscoveryResult> {
  if (!hasSupabaseConfig()) throw new DiscoveryConfigError("Supabase bağlantısı yapılandırılmadı. Canlı ortamda kaydetme çalışmaz.");
  if (!businesses.length) throw new DiscoveryApiError("Kaydedilecek işletme seçin.", undefined, 400);

  const existing = await supabaseRest<Array<{ id: string; google_place_id?: string; company?: string; phone?: string; website?: string; district?: string }>>("leads?select=id,google_place_id,company,phone,website,district");
  const duplicates = businesses.map((business) => ({ business, existingLead: findDuplicateLead(business, existing, meta.district) })).filter((entry) => entry.existingLead);
  const rows = businesses.filter((business) => !findDuplicateLead(business, existing, meta.district)).map((business) => buildLeadRowFromBusiness(business, meta));

  if (!rows.length) {
    return {
      leads: [],
      count: 0,
      skipped: businesses.length,
      duplicates: duplicates.map((entry) => ({ name: entry.business.name, existingLeadId: entry.existingLead?.id })),
      message: "Seçilen işletmeler daha önce CRM listesine eklenmiş."
    };
  }

  let leads: any[];
  try {
    leads = await supabaseRest<any[]>("leads", { method: "POST", body: JSON.stringify(rows) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("schema cache") && !message.includes("column")) throw error;
    leads = await supabaseRest<any[]>("leads", { method: "POST", body: JSON.stringify(rows.map(stripOptionalDiscoveryColumns)) });
  }
  await recordActivity({ session: actorSession, action: "Oluşturma", entity: "Müşteri Bulucu", details: { message: `${leads.length} işletme CRM listesine eklendi`, count: leads.length } }).catch(() => {});
  return {
    leads,
    count: leads.length,
    skipped: businesses.length - leads.length,
    duplicates: duplicates.map((entry) => ({ name: entry.business.name, existingLeadId: entry.existingLead?.id })),
    message: `${leads.length} işletme CRM listesine eklendi.${duplicates.length ? ` ${duplicates.length} işletme zaten CRM'de kayıtlı olduğu için atlandı.` : ""}`
  };
}

export function businessesFromBody(value: unknown[]): DiscoveredBusiness[] {
  return value.map((business: any) => ({
    ...business,
    name: String(business.name || business.company || "İsimsiz işletme"),
    googleRating: business.googleRating ?? business.rating ?? null,
    reviewCount: Number(business.reviewCount || business.google_review_count || 0),
    category: business.category || business.business_type || business.sector || ""
  }));
}
