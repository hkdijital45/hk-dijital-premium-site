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

function doctorStatus(score: number) {
  if (score >= 70) return "Sağlıklı";
  if (score >= 40) return "Riskli";
  return "Kritik";
}

function urgencyFromScore(score: number) {
  if (score < 40) return { label: "Acil", tone: "Kritik", description: "Bugün müdahale edilmesi gereken performans sinyalleri var." };
  if (score < 70) return { label: "Yüksek", tone: "Uyarı", description: "Önümüzdeki 3 gün içinde optimizasyon yapılmalı." };
  return { label: "Normal", tone: "Bilgi", description: "Düzenli takip ve kontrollü test yeterli görünüyor." };
}

function buildDiagnoses(metrics: any, weeklyChange: any, rows: any[]) {
  const diagnoses: any[] = [];
  const push = (item: any) => diagnoses.push({
    affected: item.affected || "Genel reklam hesabı",
    estimatedImpact: item.estimatedImpact || "Orta",
    ...item
  });
  if (!rows.length) {
    push({
      name: "Veri eksik",
      level: "Uyarı",
      symptom: "Seçili dönem için kampanya veya reklam metriği bulunamadı.",
      likelyCause: "Meta/Google senkronizasyonu yapılmamış, hesap bağlantısı eksik veya tarih filtresi veri içermiyor olabilir.",
      businessImpact: "Sağlıklı teşhis ve reçete oluşturmak için yeterli performans sinyali oluşmaz.",
      recommendation: "Reklam hesabı bağlantılarını kontrol edin ve son 30 gün verisini yeniden senkronize edin.",
      priorityScore: 78
    });
    return diagnoses;
  }
  if (Number(metrics.ctr || 0) < 0.7) push({
    name: "CTR düşük",
    level: "Kritik",
    symptom: `CTR ${Number(metrics.ctr || 0).toFixed(2)} seviyesinde.`,
    likelyCause: "Kreatif başlık, görsel veya hedef kitle reklamı yeterince çekici bulmuyor.",
    businessImpact: "Tıklama hacmi düşer, algoritma kalite sinyali zayıflar ve maliyetler artabilir.",
    recommendation: "En düşük CTR üreten kreatifleri durdurup yeni başlık/görsel varyasyonları test edin.",
    priorityScore: 92,
    estimatedImpact: "Yüksek"
  });
  if (Number(metrics.cpc || 0) > 30 || Number(weeklyChange.cpc || 0) > 15) push({
    name: "CPC yükseliyor",
    level: Number(metrics.cpc || 0) > 50 ? "Kritik" : "Uyarı",
    symptom: `Ortalama CPC ${Number(metrics.cpc || 0).toFixed(2)} TL, değişim ${Number(weeklyChange.cpc || 0).toFixed(1)}%.`,
    likelyCause: "Hedef kitle, teklif stratejisi veya reklam kalitesi maliyeti yukarı çekiyor.",
    businessImpact: "Aynı bütçeyle daha az ziyaretçi veya lead alınır.",
    recommendation: "Yüksek CPC kampanyalarını ayrı inceleyin, hedef kitle ve yerleşim kırılımı testi yapın.",
    priorityScore: 84
  });
  if (Number(metrics.cpm || 0) > 250 || Number(weeklyChange.cpm || 0) > 20) push({
    name: "CPM yüksek",
    level: "Uyarı",
    symptom: `CPM ${Number(metrics.cpm || 0).toFixed(2)} TL seviyesinde.`,
    likelyCause: "Hedef kitle daralmış, rekabet artmış veya yerleşim maliyeti yükselmiş olabilir.",
    businessImpact: "Görünürlük maliyeti artar ve bütçenin öğrenme kapasitesi düşer.",
    recommendation: "Hedef kitle genişletme, yerleşim testi ve farklı kampanya hedefi deneyin.",
    priorityScore: 70
  });
  if (Number(metrics.frequency || 0) > 4 && Number(weeklyChange.ctr || 0) < 0) push({
    name: "Kreatif yorgunluğu",
    level: "Kritik",
    symptom: `Frekans ${Number(metrics.frequency || 0).toFixed(2)} ve CTR düşüşte.`,
    likelyCause: "Aynı kullanıcılar reklamı çok kez görüyor ve kreatife tepki azalıyor.",
    businessImpact: "Tıklama oranı düşer, CPC yükselir ve marka algısı yorulabilir.",
    recommendation: "Yeni kreatif seti yayınlayın, frekans yüksek kampanyaları sınırlayın.",
    priorityScore: 90,
    estimatedImpact: "Yüksek"
  });
  if (!Number(metrics.leads || 0) && !Number(metrics.messages || 0) && Number(metrics.spend || 0) > 0) push({
    name: "Harcama var sonuç yok",
    level: "Kritik",
    symptom: `${Number(metrics.spend || 0).toFixed(2)} TL harcama var ama lead/mesaj sinyali yok.`,
    likelyCause: "Dönüşüm olayı kurulmamış, form/WhatsApp akışı zayıf veya reklam hedefi yanlış seçilmiş olabilir.",
    businessImpact: "Bütçe görünürlük üretir ama satış fırsatına dönüşmeyebilir.",
    recommendation: "Dönüşüm takibini, açılış sayfasını ve çağrı mesajını bugün kontrol edin.",
    priorityScore: 95,
    estimatedImpact: "Çok yüksek"
  });
  if (Number(weeklyChange.spend || 0) > 15 && Number(weeklyChange.leads || 0) <= 0 && Number(weeklyChange.messages || 0) <= 0) push({
    name: "Bütçe kaçağı",
    level: "Kritik",
    symptom: "Harcama artıyor ancak lead/mesaj artışı görünmüyor.",
    likelyCause: "Bütçe düşük performanslı kampanyalara kayıyor olabilir.",
    businessImpact: "Performans üretmeyen reklamlar bütçe tüketir.",
    recommendation: "Bütçeyi en iyi kampanyaya yönlendirin, düşük sonuçlu reklamları 3 gün izleme veya durdurma listesine alın.",
    priorityScore: 88
  });
  if (!diagnoses.length) push({
    name: "Performans stabil",
    level: "Bilgi",
    symptom: "Kritik maliyet veya düşüş sinyali görünmüyor.",
    likelyCause: "Kampanyalar seçili dönemde dengeli performans üretiyor.",
    businessImpact: "Kontrollü büyüme ve kreatif testi için alan var.",
    recommendation: "Güçlü kampanyalarda küçük bütçe artışı ve yeni kreatif A/B testi planlayın.",
    priorityScore: 42,
    estimatedImpact: "Orta"
  });
  return diagnoses.sort((a, b) => Number(b.priorityScore || 0) - Number(a.priorityScore || 0));
}

