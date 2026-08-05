import { getSectorProfile, type SectorProfile } from "./sector-signal.ts";
import { estimateAdBudget, formatTRY, recommendServicePackage } from "./packages.ts";

export type DiscoveredBusiness = {
  name: string;
  address?: string;
  phone?: string;
  website?: string;
  googleRating?: number | null;
  reviewCount?: number;
  placeId?: string;
  category?: string;
  city?: string;
  district?: string;
  googleMapsUrl?: string;
  google_maps_url?: string;
  opportunityScore?: number;
  digitalGapScore?: number;
  adPotentialScore?: number;
  notes?: string;
  whatsapp?: string;
  instagram?: string;
  crmStatus?: string;
  metaPixelDetected?: boolean | null;
  googleTagDetected?: boolean | null;
  manualMetaAdsStatus?: "active" | "inactive" | null;
  manualGoogleAdsStatus?: "active" | "inactive" | null;
  advertisingScanFailed?: boolean;
  [key: string]: unknown;
};

const highAdPotentialCategories = [
  "oto", "otomotiv", "emlak", "diş", "dis", "klinik", "güzellik", "guzellik",
  "estetik", "sağlık", "saglik", "restoran", "kafe", "kuaför", "spor", "hukuk"
];

// Kept for backward compatibility with existing CRM funnel views that were
// built against this 4-tier label set before the HK Opportunity Score model
// below existed. Do not delete — other parts of the admin panel may still
// reference discoveryPriorityLabel independently of the discovery module.
export function discoveryPriorityLabel(score: number) {
  if (score >= 80) return "Sıcak Fırsat";
  if (score >= 60) return "Takip Edilebilir";
  if (score >= 40) return "Orta Potansiyel";
  return "Düşük Öncelik";
}

