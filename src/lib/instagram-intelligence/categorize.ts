// Deterministic, zero-AI keyword classifier for Instagram captions —
// intentionally not a closed enum: a caption that matches nothing gets
// reported as unclassified rather than forced into a wrong bucket (never
// fabricate a category). Kept in its own zero-dependency module so it can
// be unit-tested directly (node --experimental-strip-types does not
// resolve the app's "@/" path alias).

export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "Google Ads": ["google ads", "google reklam", "arama ağı", "performance max", "google reklamcılık"],
  "Meta Ads": ["meta ads", "facebook reklam", "instagram reklam", "meta reklam"],
  "Instagram": ["instagram algoritma", "instagram büyüme", "reels algoritma", "instagram stratejisi"],
  "Sosyal Medya Yönetimi": ["sosyal medya yönetimi", "içerik takvimi", "sosyal medya stratejisi", "sosyal medya ajansı"],
  "Dijital Pazarlama": ["dijital pazarlama", "pazarlama stratejisi", "marka stratejisi"],
  "SEO": ["seo", "arama motoru optimizasyon", "organik trafik", "backlink"],
  "GEO / AI Search": ["geo", "ai search", "yapay zeka arama", "chatgpt", "yapay zekâ görünürlük", "ai görünürlük"],
  "Web Sitesi": ["web sitesi", "web site", "landing page", "dönüşüm oranı", "site hızı"],
  "Analytics / Ölçümleme": ["analytics", "ölçümleme", "veri analizi", "conversion tracking", "pixel"],
  "İşletme Hataları": ["yaygın hata", "sık yapılan hata", "işletmelerin yaptığı", "bilinen yanlış"],
  "Ajans / İşletme Eğitimi": ["ajans", "işletme sahibi", "girişimci", "kobi"],
  "Case-Study": ["vaka analizi", "case study", "başarı hikayesi", "müşteri sonucu"],
  "Trend / Güncel": ["2026 trend", "güncel gelişme", "yeni güncelleme", "algoritma değişikliği"]
};

export function classifyCaption(caption: string): string | null {
  const normalized = (caption || "").toLocaleLowerCase("tr-TR");
  if (!normalized.trim()) return null;
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => normalized.includes(kw))) return category;
  }
  return null;
}
