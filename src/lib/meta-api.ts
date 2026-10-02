export type MetaStructuredError = {
  errorCode: string;
  errorMessage: string;
  // Meta's own raw error.message (e.g. "(#100) Tried accessing
  // nonexisting field (creative) on node type (Ad)") — never shown to
  // customers, but preserved for staff/logs so a future failure can be
  // diagnosed from its real cause instead of only a generic bucket.
  rawMessage: string | null;
  isRateLimit: boolean;
  isTokenExpired: boolean;
  isPermissionError: boolean;
  isCacheFallback: boolean;
};

type MetaRuntimeState = {
  lastSuccessfulRequestAt: string;
  lastError: MetaStructuredError | null;
  lastResponseTimeMs: number;
};

const metaRuntimeState: MetaRuntimeState = {
  lastSuccessfulRequestAt: "",
  lastError: null,
  lastResponseTimeMs: 0
};

export function metaToken() {
  return process.env.META_AD_LIBRARY_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN || "";
}

export function metaAppCredentials() {
  return {
    appId: process.env.META_APP_ID || process.env.FACEBOOK_APP_ID || "",
    appSecret: process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET || ""
  };
}

// fallbackMessage is caller-supplied (never a hardcoded "Ad Library"/
// "Demo sonuçlar gösteriliyor" default here) — this classifier is shared
// by callers with genuinely different real behavior on failure: the
// Meta Ad Library competitor-intelligence route (meta-analysis/route.ts)
// really does call the public Ad Library API and really does fall back
// to fabricated demo results, so its own fallbackMessage says so; the
// Meta Ads performance/creative sync (meta-ads/route.ts) and the token
// status check (meta-status/route.ts) call the real Marketing API and
// never show any demo/mock data on failure — they get the honest
// default below instead. Reusing the Ad Library/demo wording for THOSE
// callers was itself the bug (proven: meta-ads/route.ts has no demo/mock
// generator anywhere — a failed creative fetch just leaves fields
// blank, yet the log claimed "Demo sonuçlar gösteriliyor").
export function classifyMetaError(raw: any, fallbackCode = "META_API_ERROR", fallbackMessage = "Meta verisi alınamadı."): MetaStructuredError {
  const error = raw?.error || raw || {};
  const code = String(error.code || error.error_subcode || fallbackCode);
  const rawMessage = typeof error.message === "string" && error.message ? error.message : null;
  const message = String(error.message || raw?.message || "").toLocaleLowerCase("tr");
  const isRateLimit = ["4", "17", "32", "613", "80004"].includes(code) || message.includes("rate") || message.includes("limit");
  const isTokenExpired = ["190", "102"].includes(code) || message.includes("token") || message.includes("expired") || message.includes("invalid");
  const isPermissionError = ["10", "200", "201", "2500", "2635"].includes(code) || message.includes("permission") || message.includes("izin") || message.includes("yetki");
  let errorMessage = fallbackMessage;

  if (isRateLimit) errorMessage = "Meta API istek sınırına takıldı. Biraz bekleyip tekrar deneyin.";
  else if (isTokenExpired) errorMessage = "Meta token geçersiz veya süresi dolmuş. API ayarlarından yeni token girin.";
  else if (isPermissionError) errorMessage = "Meta token yetkileri bu işlem için yeterli değil.";

  return { errorCode: code, errorMessage, rawMessage, isRateLimit, isTokenExpired, isPermissionError, isCacheFallback: false };
}

export function noMetaTokenError(): MetaStructuredError {
  return {
    errorCode: "META_TOKEN_MISSING",
    errorMessage: "Meta API bağlantısı bulunamadı. Demo sonuçlar gösteriliyor.",
    rawMessage: null,
    isRateLimit: false,
    isTokenExpired: false,
    isPermissionError: false,
    isCacheFallback: false
  };
}

export function cacheFallbackError(): MetaStructuredError {
  return {
    errorCode: "META_CACHE_FALLBACK",
    errorMessage: "Canlı Meta API yanıt vermedi. Son başarılı sonuçlar gösteriliyor.",
    rawMessage: null,
    isRateLimit: false,
    isTokenExpired: false,
    isPermissionError: false,
    isCacheFallback: true
  };
}

export function recordMetaSuccess(responseTimeMs: number) {
  metaRuntimeState.lastSuccessfulRequestAt = new Date().toISOString();
  metaRuntimeState.lastResponseTimeMs = responseTimeMs;
}

export function recordMetaError(error: MetaStructuredError, responseTimeMs: number) {
  metaRuntimeState.lastError = error;
  metaRuntimeState.lastResponseTimeMs = responseTimeMs;
}

export function metaRuntimeStatus() {
  return { ...metaRuntimeState };
}
