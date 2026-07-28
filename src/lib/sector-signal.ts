// Classifies an arbitrary, free-text business sector (predefined label or a
// custom "Diğer" value the user typed) into a small set of strategic
// profiles. This is deliberately NOT an industry database: it exists so the
// package/budget engine and the AI prompt can reason about *why* a sector
// behaves the way it does (customer intent, conversion action, platform
// suitability) instead of only inserting the sector's name into otherwise
// generic text.

export type SectorProfileKey =
  | "local_high_intent"
  | "appointment_visual"
  | "ecommerce_catalogue"
  | "regulated_professional"
  | "education_application"
  | "food_venue"
  | "property_high_consideration"
  | "generic_local";

export type SectorProfile = {
  key: SectorProfileKey;
  competitionMultiplier: number;
  /** Which of the two ad channels this profile naturally leans toward, if any. */
  platformLean: "meta" | "google" | "balanced";
  customerIntent: string;
  conversionFocus: string;
  riskNote: string;
  actionFocus: string;
  extraServices: string[];
};

function tokenize(value: string): string[] {
  return value
    .toLocaleLowerCase("tr")
    .split(/[^a-zçğıöşü]+/i)
    .filter(Boolean);
}

const PROFILE_KEYWORDS: Record<Exclude<SectorProfileKey, "generic_local">, string[]> = {
  regulated_professional: ["diş", "dis", "implant", "ortodonti", "estetik", "klinik", "sağlık", "saglik", "hukuk", "avukat", "muhasebe", "müşavir", "musavir", "noter", "veteriner"],
  local_high_intent: ["oto", "otomotiv", "araç", "arac", "araba", "lastik", "çilingir", "cilingir", "tesisat", "tesisatçı", "tesisatci", "elektrikçi", "elektrikci", "nakliyat", "çekici", "cekici", "servis", "tamir", "tamirci", "tamirhane"],
  appointment_visual: ["güzellik", "guzellik", "kuaför", "kuafor", "nail", "berber", "spa", "masaj", "dövme", "dovme", "estetisyen", "makyaj", "salon", "salonu"],
  ecommerce_catalogue: ["eticaret", "ticaret", "mağaza", "magaza", "butik", "katalog", "online"],
  education_application: ["kurs", "eğitim", "egitim", "okul", "akademi", "dershane", "üniversite", "universite"],
  food_venue: ["restoran", "cafe", "kafe", "pastane", "fırın", "firin", "catering", "mekan", "bar"],
  property_high_consideration: ["emlak", "gayrimenkul", "villa", "konut", "inşaat", "insaat", "mimarlık", "mimarlik"]
};

// Priority order matters when a sector name could plausibly match more than
// one keyword set (e.g. a name containing both a health and a beauty word).
const PROFILE_PRIORITY: SectorProfileKey[] = [
  "regulated_professional",
  "property_high_consideration",
  "education_application",
  "local_high_intent",
  "appointment_visual",
  "food_venue",
  "ecommerce_catalogue"
];

export function classifySectorProfile(sector?: string): SectorProfileKey {
  const tokens = new Set(tokenize(String(sector || "")));
  if (!tokens.size) return "generic_local";
  for (const profile of PROFILE_PRIORITY) {
    if (PROFILE_KEYWORDS[profile].some((keyword) => tokens.has(keyword))) return profile;
  }
  return "generic_local";
}