export function scoreDiscoveredBusiness(business: DiscoveredBusiness) {
  const rating = Number(business.googleRating || 0);
  const reviews = Number(business.reviewCount || 0);
  const category = String(business.category || "").toLocaleLowerCase("tr-TR");
  const highPotential = highAdPotentialCategories.some((item) => category.includes(item));
  const heatReasons: string[] = [];
  const maturityReasons: string[] = [];
  const heatBreakdown: Array<{ points: number; label: string }> = [{ points: 15, label: "Temel fırsat sinyali" }];
  const maturityBreakdown: Array<{ points: number; label: string }> = [{ points: 10, label: "Temel dijital profil sinyali" }];
  let heat = 15;
  let maturity = 10;

  if (!business.website) {
    heat += 24;
    heatReasons.push("Website yok: reklam ve landing page fırsatı");
    heatBreakdown.push({ points: 24, label: "Website bulunamadı" });
  } else {
    maturity += 28;
    maturityReasons.push("Website var: dijital varlık hazır");
    maturityBreakdown.push({ points: 28, label: "Website mevcut" });
  }

  if (business.phone) {
    heat += 18;
    maturity += 16;
    heatReasons.push("Telefon var: ulaşılabilir lead");
    maturityReasons.push("Telefon var: profil iletişim açısından tamamlanmış");
    heatBreakdown.push({ points: 18, label: "Telefon bilgisi mevcut" });
    maturityBreakdown.push({ points: 16, label: "Telefon bilgisi mevcut" });
  }

  if (business.whatsapp) {
    heat += 10;
    heatReasons.push("WhatsApp mevcut: doğrudan mesaj teması kurulabilir");
    heatBreakdown.push({ points: 10, label: "WhatsApp mevcut" });
  }

  if (business.address) {
    heat += 8;
    maturity += 10;
    maturityReasons.push("Adres var: işletme profili daha güvenilir");
    heatBreakdown.push({ points: 8, label: "Adres bilgisi mevcut" });
    maturityBreakdown.push({ points: 10, label: "İşletme adresi tamamlanmış" });
  }

  if (rating >= 4.5) {
    heat += 16;
    maturity += 18;
    heatReasons.push("Google puanı çok yüksek: dönüşüm potansiyeli güçlü");
    maturityReasons.push("Yüksek puan: güven sinyali kuvvetli");
    heatBreakdown.push({ points: 16, label: "Google puanı çok yüksek" });
    maturityBreakdown.push({ points: 18, label: "Google güven sinyali güçlü" });
  } else if (rating >= 4) {
    heat += 12;
    maturity += 14;
    heatReasons.push("Google puanı yüksek: teklif kabul potansiyeli güçlü");
    maturityReasons.push("4.0+ puan: müşteri memnuniyeti sinyali var");
    heatBreakdown.push({ points: 12, label: "Google puanı yüksek" });
    maturityBreakdown.push({ points: 14, label: "4.0+ müşteri memnuniyeti sinyali" });
  } else if (rating > 0) {
    heat += 5;
    maturity += 7;
    maturityReasons.push("Google puanı var: profil tamamen boş değil");
    heatBreakdown.push({ points: 5, label: "Google puanı mevcut" });
    maturityBreakdown.push({ points: 7, label: "Google profilinde temel puan var" });
  }

  if (reviews === 0) {
    heat += 6;
    heatReasons.push("Yorum yok: itibar yönetimi fırsatı");
    heatBreakdown.push({ points: 6, label: "Yorum yok, itibar yönetimi fırsatı" });
  } else if (reviews < 25) {
    heat += 12;
    maturity += 8;
    heatReasons.push("Yorum sayısı düşük: itibar yönetimi fırsatı");
    maturityReasons.push("Yorumlar başlamış: profil aktif görünüyor");
    heatBreakdown.push({ points: 12, label: "Yorum sayısı düşük" });
    maturityBreakdown.push({ points: 8, label: "Yorumlar başlamış" });
  } else if (reviews < 100) {
    heat += 10;
    maturity += 16;
    heatReasons.push("Orta yorum hacmi: reklamla büyütülebilir aktif işletme");
    maturityReasons.push("Yorum sayısı orta: sosyal kanıt mevcut");
    heatBreakdown.push({ points: 10, label: "Orta yorum hacmi" });
    maturityBreakdown.push({ points: 16, label: "Sosyal kanıt mevcut" });
  } else {
    heat += 6;
    maturity += 24;
    maturityReasons.push("Yorum sayısı yüksek: güçlü sosyal kanıt");
    heatBreakdown.push({ points: 6, label: "Yorum hacmi yüksek" });
    maturityBreakdown.push({ points: 24, label: "Güçlü sosyal kanıt" });
  }

  if (highPotential) {
    heat += 12;
    heatReasons.push("Sektör reklam potansiyeli yüksek");
    heatBreakdown.push({ points: 12, label: "Sektör reklam potansiyeli yüksek" });
  }

  if (business.instagram) {
    heat += 4;
    maturity += 6;
    heatReasons.push("Instagram mevcut: sosyal kreatif üretimi için zemin var");
    heatBreakdown.push({ points: 4, label: "Instagram bağlantısı mevcut" });
    maturityBreakdown.push({ points: 6, label: "Sosyal medya varlığı mevcut" });
  }

  if (business.crmStatus === "CRM'de yok" || business.crmStatus === "CRM’de yok" || !business.crmStatus) {
    heat += 6;
    heatReasons.push("CRM'de henüz kayıtlı değil: rakip ajans temasından önce ulaşma fırsatı");
    heatBreakdown.push({ points: 6, label: "CRM'de kayıtlı değil" });
  }

  const leadHeatScore = Math.max(0, Math.min(100, Math.round(heat)));
  const digitalMaturityScore = Math.max(0, Math.min(100, Math.round(maturity)));
  return {
    digitalMaturityScore,
    leadHeatScore,
    priorityLabel: discoveryPriorityLabel(leadHeatScore),
    scoreReasons: {
      heat: heatReasons,
      maturity: maturityReasons
    },
    scoreBreakdown: {
      heat: heatBreakdown,
      maturity: maturityBreakdown
    }
  };
}

// ============================================================================
// HK Opportunity Score — canonical 0-100 sales-priority model.
//
// This is the single authoritative "which prospect should I contact today"
// score for the Müşteri Keşfi / Google Maps Müşteri Bulma module. It reuses
// scoreDiscoveredBusiness()'s heat calculation as its base (so the two never
// drift apart or get computed twice) and layers on advertising-signal and
// CRM-novelty adjustments that only the discovery module has evidence for.
// ============================================================================

export type HkOpportunityTierKey = "immediate" | "very_hot" | "follow_up" | "medium" | "low";

