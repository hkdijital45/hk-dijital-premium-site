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

// ============================================================================
// HK Lead Intelligence V2 — "Ajan Kurulu" (Agent Council, internally
// agent_council). A genuinely separate, higher-fidelity analysis mode: five
// specialist roles each run as their OWN executeAiTask() call (so they can
// execute concurrently, each reasoning independently from the same shared
// evidence — never from each other's not-yet-available output), then a
// sixth Chief Strategist call receives all five VALIDATED results and
// reconciles them. This is intentionally a distinct, richer schema per
// role (not the combined LeadIntelligenceSpecialists shape above) because a
// dedicated call can honestly return more structured detail per role than
// a single shared call reasonably can — see the version constant below,
// bumped independently of LEAD_INTELLIGENCE_SCHEMA_VERSION so changing the
// council's prompts/schema never invalidates ordinary Level 1/2 caches.
// Bumped 1 -> 2: Chief's model routing changed (POWERFUL -> DEFAULT tier,
// see agent-council-runner.ts) after production evidence showed it was the
// one call reliably falling back to demo. Any council result cached under
// version 1 may hold a demo-fallback Chief from before this fix — bumping
// this (and nothing else) naturally invalidates only those Agent Council
// caches via computeAgentCouncilFingerprint(), leaving Level 1/2 evidence
// fingerprints (LEAD_INTELLIGENCE_SCHEMA_VERSION, unchanged) untouched.
export const AGENT_COUNCIL_SCHEMA_VERSION = 2;

export type AgentStatus = "pending" | "completed" | "failed";
export type Qualification = "strong" | "possible" | "weak";
export type CompetitorPressure = "high" | "medium" | "low" | "unknown";
export type ServicePriority = "high" | "medium" | "low";

export type LeadQualifierAgentResult = {
  assessment: string;
  qualification: Qualification;
  evidence: string[];
  concerns: string[];
  score: number;
  confidence: number;
};

export type DigitalPresenceAgentResult = {
  assessment: string;
  strengths: string[];
  weaknesses: string[];
  unknowns: string[];
  opportunities: string[];
  confidence: number;
};

export type MarketAgentResult = {
  assessment: string;
  competitorPressure: CompetitorPressure;
  evidence: string[];
  opportunities: string[];
  risks: string[];
  confidence: number;
};

export type RecommendedServiceItem = { service: string; priority: ServicePriority; reason: string };

export type GrowthAgentResult = {
  assessment: string;
  recommendedServices: RecommendedServiceItem[];
  first90Days: string[];
  confidence: number;
};

export type SalesAgentResult = {
  assessment: string;
  salesAngle: string;
  firstContact: string;
  discoveryQuestions: string[];
  likelyObjections: string[];
  nextAction: string;
  confidence: number;
};

export type ChiefAgentResult = {
  summary: string;
  agreements: string[];
  disagreements: string[];
  evidenceWeaknesses: string[];
  leadScore: number;
  confidence: number;
  priority: LeadIntelligencePriority;
  recommendedServices: string[];
  primaryService: string | null;
  finalRecommendation: string;
  redFlags: string[];
  nextAction: string;
};

// provider/model/aiUsed are captured per agent (not just once globally on
// runMetadata) so the UI can honestly show when some agents used a real
// provider and others silently fell back to demo — a single global
// provider field would misrepresent a mixed-outcome run as either fully
// real or fully fallback.
export type AgentCouncilSpecialistEntry<T> = { status: AgentStatus; result: T | null; error?: string; provider?: string | null; model?: string | null; aiUsed?: boolean };

export type AgentCouncilResult = {
  version: number;
  specialists: {
    leadQualifier: AgentCouncilSpecialistEntry<LeadQualifierAgentResult>;
    digitalPresence: AgentCouncilSpecialistEntry<DigitalPresenceAgentResult>;
    market: AgentCouncilSpecialistEntry<MarketAgentResult>;
    growth: AgentCouncilSpecialistEntry<GrowthAgentResult>;
    sales: AgentCouncilSpecialistEntry<SalesAgentResult>;
  };
  chief: AgentCouncilSpecialistEntry<ChiefAgentResult>;
  runMetadata: {
    startedAt: string;
    completedAt: string | null;
    logicalAiCallCount: number;
    provider: string | null;
    model: string | null;
    evidenceFingerprint: string;
    councilFingerprint: string;
    // Only ever populated from real values the AI router itself reported
    // (see AiRouterResult.inputTokens/outputTokens/thinkingTokens) — null
    // when the router genuinely didn't report them for this provider path.
    // Never estimated or fabricated; the UI must show an honest
    // "not reported" message instead of guessing when this is null.
    tokenUsage: { inputTokens: number | null; outputTokens: number | null; totalTokens: number | null } | null;
  };
};

