import type { FunnelStage } from "./types";

export const FUNNEL_ROTATION: FunnelStage[] = [
  "problem_awareness", "awareness", "trust", "authority", "authority",
  "consideration", "trust", "authority", "conversion", "retention"
];

export const FUNNEL_STAGE_LABELS: Record<FunnelStage, string> = {
  awareness: "Farkındalık",
  problem_awareness: "Problem Farkındalığı",
  consideration: "Değerlendirme",
  authority: "Otorite",
  trust: "Güven",
  conversion: "Dönüşüm",
  retention: "Topluluk / Sadakat"
};

export const DEFAULT_CONTENT_PILLAR_WEIGHTS: Record<string, number> = {
  "Eğitim / Değer": 0.30,
  "Problem Farkındalığı": 0.20,
  "Otorite / Uzmanlık": 0.15,
  "Sık Yapılan Hatalar": 0.15,
  "Topluluk / Etkileşim": 0.10,
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

// Real customer names/handles/domains must never appear in illustrative
// examples — use one of these instead (spec section 10).
export const ANONYMIZED_EXAMPLE_DESCRIPTORS = [
  "yerel bir hizmet işletmesi", "bir e-ticaret markası", "bir sağlık hizmeti işletmesi",
  "bir B2B hizmet şirketi", "analiz edilen bir örnek işletme"
];

export const DEFAULT_QUALITY_THRESHOLD = 85;
export const MAX_QUALITY_AUTO_REVISIONS = 2;

export const COLD_START_TIME_WINDOWS: Array<{ weekday: number; hour: number }> = [
  { weekday: 1, hour: 12 }, { weekday: 1, hour: 20 },
  { weekday: 2, hour: 9 }, { weekday: 2, hour: 19 },
  { weekday: 3, hour: 12 }, { weekday: 3, hour: 20 },
  { weekday: 4, hour: 9 }, { weekday: 4, hour: 19 },
  { weekday: 0, hour: 11 }
];

export const SAMPLE_SIZE_CONFIDENCE = { low: 0, medium: 5, high: 15 } as const;

export const PROMPT_VERSION = "2026.09.1";
