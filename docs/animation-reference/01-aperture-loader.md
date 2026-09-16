# 01 — Aperture (Diyafram) Açılış Loader'ı

**Nasıl görünür:** Site açılırken bir kamera diyaframı görünür; ortada turkuaz kenarı hafifçe nabız atan diyafram bıçakları vardır, altında 000→100 sayan bir yüzde sayacı. Yükleme bitince bıçaklar hem büyüyerek hem dönerek geri çekilir (deklanşör açılır gibi) ve site ortaya çıkar.
**Kullanılan yer:** Sitenin ilk açılış ekranı (oturumda bir kez).
**Teknoloji:** GSAP timeline + SVG `<mask>` + requestAnimationFrame sayaç.

---

## 🎯 Hazır Prompt (kopyala–yapıştır)

> React + GSAP ile bir "kamera diyaframı" açılış loader bileşeni yaz. Detaylar:
>
> **Görsel:** Tam ekran koyu (`#0a0e14`) katman. Ortada SVG viewBox `0 0 100 100`, merkezi `50,50`. Bir SVG `<mask>` içinde çokgen diyafram bıçakları (beyaz = opak, ortadaki çokgen delik = siyah). Bıçakların kenarına turkuaz (`#0adce4`) `stroke` ile bir "glow" çokgeni. Altında monospace 3 haneli sayaç (`000`).
>
> **1) Kenar nabzı (sürekli döngü):** glow çokgeninin opaklığını `gsap.to('[data-aperture-glow]', { opacity: 0.85, duration: 1.1, repeat: -1, yoyo: true, ease: 'sine.inOut' })`. Taban opaklık `0.35`.
>
> **2) Yüzde sayacı (rAF ile yumuşatılmış):** Gerçek yükleme ilerlemesine doğru üstel yumuşatma ile yaklaş: her karede `p += (hedef*100 - p) * 0.12`. Varlıklar hazır olana kadar hedefi `0.92`'de tut ("sayı asla yalan söylemez"). En az `1400ms` görünür kal. `document.fonts.ready` + kritik video `canplay` beklenince tamamlandı say.
>
> **3) Açılış (çıkış timeline'ı):** Yükleme bitince `transformOrigin: '50px 50px'` ile:
> - `gsap.to('[data-aperture-blades]', { scale: 26, rotate: 26, duration: 1.15, ease: 'power3.inOut' })`
> - aynı anda (pozisyon 0) `gsap.to('[data-aperture-ui]', { opacity: 0, duration: 0.3 })`
> - pozisyon 0.8'de `gsap.to(root, { opacity: 0, duration: 0.35 })`
> - `onComplete`'te `body.overflow`'u geri aç ve bileşeni DOM'dan kaldır.
>
> **Kurallar:** Loader sadece `sessionStorage`'da "görülmedi" ise ve `prefers-reduced-motion` kapalıysa gösterilsin. Aktifken `body { overflow: hidden }`. Escape/Space ile atlanabilsin. rAF arka planda durabildiği için **6000ms failsafe** timeout koy (yoksa scroll kilitli kalır). Tek seferlik açılış guard'ı kullan.

---

## 🔧 Teknik Özet
- Bıçak açılışı: `scale 26`, `rotate 26`, `1.15s`, `power3.inOut`
- UI fade: `0.3s` @0 · root fade: `0.35s` @0.8
- Glow nabzı: `opacity 0.35→0.85`, `1.1s`, `sine.inOut`, sonsuz yoyo
- Sayaç yumuşatma faktörü: `0.12` · min görünürlük `1400ms` · varlık tavanı `0.92` · tamamlanma `≥99.4`
- Failsafe: `6000ms` · Renkler: void `#0a0e14`, neon `#0adce4`