// Real, sellable HK Dijital services — the only ones the Chief's
// primaryService/recommendedServices should ever point to. Not a strict
// content filter on specialist prose (that would risk discarding a
// legitimate, differently-worded real suggestion) — used only to validate
// the Chief's own structured `primaryService` pick, which is the one field
// downstream sales UI treats as an actionable, canonical label.
export const HK_REAL_SERVICE_CATALOG = [
  "Google Ads", "Meta Ads", "Sosyal Medya Yönetimi", "İçerik Stratejisi",
  "Landing Page / Web Site", "Yerel SEO", "Google Business Profile Optimizasyonu",
  "Remarketing", "Dönüşüm Optimizasyonu", "Ölçüm / Analytics"
] as const;

function normalizeServiceName(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const needle = value.trim().toLocaleLowerCase("tr-TR");
  const match = HK_REAL_SERVICE_CATALOG.find((service) => {
    const hay = service.toLocaleLowerCase("tr-TR");
    return hay === needle || hay.includes(needle) || needle.includes(hay);
  });
  return match || value.trim();
}

/** Combines the evidence fingerprint with the council schema version — a
 * prompt/schema change (version bump) naturally invalidates only council
 * caches, never ordinary Level 1/2 caches, and identical evidence always
 * reuses a completed council run instead of re-calling six agents. */
export function computeAgentCouncilFingerprint(evidenceFingerprint: string, version: number = AGENT_COUNCIL_SCHEMA_VERSION): string {
  return createHash("sha256").update(`${evidenceFingerprint}::council:${version}`).digest("hex");
}

/** A cheap, honest heuristic for "is there enough real evidence for Agent
 * Council to say anything useful" — not a hard gate (the caller still
 * allows a manual run), just the basis for the low-confidence warning the
 * UI shows before the user commits to the expensive run. */
export function hasThinEvidence(evidence: LeadIntelligenceEvidence): boolean {
  const signals = [evidence.website, evidence.phone, typeof evidence.googleRating === "number", (evidence.reviewCount ?? 0) > 0, evidence.instagram, evidence.whatsapp];
  return signals.filter(Boolean).length <= 1;
}

function coreFacts(evidence: LeadIntelligenceEvidence) {
  return {
    isim: evidence.name,
    sektor: evidence.sector,
    sehir: evidence.city,
    ilce: evidence.district || "belirtilmedi",
    telefon_var: Boolean(evidence.phone),
    website_var: Boolean(evidence.website),
    google_puani: evidence.googleRating ?? "veri yok",
    google_yorum_sayisi: evidence.reviewCount ?? 0
  };
}

const AGENT_RULES = `KESIN KURALLAR:
- Yalnızca verilen gerçek verilerden çıkarım yap. Erişemediğin hiçbir veriyi (reklam harcaması, dönüşüm oranı, sosyal medya etkileşim oranı, ciro, kâr, demografi, ajans ilişkisi, kampanya performansı) asla uydurma.
- Bir bilgi "veri yok"/"bilinmiyor" ise açıkça belirt.
- Satış garantisi verme. Türkçe, kısa ve satış odaklı yaz.
- İç düşünce sürecini yazma; yalnızca sonucu yaz.
- Yalnızca istenen JSON şemasına birebir uyan, başka hiçbir metin içermeyen bir JSON nesnesi döndür.`;

export function buildLeadQualifierAgentPrompt(evidence: LeadIntelligenceEvidence): string {
  const facts = { ...coreFacts(evidence), mevcut_lead_durumu: evidence.existingLeadStatus || "yok" };
  return `Sen HK Dijital ajansı için "Potansiyel Müşteri Analisti"sin. Görevin: bu işletmenin HK Dijital için ne kadar nitelikli bir satış fırsatı olduğunu gerçek verilerden değerlendirmek.

${AGENT_RULES}

Gerçek işletme verisi:
${JSON.stringify(facts)}

JSON şeması:
{"assessment":"","qualification":"strong|possible|weak","evidence":[],"concerns":[],"score":0,"confidence":0}`;
}

