// Lightweight, zero-dependency, zero-API "have I covered this topic
// recently?" check (mission section 7) — normalized word-overlap on
// titles already loaded in the browser (the same list the table already
// renders), never a network call or AI call. Deliberately conservative
// (high threshold, minimum word length) to avoid false positives.
import type { ContentPlanItem } from "./types";

function normalize(text: string): string {
  return text
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ığüşöçİ\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordSet(text: string): Set<string> {
  return new Set(normalize(text).split(" ").filter((w) => w.length > 2));
}

const SIMILARITY_THRESHOLD = 0.6;

/** Overlap ratio relative to the SHORTER title's word set (0..1). */
export function titleSimilarity(a: string, b: string): number {
  const wa = wordSet(a);
  const wb = wordSet(b);
  if (!wa.size || !wb.size) return 0;
  let common = 0;
  for (const word of wa) if (wb.has(word)) common++;
  return common / Math.min(wa.size, wb.size);
}

export function findSimilarContent(
  title: string,
  items: ContentPlanItem[],
  excludeId?: string
): { item: ContentPlanItem; score: number; daysAgo: number } | null {
  const trimmed = title.trim();
  if (trimmed.length < 6) return null; // too short to compare meaningfully
  let best: { item: ContentPlanItem; score: number } | null = null;
  for (const item of items) {
    if (item.id === excludeId || !item.content_title.trim()) continue;
    const score = titleSimilarity(trimmed, item.content_title);
    if (score >= SIMILARITY_THRESHOLD && (!best || score > best.score)) best = { item, score };
  }
  if (!best) return null;
  const days = Math.max(0, Math.round((Date.now() - new Date(`${best.item.scheduled_date}T00:00:00`).getTime()) / 86_400_000));
  return { item: best.item, score: best.score, daysAgo: days };
}
