// Instagram Intelligence — read-only analysis of HK Dijital's own real
// Instagram history. Reuses the existing, already-connected Social
// Autopilot Instagram OAuth/token layer (src/lib/social-autopilot/
// instagram-oauth.ts, instagram-graph-client.ts) rather than duplicating
// it. Never publishes, edits, or deletes anything on Instagram — only
// GET calls against the Graph API.
//
// Deliberately does NOT reuse control/services.ts's analysis() helper:
// that function reads social_content_items (rows created BY the AI
// generation pipeline) filtered to publication_status=published, which
// is empty by design here — HK Dijital posts manually, so nothing goes
// through that pipeline. This module analyzes the REAL account media
// list from the Graph API directly instead.
import {
  getRecentInstagramMedia, getMediaInsights, getAccountInsights,
  type InstagramApiError
} from "@/lib/social-autopilot/instagram-graph-client";
import { getUsableInstagramToken, recordInstagramSuccess, recordInstagramError, InstagramNotConnectedError } from "@/lib/social-autopilot/instagram-oauth";
import { titleSimilarity } from "@/lib/content-plan/similarity";
import { CATEGORY_KEYWORDS, classifyCaption } from "./categorize";

export { InstagramNotConnectedError, classifyCaption };

export type RawInstagramPost = {
  id: string;
  caption?: string;
  media_type: string;
  media_product_type?: string;
  permalink?: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
};

export type PostMetrics = {
  reach: number | null;
  saved: number | null;
  shares: number | null;
  plays: number | null;
  metricsAvailable: boolean;
};

export type AnalyzedPost = {
  id: string;
  caption: string;
  category: string | null;
  format: string;
  permalink: string | null;
  timestamp: string;
  likeCount: number | null;
  commentsCount: number | null;
  metrics: PostMetrics;
  engagementScore: number | null;
};

function metricsForType(mediaProductType: string | undefined): string[] {
  if (mediaProductType === "REELS") return ["reach", "saved", "shares", "plays"];
  if (mediaProductType === "STORY") return ["reach"];
  return ["reach", "saved", "shares"]; // FEED image/carousel
}

async function fetchPostMetrics(accessToken: string, post: RawInstagramPost): Promise<PostMetrics> {
  const empty: PostMetrics = { reach: null, saved: null, shares: null, plays: null, metricsAvailable: false };
  const metrics = metricsForType(post.media_product_type);
  try {
    const result = await getMediaInsights(accessToken, post.id, metrics);
    const byName = new Map(result.data.map((m) => [m.name, m.values?.[0]?.value ?? null]));
    return {
      reach: byName.get("reach") ?? null,
      saved: byName.get("saved") ?? null,
      shares: byName.get("shares") ?? null,
      plays: byName.get("plays") ?? null,
      metricsAvailable: result.data.length > 0
    };
  } catch {
    // A media-type/permission mismatch on the full metric list fails the
    // whole call — try just "reach" (broadly supported) before giving up
    // and honestly reporting this post's metrics as unavailable.
    try {
      const fallback = await getMediaInsights(accessToken, post.id, ["reach"]);
      const reach = fallback.data.find((m) => m.name === "reach")?.values?.[0]?.value ?? null;
      return { ...empty, reach, metricsAvailable: reach !== null };
    } catch {
      return empty;
    }
  }
}

export type InstagramAnalysis = {
  connected: true;
  postsFetched: number;
  last30Days: number;
  last90Days: number;
  formatDistribution: Record<string, number>;
  categoryDistribution: Array<{ category: string; count: number; lastUsedDaysAgo: number }>;
  unclassifiedCount: number;
  missingCategories: string[];
  repetitionRisks: Array<{ captionA: string; captionB: string; score: number; daysApart: number }>;
  topPerformers: AnalyzedPost[];
  weakPerformers: AnalyzedPost[];
  postsWithMetrics: number;
  postingFrequencyPerWeek: number;
  accountInsightsAvailable: boolean;
  analyzedAt: string;
};

