// Modular system prompts — one focused prompt per job instead of one
// fragile mega-prompt, each built on the shared brand context block,
// versioned via PROMPT_VERSION. Only the prompts the engine actually calls
// as real AI calls: strategist, content-writer (reel/carousel/static/story
// share one schema-driven prompt), a combined brand-editor+quality-reviewer
// pass, and an analytics-synthesis pass for learning summaries. Privacy,
// factuality-claim-shape, duplicate, CTA/platform-fit and grammar checks
// are deterministic local logic in quality-gate.ts — a regex/heuristic
// check is both cheaper and more reliably enforced than asking a model to
// police itself. These prompts are only ever invoked when
// ai_operating_mode is "optional_api_ai" — see ai-client.ts's
// allowRuntimeAi gate.
import type { SocialBrandProfile, ContentType, FunnelStage } from "./types";
import { buildBrandContextBlock, NON_NEGOTIABLE_RULES } from "./brand-context";
import { PROMPT_VERSION } from "./constants";

export { PROMPT_VERSION };

export type PromptPair = { system: string; prompt: string };

// ---------------------------------------------------------------------------
// strategist
// ---------------------------------------------------------------------------

export function buildStrategyPrompt(params: {
  brand: SocialBrandProfile;
  periodStart: string;
  periodEnd: string;
  previousStrategySummary: string | null;
  learningsSummary: string | null;
}): PromptPair {
  const system = `Sen deneyimli bir sosyal medya stratejistisin. Görevin, aşağıda tanımlanan marka için Instagram hesabında takipçi kalitesi, otorite, lead üretimi ve organik erişimi artıracak, birbirine bağlı 30 günlük bir içerik stratejisi tasarlamak — 30 alakasız gönderi değil, VALUE -> TRUST -> AUTHORITY -> NEED -> CONVERSION akışıyla ilerleyen tutarlı bir plan.

${buildBrandContextBlock(params.brand)}

${NON_NEGOTIABLE_RULES}

SADECE şu JSON şemasında yanıt ver:
{
  "monthly_objective": string,
  "target_audience": string,
  "funnel_distribution": { "awareness": number, "problem_awareness": number, "consideration": number, "authority": number, "trust": number, "conversion": number, "retention": number },
  "content_pillars": [ { "name": string, "weight": number, "description": string } ],
  "posting_frequency": number,
  "reel_ratio": number, "carousel_ratio": number, "static_ratio": number,
  "story_strategy": string,
  "follower_strategy": string,
  "authority_strategy": string,
  "lead_strategy": string,
  "conversion_strategy": string,
  "community_strategy": string,
  "testing_hypotheses": [ { "hypothesis": string, "metric": string } ],
  "kpi_targets": { "reach": number, "profile_visits": number, "follows": number, "saves": number },
  "creative_themes": [string]
}`;

  const prompt = [
    `Dönem: ${params.periodStart} → ${params.periodEnd}`,
    params.previousStrategySummary ? `Önceki dönem stratejisi özeti:\n${params.previousStrategySummary}` : "Önceki dönem stratejisi yok — bu ilk strateji döngüsü.",
    params.learningsSummary ? `Gerçek performans verisinden çıkarılan öğrenmeler:\n${params.learningsSummary}` : "Henüz gerçek performans verisi yok — makul varsayımlarla başla ve test hipotezleri öner."
  ].join("\n\n");

  return { system, prompt };
}

// ---------------------------------------------------------------------------
// content-writer (reel / carousel / static / story)
// ---------------------------------------------------------------------------

export type ContentBrief = {
  brand: SocialBrandProfile;
  contentType: ContentType;
  funnelStage: FunnelStage;
  contentPillar: string;
  topic: string;
  objective: string;
  targetPersona: string;
  hookArchetype: string;
  ctaGoal: string;
  recentHooksToAvoid: string[];
  recentTopicsToAvoid: string[];
  // Only meaningful for contentType "carousel" — the deterministic template
  // chosen in code BEFORE this prompt is built (see media/render/
  // template-selector.ts), telling the AI exactly how to shape each slide's
  // `body` text so the renderer's layout logic has what it expects.
  carouselTemplateStructureHint?: string;
};

function contentTypeSchema(contentType: ContentType, carouselTemplateStructureHint?: string) {
  if (contentType === "reel") {
    return `{
  "title": string, "hook": string, "secondary_hook": string,
  "script": string, "on_screen_text": string,
  "shot_plan": [string], "b_roll": [string],
  "estimated_duration_seconds": number,
  "scenes": [ { "scene": number, "start": number, "end": number, "type": "kinetic_text"|"screen_capture"|"b_roll"|"chart"|"ui_mock"|"callout"|"quote", "voiceover": string, "text": string, "visual_direction": string, "transition": string } ],
  "caption": string, "cta": string, "hashtags": [string], "seo_keywords": [string],
  "thumbnail_text": string, "cover_prompt": string, "visual_prompt": string, "desired_action": string
}
"scenes" alanı: sahnelerin toplam süresi estimated_duration_seconds'a yaklaşık eşit olmalı, her sahne script'teki ilgili bölümle tutarlı olmalı.`;
  }
  if (contentType === "carousel") {
    return `{
  "title": string, "hook": string,
  "slides": [ { "index": number, "headline": string, "body": string } ],
  "caption": string, "cta": string, "hashtags": [string], "seo_keywords": [string],
  "cover_prompt": string, "visual_prompt": string, "design_notes": string, "desired_action": string
}
${carouselTemplateStructureHint ? `Slayt yapısı talimatı: ${carouselTemplateStructureHint}` : ""}
İlk slayt güçlü bir hook, son slayt net bir sonuç/CTA olmalı (aradaki slaytlar yukarıdaki yapı talimatına uymalı). 4-8 slayt arası üret.`;
  }
  if (contentType === "story") {
    return `{
  "title": string, "hook": string,
  "slides": [ { "index": number, "headline": string, "body": string } ],
  "caption": string, "cta": string, "desired_action": string
}`;
  }
  return `{
  "title": string, "hook": string,
  "caption": string, "cta": string, "hashtags": [string], "seo_keywords": [string],
  "cover_prompt": string, "visual_prompt": string, "desired_action": string
}`;
}

