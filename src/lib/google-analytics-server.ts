/* eslint-disable @typescript-eslint/no-explicit-any */

import { getWebsiteAnalyticsIntegrationStatus } from "./website-analytics";

export function getGoogleServiceAccountStatus() {
  const status = getWebsiteAnalyticsIntegrationStatus();
  const missingEnv = status.ga4.flatMap((item) => item.missingEnv);
  const hasError = status.ga4.some((item) => item.status === "error");
  return {
    ready: missingEnv.length === 0 && !hasError,
    missingEnv: [...new Set(missingEnv)],
    message: missingEnv.length
      ? "Google servis hesabı eksik olduğu için GA4 API raporu alınamadı."
      : hasError
        ? "Google servis hesabı formatı kontrol edilmeli."
        : "Google servis hesabı GA4 raporları için hazır görünüyor."
  };
}

export async function buildGoogleAuthHeaders() {
  const serviceStatus = getGoogleServiceAccountStatus();
  if (!serviceStatus.ready) {
    return { ok: false, headers: {}, error: serviceStatus.message };
  }

  return {
    ok: false,
    headers: {},
    error: "Google OAuth JWT imzalama bağımlılığı eklenmeden gerçek access token üretimi devre dışıdır."
  };
}

export async function fetchGa4Report(params: {
  propertyId?: string;
  startDate?: string;
  endDate?: string;
  metrics?: string[];
  dimensions?: string[];
}) {
  const propertyId = params.propertyId || process.env.GA4_PROPERTY_ID || process.env.GOOGLE_ANALYTICS_PROPERTY_ID;
  const serviceStatus = getGoogleServiceAccountStatus();
  if (!propertyId || !serviceStatus.ready) {
    return {
      ok: false,
      rows: [],
      message: !propertyId ? "GA4 Property ID eksik." : serviceStatus.message
    };
  }

  return {
    ok: false,
    rows: [],
    message: "GA4 Data API server-side hazırlığı tamamlandı; access token üretimi yapılandırıldığında gerçek rapor çekilecek."
  };
}

export function normalizeGa4Report(raw: any) {
  const rows = Array.isArray(raw?.rows) ? raw.rows : [];
  return rows.map((row: any) => ({
    dimensions: row.dimensionValues || [],
    metrics: row.metricValues || []
  }));
}

export async function getWebsiteAnalyticsSummary() {
  const report = await fetchGa4Report({
    metrics: ["activeUsers", "sessions", "screenPageViews", "conversions", "eventCount"],
    dimensions: ["date", "sessionSourceMedium", "pagePath", "deviceCategory"]
  });
  return report;
}
