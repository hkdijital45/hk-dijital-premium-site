// Structured learning layer (spec sections 28, 24 posting-time materialization).
// Never sends the AI raw analytics rows — aggregates are computed locally in
// JS/SQL-via-REST first, and the AI only gets a compact stats summary to
// turn into a short, evidence-grounded reasoning sentence (see
// buildLearningSynthesisPrompt in prompts.ts). This is also what
// materializes social_publishing_time_recommendations, the table
// posting-time-engine.ts reads from.
import { supabaseRest } from "@/lib/supabase";
import { generateSocialContent, parseStructuredJson } from "./ai-client";
import { buildLearningSynthesisPrompt } from "./prompts";
import { SAMPLE_SIZE_CONFIDENCE, SOCIAL_WORKSPACE_ID } from "./constants";
import type { SocialAiLearning, SocialConfidence, SocialContentItem, SocialMetricSnapshot } from "./types";

const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000;
const LOOKBACK_DAYS = 60;
const WEEKDAY_LABELS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

type ItemWithSnapshots = SocialContentItem & { social_metric_snapshots: SocialMetricSnapshot[] };

function bestSnapshot(snapshots: SocialMetricSnapshot[]) {
  const preferenceOrder: SocialMetricSnapshot["snapshot_window"][] = ["7d", "72h", "24h", "30d", "1h"];
  for (const window of preferenceOrder) {
    const match = snapshots.filter((snapshot) => snapshot.snapshot_window === window).sort((a, b) => (b.performance_score || 0) - (a.performance_score || 0))[0];
    if (match) return match;
  }
  return null;
}

function confidenceForSample(size: number): SocialConfidence {
  if (size >= SAMPLE_SIZE_CONFIDENCE.high) return "high";
  if (size >= SAMPLE_SIZE_CONFIDENCE.medium) return "medium";
  return "low";
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

async function fetchScoredItems(): Promise<Array<{ item: SocialContentItem; score: number }>> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60_000).toISOString();
  const rows = await supabaseRest<ItemWithSnapshots[]>(
    `social_content_items?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&publication_status=eq.published&published_at=gte.${encodeURIComponent(since)}&select=*,social_metric_snapshots(*)`
  );
  const scored: Array<{ item: SocialContentItem; score: number }> = [];
  for (const row of rows) {
    const score = bestSnapshot(row.social_metric_snapshots || [])?.performance_score;
    if (typeof score === "number") scored.push({ item: row, score });
  }
  return scored;
}

function groupAverage(entries: Array<{ item: SocialContentItem; score: number }>, keyFn: (item: SocialContentItem) => string) {
  const groups = new Map<string, number[]>();
  for (const entry of entries) {
    const key = keyFn(entry.item);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(entry.score);
  }
  return [...groups.entries()]
    .map(([key, scores]) => ({ key, avgScore: Math.round(average(scores)), sampleSize: scores.length }))
    .sort((a, b) => b.avgScore - a.avgScore);
}

async function materializePostingTimeRecommendations(entries: Array<{ item: SocialContentItem; score: number }>) {
  type Cell = { weekday: number; hour: number; contentType: string; contentPillar: string; scores: number[] };
  const cells = new Map<string, Cell>();

  const addToCell = (weekday: number, hour: number, contentType: string, contentPillar: string, score: number) => {
    const key = `${weekday}-${hour}-${contentType}-${contentPillar}`;
    if (!cells.has(key)) cells.set(key, { weekday, hour, contentType, contentPillar, scores: [] });
    cells.get(key)!.scores.push(score);
  };

  for (const { item, score } of entries) {
    if (!item.published_at) continue;
    const istanbul = new Date(new Date(item.published_at).getTime() + ISTANBUL_OFFSET_MS);
    const weekday = istanbul.getUTCDay();
    const hour = istanbul.getUTCHours();
    addToCell(weekday, hour, item.content_type, item.content_pillar || "any", score);
    addToCell(weekday, hour, item.content_type, "any", score);
    addToCell(weekday, hour, "any", "any", score);
  }

  for (const cell of cells.values()) {
    const avgScore = average(cell.scores);
    const sampleSize = cell.scores.length;
    const confidence = confidenceForSample(sampleSize);
    const existing = await supabaseRest<Array<{ id: string }>>(
      `social_publishing_time_recommendations?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&weekday=eq.${cell.weekday}&hour=eq.${cell.hour}&content_type=eq.${encodeURIComponent(cell.contentType)}&content_pillar=eq.${encodeURIComponent(cell.contentPillar)}&select=id&limit=1`
    );
    const body = JSON.stringify({ avg_score: avgScore, sample_size: sampleSize, confidence, updated_at: new Date().toISOString() });
    if (existing.length) {
      await supabaseRest(`social_publishing_time_recommendations?id=eq.${encodeURIComponent(existing[0].id)}`, { method: "PATCH", body });
    } else {
      await supabaseRest("social_publishing_time_recommendations", {
        method: "POST",
        body: JSON.stringify({ workspace_id: SOCIAL_WORKSPACE_ID, weekday: cell.weekday, hour: cell.hour, content_type: cell.contentType, content_pillar: cell.contentPillar, avg_score: avgScore, sample_size: sampleSize, confidence })
      });
    }
  }

  return cells.size;
}

