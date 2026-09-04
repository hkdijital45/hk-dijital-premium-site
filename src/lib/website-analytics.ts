/* eslint-disable @typescript-eslint/no-explicit-any */

import { getGlobalMetaPixelId } from "./meta-pixel-settings";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "./supabase";
import { istanbulDateString, resolveRange, type AnalyticsRangeInput } from "./analytics-time";

export type { AnalyticsRangeInput };

export type WebsiteAnalyticsStatus = "demo" | "live" | "partial";

export type WebsiteAnalyticsSetup = {
  metaPixelId: boolean;
  metaDatasetId: boolean;
  metaAccessToken: boolean;
  gaMeasurementId: boolean;
  gaPropertyId: boolean;
  gaServiceAccount: boolean;
};

export type AnalyticsCheckStatus = "ready" | "missing" | "not_configured" | "error" | "optional";

export type AnalyticsStatusItem = {
  key: string;
  label: string;
  status: AnalyticsCheckStatus;
  missingEnv: string[];
  help: string;
  isSecret?: boolean;
};

export type WebsiteAnalyticsIntegrationStatus = {
  meta: AnalyticsStatusItem[];
  ga4: AnalyticsStatusItem[];
  searchConsole: AnalyticsStatusItem[];
  googleAds: AnalyticsStatusItem[];
  tagManager: AnalyticsStatusItem[];
  clarity: AnalyticsStatusItem[];
  hotjar: AnalyticsStatusItem[];
  criticalMissing: string[];
};

export type CustomerIntegrationSummary = {
  companyId: string;
  companyName: string;
  domain: string;
  setupProgress: number;
  metaStatus: AnalyticsCheckStatus;
  googleStatus: AnalyticsCheckStatus;
  ga4Status: AnalyticsCheckStatus;
  googleAdsStatus: AnalyticsCheckStatus;
  behaviorStatus: AnalyticsCheckStatus;
  lastCheckedAt: string | null;
};

export type WebsiteAnalyticsSummary = {
  todayPageViews: number;
  last7DaysPageViews: number;
  contacts: number;
  leads: number;
  ctaClicks: number;
  conversionRate: number;
  topPage: string;
};

export type DailyTrendPoint = { date: string; pageViews: number };

export type WebsiteAnalyticsEvent = {
  id: string;
  eventName: string;
  label: string;
  count: number;
  pagePath?: string;
  source?: string;
  timestamp?: string | null;
};

export type WebsiteAnalyticsPage = {
  path: string;
  label: string;
  pageViews: number;
  contacts: number;
  leads: number;
  conversionRate: number;
};

export type WebsiteAnalyticsSource = {
  source: string;
  sessions: number;
  pageViews: number;
  leads: number;
  status: "hazir" | "bekliyor";
};

export type WebsiteAnalyticsResponse = {
  status: WebsiteAnalyticsStatus;
  setup: WebsiteAnalyticsSetup;
  integrationStatus: WebsiteAnalyticsIntegrationStatus;
  customerIntegrations: CustomerIntegrationSummary[];
  // null means "could not be queried" (connection/query error) — never
  // rendered as zero. A real absence of traffic is a populated object
  // whose numbers happen to be 0.
  summary: WebsiteAnalyticsSummary | null;
  events: WebsiteAnalyticsEvent[];
  pages: WebsiteAnalyticsPage[];
  sources: WebsiteAnalyticsSource[];
  trend: DailyTrendPoint[];
  firstPartyError: string | null;
  recommendations: string[];
  lastSyncedAt: string | null;
};

function envValue(key: string) {
  return String(process.env[key] || "").trim();
}

function item(key: string, label: string, envKeys: string[], help: string, options: { optional?: boolean; valid?: boolean; secret?: boolean } = {}): AnalyticsStatusItem {
  const missingEnv = envKeys.filter((envKey) => !envValue(envKey));
  const hasAll = missingEnv.length === 0;
  return {
    key,
    label,
    status: !hasAll ? (options.optional ? "optional" : "missing") : options.valid === false ? "error" : "ready",
    missingEnv,
    help,
    isSecret: options.secret
  };
}

