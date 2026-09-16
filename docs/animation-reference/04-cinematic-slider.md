# 04 — Sinematik Proje Slider'ı (Tek Ticker Döngüsü)

**Nasıl görünür:** Tam ekran, dikey kaydırılan proje sahneleri. Kaydırdıkça: ortadaki sahne nettir; komşuları bulanık, karanlık ve gri. Başlık kalıcı 3B bir eğimde durur, hızlı kaydırınca burkulur/kayar (kromatik sapma taşar), imlece doğru hafifçe yalpalar; arka plan foto scroll'un gerisinde kalır (parallax), ortaya gelince büyür, hızlı kaydırınca dikey gerilir. Durduğun an her şey nete/düze oturur. Yani scroll bir kamera gibi hisseder.
**Kullanılan yer:** Projeler sayfası.
**Teknoloji:** Tek `gsap.ticker` render döngüsü + Lenis + "state değil ref" deseni. (İleri seviye.)

> ⚠️ Bu, sitenin en karmaşık animasyonu. AI'na **tek seferde** değil, aşağıdaki parçalar halinde vermen daha iyi sonuç verir. Önce çekirdek döngüyü kur, sonra efektleri tek tek ekle.

---

## 🎯 Hazır Prompt — Çekirdek (önce bunu iste)

> React + GSAP + Lenis ile sinematik dikey slider'ın **çekirdeğini** kur. Kritik ilke: **React state ile animasyon YOK** — her kare imperatif olarak DOM `.style`'a ref üzerinden yazılır ve **tek bir `gsap.ticker` döngüsü** her şeyi sürer.
>
> - Her slide `height: 100vh`. Sürücü koordinat: `base = scrollY / innerHeight`. Her slide'ın işaretli mesafesi `progress = base - i` (−1 = altta giriyor, 0 = ortada/aktif, +1 = üstten çıktı).
> - Lenis'i aynı GSAP ticker'ına bağla: `gsap.ticker.add(t => lenis.raf(t*1000))`, `gsap.ticker.lagSmoothing(0)`, `lenis.on('scroll', ScrollTrigger.update)`. Lenis config: `lerp: 0.085`, `smoothWheel: true`, `wheelMultiplier: 1`, `touchMultiplier: 1.4`.
> - Her slide, elemanlarını (`scene, image, overlay, title, stack, red, cyan`) bir `partsRef` dizisine `register` callback'iyle kaydetsin; döngü bu diziyi okuyup her kareye `apply()` ile yazsın.
> - **Hız (velocity):** ham `raw = (scroll - last)/vh`; yumuşat `velocity = damp(velocity, raw, 9, dt)` (damp = frame-bağımsız lerp: `lerp(cur, target, 1 - exp(-λ*dt))`); `dt = min(deltaMs,50)/1000`; sonucu **±0.6** kıskaçla.
> - **Aktiflik zarfı (activity 0→1):** kaydırırken (`|velocity|>0.0007`) `damp(activity, 1, 8, dt)`; durunca `gsap.to(activity, { v:0, duration:0.35, ease:'power3.out' })`.

## 🎯 Hazır Prompt — Efektler (çekirdek çalışınca ekle)

> Şimdi ticker döngüsüne şu efektleri ekle (hepsi `progress`, `velocity`, `activity`'den türer; `perspective: 1300px` ana kapta):
>
> 1. **Kromatik sapma (başlık):** kırmızı `rgb(255,40,90)` / cyan `rgb(40,220,255)` iki hayalet katman. `sep = activity*6 + softClamp(velocity*11,1)*6`; kırmızı `translate3d(sep,0,0)`, cyan `translate3d(-sep,0,0)`; hayalet opaklık `clamp(activity,0,1)`. (Bkz. dosya 05.)
> 2. **Başlık burkulması (yalnız başlık `stack`):** `rotateX = activity*6`, `rotateY = softClamp(velocity*11,1)*13`, `rotateZ = activity*(-6) + velInt*6`, `skewY = velInt*6`. (Alt yazı/açıklama düz kalır.)
> 3. **Sahne eğimi (mouse + hız):** `rotateX = softClamp(progress*6,6) + mouseY*3.5`; `rotateY = -mouseX*3.5 - velocity*5.5`. Mouse −1..1 normalize, `damp(…, 6, dt)`; dokunmatikte kapalı.
> 4. **Görsel parallax/zoom/gerilme:** `active = clamp(1-|progress|,0,1)`; `coverScale ≈ 1.069` (perspektif açığını kapatır); `zoom = coverScale*(1 + 0.12*active)`; `stretchY = zoom*(1 + |velocity|*0.35)`; `imageY = progress*130*0.45`. Transform: `translate3d(0, imageY, -90px) scale(zoom, stretchY)`.
> 5. **Odak filtresi:** `inactive = 1-active`; `filter: blur(inactive*7px) brightness(1 - inactive*0.5) grayscale(inactive)`. Sadece ortadaki nettir.
> 6. **Overlay karartma:** `overlayOpacity = clamp(0.5 + inactive*0.35, 0, 0.92)`.
> 7. **Başlık bloğu parallax/fade:** `titleY = progress*-130*1.25`, `translate3d(0, titleY, 90px) scale(0.935)`, `opacity = clamp(active*1.35,0,1)`.
> 8. **Park optimizasyonu:** `|progress|>1.35` olan slide'ları bir kez "parked" haline (`blur7 brightness0.5 grayscale1`, overlay 0.85, başlık opacity 0) sabitle ve döngüde atla.
> 9. **Chrome (opsiyonel):** sayaç `00`, sağda dikey ilerleme çubuğu `scaleY(scroll/maxScroll)`, ilk slide'da kaybolan scroll ipucu — hepsi aynı döngüde imperatif yazılır.
>
> Not: Bu slider bilerek reduced-motion'da da açık bırakılmıştır (ürün kararı); istersen `matchMedia` ile sadeleştir.

---

## 🔧 Teknik Özet (yük taşıyan sabitler)
- Lenis `lerp 0.085`, `touchMultiplier 1.4`
- perspective `1300`, depth `90`, tilt `6`, parallax `130`, zoom `0.12`, overlay `0.5`, rgbStrength `12`, mouseTilt `3.5`
- velocity `damp λ=9` clamp `±0.6` · mouse `damp λ=6` · activity rise `λ=8`, settle `0.35s power3.out`, stop eşiği `|v|>0.0007`
- Başlık burkulma: tiltX `6`, tiltZ `-6`, rotY `13`, rotZ `6`, skewY `6`, boost `11`
- IMAGE_PARALLAX `0.45`, TITLE_PARALLAX `1.25`, VELOCITY_TILT `5.5`, VELOCITY_STRETCH `0.35`, INACTIVE_BLUR `7`, INACTIVE_DIM `0.5`
- coverScale `≈1.069`, titleScale `≈0.935` · render penceresi `1.35vh`
- `softClamp(v,limit) = limit*tanh(v/limit)` · `damp(cur,tgt,λ,dt) = lerp(cur,tgt,1-exp(-λ*dt))`