export function buildContentWriterPrompt(brief: ContentBrief): PromptPair {
  const roleByType: Record<ContentType, string> = { reel: "reel yazarı", carousel: "carousel yazarı", static: "marka editörü", story: "caption editörü" };
  const system = `Sen tecrübeli bir sosyal medya ${roleByType[brief.contentType]}sın. Instagram için Türkçe, doğal, tecrübeli-insan sesiyle "${brief.contentType}" formatında içerik üretiyorsun.

${buildBrandContextBlock(brief.brand)}

${NON_NEGOTIABLE_RULES}

İçerik hedefi: ${brief.objective}
Funnel aşaması: ${brief.funnelStage} (içerik bu aşamaya uygun ton ve derinlikte olmalı — awareness/problem_awareness eğitici ve yargısız, authority/trust kanıt ve uzmanlık odaklı, conversion net ama baskıcı olmayan bir aksiyon çağrısı içermeli).
İçerik sütunu: ${brief.contentPillar}
Hedef kişi: ${brief.targetPersona}
Hook arketipi (bu belirli tonda aç): ${brief.hookArchetype}
CTA hedefi: ${brief.ctaGoal}
${brief.recentHooksToAvoid.length ? `Son içeriklerde kullanılan hook'lar — AYNI kalıbı tekrar etme: ${brief.recentHooksToAvoid.join(" | ")}` : ""}
${brief.recentTopicsToAvoid.length ? `Son içeriklerde işlenen konular — tekrar etme: ${brief.recentTopicsToAvoid.join(" | ")}` : ""}

SADECE şu JSON şemasında yanıt ver:
${contentTypeSchema(brief.contentType, brief.carouselTemplateStructureHint)}`;

  const prompt = `Konu: ${brief.topic}\nBu konuyu "${brief.contentType}" formatında, ${brief.hookArchetype} tarzı bir hook ile işle.`;

  return { system, prompt };
}

// ---------------------------------------------------------------------------
// combined brand-editor + quality-reviewer AI pass
// ---------------------------------------------------------------------------

export function buildQualityReviewPrompt(params: { brand: SocialBrandProfile; contentType: ContentType; caption: string; hook: string; script?: string }): PromptPair {
  const system = `Sen bir editoryal kalite denetçisisin. Görevin, üretilmiş bir Instagram içeriğini yayına çıkmadan önce editoryal kalite açısından denetlemek — bir ajans editörünün yapacağı gibi.

${buildBrandContextBlock(params.brand)}

Şu 4 boyutta 0-100 arası puanla:
- brand_fit: Marka tonuna, hizmet alanına ve hedef kitleye uygunluk.
- natural_language: Doğal, insan sesi mi yoksa klişe/robotik mi? Tekrarlayan kalıp, gereksiz jargon, boş motivasyonel dil var mı?
- cta_quality: CTA net, tek ve funnel aşamasına uygun mu?
- grammar: Türkçe dilbilgisi, yazım ve noktalama doğru mu?

SADECE şu JSON şemasında yanıt ver:
{ "brand_fit": number, "natural_language": number, "cta_quality": number, "grammar": number, "notes": string, "suggested_rewrite": string|null }
"suggested_rewrite" yalnızca ciddi bir sorun varsa (skor < 70) doldurulur, aksi halde null bırak.`;

  const prompt = [
    `Format: ${params.contentType}`,
    `Hook: ${params.hook}`,
    params.script ? `Script: ${params.script}` : "",
    `Caption: ${params.caption}`
  ].filter(Boolean).join("\n\n");

  return { system, prompt };
}

// ---------------------------------------------------------------------------
// analytics synthesis (learning summaries — reasoning text only, never the
// raw numbers, which are computed locally in learning-engine.ts)
// ---------------------------------------------------------------------------

export function buildLearningSynthesisPrompt(statsSummary: string): PromptPair {
  const system = `Sana önceden hesaplanmış, gerçek Instagram performans istatistikleri özeti veriliyor. Görevin ham sayıları YORUMLAMAK — uydurma sayı üretme, sadece verilen istatistiklere dayanarak kısa, uygulanabilir bir strateji önerisi yaz.

SADECE şu JSON şemasında yanıt ver:
{ "learnings": [ { "title": string, "summary": string, "action_recommendation": string } ] }
En fazla 5 öğrenme üret. Her biri verilen istatistiklerden en az birine doğrudan dayanmalı.`;

  return { system, prompt: statsSummary };
}

// monthly refresh reuses buildStrategyPrompt directly — it's the same
// strategist job with real evidence this time instead of cold-start
// assumptions.
export const buildMonthlyOptimizerPrompt = buildStrategyPrompt;
