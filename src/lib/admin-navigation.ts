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
    description: "Genel durum, kalite, sağlık, log ve yedekleme kontrolleri.",
    icon: "LayoutDashboard",
    badge: "OS",
    accent: "from-cyan-400 via-sky-500 to-blue-600",
    items: [
      { label: "Dashboard", slug: "", module: "dashboard", description: "Ajans KPI'ları, öncelikler ve günlük operasyon özeti." },
      { label: "HK Intelligence CEO", slug: "hk-intelligence-ceo", module: "hk-intelligence-ceo", description: "AI ajanlarını, riskleri, KPI'ları ve ajans operasyon kararlarını tek executive masadan yönetin." },
      { label: "QA Merkezi", slug: "qa-center", module: "qa-center", description: "Admin aksiyonları, API uçları ve Supabase migration uyumunu denetler." },
      { label: "Sistem Sağlığı", slug: "sistem-sagligi", module: "sistem-sagligi", description: "API, veritabanı, ölçümleme ve servis bağlantı durumları." },
      { label: "Sistem Test Merkezi", slug: "sistem-test-merkezi", module: "sistem-test-merkezi", description: "Otomatik ve manuel sistem kalite kontrolleri." },
      { label: "Log Merkezi", slug: "log-aktivite-merkezi", module: "sistem-loglari", description: "Kullanıcı işlemleri, teknik olaylar ve denetim kayıtları." },
      { label: "Veri Yedekleme", slug: "veri-aktarma", module: "veri-aktarma", description: "Tam yedek, export, import önizleme ve veri aktarma işlemleri." },
      { label: "Sistem Rehberi", slug: "sistem-rehberi", module: "sistem-rehberi", description: "Tüm modüllerin kullanım kılavuzu, eğitim içerikleri ve sorun giderme rehberleri." }
    ]
  },
  {
    label: "Müşteri Merkezi",
    description: "Müşteri, firma, şube, kurulum ve müşteri notları.",
    icon: "UsersRound",
    badge: "Müşteri",
    accent: "from-emerald-400 via-teal-500 to-cyan-600",
    items: [
      { label: "Müşteriler", slug: "musteriler", module: "musteriler", description: "Aktif, pasif ve aday müşteri kayıtlarını yönet." },
      { label: "Onboarding", slug: "customers/onboarding", module: "musteriler", description: "Yeni müşteri kurulum ve başlangıç kontrol adımları." },
      { label: "Müşteri Entegrasyonları", slug: "musteri-entegrasyonlari", module: "api-ayarlari", description: "Müşteri bazlı Meta, Google, GA4, GTM ve web analitiği durumu." },
      { label: "Müşteri Paketleri", slug: "musteri-paketleri", module: "hk-intelligence-ceo", description: "Uygulanan paketler, planlar ve AI operasyon çıktıları." },
      { label: "Müşteri Markalama", slug: "musteri-markalama", module: "musteriler", description: "Müşteri paneli logo, renk ve karşılama ayarları." }
    ]
  },
  {
    label: "Satış & CRM",
    description: "Lead, keşif, teklif ve satış hunisi akışları.",
    icon: "UsersRound",
    badge: "CRM",
    accent: "from-blue-400 via-cyan-500 to-emerald-600",
    items: [
      { label: "Lead Merkezi", slug: "leads", module: "leads", description: "Başvurular, iletişim bilgileri ve lead durumları." },
      { label: "Müşteri Keşfi", slug: "musteri-kesfi", module: "musteri-bulucu", description: "Yeni işletme adayları ve dijital fırsat sinyalleri." },
      { label: "Haritalar", slug: "haritalar", module: "haritalar", description: "Bölgesel işletme keşfi ve Google Maps sinyalleri." },
      { label: "Lead Workspace", slug: "lead-workspace", module: "leads", description: "Lead detay çalışma alanı ve satış notları." },
      { label: "Lead Analizi", slug: "lead-analizi", module: "leads", description: "Lead kalitesi, sıcaklık ve dönüşüm potansiyeli analizi." },
      { label: "Takip Merkezi", slug: "takip-merkezi", module: "leads", description: "Arama, WhatsApp, toplantı ve teklif takipleri." },
      { label: "Satış Hunisi", slug: "satis-hunisi", module: "leads", description: "Lead aşamaları, fırsatlar ve satış ilerleme görünümü." },
      { label: "Teklif Oluştur", slug: "teklif-hazirlama", module: "teklifler", description: "Lead veya müşteri verisinden teklif hazırlama." },
      { label: "Teklif Takip Merkezi", slug: "teklif-takip-merkezi", module: "teklifler", description: "Teklif sonrası 3, 7, 14 ve 21 günlük takip akışları." },
      { label: "Kazanıldı / Kaybedildi Analizi", slug: "kazanildi-kaybedildi-analizi", module: "leads", description: "Kapanan fırsatlardan sektör, şehir, paket ve itiraz öğrenimi." }
    ]
  },
  {
    label: "Reklam & Performans",
    description: "Meta, Google, web analitiği, reklam doktoru ve rakip istihbaratı.",
    icon: "FileBarChart",
    badge: "Rapor",
    accent: "from-orange-400 via-pink-500 to-rose-600",
    items: [
      { label: "Kampanyalar", slug: "kampanyalar", module: "kampanyalar", description: "Tüm müşterilere ait reklam kampanyaları ve bütçeler." },
      { label: "Reklam Hesabı Eşleştirme", slug: "reklam-hesabi-eslestirme", module: "kampanyalar", description: "Meta ve Google hesaplarını müşteri kayıtlarıyla bağlama." },
      { label: "Google İstihbarat", slug: "google-istihbarat", module: "google-analiz", description: "Google Ads arama ve dönüşüm performansı." },
      { label: "Meta İstihbarat", slug: "meta-istihbarat", module: "meta-analiz", description: "Meta kampanya, kreatif ve dönüşüm performansı." },
      { label: "Website Analytics", slug: "website-analytics", module: "website-analytics", description: "Pixel, GA4 ve public site dönüşüm takibi." },
      { label: "Reklam Doktoru Pro", slug: "ad-insights", module: "ad-insights", description: "Reklam performansını teşhis eder, sorunları bulur ve aksiyon reçetesi oluşturur." },
      { label: "Meta Raporları", slug: "meta-raporlari", module: "meta-analiz", description: "Meta reklam verilerinden müşteri raporları." },
      { label: "Google Ads Raporları", slug: "google-ads-raporlari", module: "google-analiz", description: "Google Ads metrikleri ve manuel rapor girişi." },
      { label: "Rakip Analizi", slug: "rakip-analizi", module: "rakip-analizi", description: "Rakip görünürlüğü, reklam fırsatları, alarm ve sinyal takipleri." }
    ]
  },
  {
    label: "AI Merkezi",
    description: "Agent Hub, AI Studio, workflow, prompt ve AI hafıza akışları.",
    icon: "Bot",
    badge: "AI",
    accent: "from-blue-500 via-indigo-500 to-violet-600",
    items: [
      { label: "Agent Hub", slug: "agent-hub", module: "agent-hub", description: "Agent, workflow, hafıza, öğrenme, benchmark ve sağlayıcı yönetimi." },
      { label: "AI Studio", slug: "ai-studio", module: "ai-studio", description: "İçerik, analiz ve rapor üretim araçları." },
      { label: "Prompt Merkezi", slug: "prompt-uretimi", module: "prompt-kutuphanesi", description: "Tekrar kullanılabilir yapay zekâ komutları." },
      { label: "AI Satış Koçu", slug: "ai-satis-kocu", module: "ai-studio", description: "Lead ve fırsatlar için arama, WhatsApp, e-posta ve itiraz cevapları." }
    ]
  },
  {
    label: "Ajans Operasyonu",
    description: "Görev, belge, takvim ve ajans operasyon takibi.",
    icon: "Gauge",
    badge: "Ajans",
    accent: "from-cyan-500 via-blue-600 to-indigo-700",
    items: [
      { label: "Görevler", slug: "gorevler", module: "gorevler", description: "Ajans içi yapılacak işler ve müşteri görünür görevler." },
      { label: "Takvim", slug: "takvim", module: "gorevler", description: "Görev, kampanya, rapor ve tahsilat tarihleri." },
      { label: "Ajans Hedefleri", slug: "ajans-hedefleri", module: "karlilik", description: "Aylık gelir, müşteri, teklif, görüşme ve tahsilat hedefleri." },
      { label: "Belgeler", slug: "belgeler", module: "belgeler", description: "Müşteri belgeleri, sözleşmeler ve paylaşılabilir dosyalar." },
      { label: "Sözleşme Oluştur", slug: "sozlesme-olustur", module: "belgeler", description: "Müşteri ve hizmet paketinden sözleşme taslağı." },
      { label: "WhatsApp Hatırlatma Merkezi", slug: "whatsapp-hatirlatma", module: "teklifler", description: "Takip, ödeme ve rapor mesaj şablonları." },
      { label: "Sosyal Medya Planı", slug: "sosyal-medya-plani", module: "sosyal-medya-plani", description: "İçerik takvimi, Reels/Story planı ve müşteri onayı." },
      { label: "Sektör Sistemleri", slug: "sektor-sistemleri", module: "sektor-sistemleri", description: "Sektöre özel operasyon ve takip şablonları." }
    ]
  },
  {
    label: "Muhasebe",
    description: "Tahsilat, gelir/gider, kârlılık ve finans raporlarını tek merkezde yönet.",
    icon: "Gauge",
    badge: "Finans",
    accent: "from-emerald-500 via-teal-600 to-cyan-700",
    items: [
      { label: "Muhasebe Merkezi", slug: "muhasebe", module: "muhasebe", description: "Gelir, gider, tahsilat, tahmin ve finans karar paneli." },
      { label: "Tahsilatlar", slug: "tahsilat", module: "tahsilat", description: "Ödeme kayıtları ve tahsilat durumu." },
      { label: "Gelir Gider", slug: "gelir-gider", module: "karlilik", description: "Gelir ve giderleri tek tabloda takip edin." },
      { label: "Bekleyen Ödemeler", slug: "bekleyen-odemeler", module: "tahsilat", description: "Bekleyen ve geciken tahsilatları izleyin." },
      { label: "Gelir Tahmini", slug: "gelir-tahmini", module: "karlilik", description: "Beklenen gelir, riskli gelir ve tahmini kâr projeksiyonu." },
      { label: "Kârlılık", slug: "karlilik", module: "karlilik", description: "Müşteri bazlı kâr ve marj görünümü." }
    ]
  },
  {
    label: "Rapor Merkezi",
    description: "Müşteri raporları, çıktı formatları ve dışa aktarım.",
    icon: "FileBarChart",
    badge: "Rapor",
    accent: "from-violet-400 via-indigo-500 to-blue-600",
    items: [
      { label: "Aylık Raporlar", slug: "aylik-raporlar", module: "aylik-raporlar", description: "Aylık performans, çalışma ve öneri özetleri." },
      { label: "Müşteri Raporları", slug: "musteri-raporlari", module: "raporlar", description: "Meta, Google ve manuel performans raporları." },
      { label: "PDF Rapor Tasarım Merkezi", slug: "pdf-rapor-tasarim", module: "raporlar", description: "PDF rapor görünümü ve bölüm ayarları." },
      { label: "PDF Audit", slug: "pdf-audit", module: "sosyal-medya-denetimi", description: "Dijital denetim sonuçlarını PDF olarak hazırlama." },
      { label: "Rapor Çıktıları", slug: "rapor-ciktilari", module: "raporlar", description: "PDF, Word ve PowerPoint uyumlu rapor çıktıları." },
      { label: "Dışa Aktar", slug: "rapor-disa-aktar", module: "veri-aktarma", description: "Rapor ve veri dışa aktarım araçları." }
    ]
  },
  {
    label: "İçerik & Medya",
    description: "İçerik planları, sosyal medya üretimi ve medya dosyaları.",
    icon: "Bot",
    badge: "İçerik",
    accent: "from-fuchsia-400 via-pink-500 to-rose-600",
    items: [
      { label: "İçerik Planları", slug: "icerik-fikirleri", module: "icerik-onerileri", description: "Kanal ve hedefe göre içerik fikirleri." },
      { label: "Sosyal Medya Planı", slug: "sosyal-medya-icerik-plani", module: "sosyal-medya-plani", description: "Müşteri bazlı sosyal medya içerik takvimi." },
      { label: "Kreatif Stüdyo", slug: "kampanya-onerileri", module: "kampanya-hazirligi", description: "Kreatif öneriler, reklam metni, kampanya fikirleri ve içerik taslakları." },
      { label: "Medya", slug: "medya", module: "medya", description: "Görsel, video ve marka dosyaları." }
    ]
  },
  {
    label: "Entegrasyonlar",
    description: "Reklam, ölçümleme ve dış servis bağlantıları.",
    icon: "Settings2",
    badge: "API",
    accent: "from-emerald-400 via-cyan-500 to-blue-600",
    items: [
      { label: "Entegrasyonlar", slug: "entegrasyonlar", module: "api-ayarlari", description: "Meta, Pixel, Dataset, Google, GA4, Search Console, Ads, GTM, Clarity, Hotjar, SMTP ve API durumu." },
      { label: "Meta", slug: "meta-integrations", module: "api-ayarlari", description: "Meta işletme, reklam hesabı, Pixel ve Dataset bağlantıları." },
      { label: "Google", slug: "google-integrations", module: "api-ayarlari", description: "Google, GA4, Search Console ve Google Ads bağlantıları." },
      { label: "Website Analytics", slug: "web-analitik-entegrasyonlari", module: "website-analytics", description: "GTM, Clarity, Hotjar ve web analitiği kurulum durumu." },
      { label: "Discord", slug: "discord-entegrasyonu", module: "agent-hub", description: "Discord webhook bildirim hazırlığı." },
      { label: "API Durumu", slug: "api-durumu", module: "api-ayarlari", description: "Secret göstermeden genel API ve entegrasyon durumu." }
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
      { label: "Roller", slug: "roller-yetkiler", module: "kullanicilar", description: "Rol ve modül yetkileri." },
      { label: "Tema / Logo", slug: "tema-logo", module: "tema-ayarlari", description: "Logo ve marka görselleri için merkezi ayarlar." },
      { label: "Sistem Ayarları", slug: "sistem-ayarlari", module: "site-ayarlari", description: "Genel uygulama davranışı ve sistem tercihleri." },
      { label: "Mobil Operasyon Modu", slug: "mobil-operasyon-modu", module: "site-ayarlari", description: "Saha kullanımı için büyük butonlu admin görünüm tercihi." },
      { label: "Güvenlik", slug: "guvenlik", module: "kullanicilar", description: "Kullanıcı erişimi, rol güvenliği ve yönetim kontrolleri." }
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
  "customers": "musteriler",
  "firmalar": "musteriler",
  "aktif-musteriler": "musteriler",
  "pasif-musteriler": "musteriler",
  "musteri-yonetimi": "musteriler",
  reddedilenler: "leads",
  silinenler: "leads",
  "lead-yonetimi": "lead-analizi",
  "crm-lead-workspace": "lead-workspace",
  "teklif-takip": "teklif-takip-merkezi",
  "proposal-followups": "teklif-takip-merkezi",
  "won-lost-analysis": "kazanildi-kaybedildi-analizi",
  "ajans-hedef-panosu": "ajans-hedefleri",
  "agency-targets": "ajans-hedefleri",
  "ai-sales-coach": "ai-satis-kocu",
  "hk-agent-hub": "agent-hub",
  "ai-otomasyon": "agent-hub",
  "hk-ceo-masasi": "hk-intelligence-ceo",
  "executive-command-center": "hk-intelligence-ceo",
  "autonomous-agency": "hk-intelligence-ceo",
  "hk-intelligence-autonomous-agency": "hk-intelligence-ceo",
  "teklifler": "teklif-hazirlama",
  "teklif-motoru": "teklif-hazirlama",
  "teklif-listesi": "musteri-raporlari",
  "raporlar": "musteri-raporlari",
  "performans-raporlari": "musteri-raporlari",
  "rapor-yorumlari": "musteri-raporlari",
  "web-site-analitigi": "website-analytics",
  "meta-pixel-dataset": "meta-pixel-dataset",
  "google-ga4-search-console": "google-ga4-search-console",
  "gtm": "gtm-baglantilari",
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
  "tahsilat": "muhasebe?tab=tahsilatlar",
  "tahsilatlar": "muhasebe?tab=tahsilatlar",
  "gelir-forecast": "muhasebe?tab=gelir-tahmini",
  "revenue-forecast": "muhasebe?tab=gelir-tahmini",
  "gelir-tahmini": "muhasebe?tab=gelir-tahmini",
  "bekleyen-odemeler": "muhasebe?tab=bekleyen",
  "gelir-gider": "muhasebe?tab=gelir-gider",
  "karlilik": "muhasebe?tab=karlilik",
  "musteri-finans-ozeti": "muhasebe?tab=musteri-finans",
  "finans-export": "muhasebe?tab=export",
  "export": "muhasebe?tab=export",
  "reklam-yorum-merkezi": "ad-insights",
  "hk-reklam-zekasi": "ad-insights",
  "reklam-doktoru-pro": "ad-insights",
  "hk-reklam-doktoru-pro": "ad-insights",
  "qa-merkezi": "qa-center"
};

export function getAdminSectionBySlug(slug = "") {
  const direct = adminNavigationItems.find((item) => item.slug === slug);
  if (direct) return direct;
  const normalizedSlug = legacySlugRedirects[slug] || slug;
  if (normalizedSlug === "musteri-bulucu") return adminNavigationItems.find((item) => item.module === "musteri-bulucu");
  if (normalizedSlug === "sosyal-medya-denetimi") return adminNavigationItems.find((item) => item.module === "sosyal-medya-denetimi");
  return adminNavigationItems.find((item) => item.slug === normalizedSlug);
}

export function getCanonicalAdminSlug(slug = "") {
  if (adminNavigationItems.some((item) => item.slug === slug)) return slug;
  return legacySlugRedirects[slug] || slug;
}

export function getAdminHref(slug: string) {
  if (slug === "lead-workspace") return "/lead-workspace";
  if (slug === "proposal-builder") return "/proposal-builder";
  return slug ? `/hk-admin/${slug}` : "/hk-admin";
}
