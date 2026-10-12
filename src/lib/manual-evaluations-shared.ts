// Shared "Manuel Değerlendirme" engine — backs the "+ Manuel Değerlendirme"
// button on every Reklam Doktoru Pro tab (Phase 7/8 of the brief). One
// generic table (manual_evaluations), one generic CRUD/validation/metric
// layer, module-specific *shape* expressed as field-group config
// (MODULE_FIELD_GROUPS) consumed by a single shared form renderer
// (ManualEvaluationModal.tsx) instead of six bespoke forms.
//
// Deliberately NOT server-only: client components (the modal, the
// section/history list) need the module labels, field configs and
// calculation functions too — only the actual Supabase CRUD
// (manual-evaluations.ts) is server-only.

export const MANUAL_EVALUATION_MODULES = [
  "ad-doctor",
  "ads-strategy",
  "ad-creative",
  "ad-evaluation",
  "candidate-evaluation",
  "instagram"
] as const;
export type ManualEvaluationModule = (typeof MANUAL_EVALUATION_MODULES)[number];

export const MODULE_LABELS: Record<ManualEvaluationModule, string> = {
  "ad-doctor": "Reklam Doktoru",
  "ads-strategy": "Claude Reklam Stratejisi",
  "ad-creative": "Reklam Kreatif Raporu",
  "ad-evaluation": "Reklam Değerlendirme",
  "candidate-evaluation": "Aday Değerlendirmeleri",
  instagram: "Instagram Değerlendirme"
};

export type FieldType = "text" | "textarea" | "number" | "date" | "select";
export type FieldConfig = {
  key: string;
  label: string;
  type: FieldType;
  unit?: string;
  options?: string[];
  placeholder?: string;
};
export type FieldGroup = { title: string; fields: FieldConfig[] };

// ---- Phase 7 field lists, one group list per module ----

const AD_DOCTOR_GROUPS: FieldGroup[] = [
  {
    title: "Kampanya Bilgisi",
    fields: [
      { key: "platform", label: "Platform", type: "select", options: ["Meta", "Google", "Instagram", "TikTok", "Diğer"] },
      { key: "campaignObjective", label: "Kampanya Amacı", type: "text" },
      { key: "startDate", label: "Başlangıç Tarihi", type: "date" },
      { key: "endDate", label: "Bitiş Tarihi", type: "date" }
    ]
  },
  {
    title: "Performans Verileri",
    fields: [
      { key: "budget", label: "Bütçe", type: "number", unit: "TL" },
      { key: "spend", label: "Harcama", type: "number", unit: "TL" },
      { key: "reach", label: "Erişim", type: "number" },
      { key: "impressions", label: "Gösterim", type: "number" },
      { key: "frequency", label: "Frekans", type: "number" },
      { key: "clicks", label: "Tıklama", type: "number" },
      { key: "linkClicks", label: "Bağlantı Tıklaması", type: "number" },
      { key: "results", label: "Sonuç", type: "number" },
      { key: "conversions", label: "Dönüşüm", type: "number" },
      { key: "revenue", label: "Gelir", type: "number", unit: "TL" }
    ]
  }
];

const ADS_STRATEGY_GROUPS: FieldGroup[] = [
  {
    title: "İşletme Bilgisi",
    fields: [
      { key: "sector", label: "Sektör", type: "text" },
      { key: "targetAudience", label: "Hedef Kitle", type: "textarea" },
      { key: "geography", label: "Coğrafya", type: "text" },
      { key: "budget", label: "Bütçe", type: "number", unit: "TL" },
      { key: "campaignObjective", label: "Kampanya Amacı", type: "text" }
    ]
  },
  {
    title: "Teklif ve Geçmiş",
    fields: [
      { key: "productsOrServices", label: "Ürün / Hizmetler", type: "textarea" },
      { key: "offer", label: "Teklif", type: "textarea" },
      { key: "currentChallenges", label: "Mevcut Zorluklar", type: "textarea" },
      { key: "previousPerformance", label: "Önceki Performans", type: "textarea" },
      { key: "availableCreativeAssets", label: "Mevcut Kreatif Varlıklar", type: "textarea" }
    ]
  }
];

