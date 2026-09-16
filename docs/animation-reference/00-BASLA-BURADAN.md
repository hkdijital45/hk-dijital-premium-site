# Animasyon Promptları — Başla Buradan

Bu klasördeki her dosya, sitedeki **bir animasyonu** kendi yapay zekânla yeniden üretmen için hazırlanmış bir prompt içerir.

## Her dosyanın yapısı

- **Nasıl görünür** — animasyonun hissi.
- **Kullanılan yer** — sitede nerede.
- **Teknoloji** — hangi kütüphane/teknik.
- **🎯 Hazır Prompt** — kopyala, AI'na yapıştır. Tüm değerler (süre, easing, sayılar) içinde.
- **🔧 Teknik Özet** — istersen kendin ince ayar yapabilmen için ham değerler.

## Kullanım ipuçları

1. **Bağlamı ver:** Prompt'un başına projenin ne olduğunu ekle (örn. "Next.js + Tailwind + GSAP kullanıyorum. Şu bileşeni istiyorum:").
2. **Renkleri değiştir:** Promptlardaki renkler MediaCrew paletindendir (neon cyan `#0adce4`, petrol `#0b3d4e` vb.). Kendi markanla değiştir.
3. **Performans şartını koru:** Promptlarda `prefers-reduced-motion` ve "sadece transform/opacity" şartı bilerek var — silme, animasyonun akıcı ve erişilebilir kalmasını sağlıyor.
4. **Parça parça iste:** Büyük animasyonları (ör. sinematik slider) tek seferde değil, bölümlerine ayırıp isteyebilirsin.

## Animasyon listesi

| # | Animasyon | Zorluk | Kütüphane |
|---|---|---|---|
| 01 | Aperture (diyafram) açılış loader'ı | Orta | GSAP + SVG mask |
| 02 | Hero scroll-scrub sinematik giriş | Zor | GSAP ScrollTrigger + canvas |
| 03 | Scroll ipucu (boşta belirir, kaydırınca kaybolur) | Kolay | GSAP |
| 04 | Sinematik proje slider'ı (tek ticker döngüsü) | Çok zor | GSAP ticker + Lenis |
| 05 | Kromatik sapma (RGB split) başlık | Orta | CSS transform, 3 katman |
| 06 | 3B silindir proje çarkı (scroll) | Zor | GSAP ScrollTrigger 3D |
| 07 | Proje önizleme kartları (hover) | Kolay | Saf CSS |
| 08 | Hizmet gezgini (hover önizleme paneli) | Zor | GSAP + count-up |
| 09 | Yatay pinlenen hizmet karuseli | Orta | GSAP ScrollTrigger pin |
| 10 | Çift yönlü logo şeridi (marquee) | Kolay | Saf CSS keyframes |
| 11 | Bokeh alan derinliği partikülleri | Zor | React Three Fiber + GLSL |
| 12 | Kuyruklu yıldız imleç izi | Orta | rAF + lerp zinciri |
| 13 | Su dalgası (imleçle etkileşen) | Çok zor | R3F + GLSL shader |
| 14 | Özel imleç (lag'li takip + hover) | Kolay | GSAP quickTo |
| 15 | Yüzen iletişim dock'u (WhatsApp/Telegram/Ara) | Kolay | CSS transitions |
| 16 | Aurora buton (dönen konik gradyan) | Kolay | Saf CSS |
| 17 | Navbar (kayan pill + mobil menü) | Orta | Framer Motion |
| 18 | Sayfa geçişi rack-focus (View Transitions) | Orta | CSS View Transitions |
| 19 | Scroll ile blur-reveal (metin/kart girişleri) | Kolay | GSAP ScrollTrigger |

> Yeni başlıyorsan **07, 10, 16, 19** ile başla (kolay ve etkili). Sonra **03, 14, 15, 18**. İleri seviye: **01, 05, 08, 09, 06**. Uzman: **02, 04, 11, 12, 13**.
