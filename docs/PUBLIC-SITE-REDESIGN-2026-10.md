# Kamuya Açık Site — Premium Yeniden Tasarım (2026-10)

Bu dosya, HK Dijital kamuya açık sitesinin (www.hkdijital.com.tr) 2026-10 tarihli
"premium teknoloji/performans pazarlama ajansı" yeniden tasarımının kapsamını ve
doğrulama durumunu sayfa sayfa kaydeder.

## Yaklaşım

Değişikliklerin büyük kısmı **paylaşılan tasarım sistemi ve bileşenler** üzerinden
yapıldı (Header, Footer, ScrollProgressBar, `globals.css`'teki `--mk-*` tasarım
token'ları, `MarketingCTA`/`MarketingUI`/`MarketingVisualSystem` bileşenleri) — bu
yüzden aşağıdaki **her** public sayfa otomatik olarak yeni paletle (derin
lacivert/antrasit + turkuaz + sınırlı turuncu) render edilir, tek tek elle
düzenlenmeseler bile.

Ayrıca ana sayfanın hero görseli (eski monitör/ekran mockup'ı) ve 3 kırık blog
bağlantısı ayrıca, özel olarak düzeltildi (aşağıda ayrıntılı).

## Sayfa durumu

| Sayfa | Durum | Not |
|---|---|---|
| `/` | **Yenilendi + doğrulandı** | Hero: eski raster monitör görseli → yeni `AdOperationsPanel` (gerçek HTML/CSS/SVG, "Örnek arayüz — gerçek müşteri verisi içermez" görünür metin). Logo, slogan, platform şeridi, final CTA korunur/paletlendi. 16 bölümlük IA/metin yeniden yazımı **yapılmadı** (bkz. Bilinen eksikler). |
| `/hizmetler` | Doğrulandı | Paylaşılan kabuk üzerinden paletlendi; içerik/IA değişmedi. |
| `/hizmetler/meta-reklam-yonetimi` | Doğrulandı | Aynı. |
| `/hizmetler/google-ads-yonetimi` | Doğrulandı | Aynı. |
| `/hizmetler/sosyal-medya-yonetimi` | Doğrulandı | Aynı. |
| `/hizmetler/dijital-pazarlama-danismanligi` | Doğrulandı | Aynı. |
| `/paketler` | Doğrulandı | Fiyat/kapsam/KDV metinleri ve Paket Analiz Robotu dokunulmadı. |
| `/hakkimda` | Doğrulandı | `MarketingCTA`'daki mor gradyan navy/teal'e çevrildi (bkz. aşağı). |
| `/blog` | Doğrulandı | Liste/filtre/boş durum aynı; artık 3 eski statik yazı da listede görünüyor. |
| `/blog/[slug]` (genel) | Doğrulandı | |
| `/blog/manisa-dijital-pazarlama-ajansi-secerken` | **Düzeltildi** | Önceden 404. |
| `/blog/meta-reklam-butcesi-nasil-belirlenir` | **Düzeltildi** | Önceden 404. |
| `/blog/google-ads-mi-instagram-reklami-mi` | **Düzeltildi** | Önceden 404. |
| `/iletisim` | Doğrulandı | Form alanları/API/davranış dokunulmadı. |
| `/teklif-al` | Doğrulandı | 7 aşamanın tamamı ekran görüntüsüyle doğrulandı; form mantığı dokunulmadı. |
| `/manisa-dijital-pazarlama` | Doğrulandı | |
| `/calistigimiz-markalar` | Doğrulandı | Marka logoları/işbirliği metinleri dokunulmadı. |
| `/hk-intelligence` | Doğrulandı | |
| `/gizlilik-politikasi` | Doğrulandı | Metin değişmedi, yalnızca kabuk paletlendi. |
| `/kullanim-sartlari` | Doğrulandı | Aynı. |
| `/veri-silme` | Doğrulandı | Aynı. |
| 404 (olmayan sayfa) | Doğrulandı | Gerçek HTTP 404 döner (200 ile gizlenmiyor). |
| `/sitemap.xml`, `/robots.txt` | Doğrulandı | Sitemap artık düzeltilen 3 blog yazısını da içeriyor. |
| Admin (`/hk-admin/*`), müşteri paneli (`/musteri-paneli`), `/digital-center` | **Kapsam dışı — dokunulmadı** | Görev talimatına göre. |

## Özellikle düzeltilen 3 sorun

1. **Hero "monitör" görseli** (`public/cinematic/hero-poster.png`, blurry raster, metin pikselin
   içine gömülüydü, mor başlık rengi) → `src/components/public/AdOperationsPanel.tsx`
   (yeni, gerçek DOM metni, kanal dağılımı, kampanya listesi, dönüşüm hunisi,
   şematik haftalık grafik — hiçbir sayı uydurulmadı).
2. **3 kırık blog bağlantısı**: gerçek, tam yazılmış 3 makale
   (`src/lib/public-seo-content.ts`) hiçbir zaman `blog_posts` tablosunda
   satır olarak var olmadığı için `/blog/[slug]` 404 veriyordu.
   `src/lib/blog-seo.ts`'deki `getPublicBlogPost(s)` artık veritabanında
   bulunamayan bir slug için bu 3 gerçek makaleyi (aynı `BlogPost` şekline
   dönüştürülmüş olarak) devreye sokuyor — veritabanındaki bir satır her
   zaman önceliklidir. Yeni makale uydurulmadı, var olan gerçek içerik
   bağlandı.
3. **Mor/menekşe renk paleti**: `--mk-violet/indigo/pink/blue` token'ları ve
   onlarca satır içi `#7c3aed`/`#4f46e5`/`#db2777`/... rengi (CTA blokları,
   scroll progress bar, nav alt çizgisi, glitch-metin efekti dahil) derin
   lacivert/turkuaz/turuncu sistemine çevrildi. Üçüncü taraf marka logoları
   (Meta/Instagram/Facebook/TikTok/YouTube gerçek SVG renkleri) kasıtlı
   olarak **dokunulmadan** bırakıldı.

## Logo

Kullanıcının eklediği orijinal şeffaf PNG, `public/branding/hk-dijital-logo-original.png`
olarak (1024×1024, dokunulmamış) ve `public/branding/hk-dijital-logo-full.png`
olarak (666×641, yalnızca tamamen şeffaf dış boşluk kayıpsız kırpılmış hali —
görünür hiçbir piksel değişmedi) saklandı. Header ve Footer artık ikisi de bu
tam kompozisyonu kullanıyor (önceki yatay/dağılmış lockup kaldırıldı).
Favicon/apple-icon dosyalarına dokunulmadı (zaten ayrı, düzgün kare bir amblem
kırpması — tam logoyu kareye ezme riski yoktu).

## Bilinen eksikler (dürüstçe işaretlendi)

- Ana sayfanın **16 bölümünü** 7 bölüme indiren tam bilgi mimarisi/metin
  yeniden yazımı yapılmadı — gerçek ticari metni yanlışlıkla silme riskini
  almamak için kapsam dışı bırakıldı. Paylaşılan tasarım sistemi sayesinde
  görsel olarak premium ve tutarlı, ama bölüm sayısı/uzunluk aynı kaldı.
- `/nasil-calisiyoruz` ayrı sayfası **oluşturulmadı** — ana sayfadaki
  `id="process"` anchor'ı (`/#process`) zaten çalışıyor ve aynı içeriği ikinci
  bir sayfada tekrarlamak "aynı şeyi iki yerde anlatma" sorununu
  büyütebileceği için bilinçli olarak atlandı.
- Gerçek kullanıcı Core Web Vitals / Lighthouse ölçümü yapılmadı (bu ortamda
  alan verisi veya Lighthouse CI çalıştırma imkanı yoktu) — yalnızca build +
  Playwright ile konsol/network hata taraması yapıldı (0 hata, 9 kritik
  sayfa).
- Analytics (GA4/GTM/Pixel) olay şeması incelenmedi/değiştirilmedi.

## Phase 2 (aynı gün, devam) — IA sadeleştirme, GA4/GTM, ölçülmüş performans

Phase 1'in "Bilinen eksikler" listesindeki üç kalemi kapattı: ana sayfa bilgi
mimarisi, analytics event'leri, gerçek Lighthouse ölçümü.

### Ana sayfa: 16 bölüm → 7 bölüm

`src/components/public/HomepageExperience.tsx`. Hiçbir gerçek cümle silinmedi —
her bölüm ya zaten kendi alt sayfasında vardı (MOVE), ya ilgili bölümle
birleştirildi (MERGE), ya da trim edildi (KEEP, kısaltılmış):

| Eski bölüm | Yeni durum |
|---|---|
| Hero | KEEP (değişmedi) |
| PlatformStrip | KEEP (değişmedi) |
| AdsStorySection ×2 (Google/Meta Ads uzun anlatım) | REMOVE — aynı içerik zaten `/hizmetler/google-ads-yonetimi` ve `/hizmetler/meta-reklam-yonetimi`'nde var |
| SocialMediaSection + PhoneMockup | REMOVE — aynı gerekçe, `/hizmetler/sosyal-medya-yonetimi` |
| ServicesSection (ServiceExplorer) | KEEP (değişmedi) — tüm 8 hizmeti zaten kapsıyordu |
| PerformanceSection (4 örnek metrik kartı) | REMOVE — hero'daki yeni AdOperationsPanel ile aynı "örnek gösterge" fikrini tekrarlıyordu; kaldırılması "gerçek veri gibi görünen" risk yüzeyini de azalttı |
| AiGeoSection | MERGE → yeni ValuePropSection'a kısaltılmış metin+link olarak |
| ProcessSection (scroll-linked, 7 adım + paragraf) | MERGE → ValuePropSection'a kompakt 7 pill'lik şerit olarak, `id="process"` korunarak (`/#process` hâlâ çalışıyor) |
| TrustSection (6 "neden HK" kartı) | MERGE → ValuePropSection'a ilk 3 kart olarak |
| PackagesTeaser (kategori+3 paket kartı) | MERGE → FinalCtaSection'ın üstüne kompakt kategori şeridi olarak |
| TrustSection + BrandShowcaseSection | BrandShowcaseSection tek başına kaldı (zaten kendi bölümüydü) |
| FaqBlogSection (7 soru) | MERGE → FaqAndContactSection'a ilk 4 soru olarak (`FaqAccordion`'a `limit` prop eklendi) |
| ContactSection (gömülü `<ContactForm>`) | REMOVE'a yakın — form artık ana sayfada YOK, sadece WhatsApp/teklif/iletişim linkleri var; gerçek form hâlâ tam olarak `/iletisim`'de |
| LocalSeoSection (Manisa ilçeleri) | REMOVE — tek iç bağlantısı bu bölümdü; kaybolmasın diye `/manisa-dijital-pazarlama` artık Footer'da kalıcı bir link (önceden hiçbir footer/nav linki yoktu) |

Ölçülen sonuç: aynı 390px genişlikte toplam sayfa yüksekliği 19406px → 10247px
(%47 azalma). 7 bölüm de gerçek `<section>` DOM sorgusuyla doğrulandı.

### GA4 / GTM

`src/lib/ga-events.ts` (yeni, `pushGaEvent`) + `TrackingPlaceholders.tsx`
(script injection) + `trackMetaCtaClick`'e mirror. Admin'de zaten var olan
"GA4 Measurement ID" / "Google Tag Manager" ayar alanları (AdminDashboard.tsx)
artık gerçekten bir şey yapıyor — önceden `TrackingPlaceholders` boş bir stub'dı.

- GTM id'si varsa GTM konteyner yüklenir; yoksa ve GA4 id'si varsa doğrudan
  `gtag.js` yüklenir (`send_page_view:false` ile) — **asla ikisi birden**
  (çift sayım riski).
- Event'ler: `whatsapp_click`, `generate_lead` (yalnızca gerçek başarılı
  gönderimden sonra), `form_start`, `package_click`, `service_click`,
  `select_content` (cta/contact_cta/package/service alt tipleriyle),
  otomatik `page_view` (route değişiminde, tek sefer).
