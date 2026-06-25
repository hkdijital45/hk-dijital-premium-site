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
    return { status: "demo", dateRange, sourceType: "Demo veri", connection: {}, metrics, healthScore: scoreFromMetrics(metrics), analysis: buildFallbackAnalysis("Demo Müşteri", metrics, 50), snapshots: [] };
  }

  const [companyRows, integrations, campaignMetrics, snapshots] = await Promise.all([
    supabaseRest<any[]>(`companies?id=eq.${encodeURIComponent(companyId)}&select=*&limit=1`),
    supabaseRest<any[]>(`ad_integrations?company_id=eq.${encodeURIComponent(companyId)}&select=*&order=updated_at.desc`).catch(() => []),
    supabaseRest<any[]>(`campaign_metrics?company_id=eq.${encodeURIComponent(companyId)}&date=gte.${dateRange.from}&date=lte.${dateRange.to}&select=*&order=date.desc`).catch(() => []),
    supabaseRest<any[]>(`ad_insight_snapshots?customer_id=eq.${encodeURIComponent(companyId)}&date_from=gte.${dateRange.from}&date_to=lte.${dateRange.to}&select=*&order=created_at.desc&limit=20`).catch(() => [])
  ]);

  const company = companyRows[0] || {};
  const meta = integrations.find((item) => item.provider === "meta") || {};
  const google = integrations.find((item) => item.provider === "google") || {};
  const rows = platform === "all" ? campaignMetrics : campaignMetrics.filter((row) => String(row.source || "").toLocaleLowerCase("tr").includes(platform === "google" ? "google" : "meta"));
  const impressions = sum(rows, "impressions");
  const reach = sum(rows, "reach");
  const clicks = sum(rows, "clicks");
  const spend = sum(rows, "spend") || sum(rows, "spent");
  const leads = sum(rows, "leads");
  const messages = sum(rows, "messages");
  const conversions = sum(rows, "conversions");
  const purchaseValue = sum(rows, "purchase_value");
  const metrics = {
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
    healthScore,
    healthLabel: healthLabel(healthScore),
    analysis,
    snapshots,
    updatedAt: new Date().toISOString()
  };
}
