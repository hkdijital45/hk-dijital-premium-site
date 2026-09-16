# 18 — Sayfa Geçişi Rack-Focus (View Transitions)

**Nasıl görünür:** Sayfa değişince eski sayfa odaktan düşer (bulanıklaşır, hafif büyür, solar), yeni sayfa odağa çekilir (bulanıklık açılır, minik küçükten büyür, belirir) — sayfalar arası bir kamera "rack focus"'u. Header ve imleç sabit referans kalır.
**Kullanılan yer:** Tüm sayfa geçişleri.
**Teknoloji:** Native CSS View Transitions API + `@keyframes` (JS kütüphanesi yok).

---

## 🎯 Hazır Prompt (kopyala–yapıştır)

> CSS View Transitions API ile "rack-focus" sayfa geçişi yaz.
>
> ```css
> ::view-transition-old(root) {
>   animation: 200ms cubic-bezier(0.16, 1, 0.3, 1) both kadraj-defocus;
> }
> ::view-transition-new(root) {
>   animation: 340ms cubic-bezier(0.16, 1, 0.3, 1) 190ms both kadraj-focus; /* 190ms gecikme: yeni, eski çıkınca başlar */
> }
> @keyframes kadraj-defocus {
>   to { opacity: 0; filter: blur(9px); transform: scale(1.015); }
> }
> @keyframes kadraj-focus {
>   from { opacity: 0; filter: blur(11px); transform: scale(0.992); }
>   to   { opacity: 1; filter: blur(0);    transform: scale(1); }
> }
> ```
>
> **Sabit referanslar:** header ve özel imleç için `view-transition-name` ata ve geçişte dondur:
> ```css
> ::view-transition-group(site-header), ::view-transition-group(site-cursor) { animation: none; z-index: 100; }
> ::view-transition-old(site-header), ::view-transition-old(site-cursor) { display: none; } /* çift görüntüyü önler */
> ```
>
> **Reduced-motion:** `@media (prefers-reduced-motion: reduce)` altında view-transition pseudo'larında `animation-duration: 0s; animation-delay: 0s`.
>
> Not: Büyük blur burada ucuz, çünkü canlı DOM değil tarayıcının **snapshot'ları** üzerinde çalışır. (Next.js App Router'da `viewTransition` deneysel bayrağıyla veya `next-view-transitions` ile tetiklenir.)

---

## 🔧 Teknik Özet
- Eski: `200ms defocus` (`blur9, scale1.015, opacity0`)
- Yeni: `340ms focus + 190ms delay` (`blur11→0, scale0.992→1`)
- Ev eğrisi `cubic-bezier(0.16,1,0.3,1)` · header/cursor donuk referans