export const HK_OPPORTUNITY_TIERS: Array<{
  key: HkOpportunityTierKey;
  min: number;
  label: string;
  recommendedAction: string;
  className: string;
}> = [
  { key: "immediate", min: 90, label: "Hemen iletişime geç", recommendedAction: "Bugün arayın veya WhatsApp'tan mesaj gönderin.", className: "border-red-300/50 bg-red-500/15 text-red-700" },
  { key: "very_hot", min: 75, label: "Çok sıcak fırsat", recommendedAction: "24 saat içinde ilk temas kurun.", className: "border-orange-300/50 bg-orange-400/15 text-orange-700" },
  { key: "follow_up", min: 60, label: "Takibe al", recommendedAction: "Bu hafta içinde takip listesine ekleyip temas kurun.", className: "border-amber-300/45 bg-amber-300/15 text-amber-700" },
  { key: "medium", min: 40, label: "Orta potansiyel", recommendedAction: "Aday havuzunda tutup periyodik olarak yeniden değerlendirin.", className: "border-sky-300/40 bg-sky-300/12 text-sky-700" },
  { key: "low", min: 0, label: "Düşük öncelik", recommendedAction: "Şimdilik bekletin; yeni veri veya sinyal çıkarsa yeniden puanlayın.", className: "border-slate-400/40 bg-slate-400/10 text-slate-600" }
];

export function getHkOpportunityTier(score: number) {
  const value = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  return HK_OPPORTUNITY_TIERS.find((tier) => value >= tier.min) || HK_OPPORTUNITY_TIERS[HK_OPPORTUNITY_TIERS.length - 1];
}

/**
 * Combines the deterministic heat score with advertising-signal evidence:
 * unknown/unverified ad status is explicitly neutral (never penalizes or
 * rewards), a confirmed absence of ads is a genuine opportunity signal, and
 * confirmed active advertising lowers priority since the gap this agency
 * sells into (advertising presence) is already closed.
 */
export function calculateHkOpportunityScore(
  business: DiscoveredBusiness,
  advertising?: Pick<AdvertisingEvidence, "metaAdsStatus" | "googleAdsStatus">
): number {
  const { leadHeatScore } = scoreDiscoveredBusiness(business);
  let adjusted = leadHeatScore;
  if (advertising) {
    const bothInactiveOrUnknown = ["no_signal_detected", "manual_check_required", "source_unavailable"];
    if (advertising.metaAdsStatus === "active_signal" || advertising.googleAdsStatus === "active_signal") {
      adjusted -= 8; // already advertising somewhere: smaller visible gap for HK to sell into
    } else if (bothInactiveOrUnknown.includes(advertising.metaAdsStatus) && bothInactiveOrUnknown.includes(advertising.googleAdsStatus)) {
      adjusted += 5; // no confirmed advertising anywhere: clearer opportunity
    }
    // "unverified" (Pixel present but ad status genuinely unknown) intentionally
    // applies no adjustment — it is neutral, not evidence of anything.
  }
  return Math.max(0, Math.min(100, Math.round(adjusted)));
}

// ============================================================================
// Advertising detection — honest, evidence-based, never fabricated.
// ============================================================================

export type AdStatusValue = "active_signal" | "no_signal_detected" | "unverified" | "manual_check_required" | "source_unavailable";

export const AD_STATUS_LABELS: Record<AdStatusValue, string> = {
  active_signal: "Aktif reklam sinyali",
  no_signal_detected: "Reklam sinyali tespit edilmedi",
  unverified: "Doğrulanamadı",
  manual_check_required: "Manuel kontrol gerekli",
  source_unavailable: "Veri kaynağı kullanılamıyor"
};

export type AdvertisingEvidence = {
  metaAdsStatus: AdStatusValue;
  metaAdsEvidence: string;
  googleAdsStatus: AdStatusValue;
  googleAdsEvidence: string;
  metaPixelDetected: boolean | null;
  googleTagDetected: boolean | null;
  advertisingConfidence: "low" | "medium" | "high";
  advertisingSource: string;
  advertisingLastCheckedAt: string | null;
};

export type ManualAdVerification = {
  status: "active" | "inactive";
  verifiedBy: string;
  verifiedAt: string;
  source: string;
  channel: "meta" | "google";
};

