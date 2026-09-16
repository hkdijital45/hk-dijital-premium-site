# 08 — Hizmet Gezgini (Hover Önizleme Paneli)

**Nasıl görünür:** İki sütunlu bir keşif alanı. Solda hizmet listesi; bir hizmetin üzerine gelince sağdaki yapışkan panel değişir: görsel hafif zoom'la çapraz geçiş yapar, arkasındaki renkli glow o hizmetin rengine döner, başlık/açıklama bulanıklıktan gelir, metrik kartları sırayla belirir ve sayılar 0'dan hedefe sayar. Panel görseli imlece göre hafifçe kayar (parallax). Köşede hizmet türüne göre küçük animasyonlu bir ikon (equalizer/ağ/pipeline/film şeridi/odak halkası) döner.
**Kullanılan yer:** Hizmetlerimiz sayfası.
**Teknoloji:** GSAP + `useGSAP` + `quickTo` parallax + count-up.

---

## 🎯 Hazır Prompt (kopyala–yapıştır)

> React + GSAP ile iki sütunlu "hizmet gezgini" yaz. Sol: kategori/hizmet listeleri. Sağ: yapışkan önizleme paneli. Aktif hizmet hover/focus/click ile değişir (`setActiveId`). Ev eğrisi: `power3.out`. Her hizmetin bir `accent` rengi var; glow, sol çubuk, ok ve ikon bu renge boyanır.
>
> Aktif hizmet değişince (bir `useEffect`):
> 1. **Görsel çapraz geçiş:** iki üst üste `<img>` katmanı (A/B) ping-pong. Gelen: `fromTo(inc, {opacity:0, scale:1.08}, {opacity:1, scale:1, duration:0.7, ease:'power3.out'})`; giden: `to(out, {opacity:0, duration:0.6})`. `src`'yi animasyondan önce ata, sonra katmanı çevir. İlk mount'ta animasyon atla.
> 2. **Accent glow:** `to(glow, { background: 'radial-gradient(60% 60% at 50% 35%, ${accent}44, transparent 70%)', duration:0.6 })`.
> 3. **İçerik reveal:** `fromTo(content, {opacity:0, y:16, filter:'blur(6px)'}, {opacity:1, y:0, filter:'blur(0px)', duration:0.55})`.
> 4. **Metrik kartları stagger:** `fromTo('[data-metric]', {opacity:0, y:12}, {opacity:1, y:0, duration:0.5, stagger:0.08, delay:0.1})`.
> 5. **Sayı count-up:** metni önek/sayı/sonek diye ayır, bir proxy `{v:0}`'ı `to(proxy, {v:hedef, duration:0.9, ease:'power3.out', onUpdate})` ile say; binlik ayracı ve ondalığı koru.
>
> **Panel parallax:** `useGSAP` içinde `quickTo(img,'x'/'y',{duration:0.6, ease:'power3'})`; imleç ofseti ±0.5 → `x(dx*12), y(dy*12)` px; `mouseleave`'de 0'a dön. Görsel kabına `inset:-5%` payı ver (kenar açılmasın).
>
> **Kategori reveal (scroll):** `gsap.from('[data-cat-block]', {opacity:0, y:24, duration:0.8, stagger:0.12, scrollTrigger:{trigger:root, start:'top 75%'}})`.
>
> **Arka plan süpürmesi (sonsuz):** `fromTo('[data-sweep]', {xPercent:-30, opacity:0}, {xPercent:130, opacity:0.5, duration:9, ease:'sine.inOut', repeat:-1, repeatDelay:5})` — `blur-3xl` cyan gradyan şerit.
>
> **Türe göre ikon mikro-animasyonu** (`key={activeId}` ile her değişimde yeniden başlar), reduced-motion kapalı:
> - graph: `[data-bar]` `scaleY 0.15→1`, `1s`, `stagger 0.09`, sonsuz yoyo (equalizer).
> - nodes: `[data-node]` `opacity→0.35`, `0.9s`, `stagger{each:0.15}`, yoyo (ağ ışıltısı).
> - pipeline: `[data-card]` `x 0→34`, `1.4s`, `power2.inOut`, yoyo (kart mekik).
> - film: `[data-playhead]` `x 0→44`, `2s`, `ease:'none'`, sonsuz (playhead tarar).
> - camera: `[data-reticle]` `scale 0.8→1, opacity 0.4→1`, `1.2s`, `sine.inOut`, yoyo (odak nefesi).
>
> Mobilde: panel yerine dokunulan hizmetin altında satır-içi önizleme (`from {opacity:0, y:14}` + count-up). Tüm GSAP blokları `matchMedia('(prefers-reduced-motion: no-preference)')` içinde.

---

## 🔧 Teknik Özet
- Görsel: gelen `0.7s scale1.08→1`, giden `0.6s` · glow `0.6s` (`accent+44` alpha)
- İçerik `0.55s blur6→0` · metrik stagger `0.08` · count-up `0.9s`
- Parallax `quickTo 0.6s`, çarpan `12px`, pay `-5%`
- Süpürme `9s`, `repeatDelay 5` · kategori reveal `top 75%`, stagger `0.12`
- Ev eğrisi `power3.out`; ikon loop'ları `power2/sine/none`