export function getWebsiteAnalyticsIntegrationStatus(): WebsiteAnalyticsIntegrationStatus {
  const privateKey = envValue("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n");
  const serviceEmail = envValue("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const metaDatasetId = envValue("META_DATASET_ID");
  const gaPropertyId = envValue("GA4_PROPERTY_ID") || envValue("GOOGLE_ANALYTICS_PROPERTY_ID");
  const measurementId = envValue("NEXT_PUBLIC_GA_MEASUREMENT_ID");
  const gtmId = envValue("NEXT_PUBLIC_GTM_ID");

  const meta = [
    item("meta_pixel", "Meta Pixel ID", ["NEXT_PUBLIC_META_PIXEL_ID"], "Public site olaylarının Meta tarafına işlenmesi için gerekir."),
    item("meta_dataset", "Meta Dataset ID", ["META_DATASET_ID"], "Events Manager veri seti kimliği; Conversions API için gerekir.", { valid: !metaDatasetId || /^\d+$/.test(metaDatasetId) }),
    item("meta_token", "Meta Access Token", ["META_ACCESS_TOKEN"], "Server-side Meta API ve Conversions API hazırlığı için gerekir.", { secret: true })
  ];

  const ga4 = [
    item("ga_measurement", "GA4 Measurement ID", ["NEXT_PUBLIC_GA_MEASUREMENT_ID"], "Public GA4 ölçüm kimliği G- ile başlamalıdır.", { valid: !measurementId || measurementId.startsWith("G-") }),
    item("ga_property", "GA4 Property ID", [envValue("GA4_PROPERTY_ID") ? "GA4_PROPERTY_ID" : "GOOGLE_ANALYTICS_PROPERTY_ID"], "GA4 Data API raporları için numeric mülk kimliği gerekir.", { valid: !gaPropertyId || /^\d+$/.test(gaPropertyId) }),
    item("ga_service_email", "Google Service Account Email", ["GOOGLE_SERVICE_ACCOUNT_EMAIL"], "Servis hesabı mail adresi GA4 mülküne Viewer veya Analyst olarak eklenmelidir.", { valid: !serviceEmail || serviceEmail.includes("iam.gserviceaccount.com") }),
    item("ga_service_private_key", "Google Service Account Private Key", ["GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"], "Private key Vercel env içinde \\n karakterleriyle saklanabilir.", { valid: !privateKey || privateKey.includes("BEGIN PRIVATE KEY"), secret: true }),
    item("ga_service_project", "Google Service Account Project ID", ["GOOGLE_SERVICE_ACCOUNT_PROJECT_ID"], "Google Cloud proje kimliği rapor hazırlığı için gerekir.")
  ];

  const searchConsole = [
    item("search_console_site", "Search Console Site URL", ["GOOGLE_SEARCH_CONSOLE_SITE_URL"], "Organik arama performansı için property URL değeri gerekir."),
    item("search_console_api", "Search Console API hazırlığı", ["GOOGLE_SERVICE_ACCOUNT_EMAIL", "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", "GOOGLE_SEARCH_CONSOLE_SITE_URL"], "Servis hesabı property üzerinde yetkili olmalıdır.", { secret: true })
  ];

  const googleAds = [
    item("google_ads", "Google Ads API", ["GOOGLE_ADS_CUSTOMER_ID", "GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_REFRESH_TOKEN"], "Canlı kampanya verisi için Customer ID, developer token ve OAuth refresh token gerekir.", { secret: true }),
    item("google_ads_login", "Google Ads MCC Login Customer ID", ["GOOGLE_ADS_LOGIN_CUSTOMER_ID"], "MCC üzerinden yönetilen hesaplarda önerilir.", { optional: true })
  ];

  const tagManager = [
    item("gtm", "Google Tag Manager Container ID", ["NEXT_PUBLIC_GTM_ID"], "GTM- ile başlayan container kimliği opsiyonel etiket yönetimi sağlar.", { optional: true, valid: !gtmId || gtmId.startsWith("GTM-") })
  ];

  const clarity = [
    item("clarity", "Microsoft Clarity Project ID", ["MICROSOFT_CLARITY_PROJECT_ID"], "Isı haritası ve oturum kaydı analizi için opsiyoneldir.", { optional: true })
  ];

  const hotjar = [
    item("hotjar", "Hotjar Site ID", ["HOTJAR_SITE_ID"], "Kullanıcı davranışı ve geri bildirim analizi için opsiyoneldir.", { optional: true })
  ];

  const criticalMissing = [...meta, ...ga4, ...searchConsole, ...googleAds]
    .filter((entry) => entry.status === "missing" || entry.status === "error")
    .flatMap((entry) => entry.missingEnv.length ? entry.missingEnv : [entry.label]);

  return { meta, ga4, searchConsole, googleAds, tagManager, clarity, hotjar, criticalMissing: [...new Set(criticalMissing)] };
}

const pageLabels: Array<[string, string]> = [
  ["/", "Ana sayfa"],
  ["/hizmetler", "Hizmetler"],
  ["/paketler", "Paketler"],
  ["/iletisim", "İletişim"],
  ["/hk-intelligence", "HK Intelligence"],
  ["other", "Diğer sayfalar"]
];

const conversionEvents: Array<[string, string]> = [
  ["PageView", "PageView (sayfa görüntüleme)"],
  ["Contact", "Contact (iletişim tıklaması)"],
  ["Lead", "Lead (potansiyel müşteri)"],
  ["InitiateCheckout", "InitiateCheckout (teklif süreci başlatma)"],
  ["ViewContent", "ViewContent (içerik görüntüleme)"],
  ["HK_CTA_Click", "HK_CTA_Click (CTA buton tıklaması)"]
];

export function getWebsiteAnalyticsSetup(): WebsiteAnalyticsSetup {
  const serviceAccountPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");

  return {
    metaPixelId: Boolean(process.env.NEXT_PUBLIC_META_PIXEL_ID),
    metaDatasetId: Boolean(process.env.META_DATASET_ID),
    metaAccessToken: Boolean(process.env.META_ACCESS_TOKEN),
    gaMeasurementId: Boolean(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID),
    gaPropertyId: Boolean(process.env.GA4_PROPERTY_ID || process.env.GOOGLE_ANALYTICS_PROPERTY_ID),
    gaServiceAccount: Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && serviceAccountPrivateKey && process.env.GOOGLE_SERVICE_ACCOUNT_PROJECT_ID)
  };
}

