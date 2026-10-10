export const MAX_BUSINESS_CATEGORY_LENGTH = 100;

const GENERIC_BUSINESS_CATEGORY_VALUES = ["diğer", "diger", "other", ""];

export function sanitizeBusinessCategory(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/<[^>]*>/g, "")
    .slice(0, MAX_BUSINESS_CATEGORY_LENGTH);
}

export function isGenericBusinessCategory(value: unknown) {
  return GENERIC_BUSINESS_CATEGORY_VALUES.includes(sanitizeBusinessCategory(value).toLocaleLowerCase("tr"));
}

export function resolvedBusinessCategoryOrFallback(value: unknown, fallback = "belirtilmemiş sektör") {
  const sanitized = sanitizeBusinessCategory(value);
  return isGenericBusinessCategory(sanitized) ? fallback : sanitized;
}

// Paket Öneri Robotu (/teklif-al) "İşletme Türü" step — predefined categories plus
// a manually-typed one when the user picks "Diğer". Kept as plain data/logic
// (no JSX) so it can be unit-tested with the native Node test runner, which
// cannot load .tsx files.
export const OTHER_BUSINESS_TYPE_ID = "other";
export const MIN_CUSTOM_CATEGORY_LENGTH = 2;

export const businessCards = [
  { id: "bakery", label: "Butik Pasta", emoji: "🎂", hint: "Sipariş, özel gün ve yerel talep" },
  { id: "cafe", label: "Kafe", emoji: "☕", hint: "Konum, ziyaret ve sosyal görünürlük" },
  { id: "restaurant", label: "Restoran", emoji: "🍽️", hint: "Rezervasyon, paket servis ve bilinirlik" },
  { id: "health", label: "Sağlık", emoji: "🏥", hint: "Güven, randevu ve bilgilendirme" },
  { id: "real-estate", label: "Emlak", emoji: "🏠", hint: "Portföy, talep ve düzenli takip sistemi" },
  { id: "education", label: "Eğitim", emoji: "🎓", hint: "Başvuru, kayıt ve marka algısı" },
  { id: "ecommerce", label: "E-Ticaret", emoji: "🛒", hint: "Satış hunisi ve yeniden pazarlama" },
  { id: OTHER_BUSINESS_TYPE_ID, label: "Diğer", emoji: "➕", hint: "İhtiyaca göre özel analiz" }
];

// 2026-10-11: expanded sector list, kept as a SEPARATE array behind a
// "Diğer sektörleri göster" toggle in the UI (not merged into
// businessCards above, whose 8 ids/order/count are explicitly unchanged
// per spec) — these appear in a compact, collapsible secondary area.
// Each has its own stable, unique id, never reusing OTHER_BUSINESS_TYPE_ID
// or any existing id — selecting one of these records that real sector
// name, not "Diğer" or free text.
export const extraBusinessCards = [
  { id: "hair-salon", label: "Kuaför & Berber", emoji: "💈", hint: "Randevu, yerel keşif ve düzenli müşteri iletişimi" },
  { id: "beauty-care", label: "Güzellik & Kişisel Bakım", emoji: "💅", hint: "Hizmet tanıtımı, randevu ve marka görünürlüğü" },
  { id: "fitness", label: "Spor & Fitness", emoji: "🏋️", hint: "Üyelik, ders ve yerel topluluk" },
  { id: "hotel", label: "Otel & Konaklama", emoji: "🛎️", hint: "Tesis tanıtımı, rezervasyon ve sezonluk görünürlük" },
  { id: "tourism", label: "Turizm & Seyahat", emoji: "🧭", hint: "Tur, deneyim ve rezervasyon talepleri" },
  { id: "automotive", label: "Otomotiv", emoji: "🚗", hint: "Araç, servis, bakım ve yerel hizmet talepleri" },
  { id: "retail", label: "Perakende & Mağazacılık", emoji: "🛍️", hint: "Ürün tanıtımı, mağaza ziyareti ve kampanyalar" },
  { id: "home-living", label: "Ev & Yaşam", emoji: "🛋️", hint: "Mobilya, dekorasyon ve ev ürünleri tanıtımı" },
  { id: "construction", label: "İnşaat & Tadilat", emoji: "🏗️", hint: "Proje tanıtımı, keşif ve teklif talepleri" },
  { id: "manufacturing", label: "Üretim & Sanayi", emoji: "🏭", hint: "Kurumsal tanıtım, B2B talepler ve teklif süreçleri" },
  { id: "professional-services", label: "Profesyonel Hizmetler & Danışmanlık", emoji: "💼", hint: "Uzmanlık tanıtımı, görüşme ve talep takibi" },
  { id: "technical-services", label: "Teknik Servis & Yerel Hizmetler", emoji: "🔧", hint: "Bölgesel görünürlük, servis ve teklif talepleri" },
  { id: "events", label: "Organizasyon & Etkinlik", emoji: "🎉", hint: "Etkinlik tanıtımı, rezervasyon ve teklif talepleri" },
  { id: "ngo", label: "Dernek & STK", emoji: "🤝", hint: "Faaliyet duyuruları, topluluk ve kurumsal iletişim" }
];

const ALL_BUSINESS_CARDS = [...businessCards, ...extraBusinessCards];

function businessCardLabel(id?: string) {
  return ALL_BUSINESS_CARDS.find((item) => item.id === id)?.label || id || "-";
}

export function normalizeCustomCategory(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, MAX_BUSINESS_CATEGORY_LENGTH);
}

export function isValidCustomCategory(value: string) {
  return normalizeCustomCategory(value).length >= MIN_CUSTOM_CATEGORY_LENGTH;
}

export function resolveBusinessCategory(businessTypeId: string | undefined, customBusinessType: string) {
  if (businessTypeId === OTHER_BUSINESS_TYPE_ID) return normalizeCustomCategory(customBusinessType);
  return businessCardLabel(businessTypeId);
}
