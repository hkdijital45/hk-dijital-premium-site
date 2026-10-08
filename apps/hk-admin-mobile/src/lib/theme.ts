// HK Admin mobile design tokens — dark navy surfaces, turquoise brand
// accent, controlled orange highlight. Mirrors the web admin's palette
// intent (cyan/teal accents on a dark operating-system shell) without
// copying its exact hex values 1:1, since the web app's tokens are tuned
// for a light admin surface, not a native dark iOS shell.
export const colors = {
  bg: "#0B1120",
  surface: "#121A2C",
  surfaceAlt: "#19233A",
  border: "#243352",
  textPrimary: "#F4F7FB",
  textSecondary: "#AEB9D4",
  textMuted: "#7C88A6",
  accent: "#1FD1C6",
  accentSoft: "rgba(31,209,198,0.14)",
  orange: "#F2994A",
  orangeSoft: "rgba(242,153,74,0.14)",
  danger: "#F26969",
  dangerSoft: "rgba(242,105,105,0.14)",
  success: "#3DDC97",
  successSoft: "rgba(61,220,151,0.14)"
};

export const radius = { sm: 10, md: 14, lg: 20, xl: 28 };
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const typography = {
  title: { fontSize: 22, fontWeight: "800" as const, color: colors.textPrimary },
  heading: { fontSize: 17, fontWeight: "700" as const, color: colors.textPrimary },
  body: { fontSize: 14, fontWeight: "500" as const, color: colors.textSecondary },
  caption: { fontSize: 12, fontWeight: "600" as const, color: colors.textMuted }
};

export const shadow = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.25,
  shadowRadius: 16,
  elevation: 4
};