function resolveStatus(setup: WebsiteAnalyticsSetup): WebsiteAnalyticsStatus {
  const metaReady = setup.metaDatasetId && setup.metaAccessToken;
  const gaReady = setup.gaPropertyId && setup.gaServiceAccount;

  if (metaReady && gaReady) return "live";
  if (setup.metaPixelId || setup.gaMeasurementId || metaReady || gaReady) return "partial";
  return "demo";
}

function emptyPages(): WebsiteAnalyticsPage[] {
  return pageLabels.map(([path, label]) => ({
    path,
    label,
    pageViews: 0,
    contacts: 0,
    leads: 0,
    conversionRate: 0
  }));
}

function emptyEvents(): WebsiteAnalyticsEvent[] {
  return conversionEvents.map(([eventName, label]) => ({
    id: eventName,
    eventName,
    label,
    count: 0,
    timestamp: null
  }));
}

function emptySources(): WebsiteAnalyticsSource[] {
  return ["Direct", "Organic", "Facebook / Instagram", "Google", "Referral"].map((source) => ({
    source,
    sessions: 0,
    pageViews: 0,
    leads: 0,
    status: "bekliyor"
  }));
}

async function fetchMetaAnalyticsIfConfigured(setup: WebsiteAnalyticsSetup) {
  if (!setup.metaAccessToken || !setup.metaDatasetId) return null;

  // Meta Dataset API bağlantısı için güvenli hazırlık noktası.
  // Token server tarafında kalır; client response içinde asla döndürülmez.
  return null;
}

async function fetchGa4AnalyticsIfConfigured(setup: WebsiteAnalyticsSetup) {
  if (!setup.gaPropertyId || !setup.gaServiceAccount) return null;

  // GA4 (Google Analytics 4) Data API bağlantısı için hazırlık noktası.
  // GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY değeri newline düzeltmesi ile okunur, client'a sızdırılmaz.
  process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  return null;
}

type RawEventRow = { event_name: string; page_path: string | null; referrer_source: string; session_id: string; occurred_at: string };

const knownPageLabels = new Map(pageLabels);

function labelForPath(path: string) {
  return knownPageLabels.get(path) || (path === "/" ? "Ana sayfa" : path);
}

