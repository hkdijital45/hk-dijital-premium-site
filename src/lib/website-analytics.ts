import { getGlobalMetaPixelId } from "./meta-pixel-settings";

export type WebsiteAnalyticsStatus = "demo" | "live" | "partial";

export type WebsiteAnalyticsSetup = {
  metaPixelId: boolean;
  metaDatasetId: boolean;
  metaAccessToken: boolean;
  gaMeasurementId: boolean;
  gaPropertyId: boolean;
  gaServiceAccount: boolean;
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
  summary: WebsiteAnalyticsSummary;
  events: WebsiteAnalyticsEvent[];
  pages: WebsiteAnalyticsPage[];
  sources: WebsiteAnalyticsSource[];
  recommendations: string[];
  lastSyncedAt: string | null;
};

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
    gaPropertyId: Boolean(process.env.GOOGLE_ANALYTICS_PROPERTY_ID),
    gaServiceAccount: Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && serviceAccountPrivateKey)
  };
}

function resolveStatus(setup: WebsiteAnalyticsSetup): WebsiteAnalyticsStatus {
  const metaReady = setup.metaDatasetId && setup.metaAccessToken;
  const gaReady = setup.gaPropertyId && setup.gaServiceAccount;

  if (metaReady && gaReady) return "live";
  if (setup.metaPixelId || setup.gaMeasurementId || metaReady || gaReady) return "partial";
  return "demo";
}

function emptySummary(): WebsiteAnalyticsSummary {
  return {
    todayPageViews: 0,
    last7DaysPageViews: 0,
    contacts: 0,
    leads: 0,
    ctaClicks: 0,
    conversionRate: 0,
    topPage: "/"
  };
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

export async function getWebsiteAnalytics(): Promise<WebsiteAnalyticsResponse> {
  const setup = getWebsiteAnalyticsSetup();
  setup.metaPixelId = Boolean(await getGlobalMetaPixelId());
  const status = resolveStatus(setup);

  await Promise.all([
    fetchMetaAnalyticsIfConfigured(setup),
    fetchGa4AnalyticsIfConfigured(setup)
  ]);

  const recommendations = [
    setup.metaPixelId
      ? "Meta Pixel aktif görünüyor. API (uygulama programlama arayüzü) bağlantısı için META_ACCESS_TOKEN ve META_DATASET_ID eklenebilir."
      : "NEXT_PUBLIC_META_PIXEL_ID eksik. Public sayfa olayları Meta tarafına gönderilemez.",
    setup.gaMeasurementId
      ? "GA4 (Google Analytics 4) ölçüm kimliği hazır. Sunucu tarafı raporlama için Google servis hesabı bilgileri eklenebilir."
      : "NEXT_PUBLIC_GA_MEASUREMENT_ID eklenirse GA4 (Google Analytics 4) ölçüm altyapısı hazır olur.",
    "Meta ve GA4 canlı veri bağlantıları tamamlandığında bu merkez otomatik olarak gerçek olayları gösterecek şekilde tasarlandı."
  ];

  return {
    status,
    setup,
    summary: emptySummary(),
    events: emptyEvents(),
    pages: emptyPages(),
    sources: emptySources(),
    recommendations,
    lastSyncedAt: null
  };
}
