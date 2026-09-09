export { SOCIAL_WORKSPACE_ID } from "./types";

import type { SocialFunnelStage } from "./types";

// Funnel-stage rotation the monthly calendar deliberately walks the audience
// through (spec section 10): VALUE -> TRUST -> AUTHORITY -> NEED -> CONVERSION.
// Expressed as content funnel stages, repeated across the month so the
// account never turns into a constant sales feed.
export const FUNNEL_ROTATION: SocialFunnelStage[] = [
  "problem_awareness", "awareness", "trust", "authority", "authority",
  "consideration", "trust", "authority", "conversion", "retention"
];

export const FUNNEL_STAGE_LABELS: Record<SocialFunnelStage, string> = {
  awareness: "Farkındalık",
  problem_awareness: "Problem Farkındalığı",
  consideration: "Değerlendirme",
  authority: "Otorite",
  trust: "Güven",
  conversion: "Dönüşüm",
  retention: "Topluluk / Sadakat"
};

// Default content-pillar weights (spec section 9) — admin- and
// AI-adjustable afterwards via social_autopilot_settings.content_pillar_weights.
export const DEFAULT_CONTENT_PILLAR_WEIGHTS: Record<string, number> = {
  "Eğitim / Değer": 0.30,
  "Problem Farkındalığı": 0.20,
  "Otorite / Uzmanlık": 0.15,
  "İşletme / Pazarlama Hataları": 0.15,
  "Sosyal Medya Büyümesi": 0.10,
  "Hizmet / Dönüşüm": 0.10
};

export const HOOK_ARCHETYPES = [
  "problem", "contrarian", "mistake", "curiosity", "warning", "direct_insight",
  "mini_case", "question", "myth_busting", "checklist", "unpopular_truth",
  "before_after", "tactical_advice"
] as const;
export type HookArchetype = (typeof HOOK_ARCHETYPES)[number];

export const CTA_GOALS = ["save", "share", "comment", "follow", "profile_visit", "dm", "consultation", "website_visit"] as const;
export type CtaGoal = (typeof CTA_GOALS)[number];

// Anonymized example descriptors the AI must use instead of any real client
// name/handle/domain (spec section 6).
export const ANONYMIZED_EXAMPLE_DESCRIPTORS = [
  "yerel bir hizmet işletmesi", "bir e-ticaret markası", "bir sağlık hizmeti işletmesi",
  "bir B2B hizmet şirketi", "analiz ettiğimiz bir yerel işletme"
];

export const DEFAULT_QUALITY_THRESHOLD = 85;
export const MAX_QUALITY_AUTO_REVISIONS = 2;

// Cold-start publishing-time priors (spec section 25) — used until enough
// real Instagram performance data exists per weekday/hour/content-type cell.
// Deliberately generic, agency/B2B-audience-appropriate windows; the posting
// -time engine labels these LOW confidence and actively diversifies around
// them to gather real data rather than treating them as proven.
export const COLD_START_TIME_WINDOWS: Array<{ weekday: number; hour: number }> = [
  { weekday: 1, hour: 12 }, { weekday: 1, hour: 20 },
  { weekday: 2, hour: 9 }, { weekday: 2, hour: 19 },
  { weekday: 3, hour: 12 }, { weekday: 3, hour: 20 },
  { weekday: 4, hour: 9 }, { weekday: 4, hour: 19 },
  { weekday: 0, hour: 11 }
];

export const SAMPLE_SIZE_CONFIDENCE = { low: 0, medium: 5, high: 15 } as const;

export const PROMPT_VERSION = "2026.09.1";