async function fetchFirstPartyAnalytics(range: AnalyticsRangeInput): Promise<{ summary: WebsiteAnalyticsSummary | null; events: WebsiteAnalyticsEvent[]; pages: WebsiteAnalyticsPage[]; sources: WebsiteAnalyticsSource[]; trend: DailyTrendPoint[]; error: string | null }> {
  if (!hasSupabaseConfig()) {
    return { summary: null, events: emptyEvents(), pages: emptyPages(), sources: emptySources(), trend: [], error: "Supabase yapılandırılmadı." };
  }
  const { start, end, todayStart, tomorrowStart } = resolveRange(range);
  try {
    const rows = await supabaseRest<RawEventRow[]>(
      `website_analytics_events?select=event_name,page_path,referrer_source,session_id,occurred_at&occurred_at=gte.${encodeURIComponent(start.toISOString())}&occurred_at=lt.${encodeURIComponent(end.toISOString())}&order=occurred_at.desc&limit=20000`
    );

    const pageViewRows = rows.filter((row) => row.event_name === "PageView");
    const todayPageViews = pageViewRows.filter((row) => {
      const at = new Date(row.occurred_at).getTime();
      return at >= todayStart.getTime() && at < tomorrowStart.getTime();
    }).length;
    const contacts = rows.filter((row) => row.event_name === "Contact").length;
    const leads = rows.filter((row) => row.event_name === "Lead").length;
    const ctaClicks = rows.filter((row) => row.event_name === "HK_CTA_Click").length;
    const conversionRate = pageViewRows.length > 0 ? Math.round((leads / pageViewRows.length) * 1000) / 10 : 0;

    const pageCounts = new Map<string, { pageViews: number; contacts: number; leads: number }>();
    for (const row of rows) {
      if (!row.page_path || !["PageView", "Contact", "Lead"].includes(row.event_name)) continue;
      const bucket = pageCounts.get(row.page_path) || { pageViews: 0, contacts: 0, leads: 0 };
      if (row.event_name === "PageView") bucket.pageViews += 1;
      if (row.event_name === "Contact") bucket.contacts += 1;
      if (row.event_name === "Lead") bucket.leads += 1;
      pageCounts.set(row.page_path, bucket);
    }
    const pages: WebsiteAnalyticsPage[] = [...pageCounts.entries()]
      .sort((a, b) => b[1].pageViews - a[1].pageViews)
      .slice(0, 8)
      .map(([path, counts]) => ({
        path,
        label: labelForPath(path),
        pageViews: counts.pageViews,
        contacts: counts.contacts,
        leads: counts.leads,
        conversionRate: counts.pageViews > 0 ? Math.round((counts.leads / counts.pageViews) * 1000) / 10 : 0
      }));
    const topPage = pages[0]?.path || "/";

    const eventTimestamps = new Map<string, string>();
    for (const row of rows) {
      if (!eventTimestamps.has(row.event_name)) eventTimestamps.set(row.event_name, row.occurred_at);
    }
    const events: WebsiteAnalyticsEvent[] = conversionEvents.map(([eventName, label]) => ({
      id: eventName,
      eventName,
      label,
      count: rows.filter((row) => row.event_name === eventName).length,
      timestamp: eventTimestamps.get(eventName) || null
    }));

    const sourceBuckets = new Map<string, { pageViews: number; leads: number; sessions: Set<string> }>();
    for (const row of pageViewRows) {
      const bucket = sourceBuckets.get(row.referrer_source) || { pageViews: 0, leads: 0, sessions: new Set<string>() };
      bucket.pageViews += 1;
      bucket.sessions.add(row.session_id);
      sourceBuckets.set(row.referrer_source, bucket);
    }
    for (const row of rows) {
      if (row.event_name !== "Lead") continue;
      const bucket = sourceBuckets.get(row.referrer_source);
      if (bucket) bucket.leads += 1;
    }
    const sources: WebsiteAnalyticsSource[] = ["Direct", "Organic", "Facebook / Instagram", "Google", "Referral"].map((source) => {
      const bucket = sourceBuckets.get(source);
      return {
        source,
        sessions: bucket?.sessions.size || 0,
        pageViews: bucket?.pageViews || 0,
        leads: bucket?.leads || 0,
        status: bucket && bucket.pageViews > 0 ? "hazir" : "bekliyor"
      };
    });

    const dayBuckets = new Map<string, number>();
    for (const row of pageViewRows) {
      const day = istanbulDateString(new Date(row.occurred_at));
      dayBuckets.set(day, (dayBuckets.get(day) || 0) + 1);
    }
    const trend: DailyTrendPoint[] = [...dayBuckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, pageViews]) => ({ date, pageViews }));

    const summary: WebsiteAnalyticsSummary = {
      todayPageViews,
      last7DaysPageViews: pageViewRows.length,
      contacts,
      leads,
      ctaClicks,
      conversionRate,
      topPage
    };

    return { summary, events, pages: pages.length ? pages : emptyPages(), sources, trend, error: null };
  } catch (error) {
    return { summary: null, events: emptyEvents(), pages: emptyPages(), sources: emptySources(), trend: [], error: getSafeSupabaseError(error).detail };
  }
}

