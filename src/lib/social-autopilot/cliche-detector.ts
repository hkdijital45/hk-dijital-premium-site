// Editorial cliché / AI-tell detector (spec section 8). Dependency-free pure
// logic so it is directly unit-testable and reusable from both the quality
// gate and the content-generation retry loop. The blacklist itself lives in
// social_cliche_blacklist (admin-editable) — this module just applies it,
// plus a few structural heuristics that don't fit a flat phrase list
// (repetitive "X değil, Y" constructions, three-item list patterns,
// rhetorical-question openers).

export type ClicheHit = { phrase: string; category: string; index: number };

const STRUCTURAL_PATTERNS: Array<{ category: string; regex: RegExp; label: string }> = [
  // "X değil, Y'dir" / "sadece X değil Y" — repetitive contrast construction.
  { category: "list_pattern", regex: /\b\w+[ıiuü]?\s+değil,?\s+\w+/giu, label: "Tekrarlayan \"X değil, Y\" kalıbı" },
  // Rhetorical-question intros/outros ("Hazır mısınız?", "Siz ne düşünüyorsunuz?" as an opener).
  { category: "rhetorical_question", regex: /^(hazır mısınız|siz(in|ce)? .*mı[sy]ınız)\??/giu, label: "Klişe retorik soru açılışı" }
];

function normalize(text: string) {
  return text.toLocaleLowerCase("tr").normalize("NFKC");
}

export function detectCliches(text: string, blacklist: Array<{ phrase: string; category: string; active: boolean }>): ClicheHit[] {
  if (!text) return [];
  const normalized = normalize(text);
  const hits: ClicheHit[] = [];

  for (const entry of blacklist) {
    if (!entry.active || !entry.phrase.trim()) continue;
    const phrase = normalize(entry.phrase.trim());
    // "..." in a seeded phrase (e.g. "sadece bir ... değil") is a structural
    // placeholder, not a literal string to search for — those are covered by
    // STRUCTURAL_PATTERNS instead. Only match literal seeded phrases here.
    if (phrase.includes("...")) continue;
    let index = normalized.indexOf(phrase);
    while (index !== -1) {
      hits.push({ phrase: entry.phrase, category: entry.category, index });
      index = normalized.indexOf(phrase, index + phrase.length);
    }
  }

  for (const pattern of STRUCTURAL_PATTERNS) {
    const matches = text.matchAll(pattern.regex);
    for (const match of matches) {
      if (match.index === undefined) continue;
      hits.push({ phrase: match[0], category: pattern.category, index: match.index });
    }
  }

  return hits.sort((a, b) => a.index - b.index);
}

export function clicheScorePenalty(hits: ClicheHit[]): number {
  // Each distinct cliché category found costs more than repeats of the same
  // one — a single slip is a minor ding, several distinct AI-tells stack up.
  const distinctCategories = new Set(hits.map((hit) => hit.category)).size;
  return Math.min(60, hits.length * 8 + distinctCategories * 6);
}

// Excessive exclamation marks / emoji density — separate from the phrase
// blacklist since these are structural, not lexical (spec section 7).
export function styleWarnings(text: string): string[] {
  const warnings: string[] = [];
  const exclamationCount = (text.match(/!/g) || []).length;
  if (exclamationCount > 2) warnings.push(`Çok fazla ünlem işareti (${exclamationCount})`);
  // Broad emoji range check — presentation-selector-aware enough for typical
  // caption text without pulling in a full unicode-emoji dependency.
  const emojiCount = (text.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) || []).length;
  if (emojiCount > 3) warnings.push(`Çok fazla emoji (${emojiCount})`);
  const rhetoricalQuestions = (text.match(/\?/g) || []).length;
  if (rhetoricalQuestions > 3) warnings.push("Çok fazla retorik soru");
  return warnings;
}
