export const adminNavigationGroups = [
  {
    label: "Ana Menü",
    items: [{ label: "Dashboard", slug: "" }]
  },
  {
    label: "HK Intelligence",
    items: [
      { label: "CRM", slug: "crm" },
      { label: "Müşteri Bulucu", slug: "musteri-bulucu" },
      { label: "Lead Yönetimi", slug: "leads" },
      { label: "Meta Analiz", slug: "meta-analiz" },
      { label: "Google Analiz", slug: "google-analiz" },
      { label: "AI Studio", slug: "ai-studio" },
      { label: "Teklif Motoru", slug: "teklifler" },
      { label: "Raporlar", slug: "raporlar" }
    ]
  },
  {
    label: "Yönetim",
    items: [
      { label: "Müşteriler", slug: "musteriler" },
      { label: "Site Ayarları", slug: "site-ayarlari" },
      { label: "API Ayarları", slug: "api-ayarlari" },
      { label: "Medya / Logo", slug: "medya" },
      { label: "Kullanıcılar", slug: "kullanicilar" },
      { label: "Kullanım Kılavuzu", slug: "kullanim-kilavuzu" }
    ]
  }
] as const;

export const adminNavigationItems = adminNavigationGroups.flatMap((group) => group.items);

export function getAdminSectionBySlug(slug = "") {
  return adminNavigationItems.find((item) => item.slug === slug);
}

export function getAdminHref(slug: string) {
  return slug ? `/hk-admin/${slug}` : "/hk-admin";
}
