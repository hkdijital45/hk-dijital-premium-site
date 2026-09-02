// Turkish-aware, dependency-free business-name matching used both by the
// batch analysis prompt (to tell Gemini exactly which strings count) and as
// a deterministic cross-check the scoring layer can fall back on. Never
// used to overrule Gemini's own extraction silently — see scoring.ts.
export function normalizeBusinessNameText(value: string): string {
  return value
    .toLocaleLowerCase("tr")
    .replace(/i̇/g, "i")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ığşçöü\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function textMentionsName(rawText: string, name: string): boolean {
  const normalizedText = normalizeBusinessNameText(rawText);
  const normalizedName = normalizeBusinessNameText(name);
  if (!normalizedName) return false;
  return normalizedText.includes(normalizedName);
}

export function textMentionsAnyName(rawText: string, names: string[]): boolean {
  return names.some((name) => textMentionsName(rawText, name));
}
