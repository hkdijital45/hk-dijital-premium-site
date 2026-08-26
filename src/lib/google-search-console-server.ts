/* eslint-disable @typescript-eslint/no-explicit-any */

import { getGoogleServiceAccountStatus } from "./google-analytics-server";
import { getGoogleServiceAccountAccessToken } from "./google-service-account-auth";

const SEARCH_CONSOLE_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function getSearchConsoleStatus() {
  const siteUrl = String(process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL || "").trim();
  const serviceAccount = getGoogleServiceAccountStatus();
  return {
    ready: Boolean(siteUrl && serviceAccount.ready),
    siteUrlConfigured: Boolean(siteUrl),
    missingEnv: [
      ...(!siteUrl ? ["GOOGLE_SEARCH_CONSOLE_SITE_URL"] : []),
      ...serviceAccount.missingEnv
    ],
    message: siteUrl
      ? "Search Console Site URL hazır; servis hesabı property üzerinde yetkili olmalı."
      : "Search Console performans verisi için site URL değeri gerekir."
  };
}

export async function fetchSearchConsolePerformance(params: {
  siteUrl?: string;
  startDate?: string;
  endDate?: string;
  dimensions?: string[];
  rowLimit?: number;
}) {
  const status = getSearchConsoleStatus();
  if (!status.ready) {
    return { ok: false, rows: [], message: "Search Console API hazırlığı eksik.", missingEnv: status.missingEnv };
  }

  const siteUrl = String(params.siteUrl || process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL || "").trim();
  const token = await getGoogleServiceAccountAccessToken([SEARCH_CONSOLE_SCOPE]);
  if (!token.ok) {
    return { ok: false, rows: [], message: token.error };
  }

  const endDate = params.endDate || isoDate(new Date(Date.now() - 3 * 86_400_000));
  const startDate = params.startDate || isoDate(new Date(Date.now() - 31 * 86_400_000));
  const dimensions = params.dimensions?.length ? params.dimensions : ["query", "page"];

  try {
    const response = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ startDate, endDate, dimensions, rowLimit: Math.min(params.rowLimit || 500, 25000) })
      }
    );

    const payload = await response.json().catch(() => ({} as any));
    if (!response.ok) {
      const detail = String(payload?.error?.message || `HTTP ${response.status}`);
      return { ok: false, rows: [], message: `Search Console API hatası: ${detail}` };
    }

    return { ok: true, rows: normalizeSearchConsoleRows(payload), params: { siteUrl, startDate, endDate, dimensions } };
  } catch (error) {
    return {
      ok: false,
      rows: [],
      message: error instanceof Error ? error.message : "Search Console API çağrısı başarısız oldu."
    };
  }
}

export function normalizeSearchConsoleRows(raw: any) {
  const rows = Array.isArray(raw?.rows) ? raw.rows : [];
  return rows.map((row: any) => ({
    query: row.keys?.[0] || "",
    page: row.keys?.[1] || "",
    clicks: Number(row.clicks || 0),
    impressions: Number(row.impressions || 0),
    ctr: Number(row.ctr || 0),
    position: Number(row.position || 0)
  }));
}