/**
 * Determines honest advertising status from whatever evidence is actually
 * available. Never claims "active" or "inactive" without a real signal:
 * - A manual verification (stored, with verifier/timestamp) is the only way
 *   to reach a confident active/inactive status for the platform it covers.
 * - A detected Meta Pixel / Google tag is explicitly NOT treated as proof of
 *   an active campaign (a business can install a Pixel without ever running
 *   ads), and its absence is NOT treated as proof of no campaign (ads can run
 *   without any on-site tracking pixel at all) — both surface as "unverified"
 *   with an explanatory evidence string, never as a false "inactive".
 */
export function evaluateAdvertisingSignals(input: {
  website?: string | null;
  metaPixelDetected?: boolean | null;
  googleTagDetected?: boolean | null;
  scanFailed?: boolean;
  manualMeta?: ManualAdVerification | null;
  manualGoogle?: ManualAdVerification | null;
  checkedAt?: string | null;
}): AdvertisingEvidence {
  const hasWebsite = Boolean(input.website);
  const scanned = input.metaPixelDetected !== undefined && input.metaPixelDetected !== null;

  function resolve(manual: ManualAdVerification | null | undefined, pixelDetected: boolean | null | undefined, platformLabel: string) {
    if (manual) {
      return {
        status: (manual.status === "active" ? "active_signal" : "no_signal_detected") as AdStatusValue,
        evidence: `Manuel doğrulama (${manual.verifiedBy}, ${manual.verifiedAt}): ${manual.status === "active" ? "aktif reklam görüldü" : "aktif reklam görülmedi"}${manual.source ? ` — kaynak: ${manual.source}` : ""}.`
      };
    }
    if (!hasWebsite) {
      return { status: "manual_check_required" as AdStatusValue, evidence: `Website bulunamadığı için ${platformLabel} durumu otomatik kontrol edilemedi; ilgili reklam kütüphanesi üzerinden manuel kontrol önerilir.` };
    }
    if (input.scanFailed) {
      return { status: "source_unavailable" as AdStatusValue, evidence: "Website taraması başarısız oldu veya kaynağa ulaşılamadı; kontrol tekrar denenebilir." };
    }
    if (pixelDetected === true) {
      return { status: "unverified" as AdStatusValue, evidence: `${platformLabel === "Meta" ? "Meta Pixel" : "Google etiketi"} tespit edildi; bu tek başına aktif reklam kanıtı değildir (Pixel/etiket reklamsız da kurulu olabilir). Reklam kütüphanesi üzerinden doğrulama önerilir.` };
    }
    if (pixelDetected === false) {
      return { status: "unverified" as AdStatusValue, evidence: `Website taramasında ${platformLabel === "Meta" ? "Meta Pixel" : "Google etiketi"} tespit edilmedi; bu, reklam vermediği anlamına gelmez (etiketsiz de reklam yürütülebilir). Doğrulanmış sonuç için manuel kontrol gerekir.` };
    }
    return { status: "manual_check_required" as AdStatusValue, evidence: `${platformLabel} reklam durumu henüz kontrol edilmedi.` };
  }

  const meta = resolve(input.manualMeta, input.metaPixelDetected, "Meta");
  const google = resolve(input.manualGoogle, input.googleTagDetected, "Google");

  const confidence: "low" | "medium" | "high" = (input.manualMeta || input.manualGoogle) ? "high" : scanned ? "medium" : "low";
  const source = input.manualMeta || input.manualGoogle
    ? "Manuel doğrulama"
    : scanned
      ? "Website teknik taraması (Pixel/etiket tespiti)"
      : hasWebsite
        ? "Henüz taranmadı"
        : "Website bulunamadı";

  return {
    metaAdsStatus: meta.status,
    metaAdsEvidence: meta.evidence,
    googleAdsStatus: google.status,
    googleAdsEvidence: google.evidence,
    metaPixelDetected: input.metaPixelDetected ?? null,
    googleTagDetected: input.googleTagDetected ?? null,
    advertisingConfidence: confidence,
    advertisingSource: source,
    advertisingLastCheckedAt: input.checkedAt ?? (scanned ? new Date().toISOString() : null)
  };
}

// ============================================================================
// Meta Ads Uygunluk Skoru — sector-aware Meta suitability, distinct from the
// general HK Opportunity Score. Reuses sector-signal.ts's platformLean
// classification so this stays reusable across sectors instead of being
// hardcoded for beauty/visual businesses only.
// ============================================================================

