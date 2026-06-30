/* eslint-disable @typescript-eslint/no-explicit-any */

export type CompetitorSuggestionInput = {
  companyName?: string;
  sector?: string;
  niche?: string;
  city?: string;
  district?: string;
  branchName?: string;
  address?: string;
  website?: string;
  phone?: string;
  limit?: number;
  radius?: string;
  competitorType?: string;
  minimumRating?: number;
  minimumReviewCount?: number;
  preferActiveAds?: boolean;
  preferWebsite?: boolean;
  preferInstagram?: boolean;
};

export function competitorDisplayName(item: any) {
  return item?.competitor_name || item?.name || item?.title || "Rakip kaydı";
}

export function buildCompetitorSuggestions(input: CompetitorSuggestionInput) {
  const sector = input.sector || "yerel işletme";
  const city = input.city || "bölge";
  const district = input.district || "merkez";
  const base = [
    {
      competitor_name: `${city} ${sector} Lideri`,
      reason: `${city}/${district} bölgesinde görünürlük ve yorum gücü yüksek olabilecek ana rakip profili.`,
      estimated_strength: "Google yorumları, Instagram sürekliliği ve yerel bilinirlik.",
      estimated_weakness: "Teklif dili ve kampanya farklılaşması sınırlı olabilir.",
      monitoring_recommendation: "Haftalık reklam, Google yorum ve sosyal medya paylaşım takibi önerilir."
    },
    {
      competitor_name: `${district} Premium ${sector}`,
      reason: "Premium konumlandırma veya daha yüksek fiyat algısıyla müşterinin teklif dilini etkileyebilir.",
      estimated_strength: "Görsel kalite, müşteri deneyimi ve marka algısı.",
      estimated_weakness: "Performans reklamlarında mesaj netliği düşük olabilir.",
      monitoring_recommendation: "Fiyat/kampanya değişimi ve kreatif dili iki haftada bir kontrol edilmeli."
    },
    {
      competitor_name: `${city} Yeni Nesil ${sector}`,
      reason: "Yeni kampanya ve sosyal medya içerikleriyle hızlı görünürlük kazanabilecek rakip profili.",
      estimated_strength: "Yeni içerik temposu, kısa video ve kampanya duyuruları.",
      estimated_weakness: "SEO ve kalıcı Google görünürlüğü zayıf olabilir.",
      monitoring_recommendation: "Instagram paylaşım artışı ve web sitesi değişimleri haftalık izlenmeli."
    }
  ];
  return base.map((item, index) => enrichCompetitorDiscoveryResult({
    ...item,
    sector,
    city,
    district,
    address: `${district}, ${city}`,
    website_url: "",
    instagram_url: "",
    google_maps_url: "",
    google_rating: [4.7, 4.4, 3.9][index],
    google_review_count: [126, 54, 16][index],
    category: sector,
    phone: "",
    meta_ad_library_url: "",
    active_ad_signal: index === 0,
    estimated_ad_count: index === 0 ? 7 : index === 1 ? 2 : 0,
    discovery_source: "local-fallback",
    monitoring_frequency: index === 1 ? "biweekly" : "weekly",
    show_to_customer: false
  }, input));
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function sameBusiness(candidate: any, input: CompetitorSuggestionInput) {
  const name = normalizeText(candidate.competitor_name || candidate.name).toLocaleLowerCase("tr");
  const company = normalizeText(input.companyName).toLocaleLowerCase("tr");
  const website = normalizeText(candidate.website_url || candidate.website).replace(/^https?:\/\//, "").replace(/\/$/, "");
  const companyWebsite = normalizeText(input.website).replace(/^https?:\/\//, "").replace(/\/$/, "");
  const phone = normalizeText(candidate.phone).replace(/\D/g, "");
  const companyPhone = normalizeText(input.phone).replace(/\D/g, "");
  if (company && name && (name === company || name.includes(company) || company.includes(name))) return true;
  if (website && companyWebsite && website === companyWebsite) return true;
  if (phone && companyPhone && phone === companyPhone) return true;
  return false;
}

export function calculateCompetitorScore(item: any, input: CompetitorSuggestionInput = {}) {
  const rating = Number(item.google_rating ?? item.googleRating ?? item.rating ?? 0);
  const reviews = Number(item.google_review_count ?? item.reviewCount ?? item.user_ratings_total ?? 0);
  const hasWebsite = Boolean(item.website_url || item.website);
  const hasInstagram = Boolean(item.instagram_url || item.instagram);
  const hasMaps = Boolean(item.google_maps_url || item.googleMapsUrl || item.google_place_id || item.placeId);
  const hasPhone = Boolean(item.phone);
  const sameDistrict = input.district && String(item.district || "").toLocaleLowerCase("tr").includes(String(input.district).toLocaleLowerCase("tr"));
  const categoryMatch = input.sector && String(item.category || item.sector || "").toLocaleLowerCase("tr").includes(String(input.sector).toLocaleLowerCase("tr"));
  const activeAdSignal = Boolean(item.active_ad_signal || item.hasActiveAds || Number(item.estimated_ad_count || 0) > 0);
  const googleStrength = clamp((rating / 5) * 10 + Math.min(reviews / 20, 10) + (categoryMatch ? 5 : 0), 0, 25);
  const adStrength = clamp((activeAdSignal ? 10 : 0) + Math.min(Number(item.estimated_ad_count || 0), 8) + (item.meta_ad_library_url ? 2 : 0), 0, 20);
  const digitalPresence = clamp((hasWebsite ? 6 : 0) + (hasInstagram ? 5 : 0) + (hasMaps ? 4 : 0) + (hasPhone ? 3 : 0) + (item.landing_page_url ? 2 : 0), 0, 20);
  const localProximity = clamp((sameDistrict ? 10 : 4) + (String(item.address || "").toLocaleLowerCase("tr").includes(String(input.district || "").toLocaleLowerCase("tr")) ? 5 : 0), 0, 15);
  const socialSignal = clamp((hasInstagram ? 4 : 0) + (activeAdSignal ? 4 : 0) + (item.content_signal ? 2 : 0), 0, 10);
  const opportunityWeakness = clamp((!hasWebsite ? 3 : 0) + (reviews < 20 ? 3 : 0) + (!activeAdSignal ? 2 : 0) + (!hasInstagram ? 2 : 0), 0, 10);
  const competitorScore = clamp(googleStrength + adStrength + digitalPresence + localProximity + socialSignal + opportunityWeakness);
  const threatScore = clamp(googleStrength + adStrength + digitalPresence + localProximity + socialSignal);
  const opportunityScore = clamp(opportunityWeakness * 5 + (!hasWebsite ? 15 : 0) + (reviews < 30 ? 12 : 0) + (!activeAdSignal ? 10 : 0));
  const label = competitorScore >= 80 ? "Yüksek tehdit" : competitorScore >= 60 ? "Güçlü rakip" : competitorScore >= 40 ? "Orta rakip" : competitorScore >= 20 ? "Fırsat rakibi" : "Düşük öncelik";
  const scoreReason = [
    `Google gücü ${googleStrength}/25`,
    `reklam gücü ${adStrength}/20`,
    `dijital varlık ${digitalPresence}/20`,
    `yerel yakınlık ${localProximity}/15`,
    `sosyal sinyal ${socialSignal}/10`,
    `fırsat/zayıflık ${opportunityWeakness}/10`
  ].join("; ");
  return {
    competitor_score: competitorScore,
    threat_score: threatScore,
    opportunity_score: opportunityScore,
    score_label: label,
    score_reason: `Bu skor; ${scoreReason} bileşenleriyle hesaplandı.`,
    score_breakdown: { googleStrength, adStrength, digitalPresence, localProximity, socialSignal, opportunityWeakness }
  };
}

export function buildAgencyDecision(item: any) {
  const score = Number(item.competitor_score || 0);
  const threat = Number(item.threat_score || 0);
  const opportunity = Number(item.opportunity_score || 0);
  const recommended = [
    "Google yorum artırma kampanyası başlat",
    "3 Reels içerik fikri üret",
    "Meta reklam kreatif testi hazırla",
    threat >= 60 ? "Rakip teklif dilini analiz et" : "Landing page kontrolü yap",
    opportunity >= 55 ? "Rakibin zayıf web/yorum alanına karşı hızlı aksiyon al" : "Haftalık takip bildirimi aç",
    "Müşteriye sade özet hazırla"
  ];
  const decision = score >= 70
    ? "İzlemeye alınmalı ve müşteriye özetlenmeli. Öncelik Google yorum, kreatif test ve teklif dili analizi."
    : opportunity >= 55
      ? "Fırsat rakibi. Web sitesi, yorum ve sosyal medya zayıflıklarına karşı hızlı içerik/reklam hamlesi yapılmalı."
      : "Düşük/orta öncelik. Haftalık takip yeterli; müşteri özetinde yalnız önemli sinyal oluşursa gösterilmeli.";
  return { agency_decision: decision, recommended_actions: recommended };
}

export function enrichCompetitorDiscoveryResult(item: any, input: CompetitorSuggestionInput = {}) {
  const score = calculateCompetitorScore(item, input);
  const decision = buildAgencyDecision(score);
  const customer = buildCompetitorCustomerSummary({ ...item, ...score });
  return {
    ...item,
    competitor_name: item.competitor_name || item.name || "Rakip işletme",
    website_url: item.website_url || item.website || "",
    google_maps_url: item.google_maps_url || item.googleMapsUrl || (item.google_place_id || item.placeId ? `https://www.google.com/maps/place/?q=place_id:${item.google_place_id || item.placeId}` : ""),
    google_place_id: item.google_place_id || item.placeId || "",
    google_rating: Number(item.google_rating ?? item.googleRating ?? item.rating ?? 0) || null,
    google_review_count: Number(item.google_review_count ?? item.reviewCount ?? item.user_ratings_total ?? 0),
    category: item.category || item.sector || input.sector || "",
    city: item.city || input.city || "",
    district: item.district || input.district || "",
    discovery_query: item.discovery_query || [input.sector, input.district, input.city].filter(Boolean).join(" "),
    customer_summary: item.customer_summary || customer.summary,
    customer_recommendations: item.customer_recommendations || customer.recommendations,
    customer_action_plan: item.customer_action_plan || customer.actionPlan,
    ...score,
    ...decision
  };
}

export async function discoverGoogleMapsCompetitors(input: CompetitorSuggestionInput) {
  const key = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY || "";
  const limit = Math.min(Number(input.limit || 10), 50);
  const niches = String(input.niche || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const searchTerms = Array.from(new Set((niches.length ? niches : [input.sector || "yerel işletme"]).map((term) => [term, input.district, input.city].filter(Boolean).join(" "))));
  const query = searchTerms[0] || [input.sector, input.district, input.city].filter(Boolean).join(" ");
  if (!key) {
    return { source: "local-fallback", warning: "Google Maps API anahtarı eksik. Rakipler güvenli yerel yedek akışla tahmini üretildi.", results: buildCompetitorSuggestions(input).slice(0, limit) };
  }
  const allPlaces: any[] = [];
  let lastError = "";
  for (const searchQuery of searchTerms.slice(0, 6)) {
    const params = new URLSearchParams({ query: searchQuery, key, language: "tr", region: "tr" });
    const response = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !["OK", "ZERO_RESULTS"].includes(data.status)) {
      lastError = data.error_message || "Google Maps yanıtı alınamadı.";
      continue;
    }
    allPlaces.push(...(data.results || []).map((place: any) => ({ ...place, discovery_query: searchQuery })));
    if (allPlaces.length >= limit * 3) break;
  }
  if (!allPlaces.length) {
    return { source: "local-fallback", warning: lastError || "Google Maps gerçek işletme listesi alınamadı. Yerel yedek akış kullanıldı.", results: buildCompetitorSuggestions(input).slice(0, limit) };
  }
  const unique = new Map<string, any>();
  for (const place of allPlaces) {
    const keyPart = String(place.place_id || place.name || "").toLocaleLowerCase("tr");
    if (keyPart && !unique.has(keyPart)) unique.set(keyPart, place);
  }
  const raw = Array.from(unique.values()).slice(0, limit * 2);
  const results = (await Promise.all(raw.map(async (place: any) => {
    const detailParams = new URLSearchParams({ place_id: place.place_id, fields: "formatted_phone_number,international_phone_number,website,url,geometry,formatted_address,types", key, language: "tr" });
    const detailsResponse = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${detailParams}`, { cache: "no-store" }).catch(() => null);
    const detailsData = await detailsResponse?.json().catch(() => ({}));
    const details = detailsData?.result || {};
    const candidate = {
      competitor_name: place.name,
      address: details.formatted_address || place.formatted_address || "",
      phone: details.formatted_phone_number || details.international_phone_number || "",
      website_url: details.website || "",
      google_maps_url: details.url || `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
      google_rating: place.rating ?? null,
      google_review_count: Number(place.user_ratings_total || 0),
      category: Array.isArray(place.types) ? place.types.slice(0, 2).join(", ") : input.sector,
      latitude: details.geometry?.location?.lat || place.geometry?.location?.lat || null,
      longitude: details.geometry?.location?.lng || place.geometry?.location?.lng || null,
      google_place_id: place.place_id,
      business_status: place.business_status || "",
      sector: input.sector,
      city: input.city,
      district: input.district,
      discovery_source: "google_maps",
      discovery_query: place.discovery_query || query,
      maps_raw: { place_id: place.place_id, business_status: place.business_status, types: place.types || [], query: place.discovery_query || query }
    };
    return enrichCompetitorDiscoveryResult(candidate, input);
  }))).filter((candidate) => !sameBusiness(candidate, input));
  return { source: "google_maps", warning: "", results: results.slice(0, limit) };
}

export async function enrichMetaAdSignals(results: any[], input: CompetitorSuggestionInput) {
  const token = process.env.META_AD_LIBRARY_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN || "";
  if (!token) {
    return {
      source: "local-fallback",
      warning: "Meta API eksik veya Ad Library erişimi sınırlı. Reklam sinyali AI/fallback ile tahmini değerlendirildi.",
      results: results.map((item, index) => enrichCompetitorDiscoveryResult({
        ...item,
        active_ad_signal: Boolean(item.active_ad_signal || index < 2),
        estimated_ad_count: item.estimated_ad_count ?? (index < 2 ? 3 + index : 0),
        meta_ad_library_url: item.meta_ad_library_url || `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=TR&q=${encodeURIComponent(competitorDisplayName(item))}`,
        meta_raw: { mode: "fallback", reason: "Meta token yok veya erişim sınırlı" }
      }, input))
    };
  }
  const enriched = await Promise.all(results.map(async (item) => {
    try {
      const params = new URLSearchParams({
        access_token: token,
        ad_type: "ALL",
        ad_reached_countries: "TR",
        search_terms: competitorDisplayName(item),
        fields: "id,page_name,ad_snapshot_url,ad_delivery_start_time,ad_creative_bodies",
        limit: "10"
      });
      const response = await fetch(`https://graph.facebook.com/v20.0/ads_archive?${params}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      const ads = Array.isArray(data.data) ? data.data : [];
      return enrichCompetitorDiscoveryResult({
        ...item,
        active_ad_signal: ads.length > 0,
        estimated_ad_count: ads.length,
        last_ad_seen_at: ads[0]?.ad_delivery_start_time || null,
        meta_ad_library_url: item.meta_ad_library_url || `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=TR&q=${encodeURIComponent(competitorDisplayName(item))}`,
        meta_raw: { count: ads.length, sample: ads.slice(0, 3).map((ad: any) => ({ id: ad.id, page_name: ad.page_name, ad_snapshot_url: ad.ad_snapshot_url })) }
      }, input);
    } catch {
      return enrichCompetitorDiscoveryResult({ ...item, meta_raw: { mode: "error_fallback" } }, input);
    }
  }));
  return { source: "meta_ad_library", warning: "", results: enriched };
}

export function buildCompetitorCustomerSummary(item: any) {
  const name = competitorDisplayName(item);
  const summary = `${name} tarafında reklam, sosyal medya ve Google görünürlüğü düzenli takip edilmelidir. Bu hareketlilik müşteriniz için içerik, yorum yönetimi ve kısa dönem kampanya fırsatı oluşturur.`;
  const recommendations = [
    "Bu hafta en az 3 kısa video/Reels fikri hazırlanmalı.",
    "Google yorum artırma aksiyonu başlatılmalı.",
    "Rakip kampanyalarına karşı kısa süreli teklif veya mesaj kampanyası planlanmalı."
  ];
  const actionPlan = [
    "Gün 1: Rakip reklam ve sosyal medya görünürlüğünü kontrol et.",
    "Gün 2: Müşteri için 3 içerik fikri ve 1 kampanya mesajı hazırla.",
    "Gün 3: Google yorum talep akışını başlat.",
    "Gün 4: Reklam kreatiflerini rakip mesajlarına göre gözden geçir.",
    "Gün 5: WhatsApp veya kısa kampanya duyurusu hazırla.",
    "Gün 6: İlk sinyalleri rapor notuna çevir.",
    "Gün 7: Müşteriye sade haftalık rekabet özeti gönder."
  ];
  return { summary, recommendations, actionPlan };
}

export function buildCompetitorInternalAnalysis(item: any) {
  const name = competitorDisplayName(item);
  return {
    strengths: ["Yerel görünürlük", "Sosyal medya sürekliliği", "Google yorum potansiyeli"],
    weaknesses: ["Teklif farklılaşması sınırlı", "Kampanya mesajı ölçülebilir olmayabilir"],
    adSignals: [item?.last_ad_seen_at ? "Son reklam sinyali mevcut" : "Yeni reklam sinyali kontrol edilmeli"],
    contentSignals: ["Kısa video ve kampanya duyuruları takip edilmeli"],
    seoOpportunities: ["Yerel sayfa başlıkları, yorum içerikleri ve Maps görünürlüğü güçlendirilebilir"],
    reviewOpportunities: ["Yorum sayısı ve son yorum tarihi haftalık izlenmeli"],
    technicalNotes: [`${name} için gerçek API entegrasyonu yoksa yerel yedek analiz kullanılır.`],
    agencyActions: ["Görev oluştur", "Müşteri notuna kaydet", "Agent Hafızasına kaydet", "Müşteriye sade özet gönder"]
  };
}

export function buildCompetitorSignals(item: any) {
  const name = competitorDisplayName(item);
  return [
    {
      signal_type: "ad_signal",
      title: `${name} reklam görünürlüğü kontrol edildi`,
      summary: "Aktif reklam veya kampanya sinyali için takip kaydı hazırlandı.",
      severity: "info"
    },
    {
      signal_type: "content_signal",
      title: `${name} içerik hareketliliği izlendi`,
      summary: "Instagram paylaşım temposu ve kampanya dili kontrol edilmelidir.",
      severity: "info"
    },
    {
      signal_type: "review_signal",
      title: `${name} Google yorum takibi`,
      summary: "Yorum sayısı ve puan değişimi haftalık izleme planına eklendi.",
      severity: "info"
    }
  ];
}

export function isCompetitorDue(item: any, now = new Date()) {
  if (!item?.last_checked_at) return true;
  const last = new Date(item.last_checked_at);
  const days = Math.floor((Number(now) - Number(last)) / 86400000);
  const frequency = String(item.monitoring_frequency || "weekly");
  if (frequency === "daily") return days >= 1;
  if (frequency === "monthly") return days >= 30;
  if (frequency === "biweekly") return days >= 14;
  return days >= 7;
}
