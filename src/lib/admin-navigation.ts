export type AdminNavigationItem = {
  label: string;
  slug: string;
  module: string;
};

export type AdminNavigationGroup = {
  label: string;
  description: string;
  icon: string;
  badge: string;
  accent: string;
  items: AdminNavigationItem[];
};

export const adminNavigationGroups: AdminNavigationGroup[] = [
  {
    label: "Kontrol Merkezi",
    description: "Ana operasyon ekranı, asistan, görev ve kârlılık özeti.",
    icon: "LayoutDashboard",
    badge: "OS",
    accent: "from-cyan-400 via-sky-500 to-blue-600",
    items: [
      { label: "Dashboard", slug: "", module: "dashboard" },
      { label: "HK Asistan", slug: "hk-asistan", module: "hk-asistan" },
      { label: "Görevler", slug: "gorevler", module: "gorevler" },
      { label: "Karlılık", slug: "karlilik", module: "karlilik" },
      { label: "Genel Arama", slug: "genel-arama", module: "genel-arama" },
      { label: "Kullanım Kılavuzu", slug: "kullanim-kilavuzu", module: "kullanim-kilavuzu" }
    ]
  },
  {
    label: "CRM & Müşteriler",
    description: "Lead, müşteri ve teklif akışları.",
    icon: "UsersRound",
    badge: "CRM",
    accent: "from-emerald-400 via-teal-500 to-cyan-600",
    items: [
      { label: "Leadler", slug: "leads", module: "leads" },
      { label: "Müşteriler", slug: "musteriler", module: "musteriler" },
      { label: "Teklif Oluştur", slug: "teklif-hazirlama", module: "teklifler" },
      { label: "Müşteri Markalama", slug: "musteri-markalama", module: "musteriler" },
      { label: "Müşteri Onboarding", slug: "customers/onboarding", module: "musteriler" }
    ]
  },
  {
    label: "İstihbarat Merkezi",
    description: "Müşteri keşfi, harita sinyalleri, Meta/Google istihbaratı ve lead analizi.",
    icon: "MapPinned",
    badge: "Intel",
    accent: "from-amber-400 via-orange-500 to-rose-600",
    items: [
      { label: "Müşteri Keşfi", slug: "musteri-kesfi", module: "musteri-bulucu" },
      { label: "Haritalar", slug: "haritalar", module: "haritalar" },
      { label: "Meta İstihbarat", slug: "meta-istihbarat", module: "meta-analiz" },
      { label: "Google İstihbarat", slug: "google-istihbarat", module: "google-analiz" },
      { label: "Lead Analizi", slug: "lead-analizi", module: "leads" },
      { label: "Rakip Analizi", slug: "rakip-analizi", module: "rakip-analizi" }
    ]
  },
  {
    label: "Reklam & Raporlama",
    description: "Meta, Google Ads ve müşteri raporlama merkezi.",
    icon: "FileBarChart",
    badge: "Rapor",
    accent: "from-orange-400 via-pink-500 to-rose-600",
    items: [
      { label: "Kampanyalar", slug: "kampanyalar", module: "kampanyalar" },
      { label: "Meta Raporları", slug: "meta-analiz", module: "meta-analiz" },
      { label: "Google Ads Raporları", slug: "google-analiz", module: "google-analiz" },
      { label: "Aylık Raporlar", slug: "aylik-raporlar", module: "aylik-raporlar" },
      { label: "Müşteri Raporları", slug: "musteri-raporlari", module: "raporlar" },
      { label: "PDF Audit", slug: "pdf-audit", module: "sosyal-medya-denetimi" },
      { label: "WhatsApp Teklifi", slug: "whatsapp-teklifi", module: "teklifler" }
    ]
  },
  {
    label: "Ajans Operasyonları",
    description: "Belge, tahsilat, rakip analizi ve operasyon planları.",
    icon: "Gauge",
    badge: "Ajans",
    accent: "from-cyan-500 via-blue-600 to-indigo-700",
    items: [
      { label: "Belgeler", slug: "belgeler", module: "belgeler" },
      { label: "Tahsilat", slug: "tahsilat", module: "tahsilat" },
      { label: "Sosyal Medya Planı", slug: "sosyal-medya-plani", module: "sosyal-medya-plani" },
      { label: "Sektör Sistemleri", slug: "sektor-sistemleri", module: "sektor-sistemleri" }
    ]
  },
  {
    label: "İçerik & AI Studio",
    description: "AI üretim alanı, içerik planları, promptlar ve medya.",
    icon: "Bot",
    badge: "AI",
    accent: "from-blue-500 via-indigo-500 to-violet-600",
    items: [
      { label: "AI Studio", slug: "ai-studio", module: "ai-studio" },
      { label: "İçerik Planları", slug: "icerik-fikirleri", module: "icerik-onerileri" },
      { label: "Promptlar", slug: "prompt-uretimi", module: "prompt-kutuphanesi" },
      { label: "Medya", slug: "medya", module: "medya" },
      { label: "Kampanya Önerileri", slug: "kampanya-onerileri", module: "kampanya-hazirligi" }
    ]
  },
  {
    label: "Ayarlar",
    description: "API, AI sağlayıcıları, kullanıcı yönetimi, tema ve sistem.",
    icon: "Settings2",
    badge: "Admin",
    accent: "from-slate-500 via-slate-700 to-slate-900",
    items: [
      { label: "Web Sitesi Yönetimi", slug: "web-sitesi-yonetimi", module: "site-ayarlari" },
      { label: "Entegrasyonlar", slug: "entegrasyonlar", module: "api-ayarlari" },
      { label: "Kullanıcı Yönetimi", slug: "kullanici-yonetimi", module: "kullanicilar" },
      { label: "Tema / Logo", slug: "tema-logo", module: "tema-ayarlari" },
      { label: "Sistem Ayarları", slug: "sistem-ayarlari", module: "site-ayarlari" },
      { label: "Sistem Logları", slug: "sistem-loglari", module: "sistem-loglari" }
    ]
  }
];

