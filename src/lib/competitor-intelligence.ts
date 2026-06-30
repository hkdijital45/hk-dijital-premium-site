/* eslint-disable @typescript-eslint/no-explicit-any */

export type CompetitorSuggestionInput = {
  companyName?: string;
  sector?: string;
  city?: string;
  district?: string;
  branchName?: string;
};

export function competitorDisplayName(item: any) {
  return item?.competitor_name || item?.name || item?.title || "Rakip kaydı";
}

export function buildCompetitorSuggestions(input: CompetitorSuggestionInput) {
  const sector = input.sector || "yerel işletme";
  const city = input.city || "bölge";
  const district = input.district || "merkez";
  const base = [
    {
      competitor_name: `${city} ${sector} Lideri`,
      reason: `${city}/${district} bölgesinde görünürlük ve yorum gücü yüksek olabilecek ana rakip profili.`,
      estimated_strength: "Google yorumları, Instagram sürekliliği ve yerel bilinirlik.",
      estimated_weakness: "Teklif dili ve kampanya farklılaşması sınırlı olabilir.",
      monitoring_recommendation: "Haftalık reklam, Google yorum ve sosyal medya paylaşım takibi önerilir."
    },
    {
      competitor_name: `${district} Premium ${sector}`,
      reason: "Premium konumlandırma veya daha yüksek fiyat algısıyla müşterinin teklif dilini etkileyebilir.",
      estimated_strength: "Görsel kalite, müşteri deneyimi ve marka algısı.",
      estimated_weakness: "Performans reklamlarında mesaj netliği düşük olabilir.",
      monitoring_recommendation: "Fiyat/kampanya değişimi ve kreatif dili iki haftada bir kontrol edilmeli."
    },
    {
      competitor_name: `${city} Yeni Nesil ${sector}`,
      reason: "Yeni kampanya ve sosyal medya içerikleriyle hızlı görünürlük kazanabilecek rakip profili.",
      estimated_strength: "Yeni içerik temposu, kısa video ve kampanya duyuruları.",
      estimated_weakness: "SEO ve kalıcı Google görünürlüğü zayıf olabilir.",
      monitoring_recommendation: "Instagram paylaşım artışı ve web sitesi değişimleri haftalık izlenmeli."
    }
  ];
  return base.map((item, index) => ({
    ...item,
    sector,
    city,
    district,
    website_url: "",
    instagram_url: "",
    google_maps_url: "",
    meta_ad_library_url: "",
    monitoring_frequency: index === 1 ? "biweekly" : "weekly",
    show_to_customer: false
  }));
}

export function buildCompetitorCustomerSummary(item: any) {
  const name = competitorDisplayName(item);
  const summary = `${name} tarafında reklam, sosyal medya ve Google görünürlüğü düzenli takip edilmelidir. Bu hareketlilik müşteriniz için içerik, yorum yönetimi ve kısa dönem kampanya fırsatı oluşturur.`;
  const recommendations = [
    "Bu hafta en az 3 kısa video/Reels fikri hazırlanmalı.",
    "Google yorum artırma aksiyonu başlatılmalı.",
    "Rakip kampanyalarına karşı kısa süreli teklif veya mesaj kampanyası planlanmalı."
  ];
  const actionPlan = [
    "Gün 1: Rakip reklam ve sosyal medya görünürlüğünü kontrol et.",
    "Gün 2: Müşteri için 3 içerik fikri ve 1 kampanya mesajı hazırla.",
    "Gün 3: Google yorum talep akışını başlat.",
    "Gün 4: Reklam kreatiflerini rakip mesajlarına göre gözden geçir.",
    "Gün 5: WhatsApp veya kısa kampanya duyurusu hazırla.",
    "Gün 6: İlk sinyalleri rapor notuna çevir.",
    "Gün 7: Müşteriye sade haftalık rekabet özeti gönder."
  ];
  return { summary, recommendations, actionPlan };
}

export function buildCompetitorInternalAnalysis(item: any) {
  const name = competitorDisplayName(item);
  return {
    strengths: ["Yerel görünürlük", "Sosyal medya sürekliliği", "Google yorum potansiyeli"],
    weaknesses: ["Teklif farklılaşması sınırlı", "Kampanya mesajı ölçülebilir olmayabilir"],
    adSignals: [item?.last_ad_seen_at ? "Son reklam sinyali mevcut" : "Yeni reklam sinyali kontrol edilmeli"],
    contentSignals: ["Kısa video ve kampanya duyuruları takip edilmeli"],
    seoOpportunities: ["Yerel sayfa başlıkları, yorum içerikleri ve Maps görünürlüğü güçlendirilebilir"],
    reviewOpportunities: ["Yorum sayısı ve son yorum tarihi haftalık izlenmeli"],
    technicalNotes: [`${name} için gerçek API entegrasyonu yoksa yerel yedek analiz kullanılır.`],
    agencyActions: ["Görev oluştur", "Müşteri notuna kaydet", "Agent Hafızasına kaydet", "Müşteriye sade özet gönder"]
  };
}

export function buildCompetitorSignals(item: any) {
  const name = competitorDisplayName(item);
  return [
    {
      signal_type: "ad_signal",
      title: `${name} reklam görünürlüğü kontrol edildi`,
      summary: "Aktif reklam veya kampanya sinyali için takip kaydı hazırlandı.",
      severity: "info"
    },
    {
      signal_type: "content_signal",
      title: `${name} içerik hareketliliği izlendi`,
      summary: "Instagram paylaşım temposu ve kampanya dili kontrol edilmelidir.",
      severity: "info"
    },
    {
      signal_type: "review_signal",
      title: `${name} Google yorum takibi`,
      summary: "Yorum sayısı ve puan değişimi haftalık izleme planına eklendi.",
      severity: "info"
    }
  ];
}

export function isCompetitorDue(item: any, now = new Date()) {
  if (!item?.last_checked_at) return true;
  const last = new Date(item.last_checked_at);
  const days = Math.floor((Number(now) - Number(last)) / 86400000);
  const frequency = String(item.monitoring_frequency || "weekly");
  if (frequency === "daily") return days >= 1;
  if (frequency === "monthly") return days >= 30;
  if (frequency === "biweekly") return days >= 14;
  return days >= 7;
}
