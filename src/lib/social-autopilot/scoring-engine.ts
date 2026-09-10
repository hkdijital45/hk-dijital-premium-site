// Content performance scoring. Weighted by the content's own CTA goal/
// objective rather than a single "likes-first" ranking — a follower-growth
// Reel and an authority carousel are judged on different metrics because
// they're trying to do different jobs (spec section 24).
import type { CtaGoal } from "./constants";
import type { MetricSnapshot } from "./types";

type MetricWeights = Partial<Record<
  "reach" | "impressions" | "likes" | "comments" | "saves" | "shares" | "profile_visits" | "follows" | "engagement_rate",
  number
>>;

const OBJECTIVE_WEIGHTS: Record<CtaGoal, MetricWeights> = {
  follow: { follows: 3, profile_visits: 2, shares: 1.5, reach: 1 },
  profile_visit: { profile_visits: 3, follows: 1.5, reach: 1 },
  save: { saves: 3, shares: 1, comments: 0.5 },
  share: { shares: 3, saves: 1, reach: 1 },
  comment: { comments: 3, engagement_rate: 1 },
  dm: { profile_visits: 2, comments: 1, saves: 1 },
  consultation: { profile_visits: 2.5, comments: 1, saves: 1 },
  website_visit: { profile_visits: 2, reach: 1, shares: 1 }
};

const DEFAULT_WEIGHTS: MetricWeights = { reach: 1, saves: 1.5, shares: 1.5, comments: 1, profile_visits: 1.5, follows: 2 };

// Rough normalization ceilings so raw counts don't dominate purely by
// account size — a content item hitting these is treated as "maxed out" on
// that metric. Deliberately generous/adjustable; this is a relative ranking
// tool, not an absolute scientific score.
const NORMALIZATION_CEILINGS: Record<string, number> = {
  reach: 5000, impressions: 8000, likes: 300, comments: 40, saves: 80, shares: 40, profile_visits: 150, follows: 30, engagement_rate: 10
};

export function computeContentScore(snapshot: MetricSnapshot, ctaGoal?: string | null): number {
  const weights = (ctaGoal && OBJECTIVE_WEIGHTS[ctaGoal as CtaGoal]) || DEFAULT_WEIGHTS;
  const metrics: Record<string, number | null | undefined> = {
    reach: snapshot.reach, impressions: snapshot.impressions, likes: snapshot.likes, comments: snapshot.comments,
    saves: snapshot.saves, shares: snapshot.shares, profile_visits: snapshot.profile_visits, follows: snapshot.follows,
    engagement_rate: snapshot.engagement_rate
  };

  let weightedSum = 0;
  let weightTotal = 0;
  for (const [key, weight] of Object.entries(weights)) {
    const raw = metrics[key];
    if (raw === null || raw === undefined || !weight) continue;
    const ceiling = NORMALIZATION_CEILINGS[key] || 100;
    const normalized = Math.min(100, (raw / ceiling) * 100);
    weightedSum += normalized * weight;
    weightTotal += weight;
  }
  if (!weightTotal) return 0;
  return Math.round(weightedSum / weightTotal);
}
