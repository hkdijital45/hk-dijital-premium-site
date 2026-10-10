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
