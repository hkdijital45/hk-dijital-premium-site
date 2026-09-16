# 17 — Navbar (Kayan Pill + Mobil Menü + Ambient Aurora)

**Nasıl görünür:** Buzlu bir nav hap'ının içinde sürekli yavaşça dönen renkli bir aurora. Masaüstünde beyaz bir "pill" hover'lanan/aktif linkin arkasına yaylı biçimde kayar. Mobilde tam ekran menü açılır; maddeler bulanıklıktan yükselerek sırayla gelir, birinin üstüne gelince diğerleri bulanıklaşıp soluklaşır ("baktığın odakta kalır").
**Kullanılan yer:** Global navbar.
**Teknoloji:** motion (Framer Motion) `layoutId` + `AnimatePresence` + CSS konik gradyan.

---

## 🎯 Hazır Prompt (kopyala–yapıştır)

> React + motion (Framer Motion) + Tailwind ile navbar yaz. Ev eğrisi `EASE = [0.16, 1, 0.3, 1]`.
>
> **1) Ambient aurora (hap arka planı):** `absolute left-1/2 top-1/2 aspect-square w-[130%] -translate-x-1/2 -translate-y-1/2`, iç span `animate-[spin_18s_linear_infinite] opacity-55 motion-reduce:animate-none`, arka plan `conic-gradient(from 0deg, transparent 0deg, rgba(40,199,250,0.6) 45deg, transparent 120deg, rgba(74,222,128,0.45) 190deg, transparent 250deg, rgba(30,144,255,0.55) 310deg, transparent 360deg)`. (Performans için backdrop-blur yerine `bg-void/80` tint.)
>
> **2) Kayan pill (masaüstü, paylaşımlı düzen):** aktif/hover linkin arkasında `motion.span layoutId="nav-pill"` `absolute inset-0 rounded-full bg-white`, `boxShadow:'0 0 22px -6px rgba(10,220,228,0.55)'`, `transition={{ type:'spring', stiffness:420, damping:34, mass:0.7 }}`. `showPill = (navHover ?? activeHref) === item.href`; hover'daki metin `text-void`. `onMouseEnter/onFocus` → `navHover`; `onMouseLeave` → temizle (aktif rotaya döner).
>
> **3) Mobil tam ekran menü (`AnimatePresence`):**
> - Overlay: `initial {opacity:0} → animate {1} → exit {0}`, `{duration:0.4, ease:EASE}`, `bg-void/98`.
> - Maddeler giriş: `initial {opacity:0, y:32, filter:'blur(14px)'} → animate {opacity:1, y:0, blur(0)}`, `{duration:0.7, delay:0.08 + i*0.055, ease:EASE}`.
> - Maddeler çıkış: `{opacity:0, y:-12, blur(10px), delay:i*0.02, duration:0.25}`.
> - Hover odak-dim: üzerine gelinmeyen maddeler `filter:blur(3px); opacity:0.35`, geçiş `400ms cubic-bezier(0.16,1,0.3,1)`. Aktif madde `text-neon` + küçük neon nokta.
> - Açıkken `body` overflow kilitle; odak paneline taşı; Escape/rota değişimi kapatır.
>
> **4) Logo hover:** `transition-transform duration-500 group-hover/logo:scale-105`.

---

## 🔧 Teknik Özet
- Ambient aurora: `spin 18s`, `opacity-55`, alfa duraklı konik gradyan
- Kayan pill: spring `stiffness 420, damping 34, mass 0.7`, `layoutId`
- Mobil giriş: `blur14→0, y32→0`, `0.7s`, stagger `0.08 + i*0.055`
- Odak-dim: diğerleri `blur(3px) opacity 0.35`, `400ms` · EASE `[0.16,1,0.3,1]`
