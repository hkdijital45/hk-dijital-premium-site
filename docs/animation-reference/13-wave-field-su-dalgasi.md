# 13 — Su Dalgası (İmleçle Etkileşen)

**Nasıl görünür:** Tüm sayfanın üstünde neredeyse görünmez, sakin bir su tabakası. İmleç gezdikçe genişleyen, sönümlenen eşmerkezli dalgalar (havuzda ışık kırılması gibi) oluşturur; hızlı hareket daha güçlü/geniş dalga; tıklama tam bir patlama yapar.
**Kullanılan yer:** Sayfa geneli üst katman su efekti.
**Teknoloji:** React Three Fiber + GLSL shader + CPU tarafında dalga kaynağı ring-buffer'ı. (Çok ileri seviye.)

---

## 🎯 Hazır Prompt (kopyala–yapıştır)

> React Three Fiber ile imleçle etkileşen "kristal su" overlay shader'ı yaz. CPU bir ring-buffer'da dalga kaynaklarını tutar (`pointermove`/`pointerdown`), tüm dalga fiziği fragment shader'da.
>
> **Canvas:** `orthographic`, `camera={{position:[0,0,1],zoom:1}}`, `gl={{antialias:false, alpha:true, powerPreference:'high-performance'}}`, **`dpr={1}`**. Sarmalayıcı `fixed inset-0; z-index:45; pointer-events:none` (içeriğin üstünde, imlecin altında). `planeGeometry [2,2]`, `shaderMaterial` `transparent`, `depthWrite=false`, `depthTest=false`.
>
> **Ring-buffer:** max 24 kaynak; `Source = {x, y, t0, amp}`; `writeIdx=(i+1)%24`. Her kaynak `uSources` vec4'e (xy=uv origin, z=doğuş zamanı, w=güç) yansır.
> - `onMove`: uv `x=clientX/innerW`, `y=1-clientY/innerH`. `dist<0.012` ise atla. `speed=dist/dt`; `amp=clamp(speed/2.2, 0.14, 1)`.
> - `onDown`: `amp=1` (patlama).
>
> **Uniform'lar (her kare):** `uTime=clock.elapsedTime`, `uAspect`, `uIntensity=clamp(width/1440, 0.6, 1.15)`, `uCyan=#4fd9ff`, `uCount=24`.
>
> **Fragment (`precision highp`) sabitleri:** `LIFE=2.4s`, `SPEED=0.26`, `DAMP=1.7`, `FREQ=44.0`. Her kaynak için: `age=uTime - z` (0..LIFE dışı atla); `radius=age*SPEED`; `width=mix(0.010,0.034,w)`; `ring=exp(-pow((d-radius)/width, 2.0))`; `decay=exp(-age*DAMP)*(1-age/LIFE)`; `band=0.55+0.45*cos((d-radius)*FREQ)`; topla `light += ring*decay*band*w`.
> **Ortam parıltısı:** `g=0.5+0.5*sin(p.x*7+uTime*0.25)*cos(p.y*6-uTime*0.2)`; `sheen=pow(g,6)*0.015`.
> **Çıkış:** `e=light*uIntensity`; `col=mix(uCyan, vec3(1.0), clamp(e*0.9,0,1))`; `alpha=clamp(e*0.26 + sheen, 0, 0.55)` (bilinçli soluk).
>
> **Kapılar:** yalnız `(pointer:fine)` && reduced-motion kapalı && yazılım-WebGL değil (swiftshader/llvmpipe kontrolü) iken mount et.

---

## 🔧 Teknik Özet
- `dpr 1`, overlay `z-45`, ring-buffer 24 kaynak
- `LIFE 2.4s`, `SPEED 0.26`, `DAMP 1.7`, `FREQ 44` · renk `#4fd9ff`
- hız→güç `clamp(speed/2.2, 0.14, 1)`; tık `amp 1`; min adım `0.012 uv`
- alfa tavanı `0.55` (görünmez-e-yakın); yazılım-WebGL'de kapalı
