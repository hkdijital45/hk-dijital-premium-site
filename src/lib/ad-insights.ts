/* eslint-disable @typescript-eslint/no-explicit-any */
import { generateAiText } from "@/lib/ai-provider";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

export type AdInsightRange = "today" | "last_7d" | "last_14d" | "last_30d" | "this_month" | "last_month" | "custom";
export type AdInsightPlatform = "all" | "meta" | "google" | "instagram" | "facebook" | "website";

export function adInsightDateRange(range: AdInsightRange = "last_30d", customFrom = "", customTo = "") {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const start = new Date(now);
  if (range === "custom" && customFrom && customTo) return { from: customFrom, to: customTo, label: `${customFrom} - ${customTo}` };
  if (range === "today") return { from: today, to: today, label: "Bugün" };
  if (range === "last_7d") start.setDate(now.getDate() - 7);
  else if (range === "last_14d") start.setDate(now.getDate() - 14);
  else if (range === "this_month") start.setDate(1);
  else if (range === "last_month") {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
    const to = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
    return { from, to, label: "Geçen Ay" };
  } else start.setDate(now.getDate() - 30);
  return { from: start.toISOString().slice(0, 10), to: today, label: range === "last_7d" ? "Son 7 Gün" : range === "last_14d" ? "Son 14 Gün" : range === "this_month" ? "Bu Ay" : "Son 30 Gün" };
}

function sum(rows: any[], key: string) {
  return rows.reduce((total, row) => total + Number(row[key] || row.raw_data?.[key] || 0), 0);
}

function avg(rows: any[], key: string) {
  const values = rows.map((row) => Number(row[key] || 0)).filter(Number.isFinite);
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function summarizeRows(rows: any[]) {
  const impressions = sum(rows, "impressions");
  const reach = sum(rows, "reach");
  const clicks = sum(rows, "clicks");
  const spend = sum(rows, "spend") || sum(rows, "spent");
  const leads = sum(rows, "leads");
  const messages = sum(rows, "messages");
  const conversions = sum(rows, "conversions");
  const purchaseValue = sum(rows, "purchase_value");
  return {
    spend,
    impressions,
    reach,
    clicks,
    ctr: impressions ? (clicks / impressions) * 100 : avg(rows, "ctr"),
    cpc: clicks ? spend / clicks : avg(rows, "cpc"),
    cpm: impressions ? (spend / impressions) * 1000 : avg(rows, "cpm"),
    messages,
    leads,
    conversions,
    frequency: reach ? impressions / reach : 0,
    roas: spend ? purchaseValue / spend : avg(rows, "roas")
  };
}

function previousPeriod(dateRange: { from: string; to: string }) {
  const from = new Date(dateRange.from);
  const to = new Date(dateRange.to);
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1);
  const previousTo = new Date(from);
  previousTo.setDate(from.getDate() - 1);
  const previousFrom = new Date(previousTo);
  previousFrom.setDate(previousTo.getDate() - days + 1);
  return { from: previousFrom.toISOString().slice(0, 10), to: previousTo.toISOString().slice(0, 10) };
}

