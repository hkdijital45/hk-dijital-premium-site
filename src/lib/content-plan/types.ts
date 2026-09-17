// İçerik Planlama Merkezi — shared types/constants between the API routes
// and the admin UI. Deliberately separate from src/lib/social-autopilot/
// (that's the AI-generation pipeline; this is a plain manual tracker).

export const CONTENT_PLAN_WORKSPACE_ID = "hk-dijital";

// Real table name in production (verified via a direct Supabase REST probe
// on 2026-09-17). NOT "content_plan_items" — that name collides with an
// unrelated, already-live Blog SEO table (supabase/migrations/20260715_
// blog_content_operations.sql, plan_id/blog_post_id/slug shape). This one
// was created separately as public.social_content_plan_items.
export const CONTENT_PLAN_TABLE = "social_content_plan_items";

// HK Dijital's own, real public.companies row (verified via a direct
// Supabase REST probe on 2026-09-17: name "HK DİJİTAL", status "Aktif") —
// the agency manages its own social content through the exact same
// company_id-scoped path every customer uses, rather than a special-cased
// "self account" concept or a synthetic/fake companies row.
export const HK_DIJITAL_COMPANY_ID = "466a4859-332f-4f04-93f9-087fc97e564b";

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
  "Satış",
  "Güven",
  "Marka Bilinirliği",
  "Etkileşim",
  "Eğlence",
  "Bilgilendirme",
  "Vaka / Analiz",
  "Kampanya",
  "Diğer"
];

export type ContentPlanItem = {
  id: string;
  workspace_id: string;
  company_id: string | null;
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
