// Multi-stage content quality gate (spec section 14). Combines cheap local
// deterministic checks (privacy, cliché, duplicate, platform-fit, SEO) with
// one AI pass covering the four dimensions that genuinely need editorial
// judgement (brand fit, natural language, CTA quality, grammar) — see
// prompts.ts for why this is one combined AI call rather than four separate
// ones. Privacy is a hard, non-negotiable gate: any real-customer-data leak
// caps the score regardless of every other dimension, per spec section 6.
import { generateSocialContent, parseStructuredJson } from "./ai-client";
import { buildQualityReviewPrompt } from "./prompts";
import { detectCliches, clicheScorePenalty, styleWarnings, type ClicheHit } from "./cliche-detector";
import { scanForPrivacyLeaks, type PrivacyWatchlist, type PrivacyLeakHit } from "./privacy-filter";
import type { SocialBrandProfile, SocialClicheEntry, SocialContentItem, SocialQualityCheckResult } from "./types";

type CheckResult = { passed: boolean; score: number; detail: string };

function jaccardSimilarity(a: string, b: string) {
  const tokenize = (text: string) => new Set(text.toLocaleLowerCase("tr").normalize("NFKC").split(/[^a-zçğıöşü0-9]+/u).filter((token) => token.length > 2));
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (!setA.size || !setB.size) return 0;
  let intersection = 0;
  for (const token of setA) if (setB.has(token)) intersection += 1;
  const union = setA.size + setB.size - intersection;
  return union ? intersection / union : 0;
}

function fullText(item: Pick<SocialContentItem, "hook" | "caption" | "creative_brief">) {
  return [item.hook, item.caption, item.creative_brief?.script || ""].filter(Boolean).join("\n");
}

function checkPrivacy(item: SocialContentItem, watchlist: PrivacyWatchlist): { result: CheckResult; hits: PrivacyLeakHit[] } {
  const hits = [
    ...scanForPrivacyLeaks(item.caption, watchlist),
    ...scanForPrivacyLeaks(item.hook, watchlist),
    ...scanForPrivacyLeaks(item.creative_brief?.script || "", watchlist)
  ];
  return {
    hits,
    result: hits.length
      ? { passed: false, score: 0, detail: `Olası gerçek müşteri verisi tespit edildi: ${hits.map((hit) => `${hit.type}:${hit.value}`).join(", ")}` }
      : { passed: true, score: 100, detail: "Gerçek müşteri verisi tespit edilmedi." }
  };
}

function checkCliche(item: SocialContentItem, blacklist: SocialClicheEntry[]): { result: CheckResult; hits: ClicheHit[] } {
  const text = fullText(item);
  const hits = detectCliches(text, blacklist);
  const warnings = styleWarnings(text);
  const penalty = clicheScorePenalty(hits) + warnings.length * 5;
  const score = Math.max(0, 100 - penalty);
  return {
    hits,
    result: {
      passed: score >= 70,
      score,
      detail: hits.length || warnings.length
        ? `Klişe/AI izi tespit edildi: ${[...hits.map((hit) => hit.phrase), ...warnings].join("; ")}`
        : "Klişe ifade tespit edilmedi."
    }
  };
}

function checkDuplicate(item: SocialContentItem, recent: Array<Pick<SocialContentItem, "hook" | "caption" | "creative_brief">>): CheckResult {
  const text = fullText(item);
  let maxSimilarity = 0;
  for (const other of recent) {
    const similarity = jaccardSimilarity(text, fullText(other));
    if (similarity > maxSimilarity) maxSimilarity = similarity;
  }
  const score = Math.round(100 - maxSimilarity * 100);
  return {
    passed: maxSimilarity < 0.55,
    score,
    detail: maxSimilarity >= 0.55
      ? `Son içeriklerle yüksek benzerlik (%${Math.round(maxSimilarity * 100)}) — özgünlük düşük.`
      : "Son içeriklerle önemli bir benzerlik tespit edilmedi."
  };
}

