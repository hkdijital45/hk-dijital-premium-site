// HK Lead Intelligence Engine ("Müşteri İstihbarat Motoru") — pure,
// dependency-free logic (no server-only imports, no DB, no fetch) so it is
// directly unit-testable and reusable from both the API route and any
// future caller, mirroring discovery-report-schema.ts's philosophy: never
// fabricate, validate/backfill AI output from real deterministic evidence,
// keep the scoring authoritative and explainable.
//
// Design decision (documented here since it's the load-bearing one): the
// persisted, sortable/filterable opportunity number is ALWAYS the existing
// canonical calculateHkOpportunityScore() from lead-scoring.ts — the AI
// never invents or overrides that number. The AI's job is qualitative:
// six specialist perspectives (assessment, evidence, sales angle,
// objections, etc.) plus its own confidence framing. This satisfies "do not
// create a competing score" and "the score must be deterministic and
// explainable" simultaneously.
import { createHash } from "crypto";
import {
  buildOutreachMessages,
  buildSalesRecommendation,
  calculateHkOpportunityScore,
  calculateMetaSuitability,
  getHkOpportunityTier,
  scoreDiscoveredBusiness,
  type AdStatusValue,
  type DiscoveredBusiness
} from "./lead-scoring.ts";

export const LEAD_INTELLIGENCE_SCHEMA_VERSION = 1;

export type LeadIntelligencePriority = "very_high" | "high" | "medium" | "low";

export type LeadIntelligenceSpecialists = {
  leadQualifier: { assessment: string; evidence: string[]; concerns: string[] };
  digitalPresence: { assessment: string; strengths: string[]; weaknesses: string[]; unknowns: string[] };
  market: { assessment: string; competitorPressure: string; opportunities: string[] };
  growth: { recommendedServices: string[]; first90Days: string[] };
  sales: { salesAngle: string; firstContact: string; discoveryQuestions: string[]; likelyObjections: string[]; nextAction: string };
};

export type LeadIntelligenceResult = {
  summary: string;
  confidence: number;
  priority: LeadIntelligencePriority;
  specialists: LeadIntelligenceSpecialists;
  finalRecommendation: string;
  redFlags: string[];
};

// The subset of real, already-collected evidence this engine ever reasons
// over. Every field is either a Google Places API fact, a real website-scan
// result (website-signal-scan.ts), or an already-computed deterministic
// score — never an invented metric. `peers` is real market context: other
// businesses already discovered/saved in the same sector+city, not a fresh
// competitor API call (zero marginal Places API cost).
export type LeadIntelligenceEvidence = {
  name: string;
  sector: string;
  city: string;
  district?: string;
  address?: string;
  website?: string;
  phone?: string;
  whatsapp?: string;
  instagram?: string;
  googleRating?: number | null;
  reviewCount?: number;
  googlePlaceId?: string;
  metaAdsStatus?: AdStatusValue;
  googleAdsStatus?: AdStatusValue;
  metaPixelDetected?: boolean | null;
  googleTagDetected?: boolean | null;
  existingLeadStatus?: string | null;
  peers?: { count: number; averageRating: number | null; averageReviewCount: number | null; withWebsiteRatio: number | null };
};

function toBusiness(evidence: LeadIntelligenceEvidence): DiscoveredBusiness {
  return {
    name: evidence.name,
    address: evidence.address,
    phone: evidence.phone,
    website: evidence.website,
    googleRating: evidence.googleRating ?? null,
    reviewCount: evidence.reviewCount ?? 0,
    category: evidence.sector,
    city: evidence.city,
    district: evidence.district,
    whatsapp: evidence.whatsapp,
    instagram: evidence.instagram
  };
}

/** A short, stable identity key for a business — used to upsert/find its
 * intelligence profile and to detect duplicates before creating a new one.
 * Prefers the real Google Place ID (unambiguous); falls back to a
 * normalized name+phone+city+district hash when no place ID is available
 * (e.g. a manually-entered lead). */
export function computeBusinessFingerprint(evidence: Pick<LeadIntelligenceEvidence, "name" | "phone" | "city" | "district" | "googlePlaceId">): string {
  if (evidence.googlePlaceId) return `place:${evidence.googlePlaceId}`;
  const normalized = [evidence.name, evidence.phone?.replace(/\D/g, ""), evidence.city, evidence.district]
    .map((part) => String(part || "").trim().toLocaleLowerCase("tr-TR"))
    .join("::");
  return `hash:${createHash("sha256").update(normalized).digest("hex").slice(0, 24)}`;
}

