// Structured learning layer. Deterministic statistics — computed locally
// via supabaseRest, weighted by real sample-size confidence — are the
// PRIMARY and always-available path: no LLM is required to calculate
// conclusions that can be derived mathematically. An AI pass is a purely
// optional enhancement layer on top: when allowRuntimeAi is true
// (optional_api_ai mode) it gets the same compact stats summary and may
// rewrite the learnings with richer prose; if it's unavailable, disabled,
// or fails, the deterministic template-based learnings below are what gets
// persisted — never nothing. This module also materializes
// social_publishing_time_recommendations (fully deterministic, see
// posting-time-engine.ts, which reads from it).
import { supabaseRest } from "@/lib/supabase";
import { generateSocialContent, parseStructuredJson } from "./ai-client";
import { buildLearningSynthesisPrompt } from "./prompts";
import { SAMPLE_SIZE_CONFIDENCE } from "./constants";
import { SOCIAL_WORKSPACE_ID } from "./types";
import type { AiLearning, Confidence, SocialContentItem, LearningType, MetricSnapshot, SocialAiProviderPreference } from "./types";

const LOCAL_OFFSET_MS = 3 * 60 * 60 * 1000; // see posting-time-engine.ts's timezone note
const LOOKBACK_DAYS = 60;
const WEEKDAY_LABELS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

type ItemWithSnapshots = SocialContentItem & { metric_snapshots: MetricSnapshot[] };

function bestSnapshot(snapshots: MetricSnapshot[]) {
  const preferenceOrder: MetricSnapshot["snapshot_window"][] = ["7d", "72h", "24h", "30d", "1h"];
  for (const window of preferenceOrder) {
    const match = snapshots.filter((snapshot) => snapshot.snapshot_window === window).sort((a, b) => (b.performance_score || 0) - (a.performance_score || 0))[0];
    if (match) return match;
  }
  return null;
}