function buildPrescription(diagnoses: any[], metrics: any, bestAd: any, worstAd: any) {
  const today = [
    {
      title: "Dönüşüm ve mesaj akışını kontrol et",
      description: "Pixel/CAPI, WhatsApp linki, form ve müşteri iletişim kanallarının çalıştığını doğrulayın.",
      related: "Genel hesap",
      priority: Number(metrics.leads || 0) || Number(metrics.messages || 0) ? "Orta" : "Kritik",
      expectedImpact: "Boşa harcama riskini azaltır.",
      owner: "",
      status: "Bekliyor",
      dueInDays: 0
    },
    {
      title: "En zayıf reklamı incele",
      description: `${worstAd?.name || "Düşük performanslı reklam"} için CTR, CPC ve kreatif mesajını kontrol edin.`,
      related: worstAd?.name || "Zayıf reklam",
      priority: "Yüksek",
      expectedImpact: "Maliyet artışını sınırlayabilir.",
      owner: "",
      status: "Bekliyor",
      dueInDays: 0
    }
  ];
  const threeDays = [
    {
      title: "Yeni kreatif varyasyonları hazırla",
      description: "3 başlık, 3 açıklama ve 2 görsel/video varyasyonu ile düşük CTR riskini test edin.",
      related: "Kreatif seti",
      priority: diagnoses.some((item) => item.name.includes("Kreatif")) ? "Kritik" : "Yüksek",
      expectedImpact: "CTR ve kalite sinyalini artırabilir.",
      owner: "",
      status: "Bekliyor",
      dueInDays: 3
    },
    {
      title: "Bütçeyi güçlü kampanyaya kaydır",
      description: `${bestAd?.name || "En iyi performanslı reklam"} lehine kontrollü bütçe dağılımı yapın.`,
      related: bestAd?.name || "Güçlü kampanya",
      priority: "Orta",
      expectedImpact: "Aynı bütçeyle daha fazla sonuç üretme ihtimali sağlar.",
      owner: "",
      status: "Bekliyor",
      dueInDays: 3
    }
  ];
  const sevenDays = [
    {
      title: "7 günlük performans kontrol toplantısı",
      description: "CTR, CPC, CPM, lead/mesaj maliyeti ve kreatif sonuçlarını yeniden değerlendirin.",
      related: "Haftalık optimizasyon",
      priority: "Orta",
      expectedImpact: "Sürdürülebilir optimizasyon rutini oluşturur.",
      owner: "",
      status: "Bekliyor",
      dueInDays: 7
    }
  ];
  return { today, threeDays, sevenDays, all: [...today, ...threeDays, ...sevenDays] };
}