function change(current = 0, previous = 0) {
  if (!previous && !current) return 0;
  if (!previous) return 100;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function weeklyChanges(current: any, previous: any) {
  return Object.fromEntries(["spend", "impressions", "clicks", "ctr", "cpc", "cpm", "leads", "messages"].map((key) => [key, change(current[key], previous[key])]));
}

function adScore(row: any) {
  const spend = Number(row.spend || row.spent || 0);
  const ctr = Number(row.ctr || 0);
  const cpc = Number(row.cpc || 0);
  const leads = Number(row.leads || row.results || row.conversions || 0);
  return ctr * 10 + leads * 4 - cpc * 0.4 - spend * 0.01;
}

function pickAd(rows: any[], direction: "best" | "worst") {
  const scored = rows.map((row) => ({
    id: row.meta_ad_id || row.meta_campaign_id || row.campaign_id || row.id,
    name: row.ad_name || row.campaign_name || row.name || "Reklam",
    spend: Number(row.spend || row.spent || 0),
    ctr: Number(row.ctr || 0),
    cpc: Number(row.cpc || 0),
    leads: Number(row.leads || row.results || row.conversions || 0),
    creative_thumbnail_url: row.creative_thumbnail_url || row.raw_data?.creative_thumbnail_url || "",
    creative_media_url: row.creative_media_url || row.raw_data?.creative_media_url || "",
    ad_text: row.ad_text || row.headline || row.description || "",
    score: adScore(row)
  })).filter((row) => row.id || row.name);
  scored.sort((a, b) => direction === "best" ? b.score - a.score : a.score - b.score);
  return scored[0] || null;
}

function estimateWastedBudget(rows: any[], metrics: any) {
  if (!rows.length || !Number(metrics.spend || 0)) return 0;
  const weakSpend = rows
    .filter((row) => Number(row.ctr || 0) < 0.7 || Number(row.cpc || 0) > Math.max(30, Number(metrics.cpc || 0) * 1.5))
    .reduce((total, row) => total + Number(row.spend || row.spent || 0), 0);
  return Number(weakSpend.toFixed(2));
}

function recommendations(metrics: any, weeklyChange: any) {
  const items = [];
  if (weeklyChange.ctr < -10) items.push("CTR düşüyor; en düşük tıklama oranlı kreatifleri yenileyin.");
  if (weeklyChange.cpc > 15) items.push("CPC artıyor; hedef kitle ve teklif stratejisini daraltarak test edin.");
  if (weeklyChange.cpm > 20) items.push("CPM yükseliyor; yerleşim ve hedef kitle kırılımlarını ayrı test edin.");
  if (!metrics.leads && !metrics.messages) items.push("Lead/mesaj sinyali yok; çağrı metni ve dönüşüm akışını kontrol edin.");
  if (metrics.frequency > 4) items.push("Frekans yüksek; kreatif yorgunluğu riskine karşı yeni varyasyon hazırlayın.");
  if (!items.length) items.push("Performans stabil; güçlü kampanyaları 3 gün daha izleyip kontrollü bütçe artışı değerlendirin.");
  return items;
}

function scoreFromMetrics(metrics: any) {
  let score = 50;
  if (metrics.ctr >= 2) score += 15;
  else if (metrics.ctr < 0.7) score -= 15;
  if (metrics.cpc && metrics.cpc <= 10) score += 10;
  else if (metrics.cpc > 30) score -= 10;
  if (metrics.cpm && metrics.cpm <= 120) score += 8;
  else if (metrics.cpm > 250) score -= 8;
  if (metrics.leads || metrics.messages || metrics.conversions) score += 12;
  if (metrics.frequency > 4) score -= 10;
  if (metrics.roas >= 2) score += 15;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function healthLabel(score: number) {
  if (score >= 80) return "Çok iyi";
  if (score >= 60) return "İyileştirilebilir";
  if (score >= 40) return "Riskli";
  return "Kritik";
}

export function buildFallbackAnalysis(companyName: string, metrics: any, healthScore: number) {
  const ctrText = metrics.ctr >= 2 ? "tıklama oranı güçlü" : "tıklama oranı iyileştirilmeli";
  const costText = metrics.cpc > 30 ? "tıklama maliyeti yüksek görünüyor" : "tıklama maliyeti kontrol altında";
  return {
    admin: `Genel Durum: ${companyName} için reklam sağlık skoru ${healthScore}/100 (${healthLabel(healthScore)}). ${ctrText}; ${costText}.\n\nGüçlü Yönler: Erişim, gösterim ve tıklama verileri kampanya görünürlüğünü değerlendirmek için yeterli sinyal sağlıyor.\n\nZayıf Yönler: Lead, mesaj veya dönüşüm verisi düşükse teklif ve kreatif çağrıları tekrar incelenmeli.\n\nRiskler: Frekans yükselirse kreatif yorgunluğu oluşabilir. CPC yükselirse hedef kitle ve teklif stratejisi gözden geçirilmeli.\n\nBütçe Yorumu: Bütçe artışı yalnızca düşük CPC ve anlamlı lead/mesaj sinyali olan kampanyalara yapılmalı.\n\nBugün Yapılacaklar: En yüksek CTR üreten kampanyayı kontrol edin, düşük performanslı kreatifleri durdurun ve mesaj/lead odaklı yeni varyasyon hazırlayın.\n\n7 Günlük Aksiyon Planı: 1) Düşük CTR kreatifleri yenile. 2) En iyi hedef kitleyi çoğalt. 3) Lead maliyetini günlük takip et. 4) Müşteriye sade performans özeti gönder.`,
    customer: `Merhaba, reklam performansınızın sade özetini paylaşmak isteriz. Bu dönemde toplam ${Number(metrics.spend || 0).toLocaleString("tr-TR")} TL harcama ile ${Number(metrics.reach || 0).toLocaleString("tr-TR")} kişiye erişildi ve ${Number(metrics.clicks || 0).toLocaleString("tr-TR")} tıklama alındı. Performans ${healthLabel(healthScore).toLocaleLowerCase("tr")} seviyede. Önümüzdeki günlerde daha iyi sonuç için güçlü kreatiflere ağırlık verip düşük performanslı reklamları azaltmayı öneriyoruz.`
  };
}

export async function getAdInsightsData({
  companyId,
  range = "last_30d",
  platform = "all",
  customFrom = "",
  customTo = "",
  analyze = false
}: {
  companyId: string;
  range?: AdInsightRange;
  platform?: AdInsightPlatform;
  customFrom?: string;
  customTo?: string;
  analyze?: boolean;
}) {
  const dateRange = adInsightDateRange(range, customFrom, customTo);
  if (!hasSupabaseConfig()) {
    const metrics = { spend: 0, impressions: 0, reach: 0, clicks: 0, ctr: 0, cpc: 0, cpm: 0, messages: 0, leads: 0, conversions: 0, frequency: 0, roas: 0 };
    const previousMetrics = summarizeRows([]);
    const weeklyChange = weeklyChanges(metrics, previousMetrics);
    return {
      status: "demo",
      dateRange,
      sourceType: "Demo veri",
      connection: {},
      metrics,
      previousMetrics,
      weeklyChange,
      wastedBudgetEstimate: 0,
      bestAd: null,
      worstAd: null,
      winningCreative: null,
      actionRecommendations: recommendations(metrics, weeklyChange),
      healthScore: scoreFromMetrics(metrics),
      analysis: buildFallbackAnalysis("Demo Müşteri", metrics, 50),
      snapshots: []
    };
  }

  const [companyRows, integrations, campaignMetrics, adMetrics, snapshots] = await Promise.all([
    supabaseRest<any[]>(`companies?id=eq.${encodeURIComponent(companyId)}&select=*&limit=1`),
    supabaseRest<any[]>(`ad_integrations?company_id=eq.${encodeURIComponent(companyId)}&select=*&order=updated_at.desc`).catch(() => []),
    supabaseRest<any[]>(`campaign_metrics?company_id=eq.${encodeURIComponent(companyId)}&date=gte.${dateRange.from}&date=lte.${dateRange.to}&select=*&order=date.desc`).catch(() => []),
    supabaseRest<any[]>(`meta_ad_metrics?company_id=eq.${encodeURIComponent(companyId)}&date=gte.${dateRange.from}&date=lte.${dateRange.to}&select=*&order=date.desc`).catch(() => []),
    supabaseRest<any[]>(`ad_insight_snapshots?customer_id=eq.${encodeURIComponent(companyId)}&date_from=gte.${dateRange.from}&date_to=lte.${dateRange.to}&select=*&order=created_at.desc&limit=20`).catch(() => [])
  ]);

  const company = companyRows[0] || {};
  const meta = integrations.find((item) => item.provider === "meta") || {};
  const google = integrations.find((item) => item.provider === "google") || {};
  const previous = previousPeriod(dateRange);
  const previousRows = await supabaseRest<any[]>(`campaign_metrics?company_id=eq.${encodeURIComponent(companyId)}&date=gte.${previous.from}&date=lte.${previous.to}&select=*&order=date.desc`).catch(() => []);
  const rows = platform === "all" ? campaignMetrics : campaignMetrics.filter((row) => String(row.source || "").toLocaleLowerCase("tr").includes(platform === "google" ? "google" : "meta"));
  const filteredAdRows = platform === "all" ? adMetrics : adMetrics.filter((row) => String(row.source || "").toLocaleLowerCase("tr").includes(platform === "google" ? "google" : "meta"));
  const previousFilteredRows = platform === "all" ? previousRows : previousRows.filter((row) => String(row.source || "").toLocaleLowerCase("tr").includes(platform === "google" ? "google" : "meta"));
  const metrics = rows.length ? summarizeRows(rows) : snapshots[0]?.metrics || summarizeRows([]);
  const previousMetrics = previousFilteredRows.length ? summarizeRows(previousFilteredRows) : snapshots[0]?.previous_metrics || summarizeRows([]);
  const weeklyChange = Object.keys(snapshots[0]?.weekly_change || {}).length ? snapshots[0]?.weekly_change : weeklyChanges(metrics, previousMetrics);
  const combinedAdRows = filteredAdRows.length ? filteredAdRows : rows;
  const bestAd = pickAd(combinedAdRows, "best");
  const worstAd = pickAd(combinedAdRows, "worst");
  const winningCreative = bestAd?.creative_thumbnail_url || bestAd?.creative_media_url || bestAd?.ad_text ? bestAd : null;
  const wastedBudgetEstimate = Number(snapshots[0]?.wasted_budget_estimate || estimateWastedBudget(combinedAdRows, metrics));
  const actionRecommendations = Array.isArray(snapshots[0]?.action_recommendations) && snapshots[0]?.action_recommendations.length ? snapshots[0]?.action_recommendations : recommendations(metrics, weeklyChange);
  const healthScore = scoreFromMetrics(metrics);
  const fallback = buildFallbackAnalysis(company.name || company.company_name || "Müşteri", metrics, healthScore);
  let analysis = fallback;
  if (analyze) {
    const prompt = `Yanıtı tamamen Türkçe ver. ${company.name || "Müşteri"} reklam performansını ajans diliyle yorumla. Metrikler: ${JSON.stringify(metrics)}. Bölümler: Genel Durum, Güçlü Yönler, Zayıf Yönler, Riskler, Bütçe Yorumu, Kreatif Yorumu, Hedef Kitle Yorumu, Bugün Yapılacaklar, 7 Günlük Aksiyon Planı, Müşteriye Gönderilecek Sade Özet. Satış garantisi verme.`;
    const result = await generateAiText(prompt, fallback.admin).catch(() => ({ text: fallback.admin }));
    analysis = { admin: result.text || fallback.admin, customer: fallback.customer };
  }
  const sourceType = rows.length ? "Son senkron veri" : snapshots.length ? "Kayıtlı analiz" : "Demo veri";
  return {
    status: rows.length ? "live" : "demo",
    dateRange,
    sourceType,
    company,
    connection: {
      metaBusinessId: meta.business_id || meta.settings?.business_id || "",
      metaAdAccountId: meta.account_id || meta.ad_account_id || meta.settings?.ad_account_id || "",
      facebookPageId: meta.page_id || "",
      instagramUsername: meta.instagram_username || meta.settings?.instagram_username || "",
      instagramBusinessId: meta.instagram_account_id || "",
      googleAdsCustomerId: google.google_customer_id || google.account_id || "",
      googleAnalyticsId: google.google_analytics_id || google.settings?.google_analytics_id || "",
      websiteUrl: company.website || company.website_url || "",
      metaPixelId: meta.pixel_id || meta.dataset_id || ""
    },
    metrics,
    previousMetrics,
    weeklyChange,
    wastedBudgetEstimate,
    bestAd: snapshots[0]?.best_ad && Object.keys(snapshots[0].best_ad || {}).length ? snapshots[0].best_ad : bestAd,
    worstAd: snapshots[0]?.worst_ad && Object.keys(snapshots[0].worst_ad || {}).length ? snapshots[0].worst_ad : worstAd,
    winningCreative: snapshots[0]?.winning_creative && Object.keys(snapshots[0].winning_creative || {}).length ? snapshots[0].winning_creative : winningCreative,
    actionRecommendations,
    healthScore,
    healthLabel: healthLabel(healthScore),
    analysis,
    snapshots,
    updatedAt: new Date().toISOString()
  };
}
