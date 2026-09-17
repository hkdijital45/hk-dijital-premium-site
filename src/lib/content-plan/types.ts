// İçerik Planlama Merkezi — shared types/constants between the API routes
// and the admin UI. Deliberately separate from src/lib/social-autopilot/
// (that's the AI-generation pipeline; this is a plain manual tracker).

export const CONTENT_PLAN_WORKSPACE_ID = "hk-dijital";

export const PLATFORM_KEYS = ["instagram", "facebook", "tiktok", "youtube", "linkedin"] as const;
export type PlatformKey = (typeof PLATFORM_KEYS)[number];

export const PLATFORM_LABELS: Record<PlatformKey, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
  linkedin: "LinkedIn"
};

// Small accent dots only (never a full colored surface) — see the
// component's design brief.
export const PLATFORM_ACCENT: Record<PlatformKey, string> = {
  instagram: "#c026d3",
  facebook: "#1d4ed8",
  tiktok: "#0f172a",
  youtube: "#dc2626",
  linkedin: "#0a66c2"
};

export const CONTENT_FORMAT_KEYS = ["static", "carousel", "reels", "story", "video", "shorts", "other"] as const;
export type ContentFormatKey = (typeof CONTENT_FORMAT_KEYS)[number];

export const CONTENT_FORMAT_LABELS: Record<ContentFormatKey, string> = {
  static: "Statik",
  carousel: "Carousel",
  reels: "Reels",
  story: "Story",
  video: "Video",
  shorts: "Shorts",
  other: "Diğer"
};

// Starting theme list — the UI also lets the user type a free custom
// theme, which then simply becomes another value in `theme` (no separate
// themes table; any distinct string already-used by another row shows up
// as a selectable option too).
export const DEFAULT_THEMES = [
  "SEO / GEO",
  "Google Ads",
  "Meta Ads",
  "Sosyal Medya",
  "Dijital Pazarlama",
  "Web Sitesi",
  "Yapay Zekâ",
  "Ajans İpuçları",
  "Eğitim",
  "Vaka / Analiz",
  "Marka Bilinirliği",
  "Diğer"
];

export type ContentPlanItem = {
  id: string;
  workspace_id: string;
  scheduled_date: string;
  platforms: string[];
  theme: string;
  content_title: string;
  content_format: string;
  notes: string;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};
