// Paket Öneri Robotu (/teklif-al) "Platform İhtiyacınız" step — canonical
// multi-select platform values shared by the wizard UI, the recommendation
// engine, the AI budget/market prompts, the leads API and the admin lead
// analysis prompt. "Hepsi" is a UI-only select-all shortcut; it is never
// stored as a value — the canonical values are always the real services.

export type PlatformKey = "meta" | "google" | "social-media";

export const ALL_PLATFORM_KEYS: PlatformKey[] = ["meta", "google", "social-media"];

export const PLATFORM_OPTIONS: { id: PlatformKey; label: string; emoji: string; hint: string }[] = [
  { id: "meta", label: "Meta", emoji: "📣", hint: "Instagram ve Facebook reklamları" },
  { id: "google", label: "Google", emoji: "🔎", hint: "Google Ads ve arama niyeti" },
  { id: "social-media", label: "Sosyal Medya", emoji: "✨", hint: "İçerik takvimi ve marka görünürlüğü" }
];

export const PLATFORM_LABELS: Record<PlatformKey, string> = {
  meta: "Meta",
  google: "Google",
  "social-media": "Sosyal Medya"
};

// Longer, AI-prompt-friendly labels ("Meta Ads" rather than just "Meta") so
// the model receives an unambiguous, human-readable service name.
export const PLATFORM_AI_LABELS: Record<PlatformKey, string> = {
  meta: "Meta Ads",
  google: "Google Ads",
  "social-media": "Sosyal Medya Yönetimi"
};

function normalizeToken(raw: string): PlatformKey | null {
  const token = raw.trim().toLocaleLowerCase("tr").replace(/\s+/g, " ");
  if (!token) return null;
  if (token === "meta" || token === "instagram" || token === "facebook") return "meta";
  if (token === "google" || token === "google ads") return "google";
  if (token === "sosyal medya" || token === "social media" || token === "social-media" || token === "sosyal" || token === "içerik" || token === "icerik") return "social-media";
  return null;
}

/**
 * Accepts anything a legacy or current client might send — a canonical
 * array, a single platform string, a legacy "Meta + Google" style combined
 * string, or the old "Hepsi"/"all" select-all value — and always returns a
 * deduplicated, validated array of real platform keys in canonical order.
 */
export function normalizePlatformSelection(value: unknown): PlatformKey[] {
  const rawTokens: string[] = Array.isArray(value)
    ? value.flatMap((item) => String(item ?? "").split(/[,+]/))
    : String(value ?? "").split(/[,+]/);

  const found = new Set<PlatformKey>();
  for (const rawToken of rawTokens) {
    const token = rawToken.trim().toLocaleLowerCase("tr");
    if (!token) continue;
    if (["hepsi", "all", "tümü", "tumu", "hepsini", "meta + google + sosyal medya"].includes(token)) {
      ALL_PLATFORM_KEYS.forEach((key) => found.add(key));
      continue;
    }
    const normalized = normalizeToken(rawToken);
    if (normalized) found.add(normalized);
  }
  return ALL_PLATFORM_KEYS.filter((key) => found.has(key));
}

export function isAllPlatformsSelected(selected: PlatformKey[]): boolean {
  return ALL_PLATFORM_KEYS.every((key) => selected.includes(key));
}

export function toggleAllPlatforms(selected: PlatformKey[]): PlatformKey[] {
  return isAllPlatformsSelected(selected) ? [] : [...ALL_PLATFORM_KEYS];
}

export function togglePlatform(selected: PlatformKey[], key: PlatformKey): PlatformKey[] {
  return selected.includes(key) ? selected.filter((item) => item !== key) : ALL_PLATFORM_KEYS.filter((item) => selected.includes(item) || item === key);
}

/** Short, comma-joined display label — e.g. for the WhatsApp summary message. */
export function platformSelectionLabel(selected: PlatformKey[]): string {
  if (!selected.length) return "-";
  return selected.map((key) => PLATFORM_LABELS[key]).join(", ");
}

/** Multi-line "- Meta Ads\n- Google Ads" list for AI prompts, per spec. */
export function platformSelectionReadableList(selected: PlatformKey[]): string {
  if (!selected.length) return "Belirtilmedi";
  return selected.map((key) => `- ${PLATFORM_AI_LABELS[key]}`).join("\n");
}