export function buildDigitalPresenceAgentPrompt(evidence: LeadIntelligenceEvidence): string {
  const facts = {
    website_var: Boolean(evidence.website),
    telefon_var: Boolean(evidence.phone),
    whatsapp_var: Boolean(evidence.whatsapp),
    instagram_var: Boolean(evidence.instagram),
    meta_pixel: evidence.metaPixelDetected === true ? "tespit edildi" : evidence.metaPixelDetected === false ? "tespit edilmedi" : "doğrulanamadı",
    google_olcumleme: evidence.googleTagDetected === true ? "tespit edildi" : evidence.googleTagDetected === false ? "tespit edilmedi" : "doğrulanamadı",
    meta_reklam_durumu: evidence.metaAdsStatus || "bilinmiyor",
    google_reklam_durumu: evidence.googleAdsStatus || "bilinmiyor",
    google_puani: evidence.googleRating ?? "veri yok",
    google_yorum_sayisi: evidence.reviewCount ?? 0
  };
  return `Sen HK Dijital ajansı için "Dijital Varlık Analisti"sin. Görevin: bu işletmenin gerçek, doğrulanmış dijital altyapı kanıtlarını değerlendirmek.

${AGENT_RULES}

Gerçek dijital kanıt:
${JSON.stringify(facts)}

JSON şeması:
{"assessment":"","strengths":[],"weaknesses":[],"unknowns":[],"opportunities":[],"confidence":0}`;
}

export function buildMarketAgentPrompt(evidence: LeadIntelligenceEvidence): string {
  const facts = { sektor: evidence.sector, sehir: evidence.city, ilce: evidence.district || "belirtilmedi", bolge_karsilastirma: evidence.peers || "veri yok" };
  return `Sen HK Dijital ajansı için "Rakip ve Pazar Analisti"sin. Görevin: bu işletmenin bölgesindeki gerçek, önceden keşfedilmiş benzer işletme verisine dayanarak pazar/rekabet durumunu değerlendirmek. Canlı rakip reklam verisine erişimin yok.

${AGENT_RULES}

Gerçek pazar verisi:
${JSON.stringify(facts)}

JSON şeması:
{"assessment":"","competitorPressure":"high|medium|low|unknown","evidence":[],"opportunities":[],"risks":[],"confidence":0}`;
}

export function buildGrowthAgentPrompt(evidence: LeadIntelligenceEvidence): string {
  const facts = {
    ...coreFacts(evidence),
    meta_reklam_durumu: evidence.metaAdsStatus || "bilinmiyor",
    google_reklam_durumu: evidence.googleAdsStatus || "bilinmiyor",
    meta_pixel: evidence.metaPixelDetected,
    google_olcumleme: evidence.googleTagDetected,
    instagram_var: Boolean(evidence.instagram)
  };
  return `Sen HK Dijital ajansı için "Büyüme Stratejisti"sin. Görevin: gerçek kanıtlardan hangi HK Dijital hizmetlerinin bu işletme için öncelikli olduğunu belirlemek. Yalnızca şu gerçek hizmet listesinden seç: ${HK_REAL_SERVICE_CATALOG.join(", ")}.

${AGENT_RULES}

Gerçek işletme verisi:
${JSON.stringify(facts)}

JSON şeması:
{"assessment":"","recommendedServices":[{"service":"","priority":"high|medium|low","reason":""}],"first90Days":[],"confidence":0}`;
}

export function buildSalesAgentPrompt(evidence: LeadIntelligenceEvidence): string {
  const facts = { ...coreFacts(evidence), mevcut_lead_durumu: evidence.existingLeadStatus || "yok", whatsapp_var: Boolean(evidence.whatsapp) };
  return `Sen HK Dijital ajansı için "Satış Stratejisti"sin. Görevin: bu işletmeyle ilk temas ve satış yaklaşımını gerçek verilerden planlamak.

${AGENT_RULES}

Gerçek işletme verisi:
${JSON.stringify(facts)}

JSON şeması:
{"assessment":"","salesAngle":"","firstContact":"","discoveryQuestions":[],"likelyObjections":[],"nextAction":"","confidence":0}`;
}

/** The Chief receives each specialist's own VALIDATED result (never raw
 * model output) plus which ones failed — never the raw evidence a second
 * time, never the specialists' internal reasoning, only their decision
 * artifacts. This is what makes the conflict-resolution step real:
 * the Chief must explicitly reconcile five actual independent
 * conclusions, not just restate one shared analysis. */
