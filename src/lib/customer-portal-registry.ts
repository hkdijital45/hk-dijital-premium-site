export type CustomerPlatformKey =
  | "meta"
  | "google"
  | "ga4"
  | "search_console"
  | "google_ads"
  | "business_profile"
  | "instagram"
  | "facebook"
  | "tiktok"
  | "linkedin"
  | "youtube"
  | "x"
  | "whatsapp"
  | "website"
  | "pixel"
  | "clarity"
  | "hotjar"
  | "woocommerce"
  | "shopify"
  | "api_webhook";

export type CustomerModuleKey =
  | "dashboard"
  | "reports"
  | "tasks"
  | "files"
  | "documents"
  | "billing"
  | "proposals"
  | "contracts"
  | "messages"
  | "todos"
  | "ai_assistant"
  | "ad_doctor"
  | "hk_intelligence"
  | "ad_insights"
  | "analytics"
  | "seo"
  | "social_media"
  | "integrations"
  | "account_connect"
  | "support"
  | "notifications";

export type CustomerPlatformDefinition = {
  key: CustomerPlatformKey;
  title: string;
  description: string;
  provider?: "meta" | "google" | "tiktok" | "x" | "manual";
  assetType: string;
  tone: string;
};

export type CustomerModuleDefinition = {
  key: CustomerModuleKey;
  title: string;
  description: string;
  routeHash?: string;
};

export const CUSTOMER_PLATFORM_REGISTRY: CustomerPlatformDefinition[] = [
  { key: "meta", title: "Meta", description: "Meta Business, reklam hesabı, Pixel ve Facebook bağlantıları.", provider: "meta", assetType: "meta_ads", tone: "blue" },
  { key: "google", title: "Google", description: "Google hesabı üzerinden Ads, Analytics, Search Console ve işletme varlıkları.", provider: "google", assetType: "google_profile", tone: "amber" },
  { key: "ga4", title: "Google Analytics", description: "GA4 mülkleri, ölçüm kimliği ve web analitiği.", provider: "google", assetType: "ga4", tone: "emerald" },
  { key: "search_console", title: "Search Console", description: "Organik arama performansı ve doğrulanmış site mülkleri.", provider: "google", assetType: "search_console", tone: "sky" },
  { key: "google_ads", title: "Google Ads", description: "Google Ads müşteri hesabı ve kampanya verileri.", provider: "google", assetType: "google_ads", tone: "amber" },
  { key: "business_profile", title: "Business Profile", description: "Google işletme profili ve lokasyon bilgileri.", provider: "google", assetType: "google_business_profile", tone: "lime" },
  { key: "instagram", title: "Instagram", description: "Instagram profil, Business hesabı ve bağlantılı sayfa.", provider: "meta", assetType: "instagram_profile", tone: "pink" },
  { key: "facebook", title: "Facebook", description: "Facebook sayfası ve Meta sayfa varlıkları.", provider: "meta", assetType: "facebook_page", tone: "blue" },
  { key: "tiktok", title: "TikTok", description: "TikTok Business Center, Ads Account ve Pixel bilgileri.", provider: "tiktok", assetType: "tiktok_ads", tone: "slate" },
  { key: "linkedin", title: "LinkedIn", description: "LinkedIn şirket sayfası ve reklam hesabı bilgileri.", provider: "manual", assetType: "linkedin_profile", tone: "cyan" },
  { key: "youtube", title: "YouTube", description: "YouTube kanal bilgisi ve Google bağlantısı.", provider: "google", assetType: "youtube_channel", tone: "red" },
  { key: "x", title: "X (Twitter)", description: "X profil ve reklam hesabı bilgileri.", provider: "x", assetType: "x_profile", tone: "slate" },
  { key: "whatsapp", title: "WhatsApp", description: "WhatsApp iletişim linki ve işletme hattı.", provider: "manual", assetType: "whatsapp", tone: "emerald" },
  { key: "website", title: "Website", description: "Web sitesi URL, erişim notu ve yayın durumu.", provider: "manual", assetType: "website", tone: "cyan" },
  { key: "pixel", title: "Pixel", description: "Meta Pixel, Dataset ve takip kodu bilgileri.", provider: "manual", assetType: "pixel", tone: "violet" },
  { key: "clarity", title: "Clarity", description: "Microsoft Clarity proje kimliği ve davranış analitiği.", provider: "manual", assetType: "clarity", tone: "sky" },
  { key: "hotjar", title: "Hotjar", description: "Hotjar site kimliği ve davranış kayıtları.", provider: "manual", assetType: "hotjar", tone: "orange" },
  { key: "woocommerce", title: "WooCommerce", description: "WooCommerce mağaza bağlantısı ve sipariş verileri.", provider: "manual", assetType: "woocommerce", tone: "purple" },
  { key: "shopify", title: "Shopify", description: "Shopify mağaza bağlantısı ve e-ticaret verileri.", provider: "manual", assetType: "shopify", tone: "green" },
  { key: "api_webhook", title: "API / Webhook", description: "Özel API, webhook ve veri aktarım bağlantıları.", provider: "manual", assetType: "api_webhook", tone: "slate" }
];