async function fetchCustomerIntegrationSummary(): Promise<CustomerIntegrationSummary[]> {
  if (!hasSupabaseConfig()) return [];
  try {
    const [companies, integrations] = await Promise.all([
      supabaseRest<Array<Record<string, any>>>("companies?select=id,name,website&deleted_at=is.null&order=updated_at.desc&limit=100"),
      supabaseRest<Array<Record<string, any>>>("customer_integrations?select=*&order=updated_at.desc&limit=100").catch(() => [])
    ]);
    return companies.map((company) => {
      const integration = integrations.find((item) => item.company_id === company.id) || {};
      const metaReady = Boolean(integration.meta_pixel_id || integration.meta_dataset_id || integration.meta_business_id || integration.meta_ad_account_id);
      const googleReady = Boolean(integration.ga4_measurement_id || integration.ga4_property_id || integration.search_console_site_url || integration.google_ads_customer_id || integration.gtm_container_id);
      const behaviorReady = Boolean(integration.clarity_project_id || integration.hotjar_site_id);
      return {
        companyId: String(company.id || ""),
        companyName: String(company.name || "İsimsiz firma"),
        domain: String(integration.domain || integration.website_url || company.website || ""),
        setupProgress: Number(integration.setup_progress || 0),
        metaStatus: metaReady ? "ready" : "missing",
        googleStatus: googleReady ? "ready" : "missing",
        ga4Status: integration.ga4_measurement_id || integration.ga4_property_id ? "ready" : "missing",
        googleAdsStatus: integration.google_ads_customer_id ? "ready" : "missing",
        behaviorStatus: behaviorReady ? "ready" : "optional",
        lastCheckedAt: integration.last_checked_at || integration.updated_at || null
      };
    });
  } catch {
    return [];
  }
}

export async function getWebsiteAnalytics(range: AnalyticsRangeInput = { days: 7 }): Promise<WebsiteAnalyticsResponse> {
  const setup = getWebsiteAnalyticsSetup();
  const integrationStatus = getWebsiteAnalyticsIntegrationStatus();
  setup.metaPixelId = Boolean(await getGlobalMetaPixelId());
  const status = resolveStatus(setup);

  const [, , firstParty] = await Promise.all([
    fetchMetaAnalyticsIfConfigured(setup),
    fetchGa4AnalyticsIfConfigured(setup),
    fetchFirstPartyAnalytics(range)
  ]);

  const recommendations = [
    firstParty.error
      ? `Birinci taraf veri sorgulanamadı: ${firstParty.error}`
      : firstParty.summary && firstParty.summary.last7DaysPageViews === 0
        ? "Birinci taraf ölçüm çalışıyor ancak henüz kayıtlı ziyaret yok. Public siteye trafik geldikçe burada görünecek."
        : "Birinci taraf ölçüm (page view, contact, lead, CTA) gerçek verilerle çalışıyor.",
    setup.metaPixelId
      ? "Meta Pixel aktif görünüyor. API (uygulama programlama arayüzü) bağlantısı için META_ACCESS_TOKEN ve META_DATASET_ID eklenebilir."
      : "NEXT_PUBLIC_META_PIXEL_ID eksik. Public sayfa olayları Meta tarafına gönderilemez.",
    setup.gaMeasurementId
      ? "GA4 (Google Analytics 4) ölçüm kimliği hazır. Sunucu tarafı raporlama için Google servis hesabı bilgileri eklenebilir."
      : "NEXT_PUBLIC_GA_MEASUREMENT_ID eklenirse GA4 (Google Analytics 4) ölçüm altyapısı hazır olur."
  ];

  return {
    status,
    setup,
    integrationStatus,
    customerIntegrations: await fetchCustomerIntegrationSummary(),
    summary: firstParty.summary,
    events: firstParty.events,
    pages: firstParty.pages,
    sources: firstParty.sources,
    trend: firstParty.trend,
    firstPartyError: firstParty.error,
    recommendations,
    lastSyncedAt: firstParty.error ? null : new Date().toISOString()
  };
}
