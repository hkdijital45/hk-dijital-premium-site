// Pure string encoding for campaign-level metric rows — no server-only
// import, unlike providers/google-ads.ts, so it can be unit-tested
// directly and imported from kpi.ts without pulling in that provider's
// fetch/secret dependencies.
//
// Campaign-level rows share analytics_daily_metrics with account totals
// (no extra table/migration) by suffixing metric_key with the campaign id —
// e.g. "cost::campaign:1234567890" — instead of adding a campaign_id to the
// table's unique constraint. Account-total rows never carry this suffix.
const CAMPAIGN_METRIC_SUFFIX = "::campaign:";

export function campaignMetricKey(baseKey: string, campaignId: string) {
  return `${baseKey}${CAMPAIGN_METRIC_SUFFIX}${campaignId}`;
}
export function isCampaignMetricKey(metricKey: string) {
  return metricKey.includes(CAMPAIGN_METRIC_SUFFIX);
}
export function parseCampaignMetricKey(metricKey: string): { baseKey: string; campaignId: string } | null {
  const index = metricKey.indexOf(CAMPAIGN_METRIC_SUFFIX);
  if (index === -1) return null;
  return { baseKey: metricKey.slice(0, index), campaignId: metricKey.slice(index + CAMPAIGN_METRIC_SUFFIX.length) };
}
