import type { PackageItem } from "./types";

export type PackageCategoryKey = "meta" | "google_ads" | "combined_ads" | "social_media";
export type PackageTier = "Starter" | "Pro" | "Premium";

export type ServicePackageFeature = {
  label: string;
  value: string;
};

export type ServicePackage = {
  slug: string;
  category: PackageCategoryKey;
  categoryLabel: string;
  tier: PackageTier;
  name: string;
  title: string;
  description: string;
  idealFor: string;
  basePrice?: number;
  monthlyPrice: number;
  vatRate?: number;
  currency: "TRY";
  taxLabel?: "KDV";
  billingPeriod?: "monthly";
  vatMode?: "plus_vat" | "included_vat";
  taxNote: string;
  popular?: boolean;
  features: ServicePackageFeature[];
  setupRoadmap: string[];
};

export type PackagePricing = {
  basePrice: number;
  vatRate: number;
  vatAmount: number;
  totalWithVat: number;
  currency: "TRY";
  taxLabel: "KDV";
  billingPeriod: "monthly";
  vatMode: "plus_vat" | "included_vat";
  priceDisplay: string;
  totalDisplay: string;
  vatDisplay: string;
};

export type AdBudgetEstimate = {
  minimumRange: [number, number];
  idealRange: [number, number];
  aggressiveRange: [number, number];
  dailyAverageRange: [number, number];
  platformSplit: Array<{ label: string; percent: number; note?: string }>;
  reason: string;
  first30DaysPlan: string[];
  notes: string[];
  extraServices: string[];
  budgetFit: string;
};

const DEFAULT_VAT_RATE = 0.2;

export const PACKAGE_CATEGORIES: Array<{ key: PackageCategoryKey; label: string; shortLabel: string; description: string }> = [
  { key: "meta", label: "Meta Reklam Yönetimi", shortLabel: "Meta Reklam", description: "Instagram ve Facebook reklamlarını ölçüm, kreatif ve optimizasyon disipliniyle yönetin." },
  { key: "google_ads", label: "Google Ads Reklam Yönetimi", shortLabel: "Google Ads", description: "Arama niyeti, görüntülü reklam ve video kampanyaları için yapılandırılmış Google Ads yönetimi." },
  { key: "combined_ads", label: "Meta + Google Ads Kombin Yönetimi", shortLabel: "Kombin", description: "Meta ve Google reklamlarını tek büyüme planında birleştiren performans paketi." },
  { key: "social_media", label: "Sosyal Medya Yönetimi", shortLabel: "Sosyal Medya", description: "İçerik takvimi, sayfa optimizasyonu ve düzenli marka görünürlüğü için sosyal medya yönetimi." }
];

const roadmaps: Record<PackageTier, string[]> = {
  Starter: ["İlk hedef ve ölçüm kontrolü", "Temel kampanya / içerik kurulumu", "Aylık özet rapor ve sonraki adım"],
  Pro: ["Strateji ve test planı", "Haftalık optimizasyon", "Detaylı aylık rapor ve aksiyon planı"],
  Premium: ["Büyüme ve ölçekleme planı", "Gelişmiş segment / kreatif testleri", "Yorumlu rapor ve stratejik 30 günlük plan"]
};

