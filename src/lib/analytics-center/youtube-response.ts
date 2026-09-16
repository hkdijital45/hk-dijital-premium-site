// Keep absent or malformed API values absent; only a real numeric zero is zero.
export function youtubeMetricValue(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function youtubeApiError(status: number, payload: unknown, url: string): string {
  const error = (payload as { error?: { message?: string } })?.error;
  const message = error?.message || `YouTube API isteği başarısız oldu (HTTP ${status}).`;
  const detail = JSON.stringify(payload) || "";
  const service = url.includes("youtubeanalytics.googleapis.com") ? "YouTube Analytics API" : "YouTube Data API v3";
  if (/SERVICE_DISABLED|accessNotConfigured|has not been used|it is disabled/i.test(detail)) {
    return `${service} Google Cloud projesinde kapalı veya etkinleştirme henüz yayılmadı. Otomatik yeniden denemeler sonuç vermedi. API durumunu kontrol edin; yeni açıldıysa birkaç dakika sonra Verileri Güncelle ile tekrar deneyin. ${message}`;
  }
  if (/quotaExceeded|dailyLimitExceeded|rateLimitExceeded|RESOURCE_EXHAUSTED/i.test(detail) || status === 429) {
    return `${service} kota sınırına ulaşıldı. Daha sonra tekrar deneyin. ${message}`;
  }
  if (status === 401 || /insufficientPermissions|ACCESS_TOKEN_SCOPE_INSUFFICIENT|insufficient authentication scopes/i.test(detail)) {
    return `${service} oturumu veya izni eksik. HK Admin'de Hesabı Yeniden Bağla ile Google izinlerini yenileyin. ${message}`;
  }
  if (status === 403) return `${service} erişimi reddedildi. Seçili kanalın sahibi olan Google hesabını ve kanal izinlerini kontrol edin. ${message}`;
  return message;
}

// Retry only idempotent reads and recoverable Google failures. Three attempts
// bound propagation/rate-limit waits; missing consent and daily quota fail fast.
export function youtubeRetryDelay(status: number, payload: unknown, attempt: number): number | null {
  if (attempt >= 2) return null;
  const detail = JSON.stringify(payload) || "";
  if (/quotaExceeded|dailyLimitExceeded/i.test(detail)) return null;
  if (status === 429 || status >= 500 || /SERVICE_DISABLED|accessNotConfigured|has not been used|it is disabled|rateLimitExceeded/i.test(detail)) {
    return 1000 * 2 ** attempt;
  }
  return null;
}

export async function youtubeGet(
  url: string,
  accessToken: string,
  request: typeof fetch = fetch,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
) {
  for (let attempt = 0; ; attempt++) {
    const response = await request(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000)
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) return payload;
    const delay = youtubeRetryDelay(response.status, payload, attempt);
    if (delay === null) throw new Error(youtubeApiError(response.status, payload, url));
    await sleep(delay);
  }
}