export async function generateLearnings(strategyId: string | null): Promise<{ learnings: SocialAiLearning[]; usedDemo: boolean; cellsUpdated: number }> {
  const scoredEntries = await fetchScoredItems();
  const cellsUpdated = await materializePostingTimeRecommendations(scoredEntries);

  if (scoredEntries.length < 3) {
    return { learnings: [], usedDemo: false, cellsUpdated }; // not enough real data yet to synthesize learnings responsibly
  }

  const pillarRanking = groupAverage(scoredEntries, (item) => item.content_pillar);
  const hookRanking = groupAverage(scoredEntries, (item) => item.hook_archetype);
  const typeRanking = groupAverage(scoredEntries, (item) => item.content_type);
  const bestWeekdayHour = groupAverage(
    scoredEntries.filter((entry) => entry.item.published_at),
    (item) => {
      const istanbul = new Date(new Date(item.published_at!).getTime() + ISTANBUL_OFFSET_MS);
      return `${WEEKDAY_LABELS[istanbul.getUTCDay()]} ${istanbul.getUTCHours()}:00`;
    }
  );

  const statsSummary = [
    `Toplam değerlendirilen gönderi: ${scoredEntries.length} (son ${LOOKBACK_DAYS} gün)`,
    `İçerik sütunu sıralaması (ort. skor / örnek sayısı): ${pillarRanking.map((entry) => `${entry.key}: ${entry.avgScore}/100 (n=${entry.sampleSize})`).join(", ")}`,
    `Hook arketipi sıralaması: ${hookRanking.map((entry) => `${entry.key}: ${entry.avgScore}/100 (n=${entry.sampleSize})`).join(", ")}`,
    `Format sıralaması: ${typeRanking.map((entry) => `${entry.key}: ${entry.avgScore}/100 (n=${entry.sampleSize})`).join(", ")}`,
    `En iyi gün/saat dilimleri: ${bestWeekdayHour.slice(0, 5).map((entry) => `${entry.key}: ${entry.avgScore}/100 (n=${entry.sampleSize})`).join(", ")}`
  ].join("\n");

  const { system, prompt } = buildLearningSynthesisPrompt(statsSummary);
  const result = await generateSocialContent({ action: "deep-analysis", systemPrompt: system, prompt, complexity: "high", expectedOutputSize: "medium", taskType: "workflow_task" });

  type SynthesisOutput = { learnings: Array<{ title: string; summary: string; action_recommendation: string }> };
  const isSynthesisOutput = (value: unknown): value is SynthesisOutput =>
    typeof value === "object" && value !== null && Array.isArray((value as SynthesisOutput).learnings);

  let synthesized: SynthesisOutput["learnings"] = [];
  try {
    synthesized = parseStructuredJson(result.text, isSynthesisOutput).learnings;
  } catch {
    synthesized = [];
  }

  const persisted: SocialAiLearning[] = [];
  for (const entry of synthesized.slice(0, 5)) {
    const topPillar = pillarRanking[0];
    const rows = await supabaseRest<SocialAiLearning[]>("social_ai_learnings", {
      method: "POST",
      body: JSON.stringify({
        workspace_id: SOCIAL_WORKSPACE_ID, strategy_id: strategyId, learning_type: "winner",
        title: entry.title, summary: entry.summary, action_recommendation: entry.action_recommendation,
        evidence: { pillarRanking, hookRanking, typeRanking, bestWeekdayHour: bestWeekdayHour.slice(0, 5) },
        evidence_window: `${LOOKBACK_DAYS} gün`, sample_size: scoredEntries.length,
        confidence: confidenceForSample(topPillar?.sampleSize || 0)
      })
    });
    persisted.push(rows[0]);
  }

  return { learnings: persisted, usedDemo: result.provider === "demo", cellsUpdated };
}

export async function summarizeRecentLearnings(limit = 5): Promise<string | null> {
  const rows = await supabaseRest<SocialAiLearning[]>(
    `social_ai_learnings?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&select=*&order=generated_at.desc&limit=${limit}`
  );
  if (!rows.length) return null;
  return rows.map((row) => `- ${row.title} (güven: ${row.confidence}, n=${row.sample_size}): ${row.action_recommendation}`).join("\n");
}