const FABRICATED_STAT_PATTERN = /%\s?\d{2,3}\s*(artış|büyüme|düşüş|iyileşme)/giu;
const UNQUALIFIED_RESEARCH_CLAIM = /(araştırmaya göre|çalışmalar gösteriyor ki|bilimsel olarak kanıtlanmış|istatistiklere göre)/giu;

function checkFactuality(item: SocialContentItem): CheckResult {
  const text = fullText(item);
  const statHits = text.match(FABRICATED_STAT_PATTERN) || [];
  const claimHits = text.match(UNQUALIFIED_RESEARCH_CLAIM) || [];
  const penalty = statHits.length * 25 + claimHits.length * 20;
  const score = Math.max(0, 100 - penalty);
  return {
    passed: score >= 80,
    score,
    detail: statHits.length || claimHits.length
      ? `Doğrulanmamış/uydurma olabilecek iddia: ${[...statHits, ...claimHits].join("; ")} — kaynak belirtilmeden somut rakam/araştırma iddiası kullanılmamalı.`
      : "Doğrulanamayan iddia tespit edilmedi."
  };
}

function checkPlatformFit(item: SocialContentItem): CheckResult {
  const issues: string[] = [];
  if (item.caption.length > 2200) issues.push(`Caption çok uzun (${item.caption.length}/2200)`);
  if (item.hashtags.length > 0 && (item.hashtags.length < 3 || item.hashtags.length > 8)) issues.push(`Hashtag sayısı önerilen aralıkta değil (${item.hashtags.length}, önerilen 3-8)`);
  if (item.content_type === "reel") {
    const duration = item.creative_brief?.estimated_duration_seconds;
    if (duration && (duration < 5 || duration > 90)) issues.push(`Reel süresi Instagram sınırları dışında (${duration}sn, izin verilen 5-90sn)`);
  }
  if (item.content_type === "carousel") {
    const slideCount = item.creative_brief?.slides?.length || 0;
    if (slideCount > 10) issues.push(`Carousel 10 slayt sınırını aşıyor (${slideCount})`);
    if (slideCount < 2) issues.push("Carousel en az 2 slayt içermeli");
  }
  const score = Math.max(0, 100 - issues.length * 25);
  return { passed: issues.length === 0, score, detail: issues.join("; ") || "Platform gereksinimlerine uygun." };
}

function checkSeoRelevance(item: SocialContentItem): CheckResult {
  if (!item.seo_keywords.length) return { passed: false, score: 50, detail: "SEO anahtar kelimesi belirtilmemiş." };
  const haystack = fullText(item).toLocaleLowerCase("tr");
  const present = item.seo_keywords.filter((keyword) => haystack.includes(keyword.toLocaleLowerCase("tr")));
  const score = Math.round((present.length / item.seo_keywords.length) * 100);
  return { passed: score >= 50, score, detail: `${present.length}/${item.seo_keywords.length} anahtar kelime içerikte geçiyor.` };
}

function checkCtaRepetition(item: SocialContentItem, recent: Array<Pick<SocialContentItem, "cta">>): CheckResult {
  const normalizedCta = item.cta.trim().toLocaleLowerCase("tr");
  if (!normalizedCta) return { passed: false, score: 40, detail: "CTA boş." };
  const repeats = recent.filter((other) => other.cta.trim().toLocaleLowerCase("tr") === normalizedCta).length;
  const score = Math.max(30, 100 - repeats * 30);
  return { passed: repeats < 2, score, detail: repeats >= 2 ? `Aynı CTA son içeriklerde ${repeats} kez tekrarlanmış — çeşitlendir.` : "CTA çeşitliliği uygun." };
}

