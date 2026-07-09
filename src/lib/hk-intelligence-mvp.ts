/* eslint-disable @typescript-eslint/no-explicit-any */

export type IntelligenceSourceStatus = "connected" | "waiting_connection" | "permission_required" | "error" | "stale";
export type IntelligenceReportStatus = "healthy" | "warning" | "critical" | "waiting_data";

export type NormalizedSource = {
  source: "meta" | "google_ads" | "ga4" | "search_console" | "google_business_profile";
  label: string;
  status: IntelligenceSourceStatus;
  message: string;
  metrics: Record<string, any>;
  warnings: string[];
  opportunities: string[];
  nextActions: string[];
  freshness: string;
};

type BuildReportInput = {
  customerId?: string;
  company?: Record<string, any>;
  integration?: Record<string, any>;
  dateRange?: string;
};

const WAITING_MESSAGE = "Bu kaynak için bağlantı bekleniyor. Bağlantı tamamlandığında analiz otomatik oluşur.";
const META_REVIEW_MESSAGE = "Meta reklam verileri için ads_read izni ve App Review gerekir. Şimdilik manuel reklam hesabı bağlantısı kullanılabilir.";
const GOOGLE_STATUS_MESSAGE: Record<string, string> = {
  waiting_connection: "Bağlantı bekleniyor.",
  permission_required: "Yetki gerekiyor.",
  api_not_enabled: "Google Cloud’da ilgili API etkinleştirilmelidir.",
  error: "Veri alınırken hata oluştu."
};

