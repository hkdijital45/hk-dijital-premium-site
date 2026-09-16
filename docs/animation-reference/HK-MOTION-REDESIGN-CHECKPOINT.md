# HK Dijital Cinematic Redesign — Working Checkpoint

Internal working document for the autonomous "HK DİJİTAL — FULL AUTONOMOUS
CINEMATIC WEBSITE MOTION REDESIGN" mission. Not user-facing docs. Update
after every significant milestone. This file is the source of truth if a
session is interrupted — read it first, verify git state, then continue
from NEXT EXACT ACTION.

## Task purpose

Elevate the public marketing website's motion/visual design to a premium,
cinematic, coherent "one design team" quality bar, using the 21 reference
technique docs in this folder as inspiration/technical blueprint only —
never as content or branding to copy. Scope is locked to the public
marketing site only (never `/hk-admin`, `/musteri-paneli`, Supabase schema,
auth, or other protected/internal surfaces). All real content, copy, SEO,
routes, and functions must be preserved exactly. Full spec lives in the
original user mission message (31 sections) — this file tracks execution
state, not the spec itself.

## Repo / git state

- Repo root: `/Users/hayrikamali/Projects/hk-dijital-production-final`
- Branch: `main`
- Starting commit (before this task): `326c431` — "Harden chart-rendering
  test against a real but flaky race condition"
- Pre-existing unrelated untracked path (do not touch, not part of this
  task): `docs/hk-admin-el-kitabi/`

## Stack constraint (decided)

`framer-motion ^12.40.0` is the ONLY animation library installed. No GSAP,
Lenis, three.js, @react-three/fiber/drei. **Decision: do not add any new
heavy animation dependency.** Build entirely on framer-motion + native CSS
+ IntersectionObserver/rAF, matching mission Section 17's explicit
"check existing stack before adding a dependency" priority. All reference
docs assume a GSAP+Lenis+R3F stack — every technique must be re-derived in
framer-motion/CSS terms, not copy-pasted.

## Reference files

All 21 files successfully recovered from the original mission message and
written to this folder:
`00-BASLA-BURADAN.md`, `01-aperture-loader.md`, `01-Kullanilan-Skiller.md`,
`02-hero-scroll-scrub-intro.md`, `03-scroll-hint.md`, `04-cinematic-slider.md`,
`05-chromatic-aberration-baslik.md`, `06-project-wheel-3d-silindir.md`,
`07-projects-preview-hover-kartlar.md`, `08-service-explorer.md`,
`09-service-carousel-yatay-pan.md`, `10-brand-marquee-logo-serit.md`,
`11-bokeh-alan-derinligi.md`, `12-cursor-glow-kuyruklu-yildiz.md`,
`13-wave-field-su-dalgasi.md`, `14-custom-cursor.md`,
`15-floating-contact-dock.md`, `16-aurora-button.md`, `17-nav-menu.md`,
`18-route-transition-rack-focus.md`, `19-scroll-reveal-blur.md`.
All read in full. Never delete these.

## Current-site audit findings (complete)

- Homepage (`HomepageExperience.tsx`) and its cinematic components
  (`MacBookEcosystem.tsx`, `CinematicMacBook.tsx`) are ALREADY a
  sophisticated, high-quality cinematic implementation (scroll-scrubbed
  pre-rendered video hero, fake-pin-via-transform pattern, device-tier
  gating, hydration-safe reduced-motion handling). Treat as
  largely-complete; touch only to fill real gaps, never rewrite.
- Two parallel design systems exist: "marketing v2"
  (`marketing/MarketingUI.tsx` + `MarketingVisualSystem.tsx`, self-contained)
  used by ALL 8 real marketing routes, vs. the older "premium" system
  (`ui.tsx` + `premium/PremiumUI.tsx`) shared with protected/auth surfaces
  (`/sifre-sifirla`, `/kurulum`, `/auth/callback`, `/super-admin-kurulum`,
  `/musteri-paneli`, admin, and `/digital-center` which is actually a
  noindex staff-login page, not marketing content). **Never edit
  `ui.tsx`/`PremiumUI.tsx`** — out of scope, regression risk to protected
  surfaces.
- Public marketing routes (all real, all marketing-v2, all already using
  `MarketingReveal` scroll-reveal fades): `/`, `/hizmetler`,
  `/hizmetler/[slug]`, `/hakkimda`, `/iletisim`, `/paketler`, `/blog`,
  `/blog/[slug]`, `/manisa-dijital-pazarlama`, `/teklif-al`.
  `/sertifikalar` is just a redirect to `/hakkimda#sertifikalar`, no
  standalone layout.