export const CUSTOMER_MODULE_REGISTRY: CustomerModuleDefinition[] = [
  { key: "dashboard", title: "Dashboard", description: "Genel durum ve müşteri özet kartları.", routeHash: "genel-bakis" },
  { key: "reports", title: "Raporlar", description: "Müşteriye açık raporlar ve aylık özetler.", routeHash: "raporlar" },
  { key: "tasks", title: "Görevler", description: "Müşteriye açık görev ve yapılacak işler.", routeHash: "notlar" },
  { key: "files", title: "Dosyalar", description: "Paylaşılan kreatif ve medya dosyaları.", routeHash: "kreatif-merkezi" },
  { key: "documents", title: "Belgeler", description: "Sözleşme, belge ve PDF kayıtları.", routeHash: "belgeler" },
  { key: "billing", title: "Tahsilat", description: "Ödeme ve tahsilat bilgileri.", routeHash: "odemeler" },
  { key: "proposals", title: "Teklifler", description: "Teklif ve satış takip bilgileri." },
  { key: "contracts", title: "Sözleşmeler", description: "Müşteriye açık sözleşme kayıtları." },
  { key: "messages", title: "Mesajlar", description: "Ajans mesajları ve bilgilendirmeler." },
  { key: "todos", title: "Yapılacaklar", description: "Müşteri tarafındaki aksiyon listesi.", routeHash: "notlar" },
  { key: "ai_assistant", title: "AI Asistan", description: "HK Asistan sohbet ve öneri alanı." },
  { key: "ad_doctor", title: "Reklam Doktoru", description: "Reklam performansı teşhisleri.", routeHash: "performans" },
  { key: "hk_intelligence", title: "HK Intelligence", description: "Çok kaynaklı büyüme analizleri." },
  { key: "ad_insights", title: "Reklam Yorum Merkezi", description: "Reklam yorumları ve fırsat önerileri.", routeHash: "performans" },
  { key: "analytics", title: "Analytics", description: "Web ve kampanya analitiği.", routeHash: "performans" },
  { key: "seo", title: "SEO", description: "Search Console ve organik görünürlük özeti.", routeHash: "rakip-ozeti" },
  { key: "social_media", title: "Sosyal Medya", description: "Sosyal medya içerik ve performans özeti.", routeHash: "kampanyalar" },
  { key: "integrations", title: "Entegrasyonlar", description: "Bağlantı ve veri kaynakları." },
  { key: "account_connect", title: "Hesap Bağla", description: "Platform hesap bağlantı merkezi.", routeHash: "hesap-bagla" },
  { key: "support", title: "Destek", description: "HK Dijital iletişim ve destek alanı." },
  { key: "notifications", title: "Bildirimler", description: "Müşteri bilgilendirme ve uyarıları." }
];

export const DEFAULT_CUSTOMER_MODULES: CustomerModuleKey[] = ["dashboard", "reports", "files", "documents", "account_connect", "support", "notifications"];
export const DEFAULT_CUSTOMER_PLATFORMS: CustomerPlatformKey[] = ["meta", "google", "ga4", "search_console", "google_ads", "business_profile", "instagram", "facebook", "website", "pixel"];
export const CUSTOMER_GOOGLE_PLATFORM_KEYS: CustomerPlatformKey[] = ["google", "ga4", "search_console", "google_ads", "business_profile", "youtube"];

const platformAliases: Record<string, CustomerPlatformKey> = {
  google_analytics: "ga4",
  google_search_console: "search_console",
  google_business_profile: "business_profile",
  twitter: "x",
  x_twitter: "x",
  meta_facebook: "meta",
  website_pixel: "website",
  api: "api_webhook",
  webhook: "api_webhook"
};

export function normalizePlatformKeys(value: unknown): CustomerPlatformKey[] {
  if (!Array.isArray(value)) return DEFAULT_CUSTOMER_PLATFORMS;
  const valid = new Set(CUSTOMER_PLATFORM_REGISTRY.map((item) => item.key));
  return Array.from(new Set(value
    .map((item) => platformAliases[String(item).trim()] || String(item).trim())
    .filter((item): item is CustomerPlatformKey => valid.has(item as CustomerPlatformKey))));
}

export function normalizeModuleKeys(value: unknown): CustomerModuleKey[] {
  if (!Array.isArray(value)) return DEFAULT_CUSTOMER_MODULES;
  const valid = new Set(CUSTOMER_MODULE_REGISTRY.map((item) => item.key));
  return value.map((item) => String(item).trim()).filter((item): item is CustomerModuleKey => valid.has(item as CustomerModuleKey));
}
