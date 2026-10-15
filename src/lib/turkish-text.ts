// Turkish text quality utilities shared by every report builder and the
// Premium PDF engine. Pure (no I/O). Rules:
//   - Case changes always use the tr-TR locale (i/İ, ı/I).
//   - Nothing here rewrites what a sentence says: only spacing, Unicode
//     normalization, and capitalization of LABELS we generate ourselves.
//   - Official brand names / proper nouns are never re-cased.
//   - Word boundaries are Unicode-aware. JavaScript's \b and \w are ASCII
//     only, so /\b\w/ treats "ş", "ü", "ı" ... as separators and produced
//     labels like "işLetme" / "GüçLü YöNler" — the root cause of the mixed
//     capitalization seen in exported reports.

/** Brand / product spellings that must survive every transformation
 * exactly as written. Matched case-insensitively (tr-TR), restored to the
 * canonical form. */
export const PROTECTED_TERMS = [
  "HK Dijital", "HK Admin", "MY CAKE 45", "Zirve AKADEMİ", "Robotik45",
  "Instagram", "WhatsApp", "Facebook", "Messenger", "TikTok", "YouTube", "LinkedIn",
  "Google Ads", "Google Analytics", "Google Business Profile", "Google Haritalar", "Google",
  "Meta Ads", "Meta Business Suite", "Meta Pixel", "Meta",
  "GA4", "GTM", "SEO", "CTA", "CTR", "CPC", "CPM", "ROAS", "KPI", "URL", "DM", "AI", "B2B", "B2C"
] as const;

const LETTER = "\\p{L}";
const WORD_CHAR = "[\\p{L}\\p{N}]";

export function trUpper(text: string): string {
  return text.toLocaleUpperCase("tr-TR");
}

export function trLower(text: string): string {
  return text.toLocaleLowerCase("tr-TR");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Restores the canonical spelling of protected brand terms (e.g. a
 * generated "Instagram" that was lower-cased to "ınstagram"). Only whole
 * words are touched; inflections ("Instagram'da") keep their suffix. */
export function restoreProtectedTerms(text: string): string {
  let out = text;
  for (const term of PROTECTED_TERMS) {
    // Every i/I/ı/İ is interchangeable here: a tr-TR case change turns
    // "Instagram" into "İnstagram"/"ınstagram", which the plain /i flag
    // (no Turkic folding) would not match.
    const body = [...term]
      .map((ch) => (/[iIıİ]/.test(ch) ? "[iIıİ]" : ch === " " ? "\\s+" : escapeRegExp(ch)))
      .join("");
    out = out.replace(new RegExp(`(?<!${WORD_CHAR})${body}(?!${WORD_CHAR})`, "giu"), term);
  }
  return out;
}

function isAcronymOrMixed(word: string): boolean {
  // Already intentionally styled: ALL CAPS (≥2 letters), digits inside a
  // brand ("Robotik45"), or internal capitals ("WhatsApp", "TikTok").
  const letters = word.replace(/[^\p{L}]/gu, "");
  if (letters.length >= 2 && letters === trUpper(letters)) return true;
  return /\p{Ll}\p{Lu}/u.test(word);
}

/** Capitalizes the first letter of each word of a label we generate
 * (e.g. a JSON key "güçlü_yönler" -> "Güçlü Yönler"). Unicode-aware; never
 * lower-cases anything and never touches acronyms or styled brand names. */
/** Turkish conjunctions / particles that stay lower-case inside a title
 * ("Instagram ve Google Ads", not "Instagram Ve Google Ads"). */
const TITLE_SMALL_WORDS = new Set(["ve", "ile", "veya", "ya", "da", "de", "ki", "ama", "için"]);

export function capitalizeWordsTr(text: string): string {
  return restoreProtectedTerms(
    text.replace(new RegExp(`(^|[^\\p{L}\\p{N}'’])(${LETTER})([${"\\p{L}\\p{N}"}'’]*)`, "gu"), (_m, pre: string, first: string, rest: string, offset: number) => {
      const word = first + rest;
      if (isAcronymOrMixed(word)) return pre + word;
      if (offset > 0 && TITLE_SMALL_WORDS.has(word)) return pre + word;
      return pre + trUpper(first) + rest;
    })
  );
}

/** Sentence-case for a label we generate: first letter upper (tr-TR), the
 * rest untouched. */
export function capitalizeFirstTr(text: string): string {
  const m = text.match(/^(\s*)(\p{L})/u);
  if (!m) return text;
  return m[1] + trUpper(m[2]) + text.slice(m[0].length);
}

/** Turns a machine key (snake_case, camelCase, kebab-case) into a readable
 * Turkish label. "güçlüYönler" -> "Güçlü Yönler", "price_incl_vat" ->
 * "Price Incl Vat" (dictionary lookups stay with the caller). */
export function humanizeKeyTr(key: string): string {
  const spaced = key
    .replace(/[_-]+/g, " ")
    .replace(/(\p{Ll})(\p{Lu})/gu, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  return capitalizeWordsTr(spaced);
}

/** Conservative typography clean-up for display text. Never changes
 * words, numbers, URLs or names:
 *   - Unicode NFC; drops the stray combining dot left by non-locale
 *     lower-casing of "İ" ("i̇" -> "i").
 *   - Collapses runs of spaces/tabs, trims each line.
 *   - Removes spaces before , . ; : ! ? ) and after (.
 *   - Adds the missing space after , ; when a letter follows (never after
 *     a period/colon: decimals, times, URLs, "1.250,50" stay intact).
 */
export function cleanTurkishTypography(text: string): string {
  if (!text) return text;
  return text
    .normalize("NFC")
    .replace(/i\u0307/g, "i")
    .replace(/[ \t\u00A0]+/g, " ")
    .split("\n")
    .map((line) =>
      line
        .trim()
        .replace(/ +([,.;:!?)\]])/g, "$1")
        .replace(/([([]) +/g, "$1")
        .replace(/([,;])(\p{L})/gu, "$1 $2")
    )
    .join("\n");
}

// ---------------------------------------------------------------------------
// Glossary: term explanations are kept SEPARATE from running text. They are
// never spliced into a sentence (that broke Turkish suffixes, e.g.
// "Harcanan Tutar (…)ın", and re-explained words inside other
// explanations). Builders detect which terms a report actually uses and add
// one "Terimler Sözlüğü" section.

export type GlossaryTerm = {
  /** Canonical label shown in the glossary. */
  term: string;
  /** One-sentence Turkish explanation. */
  definition: string;
  /** Alternative spellings that count as a use of the term. */
  aliases?: string[];
};

function termPattern(phrase: string): RegExp {
  // Start: not preceded by a letter/digit. End: may be followed by a
  // Turkish suffix (letters, optional apostrophe) — "Tutarın", "CTR'si".
  const body = escapeRegExp(phrase).replace(/\\ /g, "\\s+").replace(/ /g, "\\s+");
  return new RegExp(`(?<!${WORD_CHAR})${body}(?=$|[^\\p{L}\\p{N}]|['’]?\\p{Ll})`, "iu");
}

/** Terms from `glossary` that appear in any of `texts` (Unicode-aware,
 * suffix-tolerant, case-insensitive). Order follows the glossary. */
export function findUsedGlossaryTerms(texts: Array<string | null | undefined>, glossary: GlossaryTerm[]): GlossaryTerm[] {
  const haystack = texts.filter(Boolean).join("\n");
  if (!haystack.trim()) return [];
  return glossary.filter((entry) => [entry.term, ...(entry.aliases || [])].some((phrase) => termPattern(phrase).test(haystack)));
}
