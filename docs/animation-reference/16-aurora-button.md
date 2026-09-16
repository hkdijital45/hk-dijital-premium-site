# 16 — Aurora Buton (Dönen Konik Gradyan)

**Nasıl görünür:** Yarı saydam beyaz hap (pill) buton. Üzerine gelince içi yavaşça dönen koyu bir "aurora" (konik gradyan) ile dolar, kenarı neon'a döner, sonundaki ok biraz daha açılır.
**Kullanılan yer:** Sitedeki tüm ana CTA butonları.
**Teknoloji:** Saf CSS/Tailwind (konik gradyan + `spin`). Kolay ve çok etkili.

---

## 🎯 Hazır Prompt (kopyala–yapıştır)

> Tailwind ile "aurora" CTA butonu yaz (`<Link>` veya `<button>`; sadece CSS). Buton bir `group`, `overflow-hidden`.
>
> **Taban hap:** `rounded-full border border-neon/60 bg-white/70 text-void transition-all duration-300 hover:border-neon hover:text-light`.
>
> **Aurora katmanı:** `absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-75`. İçinde ortalanmış, **aşırı büyük** dönen span: `absolute left-1/2 top-1/2 aspect-square w-[220%] -translate-x-1/2 -translate-y-1/2 animate-[spin_6s_linear_infinite] motion-reduce:animate-none`, arka planı `conic-gradient(from 0deg, #0a5266, #123f6b, #15803d, #0b3d4e, #0a5266)`. (Büyük olması, dönerken hap'ı hep doldurması için.)
>
> **Ok aralığı:** `md` boy `gap-3 hover:gap-5`; ok span'i `transition-transform duration-300` (hover'da dışarı kayar).
>
> Not: Dönüş hep çalışır, sadece hover'da opacity ile görünür olur.

---

## 🔧 Teknik Özet
- Aurora: `opacity 0 → 0.75` hover, `spin 6s linear infinite`, `w-[220%]`
- Konik gradyan: `#0a5266 → #123f6b → #15803d → #0b3d4e → #0a5266`
- Hap: `bg-white/70`, `border-neon/60 → neon` · ok: `gap-3 → gap-5`