export const adminNavigationItems = adminNavigationGroups.flatMap((group) => group.items);

const legacySlugRedirects: Record<string, string> = {
  kullanicilar: "kullanici-yonetimi",
  "roller-yetkiler": "kullanici-yonetimi",
  "kullanici-yonetimi": "kullanici-yonetimi",
  crm: "leads",
  "tum-basvurular": "leads",
  "yeni-basvurular": "leads",
  "meta-analiz-leadleri": "leads",
  "google-ads-analiz-leadleri": "leads",
  "sosyal-istihbarat-leadleri": "leads",
  "musteri-bul": "musteri-kesfi",
  "musteri-bulucu": "musteri-kesfi",
  "isletme-kesfi": "musteri-kesfi",
  reddedilenler: "leads",
  silinenler: "leads",
  "lead-workspace": "lead-analizi",
  "lead-yonetimi": "lead-analizi",
  "teklifler": "teklif-hazirlama",
  "teklif-motoru": "teklif-hazirlama",
  "teklif-listesi": "musteri-raporlari",
  "raporlar": "musteri-raporlari",
  "performans-raporlari": "musteri-raporlari",
  "rapor-yorumlari": "musteri-raporlari",
  "disa-aktarma": "musteri-raporlari",
  "tema-ayarlari": "tema-logo",
  "site-ayarlari": "web-sitesi-yonetimi",
  "sayfa-icerikleri": "web-sitesi-yonetimi",
  "api-ayarlari": "entegrasyonlar",
  "ai-saglayici-ayarlari": "entegrasyonlar",
  "medya-logo": "medya",
  "medya-logo-yukleme": "medya",
  "30-gunluk-sosyal-medya-plani": "icerik-fikirleri",
  "icerik-onerileri": "icerik-fikirleri",
  "prompt-kutuphanesi": "prompt-uretimi",
  "kampanya-hazirligi": "kampanya-onerileri",
  "meta-integrations": "meta-istihbarat",
  "google-integrations": "google-istihbarat",
  "rakip-reklamlari": "rakip-analizi",
  "rakip-listesi": "rakip-analizi",
  "bolgesel-analiz": "musteri-kesfi",
  "kaydedilen-adaylar": "musteri-kesfi",
  "google-maps-isletme-sinyalleri": "haritalar",
  "sosyal-istihbarat-merkezi": "pdf-audit"
};

export function getAdminSectionBySlug(slug = "") {
  const normalizedSlug = legacySlugRedirects[slug] || slug;
  if (normalizedSlug === "musteri-bulucu") return adminNavigationItems.find((item) => item.module === "musteri-bulucu");
  if (normalizedSlug === "sosyal-medya-denetimi") return adminNavigationItems.find((item) => item.module === "sosyal-medya-denetimi");
  return adminNavigationItems.find((item) => item.slug === normalizedSlug);
}

export function getCanonicalAdminSlug(slug = "") {
  return legacySlugRedirects[slug] || slug;
}

export function getAdminHref(slug: string) {
  if (slug === "lead-workspace") return "/lead-workspace";
  if (slug === "proposal-builder") return "/proposal-builder";
  return slug ? `/hk-admin/${slug}` : "/hk-admin";
}