export const HK_SERVICE_PACKAGES: ServicePackage[] = [
  {
    slug: "meta-starter",
    category: "meta",
    categoryLabel: "Meta Reklam Yönetimi",
    tier: "Starter",
    name: "Starter",
    title: "Meta Starter",
    description: "Instagram ve Facebook reklamlarına kontrollü başlangıç yapmak isteyen işletmeler için temel yönetim.",
    idealFor: "Yeni başlayan, tek ana hedefe odaklanan işletmeler.",
    monthlyPrice: 8000,
    currency: "TRY",
    taxNote: "+ KDV",
    features: [
      { label: "Kampanya Yapısı", value: "Tek kampanya" },
      { label: "Hedef Kitle Çalışması", value: "Temel hedefleme" },
      { label: "Reklam Kreatif Desteği", value: "Mevcut içerik uyarlama" },
      { label: "Reklam Metni", value: "Temel metin" },
      { label: "Optimizasyon Sıklığı", value: "Aylık" },
      { label: "Raporlama", value: "Aylık özet" },
      { label: "Strateji Desteği", value: "Yok" }
    ],
    setupRoadmap: roadmaps.Starter
  },
  {
    slug: "meta-pro",
    category: "meta",
    categoryLabel: "Meta Reklam Yönetimi",
    tier: "Pro",
    name: "Pro",
    title: "Meta Pro",
    description: "Birden fazla kampanya, kreatif testi ve haftalık optimizasyon isteyen büyüme odaklı işletmeler için.",
    idealFor: "Düzenli lead, mesaj veya satış hedefi olan aktif işletmeler.",
    monthlyPrice: 12000,
    currency: "TRY",
    taxNote: "+ KDV",
    popular: true,
    features: [
      { label: "Kampanya Yapısı", value: "Çoklu kampanya" },
      { label: "Hedef Kitle Çalışması", value: "Test + optimizasyon" },
      { label: "Reklam Kreatif Desteği", value: "Kreatif yönlendirme + test" },
      { label: "Reklam Metni", value: "Varyasyonlu metin" },
      { label: "Optimizasyon Sıklığı", value: "Haftalık" },
      { label: "Raporlama", value: "Detaylı aylık" },
      { label: "Strateji Desteği", value: "Var" }
    ],
    setupRoadmap: roadmaps.Pro
  },
  {
    slug: "meta-premium",
    category: "meta",
    categoryLabel: "Meta Reklam Yönetimi",
    tier: "Premium",
    name: "Premium",
    title: "Meta Premium",
    description: "Gelişmiş yeniden pazarlama, kreatif strateji ve ölçekleme isteyen markalar için kapsamlı yönetim.",
    idealFor: "Büyüme, ölçekleme ve yorumlu raporlama isteyen markalar.",
    monthlyPrice: 20000,
    currency: "TRY",
    taxNote: "+ KDV",
    features: [
      { label: "Kampanya Yapısı", value: "Stratejik çoklu kampanya" },
      { label: "Hedef Kitle Çalışması", value: "Gelişmiş + remarketing" },
      { label: "Reklam Kreatif Desteği", value: "Kreatif strateji + test planı" },
      { label: "Reklam Metni", value: "Stratejik metin kurgusu" },
      { label: "Optimizasyon Sıklığı", value: "Haftalık + ölçekleme" },
      { label: "Raporlama", value: "Detaylı + yorumlu" },
      { label: "Strateji Desteği", value: "Var" }
    ],
    setupRoadmap: roadmaps.Premium
  },
  {
    slug: "google-ads-starter",
    category: "google_ads",
    categoryLabel: "Google Ads Reklam Yönetimi",
    tier: "Starter",
    name: "Starter",
    title: "Google Ads Starter",
    description: "Arama ağı reklamlarıyla hizmet arayan kitlelere kontrollü başlangıç paketi.",
    idealFor: "Temel arama reklamı ve aylık takip isteyen işletmeler.",
    monthlyPrice: 8000,
    currency: "TRY",
    taxNote: "+ KDV",
    features: [
      { label: "Reklam Türleri", value: "Arama Ağı" },
      { label: "Anahtar Kelime Çalışması", value: "Temel" },
      { label: "Reklam Metni & Uzantılar", value: "Temel" },
      { label: "Optimizasyon", value: "Aylık" },
      { label: "Strateji Desteği", value: "Yok" },
      { label: "Raporlama", value: "Aylık özet" }
    ],
    setupRoadmap: roadmaps.Starter
  },
  {
    slug: "google-ads-pro",
    category: "google_ads",
    categoryLabel: "Google Ads Reklam Yönetimi",
    tier: "Pro",
    name: "Pro",
    title: "Google Ads Pro",
    description: "Arama ve görüntülü reklamları haftalık optimizasyonla yönetmek isteyen işletmeler için.",
    idealFor: "Düzenli talep üretimi ve optimizasyon isteyen işletmeler.",
    monthlyPrice: 12000,
    currency: "TRY",
    taxNote: "+ KDV",
    popular: true,
    features: [
      { label: "Reklam Türleri", value: "Arama + Görüntülü" },
      { label: "Anahtar Kelime Çalışması", value: "Gelişmiş" },
      { label: "Reklam Metni & Uzantılar", value: "Optimize" },
      { label: "Optimizasyon", value: "Haftalık" },
      { label: "Strateji Desteği", value: "Var" },
      { label: "Raporlama", value: "Detaylı aylık" }
    ],
    setupRoadmap: roadmaps.Pro
  },
  {
    slug: "google-ads-premium",
    category: "google_ads",
    categoryLabel: "Google Ads Reklam Yönetimi",
    tier: "Premium",
    name: "Premium",
    title: "Google Ads Premium",
    description: "Arama, görüntülü ve video kampanyalarını stratejik ölçeklemeyle büyütmek isteyen markalar için.",
    idealFor: "Çok kanallı Google reklam büyümesi isteyen markalar.",
    monthlyPrice: 20000,
    currency: "TRY",
    taxNote: "+ KDV",
    features: [
      { label: "Reklam Türleri", value: "Arama + Görüntülü + Video" },
      { label: "Anahtar Kelime Çalışması", value: "Stratejik" },
      { label: "Reklam Metni & Uzantılar", value: "Stratejik" },
      { label: "Optimizasyon", value: "Haftalık + ölçekleme" },
      { label: "Strateji Desteği", value: "Var" },
      { label: "Raporlama", value: "Detaylı + yorumlu" }
    ],
    setupRoadmap: roadmaps.Premium
  },
  {
    slug: "combined-ads-starter",
    category: "combined_ads",
    categoryLabel: "Meta + Google Ads Kombin Yönetimi",
    tier: "Starter",
    name: "Starter",
    title: "Kombin Starter",
    description: "Meta ve Google reklamlarını temel planlama ile birlikte başlatmak isteyen işletmeler için.",
    idealFor: "İki platformda kontrollü başlangıç isteyen işletmeler.",
    monthlyPrice: 14000,
    currency: "TRY",
    taxNote: "+ KDV",
    features: [
      { label: "Platform Yönetimi", value: "Meta + Google temel" },
      { label: "Reklam & Strateji Yapısı", value: "Temel planlama" },
      { label: "Reklam Kreatif Desteği", value: "Uyarlama" },
      { label: "Optimizasyon", value: "Aylık" },
      { label: "Raporlama", value: "Aylık özet" },
      { label: "Strateji Desteği", value: "Yok" }
    ],
    setupRoadmap: roadmaps.Starter
  },
  {
    slug: "combined-ads-pro",
    category: "combined_ads",
    categoryLabel: "Meta + Google Ads Kombin Yönetimi",
    tier: "Pro",
    name: "Pro",
    title: "Kombin Pro",
    description: "Meta ve Google reklamlarını performans odaklı test, optimizasyon ve raporlamayla birlikte yönetir.",
    idealFor: "Çift kanal performans ve düzenli strateji isteyen işletmeler.",
    monthlyPrice: 20000,
    currency: "TRY",
    taxNote: "+ KDV",
    popular: true,
    features: [
      { label: "Platform Yönetimi", value: "Meta + Google optimize" },
      { label: "Reklam & Strateji Yapısı", value: "Performans odaklı" },
      { label: "Reklam Kreatif Desteği", value: "Yönlendirme + test" },
      { label: "Optimizasyon", value: "Haftalık" },
      { label: "Raporlama", value: "Detaylı aylık" },
      { label: "Strateji Desteği", value: "Var" }
    ],
    setupRoadmap: roadmaps.Pro
  },
  {
    slug: "combined-ads-premium",
    category: "combined_ads",
    categoryLabel: "Meta + Google Ads Kombin Yönetimi",
    tier: "Premium",
    name: "Premium",
    title: "Kombin Premium",
    description: "Meta ve Google reklamlarını büyüme, ölçekleme ve stratejik kreatif planla uçtan uca yönetir.",
    idealFor: "Ajans disiplininde çok kanallı büyüme isteyen markalar.",
    monthlyPrice: 32000,
    currency: "TRY",
    taxNote: "+ KDV",
    features: [
      { label: "Platform Yönetimi", value: "Meta + Google uçtan uca" },
      { label: "Reklam & Strateji Yapısı", value: "Büyüme & ölçekleme" },
      { label: "Reklam Kreatif Desteği", value: "Stratejik kreatif plan" },
      { label: "Optimizasyon", value: "Haftalık + stratejik" },
      { label: "Raporlama", value: "Detaylı + yorumlu" },
      { label: "Strateji Desteği", value: "Var" }
    ],
    setupRoadmap: roadmaps.Premium
  },
  {
    slug: "social-media-starter",
    category: "social_media",
    categoryLabel: "Sosyal Medya Yönetimi",
    tier: "Starter",
    name: "Starter Paket",
    title: "Sosyal Medya Starter",
    description: "Düzenli görünürlük ve temel içerik takvimi isteyen işletmeler için başlangıç paketi.",
    idealFor: "Sosyal medyada düzenli görünürlük isteyen işletmeler.",
    monthlyPrice: 7500,
    currency: "TRY",
    taxNote: "",
    features: [
      { label: "Aylık Strateji", value: "Temel" },
      { label: "Aylık İçerik Sayısı", value: "8" },
      { label: "İçerik Türü", value: "Görsel + Metin" },
      { label: "İçerik Takvimi", value: "Temel" },
      { label: "Tasarım Desteği", value: "Canva" },
      { label: "Reels / Video Planı", value: "Yok" },
      { label: "Sayfa Optimizasyonu", value: "Temel" },
      { label: "Performans Raporu", value: "Aylık temel" },
      { label: "Hedef", value: "Düzenli görünürlük" }
    ],
    setupRoadmap: roadmaps.Starter
  },
  {
    slug: "social-media-pro",
    category: "social_media",
    categoryLabel: "Sosyal Medya Yönetimi",
    tier: "Pro",
    name: "Pro Paket",
    title: "Sosyal Medya Pro",
    description: "Haftalık içerik akışı, gelişmiş sayfa optimizasyonu ve etkileşim büyümesi isteyen işletmeler için.",
    idealFor: "Etkileşim ve büyüme hedefi olan işletmeler.",
    monthlyPrice: 12500,
    currency: "TRY",
    taxNote: "",
    popular: true,
    features: [
      { label: "Aylık Strateji", value: "Detaylı" },
      { label: "Aylık İçerik Sayısı", value: "12" },
      { label: "İçerik Türü", value: "Görsel + Metin" },
      { label: "İçerik Takvimi", value: "Haftalık" },
      { label: "Tasarım Desteği", value: "Canva + Pro araçlar" },
      { label: "Reels / Video Planı", value: "Var, çekim hariç" },
      { label: "Sayfa Optimizasyonu", value: "Gelişmiş" },
      { label: "Performans Raporu", value: "Aylık detaylı" },
      { label: "Hedef", value: "Etkileşim ve büyüme" }
    ],
    setupRoadmap: roadmaps.Pro
  },
  {
    slug: "social-media-premium",
    category: "social_media",
    categoryLabel: "Sosyal Medya Yönetimi",
    tier: "Premium",
    name: "Premium Paket",
    title: "Sosyal Medya Premium",
    description: "Marka algısı, profesyonel konsept ve güçlü konumlama isteyen işletmeler için sosyal medya yönetimi.",
    idealFor: "Marka algısı ve güçlü konumlama isteyen işletmeler.",
    monthlyPrice: 18000,
    currency: "TRY",
    taxNote: "",
    features: [
      { label: "Aylık Strateji", value: "Markaya özel" },
      { label: "Aylık İçerik Sayısı", value: "16" },
      { label: "İçerik Türü", value: "Görsel + Metin" },
      { label: "İçerik Takvimi", value: "Gelişmiş" },
      { label: "Tasarım Desteği", value: "Profesyonel konsept" },
      { label: "Reels / Video Planı", value: "Var, çekim hariç" },
      { label: "Sayfa Optimizasyonu", value: "Tam" },
      { label: "Performans Raporu", value: "Aylık detaylı + strateji" },
      { label: "Hedef", value: "Marka algısı ve güçlü konumlama" }
    ],
    setupRoadmap: roadmaps.Premium
  }
];

