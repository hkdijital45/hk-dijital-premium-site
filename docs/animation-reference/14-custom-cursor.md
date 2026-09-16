# 14 — Özel İmleç (Lag'li Takip + Hover Büyüme)

**Nasıl görünür:** Küçük beyaz bir nokta (camgöbeği glow halkalı) imleci hafif gecikmeyle takip eder; tıklanabilir bir öğe üzerine gelince yumuşakça ~2× büyür. Ekran kenarında kaybolur.
**Kullanılan yer:** Sayfa geneli özel imleç.
**Teknoloji:** GSAP `quickTo` (lerp takip) + `gsap.to` (ölçek/opaklık).

---

## 🎯 Hazır Prompt (kopyala–yapıştır)

> React + GSAP ile özel imleç yaz. `<html>`'e bir sınıf ekleyip OS imlecini gizle (`cursor: none`).
>
> **Öğe:** `fixed left-0 top-0 z-[60] h-2.5 w-2.5 rounded-full bg-white/90`, `box-shadow: 0 0 10px 2px rgba(79,217,255,0.4)`, `ring-1 ring-[#4fd9ff]/40`. Başta `gsap.set(node, { xPercent:-50, yPercent:-50 })`.
>
> **Takip (lag'li):** `const xTo = gsap.quickTo(node,'x',{duration:0.32, ease:'power3'})`, `yTo` aynı. `mousemove`'da `xTo(clientX); yTo(clientY)` — quickTo içten lerp yapar, kayma hissi bundan gelir.
>
> **Hover büyüme:** `mouseover`'da hedef `target.closest('a, button, [role="button"], input, textarea, select, label, summary')` ise `gsap.to(node, { scale:1.9, duration:0.3, ease:'power3.out' })`, değilse `scale:1`.
>
> **Kenar fade:** `mouseleave` → `opacity:0, 0.25s`; `mouseenter` → `opacity:1, 0.25s`.
>
> Yalnız `(pointer:fine)` && reduced-motion kapalıyken etkin (aksi halde `null` döndür ve OS imlecini bırak).

---

## 🔧 Teknik Özet
- Takip: `quickTo duration 0.32, ease power3` · merkez `xPercent/yPercent -50`
- Hover: `scale 1 → 1.9`, `0.3s power3.out` · fade `0.25s`
- Nokta: `10px`, beyaz, cyan glow `#4fd9ff`
