# 09 — Yatay Pinlenen Hizmet Karuseli

**Nasıl görünür:** Bölüm ekrana kilitlenir (pin); dikey kaydırma, kart duvarını yana doğru sürer. Sabit bir çerçeve içinde kartlar geçer gibi. Kartlar hover'da kalkar ve görselleri zoom yapar.
**Kullanılan yer:** Ana sayfada hizmetler şeridi.
**Teknoloji:** GSAP + ScrollTrigger (pin + scrub).

---

## 🎯 Hazır Prompt (kopyala–yapıştır)

> React + GSAP (ScrollTrigger) ile yatay pinlenen kart karuseli yaz.
>
> **Mekanizma:** `distance = track.scrollWidth - window.innerWidth`. `gsap.to(track, { x: () => -distance, ease:'none', scrollTrigger: { trigger: root, start:'top top', end: () => '+=' + distance, pin: true, anticipatePin: 1, scrub: 1, invalidateOnRefresh: true } })`. Sadece `x` (transform), kare-içi filtre yok. Temizlikte `tween.kill()`.
>
> **Dokunma:** kaba `touch-action: pan-y` ver (dikey scroll çalışsın).
>
> **Reduced-motion fallback:** pin/scrub yerine statik sar-ortala düzen (`h-auto flex-wrap justify-center`) — `motion-reduce:` sınıflarıyla.
>
> **Kart hover (CSS):** kart `transition-[border-color,transform] duration-500 hover:-translate-y-1 hover:border-neon/70`; görsel `transition-transform duration-700 group-hover:scale-[1.04]`; CTA ipucu `opacity-0 group-hover:opacity-100 duration-300`.
>
> Tüm GSAP `matchMedia('(prefers-reduced-motion: no-preference)')` içinde; `dependencies:[cards]`.

---

## 🔧 Teknik Özet
- Pan: `x: -(scrollWidth - innerWidth)`, `ease none`, `pin`, `scrub 1`
- end dinamik: `'+=' + distance` · `invalidateOnRefresh` (resize güvenli)
- Hover: kart `-translate-y-1 500ms`, görsel `scale-1.04 700ms`
- Mobil güvenlik: `touch-action: pan-y` + reduced-motion statik düzen
