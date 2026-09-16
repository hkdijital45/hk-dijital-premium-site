# 15 — Yüzen İletişim Dock'u (WhatsApp / Telegram / Ara)

**Nasıl görünür:** Sağ altta tek bir neon buton; etrafında dikkat çeken nabız (ping) halkası. Tıklayınca üç kanal butonu (WhatsApp, Telegram, Ara) sırayla yukarı fırlar; tetik butonun ikonu 135° dönerek mesaj → artı/kapat olur.
**Kullanılan yer:** Sayfa geneli sabit iletişim dock'u.
**Teknoloji:** Saf CSS transitions + Tailwind (`animate-ping`). Kolay.

---

## 🎯 Hazır Prompt (kopyala–yapıştır)

> React + Tailwind ile sağ-alt yüzen iletişim dock'u yaz (`useState(open)`; JS animasyon kütüphanesi yok).
>
> **Kanal stagger:** her kanal `<li>` `transition-all duration-300`. Açılışta `transitionDelay = (n-1-i)*60ms` (ters sıra → WhatsApp en üste otursun); kapanışta `i*40ms`. Açık: `opacity:1; transform: translateY(0) scale(1)`. Kapalı: `opacity:0; transform: translateY(20px) scale(0.6); pointer-events:none`.
>
> **Kanal butonları:** `h-12 w-12 md:h-14 md:w-14`, `hover:scale-110 duration-300`, renkler WhatsApp `#25D366`, Telegram `#229ED9`, Ara `#0a7285`.
>
> **Tetik buton:** `bg-neon h-14 w-14 md:h-16 md:w-16`, `hover:scale-105 duration-300`.
>
> **Dikkat nabzı (yalnız kapalıyken):** içine `<span class="absolute inset-0 rounded-full bg-neon motion-safe:animate-ping motion-safe:[animation-duration:2s]">`.
>
> **İkon dönüşü:** iç span `transition-transform duration-300`, `transform: open ? rotate(135deg) : rotate(0)`; mesaj-balonu SVG'sini artı SVG'sine çevir.
>
> Tümü `motion-safe`/`motion-reduce` uyumlu (`motion-reduce:transition-none`). Neon `#0adce4`.

---

## 🔧 Teknik Özet
- Kanal stagger: aç `(n-1-i)*60ms`, kapa `i*40ms` · kapalı hal `translateY(20px) scale(0.6)`
- Nabız: `animate-ping`, `2s`, yalnız kapalıyken · ikon `rotate(135deg)`, `300ms`
- Renkler: WhatsApp `#25D366`, Telegram `#229ED9`, Ara `#0a7285`, tetik neon `#0adce4`
