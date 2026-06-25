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
    description: "Ajansın günlük yönetim, arama ve aktivite merkezi.",
    icon: "LayoutDashboard",
    badge: "OS",
    accent: "from-cyan-400 via-sky-500 to-blue-600",
    items: [
      { label: "Dashboard", slug: "", module: "dashboard", description: "Ajans KPI'ları, öncelikler ve günlük operasyon özeti." },
      { label: "HK Intelligence Command Center", slug: "intelligence-command-center", module: "dashboard", description: "Günlük öncelikler, müşteri sağlığı, risk ve kârlılık karar merkezi." },
      { label: "Risk Merkezi", slug: "risk-merkezi", module: "dashboard", description: "Tahsilat, görev, entegrasyon ve müşteri risklerini öncelik puanıyla izleyin." },
      { label: "HK Asistan", slug: "hk-asistan", module: "hk-asistan", description: "Mevcut sistem verileriyle çalışan operasyon asistanı." },
      { label: "Genel Arama", slug: "genel-arama", module: "genel-arama", description: "Müşteri, kampanya, görev ve belgelerde hızlı arama." }
    ]
  },
  {
    label: "CRM & Müşteriler",
    description: "Lead keşfinden müşteri profiline uzanan satış akışları.",
    icon: "UsersRound",
    badge: "CRM",
    accent: "from-emerald-400 via-teal-500 to-cyan-600",
    items: [
      { label: "Satış Hunisi", slug: "satis-hunisi", module: "leads", description: "Lead aşamaları, fırsatlar ve satış ilerleme görünümü." },
      { label: "Leadler", slug: "leads", module: "leads", description: "Başvurular, iletişim bilgileri ve lead durumları." },
      { label: "Takip Merkezi", slug: "takip-merkezi", module: "leads", description: "Arama, WhatsApp, toplantı ve teklif takipleri." },
      { label: "Müşteri Keşfi", slug: "musteri-kesfi", module: "musteri-bulucu", description: "Yeni işletme adayları ve dijital fırsat sinyalleri." },
      { label: "Haritalar", slug: "haritalar", module: "haritalar", description: "Bölgesel işletme keşfi ve Google Maps sinyalleri." },
      { label: "Lead Analizi", slug: "lead-analizi", module: "leads", description: "Lead kalitesi, sıcaklık ve dönüşüm potansiyeli analizi." },
      { label: "AI Denetim", slug: "ai-denetim", module: "leads", description: "İşletmeler için AI destekli dijital durum denetimi." },
      { label: "Müşteriler", slug: "musteriler", module: "musteriler", description: "Firma profilleri, yetkiler ve müşteri paneli ayarları." },
      { label: "Teklif Oluştur", slug: "teklif-hazirlama", module: "teklifler", description: "Lead veya müşteri verisinden teklif hazırlama." },
      { label: "Müşteri Markalama", slug: "musteri-markalama", module: "musteriler", description: "Müşteri paneli logo, renk ve karşılama ayarları." },
      { label: "Müşteri Onboarding", slug: "customers/onboarding", module: "musteriler", description: "Yeni müşteri kurulum ve başlangıç kontrol adımları." }
    ]
  },
  {
    label: "Reklam & Raporlama",
    description: "Meta, Google Ads ve müşteri raporlama merkezi.",
    icon: "FileBarChart",
    badge: "Rapor",
    accent: "from-orange-400 via-pink-500 to-rose-600",
    items: [
      { label: "Kampanyalar", slug: "kampanyalar", module: "kampanyalar", description: "Tüm müşterilere ait reklam kampanyaları ve bütçeler." },
      { label: "Reklam Hesabı Eşleştirme", slug: "reklam-hesabi-eslestirme", module: "kampanyalar", description: "Meta ve Google hesaplarını müşteri kayıtlarıyla bağlama." },
      { label: "Meta İstihbarat", slug: "meta-istihbarat", module: "meta-analiz", description: "Meta kampanya, kreatif ve dönüşüm performansı." },
      { label: "Google İstihbarat", slug: "google-istihbarat", module: "google-analiz", description: "Google Ads arama ve dönüşüm performansı." },
      { label: "Reklam Doktoru Pro", slug: "ad-insights", module: "ad-insights", description: "Reklam performansını teşhis eder, sorunları bulur ve aksiyon reçetesi oluşturur." },
      { label: "Meta Raporları", slug: "meta-analiz", module: "meta-analiz", description: "Meta reklam verilerinden müşteri raporları." },
      { label: "Google Ads Raporları", slug: "google-analiz", module: "google-analiz", description: "Google Ads metrikleri ve manuel rapor girişi." },
      { label: "Aylık Raporlar", slug: "aylik-raporlar", module: "aylik-raporlar", description: "Aylık performans, çalışma ve öneri özetleri." },
      { label: "Müşteri Raporları", slug: "musteri-raporlari", module: "raporlar", description: "Meta, Google ve manuel performans raporları." },
      { label: "Web Site Analitiği", slug: "website-analytics", module: "website-analytics", description: "Pixel, GA4 ve public site dönüşüm takibi." },
      { label: "PDF Rapor Tasarım Merkezi", slug: "pdf-rapor-tasarim", module: "raporlar", description: "Müşteri raporlarının görünüm ve bölüm ayarları." },
      { label: "PDF Audit", slug: "pdf-audit", module: "sosyal-medya-denetimi", description: "Dijital denetim sonuçlarını PDF olarak hazırlama." },
      { label: "Rakip Analizi", slug: "rakip-analizi", module: "rakip-analizi", description: "Rakiplerin dijital görünürlük ve reklam fırsatları." }
    ]
  },
  {
    label: "Tahsilat & Operasyon",
    description: "Ödeme, görev, belge ve ajans operasyon takibi.",
    icon: "Gauge",
    badge: "Ajans",
    accent: "from-cyan-500 via-blue-600 to-indigo-700",
    items: [
      { label: "Tahsilat", slug: "tahsilat", module: "tahsilat", description: "Ödemeler, vade takibi ve aylık gelir özeti." },
      { label: "Görevler", slug: "gorevler", module: "gorevler", description: "Ajans içi yapılacak işler ve müşteri görünür görevler." },
      { label: "Takvim", slug: "takvim", module: "gorevler", description: "Görev, kampanya, rapor ve tahsilat tarihleri." },
      { label: "Karlılık", slug: "karlilik", module: "karlilik", description: "Gelir, gider ve tahmini kârlılık görünümü." },
      { label: "Belgeler", slug: "belgeler", module: "belgeler", description: "Müşteri belgeleri, sözleşmeler ve paylaşılabilir dosyalar." },
      { label: "Gelir Tahmini", slug: "gelir-tahmini", module: "karlilik", description: "Beklenen, riskli ve gecikmiş gelir öngörüsü." },
      { label: "Sözleşme Oluştur", slug: "sozlesme-olustur", module: "belgeler", description: "Müşteri ve hizmet paketinden sözleşme taslağı." },
      { label: "WhatsApp Hatırlatma Merkezi", slug: "whatsapp-hatirlatma", module: "teklifler", description: "Takip, ödeme ve rapor mesaj şablonları." },
      { label: "Sosyal Medya Planı", slug: "sosyal-medya-plani", module: "sosyal-medya-plani", description: "Müşteri bazlı sosyal medya içerik takvimi." },
      { label: "Sektör Sistemleri", slug: "sektor-sistemleri", module: "sektor-sistemleri", description: "Sektöre özel operasyon ve takip şablonları." }
    ]
  },
  {
    label: "İçerik & AI Studio",
    description: "AI üretim alanı, içerik planları, promptlar ve medya.",
    icon: "Bot",
    badge: "AI",
    accent: "from-blue-500 via-indigo-500 to-violet-600",
    items: [
      { label: "AI Studio", slug: "ai-studio", module: "ai-studio", description: "İçerik, analiz ve rapor üretim araçları." },
      { label: "İçerik Planları", slug: "icerik-fikirleri", module: "icerik-onerileri", description: "Kanal ve hedefe göre içerik fikirleri." },
      { label: "Promptlar", slug: "prompt-uretimi", module: "prompt-kutuphanesi", description: "Tekrar kullanılabilir yapay zekâ komutları." },
      { label: "Medya", slug: "medya", module: "medya", description: "Görsel, video ve marka dosyaları." },
      { label: "Kampanya Önerileri", slug: "kampanya-onerileri", module: "kampanya-hazirligi", description: "Hedef ve sektöre göre kampanya fikirleri." }
    ]
  },
  {
    label: "Entegrasyonlar",
    description: "Reklam, ölçümleme ve dış servis bağlantıları.",
    icon: "Settings2",
    badge: "API",
    accent: "from-emerald-400 via-cyan-500 to-blue-600",
    items: [
      { label: "Entegrasyonlar", slug: "entegrasyonlar", module: "api-ayarlari", description: "Meta, Google, AI ve iletişim servis ayarları." }
    ]
  },
  {
    label: "Araçlar & Yardım",
    description: "Sistem rehberi, sağlık, denetim ve veri araçları.",
    icon: "Download",
    badge: "Araç",
    accent: "from-cyan-400 via-blue-500 to-indigo-600",
    items: [
      { label: "HK Dijital Sistem Rehberi", slug: "sistem-rehberi", module: "sistem-rehberi", description: "Tüm modüllerin kullanım kılavuzu, eğitim içerikleri ve sorun giderme rehberleri." },
      { label: "Log ve Aktivite Merkezi", slug: "log-aktivite-merkezi", module: "sistem-loglari", description: "Kullanıcı işlemleri, teknik olaylar, hatalar ve denetim kayıtları." },
      { label: "Sistem Sağlık Merkezi", slug: "sistem-sagligi", module: "sistem-sagligi", description: "API, veritabanı, ölçümleme ve servis bağlantı durumları." },
      { label: "QA Merkezi", slug: "qa-center", module: "qa-center", description: "Admin aksiyonları, API uçları ve Supabase migration uyumunu denetler." },
      { label: "Veri Aktarma", slug: "veri-aktarma", module: "veri-aktarma", description: "Müşteri ve operasyon verilerini dışa aktarma." },
      { label: "Sistem Test Merkezi", slug: "sistem-test-merkezi", module: "sistem-test-merkezi", description: "Otomatik ve manuel sistem kalite kontrolleri." }
    ]
  },
  {
    label: "Ayarlar",
    description: "Web sitesi, kullanıcı, görünüm ve sistem ayarları.",
    icon: "Settings2",
    badge: "Admin",
    accent: "from-slate-500 via-slate-700 to-slate-900",
    items: [
      { label: "Web Sitesi Yönetimi", slug: "web-sitesi-yonetimi", module: "site-ayarlari", description: "Public site içerikleri, paketler ve marka alanları." },
      { label: "Kullanıcı Yönetimi", slug: "kullanici-yonetimi", module: "kullanicilar", description: "Yönetici, ekip ve müşteri kullanıcı yetkileri." },
      { label: "Tema / Logo", slug: "tema-logo", module: "tema-ayarlari", description: "Logo ve marka görselleri için merkezi ayarlar." },
      { label: "Sistem Ayarları", slug: "sistem-ayarlari", module: "site-ayarlari", description: "Genel uygulama davranışı ve sistem tercihleri." }
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
  "pipeline": "satis-hunisi",
  "satis-pipeline": "satis-hunisi",
  "satis-hunisi": "satis-hunisi",
  "yeni-basvurular": "leads",
  "takipler": "takip-merkezi",
  "lead-follow-up": "takip-merkezi",
  "ai-audit": "ai-denetim",
  "ai-denetim-sistemi": "ai-denetim",
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
  "web-site-analitigi": "website-analytics",
  "premium-pdf-report-design-center": "pdf-rapor-tasarim",
  "pdf-rapor-tasarim-merkezi": "pdf-rapor-tasarim",
  "campaign-mapping": "reklam-hesabi-eslestirme",
  "kampanya-eslestirme": "reklam-hesabi-eslestirme",
  "reklam-hesaplari": "reklam-hesabi-eslestirme",
  "disa-aktarma": "musteri-raporlari",
  "export-center": "veri-aktarma",
  "veri-aktarimi": "veri-aktarma",
  "tema-ayarlari": "tema-logo",
  "site-ayarlari": "web-sitesi-yonetimi",
  "sayfa-icerikleri": "web-sitesi-yonetimi",
  "api-ayarlari": "entegrasyonlar",
  "ai-saglayici-ayarlari": "entegrasyonlar",
  "sistem-durumu": "sistem-sagligi",
  "sistem-testleri": "sistem-test-merkezi",
  "system-test-center": "sistem-test-merkezi",
  "sistem-loglari": "log-aktivite-merkezi",
  "aktivite-akisi": "log-aktivite-merkezi",
  "kullanim-kilavuzu": "sistem-rehberi",
  takvim: "takvim",
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
  "sosyal-istihbarat-merkezi": "pdf-audit",
  "contract-generator": "sozlesme-olustur",
  "sozlesme-generator": "sozlesme-olustur",
  "whatsapp-reminder-center": "whatsapp-hatirlatma",
  "gelir-forecast": "gelir-tahmini",
  "revenue-forecast": "gelir-tahmini",
  "reklam-yorum-merkezi": "ad-insights",
  "hk-reklam-zekasi": "ad-insights",
  "reklam-doktoru-pro": "ad-insights",
  "hk-reklam-doktoru-pro": "ad-insights",
  "qa-merkezi": "qa-center"
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