export function formatTRY(amount: number) {
  return `${Math.round(Number(amount || 0)).toLocaleString("tr-TR")} TL`;
}

export function calculateVat(basePrice: number, vatRate = DEFAULT_VAT_RATE) {
  return Math.round(Number(basePrice || 0) * vatRate);
}

export function calculateTotalWithVat(basePrice: number, vatRate = DEFAULT_VAT_RATE) {
  return Math.round(Number(basePrice || 0) + calculateVat(basePrice, vatRate));
}

export function normalizePackageSlug(value?: string) {
  return String(value || "").trim().toLocaleLowerCase("tr").replace(/\s+/g, "-");
}

export function getPackageBySlug(slug?: string) {
  const normalized = normalizePackageSlug(slug);
  if (!normalized) return null;
  return HK_SERVICE_PACKAGES.find((pkg) => normalizePackageSlug(pkg.slug) === normalized) || null;
}

export function getPackagePricing(pkgOrSlug?: ServicePackage | string | null): PackagePricing | null {
  const pkg = typeof pkgOrSlug === "string" ? getPackageBySlug(pkgOrSlug) || findServicePackage(pkgOrSlug) : pkgOrSlug;
  if (!pkg) return null;
  const basePrice = Number(pkg.basePrice ?? pkg.monthlyPrice ?? 0);
  const vatRate = Number(pkg.vatRate ?? DEFAULT_VAT_RATE);
  const vatMode = pkg.vatMode || "plus_vat";
  const vatAmount = vatMode === "included_vat" ? Math.round(basePrice - basePrice / (1 + vatRate)) : calculateVat(basePrice, vatRate);
  const totalWithVat = vatMode === "included_vat" ? basePrice : calculateTotalWithVat(basePrice, vatRate);
  return {
    basePrice,
    vatRate,
    vatAmount,
    totalWithVat,
    currency: pkg.currency || "TRY",
    taxLabel: pkg.taxLabel || "KDV",
    billingPeriod: pkg.billingPeriod || "monthly",
    vatMode,
    priceDisplay: vatMode === "included_vat" ? `${formatTRY(basePrice)} KDV dahil` : `${formatTRY(basePrice)} + KDV`,
    totalDisplay: `${formatTRY(totalWithVat)} KDV dahil`,
    vatDisplay: `${formatTRY(vatAmount)} KDV`
  };
}