- PII yok: parametreler yalnızca `form_name`/`step`/`value`/`cta_label`/
  `destination_type` — hiçbir zaman ad/e-posta/telefon/mesaj metni.
- Bulunan ve düzeltilen gerçek çift-sayım hatası: `QuoteWizard.tsx` başarılı
  gönderimde `quote_form_submitted` VE `lead_form_submitted` olarak iki ayrı
  event atıyordu — Meta Pixel'de iki "Lead", GA4'te iki "generate_lead"
  olarak sayılıyordu. İkinci çağrı kaldırıldı.
- Doğrulama: gerçek GA4 Measurement ID bu ortamda yapılandırılı değil (admin
  henüz girmemiş); Playwright ile CTA tıklamasının `window.dataLayer`'a doğru
  şekilde `select_content` event'i astığı canlı tarayıcıda doğrulandı. Google'ın
  gerçekten veri aldığı iddia EDİLMEDİ — bunu doğrulamak için admin panelden
  gerçek bir ölçüm kimliği girilmesi gerekir.

### Performans — ölçüldü (Lighthouse, yerel prod build)

| Metrik | Masaüstü (önce→sonra) | Mobil (önce→sonra) |
|---|---|---|
| Performance skoru | 84 → 96 | 65 → 73 |
| LCP | 1.3s → 1.1s | 6.8s → 5.5s |
| Speed Index | 3.8s → 1.6s | 5.8s → 4.5s |
| CLS | 0 → 0 | 0 → 0 |
| TBT | 140ms → 0ms | 70ms → 10ms |

