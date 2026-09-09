import test from "node:test";
import assert from "node:assert/strict";
import { computeContentScore } from "../../src/lib/social-autopilot/scoring-engine.ts";
import type { SocialMetricSnapshot } from "../../src/lib/social-autopilot/types.ts";

function snapshot(overrides: Partial<SocialMetricSnapshot> = {}): SocialMetricSnapshot {
  return {
    id: "s1", workspace_id: "hk-dijital", content_item_id: "c1", snapshot_scope: "content", snapshot_window: "24h",
    reach: 0, impressions: 0, likes: 0, comments: 0, saves: 0, shares: 0, profile_visits: 0, follows: 0, video_views: 0,
    watch_time_seconds: null, engagement_rate: null, follower_count: null, performance_score: null,
    captured_at: new Date().toISOString(), created_at: new Date().toISOString(),
    ...overrides
  };
}

test("computeContentScore: all-zero snapshot scores 0", () => {
  assert.equal(computeContentScore(snapshot()), 0);
});

test("computeContentScore: a snapshot maxing out its objective's key metrics scores near 100", () => {
  const score = computeContentScore(snapshot({ follows: 30, profile_visits: 150, shares: 40, reach: 5000 }), "follow");
  assert.ok(score >= 95, `expected near-100, got ${score}`);
});

test("computeContentScore: different objectives weight the same raw numbers differently", () => {
  const raw = snapshot({ saves: 80, shares: 40, comments: 40, follows: 0, profile_visits: 0 });
  const saveScore = computeContentScore(raw, "save");
  const followScore = computeContentScore(raw, "follow");
  assert.ok(saveScore > followScore, `save-objective score (${saveScore}) should outrank follow-objective score (${followScore}) for save-heavy metrics`);
});

test("computeContentScore: unknown/missing objective falls back to the default weight set without throwing", () => {
  assert.doesNotThrow(() => computeContentScore(snapshot({ reach: 1000, saves: 10 }), undefined));
  assert.doesNotThrow(() => computeContentScore(snapshot({ reach: 1000, saves: 10 }), "not-a-real-goal"));
});

test("computeContentScore: score is always clamped within 0-100", () => {
  const score = computeContentScore(snapshot({ reach: 999999, saves: 999999, shares: 999999 }), "save");
  assert.ok(score <= 100 && score >= 0);
});
