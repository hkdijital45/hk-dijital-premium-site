# 05 — Kromatik Sapma (RGB Split) Başlık

**Nasıl görünür:** Net beyaz bir başlığın arkasından, kaydırdıkça kırmızı ve camgöbeği (cyan) "hayalet" kopyalar zıt yönlere kayarak taşar — eski film/analog cam sapması hissi. Kaydırmayı bırakınca hayaletler kaybolur, başlık tekrar tertemiz beyaz olur. Efektin şiddeti kaydırma hızına bağlıdır.
**Kullanılan yer:** Sinematik proje slider'ındaki başlıklar (tek başına da kullanılır).
**Teknoloji:** Saf CSS transform + opacity, 3 katmanlı üst üste kopya.

---

## 🎯 Hazır Prompt (kopyala–yapıştır)

> Bir başlık için "kromatik sapma / RGB split" efekti yaz (React veya vanilla, GPU dostu).
>
> **Yapı:** Aynı metnin **3 üst üste kopyası**: en üstte net beyaz `<h2>`; arkasında iki mutlak konumlu kopya — kırmızı `rgb(255,40,90)` ve camgöbeği `rgb(40,220,255)`, ikisi de başta `opacity: 0`.
>
> **Sürücü:** Kaydırma hızını (`velocity`) ölç ve yumuşat. İki değer üret:
> - `activity` = 0→1 zarfı (kaydırırken 1'e çıkar, durunca `gsap.to(..., { v:0, duration:0.35, ease:'power3.out' })` ile 0'a iner).
> - `velInt = limit * tanh(velocity * 11 / limit)` (limit=1; yani yumuşak doyum, asla patlamaz).
>
> **Ayrışma miktarı:** `maxSep = 12` (px). `sep = activity*(maxSep*0.5) + velInt*(maxSep*0.5)` — yarısı zarftan, yarısı hızdan.
> - Kırmızı katman: `transform: translate3d(${sep}px, 0, 0)`
> - Camgöbeği katman: `transform: translate3d(${-sep}px, 0, 0)`
> - İki hayaletin opaklığı: `clamp(activity, 0, 1)`.
>
> **Kural:** Yalnız `transform` ve `opacity` animasyonla (60fps). Dururken `sep ≈ 0` ve hayaletler görünmez olmalı. Değerleri her karede (rAF veya GSAP ticker) DOM `.style`'a yaz, React state kullanma.

---

## 🔧 Teknik Özet
- Katmanlar: beyaz base + kırmızı `rgb(255,40,90)` + cyan `rgb(40,220,255)`
- `maxSep 12px` · `sep = act*6 + velInt*6` (toplam ~±12px)
- `velInt = tanh(velocity*11)` (soft-clamp) · opacity = `clamp(activity,0,1)`
- Durunca settle: `0.35s power3.out` → 0
