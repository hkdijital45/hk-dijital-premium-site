// Read-only parser for the `notes` text buildNotes() (instagram-
// intelligence/plan.ts) writes into social_content_plan_items — the
// single existing text column already carries every production detail
// (hook/content flow/caption/CTA/hashtag approach/objective/audience/
// priority/rationale/conditions/story support/production notes), so no
// new table/column is needed; this just reads that deterministic,
// labeled-line format back into a structured shape for the UI detail
// panel and PDF export. Must stay in sync with buildNotes()'s exact
// label text — see the LABELS list below.
//
// Format produced by buildNotes(): a leading "[Kaynak: ...]" line,
// followed by zero or more "Label: value" lines, where a field's own
// value may itself span multiple physical lines (embedded newlines) —
// so parsing walks line-by-line, starting a new field only when a line
// begins with a KNOWN label, and folding every following line into that
// field until the next known label (or end of text).
export type ParsedContentPlanNotes = {
  source: string | null;
  hook: string | null;
  contentFlow: string | null;
  caption: string | null;
  summary: string | null;
  cta: string | null;
  hashtagApproach: string | null;
  goal: string | null;
  audience: string | null;
  priority: string | null;
  rationale: string | null;
  conditions: string | null;
  storySupport: string | null;
  productionNotes: string | null;
  /** Any text that didn't match a known label or the source tag — kept
   * rather than silently dropped, so nothing written by an older/unknown
   * format is ever lost. */
  unrecognized: string | null;
};

type FieldKey = Exclude<keyof ParsedContentPlanNotes, "source" | "unrecognized">;

// Order matches buildNotes() exactly.
const FIELD_LABELS: Array<{ key: FieldKey; label: string }> = [
  { key: "hook", label: "Hook" },
  { key: "contentFlow", label: "İçerik Akışı" },
  { key: "caption", label: "Caption" },
  { key: "summary", label: "Özet" },
  { key: "cta", label: "CTA" },
  { key: "hashtagApproach", label: "Hashtag Yaklaşımı" },
  { key: "goal", label: "Amaç" },
  { key: "audience", label: "Hedef kitle" },
  { key: "priority", label: "Öncelik" },
  { key: "rationale", label: "Gerekçe" },
  { key: "conditions", label: "Koşullar / Doğrulanacak" },
  { key: "storySupport", label: "Story Desteği" },
  { key: "productionNotes", label: "Üretim Notu" }
];

function emptyParsed(): ParsedContentPlanNotes {
  return {
    source: null, hook: null, contentFlow: null, caption: null, summary: null, cta: null,
    hashtagApproach: null, goal: null, audience: null, priority: null, rationale: null,
    conditions: null, storySupport: null, productionNotes: null, unrecognized: null
  };
}

export function parseContentPlanNotes(notes: unknown): ParsedContentPlanNotes {
  const result = emptyParsed();
  const text = typeof notes === "string" ? notes : "";
  if (!text.trim()) return result;

  type Bucket = "source" | "unrecognized" | FieldKey;
  const buffers: Partial<Record<Bucket, string[]>> = {};
  let current: Bucket | null = null;

  function matchLabel(line: string): { key: Bucket; rest: string } | null {
    const sourceMatch = line.match(/^\[Kaynak:\s*(.*)\]\s*$/);
    if (sourceMatch) return { key: "source", rest: sourceMatch[1] };
    for (const { key, label } of FIELD_LABELS) {
      if (line.startsWith(`${label}: `)) return { key, rest: line.slice(label.length + 2) };
      if (line === `${label}:`) return { key, rest: "" };
    }
    return null;
  }

  for (const line of text.split("\n")) {
    const match = matchLabel(line);
    if (match) {
      current = match.key;
      (buffers[current] ||= []).push(match.rest);
    } else if (current) {
      buffers[current]!.push(line);
    } else if (line.trim()) {
      current = "unrecognized";
      (buffers[current] ||= []).push(line);
    }
  }

  for (const key of Object.keys(buffers) as Bucket[]) {
    const joined = (buffers[key] || []).join("\n").trim();
    if (joined) (result as Record<Bucket, string | null>)[key] = joined;
  }
  return result;
}

/** True when a parsed record carries at least one real production-detail
 * field beyond the bare source tag — used by the UI to decide whether a
 * "Detay" affordance/section has anything meaningful to show. */
export function hasContentPlanDetails(parsed: ParsedContentPlanNotes): boolean {
  return Boolean(
    parsed.hook || parsed.contentFlow || parsed.caption || parsed.summary || parsed.cta ||
    parsed.hashtagApproach || parsed.goal || parsed.audience || parsed.priority ||
    parsed.rationale || parsed.conditions || parsed.storySupport || parsed.productionNotes ||
    parsed.unrecognized
  );
}
