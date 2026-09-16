# 11 — Bokeh Alan Derinliği Partikülleri

**Nasıl görünür:** Karanlık arka planda odak dışı yumuşak ışık diskleri (her birinin daha parlak bir "diyafram" kenarı var) yavaşça süzülür ve imlece doğru hafifçe parallax kayar. Gerçek lens bokeh'i gibi durur, "bulanık daireler" gibi değil.
**Kullanılan yer:** Hero'nun hizmetler sahnesi arka atmosferi.
**Teknoloji:** React Three Fiber + three.js + özel GLSL shader (tam ekran quad).

---

## 🎯 Hazır Prompt (kopyala–yapıştır)

> React Three Fiber ile performanslı bir "bokeh alan derinliği" arka planı yaz. Tam ekran bir GLSL shader quad kullan; tüm trigonometri/hash CPU'da (`useFrame`), shader olabildiğince ucuz olsun.
>
> **Canvas:** `orthographic`, `camera={{ position:[0,0,1], zoom:1 }}`, `gl={{ antialias:false, alpha:true, powerPreference:'high-performance' }}`, **`dpr={0.5}`** (yarı çözünürlük — bilinçli), `pointer-events:none`, `fixed inset-0`.
> **Geometri/materyal:** `planeGeometry args={[2,2]}` (clip-space quad; vertex shader `position`'ı doğrudan `gl_Position`'a verir, `vUv` geçer). `shaderMaterial`, `transparent`, `depthWrite=false`, `blending=AdditiveBlending`.
>
> **Orb'lar:** max 16 (shader döngü sınırı), varsayılan 14; `<768px` ekranda `min(8, count)`. Tohumlar **deterministik** (Math.random YOK): `h = fract(sin((i+1)*12.9898)*43758.5453)` türevleriyle `bx=(h1-0.5)*2.4`, `by=(h2-0.5)*1.5`, `depth=h3`, `tint=fract(h3*7.1)`.
>
> **Her karede (`useFrame`, `t = time*0.06`):** her orb için
> `x = bx + sin(t + i*2.3)*0.06 + mouse.x*travel`, `y = by + cos(t*0.8 + i*1.7)*0.05 + mouse.y*travel`, yarıçap `z = 0.015 + depth*0.1`, `travel = 0.02 + depth*0.09` (derin orb daha çok parallax). `uOrbMeta[i] = (0.35 + depth*0.65, tint)`. İmleç lerp: `mouse.lerp(pointer, 1 - pow(0.001, delta))` (frame-bağımsız).
>
> **Uniform'lar:** `uOrbs vec3[16]` (xy=merkez, z=yarıçap), `uOrbMeta vec2[16]` (x=şiddet, y=tint), `uCount int`, `uAspect float`, `uDeep = #0b3d4e`, `uNeon = #0adce4`.
>
> **Fragment shader (`precision mediump`):** `p=(vUv-0.5)*vec2(uAspect,1.0)`. Her orb: `d=length(p-orb.xy)`; ucuz eleme `if (d > size*1.15) continue`; disk `smoothstep(size, size*0.55, d)`; kenar rim `smoothstep(size*1.02,size*0.9,d) - smoothstep(size*0.9,size*0.72,d)`; renk `tint=mix(uDeep,uNeon,meta.y)`; topla `col += tint*(disc*0.05 + rim*0.16)*meta.x`; alfa `clamp(max(col.r,g,b)*1.6, 0, 1)`.
>
> **Performans:** `frameloop = aktif && !reduced ? 'always' : 'demand'` (boştayken GPU'yu durdur). Reduced-motion'da statik.

---

## 🔧 Teknik Özet
- `dpr 0.5`, additive blending, max 16 orb (`<768px` → 8)
- Deterministik hash tohum · drift `sin/cos * ~0.05-0.06` · parallax `0.02 + depth*0.09`
- Renkler: deep `#0b3d4e`, neon `#0adce4` · alfa luminans-tabanlı (gri kutu yok)
- Sır: tüm trig CPU'da (kare başına ~28 çağrı), shader ucuz
