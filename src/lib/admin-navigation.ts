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
    description: "Sistem sağlığı, AI durumu ve canlı operasyon özeti.",
    icon: "LayoutDashboard",
    badge: "OS",
    accent: "from-cyan-400 via-sky-500 to-blue-600",
    items: [
      { label: "Dashboard", slug: "", module: "dashboard" },
      { label: "AI Durum Merkezi", slug: "ai-durum-merkezi", module: "dashboard" },
      { label: "API Durum Kontrolü", slug: "api-durum-kontrolu", module: "api-ayarlari" },
      { label: "Canlı Aktivite", slug: "canli-aktivite", module: "dashboard" },
      { label: "Sistem Özeti", slug: "sistem-ozeti", module: "dashboard" },
      { label: "Genel Arama", slug: "genel-arama", module: "genel-arama" },
      { label: "Kullanım Kılavuzu", slug: "kullanim-kilavuzu", module: "kullanim-kilavuzu" }
    ]
  },
  {
    label: "CRM & Müşteriler",
    description: "Başvurular, müşteri kayıtları ve takip akışı.",
    icon: "UsersRound",
    badge: "CRM",
    accent: "from-emerald-400 via-teal-500 to-cyan-600",
    items: [
      { label: "CRM", slug: "crm", module: "crm" },
      { label: "Tüm Başvurular", slug: "tum-basvurular", module: "leads" },
      { label: "Yeni Başvurular", slug: "yeni-basvurular", module: "leads" },
      { label: "Lead Workspace", slug: "lead-workspace", module: "leads" },
      { label: "Meta Analiz Leadleri", slug: "meta-analiz-leadleri", module: "leads" },
      { label: "Google Ads Analiz Leadleri", slug: "google-ads-analiz-leadleri", module: "leads" },
      { label: "Sosyal İstihbarat Leadleri", slug: "sosyal-istihbarat-leadleri", module: "leads" },
      { label: "Reddedilenler", slug: "reddedilenler", module: "leads" },
      { label: "Silinenler", slug: "silinenler", module: "leads" },
      { label: "Lead Yönetimi", slug: "leads", module: "leads" },
      { label: "Müşteriler", slug: "musteriler", module: "musteriler" },
      { label: "Müşteri Markalama", slug: "musteri-markalama", module: "musteriler" },
      { label: "Müşteri Onboarding", slug: "customers/onboarding", module: "musteriler" },
      { label: "Takipler", slug: "takipler", module: "takip-gorevleri" },
      { label: "Notlar", slug: "notlar", module: "notlar" },
      { label: "Görevler", slug: "gorevler", module: "gorevler" },
      { label: "Belgeler", slug: "belgeler", module: "belgeler" },
      { label: "Tahsilat", slug: "tahsilat", module: "tahsilat" }
    ]
  },
  {
    label: "İstihbarat Merkezi",
    description: "Meta, Google, sosyal medya ve yerel işletme sinyalleri.",
    icon: "Sparkles",
    badge: "Intel",
    accent: "from-amber-300 via-orange-500 to-rose-600",
    items: [
      { label: "Meta Analiz", slug: "meta-analiz", module: "meta-analiz" },
      { label: "Meta Integration Center", slug: "meta-integrations", module: "meta-analiz" },
      { label: "Google Ads Analiz", slug: "google-analiz", module: "google-analiz" },
      { label: "Google Ads Integration Center", slug: "google-integrations", module: "google-analiz" },
      { label: "Sosyal İstihbarat Merkezi", slug: "sosyal-istihbarat-merkezi", module: "sosyal-medya-denetimi" },
      { label: "Rakip Reklamları", slug: "rakip-reklamlari", module: "reklam-firsatlari" },
      { label: "İşletme Keşfi", slug: "isletme-kesfi", module: "musteri-bulucu" },
      { label: "Google Maps / İşletme Sinyalleri", slug: "google-maps-isletme-sinyalleri", module: "haritalar" },
      { label: "Bölgesel Analiz", slug: "bolgesel-analiz", module: "bolgesel-analiz" },
      { label: "Rakip Analizi", slug: "rakip-analizi", module: "rakip-analizi" },
      { label: "Rakip Listesi", slug: "rakip-listesi", module: "rakip-listesi" },
      { label: "Kaydedilen Adaylar", slug: "kaydedilen-adaylar", module: "kaydedilen-adaylar" }
    ]
  },
  {
    label: "Teklif & Raporlama",
    description: "Teklif, audit, rapor ve dışa aktarma araçları.",
    icon: "FileBarChart",
    badge: "Rapor",
    accent: "from-violet-500 via-purple-500 to-fuchsia-600",
    items: [
      { label: "PDF Audit", slug: "pdf-audit", module: "sosyal-medya-denetimi" },
      { label: "WhatsApp Teklifi", slug: "whatsapp-teklifi", module: "teklifler" },
      { label: "Teklif Hazırlama", slug: "teklif-hazirlama", module: "teklifler" },
      { label: "Smart Proposal Generator", slug: "proposal-builder", module: "teklifler" },
      { label: "Teklif Motoru", slug: "teklifler", module: "teklifler" },
      { label: "Teklifler", slug: "teklif-listesi", module: "teklif-listesi" },
      { label: "Müşteri Raporları", slug: "musteri-raporlari", module: "raporlar" },
      { label: "Aylık Raporlar", slug: "aylik-raporlar", module: "aylik-raporlar" },
      { label: "Performans Raporları", slug: "performans-raporlari", module: "raporlar" },
      { label: "Raporlar", slug: "raporlar", module: "raporlar" },
      { label: "Rapor Yorumları", slug: "rapor-yorumlari", module: "rapor-yorumlari" },
      { label: "Dışa Aktarma", slug: "disa-aktarma", module: "disa-aktarimlar" }
    ]
  },
  {
    label: "İçerik & AI Studio",
    description: "İçerik planı, prompt, analiz ve kampanya üretimi.",
    icon: "Bot",
    badge: "AI",
    accent: "from-blue-500 via-indigo-500 to-violet-600",
    items: [
      { label: "İçerik Fikirleri", slug: "icerik-fikirleri", module: "icerik-onerileri" },
      { label: "30 Günlük Sosyal Medya Planı", slug: "30-gunluk-sosyal-medya-plani", module: "icerik-onerileri" },
      { label: "Prompt Üretimi", slug: "prompt-uretimi", module: "prompt-kutuphanesi" },
      { label: "AI Analizleri", slug: "ai-analizleri", module: "ai-studio" },
      { label: "Kampanya Önerileri", slug: "kampanya-onerileri", module: "kampanya-hazirligi" },
      { label: "Sosyal Medya Planı", slug: "sosyal-medya-plani", module: "sosyal-medya-plani" },
      { label: "HK Asistan", slug: "hk-asistan", module: "hk-asistan" },
      { label: "Hazırlık Merkezi", slug: "hazirlik", module: "hazirlik" },
      { label: "AI Studio", slug: "ai-studio", module: "ai-studio" },
      { label: "İçerik Önerileri", slug: "icerik-onerileri", module: "icerik-onerileri" },
      { label: "Prompt Kütüphanesi", slug: "prompt-kutuphanesi", module: "prompt-kutuphanesi" },
      { label: "Kampanya Hazırlığı", slug: "kampanya-hazirligi", module: "kampanya-hazirligi" }
    ]
  },
  {
    label: "Ajans Operasyonları",
    description: "Görev, belge, tahsilat, karlılık ve ajans asistanı.",
    icon: "Gauge",
    badge: "Ajans",
    accent: "from-cyan-500 via-blue-600 to-indigo-700",
    items: [
      { label: "Görevler", slug: "gorevler", module: "gorevler" },
      { label: "Belgeler", slug: "belgeler", module: "belgeler" },
      { label: "Tahsilat", slug: "tahsilat", module: "tahsilat" },
      { label: "Karlılık", slug: "karlilik", module: "karlilik" },
      { label: "Rakip Analizi", slug: "rakip-analizi", module: "rakip-analizi" },
      { label: "Sosyal Medya Planı", slug: "sosyal-medya-plani", module: "sosyal-medya-plani" },
      { label: "Aylık Raporlar", slug: "aylik-raporlar", module: "aylik-raporlar" },
      { label: "HK Asistan", slug: "hk-asistan", module: "hk-asistan" }
    ]
  },
  {
    label: "Ayarlar",
    description: "API, AI sağlayıcıları, kullanıcılar, tema ve sistem.",
    icon: "Settings2",
    badge: "Admin",
    accent: "from-slate-500 via-slate-700 to-slate-900",
    items: [
      { label: "API Ayarları", slug: "api-ayarlari", module: "api-ayarlari" },
      { label: "AI Sağlayıcı Ayarları", slug: "ai-saglayici-ayarlari", module: "api-ayarlari" },
      { label: "Kullanıcı Yönetimi", slug: "kullanici-yonetimi", module: "kullanicilar" },
      { label: "Kullanıcılar", slug: "kullanicilar", module: "kullanicilar" },
      { label: "Roller & Yetkiler", slug: "roller-yetkiler", module: "roller-yetkiler" },
      { label: "Tema / Logo", slug: "tema-logo", module: "tema-ayarlari" },
      { label: "Tema Ayarları", slug: "tema-ayarlari", module: "tema-ayarlari" },
      { label: "Site Ayarları", slug: "site-ayarlari", module: "site-ayarlari" },
      { label: "Sistem Ayarları", slug: "sistem-ayarlari", module: "site-ayarlari" },
      { label: "Karlılık", slug: "karlilik", module: "karlilik" },
      { label: "Sektör Sistemleri", slug: "sektor-sistemleri", module: "sektor-sistemleri" },
      { label: "Medya", slug: "medya", module: "medya" },
      { label: "Sistem Logları", slug: "sistem-loglari", module: "sistem-loglari" }
    ]
  }
];

export const adminNavigationItems = adminNavigationGroups.flatMap((group) => group.items);

export function getAdminSectionBySlug(slug = "") {
  if (slug === "musteri-bulucu") return adminNavigationItems.find((item) => item.module === "musteri-bulucu");
  if (slug === "sosyal-medya-denetimi") return adminNavigationItems.find((item) => item.module === "sosyal-medya-denetimi");
  return adminNavigationItems.find((item) => item.slug === slug);
}

export function getAdminHref(slug: string) {
  if (slug === "lead-workspace") return "/lead-workspace";
  if (slug === "proposal-builder") return "/proposal-builder";
  return slug ? `/hk-admin/${slug}` : "/hk-admin";
}