/** Real, deterministic analysis of the connected account's actual recent
 * media. No AI, no fabricated metrics — anything the Graph API doesn't
 * return stays null/"unavailable" rather than being filled with 0.
 *
 * HK Dijital's own agency Instagram Login connection only — the Graph
 * calls here (graph.instagram.com, via instagram-graph-client.ts) require
 * an Instagram-Login-obtained token, which is NOT interchangeable with a
 * customer's Facebook-Login-for-Business token (customer_integrations,
 * resolveConnectedInstagramAsset in instagram-profile-audits.ts). See the
 * get_instagram_analysis MCP handler in mcp/protocol.ts for the separate,
 * lighter customer-scoped path used for every other company. */
export async function analyzeInstagramAccount(): Promise<InstagramAnalysis> {
  const { accessToken, igUserId } = await getUsableInstagramToken();

  let media: { data: RawInstagramPost[] };
  try {
    media = await getRecentInstagramMedia(accessToken, igUserId, 100);
  } catch (error) {
    await recordInstagramError((error as InstagramApiError).message || "Instagram medya listesi alınamadı.");
    throw error;
  }

  const posts = media.data || [];
  const now = Date.now();
  const daysAgo = (iso: string) => Math.floor((now - new Date(iso).getTime()) / 86_400_000);
  const last30 = posts.filter((p) => daysAgo(p.timestamp) <= 30);
  const last90 = posts.filter((p) => daysAgo(p.timestamp) <= 90);

  // Bound insight calls to the most recent 40 posts — enough for a real
  // read on current performance without hammering the API on every click.
  const sample = posts.slice(0, 40);
  const analyzed: AnalyzedPost[] = [];
  for (const post of sample) {
    const metrics = await fetchPostMetrics(accessToken, post);
    const engagementScore = metrics.metricsAvailable && metrics.reach
      ? ((post.like_count || 0) + (post.comments_count || 0) + (metrics.saved || 0) + (metrics.shares || 0)) / metrics.reach
      : null;
    analyzed.push({
      id: post.id,
      caption: post.caption || "",
      category: classifyCaption(post.caption || ""),
      format: post.media_product_type || post.media_type,
      permalink: post.permalink || null,
      timestamp: post.timestamp,
      likeCount: post.like_count ?? null,
      commentsCount: post.comments_count ?? null,
      metrics,
      engagementScore
    });
  }

  const formatDistribution: Record<string, number> = {};
  for (const post of posts) {
    const key = post.media_product_type || post.media_type || "unknown";
    formatDistribution[key] = (formatDistribution[key] || 0) + 1;
  }

  const categoryLastUsed = new Map<string, string>();
  const categoryCounts = new Map<string, number>();
  let unclassifiedCount = 0;
  for (const post of posts) {
    const category = classifyCaption(post.caption || "");
    if (!category) { unclassifiedCount++; continue; }
    categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
    const existing = categoryLastUsed.get(category);
    if (!existing || post.timestamp > existing) categoryLastUsed.set(category, post.timestamp);
  }
  const categoryDistribution = Array.from(categoryCounts.entries())
    .map(([category, count]) => ({ category, count, lastUsedDaysAgo: daysAgo(categoryLastUsed.get(category)!) }))
    .sort((a, b) => b.count - a.count);
  const missingCategories = Object.keys(CATEGORY_KEYWORDS).filter((c) => !categoryCounts.has(c));

  // Repetition risk: same zero-AI word-overlap similarity used by İçerik
  // Takip's own "benzer konu" warning, applied to recent real captions.
  const repetitionRisks: InstagramAnalysis["repetitionRisks"] = [];
  for (let i = 0; i < sample.length; i++) {
    for (let j = i + 1; j < sample.length; j++) {
      const a = sample[i], b = sample[j];
      if (!a.caption || !b.caption || a.caption.length < 20 || b.caption.length < 20) continue;
      const score = titleSimilarity(a.caption, b.caption);
      if (score >= 0.6) {
        repetitionRisks.push({ captionA: a.caption.slice(0, 80), captionB: b.caption.slice(0, 80), score, daysApart: Math.abs(daysAgo(a.timestamp) - daysAgo(b.timestamp)) });
      }
    }
  }

  const withMetrics = analyzed.filter((p) => p.engagementScore !== null);
  const sorted = [...withMetrics].sort((a, b) => (b.engagementScore || 0) - (a.engagementScore || 0));
  const topPerformers = withMetrics.length >= 3 ? sorted.slice(0, 5) : [];
  const weakPerformers = withMetrics.length >= 3 ? sorted.slice(-5).reverse() : [];

  let accountInsightsAvailable = false;
  try {
    await getAccountInsights(accessToken, igUserId, ["reach"], "day");
    accountInsightsAvailable = true;
  } catch {
    accountInsightsAvailable = false;
  }

  const oldestSample = sample.at(-1);
  const spanDays = oldestSample ? Math.max(1, daysAgo(oldestSample.timestamp)) : 1;
  const postingFrequencyPerWeek = sample.length ? Number(((sample.length / spanDays) * 7).toFixed(1)) : 0;

  await recordInstagramSuccess({ last_insights_sync_at: new Date().toISOString() });

  return {
    connected: true,
    postsFetched: posts.length,
    last30Days: last30.length,
    last90Days: last90.length,
    formatDistribution,
    categoryDistribution,
    unclassifiedCount,
    missingCategories,
    repetitionRisks: repetitionRisks.slice(0, 10),
    topPerformers,
    weakPerformers,
    postsWithMetrics: withMetrics.length,
    postingFrequencyPerWeek,
    accountInsightsAvailable,
    analyzedAt: new Date().toISOString()
  };
}