const AD_CREATIVE_GROUPS: FieldGroup[] = [
  {
    title: "Kreatif Bilgisi",
    fields: [
      { key: "creativeType", label: "Kreatif Türü", type: "select", options: ["Reels", "Carousel", "Statik Görsel", "Video", "Story"] },
      { key: "creativeName", label: "Kreatif Adı", type: "text" },
      { key: "format", label: "Format", type: "text" },
      { key: "headline", label: "Başlık", type: "text" },
      { key: "primaryText", label: "Ana Metin", type: "textarea" },
      { key: "cta", label: "CTA", type: "text" },
      { key: "targetAudience", label: "Hedef Kitle", type: "text" }
    ]
  },
  {
    title: "Performans ve Gözlemler",
    fields: [
      { key: "spend", label: "Harcama", type: "number", unit: "TL" },
      { key: "impressions", label: "Gösterim", type: "number" },
      { key: "clicks", label: "Tıklama", type: "number" },
      { key: "results", label: "Sonuç", type: "number" },
      { key: "observations", label: "Kreatif Gözlemler", type: "textarea" }
    ]
  }
];

const AD_EVALUATION_GROUPS: FieldGroup[] = [
  {
    title: "Kapsam",
    fields: [
      { key: "level", label: "Seviye", type: "select", options: ["Kampanya", "Reklam Seti", "Reklam"] },
      { key: "campaignName", label: "Kampanya / Set / Reklam Adı", type: "text" },
      { key: "startDate", label: "Başlangıç Tarihi", type: "date" },
      { key: "endDate", label: "Bitiş Tarihi", type: "date" }
    ]
  },
  {
    title: "Metrikler",
    fields: [
      { key: "spend", label: "Harcama", type: "number", unit: "TL" },
      { key: "impressions", label: "Gösterim", type: "number" },
      { key: "clicks", label: "Tıklama", type: "number" },
      { key: "results", label: "Sonuç", type: "number" },
      { key: "conversions", label: "Dönüşüm", type: "number" },
      { key: "revenue", label: "Gelir", type: "number", unit: "TL" }
    ]
  }
];

const CANDIDATE_EVALUATION_GROUPS: FieldGroup[] = [
  {
    title: "İşletme Bilgisi",
    fields: [
      { key: "businessName", label: "İşletme Adı", type: "text" },
      { key: "sector", label: "Sektör", type: "text" },
      { key: "location", label: "Konum", type: "text" },
      { key: "website", label: "Website", type: "text" },
      { key: "instagram", label: "Instagram", type: "text" },
      { key: "digitalPresence", label: "Dijital Varlık Durumu", type: "textarea" },
      { key: "advertisingActivity", label: "Reklam Faaliyeti", type: "textarea" }
    ]
  },
  {
    title: "Değerlendirme",
    fields: [
      { key: "observedProblems", label: "Gözlemlenen Sorunlar", type: "textarea" },
      { key: "opportunities", label: "Fırsatlar", type: "textarea" },
      { key: "commercialPotential", label: "Ticari Potansiyel", type: "select", options: ["Düşük", "Orta", "Yüksek"] },
      { key: "recommendedServices", label: "Önerilen Ajans Hizmetleri", type: "textarea" }
    ]
  }
];

