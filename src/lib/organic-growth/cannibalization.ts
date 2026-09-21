// Organik Büyüme Merkezi — practical cannibalization detection. Uses only
// real internal evidence already on hand (topic/intent/service/cluster/
// slug similarity) — this is NOT a search-engine-grade analysis and never
// merges/deletes anything automatically; it only flags pairs for human
// review. Zero external imports (unit-testable, pure).

export type CannibalizationCandidate = {
  id: string;
  title: string;
  slug: string;
  primaryTopic: string;
  searchIntent: string;
  targetService: string;
  topicClusterId: string | null;
};

export type CannibalizationConflict = {
  aId: string;
  bId: string;
  aTitle: string;
  bTitle: string;
  reasons: string[];
  severity: "low" | "medium" | "high";
};

function normalize(value: string) {
  return value.toLocaleLowerCase("tr").trim();
}

function titleSimilarity(a: string, b: string) {
  const aWords = new Set(normalize(a).split(/\s+/).filter((w) => w.length > 3));
  const bWords = new Set(normalize(b).split(/\s+/).filter((w) => w.length > 3));
  if (!aWords.size || !bWords.size) return 0;
  let shared = 0;
  for (const word of aWords) if (bWords.has(word)) shared += 1;
  return shared / Math.min(aWords.size, bWords.size);
}

export function detectCannibalization(items: CannibalizationCandidate[]): CannibalizationConflict[] {
  const conflicts: CannibalizationConflict[] = [];
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const a = items[i];
      const b = items[j];
      const reasons: string[] = [];

      const samePrimaryTopic = Boolean(a.primaryTopic) && normalize(a.primaryTopic) === normalize(b.primaryTopic);
      if (samePrimaryTopic) reasons.push("Aynı birincil konu/anahtar kelime kullanılıyor.");

      const sameIntent = Boolean(a.searchIntent) && normalize(a.searchIntent) === normalize(b.searchIntent);
      const sameService = Boolean(a.targetService) && normalize(a.targetService) === normalize(b.targetService);
      if (sameIntent && sameService) reasons.push("Aynı arama niyeti ve aynı hizmet için yazılmış.");

      const sameCluster = Boolean(a.topicClusterId) && a.topicClusterId === b.topicClusterId;
      const similarity = titleSimilarity(a.title, b.title);
      if (sameCluster && similarity >= 0.4) reasons.push("Aynı konu kümesinde, başlıkları önemli ölçüde örtüşüyor.");
      else if (similarity >= 0.6) reasons.push("Başlıklar arasında yüksek kelime örtüşmesi var.");

      if (!reasons.length) continue;

      const severity: "low" | "medium" | "high" = samePrimaryTopic ? "high" : reasons.length >= 2 ? "medium" : "low";
      conflicts.push({ aId: a.id, bId: b.id, aTitle: a.title, bTitle: b.title, reasons, severity });
    }
  }
  return conflicts;
}
