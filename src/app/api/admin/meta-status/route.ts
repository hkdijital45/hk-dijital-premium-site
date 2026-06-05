import { NextResponse } from "next/server";
import { classifyMetaError, metaAppCredentials, metaRuntimeStatus, metaToken, recordMetaError, recordMetaSuccess } from "@/lib/meta-api";
import { requireModuleAccess } from "@/lib/permissions";

export async function GET() {
  if (!(await requireModuleAccess("api-ayarlari")) && !(await requireModuleAccess("meta-analiz")) && !(await requireModuleAccess("dashboard"))) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  const token = metaToken();
  const startedAt = Date.now();
  const runtime = metaRuntimeStatus();

  if (!token) {
    return NextResponse.json({
      ok: true,
      hasToken: false,
      tokenValid: false,
      expiry: "Tespit edilemedi",
      lastSuccessfulMetaRequest: runtime.lastSuccessfulRequestAt || "",
      lastMetaError: runtime.lastError?.errorMessage || "",
      responseTimeMs: Date.now() - startedAt
    });
  }

  const { appId, appSecret } = metaAppCredentials();
  if (!appId || !appSecret) {
    return NextResponse.json({
      ok: true,
      hasToken: true,
      tokenValid: null,
      expiry: "Tespit edilemedi",
      diagnostic: "Meta App ID/App Secret olmadığı için debug_token testi atlandı.",
      lastSuccessfulMetaRequest: runtime.lastSuccessfulRequestAt || "",
      lastMetaError: runtime.lastError?.errorMessage || "",
      responseTimeMs: Date.now() - startedAt
    });
  }

  try {
    const params = new URLSearchParams({ input_token: token, access_token: `${appId}|${appSecret}` });
    const response = await fetch(`https://graph.facebook.com/debug_token?${params}`, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    const responseTimeMs = Date.now() - startedAt;

    if (!response.ok || data?.data?.is_valid === false) {
      const error = classifyMetaError(data, "META_TOKEN_INVALID");
      recordMetaError(error, responseTimeMs);
      return NextResponse.json({
        ok: true,
        hasToken: true,
        tokenValid: false,
        expiry: data?.data?.expires_at ? new Date(Number(data.data.expires_at) * 1000).toISOString() : "Tespit edilemedi",
        lastSuccessfulMetaRequest: runtime.lastSuccessfulRequestAt || "",
        lastMetaError: error.errorMessage,
        responseTimeMs,
        error
      });
    }

    recordMetaSuccess(responseTimeMs);
    return NextResponse.json({
      ok: true,
      hasToken: true,
      tokenValid: true,
      expiry: data?.data?.expires_at ? new Date(Number(data.data.expires_at) * 1000).toISOString() : "Tespit edilemedi",
      lastSuccessfulMetaRequest: metaRuntimeStatus().lastSuccessfulRequestAt,
      lastMetaError: metaRuntimeStatus().lastError?.errorMessage || "",
      responseTimeMs
    });
  } catch (error) {
    const responseTimeMs = Date.now() - startedAt;
    const structured = classifyMetaError(error, "META_STATUS_FAILED");
    recordMetaError(structured, responseTimeMs);
    return NextResponse.json({
      ok: true,
      hasToken: true,
      tokenValid: false,
      expiry: "Tespit edilemedi",
      lastSuccessfulMetaRequest: runtime.lastSuccessfulRequestAt || "",
      lastMetaError: structured.errorMessage,
      responseTimeMs,
      error: structured
    });
  }
}