export function buildChiefAgentPrompt(params: {
  evidence: LeadIntelligenceEvidence;
  leadQualifier: LeadQualifierAgentResult | null;
  digitalPresence: DigitalPresenceAgentResult | null;
  market: MarketAgentResult | null;
  growth: GrowthAgentResult | null;
  sales: SalesAgentResult | null;
  failedAgents: string[];
}): string {
  const specialists = {
    potansiyelMusteriAnalisti: params.leadQualifier,
    dijitalVarlikAnalisti: params.digitalPresence,
    rakipVePazarAnalisti: params.market,
    buyumeStratejisti: params.growth,
    satisStratejisti: params.sales
  };
  return `Sen HK Dijital ajansı için "Baş Stratejist"sin. Beş uzmanın BAĞIMSIZ olarak ürettiği gerçek sonuçları aldın. Görevin bunları ortalamak değil, karşılaştırıp gerçek bir nihai karar üretmektir: nerede hemfikirler, nerede çelişiyorlar, hangi kanıt zayıf, en güçlü fırsat ve en büyük risk ne, hangi hizmet önceliklendirilmeli.
${params.failedAgents.length ? `Şu uzmanlardan sonuç alınamadı, eksik bilgiyle karar ver ve bunu confidence'a yansıt: ${params.failedAgents.join(", ")}.` : ""}

${AGENT_RULES}
Önerilen hizmetleri yalnızca şu gerçek listeden seç: ${HK_REAL_SERVICE_CATALOG.join(", ")}.

İşletme: ${JSON.stringify(coreFacts(params.evidence))}

Uzman sonuçları:
${JSON.stringify(specialists)}

JSON şeması:
{"summary":"","agreements":[],"disagreements":[],"evidenceWeaknesses":[],"leadScore":0,"confidence":0,"priority":"very_high|high|medium|low","recommendedServices":[],"primaryService":"","finalRecommendation":"","redFlags":[],"nextAction":""}`;
}

function validateStringField(value: unknown, field: string, fallback: string, backfilled: string[]): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  backfilled.push(field);
  return fallback;
}
function validateArrayField(value: unknown, field: string, fallback: string[], backfilled: string[]): string[] {
  if (isNonEmptyStringArray(value)) return value;
  backfilled.push(field);
  return fallback;
}
function validateNumberField(value: unknown, field: string, fallback: number, backfilled: string[]): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.min(100, Math.round(value)));
  backfilled.push(field);
  return fallback;
}
function validateEnumField<T extends string>(value: unknown, allowed: readonly T[], field: string, fallback: T, backfilled: string[]): T {
  if (typeof value === "string" && (allowed as readonly string[]).includes(value)) return value as T;
  backfilled.push(field);
  return fallback;
}

const QUALIFICATIONS: Qualification[] = ["strong", "possible", "weak"];
const PRESSURES: CompetitorPressure[] = ["high", "medium", "low", "unknown"];
const PRIORITIES: LeadIntelligencePriority[] = ["very_high", "high", "medium", "low"];
const SERVICE_PRIORITIES: ServicePriority[] = ["high", "medium", "low"];

function fallbackFromDeterministic(deterministic: LeadIntelligenceResult) {
  return {
    leadQualifier: { assessment: deterministic.specialists.leadQualifier.assessment, qualification: (deterministic.priority === "very_high" || deterministic.priority === "high" ? "strong" : deterministic.priority === "medium" ? "possible" : "weak") as Qualification, evidence: deterministic.specialists.leadQualifier.evidence, concerns: deterministic.specialists.leadQualifier.concerns, score: deterministic.confidence, confidence: deterministic.confidence },
    digitalPresence: { assessment: deterministic.specialists.digitalPresence.assessment, strengths: deterministic.specialists.digitalPresence.strengths, weaknesses: deterministic.specialists.digitalPresence.weaknesses, unknowns: deterministic.specialists.digitalPresence.unknowns, opportunities: [] as string[], confidence: deterministic.confidence },
    market: { assessment: deterministic.specialists.market.assessment, competitorPressure: "unknown" as CompetitorPressure, evidence: [] as string[], opportunities: deterministic.specialists.market.opportunities, risks: [] as string[], confidence: deterministic.confidence },
    growth: { assessment: "Kurallı ön analiz temel alındı.", recommendedServices: deterministic.specialists.growth.recommendedServices.map((service) => ({ service, priority: "medium" as ServicePriority, reason: "Kurallı ön analiz kanıtına dayanır." })), first90Days: deterministic.specialists.growth.first90Days, confidence: deterministic.confidence },
    sales: { assessment: "Kurallı ön analiz temel alındı.", salesAngle: deterministic.specialists.sales.salesAngle, firstContact: deterministic.specialists.sales.firstContact, discoveryQuestions: deterministic.specialists.sales.discoveryQuestions, likelyObjections: deterministic.specialists.sales.likelyObjections, nextAction: deterministic.specialists.sales.nextAction, confidence: deterministic.confidence },
    chief: { summary: deterministic.summary, agreements: [] as string[], disagreements: [] as string[], evidenceWeaknesses: [] as string[], leadScore: deterministic.confidence, confidence: deterministic.confidence, priority: deterministic.priority, recommendedServices: deterministic.specialists.growth.recommendedServices, primaryService: deterministic.specialists.growth.recommendedServices[0] || null, finalRecommendation: deterministic.finalRecommendation, redFlags: deterministic.redFlags, nextAction: deterministic.specialists.sales.nextAction }
  };
}

export function validateLeadQualifierAgentResult(raw: unknown, deterministic: LeadIntelligenceResult): { result: LeadQualifierAgentResult; backfilledFields: string[] } {
  const backfilled: string[] = [];
  const fb = fallbackFromDeterministic(deterministic).leadQualifier;
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    result: {
      assessment: validateStringField(source.assessment, "assessment", fb.assessment, backfilled),
      qualification: validateEnumField(source.qualification, QUALIFICATIONS, "qualification", fb.qualification, backfilled),
      evidence: validateArrayField(source.evidence, "evidence", fb.evidence, backfilled),
      concerns: validateArrayField(source.concerns, "concerns", fb.concerns, backfilled),
      score: validateNumberField(source.score, "score", fb.score, backfilled),
      confidence: validateNumberField(source.confidence, "confidence", fb.confidence, backfilled)
    },
    backfilledFields: backfilled
  };
}

export function validateDigitalPresenceAgentResult(raw: unknown, deterministic: LeadIntelligenceResult): { result: DigitalPresenceAgentResult; backfilledFields: string[] } {
  const backfilled: string[] = [];
  const fb = fallbackFromDeterministic(deterministic).digitalPresence;
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    result: {
      assessment: validateStringField(source.assessment, "assessment", fb.assessment, backfilled),
      strengths: validateArrayField(source.strengths, "strengths", fb.strengths, backfilled),
      weaknesses: validateArrayField(source.weaknesses, "weaknesses", fb.weaknesses, backfilled),
      unknowns: validateArrayField(source.unknowns, "unknowns", fb.unknowns, backfilled),
      opportunities: validateArrayField(source.opportunities, "opportunities", fb.opportunities, backfilled),
      confidence: validateNumberField(source.confidence, "confidence", fb.confidence, backfilled)
    },
    backfilledFields: backfilled
  };
}

export function validateMarketAgentResult(raw: unknown, deterministic: LeadIntelligenceResult): { result: MarketAgentResult; backfilledFields: string[] } {
  const backfilled: string[] = [];
  const fb = fallbackFromDeterministic(deterministic).market;
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    result: {
      assessment: validateStringField(source.assessment, "assessment", fb.assessment, backfilled),
      competitorPressure: validateEnumField(source.competitorPressure, PRESSURES, "competitorPressure", fb.competitorPressure, backfilled),
      evidence: validateArrayField(source.evidence, "evidence", fb.evidence, backfilled),
      opportunities: validateArrayField(source.opportunities, "opportunities", fb.opportunities, backfilled),
      risks: validateArrayField(source.risks, "risks", fb.risks, backfilled),
      confidence: validateNumberField(source.confidence, "confidence", fb.confidence, backfilled)
    },
    backfilledFields: backfilled
  };
}

function validateRecommendedServiceItems(value: unknown, fallback: RecommendedServiceItem[], backfilled: string[]): RecommendedServiceItem[] {
  if (!Array.isArray(value) || !value.length) { backfilled.push("recommendedServices"); return fallback; }
  const items = value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => {
      const service = normalizeServiceName(item.service);
      if (!service) return null;
      const priority = SERVICE_PRIORITIES.includes(item.priority as ServicePriority) ? (item.priority as ServicePriority) : "medium";
      const reason = typeof item.reason === "string" && item.reason.trim() ? item.reason.trim() : "Kanıt bazlı öneri.";
      return { service, priority, reason };
    })
    .filter((item): item is RecommendedServiceItem => Boolean(item));
  if (!items.length) { backfilled.push("recommendedServices"); return fallback; }
  return items.slice(0, 5);
}

export function validateGrowthAgentResult(raw: unknown, deterministic: LeadIntelligenceResult): { result: GrowthAgentResult; backfilledFields: string[] } {
  const backfilled: string[] = [];
  const fb = fallbackFromDeterministic(deterministic).growth;
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    result: {
      assessment: validateStringField(source.assessment, "assessment", fb.assessment, backfilled),
      recommendedServices: validateRecommendedServiceItems(source.recommendedServices, fb.recommendedServices, backfilled),
      first90Days: validateArrayField(source.first90Days, "first90Days", fb.first90Days, backfilled),
      confidence: validateNumberField(source.confidence, "confidence", fb.confidence, backfilled)
    },
    backfilledFields: backfilled
  };
}

export function validateSalesAgentResult(raw: unknown, deterministic: LeadIntelligenceResult): { result: SalesAgentResult; backfilledFields: string[] } {
  const backfilled: string[] = [];
  const fb = fallbackFromDeterministic(deterministic).sales;
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    result: {
      assessment: validateStringField(source.assessment, "assessment", fb.assessment, backfilled),
      salesAngle: validateStringField(source.salesAngle, "salesAngle", fb.salesAngle, backfilled),
      firstContact: validateStringField(source.firstContact, "firstContact", fb.firstContact, backfilled),
      discoveryQuestions: validateArrayField(source.discoveryQuestions, "discoveryQuestions", fb.discoveryQuestions, backfilled),
      likelyObjections: validateArrayField(source.likelyObjections, "likelyObjections", fb.likelyObjections, backfilled),
      nextAction: validateStringField(source.nextAction, "nextAction", fb.nextAction, backfilled),
      confidence: validateNumberField(source.confidence, "confidence", fb.confidence, backfilled)
    },
    backfilledFields: backfilled
  };
}

export function validateChiefAgentResult(raw: unknown, deterministic: LeadIntelligenceResult): { result: ChiefAgentResult; backfilledFields: string[] } {
  const backfilled: string[] = [];
  const fb = fallbackFromDeterministic(deterministic).chief;
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const recommendedServices = isNonEmptyStringArray(source.recommendedServices)
    ? [...new Set(source.recommendedServices.map((service) => normalizeServiceName(service)).filter((service): service is string => Boolean(service)))]
    : (backfilled.push("recommendedServices"), fb.recommendedServices);
  const primaryService = typeof source.primaryService === "string" && source.primaryService.trim() ? normalizeServiceName(source.primaryService) : (backfilled.push("primaryService"), fb.primaryService);
  return {
    result: {
      summary: validateStringField(source.summary, "summary", fb.summary, backfilled),
      agreements: validateArrayField(source.agreements, "agreements", fb.agreements, backfilled),
      disagreements: validateArrayField(source.disagreements, "disagreements", fb.disagreements, backfilled),
      evidenceWeaknesses: validateArrayField(source.evidenceWeaknesses, "evidenceWeaknesses", fb.evidenceWeaknesses, backfilled),
      leadScore: validateNumberField(source.leadScore, "leadScore", fb.leadScore, backfilled),
      confidence: validateNumberField(source.confidence, "confidence", fb.confidence, backfilled),
      priority: validateEnumField(source.priority, PRIORITIES, "priority", fb.priority, backfilled),
      recommendedServices,
      primaryService,
      finalRecommendation: validateStringField(source.finalRecommendation, "finalRecommendation", fb.finalRecommendation, backfilled),
      redFlags: validateArrayField(source.redFlags, "redFlags", fb.redFlags, backfilled),
      nextAction: validateStringField(source.nextAction, "nextAction", fb.nextAction, backfilled)
    },
    backfilledFields: backfilled
  };
}

/** Bounded-concurrency runner — never an uncontrolled Promise.all over an
 * arbitrary list. Runs at most `limit` jobs at once; every job's
 * success/failure is captured independently (one failing job never rejects
 * the others or the batch). */
export async function runWithConcurrencyLimit<T>(jobs: Array<() => Promise<T>>, limit: number): Promise<Array<{ status: "fulfilled"; value: T } | { status: "rejected"; reason: unknown }>> {
  const results: Array<{ status: "fulfilled"; value: T } | { status: "rejected"; reason: unknown }> = new Array(jobs.length);
  let cursor = 0;
  async function worker() {
    while (cursor < jobs.length) {
      const index = cursor;
      cursor += 1;
      try {
        results[index] = { status: "fulfilled", value: await jobs[index]() };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, jobs.length)) }, worker));
  return results;
}
