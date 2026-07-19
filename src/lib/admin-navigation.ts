import type { AdminModule } from "@/lib/permissions";

export type AdminNavigationItem = {
  label: string;
  slug: string;
  module: AdminModule;
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

const adminNavigationSourceGroups: AdminNavigationGroup[] = [
  {
    label: "Ana Merkez",
    description: "Günlük ajans özeti ve executive karar masası.",
    icon: "LayoutDashboard",
    badge: "OS",
    accent: "from-cyan-400 via-sky-500 to-blue-600",
    items: [
      { label: "Dashboard", slug: "", module: "dashboard", description: "Ajans KPI'ları, öncelikler ve günlük operasyon özeti." },
      { label: "HK Intelligence CEO", slug: "hk-intelligence-ceo", module: "hk-intelligence-ceo", description: "AI ajanlarını, riskleri, KPI'ları ve ajans operasyon kararlarını tek executive masadan yönetin." }
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
      { label: "Müşteri Entegrasyonları", slug: "musteri-entegrasyonlari", module: "api-ayarlari", description: "Müşteri bazlı manuel/OAuth hazırlık bağlantıları, Meta, Google, GA4, GTM ve web analitiği durumu." },
      { label: "Müşteri Paketleri", slug: "musteri-paketleri", module: "hk-intelligence-ceo", description: "Uygulanan paketler, planlar ve AI operasyon çıktıları." },
      { label: "Müşteri Markalama", slug: "musteri-markalama", module: "musteriler", description: "Müşteri paneli logo, renk ve karşılama ayarları." }
    ]
  },
  {
    label: "CRM Merkezi",
    description: "Lead, müşteri keşfi, satış hunisi ve teklif takibi.",
    icon: "UsersRound",
    badge: "CRM",
    accent: "from-blue-400 via-cyan-500 to-emerald-600",
    items: [
      { label: "Lead Merkezi", slug: "leads", module: "leads", description: "Başvurular, iletişim bilgileri ve lead durumları." },
      { label: "Müşteri Keşfi", slug: "musteri-kesfi", module: "musteri-bulucu", description: "Yeni işletme adayları ve dijital fırsat sinyalleri." },
      { label: "Haritalar", slug: "haritalar", module: "haritalar", description: "Bölgesel işletme keşfi ve Google Maps sinyalleri." },
      { label: "Rakip İstihbarat Merkezi", slug: "rakip-analizi", module: "rakip-analizi", description: "Lead veya müşteri için gerçek rakip keşfi, skor ve sinyal takibi." },
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
      { label: "Reklam Operasyon Merkezi", slug: "reklam-operasyon-merkezi", module: "reklam-operasyon-merkezi", description: "Müşteri reklam harcaması, kanal sağlığı, funnel, doktor kontrolleri ve yayın öncesi planı tek merkezde." },
      { label: "Reklam Hesabı Eşleştirme", slug: "reklam-hesabi-eslestirme", module: "kampanyalar", description: "Meta ve Google hesaplarını müşteri kayıtlarıyla bağlama." },
      { label: "Google Ads İstihbaratı", slug: "google-istihbarat", module: "google-analiz", description: "Google Ads arama ve dönüşüm performansı." },
      { label: "Meta Reklam İstihbaratı", slug: "meta-istihbarat", module: "meta-analiz", description: "Meta kampanya, kreatif ve dönüşüm performansı." },
      { label: "Web Analitiği", slug: "website-analytics", module: "website-analytics", description: "Pixel, GA4 ve web sitesi dönüşüm takibi." },
      { label: "Reklam Doktoru Pro", slug: "ad-insights", module: "ad-insights", description: "Reklam performansını teşhis eder, sorunları bulur ve aksiyon reçetesi oluşturur." },
      { label: "Büyüme Motoru", slug: "growth-engine", module: "growth-engine", description: "Müşteri satış yolculuğunu, funnel yapısını, kreatif ihtiyacını ve takip planını oluştur." },
      { label: "Funnel Planlayıcı", slug: "funnel-builder", module: "funnel-builder", description: "Müşteriye özel funnel amacı, kanal ve eksik adımları kart tabanlı planla." },
      { label: "Modül Pazarı", slug: "marketplace", module: "marketplace", description: "Paket ve modül kartlarından Büyüme Motoru planı başlat." },
      { label: "Meta Raporları", slug: "meta-raporlari", module: "meta-analiz", description: "Meta reklam verilerinden müşteri raporları." },
      { label: "Google Ads Raporları", slug: "google-ads-raporlari", module: "google-analiz", description: "Google Ads metrikleri ve manuel rapor girişi." },
    ]
  },
  {
    label: "Yapay Zekâ Merkezi",
    description: "Agent Hub, Yapay Zekâ Stüdyosu, workflow, prompt ve AI hafıza akışları.",
    icon: "Bot",
    badge: "YZ",
    accent: "from-blue-500 via-indigo-500 to-violet-600",
    items: [
      { label: "Agent Hub", slug: "agent-hub", module: "agent-hub", description: "Agent, workflow, hafıza, öğrenme, benchmark ve sağlayıcı yönetimi." },
      { label: "Yapay Zekâ Stüdyosu", slug: "ai-studio", module: "ai-studio", description: "İçerik, analiz ve rapor üretim araçları." },
      { label: "Prompt Merkezi", slug: "prompt-uretimi", module: "prompt-kutuphanesi", description: "Tekrar kullanılabilir yapay zekâ komutları." },
      { label: "Yapay Zekâ Satış Koçu", slug: "ai-satis-kocu", module: "ai-studio", description: "Potansiyel müşteri ve fırsatlar için arama, WhatsApp, e-posta ve itiraz cevapları." }
    ]
  },
  {
    label: "Ajans Operasyonu",
    description: "Görev, belge, takvim ve ajans operasyon takibi.",
    icon: "Gauge",
    badge: "Ajans",
    accent: "from-cyan-500 via-blue-600 to-indigo-700",
    items: [
      { label: "İletişim Merkezi", slug: "iletisim-merkezi", module: "iletisim-merkezi", description: "Müşteri talepleri, ekip yanıtları, atamalar ve ekip içi iletişim geçmişi." },
      { label: "Görevler", slug: "gorevler", module: "gorevler", description: "Ajans içi yapılacak işler ve müşteri görünür görevler." },
      { label: "Takvim", slug: "takvim", module: "gorevler", description: "Görev, kampanya, rapor ve tahsilat tarihleri." },
      { label: "Ajans Hedefleri", slug: "ajans-hedefleri", module: "karlilik", description: "Aylık gelir, müşteri, teklif, görüşme ve tahsilat hedefleri." },
      { label: "Belgeler", slug: "belgeler", module: "belgeler", description: "Müşteri belgeleri, sözleşmeler ve paylaşılabilir dosyalar." },
      { label: "Sözleşme Oluştur", slug: "sozlesme-olustur", module: "belgeler", description: "Müşteri ve hizmet paketinden sözleşme taslağı." },
      { label: "WhatsApp Hatırlatma Merkezi", slug: "whatsapp-hatirlatma", module: "teklifler", description: "Takip, ödeme ve rapor mesaj şablonları." },
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
      { label: "Blog & SEO Merkezi", slug: "blog-seo", module: "blog-seo", description: "Blog yazıları, arama niyeti haritası, içerik takvimi ve SEO kalite kontrolleri." },
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
      { label: "Entegrasyonlar", slug: "entegrasyonlar", module: "api-ayarlari", description: "Müşteri bazlı hesap bağlantıları, OAuth hazırlığı, Meta, Pixel, Dataset, Google, GA4, Search Console, Ads, GTM, Clarity, Hotjar, SMTP ve API durumu." },
      { label: "Meta", slug: "meta-integrations", module: "api-ayarlari", description: "Meta işletme, reklam hesabı, Pixel ve Dataset bağlantıları." },
      { label: "Google", slug: "google-integrations", module: "api-ayarlari", description: "Google, GA4, Search Console ve Google Ads bağlantıları." },
      { label: "OAuth Kurulum Durumu", slug: "oauth-kurulum-durumu", module: "api-ayarlari", description: "Meta, Google, TikTok ve X otomatik bağlantı ENV ve callback durumunu denetler." },
      { label: "Web Analitiği Bağlantıları", slug: "web-analitik-entegrasyonlari", module: "website-analytics", description: "GTM, Clarity, Hotjar ve web analitiği kurulum durumu." },
      { label: "Discord", slug: "discord-entegrasyonu", module: "agent-hub", description: "Discord webhook bildirim hazırlığı." },
      { label: "API Durumu", slug: "api-durumu", module: "api-ayarlari", description: "Secret göstermeden genel API ve entegrasyon durumu." }
    ]
  },
  {
    label: "Sistem",
    description: "Web sitesi, kullanıcı, görünüm, kalite ve sistem ayarları.",
    icon: "Settings2",
    badge: "Admin",
    accent: "from-slate-500 via-slate-700 to-slate-900",
    items: [
      { label: "Web Sitesi Yönetimi", slug: "web-sitesi-yonetimi", module: "site-ayarlari", description: "Public site içerikleri, paketler ve marka alanları." },
      { label: "Kullanıcı Yönetimi", slug: "kullanici-yonetimi", module: "kullanicilar", description: "Yönetici, ekip ve müşteri kullanıcı yetkileri." },
      { label: "Roller", slug: "roller-yetkiler", module: "kullanicilar", description: "Rol ve modül yetkileri." },
      { label: "Tema / Logo", slug: "tema-logo", module: "tema-ayarlari", description: "Logo ve marka görselleri için merkezi ayarlar." },
      { label: "Sistem Ayarları", slug: "sistem-ayarlari", module: "site-ayarlari", description: "Genel uygulama davranışı ve sistem tercihleri." },
      { label: "Güvenlik", slug: "guvenlik", module: "kullanicilar", description: "Kullanıcı erişimi, rol güvenliği ve yönetim kontrolleri." },
      { label: "HK Asistan Ayarları", slug: "hk-asistan-ayarlari", module: "hk-asistan", description: "Müşteri bazlı HK Asistan izinleri, sağlayıcı modu ve günlük limitler." },
      { label: "QA Merkezi", slug: "qa-center", module: "qa-center", description: "Admin aksiyonları, API uçları ve Supabase migration uyumunu denetler." },
      { label: "Sistem Sağlığı", slug: "sistem-sagligi", module: "sistem-sagligi", description: "API, veritabanı, ölçümleme ve servis bağlantı durumları." },
      { label: "Sistem Test Merkezi", slug: "sistem-test-merkezi", module: "sistem-test-merkezi", description: "Otomatik ve manuel sistem kalite kontrolleri." },
      { label: "Log Merkezi", slug: "log-aktivite-merkezi", module: "sistem-loglari", description: "Kullanıcı işlemleri, teknik olaylar ve denetim kayıtları." },
      { label: "Veri Yedekleme", slug: "veri-aktarma", module: "veri-aktarma", description: "Tam yedek, export, import önizleme ve veri aktarma işlemleri." },
      { label: "Sistem Rehberi", slug: "sistem-rehberi", module: "sistem-rehberi", description: "Tüm modüllerin kullanım kılavuzu, eğitim içerikleri ve sorun giderme rehberleri." }
    ]
  }
];

const navigationGroupPlan = [
  {
    label: "Ana Merkez",
    description: "Günlük ajans özeti ve executive karar masası.",
    icon: "LayoutDashboard",
    badge: "OS",
    accent: "from-cyan-400 via-sky-500 to-blue-600",
    sources: ["Ana Merkez"]
  },
  {
    label: "Müşteri Yönetimi",
    description: "Müşteri, firma, şube, kurulum ve müşteri notları.",
    icon: "UsersRound",
    badge: "Müşteri",
    accent: "from-emerald-400 via-teal-500 to-cyan-600",
    sources: ["Müşteri Merkezi"]
  },
  {
    label: "Satış ve Keşif",
    description: "Lead, müşteri keşfi, satış hunisi ve teklif takibi.",
    icon: "UsersRound",
    badge: "CRM",
    accent: "from-blue-400 via-cyan-500 to-emerald-600",
    sources: ["CRM Merkezi"]
  },
  {
    label: "Operasyon",
    description: "Görev, takvim, iletişim ve ajans iş akışları.",
    icon: "Gauge",
    badge: "Ajans",
    accent: "from-cyan-500 via-blue-600 to-indigo-700",
    sources: ["Ajans Operasyonu"]
  },
  {
    label: "Reklam ve Performans",
    description: "Kampanyalar, reklam hesapları, performans ve raporlama.",
    icon: "FileBarChart",
    badge: "Ads",
    accent: "from-orange-400 via-pink-500 to-rose-600",
    sources: ["Reklam & Performans", "Rapor Merkezi"]
  },
  {
    label: "İçerik ve AI",
    description: "İçerik üretimi, kreatif, SEO ve yapay zekâ araçları.",
    icon: "Bot",
    badge: "AI",
    accent: "from-violet-500 via-purple-500 to-fuchsia-600",
    sources: ["Yapay Zekâ Merkezi", "İçerik & Medya"]
  },
  {
    label: "Finans",
    description: "Tahsilat, ödeme, kârlılık ve finansal raporlar.",
    icon: "Gauge",
    badge: "Finans",
    accent: "from-emerald-500 via-teal-600 to-cyan-700",
    sources: ["Muhasebe"]
  },
  {
    label: "Entegrasyonlar",
    description: "Reklam, ölçümleme ve dış servis bağlantıları.",
    icon: "Settings2",
    badge: "API",
    accent: "from-emerald-400 via-cyan-500 to-blue-600",
    sources: ["Entegrasyonlar"]
  },
  {
    label: "Sistem",
    description: "Kullanıcılar, yetkiler, kalite ve sistem ayarları.",
    icon: "Settings2",
    badge: "Admin",
    accent: "from-slate-500 via-slate-700 to-slate-900",
    sources: ["Sistem"]
  }
] as const;

export const adminNavigationGroups: AdminNavigationGroup[] = navigationGroupPlan.map((plan) => {
  const seen = new Set<string>();
  const items = adminNavigationSourceGroups
    .filter((group) => plan.sources.some((source) => source === group.label))
    .flatMap((group) => group.items)
    .filter((item) => {
      const key = item.slug || item.label;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  const orderedItems = plan.label === "Operasyon"
    ? items.slice().sort((a, b) => {
      const rank = (item: AdminNavigationItem) => item.slug === "" ? 0 : item.slug === "iletisim-merkezi" ? 1 : 2;
      return rank(a) - rank(b);
    })
    : items;

  return {
    label: plan.label,
    description: plan.description,
    icon: plan.icon,
    badge: plan.badge,
    accent: plan.accent,
    items: orderedItems
  };
});

export const adminNavigationItems = adminNavigationGroups.flatMap((group) => group.items);

const legacySlugRedirects: Record<string, string> = {
  destek: "iletisim-merkezi",
  "musteri-mesajlari": "iletisim-merkezi",
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
  "lead-yonetimi": "leads",
  "lead-analizi": "leads",
  "lead-analysis": "leads",
  "lead-workspace": "leads",
  "crm-lead-workspace": "leads",
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
  "oauth-kurulum": "oauth-kurulum-durumu",
  "ai-saglayici-ayarlari": "entegrasyonlar",
  "hk-asistan-ayarlari": "hk-asistan-ayarlari",
  "sistem-durumu": "sistem-sagligi",
  "sistem-testleri": "sistem-test-merkezi",
  "system-test-center": "sistem-test-merkezi",
  "system-test": "sistem-test-merkezi",
  "test-center": "sistem-test-merkezi",
  "sistem-loglari": "log-aktivite-merkezi",
  "logs": "log-aktivite-merkezi",
  "log-merkezi": "log-aktivite-merkezi",
  "log-center": "log-aktivite-merkezi",
  "aktivite-akisi": "log-aktivite-merkezi",
  "activity-logs": "log-aktivite-merkezi",
  "backup": "veri-aktarma",
  "data-backup": "veri-aktarma",
  "veri-yedekleme": "veri-aktarma",
  "yedekleme": "veri-aktarma",
  "system-guide": "sistem-rehberi",
  "kullanim-kilavuzu": "sistem-rehberi",
  "guide": "sistem-rehberi",
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
  "ads-operating-system": "reklam-operasyon-merkezi",
  "agency-ads-operating-system": "reklam-operasyon-merkezi",
  "ads-command-center": "reklam-operasyon-merkezi",
  "campaign-command-center": "reklam-operasyon-merkezi",
  "reklam-operasyon": "reklam-operasyon-merkezi",
  "hk-reklam-zekasi": "ad-insights",
  "reklam-doktoru-pro": "ad-insights",
  "hk-reklam-doktoru-pro": "ad-insights",
  "buyume-motoru": "growth-engine",
  "growth-os": "growth-engine",
  "growth-engine": "growth-engine",
  "funnel-builder": "funnel-builder",
  "funnel-kur": "funnel-builder",
  "marketplace": "marketplace",
  "paket-pazari": "marketplace",
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
  if (slug === "proposal-builder") return "/proposal-builder";
  return slug ? `/hk-admin/${slug}` : "/hk-admin";
}