function buildCreativeAnalysis(rows: any[], bestAd: any) {
  const sourceRows = rows.length ? rows : bestAd ? [bestAd] : [];
  if (!sourceRows.length) {
    return {
      available: false,
      score: 0,
      summary: "Kreatif görsel/video verisi yok. Başlık ve metin verileri geldiğinde kreatif doktoru daha net analiz yapar.",
      items: [],
      suggestions: {
        headlines: ["Teklifinizi netleştiren kısa başlık kullanın.", "Problem ve çözümü aynı başlıkta verin.", "Yerel/segment odaklı başlık test edin."],
        descriptions: ["Mesajı sadeleştirin ve tek aksiyon çağrısı bırakın.", "Fiyat/teklif net değilse küçük açıklama ekleyin.", "Sosyal kanıt veya güven unsuru ekleyin."],
        ctas: ["WhatsApp'tan Bilgi Al", "Hemen Teklif Al", "Randevu Oluştur"],
        videoIdea: "İlk 3 saniyede problemi gösteren, ardından çözümü ve net CTA'yı veren 15 saniyelik kısa video.",
        staticIdea: "Sol tarafta problem, sağ tarafta çözüm/teklif ve altta tek CTA bulunan mobil uyumlu görsel."
      }
    };
  }
  const items = sourceRows.slice(0, 6).map((row) => {
    const text = String(row.ad_text || row.headline || row.description || row.name || "");
    const hasCta = /al|başvur|ara|mesaj|teklif|randevu|satın|incele/i.test(text);
    const score = Math.max(20, Math.min(100, Math.round(55 + Number(row.ctr || 0) * 8 - Number(row.cpc || 0) * 0.4 + (hasCta ? 12 : -8))));
    return {
      name: row.name || row.ad_name || row.campaign_name || "Kreatif",
      score,
      thumbnail: row.creative_thumbnail_url || row.raw_data?.creative_thumbnail_url || "",
      mediaUrl: row.creative_media_url || row.raw_data?.creative_media_url || "",
      hasCta,
      hasClearOffer: /%|tl|₺|ücretsiz|paket|kampanya|teklif/i.test(text),
      brandVisible: Boolean(row.creative_thumbnail_url || row.creative_media_url || row.raw_data?.image_url),
      headlineStrong: text.length > 12,
      mobileClarity: text.length <= 140,
      fatigueRisk: Number(row.frequency || 0) > 4 || Number(row.ctr || 0) < 0.7,
      recommendedVariation: hasCta ? "Aynı mesajı daha güçlü görsel açılışla test edin." : "Net bir CTA ekleyin ve teklif dilini sadeleştirin."
    };
  });
  const averageScore = Math.round(items.reduce((total, item) => total + item.score, 0) / items.length);
  return {
    available: true,
    score: averageScore,
    summary: averageScore >= 70 ? "Kreatif sinyali güçlü; yeni varyasyonlarla ölçeklenebilir." : "Kreatifler yenilenmeli; CTA, teklif ve mobil netlik güçlendirilmeli.",
    items,
    suggestions: {
      headlines: ["Bugün Daha Fazla Başvuru Alın", "Reklam Bütçenizi Daha Verimli Kullanın", "Sizin İçin Hazırlanan Özel Çözüm"],
      descriptions: ["Tek aksiyon çağrısı ve net fayda ile mesajı sadeleştirin.", "En güçlü kampanya sonucunu görselde öne çıkarın.", "WhatsApp veya form aksiyonunu ilk ekranda belirginleştirin."],
      ctas: ["WhatsApp'tan Bilgi Al", "Teklif Al", "Hemen İncele"],
      videoIdea: "Müşteri problemini ilk 3 saniyede gösteren, sonuç ve CTA ile biten kısa dikey video.",
      staticIdea: "Başlık, tek fayda, sosyal kanıt ve CTA içeren temiz mobil görsel."
    }
  };
}