const INSTAGRAM_GROUPS: FieldGroup[] = [
  {
    title: "İşletme Bilgisi",
    fields: [
      { key: "businessName", label: "İşletme Adı", type: "text" },
      { key: "instagramUsername", label: "Instagram Kullanıcı Adı", type: "text" },
      { key: "instagramUrl", label: "Instagram URL", type: "text" },
      { key: "sector", label: "Sektör", type: "text" },
      { key: "city", label: "Şehir", type: "text" },
      { key: "district", label: "İlçe", type: "text" },
      { key: "website", label: "Website", type: "text" },
      { key: "businessDescription", label: "İşletme Açıklaması", type: "textarea" },
      { key: "mainObjective", label: "Ana Hedef", type: "text" }
    ]
  },
  {
    title: "Profil Bilgisi",
    fields: [
      { key: "accountName", label: "Hesap Adı", type: "text" },
      { key: "biography", label: "Biyografi", type: "textarea" },
      { key: "followers", label: "Takipçi", type: "number" },
      { key: "following", label: "Takip Edilen", type: "number" },
      { key: "posts", label: "Toplam Gönderi", type: "number" },
      { key: "profileCategory", label: "Profil Kategorisi", type: "text" },
      { key: "contactButtons", label: "İletişim Butonları", type: "text" },
      { key: "whatsappAvailable", label: "WhatsApp Mevcut mu", type: "select", options: ["Evet", "Hayır", "Bilinmiyor"] },
      { key: "locationInfo", label: "Konum Bilgisi", type: "text" }
    ]
  },
  {
    title: "Performans Bilgisi",
    fields: [
      { key: "analysisStartDate", label: "Analiz Başlangıç Tarihi", type: "date" },
      { key: "analysisEndDate", label: "Analiz Bitiş Tarihi", type: "date" },
      { key: "accountsReached", label: "Erişilen Hesap", type: "number" },
      { key: "impressions", label: "Gösterim / Görüntülenme", type: "number" },
      { key: "profileVisits", label: "Profil Ziyareti", type: "number" },
      { key: "newFollowers", label: "Yeni Takipçi", type: "number" },
      { key: "unfollows", label: "Takipten Çıkma", type: "number" },
      { key: "totalInteractions", label: "Toplam Etkileşim", type: "number" },
      { key: "likes", label: "Beğeni", type: "number" },
      { key: "comments", label: "Yorum", type: "number" },
      { key: "shares", label: "Paylaşım", type: "number" },
      { key: "saves", label: "Kaydetme", type: "number" },
      { key: "reelViews", label: "Reels Görüntülenme", type: "number" },
      { key: "storyViews", label: "Hikaye Görüntülenme", type: "number" },
      { key: "websiteClicks", label: "Website Tıklaması", type: "number" },
      { key: "contactTaps", label: "İletişim Butonu Tıklaması", type: "number" },
      { key: "messages", label: "Mesaj", type: "number" },
      { key: "leads", label: "Lead", type: "number" },
      { key: "confirmedSales", label: "Onaylanmış Satış", type: "number" },
      { key: "revenue", label: "Gelir", type: "number", unit: "TL" },
      { key: "startingFollowers", label: "Dönem Başı Takipçi (büyüme oranı için)", type: "number" }
    ]
  },
  {
    title: "İçerik Bilgisi",
    fields: [
      { key: "reelsCount", label: "Reels Sayısı", type: "number" },
      { key: "carouselCount", label: "Carousel Sayısı", type: "number" },
      { key: "staticPostCount", label: "Statik Gönderi Sayısı", type: "number" },
      { key: "storyCount", label: "Hikaye Sayısı", type: "number" },
      { key: "postingFrequency", label: "Paylaşım Sıklığı", type: "text" },
      { key: "averageEngagement", label: "Ortalama Etkileşim", type: "text" },
      { key: "bestPerformingContent", label: "En İyi Performans Gösteren İçerik", type: "textarea" },
      { key: "weakestPerformingContent", label: "En Zayıf Performans Gösteren İçerik", type: "textarea" }
    ]
  },
  {
    title: "Profil Denetimi",
    fields: [
      { key: "profilePhotoQuality", label: "Profil Fotoğrafı Kalitesi", type: "select", options: ["İyi", "Orta", "Zayıf", "Bilinmiyor"] },
      { key: "usernameClarity", label: "Kullanıcı Adı Netliği", type: "select", options: ["İyi", "Orta", "Zayıf", "Bilinmiyor"] },
      { key: "nameFieldQuality", label: "Ad Alanı Kalitesi", type: "select", options: ["İyi", "Orta", "Zayıf", "Bilinmiyor"] },
      { key: "bioQuality", label: "Biyografi Kalitesi", type: "select", options: ["İyi", "Orta", "Zayıf", "Bilinmiyor"] },
      { key: "linkStructure", label: "Bağlantı Yapısı", type: "text" },
      { key: "highlights", label: "Öne Çıkanlar", type: "textarea" },
      { key: "pinnedPosts", label: "Sabitlenmiş Gönderiler", type: "textarea" },
      { key: "visualConsistency", label: "Görsel Tutarlılık", type: "select", options: ["İyi", "Orta", "Zayıf", "Bilinmiyor"] },
      { key: "trustSignals", label: "Güven Sinyalleri", type: "textarea" },
      { key: "contactAccessibility", label: "İletişime Geçilebilirlik", type: "select", options: ["İyi", "Orta", "Zayıf", "Bilinmiyor"] },
      { key: "conversionPath", label: "Dönüşüm Yolu", type: "text" }
    ]
  },
  {
    title: "Kaynak (Mode B — Mevcut Müşteri Değil)",
    fields: [
      { key: "isExistingCustomer", label: "Mevcut Müşteri mi?", type: "select", options: ["Evet", "Hayır (Aday / Halka Açık Profil)"] }
    ]
  }
];

