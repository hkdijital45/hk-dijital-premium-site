import type { AnalyticsProvider } from "@/lib/analytics-center/types";

// Premium analytics palette — semantic per-platform accents used
// consistently across MetricCard, chart primitives and platform pills.
// Deliberately subtle (pastel surface + a stronger accent for lines/dots),
// never loud saturated backgrounds — see AnalyticsReportingCenter's design
// brief. "neutral" is used for cross-platform (Genel Bakış) surfaces.
export type PlatformThemeKey = AnalyticsProvider | "neutral";

export type PlatformTheme = {
  accent: string; // chart lines, active-state dots, icon color
  accentSoft: string; // tinted KPI card background
  accentBorder: string; // subtle border tint
  gradientFrom: string;
  gradientTo: string;
};

export const PLATFORM_THEME: Record<PlatformThemeKey, PlatformTheme> = {
  neutral: { accent: "#0891b2", accentSoft: "#ecfeff", accentBorder: "#a5f3fc", gradientFrom: "#06b6d4", gradientTo: "#0891b2" },
  instagram: { accent: "#be185d", accentSoft: "#fdf2f8", accentBorder: "#fbcfe8", gradientFrom: "#c026d3", gradientTo: "#be185d" },
  facebook: { accent: "#1d4ed8", accentSoft: "#eff6ff", accentBorder: "#bfdbfe", gradientFrom: "#3b82f6", gradientTo: "#1d4ed8" },
  tiktok: { accent: "#0e7490", accentSoft: "#ecfeff", accentBorder: "#a5f3fc", gradientFrom: "#06b6d4", gradientTo: "#db2777" },
  youtube: { accent: "#dc2626", accentSoft: "#fef2f2", accentBorder: "#fecaca", gradientFrom: "#f87171", gradientTo: "#dc2626" },
  google_ads: { accent: "#b45309", accentSoft: "#fffbeb", accentBorder: "#fde68a", gradientFrom: "#fbbf24", gradientTo: "#2563eb" },
  google_business_profile: { accent: "#15803d", accentSoft: "#f0fdf4", accentBorder: "#bbf7d0", gradientFrom: "#3b82f6", gradientTo: "#15803d" }
};

export function platformTheme(key: PlatformThemeKey): PlatformTheme {
  return PLATFORM_THEME[key] || PLATFORM_THEME.neutral;
}
