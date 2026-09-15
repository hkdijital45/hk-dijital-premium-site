// Shared Meta Graph API plumbing for the instagram.ts and facebook.ts
// adapters. Deliberately NOT the graph.instagram.com client in
// src/lib/social-autopilot/instagram-graph-client.ts — that client
// authenticates via the separate Instagram Login product
// (INSTAGRAM_APP_ID/SECRET) used for HK Dijital's own account. Customers
// connect via Meta Business Login (META_APP_ID/SECRET, graph.facebook.com),
// exactly like src/lib/meta-business-phase2.ts's insight/discovery calls —
// this file mirrors that file's graphGet + per-metric resilience pattern so
// both integration surfaces behave identically under a stale/renamed
// metric.
import "server-only";

const GRAPH_VERSION = "v20.0";

function metaApiMessage(payload: any, fallback: string): string {
  const message = String(payload?.error?.message || payload?.message || "").trim();
  const lower = message.toLocaleLowerCase("tr-TR");
  if (lower.includes("permission")) return "Meta izni yetersiz. App Review izinlerini ve müşteri onayını kontrol edin.";
  if (lower.includes("expired")) return "Meta oturumu süresi dolmuş. Lütfen Meta ile yeniden giriş yapın.";
  if (lower.includes("rate") || payload?.error?.code === 4 || payload?.error?.code === 17) return "Meta API limitine takıldı. Bir süre sonra tekrar deneyin.";
  return message || fallback;
}

export async function metaGraphGet(path: string, accessToken: string, params: Record<string, string> = {}) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${path.replace(/^\//, "")}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  url.searchParams.set("access_token", accessToken);
  const response = await fetch(url, { cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(metaApiMessage(payload, "Meta API isteği başarısız oldu."));
  return payload;
}

// Tries the full metric batch first (one HTTP call); on any failure, falls
// back to fetching each metric individually and keeps whichever succeed —
// one renamed/retired metric degrades a single value, not the whole sync.
// Mirrors src/lib/social-autopilot/analytics-sync.ts's
// fetchResilientMediaMetrics, generalized for both /insights endpoints and
// arbitrary extra query params (period, since/until, metric_type).
export async function resilientInsightsFetch(
  path: string,
  accessToken: string,
  metrics: string[],
  extraParams: Record<string, string> = {}
): Promise<{ values: Record<string, number>; failedMetrics: string[] }> {
  try {
    const payload = await metaGraphGet(path, accessToken, { metric: metrics.join(","), ...extraParams });
    const values: Record<string, number> = {};
    for (const entry of payload.data || []) {
      const value = entry.total_value?.value ?? entry.values?.[entry.values.length - 1]?.value ?? 0;
      values[entry.name] = Number(value) || 0;
    }
    return { values, failedMetrics: metrics.filter((m) => !(m in values)) };
  } catch {
    const values: Record<string, number> = {};
    const failedMetrics: string[] = [];
    for (const metric of metrics) {
      try {
        const payload = await metaGraphGet(path, accessToken, { metric, ...extraParams });
        const entry = payload.data?.[0];
        const value = entry?.total_value?.value ?? entry?.values?.[entry.values.length - 1]?.value ?? 0;
        values[metric] = Number(value) || 0;
      } catch {
        failedMetrics.push(metric);
      }
    }
    return { values, failedMetrics };
  }
}