/** Identifies whether the exact same evidence was already analyzed — the
 * cache/staleness key. Deliberately excludes fields that don't affect the
 * analysis (e.g. raw address formatting) and includes the schema version,
 * so a future prompt/schema change naturally invalidates old cached runs. */
export function computeEvidenceFingerprint(evidence: LeadIntelligenceEvidence, analysisLevel: "level1" | "level2"): string {
  const normalized = {
    v: LEAD_INTELLIGENCE_SCHEMA_VERSION,
    level: analysisLevel,
    name: evidence.name,
    sector: evidence.sector,
    city: evidence.city,
    district: evidence.district || "",
    website: Boolean(evidence.website),
    phone: Boolean(evidence.phone),
    whatsapp: Boolean(evidence.whatsapp),
    instagram: Boolean(evidence.instagram),
    rating: evidence.googleRating ?? null,
    reviews: evidence.reviewCount ?? 0,
    metaAds: evidence.metaAdsStatus || null,
    googleAds: evidence.googleAdsStatus || null,
    peers: evidence.peers || null
  };
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

function priorityFromScore(score: number): LeadIntelligencePriority {
  if (score >= 85) return "very_high";
  if (score >= 65) return "high";
  if (score >= 40) return "medium";
  return "low";
}

const PRIORITY_LABELS: Record<LeadIntelligencePriority, string> = {
  very_high: "Çok Yüksek",
  high: "Yüksek",
  medium: "Orta",
  low: "Düşük"
};

export function priorityLabel(priority: LeadIntelligencePriority): string {
  return PRIORITY_LABELS[priority];
}

// Evidence-driven, deterministic service recommendation — NOT
// recommendServicePackage() from packages.ts, which requires a subjective
// goal/budget/platform intake this discovery-stage evidence doesn't have
// (that function is for the quote wizard's self-reported form, not a
// freshly-discovered Maps listing). This reasons only from real,
// observable evidence already in hand.
function deriveRecommendedServices(evidence: LeadIntelligenceEvidence): string[] {
  const services: string[] = [];
  if (!evidence.website) {
    services.push("Web Sitesi / Açılış Sayfası");
    services.push("Google İşletme Profili Optimizasyonu");
  }
  if (evidence.website && evidence.metaPixelDetected === false) services.push("Meta Ads (Pixel kurulumu dahil)");
  if (evidence.website && evidence.googleTagDetected === false) services.push("Ölçümleme / Analytics Kurulumu");
  if (evidence.metaAdsStatus !== "active_signal") services.push("Meta Ads");
  if (evidence.googleAdsStatus !== "active_signal" && evidence.website) services.push("Google Ads");
  if ((evidence.reviewCount ?? 0) < 20) services.push("Local SEO / Yorum Yönetimi");
  if (!evidence.instagram) services.push("Sosyal Medya Yönetimi");
  return [...new Set(services)].slice(0, 5);
}

/** Level 0 — fully deterministic, zero LLM cost. Reuses the existing
 * canonical scoring engine end to end. This is also the exact fallback
 * source used to backfill any missing/malformed part of an AI response —
 * never a fabricated placeholder. */
export function deriveDeterministicIntelligence(evidence: LeadIntelligenceEvidence): LeadIntelligenceResult {
  const business = toBusiness(evidence);
  const scored = scoreDiscoveredBusiness(business);
  // metaAdsStatus/googleAdsStatus arrive already resolved by the caller
  // (the same evaluateAdvertisingSignals() call the discovery route already
  // makes via enrichBusiness()) — reused as-is, never recomputed here.
  const opportunityScore = calculateHkOpportunityScore(business, { metaAdsStatus: evidence.metaAdsStatus || "manual_check_required", googleAdsStatus: evidence.googleAdsStatus || "manual_check_required" });
  const tier = getHkOpportunityTier(opportunityScore);
  const metaSuitability = calculateMetaSuitability(business);
  const salesRecommendation = buildSalesRecommendation(business, opportunityScore);
  const outreach = buildOutreachMessages(business, opportunityScore);
  const priority = priorityFromScore(opportunityScore);

  const digitalWeaknesses: string[] = [];
  const digitalStrengths: string[] = [];
  const digitalUnknowns: string[] = [];
  if (evidence.website) digitalStrengths.push("Web sitesi mevcut."); else digitalWeaknesses.push("Web sitesi bulunamadı.");
  if (evidence.phone) digitalStrengths.push("Doğrudan telefon iletişimi mevcut."); else digitalWeaknesses.push("Telefon bilgisi eksik.");
  if (evidence.instagram) digitalStrengths.push("Instagram hesabı mevcut."); else digitalUnknowns.push("Sosyal medya hesabı tespit edilemedi.");
  if (evidence.metaPixelDetected === true) digitalStrengths.push("Meta Pixel tespit edildi — reklam altyapısı kısmen hazır.");
  else if (evidence.metaPixelDetected === false) digitalWeaknesses.push("Meta Pixel tespit edilmedi — remarketing altyapısı yok.");
  else digitalUnknowns.push("Meta Pixel durumu doğrulanamadı.");
  if (evidence.googleTagDetected === true) digitalStrengths.push("Google ölçümleme etiketi tespit edildi.");
  else if (evidence.googleTagDetected === false) digitalWeaknesses.push("Google ölçümleme etiketi tespit edilmedi.");
  else digitalUnknowns.push("Google ölçümleme durumu doğrulanamadı.");
  if (typeof evidence.googleRating === "number") digitalStrengths.push(`Google puanı ${evidence.googleRating.toFixed(1)}.`);
  else digitalUnknowns.push("Google puanı mevcut değil.");
  if ((evidence.reviewCount ?? 0) > 0) digitalStrengths.push(`${evidence.reviewCount} Google yorumu.`); else digitalWeaknesses.push("Google yorumu bulunmuyor.");

  const marketAssessment = evidence.peers && evidence.peers.count > 0
    ? `${evidence.sector} sektöründe ${evidence.city}${evidence.district ? "/" + evidence.district : ""} bölgesinde daha önce keşfedilen ${evidence.peers.count} işletme referans alındı. Ortalama puan ${evidence.peers.averageRating?.toFixed(1) ?? "veri yok"}, ortalama yorum sayısı ${evidence.peers.averageReviewCount ?? "veri yok"}.`
    : "Aynı sektör/bölgede karşılaştırma için yeterli sayıda daha önce keşfedilmiş işletme yok.";
  const competitorPressure = evidence.peers && evidence.peers.count > 0 && evidence.peers.withWebsiteRatio !== null
    ? evidence.peers.withWebsiteRatio > 0.6
      ? "Bölgedeki benzer işletmelerin çoğunda web sitesi var — dijital rekabet baskısı yüksek."
      : "Bölgedeki benzer işletmelerin çoğunda web sitesi yok — dijital öncelik alınırsa fark yaratılabilir."
    : "Veri mevcut değil";

  return {
    summary: `${evidence.name} (${evidence.sector}) — ${opportunityScore}/100, ${tier.label}.`,
    confidence: evidence.peers && evidence.peers.count >= 3 ? 65 : 45,
    priority,
    specialists: {
      leadQualifier: {
        assessment: `${scored.priorityLabel}. ${salesRecommendation.estimatedSalesProbabilityLabel}.`,
        evidence: scored.scoreReasons.heat,
        concerns: scored.scoreReasons.maturity
      },
      digitalPresence: {
        assessment: digitalWeaknesses.length > digitalStrengths.length ? "Dijital varlık zayıf, somut fırsat alanları var." : "Dijital varlık kısmen kurulu, iyileştirme alanları var.",
        strengths: digitalStrengths,
        weaknesses: digitalWeaknesses,
        unknowns: digitalUnknowns
      },
      market: {
        assessment: marketAssessment,
        competitorPressure,
        opportunities: evidence.peers && evidence.peers.withWebsiteRatio !== null && evidence.peers.withWebsiteRatio < 0.6
          ? ["Bölgede dijital öncelik alan işletme sayısı az — erken hareket avantajı."]
          : []
      },
      growth: {
        recommendedServices: deriveRecommendedServices(evidence),
        first90Days: [
          salesRecommendation.recommendedOffer,
          `Önerilen paket: ${salesRecommendation.recommendedPackageName} (${salesRecommendation.recommendedPackageCategory}).`,
          `Beklenen satış süreci: ${salesRecommendation.expectedSalesCycle}.`
        ]
      },
      sales: {
        salesAngle: salesRecommendation.recommendedOffer,
        firstContact: outreach.whatsapp || outreach.phoneScript || "İlk temas için WhatsApp veya telefon kullanılabilir.",
        discoveryQuestions: [
          "Şu anda reklam veya sosyal medya yönetimi için harici destek alıyor musunuz?",
          "Aylık yeni müşteri/randevu hedefiniz nedir?",
          "Google veya Instagram üzerinden ne sıklıkla geri dönüş alıyorsunuz?"
        ],
        likelyObjections: ["Bütçe belirsizliği", "Daha önce ajans deneyiminden memnuniyetsizlik olabilir"],
        nextAction: opportunityScore >= 65 ? "Bugün/yarın ilk temas kurulmalı." : "Takip listesine eklenip düşük öncelikli aralıkta izlenmeli."
      }
    },
    finalRecommendation: `${tier.recommendedAction} ${metaSuitability.primaryChannelNote}`.trim(),
    redFlags: evidence.existingLeadStatus === "Kaybedildi" ? ["Bu işletme daha önce kaybedilen bir fırsat olarak işaretlenmiş."] : []
  };
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/** Validates a raw AI JSON response against the required shape. Anything
 * missing, malformed, or of the wrong type is backfilled from `fallback`
 * (the real, deterministic result) — the AI's own valid fields are always
 * kept as-is. Mirrors discovery-report-schema.ts's
 * validateAndBackfillSections() philosophy: never fabricate, never discard
 * what the AI actually got right. */
export function validateLeadIntelligenceResult(raw: unknown, fallback: LeadIntelligenceResult): { result: LeadIntelligenceResult; backfilledFields: string[] } {
  const backfilledFields: string[] = [];
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const specialistsSource = source.specialists && typeof source.specialists === "object" ? (source.specialists as Record<string, unknown>) : {};

  function str(value: unknown, field: string, fallbackValue: string): string {
    if (typeof value === "string" && value.trim()) return value.trim();
    backfilledFields.push(field);
    return fallbackValue;
  }
  function arr(value: unknown, field: string, fallbackValue: string[]): string[] {
    if (isNonEmptyStringArray(value)) return value;
    backfilledFields.push(field);
    return fallbackValue;
  }
  function num(value: unknown, field: string, fallbackValue: number): number {
    if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.min(100, Math.round(value)));
    backfilledFields.push(field);
    return fallbackValue;
  }
  function priority(value: unknown, field: string, fallbackValue: LeadIntelligencePriority): LeadIntelligencePriority {
    if (value === "very_high" || value === "high" || value === "medium" || value === "low") return value;
    backfilledFields.push(field);
    return fallbackValue;
  }

  const lq = specialistsSource.leadQualifier && typeof specialistsSource.leadQualifier === "object" ? (specialistsSource.leadQualifier as Record<string, unknown>) : {};
  const dp = specialistsSource.digitalPresence && typeof specialistsSource.digitalPresence === "object" ? (specialistsSource.digitalPresence as Record<string, unknown>) : {};
  const mk = specialistsSource.market && typeof specialistsSource.market === "object" ? (specialistsSource.market as Record<string, unknown>) : {};
  const gr = specialistsSource.growth && typeof specialistsSource.growth === "object" ? (specialistsSource.growth as Record<string, unknown>) : {};
  const sl = specialistsSource.sales && typeof specialistsSource.sales === "object" ? (specialistsSource.sales as Record<string, unknown>) : {};

  const result: LeadIntelligenceResult = {
    summary: str(source.summary, "summary", fallback.summary),
    confidence: num(source.confidence, "confidence", fallback.confidence),
    priority: priority(source.priority, "priority", fallback.priority),
    specialists: {
      leadQualifier: {
        assessment: str(lq.assessment, "specialists.leadQualifier.assessment", fallback.specialists.leadQualifier.assessment),
        evidence: arr(lq.evidence, "specialists.leadQualifier.evidence", fallback.specialists.leadQualifier.evidence),
        concerns: arr(lq.concerns, "specialists.leadQualifier.concerns", fallback.specialists.leadQualifier.concerns)
      },
      digitalPresence: {
        assessment: str(dp.assessment, "specialists.digitalPresence.assessment", fallback.specialists.digitalPresence.assessment),
        strengths: arr(dp.strengths, "specialists.digitalPresence.strengths", fallback.specialists.digitalPresence.strengths),
        weaknesses: arr(dp.weaknesses, "specialists.digitalPresence.weaknesses", fallback.specialists.digitalPresence.weaknesses),
        unknowns: arr(dp.unknowns, "specialists.digitalPresence.unknowns", fallback.specialists.digitalPresence.unknowns)
      },
      market: {
        assessment: str(mk.assessment, "specialists.market.assessment", fallback.specialists.market.assessment),
        competitorPressure: str(mk.competitorPressure, "specialists.market.competitorPressure", fallback.specialists.market.competitorPressure),
        opportunities: arr(mk.opportunities, "specialists.market.opportunities", fallback.specialists.market.opportunities)
      },
      growth: {
        recommendedServices: arr(gr.recommendedServices, "specialists.growth.recommendedServices", fallback.specialists.growth.recommendedServices),
        first90Days: arr(gr.first90Days, "specialists.growth.first90Days", fallback.specialists.growth.first90Days)
      },
      sales: {
        salesAngle: str(sl.salesAngle, "specialists.sales.salesAngle", fallback.specialists.sales.salesAngle),
        firstContact: str(sl.firstContact, "specialists.sales.firstContact", fallback.specialists.sales.firstContact),
        discoveryQuestions: arr(sl.discoveryQuestions, "specialists.sales.discoveryQuestions", fallback.specialists.sales.discoveryQuestions),
        likelyObjections: arr(sl.likelyObjections, "specialists.sales.likelyObjections", fallback.specialists.sales.likelyObjections),
        nextAction: str(sl.nextAction, "specialists.sales.nextAction", fallback.specialists.sales.nextAction)
      }
    },
    finalRecommendation: str(source.finalRecommendation, "finalRecommendation", fallback.finalRecommendation),
    redFlags: arr(source.redFlags, "redFlags", fallback.redFlags)
  };

  return { result, backfilledFields };
}

/** Compact, normalized evidence packet for the LLM prompt — real fields
 * only, no raw excess data (no full address strings, no internal IDs). */
export function buildLeadIntelligencePrompt(evidence: LeadIntelligenceEvidence, deterministic: LeadIntelligenceResult): string {
  const facts = {
    isim: evidence.name,
    sektor: evidence.sector,
    sehir: evidence.city,
    ilce: evidence.district || "belirtilmedi",
    website_var: Boolean(evidence.website),
    telefon_var: Boolean(evidence.phone),
    whatsapp_var: Boolean(evidence.whatsapp),
    instagram_var: Boolean(evidence.instagram),
    google_puani: evidence.googleRating ?? "veri yok",
    google_yorum_sayisi: evidence.reviewCount ?? 0,
    meta_reklam_durumu: evidence.metaAdsStatus || "bilinmiyor",
    google_reklam_durumu: evidence.googleAdsStatus || "bilinmiyor",
    bolge_karsilastirma: evidence.peers || "veri yok",
    deterministik_firsat_skoru: deterministic.priority
  };
  return `HK Dijital ajansı için aşağıdaki gerçek işletme verisini 6 uzman bakış açısıyla değerlendir: Potansiyel Müşteri Analisti, Dijital Varlık Analisti, Rakip ve Pazar Analisti, Büyüme Stratejisti, Satış Stratejisti, Baş Stratejist (çelişkileri çözüp nihai öneriyi üretir).

KESIN KURALLAR:
- Yalnızca aşağıda verilen gerçek verilerden çıkarım yap. Erişemediğin hiçbir veriyi (reklam harcaması, dönüşüm oranı, sosyal medya etkileşimi vb.) asla uydurma.
- Bir bilgi "veri yok"/"bilinmiyor" ise bunu açıkça belirt, tahmin uydurma.
- Satış garantisi verme. Türkçe, kısa ve satış odaklı yaz — deneme yazısı değil.
- Yalnızca aşağıdaki JSON şemasına birebir uyan, başka hiçbir metin içermeyen bir JSON nesnesi döndür.

Gerçek işletme verisi:
${JSON.stringify(facts)}

JSON şeması:
{"summary":"","confidence":0,"priority":"very_high|high|medium|low","specialists":{"leadQualifier":{"assessment":"","evidence":[],"concerns":[]},"digitalPresence":{"assessment":"","strengths":[],"weaknesses":[],"unknowns":[]},"market":{"assessment":"","competitorPressure":"","opportunities":[]},"growth":{"recommendedServices":[],"first90Days":[]},"sales":{"salesAngle":"","firstContact":"","discoveryQuestions":[],"likelyObjections":[],"nextAction":""}},"finalRecommendation":"","redFlags":[]}`;
}

/** Extracts the first valid JSON object from an LLM text response — models
 * occasionally wrap JSON in prose or a markdown code fence despite
 * instructions. Returns null (never throws) if nothing parseable is found,
 * so the caller always has a safe, real-evidence fallback to use instead. */
export function parseLeadIntelligenceJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}