- **No real projects/portfolio/case-study/client-showcase section exists
  anywhere** (route, component, or content-model field). Confirmed via
  grep + `SiteContent` type audit. → rules out references 04, 06, 07 in
  their literal "projects" framing (never fabricate fake clients).
- **No real partner/brand/client logo data exists** in the content model
  (`content.brand` has no partners/logos array). Only real assets available
  for a marquee are the platform/tech icons in `PlatformIcons.tsx`
  (Google/Meta/Instagram/Facebook/TikTok/YouTube/LinkedIn), already used
  statically in `PlatformStrip`, explicitly commented as never implying
  partnership. A legacy `BrandEcosystemStrip` in `PremiumUI.tsx` uses fake
  text-glyph chips (Apple/OpenAI/Gemini/etc.) — not real logos, not used on
  any marketing route, out of scope (protected system).
- **Confirmed genuinely absent, site-wide**: custom cursor, page/route
  loader or preloader, chromatic aberration, aurora button, wave-field,
  bokeh, `document.startViewTransition`, any `loading.tsx`/`template.tsx`
  route files. One dead/unused CSS class `.cinematic-aurora` exists in
  `globals.css` (ambient bg gradient, not a button, not applied by any
  component today).
- `AnimatedSection.tsx` uses the LESS SAFE reduced-motion pattern
  (branches `initial`/`whileInView` props directly on `useReducedMotion()`)
  vs. the correct pattern in `MarketingReveal` (only branches `transition`
  timing). This is the exact root cause pattern of a previously-fixed
  hydration error #418 elsewhere in this codebase. Needs reconciling.
- `content.contact` (phone, whatsappNumber, email, address, mapsEmbedUrl)
  and `content.socials` are the only real channel data available for any
  contact-dock work. `SocialLinks.tsx` already enforces "real data only"
  via `isRealProfileUrl()` — follow the same pattern for any new dock.
- `Shell.tsx`'s `<main>` has `overflow: hidden` (required for decorative
  bg layers) which silently breaks real CSS `position: sticky` on any
  descendant — already worked around once via the fake-pin transform
  pattern in Hero. A prior attempt at a scroll-jacked pinned 3D MacBook
  stage was removed for exactly this reason (see code comment in
  `DeviceShowcase.tsx`) — do not reintroduce scroll-jacking.
- Global `@media (prefers-reduced-motion: reduce)` block in `globals.css`
  already zeroes `animation-duration`/`transition-duration` broadly plus a
  specific kill-list of classes — new CSS animation classes should be added
  to that kill-list explicitly rather than relying on the blanket rule
  alone (the blanket rule sets duration to 0.01ms, not `none`, which still
  fires one animation frame/iteration — matters for anything with a
  non-trivial single-frame visual jump).

## Reference decisions (all 21, final)

