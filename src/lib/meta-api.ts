export type MetaStructuredError = {
  errorCode: string;
  errorMessage: string;
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

export function classifyMetaError(raw: any, fallbackCode = "META_API_ERROR"): MetaStructuredError {
  const error = raw?.error || raw || {};
  const code = String(error.code || error.error_subcode || fallbackCode);
  const message = String(error.message || raw?.message || "").toLocaleLowerCase("tr");
  const isRateLimit = ["4", "17", "32", "613", "80004"].includes(code) || message.includes("rate") || message.includes("limit");
  const isTokenExpired = ["190", "102"].includes(code) || message.includes("token") || message.includes("expired") || message.includes("invalid");
  const isPermissionError = ["10", "200", "201", "2500", "2635"].includes(code) || message.includes("permission") || message.includes("izin") || message.includes("yetki");
  let errorMessage = "Meta Ad Library bağlantısı başarısız oldu. Demo sonuçlar gösteriliyor.";

  if (isRateLimit) errorMessage = "Meta API istek sınırına takıldı. Biraz bekleyip tekrar deneyin.";
  else if (isTokenExpired) errorMessage = "Meta token geçersiz veya süresi dolmuş. API ayarlarından yeni token girin.";
  else if (isPermissionError) errorMessage = "Meta token yetkileri bu işlem için yeterli değil.";

  return { errorCode: code, errorMessage, isRateLimit, isTokenExpired, isPermissionError, isCacheFallback: false };
}

export function noMetaTokenError(): MetaStructuredError {
  return {
    errorCode: "META_TOKEN_MISSING",
    errorMessage: "Meta API bağlantısı bulunamadı. Demo sonuçlar gösteriliyor.",
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