const SECTOR_PROFILES: Record<SectorProfileKey, SectorProfile> = {
  local_high_intent: {
    key: "local_high_intent",
    competitionMultiplier: 1.22,
    platformLean: "google",
    customerIntent: "yüksek niyetli, acil/yerel arama davranışı (\"yakınımda\", telefon veya yol tarifi arayan müşteri)",
    conversionFocus: "telefon araması, yol tarifi ve randevu/servis talebi",
    riskNote: "Google puanı ve müşteri yorumları dönüşümü doğrudan etkiler; düşük puan reklam performansını baskılar.",
    actionFocus: "hizmet bölgesi hedefleme ve arama niyeti odaklı anahtar kelime kurulumu",
    extraServices: ["Google İşletme Profili optimizasyonu", "Arama reklamlarında çağrı takibi kurulumu"]
  },
  appointment_visual: {
    key: "appointment_visual",
    competitionMultiplier: 1.12,
    platformLean: "meta",
    customerIntent: "görsel keşif ve ilham arayışı; sonucu görmeden karar vermeyen müşteri",
    conversionFocus: "DM/WhatsApp üzerinden randevu talebi ve form doldurma",
    riskNote: "Kreatif ve görsel kalitesi düşükse dönüşüm oranı hızla düşer; öncesi/sonrası içerikte izin ve etik sınırlara dikkat edilmelidir.",
    actionFocus: "görsel kreatif test planı ve tekrar ziyaret için yeniden pazarlama kurgusu",
    extraServices: ["Aylık içerik ve reels çekim planı", "Öncesi/sonrası galeri ve yorum yönetimi"]
  },
  ecommerce_catalogue: {
    key: "ecommerce_catalogue",
    competitionMultiplier: 1.12,
    platformLean: "balanced",
    customerIntent: "ürün/fiyat karşılaştırma davranışı; sepet terk etme riski yüksek",
    conversionFocus: "satın alma ve sepete ekleme",
    riskNote: "Ürün görseli, fiyat netliği ve teslimat/güven bilgisi eksikse dönüşüm düşer.",
    actionFocus: "katalog kurulumu ve satın alma/sepet izleme",
    extraServices: ["Dinamik ürün reklamları ve katalog entegrasyonu", "Terk edilen sepet için yeniden pazarlama"]
  },
  regulated_professional: {
    key: "regulated_professional",
    competitionMultiplier: 1.35,
    platformLean: "google",
    customerIntent: "güven ve uzmanlık arayışı; karar süreci genellikle daha uzun ve araştırma yoğun",
    conversionFocus: "randevu veya ön görüşme talebi",
    riskNote: "Sektöre özgü reklam, etik ve mevzuat kısıtları göz önünde bulundurulmalı; kesin sonuç/iyileşme vaadi verilmemelidir.",
    actionFocus: "güven inşa eden içerik ve randevu formu optimizasyonu",
    extraServices: ["Danışan/hasta yorumlarının şeffaf yönetimi", "Ön bilgilendirme ve randevu formu sayfası"]
  },
  education_application: {
    key: "education_application",
    competitionMultiplier: 1.22,
    platformLean: "google",
    customerIntent: "dönemsel/sezonluk kayıt kararı; karşılaştırmalı araştırma",
    conversionFocus: "başvuru formu ve bilgi talebi",
    riskNote: "Kayıt dönemleri dışında talep düşebilir; bütçe zamanlaması kayıt takvimine göre ayarlanmalıdır.",
    actionFocus: "başvuru huninin izlenmesi ve dönem bazlı kampanya planı",
    extraServices: ["Başvuru formu optimizasyonu", "Kayıt dönemi kampanya takvimi"]
  },
  food_venue: {
    key: "food_venue",
    competitionMultiplier: 1.12,
    platformLean: "meta",
    customerIntent: "görsel keşif ve konum bazlı anlık karar",
    conversionFocus: "rezervasyon, yol tarifi ve paket sipariş",
    riskNote: "Menü ve mekan görselleri güncel değilse güven kaybı yaşanır.",
    actionFocus: "konum bazlı hedefleme ve görsel içerik testleri",
    extraServices: ["Google İşletme Profili ve harita optimizasyonu", "Menü/görsel içerik yenileme planı"]
  },
  property_high_consideration: {
    key: "property_high_consideration",
    competitionMultiplier: 1.22,
    platformLean: "google",
    customerIntent: "uzun karar süreci; yüksek bütçeli ve araştırma yoğun",
    conversionFocus: "portföy incelemesi ve görüşme talebi",
    riskNote: "Kısa vadede sonuç beklemek yanıltıcı olur; düzenli takip süreci kritik önemdedir.",
    actionFocus: "nitelikli talep filtreleme ve düzenli takip süreci",
    extraServices: ["Portföy/ilan sayfası optimizasyonu", "Uzun soluklu yeniden pazarlama kurgusu"]
  },
  generic_local: {
    key: "generic_local",
    competitionMultiplier: 1,
    platformLean: "balanced",
    customerIntent: "yerel farkındalık ve doğrudan talep",
    conversionFocus: "mesaj, arama veya form ile iletişim",
    riskNote: "Sektöre özgü veri sınırlıdır; ilk 30 günde test ve öğrenme önceliklendirilmelidir.",
    actionFocus: "genel performans testi ve optimizasyon",
    extraServices: []
  }
};

export function getSectorProfile(sector?: string): SectorProfile {
  return SECTOR_PROFILES[classifySectorProfile(sector)];
}