export function formatPackagePrice(pkg: ServicePackage) {
  return getPackagePricing(pkg)?.priceDisplay || `${pkg.monthlyPrice.toLocaleString("tr-TR")} TL${pkg.taxNote ? ` ${pkg.taxNote}` : ""}`;
}

export function servicePackagesByCategory(category: PackageCategoryKey) {
  return HK_SERVICE_PACKAGES.filter((pkg) => pkg.category === category);
}

export function findServicePackage(slugOrName?: string, category?: string) {
  const needle = String(slugOrName || "").toLocaleLowerCase("tr");
  if (!needle) return null;
  return HK_SERVICE_PACKAGES.find((pkg) => {
    const matchesName = [pkg.slug, pkg.name, pkg.title].some((value) => value.toLocaleLowerCase("tr") === needle);
    const matchesCategory = !category || pkg.category === category || pkg.categoryLabel.toLocaleLowerCase("tr") === String(category).toLocaleLowerCase("tr");
    return matchesName && matchesCategory;
  }) || HK_SERVICE_PACKAGES.find((pkg) => [pkg.slug, pkg.name, pkg.title].some((value) => value.toLocaleLowerCase("tr").includes(needle)));
}

export function packageToSiteItem(pkg: ServicePackage, order: number): PackageItem {
  const pricing = getPackagePricing(pkg);
  return {
    id: pkg.slug,
    name: pkg.title,
    price: pricing?.priceDisplay || formatPackagePrice(pkg),
    description: pkg.description,
    features: [
      `İdeal müşteri: ${pkg.idealFor}`,
      ...pkg.features.map((feature) => `${feature.label}: ${feature.value}`)
    ],
    recommended: Boolean(pkg.popular),
    visible: true,
    cta: "Bu Paketi Seç",
    order
  };
}

