/* eslint-disable @typescript-eslint/no-explicit-any */

import { getGoogleServiceAccountStatus } from "./google-analytics-server";

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
}) {
  const status = getSearchConsoleStatus();
  if (!status.ready) {
    return { ok: false, rows: [], message: "Search Console API hazırlığı eksik.", missingEnv: status.missingEnv };
  }
  return {
    ok: false,
    rows: [],
    message: "Search Console API çağrısı için OAuth access token üretimi yapılandırıldığında gerçek veri çekilecek.",
    params
  };
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