function buildTrendAnalysis(metrics: any, weeklyChange: any) {
  const rules = [];
  if (Number(metrics.frequency || 0) > 4 && Number(weeklyChange.ctr || 0) < 0) rules.push("Frekans yükselip CTR düştüğü için kreatif yorgunluğu riski var.");
  if (Number(weeklyChange.spend || 0) > 15 && Number(weeklyChange.leads || 0) <= 0 && Number(weeklyChange.messages || 0) <= 0) rules.push("Harcama artıyor ancak sonuç artmıyor; bütçe kaçağı kontrol edilmeli.");
  if (Number(weeklyChange.cpc || 0) > 15 && Number(weeklyChange.ctr || 0) < 0) rules.push("CPC artarken CTR düşüyor; mesaj/kreatif problemi olası.");
  if (Number(weeklyChange.cpm || 0) > 20) rules.push("CPM yükseliyor; hedef kitle veya rekabet baskısı olabilir.");
  if (!rules.length) rules.push("Trendlerde kritik bozulma yok; kontrollü test ve izleme önerilir.");
  return {
    frequencyTrend: Number(metrics.frequency || 0),
    ctrTrend: Number(weeklyChange.ctr || 0),
    cpcTrend: Number(weeklyChange.cpc || 0),
    cpmTrend: Number(weeklyChange.cpm || 0),
    spendTrend: Number(weeklyChange.spend || 0),
    resultTrend: Math.max(Number(weeklyChange.leads || 0), Number(weeklyChange.messages || 0), Number(weeklyChange.conversions || 0)),
    rules
  };
}

function buildCompetitorAnalysis() {
  return {
    available: false,
    message: "Rakip verisi bağlı değil. Meta Ad Library veya Rakip Analizi modülünden veri eklenirse burada kıyaslama yapılır.",
    activeAds: null,
    videoStaticRatio: null,
    offerLanguage: "Veri yok",
    ctaDensity: "Veri yok",
    differences: [],
    counterMoves: ["Rakip reklamlarını Meta Ad Library üzerinden toplayın.", "Teklif dili, CTA ve kreatif formatlarını karşılaştırın.", "Güçlü rakip tekliflerine karşı alternatif varyasyon hazırlayın."]
  };
}