function asNumber(value: any, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function cleanText(value: any) {
  return typeof value === "string" ? value.trim() : "";
}

function source(
  data: Omit<NormalizedSource, "warnings" | "opportunities" | "nextActions" | "freshness" | "metrics"> & {
    metrics?: Record<string, any>;
    warnings?: string[];
    opportunities?: string[];
    nextActions?: string[];
    freshness?: string;
  }
): NormalizedSource {
  return {
    ...data,
    metrics: data.metrics || {},
    warnings: data.warnings || [],
    opportunities: data.opportunities || [],
    nextActions: data.nextActions || [],
    freshness: data.freshness || "Veri bekleniyor"
  };
}

function hasMeaningfulValue(input: Record<string, any> | undefined, keys: string[]) {
  if (!input) return false;
  return keys.some((key) => Boolean(cleanText(input[key]) || asNumber(input[key], 0)));
}

function integrationAssets(integration?: Record<string, any>) {
  return Array.isArray(integration?.integration_assets) ? integration?.integration_assets : [];
}

function findAsset(integration: Record<string, any> | undefined, predicate: (asset: any) => boolean) {
  return integrationAssets(integration).find(predicate);
}

export function normalizeGoogleAds(input?: Record<string, any>): NormalizedSource {
  const connected = Boolean(input?.google_ads_customer_id || input?.provider_account_id || input?.asset_id || input?.account_id || input?.connected);
  const sourceStatus = input?.googleDataStatuses?.googleAds || input?.dataStatus;
  if (sourceStatus && sourceStatus.status !== "connected") {
    return source({
      source: "google_ads",
      label: "Google Ads",
      status: sourceStatus.status === "api_not_enabled" ? "error" : sourceStatus.status,
      message: sourceStatus.message || GOOGLE_STATUS_MESSAGE[sourceStatus.status] || WAITING_MESSAGE
    });
  }
  if (!connected) {
    return source({
      source: "google_ads",
      label: "Google Ads",
      status: "waiting_connection",
      message: WAITING_MESSAGE
    });
  }

  const metricInput = input?.googleAdsMetrics || input;
  const spend = asNumber(metricInput?.spend || metricInput?.cost || metricInput?.spend_amount);
  const impressions = asNumber(metricInput?.impressions);
  const clicks = asNumber(metricInput?.clicks);
  const ctr = asNumber(metricInput?.ctr, impressions ? (clicks / impressions) * 100 : 0);
  const cpc = asNumber(metricInput?.cpc, clicks ? spend / clicks : 0);
  const cpm = asNumber(metricInput?.cpm, impressions ? (spend / impressions) * 1000 : 0);
  const conversions = asNumber(metricInput?.conversions || metricInput?.results);
  const warnings = [
    ctr > 0 && ctr < 1 ? "CTR (Tıklama Oranı) düşük görünüyor." : "",
    cpc > 25 ? "CPC (Tıklama Başına Maliyet) yüksek." : "",
    connected && !hasMeaningfulValue(metricInput, ["spend", "impressions", "clicks", "conversions"]) ? "Google Ads hesabı bağlı, canlı metrik bekleniyor." : ""
  ].filter(Boolean);

  return source({
    source: "google_ads",
    label: "Google Ads",
    status: "connected",
    message: warnings.length ? "Google Ads verisi aksiyon gerektiriyor." : "Google Ads bağlantısı analiz için hazır.",
    metrics: {
      spend,
      impressions,
      clicks,
      ctr,
      cpc,
      cpm,
      conversions,
      conversionValue: asNumber(metricInput?.conversionValue || metricInput?.conversion_value),
      campaignCount: asNumber(metricInput?.campaignCount || metricInput?.campaign_count)
    },
    warnings,
    opportunities: ctr > 0 && ctr < 1 ? ["Kreatif ilk saniye/hook varyasyonu test edilebilir."] : [],
    nextActions: warnings.length ? ["Anahtar kelime, hedefleme ve kreatif kırılımını kontrol et."] : ["Haftalık kampanya kırılımını izle."],
    freshness: input?.last_synced_at || input?.updated_at || "Canlı metrik bekleniyor"
  });
}

export function normalizeGA4(input?: Record<string, any>): NormalizedSource {
  const connected = Boolean(input?.ga4_property_id || input?.ga4_measurement_id || input?.provider_account_id || input?.asset_id || input?.connected);
  const sourceStatus = input?.googleDataStatuses?.ga4 || input?.dataStatus;
  if (sourceStatus && sourceStatus.status !== "connected") {
    return source({ source: "ga4", label: "GA4", status: sourceStatus.status === "api_not_enabled" ? "error" : sourceStatus.status, message: sourceStatus.message || GOOGLE_STATUS_MESSAGE[sourceStatus.status] || WAITING_MESSAGE });
  }
  if (!connected) {
    return source({ source: "ga4", label: "GA4", status: "waiting_connection", message: WAITING_MESSAGE });
  }

  const metricInput = input?.ga4Metrics || input;
  const engagementRate = asNumber(metricInput?.engagementRate || metricInput?.engagement_rate);
  const warnings = [
    engagementRate > 0 && engagementRate < 35 ? "GA4 etkileşim oranı düşük." : "",
    connected && !hasMeaningfulValue(metricInput, ["users", "sessions", "events", "conversions"]) ? "GA4 bağlantısı var, ölçüm verisi bekleniyor." : ""
  ].filter(Boolean);

  return source({
    source: "ga4",
    label: "GA4",
    status: "connected",
    message: warnings.length ? "Site davranışı kontrol edilmeli." : "GA4 bağlantısı analiz için hazır.",
    metrics: {
      users: asNumber(metricInput?.users),
      sessions: asNumber(metricInput?.sessions),
      engagedSessions: asNumber(metricInput?.engagedSessions || metricInput?.engaged_sessions),
      engagementRate,
      conversions: asNumber(metricInput?.conversions),
      events: asNumber(metricInput?.events),
      topChannels: Array.isArray(metricInput?.topChannels) ? metricInput.topChannels : [],
      topLandingPages: Array.isArray(metricInput?.topLandingPages) ? metricInput.topLandingPages : []
    },
    warnings,
    opportunities: engagementRate > 0 && engagementRate < 35 ? ["İniş sayfası mesajı ve form/WhatsApp CTA akışı sadeleştirilebilir."] : [],
    nextActions: warnings.length ? ["Landing page hızını, CTA görünürlüğünü ve form adımlarını kontrol et."] : ["Trafik kaynaklarını haftalık karşılaştır."],
    freshness: input?.last_synced_at || input?.updated_at || "Canlı metrik bekleniyor"
  });
}

export function normalizeSearchConsole(input?: Record<string, any>): NormalizedSource {
  const connected = Boolean(input?.search_console_site_url || input?.site_url || input?.provider_account_id || input?.asset_id || input?.connected);
  const sourceStatus = input?.googleDataStatuses?.searchConsole || input?.dataStatus;
  if (sourceStatus && sourceStatus.status !== "connected") {
    return source({ source: "search_console", label: "Search Console", status: sourceStatus.status === "api_not_enabled" ? "error" : sourceStatus.status, message: sourceStatus.message || GOOGLE_STATUS_MESSAGE[sourceStatus.status] || WAITING_MESSAGE });
  }
  if (!connected) {
    return source({ source: "search_console", label: "Search Console", status: "waiting_connection", message: WAITING_MESSAGE });
  }

  const metricInput = input?.searchConsoleMetrics || input;
  const averagePosition = asNumber(metricInput?.averagePosition || metricInput?.average_position);
  const opportunity = averagePosition >= 4 && averagePosition <= 15;

  return source({
    source: "search_console",
    label: "Search Console",
    status: "connected",
    message: opportunity ? "SEO büyüme fırsatı var." : "Search Console bağlantısı analiz için hazır.",
    metrics: {
      clicks: asNumber(metricInput?.clicks),
      impressions: asNumber(metricInput?.impressions),
      ctr: asNumber(metricInput?.ctr),
      averagePosition,
      topQueries: Array.isArray(metricInput?.topQueries) ? metricInput.topQueries : [],
      topPages: Array.isArray(metricInput?.topPages) ? metricInput.topPages : []
    },
    warnings: connected && !hasMeaningfulValue(metricInput, ["clicks", "impressions", "averagePosition"]) ? ["Search Console bağlantısı var, arama verisi bekleniyor."] : [],
    opportunities: opportunity ? ["4-15 pozisyon arası sorgular için içerik ve başlık optimizasyonu yapılabilir."] : [],
    nextActions: opportunity ? ["Fırsat sorgularını içerik planına al."] : ["Organik tıklama eğilimini izle."],
    freshness: input?.last_synced_at || input?.updated_at || "Canlı metrik bekleniyor"
  });
}

export function normalizeGoogleBusinessProfile(input?: Record<string, any>): NormalizedSource {
  const connected = Boolean(input?.google_business_profile_id || input?.business_profile_id || input?.provider_account_id || input?.asset_id || input?.connected);
  const sourceStatus = input?.googleDataStatuses?.businessProfile || input?.dataStatus;
  if (sourceStatus && sourceStatus.status !== "connected") {
    return source({ source: "google_business_profile", label: "Google Business Profile", status: sourceStatus.status === "api_not_enabled" ? "error" : sourceStatus.status, message: sourceStatus.message || GOOGLE_STATUS_MESSAGE[sourceStatus.status] || WAITING_MESSAGE });
  }
  if (!connected) {
    return source({ source: "google_business_profile", label: "Google Business Profile", status: "waiting_connection", message: WAITING_MESSAGE });
  }

  const metricInput = input?.googleBusinessMetrics || input;
  const averageRating = asNumber(metricInput?.averageRating || metricInput?.average_rating);
  const reviewCount = asNumber(metricInput?.reviewCount || metricInput?.review_count);
  const ratingWarning = averageRating > 0 && averageRating < 4.2;

  return source({
    source: "google_business_profile",
    label: "Google Business Profile",
    status: "connected",
    message: ratingWarning ? "Yerel görünürlük ve yorum stratejisi kontrol edilmeli." : "Google işletme profili analiz için hazır.",
    metrics: {
      profileViews: asNumber(metricInput?.profileViews || metricInput?.profile_views),
      searches: asNumber(metricInput?.searches),
      websiteClicks: asNumber(metricInput?.websiteClicks || metricInput?.website_clicks),
      phoneClicks: asNumber(metricInput?.phoneClicks || metricInput?.phone_clicks),
      directionRequests: asNumber(metricInput?.directionRequests || metricInput?.direction_requests),
      reviewCount,
      averageRating
    },
    warnings: ratingWarning ? ["Google yorum puanı sektör beklentisinin altında."] : [],
    opportunities: reviewCount < 20 ? ["Düzenli yorum toplama akışı kurulabilir."] : [],
    nextActions: ratingWarning || reviewCount < 20 ? ["Yorum isteme mesajı ve profil içerik güncelleme planı hazırla."] : ["Yerel arama performansını takip et."],
    freshness: input?.last_synced_at || input?.updated_at || "Canlı metrik bekleniyor"
  });
}

export function normalizeMetaSource(integration?: Record<string, any>): NormalizedSource {
  const metaAsset = findAsset(integration, (asset) => {
    const platform = String(asset?.platform || asset?.provider || "").toLowerCase();
    const type = String(asset?.asset_type || asset?.account_type || "").toLowerCase();
    return platform.includes("meta") || type.includes("meta") || type.includes("ad_account");
  });
  const hasBasicLogin = Boolean(integration?.provider === "meta" || integration?.platform === "meta" || integration?.meta_user_id || integration?.provider_account_id);
  if (!metaAsset && !hasBasicLogin) {
    return source({
      source: "meta",
      label: "Meta",
      status: "waiting_connection",
      message: "Meta bağlantısı bekleniyor. Facebook Login tamamlanabilir; reklam verileri için App Review gerekir.",
      nextActions: ["Meta temel bağlantıyı tamamla veya manuel reklam hesabı ID ekle."]
    });
  }

  return source({
    source: "meta",
    label: "Meta",
    status: "permission_required",
    message: META_REVIEW_MESSAGE,
    metrics: {
      accountId: metaAsset?.asset_id || metaAsset?.account_id || integration?.meta_ad_account_id || "",
      connectionMethod: metaAsset?.source || metaAsset?.connection_method || integration?.connection_method || "manual_or_basic_login"
    },
    warnings: ["Meta reklam verileri App Review/ads_read onayı bekliyor."],
    opportunities: ["Manuel reklam hesabı ID ile müşteri varlığı HK Intelligence içinde takip edilebilir."],
    nextActions: ["ads_read onayı gelene kadar Google Intelligence ve manuel Meta varlığıyla ilerle."],
    freshness: metaAsset?.updated_at || integration?.last_synced_at || integration?.updated_at || "API erişimi bekleniyor"
  });
}

export function collectCustomerSources(company: Record<string, any> = {}, integration: Record<string, any> = {}) {
  const googleAdsAsset = findAsset(integration, (asset) => String(asset?.platform || asset?.account_type || asset?.asset_type || "").toLowerCase().includes("google_ads"));
  const ga4Asset = findAsset(integration, (asset) => /ga4|analytics/.test(String(asset?.platform || asset?.account_type || asset?.asset_type || "").toLowerCase()));
  const searchAsset = findAsset(integration, (asset) => String(asset?.platform || asset?.account_type || asset?.asset_type || "").toLowerCase().includes("search_console"));
  const businessAsset = findAsset(integration, (asset) => /business_profile|google_business|gbp/.test(String(asset?.platform || asset?.account_type || asset?.asset_type || "").toLowerCase()));

  return [
    normalizeMetaSource(integration),
    normalizeGoogleAds({ ...company, ...integration, ...googleAdsAsset }),
    normalizeGA4({ ...company, ...integration, ...ga4Asset }),
    normalizeSearchConsole({ ...company, ...integration, ...searchAsset }),
    normalizeGoogleBusinessProfile({ ...company, ...integration, ...businessAsset })
  ];
}

export function buildHKIntelligenceReport(input: BuildReportInput = {}) {
  const sources = collectCustomerSources(input.company, input.integration);
  const connectedSources = sources.filter((item) => item.status === "connected");
  const permissionSources = sources.filter((item) => item.status === "permission_required");
  const waitingSources = sources.filter((item) => item.status === "waiting_connection");

  if (!connectedSources.length && !permissionSources.length) {
    return {
      customerId: input.customerId || input.company?.id || null,
      customerName: input.company?.name || input.company?.company_name || input.company?.title || "Müşteri",
      dateRange: input.dateRange || "last_30d",
      overallScore: null,
      status: "waiting_data" as IntelligenceReportStatus,
      executiveSummary: "Analiz için bağlantı bekleniyor.",
      criticalIssues: [],
      opportunities: [],
      nextActions: ["Google Ads, GA4, Search Console veya Google Business Profile bağlantısını tamamla."],
      sevenDayPlan: [
        "1. gün: Müşteri profilindeki Google ve Meta bağlantı durumunu kontrol et.",
        "2. gün: GA4 ve Search Console varlık seçimini tamamla.",
        "3. gün: Google Ads Customer ID ve Developer Token gereksinimini doğrula.",
        "4. gün: Meta için manuel reklam hesabı ID veya App Review durumunu not al.",
        "5. gün: Rapor ve görev kayıtlarında müşteri görünürlüğünü kontrol et.",
        "6. gün: Eksik bilgi veya yetki yenileme gerekiyorsa müşteri uyarısını gönder.",
        "7. gün: Bağlantı tamamlanan kaynaklarla HK Intelligence analizini yenile."
      ],
      sourceHealth: sources.map(({ label, status, message }) => ({ label, status, message })),
      missingConnections: waitingSources.map((item) => item.label),
      dataFreshness: sources.map(({ label, freshness }) => ({ label, freshness }))
    };
  }

  const warnings = sources.flatMap((item) => item.warnings.map((text) => ({ source: item.label, text })));
  const opportunities = sources.flatMap((item) => item.opportunities.map((text) => ({ source: item.label, text })));
  const nextActions = sources.flatMap((item) => item.nextActions.map((text) => ({ source: item.label, text })));
  const scorePenalty = warnings.length * 8 + permissionSources.length * 6 + waitingSources.length * 5;
  const overallScore = Math.max(35, Math.min(92, 86 - scorePenalty + connectedSources.length * 4));
  const status: IntelligenceReportStatus = overallScore < 55 ? "critical" : overallScore < 75 ? "warning" : "healthy";

  return {
    customerId: input.customerId || input.company?.id || null,
    customerName: input.company?.name || input.company?.company_name || input.company?.title || "Müşteri",
    dateRange: input.dateRange || "last_30d",
    overallScore,
    status,
    executiveSummary: `${connectedSources.length} kaynak analiz için hazır. ${waitingSources.length} kaynak bağlantı bekliyor. ${permissionSources.length} kaynak izin veya App Review bekliyor.`,
    criticalIssues: warnings,
    opportunities,
    nextActions: nextActions.length ? nextActions.slice(0, 8) : [{ source: "HK Intelligence", text: "Haftalık performans kontrolünü sürdür." }],
    sevenDayPlan: [
      "1. gün: Kritik ölçüm ve izin sorunlarını kapat.",
      "2. gün: Google Ads / GA4 / Search Console metriklerini müşteri hedefiyle karşılaştır.",
      "3. gün: CTR, CPC ve dönüşüm sinyaline göre Reklam Doktoru reçetesini çıkar.",
      "4. gün: Landing page, WhatsApp, form ve telefon funnel adımlarını kontrol et.",
      "5. gün: Fırsat sorguları ve kreatif önerilerini görev planına aktar.",
      "6. gün: Rapor özetini müşteri dostu dile sadeleştir.",
      "7. gün: Sonuçları yeniden değerlendirip sonraki haftanın optimizasyon görevlerini aç."
    ],
    sourceHealth: sources.map(({ label, status: sourceStatus, message }) => ({ label, status: sourceStatus, message })),
    missingConnections: waitingSources.map((item) => item.label),
    dataFreshness: sources.map(({ label, freshness }) => ({ label, freshness }))
  };
}

export function diagnoseAdPerformance(input: Record<string, any> = {}) {
  const platform = cleanText(input.platform) || "google_ads";
  const ctr = asNumber(input.ctr);
  const cpc = asNumber(input.cpc);
  const cpa = asNumber(input.cpa);
  const roas = asNumber(input.roas);
  const hasTracking = Boolean(input.hasTracking || input.pixel || input.ga4 || input.conversions);
  const problems = [
    ctr > 0 && ctr < 1 ? "Tıklama oranı düşük." : "",
    cpc > 25 ? "Tıklama maliyeti yüksek." : "",
    cpa > 700 ? "Dönüşüm maliyeti yüksek." : "",
    roas > 0 && roas < 2 ? "Reklam getiri oranı zayıf." : "",
    !hasTracking ? "Dönüşüm ölçümü eksik veya doğrulanmamış." : ""
  ].filter(Boolean);

  return {
    platform,
    dateRange: input.dateRange || "last_30d",
    diagnosis: problems.length ? problems.join(" ") : "Veri sınırlı; temel kampanya sağlığı izlenebilir durumda.",
    severity: problems.length >= 3 ? "critical" : problems.length ? "warning" : "waiting_data",
    likelyCause: !hasTracking ? "Pixel/GA4 veya dönüşüm aksiyonu eksik olabilir." : "Kreatif, hedefleme, bütçe veya funnel sürtünmesi performansı etkiliyor olabilir.",
    recommendedFixes: problems.length ? [
      "Ölçüm kurulumunu doğrula.",
      "Kreatif hook ve teklif mesajını yenile.",
      "Hedefleme/anahtar kelime kırılımlarını ayrıştır.",
      "Bütçeyi en iyi sinyal gelen kampanyalara kademeli kaydır."
    ] : ["Bağlantıları tamamla ve canlı veri geldikçe analizi yenile."],
    creativeIdeas: [
      "İlk 3 saniyede net problem/çözüm mesajı.",
      "WhatsApp veya teklif odaklı güçlü CTA.",
      "Müşteri yorumu veya kanıt kartı kullanılan varyasyon."
    ],
    budgetSuggestion: cpa > 700 ? "Bütçe artırmadan önce dönüşüm ölçümü ve hedefleme netleştirilmeli." : "Veri geldikçe bütçe küçük artışlarla test edilebilir.",
    trackingIssues: hasTracking ? [] : ["GA4, Pixel veya dönüşüm aksiyonu doğrulanmalı."],
    next7DaysPlan: [
      "1. gün: Ölçüm ve dönüşüm aksiyonlarını doğrula.",
      "2-3. gün: Düşük CTR / yüksek CPC üreten kampanya kırılımlarını ayır.",
      "4. gün: Yeni kreatif hook ve CTA varyasyonu hazırla.",
      "5-6. gün: Bütçeyi sinyal veren kampanyalara kademeli aktar.",
      "7. gün: Sonuçları HK Intelligence raporunda tekrar değerlendir."
    ]
  };
}

export function buildCeoOverview(companies: Record<string, any>[] = [], integrations: Record<string, any>[] = []) {
  const reports = companies.map((company) => {
    const integration = integrations.find((item) => item.company_id === company.id || item.customer_id === company.id) || {};
    return buildHKIntelligenceReport({ customerId: company.id, company, integration });
  });
  const waitingConnection = reports.filter((report) => report.status === "waiting_data" || report.missingConnections.length).length;
  const critical = reports.filter((report) => report.status === "critical").length;
  const opportunities = reports.reduce((sum, report) => sum + report.opportunities.length, 0);
  const actions = reports.reduce((sum, report) => sum + report.nextActions.length, 0);
  const metaReviewWaiting = reports.filter((report) => report.sourceHealth.some((item) => item.label === "Meta" && item.status === "permission_required")).length;
  const priority = [
    critical ? `${critical} müşteride kritik tracking veya performans sorunu var.` : "",
    waitingConnection ? `${waitingConnection} müşteride veri bağlantısı eksik veya beklemede.` : "",
    opportunities ? `${opportunities} büyüme fırsatı bulundu.` : "",
    metaReviewWaiting ? `${metaReviewWaiting} müşteride Meta App Review/ads_read bekleniyor.` : "",
    !reports.length ? "Henüz müşteri verisi yok; bağlantılar tamamlandığında CEO özeti oluşur." : ""
  ].filter(Boolean);
  const connectionMissingCustomers = reports
    .filter((report) => report.status === "waiting_data" || report.missingConnections.length)
    .slice(0, 8)
    .map((report) => ({ customerId: report.customerId, name: report.customerName, missingConnections: report.missingConnections }));
  const dataReadyCustomers = reports
    .filter((report) => report.sourceHealth.some((item) => item.status === "connected"))
    .slice(0, 8)
    .map((report) => ({ customerId: report.customerId, name: report.customerName, readySources: report.sourceHealth.filter((item) => item.status === "connected").map((item) => item.label) }));
  const criticalAlerts = reports
    .flatMap((report) => report.criticalIssues.map((issue) => ({ customerId: report.customerId, name: report.customerName, ...issue })))
    .slice(0, 8);
  const highOpportunityCustomers = reports
    .filter((report) => report.opportunities.length)
    .sort((a, b) => b.opportunities.length - a.opportunities.length)
    .slice(0, 8)
    .map((report) => ({ customerId: report.customerId, name: report.customerName, opportunityCount: report.opportunities.length, opportunities: report.opportunities.slice(0, 3) }));
  const topActions = reports
    .flatMap((report) => report.nextActions.map((action) => ({ customerId: report.customerId, name: report.customerName, ...action })))
    .slice(0, 5);

  return {
    totalCustomers: companies.length,
    criticalCustomers: critical,
    waitingConnectionCustomers: waitingConnection,
    opportunityCustomers: reports.filter((report) => report.opportunities.length).length,
    recommendedActionCount: actions,
    metaAppReviewWaitingCustomers: metaReviewWaiting,
    priorityList: priority,
    connectionMissingCustomers,
    dataReadyCustomers,
    criticalAlerts,
    highOpportunityCustomers,
    topActions,
    reports
  };
}
