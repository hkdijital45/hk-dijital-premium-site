// Deterministic performance summarization — one latest observation per
// content item (never sum cumulative windows), grouped/ranked by pillar,
// format and topic using the objective-aware scoring engine. No AI call:
// this is exactly the kind of "calculate what can be derived
// mathematically" logic Claude reasons over via MCP rather than asking a
// runtime provider to (re)compute.
import { computeContentScore } from "./scoring-engine";
import type { SocialContentItem, MetricSnapshot } from "./types";

export type ObservedItem = SocialContentItem & { metric_snapshots: MetricSnapshot[] };

export function summarizePerformance(items: ObservedItem[]) {
  const rows = items.flatMap((item) => {
    const snapshot = [...(item.metric_snapshots || [])].sort((a, b) => b.captured_at.localeCompare(a.captured_at))[0];
    return snapshot ? [{ id: item.id, pillar: item.content_pillar, topic: item.topic, format: item.content_type, objective: item.objective, published_at: item.published_at, snapshot, score: computeContentScore(snapshot, item.cta_goal) }] : [];
  }).sort((a, b) => b.score - a.score);

  function rank(key: "pillar" | "topic" | "format") {
    const groups = new Map<string, number[]>();
    for (const row of rows) groups.set(row[key], [...(groups.get(row[key]) || []), row.score]);
    return [...groups].map(([name, scores]) => ({ name, score: scores.reduce((a, b) => a + b, 0) / scores.length, sample_size: scores.length })).sort((a, b) => b.score - a.score);
  }

  const pillars = rank("pillar");
  const formats = rank("format");
  const topics = rank("topic");
  const saveWinner = rows.filter((r) => r.snapshot.reach > 0).sort((a, b) => b.snapshot.saves / b.snapshot.reach - a.snapshot.saves / a.snapshot.reach)[0];

  return {
    sample_size: rows.length,
    confidence: rows.length >= 30 ? "HIGH" : rows.length >= 10 ? "MEDIUM" : "LOW",
    best_content: rows.slice(0, 10),
    weak_content: [...rows].reverse().slice(0, 10),
    strongest_content_pillar: pillars[0] || null,
    weakest_content_pillar: pillars.at(-1) || null,
    best_performing_format: formats[0] || null,
    best_save_rate_content: saveWinner ? { id: saveWinner.id, save_rate: saveWinner.snapshot.saves / saveWinner.snapshot.reach } : null,
    best_profile_visit_content: null,
    best_follower_conversion_content: null,
    unavailable_metrics: ["profile_visits", "follows"],
    metric_note: "Geçmiş verilerde kullanılamayan profil ziyareti/takip metrikleri varsayılan sıfırdan ayırt edilemiyor — bu iki metriğe göre sıralama şu an kullanılamıyor.",
    weak_topics: [...topics].reverse().slice(0, 5),
    overused_topics: topics.filter((t) => t.sample_size >= 3),
    pillars, formats, topics
  };
}