"Önce" = bu Phase 2 oturumunun başındaki hâl (IA sadeleştirmesi öncesi, zaten
Phase 1 paletiyle); Phase 1'in kendisi hiç ölçülmemişti, bu yüzden Phase 1→2
karşılaştırması yok, yalnızca Phase 2 içi önce/sonra. Masaüstü iyileşmesi
büyük ölçüde IA sadeleştirmesinin kendisinden geliyor (kaldırılan bölümlerin
scroll-linked framer-motion dinleyicileri/DOM'u). Mobil hâlâ hedefin (LCP
≤2.5s) üzerinde — kök neden bulundu ama tam çözülmedi: `supabaseRest()`
tüm sitede kasıtlı olarak `cache:"no-store"` kullanıyor (admin ekranları
asla bayat veri görmemeli), bu yüzden ana sayfa her istekte gerçek bir
Supabase round-trip yapıyor. `getSiteContent()` artık React `cache()` ile
tek istek içinde tekrar fetch'lenmiyor (PublicShell + page.tsx aynı veriyi
iki kez çekiyordu — düzeltildi), ama asıl yük `site_content` satırının
kendisinin ~3.4MB olması — Next'in `unstable_cache`'i 2MB sınırını aştığı
için bunu önbelleğe alamadı (denendi, loglanan hatayla doğrulandı, sonra
geri alındı). Gerçek düzeltme `getSiteContent()`'in döndürdüğü payload'ı
küçültmek (yalnızca ana sayfanın ihtiyaç duyduğu alanları seçmek) —
bu oturumun kapsamına sığmayan, ayrı bir iş.