export async function runQualityGate(params: {
  item: SocialContentItem;
  brand: SocialBrandProfile;
  blacklist: SocialClicheEntry[];
  watchlist: PrivacyWatchlist;
  recentItems: Array<Pick<SocialContentItem, "hook" | "caption" | "creative_brief" | "cta">>;
  attempt: number;
  aiPreference?: "auto" | "anthropic" | "gemini";
}): Promise<SocialQualityCheckResult & { aiUsedDemo: boolean }> {
  const { item, brand, blacklist, watchlist, recentItems, attempt } = params;

  const privacy = checkPrivacy(item, watchlist);
  const cliche = checkCliche(item, blacklist);
  const duplicate = checkDuplicate(item, recentItems);
  const factuality = checkFactuality(item);
  const platformFit = checkPlatformFit(item);
  const seoRelevance = checkSeoRelevance(item);
  const ctaRepetition = checkCtaRepetition(item, recentItems);

  const reviewPrompt = buildQualityReviewPrompt({
    brand, contentType: item.content_type, caption: item.caption, hook: item.hook, script: item.creative_brief?.script
  });
  const aiResult = await generateSocialContent({
    action: "quality-reviewer",
    systemPrompt: reviewPrompt.system,
    prompt: reviewPrompt.prompt,
    preference: params.aiPreference,
    complexity: "normal",
    expectedOutputSize: "short"
  });

  type AiReview = { brand_fit: number; natural_language: number; cta_quality: number; grammar: number; notes: string; suggested_rewrite: string | null };
  const isAiReview = (value: unknown): value is AiReview =>
    typeof value === "object" && value !== null &&
    typeof (value as AiReview).brand_fit === "number" && typeof (value as AiReview).natural_language === "number" &&
    typeof (value as AiReview).cta_quality === "number" && typeof (value as AiReview).grammar === "number";

  let aiReview: AiReview | null = null;
  try {
    aiReview = parseStructuredJson(aiResult.text, isAiReview);
  } catch {
    aiReview = null; // AI editorial pass unavailable this attempt — local checks still gate the item.
  }

  const checks: Record<string, CheckResult> = {
    privacy: privacy.result,
    client_data_leak: privacy.result,
    cliche_and_natural_language: cliche.result,
    duplicate: duplicate,
    factuality_and_unsupported_claims: factuality,
    platform_fit: platformFit,
    seo_relevance: seoRelevance,
    cta_quality: aiReview
      ? { passed: aiReview.cta_quality >= 70 && ctaRepetition.passed, score: Math.round((aiReview.cta_quality + ctaRepetition.score) / 2), detail: `${aiReview.notes} ${ctaRepetition.detail}`.trim() }
      : ctaRepetition,
    brand_fit: aiReview ? { passed: aiReview.brand_fit >= 70, score: aiReview.brand_fit, detail: aiReview.notes } : { passed: true, score: 70, detail: "AI editoryal denetimi bu denemede kullanılamadı — varsayılan geçer puan uygulandı." },
    grammar: aiReview ? { passed: aiReview.grammar >= 70, score: aiReview.grammar, detail: aiReview.notes } : { passed: true, score: 70, detail: "AI editoryal denetimi bu denemede kullanılamadı." }
  };

  const weights: Record<string, number> = {
    privacy: 3, client_data_leak: 0, // same underlying check — don't double-count
    cliche_and_natural_language: 1.2, duplicate: 1, factuality_and_unsupported_claims: 1.3,
    platform_fit: 0.8, seo_relevance: 0.6, cta_quality: 1, brand_fit: 1.2, grammar: 0.8
  };
  const totalWeight = Object.entries(weights).reduce((sum, [key, weight]) => checks[key] ? sum + weight : sum, 0);
  let overall = Math.round(
    Object.entries(weights).reduce((sum, [key, weight]) => checks[key] ? sum + checks[key].score * weight : sum, 0) / (totalWeight || 1)
  );
  // Privacy is a hard, non-negotiable gate — no weighted average can rescue
  // a real customer-data leak into a publishable score.
  if (!privacy.result.passed) overall = Math.min(overall, 15);

  const passed = privacy.result.passed && overall >= 0 && Object.values(checks).every((check) => check.passed || check === checks.client_data_leak);

  return {
    content_item_id: item.id,
    overall_score: overall,
    checks,
    passed,
    attempt,
    aiUsedDemo: aiResult.provider === "demo"
  };
}
