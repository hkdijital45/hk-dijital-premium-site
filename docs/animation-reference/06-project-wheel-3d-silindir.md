# 06 — 3B Silindir Proje Çarkı (Scroll ile Döner)

**Nasıl görünür:** Proje başlıkları dikey dönen bir silindirin yüzeyine sarılmıştır. Kaydırdıkça çark döner; kameraya bakan satır nete/büyür, arkaya dönen satırlar bulanıklaşır, küçülür ve kararır. Sonsuz döngü hissi.
**Kullanılan yer:** Projeler bölümü (alternatif 3B liste).
**Teknoloji:** GSAP + ScrollTrigger (pin + scrub) + CSS 3D transform.

---

## 🎯 Hazır Prompt (kopyala–yapıştır)

> React + GSAP (ScrollTrigger) ile scroll'a bağlı dönen 3B silindir başlık çarkı yaz.
>
> **Kurulum:** Ata elemanda `perspective: 1500px`. Satırlar `position: absolute`, sahne `height: 0` (eksen çizgisi), `transform-style: preserve-3d`. `gsap.set(rows, { transformOrigin: '50% 50% -115px', yPercent: -50, backfaceVisibility: 'hidden' })` — origin `RADIUS = 115px` geriye itilince satırlar silindir yüzeyine sarılır; arka yüz gizlenir.
>
> **Boyama (her karede `paint()` ile):** `step = 360 / satırSayısı`. Her satır i için:
> - `angle = wrap(-180, 180)(i*step + spin.rotation)` (dikişsiz sonsuz döngü için sarmalı kullan).
> - `facing = cos(angle°)`, `front = max(0, facing)`.
> - `rotationX: angle`
> - `opacity: 0.05 + front*0.95`
> - `scale: 0.62 + front*0.38`
> - `filter: blur((1-front)*7px)`
> - `pointerEvents: facing > 0.86 ? 'auto' : 'none'` (yalnız öne bakan tıklanır).
>
> **Sürücü:** `gsap.to(spin, { rotation: -360, ease: 'none', onUpdate: paint, scrollTrigger: { trigger: root, start: 'top top', end: '+=240%', pin: true, scrub: 1, invalidateOnRefresh: true } })` — pinlenmiş bölümde 240% scroll boyunca tam bir tur.
>
> **Reduced-motion:** `matchMedia('(prefers-reduced-motion: reduce)')` dalında her şeyi düzleştir (`rotationX:0, opacity:1, scale:1, filter:'none', pointerEvents:'auto', position:'relative', clearProps:'transform'`).
>
> Satırlara `will-change: transform`; temizlikte `tween.kill()`.

---

## 🔧 Teknik Özet
- `RADIUS 115px` · `perspective 1500px` · scroll `+=240%` · `scrub 1` · `rotation -360`
- `opacity 0.05 + front*0.95` · `scale 0.62 + front*0.38` · `blur (1-front)*7px`
- tıklama eşiği `facing > 0.86` · sarmal `wrap(-180,180)` (sonsuzluk sırrı)