function confidenceForSample(size: number): Confidence {
  if (size >= SAMPLE_SIZE_CONFIDENCE.high) return "high";
  if (size >= SAMPLE_SIZE_CONFIDENCE.medium) return "medium";
  return "low";
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

async function fetchScoredItems(): Promise<Array<{ item: SocialContentItem; score: number }>> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60_000).toISOString();
  const rows = await supabaseRest<ItemWithSnapshots[]>(`social_content_items?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&publication_status=eq.published&published_at=gte.${encodeURIComponent(since)}&select=*,metric_snapshots:social_metric_snapshots(*)`);
  const scored: Array<{ item: SocialContentItem; score: number }> = [];
  for (const row of rows) {
    const score = bestSnapshot(row.metric_snapshots || [])?.performance_score;
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
  return [...groups.entries()].map(([key, scores]) => ({ key, avgScore: Math.round(average(scores)), sampleSize: scores.length })).sort((a, b) => b.avgScore - a.avgScore);
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
    const localTime = new Date(new Date(item.published_at).getTime() + LOCAL_OFFSET_MS);
    const weekday = localTime.getUTCDay();
    const hour = localTime.getUTCHours();
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

type RankingEntry = { key: string; avgScore: number; sampleSize: number };
type SynthesizedLearning = { title: string; summary: string; action_recommendation: string; learning_type: LearningType; confidence: Confidence };

// Purely deterministic — same inputs always produce the same learnings, no
// external call, no randomness. This is what runs in EVERY mode; an AI pass
// (see below) can only ever override its output, never be required for it.
function synthesizeDeterministicLearnings(params: {
  pillarRanking: RankingEntry[];
  hookRanking: RankingEntry[];
  typeRanking: RankingEntry[];
  topicRanking: RankingEntry[];
  funnelRanking: RankingEntry[];
  bestWeekdayHour: RankingEntry[];
  scoredEntries: Array<{ item: SocialContentItem; score: number }>;
}): SynthesizedLearning[] {
  const out: SynthesizedLearning[] = [];

  function addTopAndBottom(ranking: RankingEntry[], label: string, winPhrase: (key: string) => string, weakPhrase: (key: string) => string) {
    if (!ranking.length) return;
    const top = ranking[0];
    out.push({
      title: `En güçlü ${label}: ${top.key}`,
      summary: `${top.key}, ortalama ${top.avgScore}/100 performans skoruna sahip (örneklem: ${top.sampleSize}).`,
      action_recommendation: winPhrase(top.key),
      learning_type: "winner",
      confidence: confidenceForSample(top.sampleSize)
    });
    const bottom = ranking[ranking.length - 1];
    if (ranking.length > 1 && bottom.key !== top.key && top.avgScore - bottom.avgScore >= 10) {
      out.push({
        title: `Zayıf ${label}: ${bottom.key}`,
        summary: `${bottom.key}, ortalama ${bottom.avgScore}/100 performans skoruna sahip (örneklem: ${bottom.sampleSize}) — en güçlü ${label} olan ${top.key}'nin gerisinde.`,
        action_recommendation: weakPhrase(bottom.key),
        learning_type: "weakness",
        confidence: confidenceForSample(bottom.sampleSize)
      });
    }
  }

  addTopAndBottom(params.pillarRanking, "içerik sütunu",
    (key) => `"${key}" sütununa ayrılan içerik oranını artırmayı değerlendirin.`,
    (key) => `"${key}" sütununun açısını/yaklaşımını gözden geçirin veya oranını azaltın.`);
  addTopAndBottom(params.hookRanking, "hook arketipi",
    (key) => `"${key}" hook arketipini daha sık kullanın.`,
    (key) => `"${key}" hook arketipini çeşitlendirin veya kullanım sıklığını azaltın.`);
  addTopAndBottom(params.typeRanking, "format",
    (key) => `"${key}" formatına ayrılan payı artırmayı değerlendirin.`,
    (key) => `"${key}" formatının uygulanışını gözden geçirin.`);
  addTopAndBottom(params.topicRanking, "konu",
    (key) => `"${key}" konusuna benzer içerikler planlayın.`,
    (key) => `"${key}" konusunu farklı bir açıyla yeniden ele alın.`);
  addTopAndBottom(params.funnelRanking, "huni aşaması",
    (key) => `"${key}" aşamasındaki içerik oranını artırın.`,
    (key) => `"${key}" aşamasındaki içerik yaklaşımını gözden geçirin.`);

  if (params.bestWeekdayHour.length) {
    const top = params.bestWeekdayHour[0];
    out.push({
      title: `En iyi yayın zaman dilimi: ${top.key}`,
      summary: `${top.key} zaman diliminde yayınlanan içerikler ortalama ${top.avgScore}/100 skor aldı (örneklem: ${top.sampleSize}).`,
      action_recommendation: `Yeni içerikleri ${top.key} zaman dilimine yakın planlamayı önceliklendirin.`,
      learning_type: "winner",
      confidence: confidenceForSample(top.sampleSize)
    });
  }

  // Content fatigue: the same topic dominating the most recently published
  // items is a real, mechanically-detectable signal — no AI judgement call
  // needed to notice repetition.
  const recentByDate = [...params.scoredEntries].sort((a, b) => (b.item.published_at || "").localeCompare(a.item.published_at || "")).slice(0, 8);
  const topicCounts = new Map<string, number>();
  for (const entry of recentByDate) if (entry.item.topic) topicCounts.set(entry.item.topic, (topicCounts.get(entry.item.topic) || 0) + 1);
  for (const [topic, count] of topicCounts) {
    if (count >= 3) {
      out.push({
        title: `Olası içerik yorgunluğu: ${topic}`,
        summary: `"${topic}" konusu son ${recentByDate.length} yayından ${count} tanesinde kullanılmış.`,
        action_recommendation: `"${topic}" konusuna kısa süreliğine ara verip farklı konulara geçin.`,
        learning_type: "fatigue_signal",
        confidence: "medium"
      });
    }
  }

  return out;
}

export async function generateLearnings(strategyId: string | null, allowRuntimeAi: boolean, aiPreference?: SocialAiProviderPreference): Promise<{ learnings: AiLearning[]; cellsUpdated: number }> {
  const scoredEntries = await fetchScoredItems();
  const cellsUpdated = await materializePostingTimeRecommendations(scoredEntries);

  if (scoredEntries.length < 3) return { learnings: [], cellsUpdated }; // not enough real data yet to synthesize learnings responsibly

  const pillarRanking = groupAverage(scoredEntries, (item) => item.content_pillar);
  const hookRanking = groupAverage(scoredEntries, (item) => item.hook_archetype);
  const typeRanking = groupAverage(scoredEntries, (item) => item.content_type);
  const topicRanking = groupAverage(scoredEntries, (item) => item.topic);
  const funnelRanking = groupAverage(scoredEntries, (item) => item.funnel_stage);
  const bestWeekdayHour = groupAverage(
    scoredEntries.filter((entry) => entry.item.published_at),
    (item) => {
      const localTime = new Date(new Date(item.published_at!).getTime() + LOCAL_OFFSET_MS);
      return `${WEEKDAY_LABELS[localTime.getUTCDay()]} ${localTime.getUTCHours()}:00`;
    }
  );

  const evidence = { pillarRanking, hookRanking, typeRanking, topicRanking, funnelRanking, bestWeekdayHour: bestWeekdayHour.slice(0, 5) };

  // The deterministic pass is the baseline result — always computed, always
  // available, never dependent on a network call.
  let finalLearnings = synthesizeDeterministicLearnings({ pillarRanking, hookRanking, typeRanking, topicRanking, funnelRanking, bestWeekdayHour, scoredEntries });

  if (allowRuntimeAi) {
    const statsSummary = [
      `Toplam değerlendirilen gönderi: ${scoredEntries.length} (son ${LOOKBACK_DAYS} gün)`,
      `İçerik sütunu sıralaması (ort. skor / örnek sayısı): ${pillarRanking.map((entry) => `${entry.key}: ${entry.avgScore}/100 (n=${entry.sampleSize})`).join(", ")}`,
      `Hook arketipi sıralaması: ${hookRanking.map((entry) => `${entry.key}: ${entry.avgScore}/100 (n=${entry.sampleSize})`).join(", ")}`,
      `Format sıralaması: ${typeRanking.map((entry) => `${entry.key}: ${entry.avgScore}/100 (n=${entry.sampleSize})`).join(", ")}`,
      `Konu sıralaması: ${topicRanking.map((entry) => `${entry.key}: ${entry.avgScore}/100 (n=${entry.sampleSize})`).join(", ")}`,
      `Huni aşaması sıralaması: ${funnelRanking.map((entry) => `${entry.key}: ${entry.avgScore}/100 (n=${entry.sampleSize})`).join(", ")}`,
      `En iyi gün/saat dilimleri: ${bestWeekdayHour.slice(0, 5).map((entry) => `${entry.key}: ${entry.avgScore}/100 (n=${entry.sampleSize})`).join(", ")}`
    ].join("\n");

    const { system, prompt } = buildLearningSynthesisPrompt(statsSummary);
    type SynthesisOutput = { learnings: Array<{ title: string; summary: string; action_recommendation: string }> };
    const isSynthesisOutput = (value: unknown): value is SynthesisOutput => typeof value === "object" && value !== null && Array.isArray((value as SynthesisOutput).learnings);

    try {
      const result = await generateSocialContent({ action: "social_autopilot_learning_synthesis", systemPrompt: system, prompt, preference: aiPreference, allowRuntimeAi: true, expectedOutputSize: "medium" });
      const synthesized = parseStructuredJson(result.text, isSynthesisOutput).learnings;
      if (synthesized.length) {
        const topSample = pillarRanking[0]?.sampleSize || 0;
        finalLearnings = synthesized.map((entry) => ({ ...entry, learning_type: "winner" as LearningType, confidence: confidenceForSample(topSample) }));
      }
    } catch {
      // AI enhancement failed — the deterministic learnings computed above are kept as-is.
    }
  }

  const persisted: AiLearning[] = [];
  for (const entry of finalLearnings.slice(0, 6)) {
    const rows = await supabaseRest<AiLearning[]>("social_ai_learnings", {
      method: "POST",
      body: JSON.stringify({
        workspace_id: SOCIAL_WORKSPACE_ID, strategy_id: strategyId, learning_type: entry.learning_type, title: entry.title, summary: entry.summary, action_recommendation: entry.action_recommendation,
        evidence, evidence_window: `${LOOKBACK_DAYS} gün`, sample_size: scoredEntries.length, confidence: entry.confidence
      })
    });
    persisted.push(rows[0]);
  }

  return { learnings: persisted, cellsUpdated };
}

export async function summarizeRecentLearnings(limit = 5): Promise<string | null> {
  const rows = await supabaseRest<AiLearning[]>(`social_ai_learnings?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&select=*&order=generated_at.desc&limit=${limit}`);
  if (!rows.length) return null;
  return rows.map((row) => `- ${row.title} (güven: ${row.confidence}, n=${row.sample_size}): ${row.action_recommendation}`).join("\n");
}