export const MODULE_FIELD_GROUPS: Record<ManualEvaluationModule, FieldGroup[]> = {
  "ad-doctor": AD_DOCTOR_GROUPS,
  "ads-strategy": ADS_STRATEGY_GROUPS,
  "ad-creative": AD_CREATIVE_GROUPS,
  "ad-evaluation": AD_EVALUATION_GROUPS,
  "candidate-evaluation": CANDIDATE_EVALUATION_GROUPS,
  instagram: INSTAGRAM_GROUPS
};

// ---- Validation ----

export class ManualEvaluationValidationError extends Error {}

function num(data: Record<string, unknown>, key: string): number | null {
  const raw = data[key];
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function validateManualEvaluationInput(module: ManualEvaluationModule, data: Record<string, unknown>): string | null {
  const groups = MODULE_FIELD_GROUPS[module];
  const validKeys = new Set(groups.flatMap((g) => g.fields.map((f) => f.key)));
  for (const key of Object.keys(data)) {
    if (!validKeys.has(key)) return `Tanınmayan alan: ${key}`;
  }
  for (const group of groups) {
    for (const field of group.fields) {
      const raw = data[field.key];
      if (raw === undefined || raw === null || raw === "") continue; // all non-essential fields optional
      if (field.type === "number" && Number.isNaN(Number(raw))) return `${field.label} sayısal bir değer olmalı.`;
      if (field.type === "date" && Number.isNaN(Date.parse(String(raw)))) return `${field.label} geçerli bir tarih olmalı.`;
      if (field.type === "select" && field.options && !field.options.includes(String(raw))) return `${field.label} için geçersiz seçim.`;
    }
  }
  return null;
}

// ---- Phase 5 derived-metric calculations — only computed when the
// required numerator AND denominator are both present and the
// denominator is non-zero; never a fabricated 0 for missing data. ----

export type DerivedMetric = { label: string; value: number; unit: string; formula: string };

function ratio(n: number | null, d: number | null, multiplier: number): number | null {
  if (n === null || d === null || d === 0) return null;
  return (n / d) * multiplier;
}

export function calculateAdDoctorMetrics(data: Record<string, unknown>): Record<string, DerivedMetric> {
  const spend = num(data, "spend");
  const impressions = num(data, "impressions");
  const clicks = num(data, "clicks");
  const revenue = num(data, "revenue");
  const out: Record<string, DerivedMetric> = {};
  const ctr = ratio(clicks, impressions, 100);
  if (ctr !== null) out.ctr = { label: "CTR", value: ctr, unit: "%", formula: "Tıklama / Gösterim * 100" };
  const cpc = clicks && clicks !== 0 && spend !== null ? spend / clicks : null;
  if (cpc !== null) out.cpc = { label: "CPC", value: cpc, unit: "TL", formula: "Harcama / Tıklama" };
  const cpm = ratio(spend, impressions, 1000);
  if (cpm !== null) out.cpm = { label: "CPM", value: cpm, unit: "TL", formula: "Harcama / Gösterim * 1000" };
  const roas = spend && spend !== 0 && revenue !== null ? revenue / spend : null;
  if (roas !== null) out.roas = { label: "ROAS", value: roas, unit: "x", formula: "Gelir / Harcama" };
  return out;
}

export function calculateAdEvaluationMetrics(data: Record<string, unknown>): Record<string, DerivedMetric> {
  return calculateAdDoctorMetrics(data);
}

export function calculateInstagramMetrics(data: Record<string, unknown>): Record<string, DerivedMetric> {
  const reach = num(data, "accountsReached");
  const interactions = num(data, "totalInteractions");
  const profileVisits = num(data, "profileVisits");
  const websiteClicks = num(data, "websiteClicks");
  const newFollowers = num(data, "newFollowers");
  const startingFollowers = num(data, "startingFollowers");
  const leads = num(data, "leads");

  const out: Record<string, DerivedMetric> = {};
  const engagementByReach = ratio(interactions, reach, 100);
  if (engagementByReach !== null) out.engagementRateByReach = { label: "Erişime Göre Etkileşim Oranı", value: engagementByReach, unit: "%", formula: "Etkileşim / Erişim * 100" };
  const profileVisitRate = ratio(profileVisits, reach, 100);
  if (profileVisitRate !== null) out.profileVisitRate = { label: "Profil Ziyaret Oranı", value: profileVisitRate, unit: "%", formula: "Profil Ziyareti / Erişim * 100" };
  const websiteClickRate = ratio(websiteClicks, profileVisits, 100);
  if (websiteClickRate !== null) out.websiteClickRate = { label: "Website Tıklama Oranı", value: websiteClickRate, unit: "%", formula: "Website Tıklaması / Profil Ziyareti * 100" };
  const followerGrowthRate = ratio(newFollowers, startingFollowers, 100);
  if (followerGrowthRate !== null) out.followerGrowthRate = { label: "Takipçi Büyüme Oranı", value: followerGrowthRate, unit: "%", formula: "Net Yeni Takipçi / Dönem Başı Takipçi * 100" };
  const profileToLeadRate = ratio(leads, profileVisits, 100);
  if (profileToLeadRate !== null) out.profileToLeadRate = { label: "Profilden Lead'e Dönüşüm Oranı", value: profileToLeadRate, unit: "%", formula: "Lead / Profil Ziyareti * 100" };
  return out;
}

export function calculateDerivedMetrics(module: ManualEvaluationModule, data: Record<string, unknown>): Record<string, DerivedMetric> {
  if (module === "ad-doctor") return calculateAdDoctorMetrics(data);
  if (module === "ad-evaluation") return calculateAdEvaluationMetrics(data);
  if (module === "instagram") return calculateInstagramMetrics(data);
  return {};
}

export const MANUAL_EVALUATIONS_TABLE = "manual_evaluations";

export type ManualEvaluationRecord = {
  id: string;
  module: ManualEvaluationModule;
  company_id: string | null;
  lead_id: string | null;
  target_label: string;
  title: string;
  status: "draft" | "submitted";
  data: Record<string, unknown>;
  derived_metrics: Record<string, DerivedMetric>;
  source: "manual" | "claude_import";
  claude_import: { text: string; importedAt: string } | null;
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