export type MetaSuitability = {
  score: number;
  reasons: string[];
  primaryChannelNote: string;
};

export function calculateMetaSuitability(business: DiscoveredBusiness, sectorProfile?: SectorProfile): MetaSuitability {
  const profile = sectorProfile || getSectorProfile(business.category);
  const reasons: string[] = [];
  let score = 40; // neutral baseline

  if (profile.platformLean === "meta") {
    score += 30;
    reasons.push("Sektör görsel keşif/randevu davranışına sahip; Meta'da doğal olarak güçlü performans beklenir.");
  } else if (profile.platformLean === "balanced") {
    score += 15;
    reasons.push("Sektör hem Meta hem Google'da çalışabilir; kanal seçimi teklif detaylarına göre netleşir.");
  } else {
    score -= 10;
    reasons.push("Sektörde arama niyeti (Google) daha baskın; Meta burada birincil kanaldan çok destek/remarketing rolünde önerilir.");
  }

  if (business.instagram) {
    score += 10;
    reasons.push("Instagram hesabı mevcut: kreatif üretimi ve topluluk zaten başlamış.");
  }
  if (!business.website) {
    score += 8;
    reasons.push("Website yok: Meta lead formu veya WhatsApp yönlendirmesi doğrudan dönüşüm kanalı olabilir.");
  }
  if (business.whatsapp || business.phone) {
    score += 7;
    reasons.push("WhatsApp/telefon mevcut: Meta reklamlarından doğrudan mesaj dönüşümü kurulabilir.");
  }
  const reviews = Number(business.reviewCount || 0);
  if (reviews >= 25) {
    score += 5;
    reasons.push("Yeterli yorum hacmi: öncesi/sonrası ve müşteri deneyimi içerikleri için malzeme var.");
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    reasons,
    primaryChannelNote: profile.platformLean === "google"
      ? `${business.category || "Bu sektörde"} arama niyeti yüksek olduğu için Google Search ana kanal, Meta ise remarketing ve kampanya desteği olarak önerilir.`
      : profile.platformLean === "meta"
        ? `${business.category || "Bu işletme"} görsel/randevu odaklı olduğu için Meta Ads birincil kanal olarak önerilir.`
        : `${business.category || "Bu işletme"} için Meta ve Google birlikte, teklif ve bütçeye göre dengeli kullanılabilir.`
  };
}

// ============================================================================
// Sales recommendation — reuses the existing package/budget engine
// (src/lib/packages.ts) instead of duplicating budget-estimation logic.
// ============================================================================

export type SalesRecommendation = {
  estimatedSalesProbabilityLabel: string;
  recommendedChannel: "meta" | "google" | "balanced";
  recommendedOffer: string;
  recommendedPackageName: string;
  recommendedPackageCategory: string;
  suggestedMinimumBudget: string;
  suggestedIdealBudget: string;
  suggestedAggressiveBudget: string;
  expectedSalesCycle: string;
  priorityLevel: string;
  followUpDate: string;
};

