import test from "node:test";
import assert from "node:assert/strict";
import { computeContentScore } from "../../src/lib/social-autopilot/scoring-engine.ts";
import type { MetricSnapshot } from "../../src/lib/social-autopilot/types.ts";

function snapshot(overrides: Partial<MetricSnapshot> = {}): MetricSnapshot {
  return {
    id: "s1", workspace_id: "hk-dijital", content_item_id: "c1", snapshot_scope: "content", snapshot_window: "7d",
    reach: 0, impressions: 0, likes: 0, comments: 0, saves: 0, shares: 0, profile_visits: 0, follows: 0, video_views: 0,
    watch_time_seconds: null, engagement_rate: null, follower_count: null, performance_score: null,
    captured_at: new Date().toISOString(), created_at: new Date().toISOString(),
    ...overrides
  };
}

test("computeContentScore: a save-goal post is scored primarily on saves, not likes", () => {
  const highSaves = snapshot({ saves: 60, likes: 5, reach: 1000 });
  const highLikesOnly = snapshot({ saves: 2, likes: 250, reach: 1000 });
  assert.ok(computeContentScore(highSaves, "save") > computeContentScore(highLikesOnly, "save"));
});

test("computeContentScore: a follow-goal post rewards follows/profile_visits over raw reach", () => {
  const strongFollowerConversion = snapshot({ follows: 20, profile_visits: 100, reach: 1000 });
  const reachOnly = snapshot({ follows: 0, profile_visits: 0, reach: 4000 });
  assert.ok(computeContentScore(strongFollowerConversion, "follow") > computeContentScore(reachOnly, "follow"));
});

test("computeContentScore: unknown/missing cta_goal falls back to the default balanced weighting rather than throwing", () => {
  assert.doesNotThrow(() => computeContentScore(snapshot({ reach: 500, saves: 10 }), undefined));
  assert.doesNotThrow(() => computeContentScore(snapshot({ reach: 500, saves: 10 }), "not_a_real_goal"));
});

test("computeContentScore: an all-zero snapshot scores 0, never NaN or negative", () => {
  const score = computeContentScore(snapshot(), "save");
  assert.equal(score, 0);
});

test("computeContentScore: score is always clamped to the 0-100 range", () => {
  const maxedOut = snapshot({ saves: 100000, shares: 100000, comments: 100000, reach: 1000000 });
  const score = computeContentScore(maxedOut, "save");
  assert.ok(score >= 0 && score <= 100);
});

test("computeContentScore: null metric values are excluded rather than treated as zero-weighted crashes", () => {
  assert.doesNotThrow(() => computeContentScore(snapshot({ engagement_rate: null }), "comment"));
});