export const SITE_PACKAGE_ITEMS: PackageItem[] = HK_SERVICE_PACKAGES.map(packageToSiteItem);

export type PackageRecommendationInput = {
  sector?: string;
  goal?: string;
  platform?: string;
  budget?: string | number;
  contentNeed?: string;
  urgency?: string;
  socialStatus?: string;
};

export const CONTENT_NEED_OPTIONS = [
  { value: "low", label: "Az İçerik Yeterli", description: "Mevcut görseller ve temel metinlerle ilerleyebiliriz" },
  { value: "medium", label: "Düzenli İçerik Gerekli", description: "Aylık planlı içerik ve tasarım desteği gerekir" },
  { value: "high", label: "Yoğun İçerik ve Kreatif Gerekli", description: "Reklam kreatifleri, Reels planı ve güçlü görsel dil gerekir" }
] as const;

export const URGENCY_OPTIONS = [
  { value: "immediate", label: "Hemen Başlamak İstiyorum", description: "0-7 gün içinde kurulum ve başlangıç" },
  { value: "this_month", label: "Bu Ay İçinde Başlayalım", description: "Önümüzdeki 2-4 hafta içinde planlı başlangıç" },
  { value: "planning", label: "Önce Planlama Yapmak İstiyorum", description: "Strateji, bütçe ve içerik hazırlığı netleşsin" }
] as const;

export const SOCIAL_STATUS_OPTIONS = [
  { value: "new", label: "Yeni Başlıyoruz", description: "Hesap yeni veya düzenli içerik geçmişi yok" },
  { value: "irregular", label: "Düzensiz İlerliyoruz", description: "Paylaşımlar var ama planlı değil" },
  { value: "stable_not_growing", label: "Düzenli Ama Büyümüyor", description: "İçerik var fakat etkileşim ve dönüşüm düşük" },
  { value: "growth", label: "Aktif Büyüme İstiyoruz", description: "Düzenli yapı var, artık ölçekleme hedefleniyor" }
] as const;