| # | File | Decision | Rationale |
|---|------|----------|-----------|
| 00 | BASLA-BURADAN | N/A (index) | meta file |
| 01 | Kullanilan-Skiller | N/A (index) | meta file |
| 01 | aperture-loader | **REJECT** | Full-page GSAP+SVG loader would delay first paint on a content/SEO-driven site (`force-dynamic`); violates performance > spectacle priority. No loading.tsx exists today; not adding one. |
| 02 | hero-scroll-scrub-intro | **USE (already implemented)** | `MacBookEcosystem.tsx` already delivers this at high quality. No rewrite. |
| 03 | scroll-hint | **ADAPT** | Cheap, low-risk, real gap — add subtle idle scroll-hint to Hero, CSS/framer-motion only, reduced-motion safe. |
| 04 | cinematic-slider | **REJECT** | Needs real projects; none exist. |
| 05 | chromatic-aberration-baslik | **ADAPT** | Short (<300ms), one-time accent on Hero headline entrance only, never persistent, per mission's own explicit constraint. |
| 06 | project-wheel-3d-silindir | **REJECT** | Needs real projects; none exist. |
| 07 | projects-preview-hover-kartlar | **MERGE → Services** | Technique (hover preview) retargeted to real Services cards, not fabricated projects. Hover never required (existing cards already fully usable without it). |
| 08 | service-explorer | **ADAPT** | Apply an explorer-style richer interaction to the two "featured" Services cards, desktop only; mobile keeps simple stacked cards. |
| 09 | service-carousel-yatay-pan | **ADAPT, mobile-only, CSS scroll-snap** | Natural touch swipe via `overflow-x` + `scroll-snap-type`, no JS/scroll-hijack, satisfies mission's "mobile must have natural swipe" rule. |
| 10 | brand-marquee-logo-serit | **ADAPT (real platform icons only)** | No real client logos exist — convert `PlatformStrip`'s static row into a seamless marquee using the SAME real platform icons already in use, with a static-grid `prefers-reduced-motion` fallback. Never implies partnership (matches existing `PlatformIcons.tsx` disclaimer). |
| 11 | bokeh-alan-derinligi | **ADAPT, desktop/tablet only** | Subtle CSS-only depth layer behind Hero, no canvas. Disabled on mobile + reduced-motion. |
| 12 | cursor-glow-kuyruklu-yildiz | **ADAPT (merged with #14)** | Single lightweight pointer-glow, not a comet/particle trail (mission explicitly warns against "toy particle rain"). |
| 13 | wave-field-su-dalgasi | **SIMPLIFY (CSS gradient approximation)** | True canvas wave simulation too expensive; approximate with an animated CSS gradient in the final CTA/contact background, desktop/tablet only. |
| 14 | custom-cursor | **ADAPT (merged with #12)** | Desktop pointer-fine + hover-hover only; fully disabled on touch; never breaks input/button/link/selection. |
| 15 | floating-contact-dock | **ADAPT (real channels only)** | Elevate `Shell.tsx`'s existing single WhatsApp button into a small real-channel dock (WhatsApp + tel: if real phone present), never fabricate channels. |
| 16 | aurora-button | **ADAPT** | Apply aurora glow accent to primary CTA buttons only (`MarketingButton` primary variant / FinalCtaSection), not global. |
| 17 | nav-menu | **ADAPT** | Animated active-link underline/pill (framer-motion `layoutId`) on desktop nav. Secret 5-tap logo logic in `Header.tsx` preserved byte-for-byte. |
| 18 | route-transition-rack-focus | **SIMPLIFY (CSS-only via `template.tsx`)** | Full JS rack-focus transition too high-risk (would need wrapping every `Link`, risks back/forward + hydration). Use Next's native `template.tsx` remount mechanism with a short CSS fade, zero JS routing risk. |
| 19 | scroll-reveal-blur | **USE (already implemented) + fix inconsistency** | `MarketingReveal` already correct; fix `AnimatedSection.tsx` to use the same safe transition-only reduced-motion branching. |

## Implementation stages (Section 31 breakdown) — status

1. Reference audit — **DONE**
2. Current-site audit — **DONE**
3. Motion architecture decision — **DONE** (this file)
4. Shared motion infrastructure — **DONE** (`src/components/public/motion/{CursorGlow,ScrollHint,RouteFade}.tsx`, `ContactDock.tsx`, CSS primitives appended to `globals.css`)
5. Hero (scroll-hint, chromatic accent, bokeh) — **DONE**
6. Major scroll experience — **N/A, already excellent, no change made**
7. Services (mobile swipe-row) — **DONE** (mobile-only CSS scroll-snap; desktop `service-explorer`/hover-preview upgrade deliberately deferred — current cards already fully functional/accessible, revisit only if visual QA shows a real gap)
8. Navigation (sliding pill active/hover indicator) — **DONE**
9. Supporting effects (cursor glow, platform marquee, aurora button, wave bg, contact dock, route fade) — **DONE**
10. Mobile adaptation — bokeh/wave-bg hidden <640px via CSS, cursor glow hard-disabled off pointer:fine+hover:hover, swipe-row mobile-only — **DONE, built into each stage above**
11. Accessibility/reduced-motion — every new looping animation added to the `@media (prefers-reduced-motion: reduce)` kill-list in globals.css; all new JS motion (nav pill spring, hero pin) only branches `transition` timing, never element structure — **DONE, built into each stage above**; still needs a real browser reduced-motion pass in visual QA (stage 13)
12. Performance optimization — no new client bundle heavy deps; CursorGlow/RouteFade/ScrollHint are small, rAF-throttled where relevant, disabled when not applicable — **DONE by construction**; formal Lighthouse-style check deferred to visual QA
13. Visual QA (Playwright, manual screenshot pass) — **DONE**: desktop/tablet/mobile/reduced-motion screenshots of homepage, `/hizmetler`, nav hover, mobile menu, mobile services swipe row, footer, contact dock all visually correct; zero console/hydration errors across all 8 marketing routes checked live.
14. Regression — **DONE**: secret 5-tap logo trigger + Ctrl/Meta+Shift+1,1,2 keyboard trigger both still work exactly as before (test suite), `/hk-admin`, `/musteri-paneli`, `/login`, `/giris` all still resolve/redirect correctly, WhatsApp/contact/nav links all still correct.
15. Build/tests — **DONE**: `tsc --noEmit` clean, `npm run lint` clean (0 errors, 2 pre-existing unrelated `<img>` warnings), `npm run build` clean (all routes incl. `/hk-admin/*`, `/musteri-paneli` compiled), `npm run test:unit` 312/312 passed. E2E: `homepage-redesign`, `public-site`, `public-site-private-login`, `hydration-regression`, `responsive`, `secret-access-keyboard-trigger` specs — 48/48 (desktop-chromium) + 65/65 (mobile-chromium) passed under single-worker execution (0 real failures). Note: the same specs under Playwright's default parallel workers showed 20-38 flaky failures, but every single one was `TimeoutError: page.goto: Timeout 15000ms exceeded` against the local `next start` server under concurrent load — a different random subset failed each parallel run, and zero assertion failures ever occurred — conclusively local test-infra flakiness (server capacity under this sandbox), not a real regression from this session's changes. Documented honestly here per Section 25/30's "distinguish pre-existing/infra failures from real ones" instruction.
16. Refinement pass — **DONE**: fixed one real issue found during this work (an ESLint `react-hooks/set-state-in-effect` error in `CursorGlow.tsx`, resolved by matching the existing codebase convention already used in `Hero()`'s `pinEligible` effect — wrap the setState call in a named function invoked once, rather than a bare top-level `setState()` call).
17. Commit/push — **DONE**: commit `7c4f44b` on `main`, pushed to `origin/main`.
18. Deployment — **DONE**: Vercel deployment `dpl_6oefmZZr6GRJcjwVWdg8UfhQhSe7` reached `READY`, aliased to `www.hkdijital.com.tr` (+ `hkdijital.com.tr`, `ai.hkdijital.com.tr`).
19. Production verification — **DONE**: live smoke test against `https://www.hkdijital.com.tr` — `/` (desktop+mobile) and `/hizmetler` all HTTP 200, zero console/page errors, screenshots visually match the local build exactly (bokeh, chromatic accent, marquee, nav pill, contact dock all rendering correctly in production).

## TASK STATUS: COMPLETE

All 20 Definition of Done items satisfied. See the final report delivered
to the user in this session for the full mandated-template summary.

## Files changed so far

New: `src/components/public/ContactDock.tsx`, `src/components/public/motion/CursorGlow.tsx`, `src/components/public/motion/ScrollHint.tsx`, `src/components/public/motion/RouteFade.tsx` (plus this checkpoint and the 21 reference docs).
Modified: `src/app/globals.css` (new CSS section appended, nothing existing changed), `src/components/public/Header.tsx` (sliding nav pill + aurora CTA, secret-tap logic untouched), `src/components/public/Shell.tsx` (CursorGlow + RouteFade + ContactDock wiring, old single WhatsApp `<a>` removed in favor of ContactDock), `src/components/public/HomepageExperience.tsx` (Hero bokeh/scroll-hint/chroma/aurora, PlatformStrip→marquee, FinalCta wave-bg+aurora, Services mobile swipe-row), `src/components/public/marketing/MarketingUI.tsx` (added optional `aurora` prop to `MarketingButton`, backwards compatible default `false`).
Not touched: `AnimatedSection.tsx` (confirmed dead/unused — zero import sites anywhere in `src/` — left as-is, no live hydration risk since never rendered; noted but deprioritized).

## Dependencies

No new dependencies added or removed. `package.json`/`package-lock.json` untouched.

## NEXT EXACT ACTION

Stage exactly the task-relevant files (`git status --short` confirmed
clean — only the 5 modified files, 4 new files/dirs under
`src/components/public/`, and `docs/animation-reference/`; the unrelated
pre-existing `docs/hk-admin-el-kitabi/` must NOT be staged), commit with a
descriptive message, push to `origin main`, poll the Vercel deployment
(project `prj_IFyrpE8rviySQACK5Br0HAM7m9aI`, team
`team_gZpMnOTuao0vyx9dzbVvpdBx`) to READY, then do a final production
visual + functional smoke test against `https://www.hkdijital.com.tr`
before writing the mandated final report.
