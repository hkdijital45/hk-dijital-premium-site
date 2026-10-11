# Visual/accessibility acceptance sweep — 2026-10-11

Playwright, against a local production build (`next build && next start`), 15 pages × 4 breakpoints (320/390/768/1440px) = 60 checks. Each page was scrolled through in steps before capture so `MarketingReveal` (framer-motion `whileInView`) content actually renders in the screenshot, not just checked via source.

Pages: home, hizmetler, hizmetler detay, paketler, blog listesi, blog detay, markalar, iletişim, teklif-al, hk-intelligence, manisa, gizlilik, kullanım şartları, veri silme, 404 (genuine unmatched URL).

## Result
- Horizontal overflow (`scrollWidth > clientWidth`): **0 / 60**
- Genuine console errors: **0** (the only logged entries are the 404 page's own top-level navigation status, expected and correct)

## Screenshots
`screenshots/<page>-<width>.png`, one per page×breakpoint combination.