function normalizeChoice(value: string | undefined, aliases: Record<string, string>) {
  const key = String(value || "").trim().toLocaleLowerCase("tr").replace(/\s+/g, "_");
  return aliases[key] || aliases[key.replace(/-/g, "_")] || key;
}

export function normalizeContentNeed(value?: string) {
  return normalizeChoice(value, {
    düşük: "low",
    dusuk: "low",
    low: "low",
    az_içerik_yeterli: "low",
    az_icerik_yeterli: "low",
    orta: "medium",
    medium: "medium",
    düzenli_içerik_gerekli: "medium",
    duzenli_icerik_gerekli: "medium",
    yüksek: "high",
    yuksek: "high",
    high: "high",
    yoğun_içerik_ve_kreatif_gerekli: "high",
    yogun_icerik_ve_kreatif_gerekli: "high"
  });
}

export function normalizeUrgency(value?: string) {
  return normalizeChoice(value, {
    acil: "immediate",
    urgent: "immediate",
    immediate: "immediate",
    hemen: "immediate",
    hemen_başlamak_istiyorum: "immediate",
    hemen_baslamak_istiyorum: "immediate",
    bu_ay: "this_month",
    this_month: "this_month",
    "30_gün_içinde": "this_month",
    "30_gun_icinde": "this_month",
    within_30_days: "this_month",
    planlama: "planning",
    planning: "planning",
    önce_planlama_yapmak_istiyorum: "planning",
    once_planlama_yapmak_istiyorum: "planning"
  });
}

export function normalizeSocialStatus(value?: string) {
  return normalizeChoice(value, {
    yeni: "new",
    new: "new",
    yeni_başlıyoruz: "new",
    yeni_basliyoruz: "new",
    düzensiz: "irregular",
    duzensiz: "irregular",
    irregular: "irregular",
    düzensiz_ilerliyoruz: "irregular",
    duzensiz_ilerliyoruz: "irregular",
    düzenli_ama_büyümüyor: "stable_not_growing",
    duzenli_ama_buyumuyor: "stable_not_growing",
    stable_not_growing: "stable_not_growing",
    aktif_ve_büyüme_istiyor: "growth",
    aktif_ve_buyume_istiyor: "growth",
    aktif_büyüme_istiyoruz: "growth",
    aktif_buyume_istiyoruz: "growth",
    growth: "growth"
  });
}

export function packageChoiceLabel(type: "content" | "urgency" | "social", value?: string) {
  const normalized = type === "content" ? normalizeContentNeed(value) : type === "urgency" ? normalizeUrgency(value) : normalizeSocialStatus(value);
  const options = type === "content" ? CONTENT_NEED_OPTIONS : type === "urgency" ? URGENCY_OPTIONS : SOCIAL_STATUS_OPTIONS;
  return options.find((option) => option.value === normalized)?.label || value || "-";
}

function budgetNumber(value?: string | number) {
  if (typeof value === "number") return value;
  return Number(String(value || "").replace(/[^\d]/g, "")) || 0;
}

function recommendationCategory(platform: string): PackageCategoryKey {
  const normalized = String(platform || "").toLocaleLowerCase("tr");
  return normalized.includes("hepsi") || normalized.includes("kombin") || normalized.includes("meta + google")
    ? "combined_ads"
    : normalized.includes("google")
      ? "google_ads"
      : normalized.includes("sosyal") || normalized.includes("içerik")
        ? "social_media"
        : "meta";
}

export function getCompetitionMultiplier(sector?: string) {
  const normalized = String(sector || "").toLocaleLowerCase("tr");
  if (/(diş|dis|implant|ortodonti|estetik|plastik cerrahi|saç ekim|sac ekim|klinik|sağlık|saglik|hukuk|avukat)/.test(normalized)) return 1.35;
  if (/(emlak|gayrimenkul|otomotiv|araba|oto|turizm|otel|villa|kurs|eğitim|egitim)/.test(normalized)) return 1.22;
  if (/(restoran|cafe|kafe|güzellik|guzellik|nail|kuaför|kuafor|spor|e-ticaret|eticaret|e ticaret)/.test(normalized)) return 1.12;
  return 1;
}

