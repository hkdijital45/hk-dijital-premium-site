// Shared types for Analiz & Raporlama Merkezi. Kept provider-agnostic so the
// UI, sync orchestrator and each provider adapter share one vocabulary —
// see capabilities.ts for which metrics each provider actually supports.

export type AnalyticsProvider = "instagram" | "facebook" | "youtube" | "google_ads" | "google_business_profile";

export const ANALYTICS_PROVIDERS: AnalyticsProvider[] = ["instagram", "facebook", "youtube", "google_ads", "google_business_profile"];

// Matches the exact shape already persisted into customer_integrations.
// integration_assets by selectOAuthAccount() in
// src/lib/customer-integration-oauth.ts — read-only here, never written.
export type ConnectionAsset = {
  id: string;
  provider: "meta" | "google";
  platform: AnalyticsProvider | string;
  platform_label?: string;
  asset_type: string;
  asset_id: string;
  asset_name: string;
  provider_account_id: string;
  provider_account_name: string;
  account_type: string;
  status?: string;
  oauth_status?: string;
  last_synced_at?: string;
  metadata?: Record<string, unknown>;
};

export type ConnectionStatusValue =
  | "connected"
  | "not_connected"
  | "token_expired"
  | "reauth_required"
  | "sync_error"
  | "no_data";

export type ProviderConnectionStatus = {
  provider: AnalyticsProvider;
  label: string;
  status: ConnectionStatusValue;
  statusLabel: string;
  asset: ConnectionAsset | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  connectHref: string;
  manageHref: string;
  externalHref: string | null;
  // true when the OAuth app itself has the required scope/permission for
  // real analytics (as opposed to just being logged in) — e.g. Meta's
  // advanced business scopes gated behind META_ADVANCED_SCOPES_ENABLED.
  scopeReady: boolean;
  scopeNote: string | null;
};

export type MetricCapability = "supported" | "unsupported" | "permission_missing" | "not_applicable";

export type ProviderMetricDefinition = {
  key: string;
  label: string;
  unit: "count" | "currency" | "percent" | "seconds" | "rating" | "ratio";
  kpiGroup: "audience" | "awareness" | "engagement" | "traffic" | "ads" | "local";
  capability: MetricCapability;
  note?: string;
};

export type DailyMetricRow = {
  companyId: string;
  provider: AnalyticsProvider;
  assetId: string;
  metricDate: string; // YYYY-MM-DD
  metricKey: string;
  metricValue: number;
  currency?: string | null;
  dimensions?: Record<string, unknown>;
};

export type ContentMetricRow = {
  companyId: string;
  provider: AnalyticsProvider;
  assetId: string;
  contentId: string;
  contentType?: string | null;
  caption?: string | null;
  title?: string | null;
  permalink?: string | null;
  thumbnailUrl?: string | null;
  publishedAt?: string | null;
  metrics: Record<string, number | null>;
};

export type SyncOutcome = {
  provider: AnalyticsProvider;
  ok: boolean;
  message: string;
  dailyMetricsWritten: number;
  contentMetricsWritten: number;
  warnings: string[];
};

export type DateRange = { startDate: string; endDate: string };

export type KpiCardValue = {
  key: string;
  label: string;
  value: number | null;
  previousValue: number | null;
  changeAbsolute: number | null;
  changePercent: number | null;
  unit: ProviderMetricDefinition["unit"];
  capability: MetricCapability;
  source: AnalyticsProvider;
  note?: string;
};
