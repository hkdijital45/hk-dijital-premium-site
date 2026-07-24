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

function businessCardLabel(id?: string) {
  return businessCards.find((item) => item.id === id)?.label || id || "-";
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