function buildDoctorSummary(companyName: string, metrics: any, healthScore: number, diagnoses: any[], prescription: any, bestAd: any, worstAd: any) {
  const topDiagnosis = diagnoses[0];
  const bestName = bestAd?.name || "en iyi performanslı reklam";
  const worstName = worstAd?.name || "sorunlu reklam";
  return {
    general: `${companyName} için reklam sağlık skoru ${healthScore}/100 (${doctorStatus(healthScore)}). ${topDiagnosis?.name ? `Öne çıkan teşhis: ${topDiagnosis.name}.` : "Kritik teşhis bulunmadı."}`,
    why: [
      Number(metrics.ctr || 0) < 0.7 ? "CTR düşük olduğu için kalite ve ilgi sinyali zayıf." : "CTR kabul edilebilir seviyede.",
      Number(metrics.cpc || 0) > 30 ? "CPC yüksek olduğu için tıklama maliyeti baskı oluşturuyor." : "CPC kontrol edilebilir seviyede.",
      Number(metrics.frequency || 0) > 4 ? "Frekans yüksek olduğu için kreatif yorgunluğu riski var." : "Frekans kritik seviyede değil."
    ],
    topProblems: diagnoses.slice(0, 3).map((item) => item.name),
    firstActions: prescription.all.slice(0, 3).map((item: any) => item.title),
    customerMessage: `Merhaba,\n\n${companyName} reklam çalışmalarının bu dönem özetini paylaşmak isteriz.\n\nToplam ${Number(metrics.spend || 0).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} TL harcama ile ${Number(metrics.reach || 0).toLocaleString("tr-TR")} kişiye erişildi ve ${Number(metrics.clicks || 0).toLocaleString("tr-TR")} tıklama alındı.\n\nEn iyi sinyal ${bestName} tarafında görünüyor. İyileştirme gereken alan ise ${worstName} ve ${topDiagnosis?.name || "kreatif/mesaj optimizasyonu"} başlığıdır.\n\nÖnümüzdeki süreçte düşük performanslı reklamları kontrol edip güçlü kreatiflere daha fazla ağırlık vermeyi öneriyoruz.\n\nHK Dijital`
  };
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
  if (score >= 70) return "Sağlıklı";
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
    const healthScore = scoreFromMetrics(metrics);
    const diagnoses = buildDiagnoses(metrics, weeklyChange, []);
    const prescription = buildPrescription(diagnoses, metrics, null, null);
    const creativeAnalysis = buildCreativeAnalysis([], null);
    const trendAnalysis = buildTrendAnalysis(metrics, weeklyChange);
    const competitorAnalysis = buildCompetitorAnalysis();
    const doctorSummary = buildDoctorSummary("Demo Müşteri", metrics, healthScore, diagnoses, prescription, null, null);
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
      healthScore,
      healthLabel: healthLabel(healthScore),
      doctorStatus: doctorStatus(healthScore),
      urgency: urgencyFromScore(healthScore),
      potentialImprovement: 0,
      diagnoses,
      prescription,
      creativeAnalysis,
      trendAnalysis,
      competitorAnalysis,
      doctorSummary,
      customerMessage: doctorSummary.customerMessage,
      analysis: buildFallbackAnalysis("Demo Müşteri", metrics, healthScore),
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
  const diagnoses = snapshots[0]?.insights?.diagnoses || buildDiagnoses(metrics, weeklyChange, combinedAdRows);
  const prescription = snapshots[0]?.insights?.prescription || buildPrescription(diagnoses, metrics, bestAd, worstAd);
  const creativeAnalysis = snapshots[0]?.insights?.creative_analysis || buildCreativeAnalysis(combinedAdRows, bestAd);
  const trendAnalysis = snapshots[0]?.insights?.trend_analysis || buildTrendAnalysis(metrics, weeklyChange);
  const competitorAnalysis = snapshots[0]?.insights?.competitor_analysis || buildCompetitorAnalysis();
  const doctorSummary = snapshots[0]?.insights?.doctor_summary || buildDoctorSummary(company.name || company.company_name || "Müşteri", metrics, healthScore, diagnoses, prescription, bestAd, worstAd);
  const potentialImprovement = Math.max(0, Math.min(65, Math.round((100 - healthScore) * 0.6)));
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
    doctorStatus: doctorStatus(healthScore),
    urgency: urgencyFromScore(healthScore),
    potentialImprovement,
    diagnoses,
    prescription,
    creativeAnalysis,
    trendAnalysis,
    competitorAnalysis,
    doctorSummary,
    customerMessage: doctorSummary.customerMessage,
    analysis,
    snapshots,
    updatedAt: new Date().toISOString()
  };
}
