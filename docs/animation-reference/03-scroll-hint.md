# 03 — Scroll İpucu (Boşta Belirir, Kaydırınca Kaybolur)

**Nasıl görünür:** Sayfa boştayken altta yukarı-aşağı hafifçe zıplayan bir ok/chevron belirir. Kaydırmaya başlayınca anında kaybolur, durunca tekrar gelir. Sayfa sonunda hiç görünmez. Hangi arka planda olursa olsun okunur (beyazda siyah, siyahta beyaz).
**Kullanılan yer:** Sayfa altında sabit "aşağı kaydır" ipucu.
**Teknoloji:** GSAP + native scroll dinleyici + `mix-blend-difference`.

---

## 🎯 Hazır Prompt (kopyala–yapıştır)

> React + GSAP ile bir "aşağı kaydır" ipucu bileşeni yaz.
>
> **Konum/görünüm:** `position: fixed; bottom: 1.75rem; z-index: 40;` yatayda ortalı. İçinde küçük bir metin + chevron SVG. Kabın tamamına `mix-blend-mode: difference` uygula (renk otomatik zıtlaşsın, her arka planda okunur).
>
> **1) Chevron zıplama (sonsuz):** `gsap.to('[data-bob]', { y: 6, duration: 0.9, ease: 'sine.inOut', repeat: -1, yoyo: true })`.
>
> **2) Kaydırınca gizle / boşta göster:**
> - Başlangıç: `gsap.set(el, { opacity: 0, y: 10 })`.
> - `window` `scroll` (passive) olayında hemen gizle: `gsap.to(el, { opacity: 0, y: 10, duration: 0.3, ease: 'power2.out', overwrite: true })`.
> - Scroll durduktan `550ms` sonra (setTimeout debounce) göster: `gsap.to(el, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out', overwrite: true })`.
> - Sayfa sonundaysa gösterme: `scrollY + innerHeight >= scrollHeight - 80` iken reveal'i bastır.
> - İlk yüklemede kısa süre sonra bir kez göster.
>
> **Tıklama:** `window.scrollTo({ top: scrollY + innerHeight*0.9, behavior:'smooth' })`.
>
> Chevron zıplaması yalnız `prefers-reduced-motion: no-preference` iken çalışsın.

---

## 🔧 Teknik Özet
- Zıplama: `y 0→6`, `0.9s`, `sine.inOut`, sonsuz yoyo
- Gizle: `0.3s power2.out` · Göster: `0.5s power3.out` · idle debounce `550ms`
- Alt eşiği: `scrollHeight - 80` · tıklama sıçrama: `innerHeight*0.9`
- Kilit numara: `mix-blend-difference` (her zeminde okunur)
