# 02 — Hero Scroll-Scrub Sinematik Giriş

**Nasıl görünür:** Sayfa açıldığında tam ekran bir giriş klibi vardır. Aşağı kaydırdıkça video **kareye kilitli** biçimde ilerler (oynamaz, scroll'a bağlı taranır). Klip biterken üstünde bir soru başlığı bulanıklıktan nete gelir, sonra tekrar bulanıklaşıp yukarı süzülür; video beyaz bir "hizmetler" sahnesine erir; navbar yukarıdan iner; sayfanın ortasına dikey bir çizgi çizilir ve bu çizgiden başlıklar doğup sağa-sola açılır.
**Kullanılan yer:** Ana sayfa hero (pinlenen tek uzun sekans).
**Teknoloji:** GSAP ScrollTrigger (pin + scrub) + `<video>` (masaüstü) / `<canvas>` kare dizisi (mobil).

---

## 🎯 Hazır Prompt (kopyala–yapıştır)

> React + GSAP (ScrollTrigger) ile scroll'a bağlı sinematik bir hero yaz. Tüm sekans **tek bir pinlenmiş ScrollTrigger timeline** içinde olsun (`trigger: root, start: 'top top', end: masaüstü '+=540%' / mobil '+=320%', scrub: 1, pin: true, anticipatePin: 1, invalidateOnRefresh: true`). Timeline `defaults: { ease: 'none' }`.
>
> **1) Scroll-scrub klip:** Bir proxy `{ p: 0 }` nesnesini `tl.to(proxy, { p: 1, duration: 6 }, 0)` ile animasyonla.
> - Masaüstü: `onUpdate`'te `video.currentTime = proxy.p * (video.duration - 0.05)` (yalnızca `readyState >= 2` ise).
> - Mobil: video yerine **önceden üretilmiş 77 kareli WebP dizisi** (`/hero-frames/f001.webp … f077.webp`) kullan; `idx = Math.round(proxy.p * 76)` karesini `<canvas>` 2D `drawImage` ile cover-fit çiz (DPR `min(devicePixelRatio, 2)`). Kareler bir `useEffect`'te önceden yüklensin. (Sebep: video bazı telefonlarda kasar/görünmez; kare dizisi cihazlar arası birebir tutarlıdır.)
> - Masaüstü video kaynağını `media="(min-width: 768px)"` ile ver ki telefonlar 2K mp4 indirmesin.
>
> **2) Soru başlığı rack-focus:** pozisyon 6'da `fromTo('[data-question]', { filter:'blur(24px)', opacity:0, scale:1.04 }, { filter:'blur(0px)', opacity:1, scale:1, duration:1.2 })`; pozisyon 7.8'de `to(..., { filter:'blur(24px)', opacity:0, y:-60, duration:1 })`. (Mobilde blur pahalı — mobilde blur'u `0px`'e sabitle, sadece opacity+scale kullan.)
>
> **3) Video → beyaz sahne geçişi:** 7.8'de `to('[data-media]', { opacity:0, duration:1 })`; 8.2'de `fromTo('[data-services-bg]', {opacity:0}, {opacity:1, duration:1.6, ease:'power2.out'})` (aynı şekilde glow ve bokeh katmanları için).
>
> **4) Navbar iniş:** başta `gsap.set(nav, { yPercent:-140, opacity:0 })`; 8.2'de `to(nav, { yPercent:0, opacity:1, duration:0.9, ease:'power3.out' })`.
>
> **5) Merkez çizgi + başlık açılımı (yalnız masaüstü):** çizgiyi `set({ scaleY:0, transformOrigin:'top center' })` → 8.7'de `to({ scaleY:1, duration:4, ease:'none' })`. Her başlık `fromTo({ x:startX, opacity:0, filter:'blur(10px)' }, { x:0, opacity:1, filter:'blur(0px)', duration:0.9, ease:'power3.out' })`, gecikmeler `[0.8,1.8,2.8,3.6]` (çizgi başlangıcına eklenir). `startX` her başlık için `merkezX - (rect.sol + rect.genişlik/2)` olarak **fromTo'dan ÖNCE** ölçülsün (böylece hepsi çizgiden doğar, genişlikten bağımsız doğru yöne kayar).
>
> **6) İmleç takipli glow:** `onMouseMove`'da CSS değişkeni yaz (`--mx/--my = clientX/Y - rect`), React render etme. Tüket: `radial-gradient(300px circle at var(--mx) var(--my), rgba(40,199,250,0.28), transparent 74%)`.
>
> **Reduced-motion dalı:** scroll hijack yok; her şey `gsap.set` ile son haline sabitlensin (çizgi tam, başlıklar net, video gizli). Tüm blok `gsap.matchMedia('(prefers-reduced-motion: no-preference)')` içinde.

---

## 🔧 Teknik Özet
- ScrollTrigger: `scrub 1`, `pin`, end `+=540%` (masaüstü) / `+=320%` (mobil)
- Scrub süresi `6` birim · kare sayısı `77` · seek epsilon `0.05`
- Soru: in @6 (`blur24→0`, `scale1.04→1`, 1.2s) · out @7.8 (`y:-60`, 1s)
- Sahne fade-in @8.2 (`1.6s power2.out`) · nav @8.2 (`0.9s power3.out`)
- Çizgi çizimi @8.7 (`scaleY 0→1`, 4s) · başlık gecikmeleri `[0.8,1.8,2.8,3.6]`
- Ev eğrisi: reveal `power3.out`; scrub `none`
