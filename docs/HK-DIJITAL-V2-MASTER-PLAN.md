# HK Dijital v2 Master Plan

## Ürün vizyonu

HK Dijital v2, müşteri portalını sade bir sonuç ekranı olarak tutar ve operasyon gücünü admin panelindeki Agency OS katmanında toplar. Müşteri; rapor, belge, hesap bağlama, destek ve bildirim görür. Admin; müşteri profili, entegrasyon, reklam operasyonu, HK Intelligence, Reklam Doktoru, finans, görev ve otomasyon kararlarını yönetir.

## Admin panel mimarisi

Admin panel ana işletim sistemi olarak çalışır. Ana kategoriler: Kontrol Merkezi, Müşteri Merkezi, CRM Merkezi, Reklam & Performans, Entegrasyonlar, Rapor Merkezi, İçerik & Medya, Yapay Zeka Merkezi, Ajans Operasyonu, Muhasebe ve Ayarlar.

Çalışan route ve componentler silinmez. Aynı amaca hizmet eden modüller görünür menüde doğru kategoriye alınır; legacy slug ve alias davranışı route kırmadan korunur.

## Müşteri portalı mimarisi

Müşteri portalı mini admin panel değildir. Varsayılan müşteri modülleri:

- Dashboard
- Raporlar
- Belgeler / Dosyalar
- Hesap Bağla
- Destek
- Bildirimler

Reklam Doktoru, HK Intelligence, AI Asistan, SEO, Analytics, CRM, QA, Ajans Operasyonu, Karlılık, Reklam Operasyon Merkezi, Sistem Rehberi, Modül Pazarı, Funnel Planlayıcı ve Büyüme Motoru müşteri panelinde render edilmez. Bu modüller admin-only kabul edilir.

## Menü yapısı

Admin menüsü operasyon odaklıdır. Müşteri menüsü kısa ve sonuç odaklıdır. Müşteri tarafında sadece enabled_customer_modules içinde açık olan ve müşteri portalı whitelist içinde bulunan modüller görünür. URL elle yazılırsa kullanıcıya “Bu modüle erişim yetkiniz bulunmuyor.” mesajı gösterilir.

## Yetki sistemi

Auth ve rol yönlendirme mevcut sistemde kalır. Admin module permission keyleri route ve API erişimini yönetir. Müşteri portalında müşteri bazlı metadata alanları kullanılır:

- metadata.enabled_customer_modules
- metadata.enabled_platforms

Bu alanlar müşteri deneyimini daraltır; admin yetkilerini azaltmak için kullanılmaz.

## Platform / entegrasyon mimarisi

Platform tanımları customer portal registry üzerinden yönetilir. Müşteri panelinde Google tek karttır; GA4, Search Console, Google Ads, Business Profile ve YouTube alt servisleri admin tarafından ayrı açılıp kapatılır. Meta tek karttır; Facebook/Instagram/Pixel varlıkları Meta akışı altında değerlendirilir.

Kapalı platformlar müşteri panelinde render edilmez ve ilgili OAuth/API çağrıları çalıştırılmaz.

## Meta / Google entegrasyon planı

Meta Phase 1 public_profile ve email ile temel Facebook Login akışıdır. Business Verification veya App Review yokken ads_read, business_management, pages_show_list ve instagram_basic izinleri zorunlu akışa eklenmez. Reklam hesabı için manuel asset fallback korunur.

Google tarafında Google OAuth tek bağlantı noktasıdır. Google Ads, GA4, Search Console, Business Profile ve YouTube varlıkları server-side keşif servisleriyle listelenir. Google Ads canlı veri için Developer Token gerekebilir. API etkin değilse sistem veri uydurmaz; bağlantı bekleniyor, yetki gerekli veya Developer Token gerekli durumunu döndürür.

## Veritabanı ilişkileri

Ana müşteri kaydı companies tablosudur. Müşteri bağlantıları customer_integrations üzerinden izlenir. Platform varlıkları integration_assets JSON alanında tutulur. Müşteri portalı ayarları customer_integrations.metadata içinde saklanır.

Yeni tablo yalnız gerçek veri ilişkisi JSON metadata ile güvenli yönetilemiyorsa oluşturulur. Migration dosyaları idempotent olmalı ve mevcut kayıtları silmemelidir.

## API yapısı

Admin API’leri admin/staff yetki kontrolü yapar ve token/secret dönmez. Customer API’leri sadece ilgili müşteri session bağlamını kullanır. OAuth callback endpointleri mevcut auth akışını bozmaz; state doğrulaması, customer/company bağlamı ve güvenli hata dönüşü zorunludur.

## AI / HK Intelligence yol haritası

HK Intelligence admin tarafında çalışır. Her müşteri için şu çıktıları üretir:

- Genel sağlık skoru
- Veri kaynakları durumu
- Eksik bağlantılar
- Kritik sorunlar
- Fırsatlar
- Sonraki aksiyonlar
- 7 günlük öneri planı

Veri yoksa “Analiz için bağlantı bekleniyor.” denir. Mock performans verisi üretilmez.

## Otomasyon yol haritası

İlk aşamada gerçek zamanlı cron zorunlu değildir. Admin dashboard mevcut görev, rapor, tahsilat ve entegrasyon sinyallerinden bekleyen otomasyon aksiyonları gösterir:

- Rapor hazır olduğunda müşteri bildirimi
- Eksik bilgi istendiğinde müşteri uyarısı
- Yetki yenileme gerektiğinde uyarı
- Ödeme geciktiğinde admin uyarısı
- Bağlantı koptuğunda admin uyarısı
- Haftalık müşteri kontrol görevi

Sonraki aşamada bu öneriler görev/notification sistemine bağlanabilir.

## Teknik borçlar

- Repo genel lint borçları kapatılmalı.
- Büyük AdminDashboard dosyası modül bazlı ayrıştırılmalı.
- Electron kalıntıları desktop native wrapper planından ayrılmalı.
- CustomerReports bileşenindeki müşteri-facing dil sadeleştirilmeye devam edilmeli.
- Token encryption helper standartlaştırılmalı.
- Meta ve Google API hata kodları merkezi normalize edilmeli.

## Sonraki geliştirme kuralları

- Auth, OAuth callback ve müşteri portalı sade yapısı korunur.
- Yeni modül eklemek yerine mevcut modül genişletilir.
- Route ve permission keyleri mecbur kalmadıkça değiştirilmez.
- Müşteri portalına admin-only teknik metin, secret, token veya iç operasyon notu taşınmaz.
- Veri yoksa sebep yazılır; uydurma metrik gösterilmez.
- Migration gerekiyorsa minimal ve geri uyumlu olur.