export function getPlatformBudgetSplit(platformNeed?: string, goal?: string) {
  const platform = String(platformNeed || "").toLocaleLowerCase("tr");
  const normalizedGoal = String(goal || "").toLocaleLowerCase("tr");
  if (platform.includes("hepsi") || platform.includes("kombin") || platform.includes("meta + google")) {
    return [
      { label: "Meta Ads", percent: 40, note: "Talep oluşturma, kreatif test ve yeniden pazarlama için." },
      { label: "Google Ads", percent: 35, note: "Aktif arama niyeti ve dönüşüm odaklı kampanyalar için." },
      { label: "Kreatif test", percent: 15, note: "Mesaj, görsel ve teklif varyasyonlarını ölçmek için." },
      { label: "Remarketing", percent: 10, note: "Ziyaretçi ve etkileşim kitlelerini tekrar yakalamak için." }
    ];
  }
  if (platform.includes("google")) {
    return [
      { label: "Google Ads", percent: normalizedGoal.includes("bilinir") ? 75 : 85, note: "Arama niyeti, lead veya randevu talebi için ana bütçe." },
      { label: "Remarketing", percent: normalizedGoal.includes("bilinir") ? 25 : 15, note: "Site ziyaretçilerini tekrar kampanyaya dahil etmek için." }
    ];
  }
  if (platform.includes("sosyal") || platform.includes("içerik")) {
    return [
      { label: "Sosyal içerik destek", percent: 55, note: "Düzenli görünürlük ve etkileşim ritmi için." },
      { label: "Kreatif test", percent: 30, note: "Reels, görsel ve metin konseptlerini denemek için." },
      { label: "Remarketing", percent: 15, note: "Profil ve web etkileşimi olan kitleleri tekrar yakalamak için." }
    ];
  }
  return [
    { label: "Meta Ads", percent: 80, note: "Mesaj, lead, satış veya bilinirlik kampanyaları için ana bütçe." },
    { label: "Kreatif test", percent: 20, note: "Farklı görsel, metin ve teklif açılarını ölçmek için." }
  ];
}

export function formatBudgetRange(min: number, max: number) {
  return `${formatTRY(min)} - ${formatTRY(max)} / ay`;
}

export function estimateAdBudget(input: PackageRecommendationInput): AdBudgetEstimate {
  const category = recommendationCategory(String(input.platform || ""));
  const goal = String(input.goal || "").toLocaleLowerCase("tr");
  const contentNeed = normalizeContentNeed(input.contentNeed);
  const urgency = normalizeUrgency(input.urgency);
  const socialStatus = normalizeSocialStatus(input.socialStatus);
  const multiplierBase = getCompetitionMultiplier(input.sector);
  const goalMultiplier = goal.includes("büyü") || goal.includes("ölçek") || goal.includes("olcek")
    ? 1.28
    : goal.includes("satış") || goal.includes("satis") || goal.includes("lead")
      ? 1.2
      : goal.includes("randevu") || goal.includes("mesaj")
        ? 1.12
        : goal.includes("bilinir")
          ? 0.95
          : 1;
  const growthMultiplier = socialStatus === "growth" ? 1.14 : socialStatus === "stable_not_growing" ? 1.08 : 1;
  const timingMultiplier = urgency === "immediate" ? 1.08 : urgency === "planning" ? 0.92 : 1;
  const contentMultiplier = contentNeed === "high" ? 1.1 : 1;
  const multiplier = multiplierBase * goalMultiplier * growthMultiplier * timingMultiplier * contentMultiplier;
  const baseRanges: Record<PackageCategoryKey, { minimum: [number, number]; ideal: [number, number]; aggressive: [number, number] }> = {
    meta: { minimum: [6000, 8000], ideal: [10000, 15000], aggressive: [20000, 30000] },
    google_ads: { minimum: [8000, 12000], ideal: [15000, 25000], aggressive: [35000, 50000] },
    combined_ads: { minimum: [15000, 20000], ideal: [25000, 40000], aggressive: [50000, 80000] },
    social_media: { minimum: [4000, 6000], ideal: [8000, 12000], aggressive: [16000, 25000] }
  };
  const scaleRange = ([min, max]: [number, number]): [number, number] => [Math.round(min * multiplier / 500) * 500, Math.round(max * multiplier / 500) * 500];
  const minimumRange = scaleRange(baseRanges[category].minimum);
  const idealRange = scaleRange(baseRanges[category].ideal);
  const aggressiveRange = scaleRange(baseRanges[category].aggressive);
  const selectedBudget = budgetNumber(input.budget);
  const budgetFit = selectedBudget && selectedBudget < minimumRange[0]
    ? "Bu bütçeyle başlanabilir ancak test süresi uzayabilir."
    : selectedBudget && selectedBudget >= aggressiveRange[0]
      ? "Ölçekleme için uygun; kontrollü kampanya yapısı önerilir."
      : selectedBudget && selectedBudget >= idealRange[0]
        ? "Test ve optimizasyon için sağlıklı başlangıç seviyesi."
        : "Bütçe seviyesi strateji görüşmesinde netleştirilmeli.";
  const extraServices = [
    ...(category === "google_ads" || category === "combined_ads" ? ["Anahtar kelime ve dönüşüm takibi kurulumu"] : []),
    ...(category === "meta" || category === "combined_ads" ? ["Pixel / Conversion API kontrolü"] : []),
    ...(category === "combined_ads" ? ["Aylık performans toplantısı ve çok kanallı raporlama"] : []),
    ...(contentNeed === "high" || socialStatus === "irregular" || socialStatus === "new" ? ["İçerik takvimi ve profil optimizasyonu"] : []),
    ...(goal.includes("lead") || goal.includes("randevu") || goal.includes("satış") ? ["Dönüşüm odaklı açılış sayfası"] : [])
  ];
  return {
    minimumRange,
    idealRange,
    aggressiveRange,
    dailyAverageRange: [Math.round(idealRange[0] / 30), Math.round(idealRange[1] / 30)],
    platformSplit: getPlatformBudgetSplit(input.platform, input.goal),
    reason: "Bu öneri sektör, hedef, platform, başlangıç zamanlaması ve içerik ihtiyacına göre oluşturulan HK Dijital analiz modeli / piyasa varsayımıdır.",
    first30DaysPlan: [
      "Hafta 1: Kurulum, hedef kitle, hesap ve ölçüm kontrolü",
      "Hafta 2: İlk kampanya/test yayını",
      "Hafta 3: Veri okuma, kreatif ve hedefleme optimizasyonu",
      "Hafta 4: Raporlama ve ölçekleme kararı"
    ],
    notes: [
      budgetFit,
      "Reklam bütçesi hizmet bedelinden ayrıdır.",
      "İlk ay test ve öğrenme dönemidir.",
      "Kreatif kalitesi performansı doğrudan etkiler.",
      "Kesin sonuç garantisi vermez; test ve optimizasyonla netleşir."
    ],
    extraServices: Array.from(new Set(extraServices)),
    budgetFit
  };
}

