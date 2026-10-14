// Centralized, typed task template definitions for the Toplu Görev Ekle
// (bulk task creation) screen. Static application config, not a database
// table — these are reusable checklist items, not records that need to
// be queried/filtered/reported on independently, so a new table would be
// an unjustified migration per the brief's own "avoid unnecessary
// migrations" instruction.
export type TaskTemplate = {
  id: string;
  title: string;
  defaultPriority?: "Düşük" | "Orta" | "Yüksek" | "Kritik";
};

export type TaskTemplateCategory = {
  id: string;
  label: string;
  templates: TaskTemplate[];
};

function category(id: string, label: string, titles: string[]): TaskTemplateCategory {
  return { id, label, templates: titles.map((title, index) => ({ id: `${id}-${index + 1}`, title })) };
}

export const TASK_TEMPLATE_CATEGORIES: TaskTemplateCategory[] = [
  category("meta-ads", "Meta Reklamları", [
    "Meta Business hesabını kontrol et", "Reklam hesabı erişimlerini doğrula", "Facebook sayfası bağlantısını kontrol et",
    "Instagram hesabı bağlantısını kontrol et", "Reklam hesabı sorunlarını analiz et", "Meta Pixel kurulumunu kontrol et",
    "Dönüşüm olaylarını kontrol et", "Hedef kitle araştırması yap", "Rakip reklamlarını analiz et", "Reklam bütçesini planla",
    "Kampanya stratejisi oluştur", "Reklam kreatiflerini hazırla", "Reklam metinlerini hazırla", "Kampanyayı oluştur",
    "Reklam setlerini yapılandır", "Kampanyayı yayına al", "İlk 24 saat kontrolünü yap", "İlk 72 saat performansını incele",
    "Reklam optimizasyonu yap", "Yeniden pazarlama kitlesini değerlendir", "Haftalık performans raporu hazırla", "Aylık performans raporu hazırla"
  ]),
  category("google-ads", "Google Reklamları", [
    "Google Ads hesabını kontrol et", "Reklam hesabı erişimlerini doğrula", "Google Ads hesap sorunlarını analiz et",
    "Anahtar kelime araştırması yap", "Rakip reklam analizini gerçekleştir", "Negatif anahtar kelimeleri belirle",
    "Kampanya bütçesini planla", "Kampanya hedefini belirle", "Arama ağı kampanyasını oluştur", "Reklam gruplarını yapılandır",
    "Reklam metinlerini hazırla", "Reklam öğelerini yapılandır", "Konum hedeflemesini ayarla", "Dönüşüm ölçümlemesini kontrol et",
    "Kampanyayı yayına al", "Arama terimleri raporunu incele", "Negatif kelime optimizasyonu yap", "Teklif stratejisini değerlendir",
    "Haftalık performans kontrolü yap", "Aylık Google Ads raporu hazırla"
  ]),
  category("social-media", "Sosyal Medya Yönetimi", [
    "Instagram profilini analiz et", "Facebook sayfasını analiz et", "Rakip sosyal medya hesaplarını incele",
    "Profil biyografisini optimize et", "Profil bağlantılarını kontrol et", "Öne çıkan hikâyeleri düzenle",
    "İçerik stratejisini oluştur", "Aylık içerik takvimi hazırla", "Gönderi tasarımlarını hazırla", "Reels içeriklerini planla",
    "Hikâye içeriklerini planla", "Açıklama metinlerini hazırla", "Paylaşım takvimini uygula", "Etkileşim performansını değerlendir",
    "Aylık sosyal medya raporu hazırla"
  ]),
  category("website-domain", "Web Sitesi ve Alan Adı", [
    "Web sitesi ihtiyaç analizini yap", "Alan adı uygunluğunu kontrol et", "Alan adı kaydını planla", "Barındırma hizmetini değerlendir",
    "DNS kayıtlarını yapılandır", "SSL sertifikasını kontrol et", "Web sitesi tasarımını planla", "Sayfa yapısını oluştur",
    "Mobil uyumluluğu kontrol et", "İletişim formunu test et", "WhatsApp bağlantısını kontrol et", "Site hızını analiz et",
    "Temel teknik SEO kontrolünü yap", "Analytics bağlantısını yapılandır", "Search Console bağlantısını yapılandır",
    "Yayın öncesi kontrolleri tamamla", "Web sitesini yayına al", "Yayın sonrası kontrolleri yap", "Yedekleme sistemini kontrol et",
    "Alan adı yenileme tarihini kaydet", "Barındırma yenileme tarihini kaydet"
  ]),
  category("seo", "SEO", [
    "SEO ön analizi gerçekleştir", "Anahtar kelime araştırması yap", "Rakip SEO analizi yap", "Site indekslenmesini kontrol et",
    "Search Console verilerini incele", "Sayfa başlıklarını optimize et", "Meta açıklamalarını optimize et", "Başlık hiyerarşisini kontrol et",
    "İç bağlantıları düzenle", "Görsel optimizasyonu yap", "Site haritasını kontrol et", "Robots.txt dosyasını kontrol et",
    "Core Web Vitals verilerini incele", "Yerel SEO analizini gerçekleştir", "Google İşletme Profilini kontrol et",
    "İçerik optimizasyonu yap", "Aylık SEO raporu hazırla"
  ]),
  category("analytics", "Analitik ve Ölçümleme", [
    "GA4 kurulumunu kontrol et", "Google Tag Manager kurulumunu kontrol et", "Search Console bağlantısını kontrol et",
    "Meta Pixel olaylarını doğrula", "Google Ads dönüşümlerini kontrol et", "UTM etiketleme planını oluştur",
    "Temel dönüşüm olaylarını belirle", "Veri toplama doğruluğunu test et", "Analytics raporlarını incele",
    "Ölçümleme hatalarını düzelt", "Raporlama panosunu kontrol et"
  ]),
  category("content-design", "İçerik ve Tasarım", [
    "Marka görsellerini incele", "Logo dosyalarını kontrol et", "Reklam görsellerini hazırla", "Video içeriklerini düzenle",
    "Kampanya kapak görsellerini oluştur", "İçerik metinlerini hazırla", "Tasarımları müşteriye sun", "Revizyonları tamamla",
    "İçerikleri yayın için onayla"
  ]),
  category("strategy-client", "Strateji ve Müşteri Yönetimi", [
    "Lead ön incelemesini gerçekleştir", "İlk müşteri görüşmesini planla", "Rakip analizini hazırla", "Hizmet ihtiyaçlarını belirle",
    "Reklam bütçesi önerisini hazırla", "Dijital strateji oluştur", "Teklif dosyasını hazırla", "Teklifi müşteriye gönder",
    "Teklif sonrası takip yap", "Sözleşme sürecini kontrol et", "Hesap erişimlerini talep et", "İlk kurulumları tamamla",
    "Haftalık müşteri görüşmesi yap", "Aylık performans toplantısı planla", "Müşteri memnuniyetini değerlendir"
  ])
];

export function findTemplate(id: string): TaskTemplate | undefined {
  for (const cat of TASK_TEMPLATE_CATEGORIES) {
    const found = cat.templates.find((t) => t.id === id);
    if (found) return found;
  }
  return undefined;
}

export const TASK_TEMPLATE_COUNT = TASK_TEMPLATE_CATEGORIES.reduce((sum, c) => sum + c.templates.length, 0);
