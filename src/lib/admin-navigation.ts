export const adminNavigationGroups = [
  {
    label: "Genel",
    items: [
      { label: "Dashboard", slug: "", module: "dashboard" },
      { label: "Genel Arama", slug: "genel-arama", module: "genel-arama" },
      { label: "Kullanım Kılavuzu", slug: "kullanim-kilavuzu", module: "kullanim-kilavuzu" }
    ]
  },
  {
    label: "Müşteri & CRM",
    items: [
      { label: "CRM", slug: "crm", module: "crm" },
      { label: "Lead Yönetimi", slug: "leads", module: "leads" },
      { label: "Müşteriler", slug: "musteriler", module: "musteriler" },
      { label: "Takip Görevleri", slug: "takip-gorevleri", module: "takip-gorevleri" },
      { label: "Notlar", slug: "notlar", module: "notlar" }
    ]
  },
  {
    label: "Keşif & Haritalar",
    items: [
      { label: "İşletme Keşfi", slug: "isletme-kesfi", module: "musteri-bulucu" },
      { label: "Haritalar", slug: "haritalar", module: "haritalar" },
      { label: "Bölgesel Analiz", slug: "bolgesel-analiz", module: "bolgesel-analiz" },
      { label: "Rakip Listesi", slug: "rakip-listesi", module: "rakip-listesi" },
      { label: "Kaydedilen Adaylar", slug: "kaydedilen-adaylar", module: "kaydedilen-adaylar" }
    ]
  },
  {
    label: "Reklam Zekâsı",
    items: [
      { label: "Meta Analiz", slug: "meta-analiz", module: "meta-analiz" },
      { label: "Google Analiz", slug: "google-analiz", module: "google-analiz" },
      { label: "Sosyal İstihbarat Merkezi", slug: "sosyal-istihbarat-merkezi", module: "sosyal-medya-denetimi" },
      { label: "Funnel Analizi", slug: "funnel-analizi", module: "funnel-analizi" },
      { label: "Reklam Fırsatları", slug: "reklam-firsatlari", module: "reklam-firsatlari" }
    ]
  },
  {
    label: "Hazırlık & Üretim",
    items: [
      { label: "Hazırlık Merkezi", slug: "hazirlik", module: "hazirlik" },
      { label: "AI Studio", slug: "ai-studio", module: "ai-studio" },
      { label: "İçerik Önerileri", slug: "icerik-onerileri", module: "icerik-onerileri" },
      { label: "Prompt Kütüphanesi", slug: "prompt-kutuphanesi", module: "prompt-kutuphanesi" },
      { label: "Kampanya Hazırlığı", slug: "kampanya-hazirligi", module: "kampanya-hazirligi" }
    ]
  },
  {
    label: "Teklif & Raporlama",
    items: [
      { label: "Teklif Motoru", slug: "teklifler", module: "teklifler" },
      { label: "Teklifler", slug: "teklif-listesi", module: "teklif-listesi" },
      { label: "Raporlar", slug: "raporlar", module: "raporlar" },
      { label: "Rapor Yorumları", slug: "rapor-yorumlari", module: "rapor-yorumlari" },
      { label: "Dışa Aktarımlar", slug: "disa-aktarimlar", module: "disa-aktarimlar" }
    ]
  },
  {
    label: "Yönetim",
    items: [
      { label: "Kullanıcılar", slug: "kullanicilar", module: "kullanicilar" },
      { label: "Roller & Yetkiler", slug: "roller-yetkiler", module: "roller-yetkiler" },
      { label: "Site Ayarları", slug: "site-ayarlari", module: "site-ayarlari" },
      { label: "API Ayarları", slug: "api-ayarlari", module: "api-ayarlari" },
      { label: "Tema Ayarları", slug: "tema-ayarlari", module: "tema-ayarlari" },
      { label: "Medya", slug: "medya", module: "medya" },
      { label: "Sistem Logları", slug: "sistem-loglari", module: "sistem-loglari" }
    ]
  }
] as const;

export const adminNavigationItems = adminNavigationGroups.flatMap((group) => group.items);

export function getAdminSectionBySlug(slug = "") {
  if (slug === "musteri-bulucu") return adminNavigationItems.find((item) => item.module === "musteri-bulucu");
  if (slug === "sosyal-medya-denetimi") return adminNavigationItems.find((item) => item.module === "sosyal-medya-denetimi");
  return adminNavigationItems.find((item) => item.slug === slug);
}

export function getAdminHref(slug: string) {
  return slug ? `/hk-admin/${slug}` : "/hk-admin";
}