export function buildSalesRecommendation(business: DiscoveredBusiness, opportunityScore: number): SalesRecommendation {
  const profile = getSectorProfile(business.category);
  const tier = getHkOpportunityTier(opportunityScore);
  const platform: "meta" | "google" | "balanced" = profile.platformLean;
  const packageInput = {
    sector: business.category || "",
    goal: "Daha Fazla Satış",
    platform: platform === "balanced" ? ["meta", "google"] : [platform],
    contentNeed: business.website ? "medium" : "high",
    urgency: opportunityScore >= 75 ? "immediate" : opportunityScore >= 40 ? "this_month" : "researching",
    socialStatus: business.instagram ? "irregular" : "new"
  };
  const recommendation = recommendServicePackage(packageInput);
  const budget = estimateAdBudget(packageInput);

  const followUpDays = tier.key === "immediate" ? 0 : tier.key === "very_hot" ? 1 : tier.key === "follow_up" ? 7 : tier.key === "medium" ? 21 : 45;
  const followUpDate = new Date(Date.now() + followUpDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  return {
    estimatedSalesProbabilityLabel: `Tahmini: ${tier.label.toLocaleLowerCase("tr-TR")} (kesin sonuç garantisi yoktur)`,
    recommendedChannel: platform,
    recommendedOffer: !business.website
      ? "Dönüşüm odaklı açılış sayfası + reklam paketi teklifi"
      : Number(business.reviewCount || 0) < 25
        ? "İtibar/yorum yönetimi + reklam paketi teklifi"
        : "Performans reklamcılığı ve raporlama paketi teklifi",
    recommendedPackageName: recommendation.recommended.name,
    recommendedPackageCategory: recommendation.recommended.categoryLabel,
    suggestedMinimumBudget: `${formatTRY(budget.minimumRange[0])} - ${formatTRY(budget.minimumRange[1])} / ay (tahmini)`,
    suggestedIdealBudget: `${formatTRY(budget.idealRange[0])} - ${formatTRY(budget.idealRange[1])} / ay (tahmini)`,
    suggestedAggressiveBudget: `${formatTRY(budget.aggressiveRange[0])} - ${formatTRY(budget.aggressiveRange[1])} / ay (tahmini)`,
    expectedSalesCycle: profile.key === "property_high_consideration" || profile.key === "regulated_professional"
      ? "3-6 hafta (araştırma yoğun karar süreci, tahmini)"
      : "1-2 hafta (tahmini)",
    priorityLevel: tier.label,
    followUpDate
  };
}

// ============================================================================
// Outreach assistant — deterministic message generation using only the
// selected business's real evidence. AI may enhance this, but the module
// must remain fully usable without it.
// ============================================================================

export type OutreachMessages = {
  whatsapp: string;
  instagramDm: string;
  phoneScript: string;
  followUp: string;
  auditSummary: string;
};

export function buildOutreachMessages(business: DiscoveredBusiness, opportunityScore: number): OutreachMessages {
  const rating = Number(business.googleRating || 0);
  const reviews = Number(business.reviewCount || 0);
  const name = business.name || "işletmeniz";
  const hasRatingEvidence = rating > 0;
  const strengthLine = hasRatingEvidence
    ? `Google'da ${rating.toFixed(1)} puan ve ${reviews} yorumla ${reviews >= 25 ? "güçlü bir güven ortamı" : "başlangıç seviyesinde bir itibar"} oluşturduğunuzu gördüm.`
    : "İşletmenizi Manisa bölgesinde incelerken dikkatimi çekti.";
  const gapLines: string[] = [];
  if (!business.website) gapLines.push("web tarafında ziyaretçiyi doğrudan WhatsApp'a veya randevuya yönlendiren net bir sayfa göremedim");
  if (business.metaPixelDetected === false || business.metaPixelDetected === null) gapLines.push("Meta reklam görünürlüğünüzü doğrulayamadım");
  const gapLine = gapLines.length ? `Buna rağmen ${gapLines.join(" ve ")}.` : "Dijital altyapınız genel olarak iyi durumda görünüyor.";

  const whatsapp = `Merhaba, ${strengthLine} ${gapLine} İsterseniz ${business.city || "bölgeniz"} için kısa bir reklam fırsatı analizi paylaşabilirim.`;
  const instagramDm = `Merhaba 👋 ${name} için Instagram'ınıza baktım. ${strengthLine} Kısa bir görüşmeyle size özel bir büyüme planı paylaşmak isterim, uygun musunuz?`;
  const phoneScript = `Merhaba, ben HK Dijital'den arıyorum. ${name} işletmenizi incelerken ${hasRatingEvidence ? `${rating.toFixed(1)} puanınızı` : "profilinizi"} fark ettim. Size 5 dakikanızı alacak kısa bir dijital fırsat değerlendirmesi sunmak istiyorum, uygun musunuz?`;
  const followUp = `Merhaba, geçtiğimiz günlerde ${name} için paylaştığım fırsat analizini değerlendirme fırsatınız oldu mu? Sorularınız olursa yanıtlamaktan memnuniyet duyarım.`;
  const auditSummary = [
    `HK Opportunity Score: ${opportunityScore}/100 (${getHkOpportunityTier(opportunityScore).label}).`,
    hasRatingEvidence ? `Google: ${rating.toFixed(1)} puan, ${reviews} yorum.` : "Google puanı/yorumu bulunamadı.",
    business.website ? "Website mevcut." : "Website bulunamadı.",
    business.phone ? "Telefon mevcut." : "Telefon bulunamadı."
  ].join(" ");

  return { whatsapp, instagramDm, phoneScript, followUp, auditSummary };
}
