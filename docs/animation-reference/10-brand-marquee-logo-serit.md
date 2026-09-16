# 10 — Çift Yönlü Logo Şeridi (Marquee)

**Nasıl görünür:** İki sıra marka logosu, biri sağa biri sola, sonsuz ve dikişsiz akar. Kenarlarda yumuşak solma (mask). Üzerine gelince o sıra durur.
**Kullanılan yer:** "Odağa aldığımız markalar" altındaki logo şeridi.
**Teknoloji:** Saf CSS `@keyframes` (JS yok). Kolay ve şık.

---

## 🎯 Hazır Prompt (kopyala–yapıştır)

> Tailwind + CSS keyframes ile **çift yönlü sonsuz logo marquee** yaz (JS animasyon yok).
>
> **Dikişsiz döngü sırrı:** her sıranın logo dizisini **iki kez** ard arda bas (`[...logos, ...logos]`) ki `-50%` ötelemede kusursuz döngülensin.
>
> **Keyframes:**
> ```css
> @keyframes marquee-left  { from { transform: translate3d(0,0,0) }    to { transform: translate3d(-50%,0,0) } }
> @keyframes marquee-right { from { transform: translate3d(-50%,0,0) } to { transform: translate3d(0,0,0) } }
> ```
> - Üst sıra: `animation: marquee-right 55s linear infinite`.
> - Alt sıra: `animation: marquee-left 55s linear infinite`.
> - Logoları ortadan ikiye böl (üst/alt).
>
> **Detaylar:** her sıra bir `group`, `group-hover:[animation-play-state:paused]` (hover'da durur); `motion-reduce:!animate-none`. Bölüme kenar solması: `mask-image: linear-gradient(to right, transparent, black 8%, black 92%, transparent)`. Logolar `opacity-85 hover:opacity-100 transition-opacity`, yükseklik `h-11 md:h-14`. Kaba `will-change: transform`.

---

## 🔧 Teknik Özet
- İki yön: `marquee-right` (üst) / `marquee-left` (alt), ikisi `55s linear infinite`
- Dikişsizlik: logolar 2 kez basılır → `-50%` öteleme
- Hover'da `animation-play-state: paused` · kenar `mask-image` gradyan
