import type { GeminiVisibilityAnswer, GeminiVisibilityScoreBreakdown, GeminiVisibilityScoreLevel } from "./types.ts";
import { GEMINI_VISIBILITY_SCORING_VERSION } from "./types.ts";

// Deterministic scoring, computed here from stored measurable fields —
// Gemini never writes the final score (spec section 6). Weights sum to 100
// when every component is measurable; a component that genuinely has no
// data (e.g. zero answers ever had a citation) is dropped and the remaining
// weights are rescaled proportionally rather than silently scored as 0.
const BASE_WEIGHTS: Record<keyof GeminiVisibilityScoreBreakdown, number> = {
  direct_recommendation: 35,
  name_mention: 20,
  competitor_share: 15,
  citation_presence: 10,
  recommendation_position: 10,
  sentiment: 10
};

export type ScoringResult = {
  score: number;
  breakdown: GeminiVisibilityScoreBreakdown;
  level: GeminiVisibilityScoreLevel;
  unmeasuredComponents: string[];
  scoringVersion: string;
};

function levelFor(score: number): GeminiVisibilityScoreLevel {
  if (score < 30) return "critical";
  if (score < 50) return "weak";
  if (score < 70) return "developing";
  if (score < 85) return "strong";
  return "excellent";
}

export function computeGeminiVisibilityScore(answers: GeminiVisibilityAnswer[]): ScoringResult {
  const completed = answers.filter((answer) => answer.status === "completed" || answer.status === "cached");

  if (!completed.length) {
    return { score: 0, breakdown: {}, level: "critical", unmeasuredComponents: Object.keys(BASE_WEIGHTS), scoringVersion: GEMINI_VISIBILITY_SCORING_VERSION };
  }

  const componentValues: Partial<Record<keyof GeminiVisibilityScoreBreakdown, number>> = {};
  const unmeasured: string[] = [];

  // 1. Direct recommendation rate — only measurable when Gemini's extraction
  // actually determined a yes/no for every completed answer (it always
  // should for a successfully parsed batch analysis; null means the batch
  // analysis itself failed to return a value for that answer).
  const recommendationJudged = completed.filter((answer) => answer.recommended !== null);
  if (recommendationJudged.length) {
    componentValues.direct_recommendation = (recommendationJudged.filter((answer) => answer.recommended).length / recommendationJudged.length) * 100;
  } else {
    unmeasured.push("direct_recommendation");
  }

  // 2. Business name (or an alternate name) mention rate.
  const mentionJudged = completed.filter((answer) => answer.brand_mentioned !== null || answer.alternate_name_mentioned !== null);
  if (mentionJudged.length) {
    const mentioned = mentionJudged.filter((answer) => answer.brand_mentioned || answer.alternate_name_mentioned).length;
    componentValues.name_mention = (mentioned / mentionJudged.length) * 100;
  } else {
    unmeasured.push("name_mention");
  }

  // 3. Visibility share against named competitors — of answers that named
  // at least one business (us or a competitor), what fraction named us.
  const competitiveAnswers = completed.filter((answer) => answer.brand_mentioned || answer.alternate_name_mentioned || answer.competitors_mentioned.length > 0);
  if (competitiveAnswers.length) {
    const usNamed = competitiveAnswers.filter((answer) => answer.brand_mentioned || answer.alternate_name_mentioned).length;
    componentValues.competitor_share = (usNamed / competitiveAnswers.length) * 100;
  } else {
    unmeasured.push("competitor_share");
  }

  // 4. Citation / source-attribution presence — only meaningful across
  // answers that mentioned us at all (a citation on an answer that doesn't
  // even name the business isn't "our" citation).
  const mentionsUs = completed.filter((answer) => answer.brand_mentioned || answer.alternate_name_mentioned);
  if (mentionsUs.length) {
    componentValues.citation_presence = (mentionsUs.filter((answer) => Boolean(answer.citation)).length / mentionsUs.length) * 100;
  } else {
    unmeasured.push("citation_presence");
  }

  // 5. Position within the recommendation list, when Gemini returned an
  // ordered list and we appeared in it. Position 1 = 100, decays linearly,
  // floor of 20 for any appearance beyond 5th place.
  const positioned = completed.filter((answer) => (answer.brand_mentioned || answer.alternate_name_mentioned) && typeof answer.position === "number" && answer.position! > 0);
  if (positioned.length) {
    const positionScores = positioned.map((answer) => Math.max(20, 100 - (answer.position! - 1) * 20));
    componentValues.recommendation_position = positionScores.reduce((sum, value) => sum + value, 0) / positionScores.length;
  } else {
    unmeasured.push("recommendation_position");
  }

  // 6. Sentiment / trust context, only across answers that mention us.
  if (mentionsUs.length) {
    const sentimentJudged = mentionsUs.filter((answer) => answer.sentiment);
    if (sentimentJudged.length) {
      const sentimentScore: Record<string, number> = { positive: 100, neutral: 55, negative: 10 };
      componentValues.sentiment = sentimentJudged.reduce((sum, answer) => sum + (sentimentScore[answer.sentiment!] ?? 55), 0) / sentimentJudged.length;
    } else {
      unmeasured.push("sentiment");
    }
  } else {
    unmeasured.push("sentiment");
  }

  const measuredKeys = (Object.keys(BASE_WEIGHTS) as Array<keyof GeminiVisibilityScoreBreakdown>).filter((key) => componentValues[key] !== undefined);
  const totalMeasuredWeight = measuredKeys.reduce((sum, key) => sum + BASE_WEIGHTS[key], 0);

  const breakdown: GeminiVisibilityScoreBreakdown = {};
  let score = 0;
  if (totalMeasuredWeight > 0) {
    for (const key of measuredKeys) {
      const rescaledWeight = (BASE_WEIGHTS[key] / totalMeasuredWeight) * 100;
      const contribution = (componentValues[key]! * rescaledWeight) / 100;
      breakdown[key] = Math.round(componentValues[key]!);
      score += contribution;
    }
  }

  return {
    score: Math.round(Math.max(0, Math.min(100, score))),
    breakdown,
    level: levelFor(score),
    unmeasuredComponents: unmeasured,
    scoringVersion: GEMINI_VISIBILITY_SCORING_VERSION
  };
}

export { BASE_WEIGHTS as GEMINI_VISIBILITY_SCORE_WEIGHTS };