/** Deterministic, rule-based recommendations derived straight from the
 * computed analysis above — no AI, no invented numbers. Returns 3-6 short
 * Turkish suggestions, fewer if the account simply doesn't have enough
 * data yet for a given kind of finding. */
export function buildRecommendations(analysis: InstagramAnalysis): string[] {
  const notes: string[] = [];

  const stale = analysis.categoryDistribution.filter((c) => c.lastUsedDaysAgo >= 45).sort((a, b) => b.lastUsedDaysAgo - a.lastUsedDaysAgo);
  if (stale.length) {
    notes.push(`"${stale[0].category}" teması ${stale[0].lastUsedDaysAgo} gündür işlenmemiş — önümüzdeki planda yer verilebilir.`);
  }

  if (analysis.missingCategories.length) {
    notes.push(`Hiç işlenmemiş temalar: ${analysis.missingCategories.slice(0, 3).join(", ")}.`);
  }

  const overused = analysis.categoryDistribution[0];
  if (overused && analysis.categoryDistribution.length > 1 && overused.count >= analysis.postsFetched * 0.35) {
    notes.push(`"${overused.category}" son gönderilerin büyük kısmını oluşturuyor (${overused.count} gönderi) — çeşitliliği artırmak faydalı olabilir.`);
  }

  if (analysis.topPerformers.length) {
    const bestFormat = analysis.topPerformers[0].format;
    notes.push(`En iyi performans gösteren gönderiler ağırlıklı olarak "${bestFormat}" formatında — bu formatı artırmak değerlendirilebilir.`);
  }

  if (analysis.repetitionRisks.length) {
    notes.push(`${analysis.repetitionRisks.length} gönderi çiftinde konu tekrarı riski tespit edildi — yeni planda aynı açıyı tekrarlamaktan kaçının.`);
  }

  if (analysis.postingFrequencyPerWeek > 0) {
    notes.push(`Mevcut paylaşım sıklığı haftada ~${analysis.postingFrequencyPerWeek} gönderi — 30 günlük plan bu tempoya göre şekillendirilebilir.`);
  }

  if (analysis.postsWithMetrics < 3) {
    notes.push("Performans metriği (reach/saved/shares) alınabilen gönderi sayısı düşük — en iyi/en zayıf içerik tespiti sınırlı güvenilirlikte.");
  }

  return notes.slice(0, 6);
}