export function recommendServicePackage(input: PackageRecommendationInput) {
  const platform = String(input.platform || "").toLocaleLowerCase("tr");
  const goal = String(input.goal || "").toLocaleLowerCase("tr");
  const contentNeed = normalizeContentNeed(input.contentNeed);
  const urgency = normalizeUrgency(input.urgency);
  const socialStatus = normalizeSocialStatus(input.socialStatus);
  const budget = budgetNumber(input.budget);
  const category = recommendationCategory(platform);
  const tier: PackageTier = budget >= 60000 || goal.includes("büyü") || socialStatus === "growth" || socialStatus === "stable_not_growing" && budget >= 20000 || goal.includes("satış") && urgency === "immediate" || contentNeed === "high"
    ? "Premium"
    : budget >= 20000 || goal.includes("lead") || goal.includes("mesaj") || contentNeed === "medium" || urgency === "this_month" || socialStatus === "irregular"
      ? "Pro"
      : "Starter";
  const recommended = HK_SERVICE_PACKAGES.find((pkg) => pkg.category === category && pkg.tier === tier) || HK_SERVICE_PACKAGES.find((pkg) => pkg.category === category) || HK_SERVICE_PACKAGES[0];
  const alternativeTier: PackageTier = tier === "Starter" ? "Pro" : tier === "Pro" ? "Premium" : "Pro";
  const alternative = HK_SERVICE_PACKAGES.find((pkg) => pkg.category === category && pkg.tier === alternativeTier) || recommended;
  const urgencyText = packageChoiceLabel("urgency", urgency);
  const contentText = packageChoiceLabel("content", contentNeed);
  const socialText = packageChoiceLabel("social", socialStatus);
  return {
    recommended,
    alternative,
    adBudget: estimateAdBudget(input),
    reason: `${recommended.categoryLabel} kategorisinde ${recommended.name} seviyesi; hedef, platform ihtiyacı, bütçe aralığı, ${contentText.toLocaleLowerCase("tr")} ve ${urgencyText.toLocaleLowerCase("tr")} tercihlerine göre en dengeli başlangıç noktasıdır.`,
    startingStrategy: category === "social_media"
      ? `İlk 30 günde içerik takvimi, sayfa optimizasyonu ve raporlama ritmi kurulur. Mevcut durum: ${socialText}.`
      : `İlk 30 günde ölçümleme, kampanya yapısı, kreatif/metin testleri ve raporlama ritmi kurulur. Öncelik: performans odaklı test, optimizasyon ve raporlama.`,
    roadmap: recommended.setupRoadmap
  };
}
