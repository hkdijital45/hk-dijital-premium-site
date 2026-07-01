export type AdminNavigationItem = {
  label: string;
  slug: string;
  module: string;
  description: string;
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
    description: "Dashboard, risk, kalite, sağlık, log ve yedekleme merkezi.",
    icon: "LayoutDashboard",
    badge: "OS",
    accent: "from-cyan-400 via-sky-500 to-blue-600",
    items: [
      { label: "Kontrol Merkezi", slug: "kontrol-merkezi", module: "dashboard", description: "Genel dashboard, HK Intelligence, riskler, QA, sistem sağlığı, loglar ve veri yedekleme." }
    ]
  },
  {
    label: "Müşteri Merkezi",
    description: "Müşteri profili, kurulum, şube, entegrasyon, finans ve rakip bilgileri.",
    icon: "UsersRound",
    badge: "Müşteri",
    accent: "from-emerald-400 via-teal-500 to-cyan-600",
    items: [
      { label: "Müşteri Merkezi", slug: "musteri-merkezi", module: "musteriler", description: "Müşteriler, profiller, onboarding, şubeler, entegrasyon, paketler, rakipler ve yaşam döngüsü." }
    ]
  },
  {
    label: "Satış & CRM",
    description: "Lead keşfi, CRM, teklif ve satış hunisi.",
    icon: "UsersRound",
    badge: "CRM",
    accent: "from-blue-400 via-cyan-500 to-emerald-600",
    items: [
      { label: "Satış & CRM", slug: "satis-crm", module: "leads", description: "Leadler, müşteri keşfi, haritalar, takip merkezi, teklifler ve kazanıldı/kaybedildi analizi." }
    ]
  },
  {
    label: "Reklam & Performans",
    description: "Meta, Google, website analytics ve rakip istihbaratı.",
    icon: "FileBarChart",
    badge: "Performans",
    accent: "from-orange-400 via-pink-500 to-rose-600",
    items: [
      { label: "Reklam & Performans", slug: "reklam-performans", module: "kampanyalar", description: "Kampanyalar, Meta/Google istihbarat, reklam doktoru, website analytics, rakip analizi ve kreatif performans." }
    ]
  },
  {
    label: "Rapor Merkezi",
    description: "Aylık raporlar, müşteri raporları, çıktı ve onay akışları.",
    icon: "FileBarChart",
    badge: "Rapor",
    accent: "from-violet-400 via-indigo-500 to-blue-600",
    items: [
      { label: "Rapor Merkezi", slug: "rapor-merkezi", module: "raporlar", description: "Aylık raporlar, müşteri raporları, PDF tasarım, PDF audit, çıktı ve müşteri görünürlüğü." }
    ]
  },
  {
    label: "Ajans Operasyonu",
    description: "Görev, takvim, belge, sözleşme, WhatsApp ve içerik operasyonu.",
    icon: "Gauge",
    badge: "Ajans",
    accent: "from-cyan-500 via-blue-600 to-indigo-700",
    items: [
      { label: "Ajans Operasyonu", slug: "ajans-operasyon", module: "gorevler", description: "Görevler, takvim, ajans hedefleri, belgeler, sözleşmeler, WhatsApp, sosyal medya planı ve ekip işleri." }
    ]
  },
  {
    label: "Muhasebe",
    description: "Gelir, gider, tahsilat, kârlılık ve finansal raporlar.",
    icon: "Gauge",
    badge: "Finans",
    accent: "from-emerald-500 via-teal-600 to-cyan-700",
    items: [
      { label: "Muhasebe Merkezi", slug: "muhasebe", module: "muhasebe", description: "Tahsilat, bekleyen ödeme, gelir/gider, gelir tahmini, kârlılık ve finansal dışa aktarım." }
    ]
  },
  {
    label: "AI & Otomasyon",
    description: "Agent Hub, AI Studio, prompt, hafıza, benchmark ve otomasyonlar.",
    icon: "Bot",
    badge: "AI",
    accent: "from-blue-500 via-indigo-500 to-violet-600",
    items: [
      { label: "AI & Otomasyon", slug: "ai-otomasyon", module: "agent-hub", description: "HK Agent Hub, AI Studio, satış koçu, prompt merkezi, workflow, hafıza, benchmark ve maliyet takibi." }
    ]
  },
  {
    label: "Entegrasyonlar",
    description: "Meta, Google, GA4, Search Console, GTM ve dış servis bağlantıları.",
    icon: "Settings2",
    badge: "API",
    accent: "from-emerald-400 via-cyan-500 to-blue-600",
    items: [
      { label: "Entegrasyon Merkezi", slug: "entegrasyon-merkezi", module: "api-ayarlari", description: "Meta, Pixel, Dataset, Google, GA4, Search Console, Google Ads, GTM, Clarity, Hotjar, SMTP, Discord ve API durumları." }
    ]
  },
  {
    label: "İçerik & Medya",
    description: "İçerik planı, kreatif, medya ve müşteri onayı.",
    icon: "Bot",
    badge: "İçerik",
    accent: "from-fuchsia-400 via-pink-500 to-rose-600",
    items: [
      { label: "İçerik & Medya", slug: "icerik-medya", module: "icerik-onerileri", description: "İçerik planları, sosyal medya planı, kreatif stüdyo, medya, kampanya önerileri ve onay bekleyen içerikler." }
    ]
  },
  {
    label: "Ayarlar & Yönetim",
    description: "Web sitesi, kullanıcı, rol, tema, portal ve güvenlik ayarları.",
    icon: "Settings2",
    badge: "Admin",
    accent: "from-slate-500 via-slate-700 to-slate-900",
    items: [
      { label: "Ayarlar & Yönetim", slug: "ayarlar-yonetim", module: "site-ayarlari", description: "Web sitesi yönetimi, kullanıcılar, roller, tema/logo, sistem ayarları, müşteri portalı ve güvenlik." }
    ]
  }
];

