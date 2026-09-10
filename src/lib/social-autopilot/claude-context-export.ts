// Builds the compact, structured snapshot Claude (via MCP's
// context_export tool) reads before proposing a new strategy or content
// batch. Entirely deterministic — reuses the rankings learning-engine.ts
// already computed and persisted (the `evidence` column on the most recent
// social_ai_learnings row) rather than recomputing them, plus a handful of
// small direct queries for data that isn't already stored anywhere
// (recent-topic/hook repetition, account totals, the previous strategy).
// No AI call happens here; this only reads what deterministic engines
// already produced.
import { supabaseRest } from "@/lib/supabase";
import { computeStrategySupplyStatus } from "./strategy-supply";
import { SOCIAL_WORKSPACE_ID } from "./types";
import type { AiLearning, ClaudeContextExport, SocialContentItem, SocialStrategy } from "./types";

const SCHEMA_VERSION = "1.0";
const FATIGUE_LOOKBACK_ITEMS = 8;
const FATIGUE_MIN_REPEATS = 3;

type RankingEntry = { key: string; avgScore: number; sampleSize: number };

function rankingFromEvidence(evidence: Record<string, unknown> | undefined, key: string): RankingEntry[] {
  const value = evidence?.[key];
  return Array.isArray(value) ? (value as RankingEntry[]) : [];
}

async function loadLatestEvidence(): Promise<Record<string, unknown> | undefined> {
  const rows = await supabaseRest<AiLearning[]>(`social_ai_learnings?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&select=evidence&order=generated_at.desc&limit=1`);
  return rows[0]?.evidence;
}

async function computeContentFatigue(): Promise<ClaudeContextExport["content_fatigue"]> {
  const rows = await supabaseRest<Array<Pick<SocialContentItem, "topic" | "hook_archetype">>>(
    `social_content_items?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&publication_status=eq.published&select=topic,hook_archetype&order=published_at.desc&limit=${FATIGUE_LOOKBACK_ITEMS}`
  );
  const counts = new Map<string, { kind: "topic" | "hook_archetype"; recentUses: number }>();
  for (const row of rows) {
    if (row.topic) {
      const key = `topic:${row.topic}`;
      counts.set(key, { kind: "topic", recentUses: (counts.get(key)?.recentUses || 0) + 1 });
    }
    if (row.hook_archetype) {
      const key = `hook_archetype:${row.hook_archetype}`;
      counts.set(key, { kind: "hook_archetype", recentUses: (counts.get(key)?.recentUses || 0) + 1 });
    }
  }
  return [...counts.entries()]
    .filter(([, value]) => value.recentUses >= FATIGUE_MIN_REPEATS)
    .map(([key, value]) => ({ key: key.split(":").slice(1).join(":"), kind: value.kind, recentUses: value.recentUses }));
}

async function computeAccountSummary(): Promise<ClaudeContextExport["account_summary"]> {
  const publishedRows = await supabaseRest<Array<{ quality_score: number | null }>>(
    `social_content_items?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&publication_status=eq.published&select=quality_score`
  );
  const totalPublished = publishedRows.length;
  const qualityScores = publishedRows.map((row) => row.quality_score).filter((score): score is number => typeof score === "number");
  const avgQualityScore = qualityScores.length ? Math.round(qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length) : null;

  const since = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString();
  const accountSnapshots = await supabaseRest<Array<{ reach: number }>>(
    `social_metric_snapshots?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&snapshot_scope=eq.account&captured_at=gte.${encodeURIComponent(since)}&select=reach&order=captured_at.desc`
  );
  const reach30d = accountSnapshots.reduce((sum, row) => sum + (row.reach || 0), 0);

  const contentSnapshots = await supabaseRest<Array<{ performance_score: number | null }>>(
    `social_metric_snapshots?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&snapshot_scope=eq.content&captured_at=gte.${encodeURIComponent(since)}&select=performance_score`
  );
  const performanceScores = contentSnapshots.map((row) => row.performance_score).filter((score): score is number => typeof score === "number");
  const avgPerformanceScore = performanceScores.length ? Math.round(performanceScores.reduce((sum, score) => sum + score, 0) / performanceScores.length) : null;

  return { totalPublished, reach30d, avgQualityScore, avgPerformanceScore };
}

async function loadPreviousStrategySummary(): Promise<ClaudeContextExport["previous_strategy_summary"]> {
  const rows = await supabaseRest<Pick<SocialStrategy, "period_start" | "period_end" | "monthly_objective" | "creative_themes">[]>(
    `social_strategies?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&status=in.(completed,active)&select=period_start,period_end,monthly_objective,creative_themes&order=period_end.desc&limit=1`
  );
  const row = rows[0];
  if (!row) return null;
  return { period_start: row.period_start, period_end: row.period_end, monthly_objective: row.monthly_objective, creative_themes: row.creative_themes || [] };
}

export async function buildClaudeContextExport(): Promise<ClaudeContextExport> {
  const evidence = await loadLatestEvidence();
  const topicRanking = rankingFromEvidence(evidence, "topicRanking");
  const hookRanking = rankingFromEvidence(evidence, "hookRanking");
  const pillarRanking = rankingFromEvidence(evidence, "pillarRanking");
  const bestWeekdayHour = rankingFromEvidence(evidence, "bestWeekdayHour");

  const [contentFatigue, accountSummary, previousStrategySummary, strategySupply] = await Promise.all([
    computeContentFatigue(),
    computeAccountSummary(),
    loadPreviousStrategySummary(),
    computeStrategySupplyStatus()
  ]);

  const pillarTotal = pillarRanking.reduce((sum, entry) => sum + entry.sampleSize, 0) || 1;
  const currentPillarDistribution = Object.fromEntries(pillarRanking.map((entry) => [entry.key, Math.round((entry.sampleSize / pillarTotal) * 100) / 100]));

  return {
    schema_version: SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    account_summary: accountSummary,
    strong_topics: topicRanking.slice(0, 5),
    weak_topics: [...topicRanking].reverse().slice(0, 5),
    strong_hooks: hookRanking.slice(0, 5),
    weak_hooks: [...hookRanking].reverse().slice(0, 5),
    strongest_publishing_windows: bestWeekdayHour.slice(0, 5).map((entry) => ({ label: entry.key, avgScore: entry.avgScore, sampleSize: entry.sampleSize })),
    content_fatigue: contentFatigue,
    current_pillar_distribution: currentPillarDistribution,
    previous_strategy_summary: previousStrategySummary,
    strategy_supply: strategySupply
  };
}
