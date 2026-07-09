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
  monthlyPrice: number;
  currency: "TRY";
  taxNote: string;
  popular?: boolean;
  features: ServicePackageFeature[];
  setupRoadmap: string[];
};

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

export function formatPackagePrice(pkg: ServicePackage) {
  return `${pkg.monthlyPrice.toLocaleString("tr-TR")} TL${pkg.taxNote ? ` ${pkg.taxNote}` : ""}`;
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
  return {
    id: pkg.slug,
    name: pkg.title,
    price: formatPackagePrice(pkg),
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

function budgetNumber(value?: string | number) {
  if (typeof value === "number") return value;
  return Number(String(value || "").replace(/[^\d]/g, "")) || 0;
}

export function recommendServicePackage(input: PackageRecommendationInput) {
  const platform = String(input.platform || "").toLocaleLowerCase("tr");
  const goal = String(input.goal || "").toLocaleLowerCase("tr");
  const contentNeed = String(input.contentNeed || "").toLocaleLowerCase("tr");
  const urgency = String(input.urgency || "").toLocaleLowerCase("tr");
  const budget = budgetNumber(input.budget);
  const category: PackageCategoryKey = platform.includes("hepsi") || platform.includes("kombin") || platform.includes("meta + google")
    ? "combined_ads"
    : platform.includes("google")
      ? "google_ads"
      : platform.includes("sosyal") || platform.includes("içerik")
        ? "social_media"
        : "meta";
  const tier: PackageTier = budget >= 60000 || goal.includes("büyü") || goal.includes("satış") && urgency.includes("acil") || contentNeed.includes("yüksek")
    ? "Premium"
    : budget >= 20000 || goal.includes("lead") || goal.includes("mesaj") || contentNeed.includes("orta") || urgency.includes("30")
      ? "Pro"
      : "Starter";
  const recommended = HK_SERVICE_PACKAGES.find((pkg) => pkg.category === category && pkg.tier === tier) || HK_SERVICE_PACKAGES.find((pkg) => pkg.category === category) || HK_SERVICE_PACKAGES[0];
  const alternativeTier: PackageTier = tier === "Starter" ? "Pro" : tier === "Pro" ? "Premium" : "Pro";
  const alternative = HK_SERVICE_PACKAGES.find((pkg) => pkg.category === category && pkg.tier === alternativeTier) || recommended;
  return {
    recommended,
    alternative,
    reason: `${recommended.categoryLabel} kategorisinde ${recommended.name} seviyesi; hedef, platform ihtiyacı ve bütçe aralığına göre en dengeli başlangıç noktasıdır.`,
    startingStrategy: category === "social_media"
      ? "İlk ay içerik takvimi, sayfa optimizasyonu ve raporlama ritmi kurulur."
      : "İlk ay ölçümleme, kampanya yapısı, kreatif/metin testleri ve raporlama ritmi kurulur.",
    roadmap: recommended.setupRoadmap
  };
}