export const adminNavigationItems = adminNavigationGroups.flatMap((group) => group.items);

const legacySlugRedirects: Record<string, string> = {
  "": "kontrol-merkezi",
  dashboard: "kontrol-merkezi?tab=dashboard",
  "kontrol-merkezi": "kontrol-merkezi",
  "hk-intelligence-ceo": "kontrol-merkezi?tab=hk-intelligence-ceo",
  "hk-ceo-masasi": "kontrol-merkezi?tab=hk-intelligence-ceo",
  "executive-command-center": "kontrol-merkezi?tab=hk-intelligence-ceo",
  "autonomous-agency": "kontrol-merkezi?tab=hk-intelligence-ceo",
  "hk-intelligence-autonomous-agency": "kontrol-merkezi?tab=hk-intelligence-ceo",
  "intelligence-command-center": "kontrol-merkezi?tab=commander",
  "risk-merkezi": "kontrol-merkezi?tab=risk",
  "hk-asistan": "kontrol-merkezi?tab=hk-asistan",
  "genel-arama": "kontrol-merkezi?tab=genel-arama",
  "qa-center": "kontrol-merkezi?tab=qa",
  "qa-merkezi": "kontrol-merkezi?tab=qa",
  "sistem-sagligi": "kontrol-merkezi?tab=saglik",
  "sistem-durumu": "kontrol-merkezi?tab=saglik",
  "sistem-test-merkezi": "kontrol-merkezi?tab=test",
  "sistem-testleri": "kontrol-merkezi?tab=test",
  "system-test-center": "kontrol-merkezi?tab=test",
  "log-aktivite-merkezi": "kontrol-merkezi?tab=loglar",
  "sistem-loglari": "kontrol-merkezi?tab=loglar",
  "aktivite-akisi": "kontrol-merkezi?tab=loglar",
  "veri-aktarma": "kontrol-merkezi?tab=veri-yedekleme",
  "veri-aktarimi": "kontrol-merkezi?tab=veri-yedekleme",
  "export-center": "kontrol-merkezi?tab=veri-yedekleme",

  "musteri-merkezi": "musteri-merkezi",
  musteriler: "musteri-merkezi?tab=musteriler",
  customers: "musteri-merkezi?tab=musteriler",
  firmalar: "musteri-merkezi?tab=musteriler",
  "aktif-musteriler": "musteri-merkezi?tab=musteriler",
  "pasif-musteriler": "musteri-merkezi?tab=musteriler",
  "musteri-yonetimi": "musteri-merkezi?tab=musteriler",
  "customer-discovery": "satis-crm?tab=musteri-kesfi",
  "customers/onboarding": "musteri-merkezi?tab=onboarding",
  "musteri-onboarding": "musteri-merkezi?tab=onboarding",
  "musteri-markalama": "musteri-merkezi?tab=markalama",

  "satis-crm": "satis-crm",
  leads: "satis-crm?tab=leadler",
  leadler: "satis-crm?tab=leadler",
  crm: "satis-crm?tab=lead-workspace",
  "lead-workspace": "satis-crm?tab=lead-workspace",
  "crm-lead-workspace": "satis-crm?tab=lead-workspace",
  "musteri-kesfi": "satis-crm?tab=musteri-kesfi",
  "musteri-bul": "satis-crm?tab=musteri-kesfi",
  "musteri-bulucu": "satis-crm?tab=musteri-kesfi",
  "isletme-kesfi": "satis-crm?tab=musteri-kesfi",
  haritalar: "satis-crm?tab=haritalar",
  "lead-analizi": "satis-crm?tab=lead-analizi",
  "lead-yonetimi": "satis-crm?tab=lead-analizi",
  "takip-merkezi": "satis-crm?tab=takip",
  takipler: "satis-crm?tab=takip",
  "lead-follow-up": "satis-crm?tab=takip",
  "satis-hunisi": "satis-crm?tab=satis-hunisi",
  pipeline: "satis-crm?tab=satis-hunisi",
  "satis-pipeline": "satis-crm?tab=satis-hunisi",
  "teklif-hazirlama": "satis-crm?tab=teklif",
  teklifler: "satis-crm?tab=teklif",
  "teklif-motoru": "satis-crm?tab=teklif",
  "teklif-takip-merkezi": "satis-crm?tab=teklif-takip",
  "teklif-takip": "satis-crm?tab=teklif-takip",
  proposal_followups: "satis-crm?tab=teklif-takip",
  "proposal-followups": "satis-crm?tab=teklif-takip",
  "kazanildi-kaybedildi-analizi": "satis-crm?tab=won-lost",
  "won-lost-analysis": "satis-crm?tab=won-lost",
  reddedilenler: "satis-crm?tab=leadler",
  silinenler: "satis-crm?tab=leadler",
  "tum-basvurular": "satis-crm?tab=leadler",
  "yeni-basvurular": "satis-crm?tab=leadler",

  "reklam-performans": "reklam-performans",
  kampanyalar: "reklam-performans?tab=kampanyalar",
  "reklam-hesabi-eslestirme": "reklam-performans?tab=hesap-eslestirme",
  "campaign-mapping": "reklam-performans?tab=hesap-eslestirme",
  "kampanya-eslestirme": "reklam-performans?tab=hesap-eslestirme",
  "reklam-hesaplari": "reklam-performans?tab=hesap-eslestirme",
  "meta-istihbarat": "reklam-performans?tab=meta-istihbarat",
  "meta-analiz": "reklam-performans?tab=meta-raporlari",
  "google-istihbarat": "reklam-performans?tab=google-istihbarat",
  "google-analiz": "reklam-performans?tab=google-raporlari",
  "ad-insights": "reklam-performans?tab=reklam-doktoru",
  "reklam-yorum-merkezi": "reklam-performans?tab=reklam-doktoru",
  "reklam-doktoru-pro": "reklam-performans?tab=reklam-doktoru",
  "hk-reklam-doktoru-pro": "reklam-performans?tab=reklam-doktoru",
  "website-analytics": "reklam-performans?tab=website-analytics",
  "web-site-analitigi": "reklam-performans?tab=website-analytics",
  "rakip-analizi": "reklam-performans?tab=rakip-analizi",
  "rakip-listesi": "reklam-performans?tab=rakip-analizi",
  "rakip-reklamlari": "reklam-performans?tab=rakip-sinyalleri",

  "rapor-merkezi": "rapor-merkezi",
  raporlar: "rapor-merkezi?tab=musteri-raporlari",
  "musteri-raporlari": "rapor-merkezi?tab=musteri-raporlari",
  "teklif-listesi": "rapor-merkezi?tab=musteri-raporlari",
  "performans-raporlari": "rapor-merkezi?tab=musteri-raporlari",
  "rapor-yorumlari": "rapor-merkezi?tab=musteri-raporlari",
  "aylik-raporlar": "rapor-merkezi?tab=aylik-raporlar",
  "pdf-rapor-tasarim": "rapor-merkezi?tab=pdf-tasarim",
  "premium-pdf-report-design-center": "rapor-merkezi?tab=pdf-tasarim",
  "pdf-rapor-tasarim-merkezi": "rapor-merkezi?tab=pdf-tasarim",
  "pdf-audit": "rapor-merkezi?tab=pdf-audit",
  "sosyal-medya-denetimi": "rapor-merkezi?tab=pdf-audit",
  "sosyal-istihbarat-merkezi": "rapor-merkezi?tab=pdf-audit",
  "disa-aktarma": "rapor-merkezi?tab=disa-aktarim",

  "ajans-operasyon": "ajans-operasyon",
  gorevler: "ajans-operasyon?tab=gorevler",
  takvim: "ajans-operasyon?tab=takvim",
  "ajans-hedefleri": "ajans-operasyon?tab=ajans-hedefleri",
  "ajans-hedef-panosu": "ajans-operasyon?tab=ajans-hedefleri",
  "agency-targets": "ajans-operasyon?tab=ajans-hedefleri",
  belgeler: "ajans-operasyon?tab=belgeler",
  "sozlesme-olustur": "ajans-operasyon?tab=sozlesmeler",
  "contract-generator": "ajans-operasyon?tab=sozlesmeler",
  "sozlesme-generator": "ajans-operasyon?tab=sozlesmeler",
  "whatsapp-hatirlatma": "ajans-operasyon?tab=whatsapp",
  "whatsapp-reminder-center": "ajans-operasyon?tab=whatsapp",
  "sosyal-medya-plani": "ajans-operasyon?tab=sosyal-medya-plani",
  "sektor-sistemleri": "ajans-operasyon?tab=ekip-isleri",

  muhasebe: "muhasebe",
  tahsilat: "muhasebe?tab=tahsilatlar",
  tahsilatlar: "muhasebe?tab=tahsilatlar",
  "gelir-forecast": "muhasebe?tab=gelir-tahmini",
  "revenue-forecast": "muhasebe?tab=gelir-tahmini",
  "gelir-tahmini": "muhasebe?tab=gelir-tahmini",
  "bekleyen-odemeler": "muhasebe?tab=bekleyen",
  "gelir-gider": "muhasebe?tab=gelir-gider",
  karlilik: "muhasebe?tab=karlilik",
  "musteri-finans-ozeti": "muhasebe?tab=musteri-finans",
  "finans-export": "muhasebe?tab=export",
  export: "muhasebe?tab=export",

  "ai-otomasyon": "ai-otomasyon",
  "agent-hub": "ai-otomasyon?tab=agent-hub",
  "hk-agent-hub": "ai-otomasyon?tab=agent-hub",
  "ai-studio": "ai-otomasyon?tab=ai-studio",
  "ai-sales-coach": "ai-otomasyon?tab=satis-kocu",
  "ai-satis-kocu": "ai-otomasyon?tab=satis-kocu",
  "prompt-uretimi": "ai-otomasyon?tab=promptlar",
  "prompt-kutuphanesi": "ai-otomasyon?tab=promptlar",
  "ai-otomasyon-eski": "ai-otomasyon?tab=workflow",

  "entegrasyon-merkezi": "entegrasyon-merkezi",
  entegrasyonlar: "entegrasyon-merkezi?tab=genel",
  "api-ayarlari": "entegrasyon-merkezi?tab=genel",
  "ai-saglayici-ayarlari": "entegrasyon-merkezi?tab=api-anahtar",
  "meta-pixel-dataset": "entegrasyon-merkezi?tab=meta",
  "meta-integrations": "entegrasyon-merkezi?tab=meta",
  "google-ga4-search-console": "entegrasyon-merkezi?tab=google",
  "google-integrations": "entegrasyon-merkezi?tab=google",
  "gtm-baglantilari": "entegrasyon-merkezi?tab=gtm",
  gtm: "entegrasyon-merkezi?tab=gtm",

  "icerik-medya": "icerik-medya",
  "icerik-fikirleri": "icerik-medya?tab=icerik-planlari",
  "icerik-onerileri": "icerik-medya?tab=icerik-planlari",
  "30-gunluk-sosyal-medya-plani": "icerik-medya?tab=sosyal-medya-plani",
  medya: "icerik-medya?tab=medya",
  "medya-logo": "icerik-medya?tab=medya",
  "medya-logo-yukleme": "icerik-medya?tab=medya",
  "kampanya-onerileri": "icerik-medya?tab=kampanya-onerileri",
  "kampanya-hazirligi": "icerik-medya?tab=kampanya-onerileri",

  "ayarlar-yonetim": "ayarlar-yonetim",
  "web-sitesi-yonetimi": "ayarlar-yonetim?tab=web-site",
  "web-site-yonetimi": "ayarlar-yonetim?tab=web-site",
  "site-ayarlari": "ayarlar-yonetim?tab=web-site",
  "sayfa-icerikleri": "ayarlar-yonetim?tab=web-site",
  "kullanici-yonetimi": "ayarlar-yonetim?tab=kullanicilar",
  kullanicilar: "ayarlar-yonetim?tab=kullanicilar",
  "roller-yetkiler": "ayarlar-yonetim?tab=roller",
  "tema-logo": "ayarlar-yonetim?tab=tema-logo",
  "tema-ayarlari": "ayarlar-yonetim?tab=tema-logo",
  "sistem-ayarlari": "ayarlar-yonetim?tab=sistem",
  "mobil-operasyon-modu": "ayarlar-yonetim?tab=mobil"
};

export function getAdminSectionBySlug(slug = "") {
  const normalizedSlug = legacySlugRedirects[slug] || slug;
  const [sectionSlug] = normalizedSlug.split("?");
  if (sectionSlug === "musteri-bulucu") return adminNavigationItems.find((item) => item.module === "musteri-bulucu");
  if (sectionSlug === "sosyal-medya-denetimi") return adminNavigationItems.find((item) => item.module === "sosyal-medya-denetimi");
  return adminNavigationItems.find((item) => item.slug === sectionSlug);
}

export function getCanonicalAdminSlug(slug = "") {
  return legacySlugRedirects[slug] || slug;
}

export function getAdminHref(slug: string) {
  if (slug === "lead-workspace") return "/lead-workspace";
  if (slug === "proposal-builder") return "/proposal-builder";
  return slug ? `/hk-admin/${slug}` : "/hk-admin";
}
