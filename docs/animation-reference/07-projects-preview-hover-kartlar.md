# 07 — Proje Önizleme Kartları (Hover)

**Nasıl görünür:** Proje kartları ızgarası. Üzerine gelince kart hafifçe yukarı kalkar, kenarı neon'a döner, içindeki görsel yavaşça büyür (frame içinde), başlık neon'a döner.
**Kullanılan yer:** Ana sayfa "Odağa aldığımız markalar" bölümü.
**Teknoloji:** Saf CSS (JS yok). En kolay ve en etkili başlangıç.

> Not: Bu bölüm bilerek **statik** (scroll-reveal yok). Sebep: pinlenen bir karuselden sonra ScrollTrigger reveal yanlış anda tetikleniyor ve kartları gizli bırakıyordu. Ders: pinlenmiş bölümlerin hemen ardındaki reveal'lere dikkat.

---

## 🎯 Hazır Prompt (kopyala–yapıştır)

> Tailwind ile hover'da canlanan proje kartı ızgarası yaz — **sadece CSS**, JS animasyon yok. Her kart bir `group`:
>
> - **Kart:** `transition-all duration-500 hover:-translate-y-1.5 hover:border-neon/60` (yukarı kalkma + kenar rengi).
> - **Görsel** (kapsayıcı `overflow-hidden`): `transition-transform duration-700 group-hover:scale-[1.05]` (yavaş içeri zoom).
> - **Başlık:** `transition-colors duration-300 group-hover:text-neon`.
> - Okunabilirlik için statik gradyan scrim (`from-void via-void/60 to-transparent`) — animasyonlu değil.
>
> Renkler: neon `#0adce4`, void `#0a0e14`. Kendi paletinle değiştir.

---

## 🔧 Teknik Özet
- Kart: `-translate-y-1.5`, `500ms` · Görsel: `scale-1.05`, `700ms` · Başlık: renk `300ms`
- Tümü CSS transition; en ucuz, en akıcı hover deseni
