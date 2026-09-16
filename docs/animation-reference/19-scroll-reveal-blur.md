# 19 — Scroll ile Blur-Reveal (Metin/Kart Girişleri)

**Nasıl görünür:** Bir bölüm görünüme girince içindeki öğeler (etiket, başlık, paragraf, kartlar) bulanıklıktan netleşerek ve hafifçe yükselerek belirir. Kimi tek seferlik, kimi geri kaydırınca tekrar oynar.
**Kullanılan yer:** Hakkımızda, Neden Biz, İletişim CTA — sitedeki tüm metin bölümleri.
**Teknoloji:** GSAP + ScrollTrigger. En yaygın, en kolay premium giriş deseni.

---

## 🎯 Hazır Prompt (kopyala–yapıştır)

> React + GSAP (ScrollTrigger) ile "blur-reveal" giriş animasyonu yaz. Ev eğrisi `power3.out`. Tümü `matchMedia('(prefers-reduced-motion: no-preference)')` içinde.
>
> **A) Öğe öğe, tek seferlik (okuma sırasına göre):** Animasyonlanacak her öğeye `data-reveal` ekle; `gsap.utils.toArray('[data-reveal]')` ile tek tek animasyonla:
> `gsap.from(el, { opacity:0, y:26, filter:'blur(8px)', duration:0.85, ease:'power3.out', scrollTrigger:{ trigger: el, start:'top 85%', once:true } })`.
> (Her öğenin kendi tetikleyicisi var → doğal, kademeli akış; stagger'a gerek yok.)
>
> **B) Kart ızgarası, birlikte stagger (geri kaydırınca tekrar):** tek grup tween:
> `gsap.from('[data-card]', { opacity:0, y:24, filter:'blur(10px)', duration:0.8, ease:'power3.out', stagger:0.08, scrollTrigger:{ trigger: root, start:'top 70%', toggleActions:'play none none reverse' } })`.
>
> **C) Büyük başlık, ağır blur (dramatik):** `gsap.from('[data-title]', { opacity:0, filter:'blur(18px)', duration:1, ease:'power3.out', scrollTrigger:{ trigger: root, start:'top 75%', toggleActions:'play none none reverse' } })` (burada `y` yok — sadece odaklanma hissi).
>
> İki aile: `once:true` (kalıcı reveal) vs `toggleActions:'play none none reverse'` (geri çıkınca tersine döner) — ihtiyaca göre seç.

---

## 🔧 Teknik Özet
- Öğe reveal: `y26, blur8→0`, `0.85s`, `top 85%`, `once`
- Kart stagger: `y24, blur10→0`, `0.8s`, `stagger 0.08`, `top 70%`, reverse
- Başlık: `blur18→0` (y yok), `1s`, `top 75%`, reverse
- Ev eğrisi `power3.out` · hepsi reduced-motion korumalı
