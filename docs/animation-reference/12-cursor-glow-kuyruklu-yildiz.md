# 12 — Kuyruklu Yıldız İmleç İzi

**Nasıl görünür:** Dururken görünmez. İmleç hareket edince arkasında mavi→camgöbeği→yeşil yumuşak bir ışık kuyruğu sürüklenir, hareket yönünde uzar (streak), durunca anında söner.
**Kullanılan yer:** Sayfa geneli imleç atmosferi.
**Teknoloji:** Saf DOM (radial-gradient blob'lar) + requestAnimationFrame + lerp zinciri.

---

## 🎯 Hazır Prompt (kopyala–yapıştır)

> React + requestAnimationFrame ile "kuyruklu yıldız" imleç izi yaz (canvas/kütüphane yok).
>
> **Bloblar:** 10 adet `div`, radial-gradient (`radial-gradient(circle, renk 0%, transparent 70%)`), `rounded-full`, `will-change:transform`. Baştan (`size:190, opacity:0.5`) kuyruğa (`size:44, opacity:0.07`) küçülen dizi. Renkler sırayla `#1E90FF, #28C7FA, #4ADE80`. Kapsayıcı `fixed inset-0 -z-10`.
>
> **Zincir takip:** `EASE = 0.22`. Baş nokta imlece: `pts[0].x += (mx - pts[0].x)*EASE`; her blob önündekini aynı EASE ile kovalar (daralan kuyruk).
>
> **Hız & streak:** `vx = vx*0.8 + dx*0.2` (y aynı). `speed = hypot(vx,vy)`, `angle = atan2(vy,vx)`. `stretch = min(speed*0.06, 2.4)`; `sx = 1+stretch`, `sy = 1/(1+stretch*0.55)`.
>
> **Şiddet (asimetrik ease):** `target = min(speed/12, 1)`; `k = target>intensity ? 0.4 : 0.08` (hızlı yüksel, yavaş sön); `intensity += (target-intensity)*k`.
>
> **Ofset:** `OFFSET = 96` — her blobu hareket yönünde geriye it (glow imlecin önüne geçmesin). Blob transform: `translate3d(gx,gy,0) rotate(angle) scale(sx,sy)`, `gx = pts[i].x - ndx*OFFSET - size/2`; opacity `= blob.opacity * intensity`.
>
> **Kapılar:** yalnız `(pointer:fine)`, düşük-performans değil ve reduced-motion kapalıysa çalışsın. `document.hidden`'da duraklat. Kare başına yalnız transform+opacity yaz.

---

## 🔧 Teknik Özet
- 10 blob (190/0.5 → 44/0.07) · zincir `EASE 0.22` · offset `96px`
- streak `min(speed*0.06, 2.4)` · şiddet ease `0.4↑ / 0.08↓` · hız yumuşatma `0.8/0.2`
- Renkler `#1E90FF, #28C7FA, #4ADE80` · sadece transform/opacity
