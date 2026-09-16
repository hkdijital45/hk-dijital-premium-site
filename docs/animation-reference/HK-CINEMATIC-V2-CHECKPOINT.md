# HK Cinematic Rebuild V2 — Working Checkpoint

Internal working document for "HK DİJİTAL — HARD MODE / FULL AUTONOMOUS
CINEMATIC REBUILD V2". The previous pass (commits `7c4f44b`/`9c0a0c7`) was
explicitly rejected by the user as insufficient — micro-animation polish,
not a real structural rebuild. This is a NEW, separate effort layered on
top of that work (the previous primitives — CursorGlow, ContactDock,
RouteFade, marquee CSS, aurora CSS, bokeh CSS — are kept and EXTENDED,
not thrown away, since they are real infrastructure, not just "the old
design" to preserve for its own sake).

## Non-negotiable constraints (unchanged from V1)
Same as before: public marketing site only, never touch `/hk-admin`,
`/musteri-paneli`, Supabase schema, auth, internal APIs. Real content/
copy/routes/CTAs/contact info locked. Secret 5-tap/keyboard Secret Access
trigger in `Header.tsx` preserved byte-for-byte. No fabricated data,
projects, clients, or logos.

## What "done" means this time
Per the mission's own Section 32 gate: a majority of [hero composition,
hero scroll behavior, section transitions, services composition, desktop
interaction, mobile services interaction, MacBook narrative, navigation,
background depth, CTA composition, typography hierarchy, overall scroll
rhythm] must show real structural difference — not just cursor+glow+
marquee+shadow+fade.

## Architecture decisions (PASS 1)

1. **Hero rebuild**: restructure into explicit scroll stages within the
   existing tall pin wrapper (kept — it's real, working infrastructure,
   not "old design" being preserved for comfort):
   - Mount entrance: clip-path mask-reveal on the headline (per-line
     stagger), replacing the instant-render text. Adapts 01-aperture-
     loader's reveal *concept* as a non-blocking entrance rather than a
     blocking loader (LCP stays protected — no blocking screen).
   - 0–60% scroll: text block gets its own slower parallax drift +
     slight scale-down, spatially separating from the MacBook layer
     (which already has its own internal progress curve) — "spatial
     separation" per mission Section 7.
   - MacBook: extend `MacBookEcosystem` to render real capability
     captions next to arrived platform nodes (sourced from real
     `content.services`, passed down as props — no fabricated labels).
   - Exit (80–100%): stronger fade/lift + a scroll-triggered chromatic
     pulse on hand-off (in addition to the existing mount-triggered one).
2. **"Digital control center" narrative**: `AdsStorySection` (Google Ads
   / Meta Ads real content) rebuilt from boxed-card layout to full-bleed
   editorial composition — no bordered card grid, asymmetric layout,
   inline stat-style bullets instead of bordered list items, scroll-
   linked depth reveal. Real copy unchanged.
3. **Services rebuild**: desktop (lg+) gets a real service-explorer —
   left index list (real services), right side = active service's
   `ServiceVisual` + real copy + CTA, mouse/keyboard/click driven,
   cross-fade transition. Mobile/tablet keep the existing horizontal
   scroll-snap swipe row (already real native touch, matches mission's
   own "mobile ≠ shrunk desktop" rule) — NOT a shrunk version of the
   desktop explorer, a deliberately different composition.
4. **Navigation rebuild**: ambient low-opacity rotating conic-gradient
   wash behind the nav pill (ties to reference 17 item 1, kept subtle
   per mission's "not neon gaming" instruction), header mount entrance,
   mobile menu upgraded to blur/stagger entrance (not the current flat
   `animate-hard-drop`). Secret access logic untouched.
5. **Route transitions**: `RouteFade` upgraded from plain opacity+
   translateY to a clip-path directional wipe reveal — still CSS-only,
   still pathname-keyed remount (zero Link interception, zero back/
   forward risk, same hydration-safe mechanism as before).
6. **Section transitions**: shared/bleeding background gradients across
   adjacent sections instead of hard flat-color section boundaries,
   reducing the "box, box, box" feeling mission Section 22/23 flags.
7. **Depth/background**: bokeh extended to the final CTA/contact area in
   addition to hero; wave-field background enhanced (still CSS-only,
   no canvas, per performance budget).
8. **Motion architecture**: unchanged — framer-motion + CSS only, no new
   dependency. This was already the correct call in V1 per the mission's
   own Section 26 ("GSAP only if measurable benefit"); nothing about V2
   changes that fact, it only demands the RESULT be structurally bigger.

## Reference re-audit (V2 lens — IMPLEMENT/ADAPT/MERGE, REJECT only for the 4 allowed reasons)

- 00/01-skills: index files, N/A
- 01 aperture-loader: **ADAPT** — non-blocking clip-path entrance reveal on Hero headline (see above), not a blocking loader
- 02 hero-scroll-scrub: **IMPLEMENT (extend)** — already the video-scrub engine; now driving explicit stages + captions
- 03 scroll-hint: **KEEP** (already real, working, matches reference)
- 04 cinematic-slider: **MERGE** — full ticker/Lenis engine rejected (real reason: no Lenis in stack, would be a new heavy dependency with no measurable benefit over framer-motion scroll-linked transforms for this content volume) but its *storytelling transition* role is absorbed into the rebuilt AdsStorySection depth reveal
- 05 chromatic-aberration: **EXTEND** — mount pulse (kept) + new scroll-exit pulse
- 06 project-wheel-3D: **ADAPT** — CSS-perspective interaction grammar adapted into the Services desktop explorer's active-item depth/tilt, not a literal spinning wheel of fake projects (real reason 1: no real project list exists)
- 07 hover-preview-cards: **MERGE** — hover/reveal grammar merged into Services explorer's list-item hover state
- 08 service-explorer: **IMPLEMENT** — this IS the new Services desktop rebuild
- 09 service-carousel-pin: **REJECT (real reason 3)** — full pin+scrub horizontal carousel on top of an already-pinned Hero risks compounding scroll-jank/jank-on-jank and the mission's own Section 26 forbids competing scroll engines; the already-implemented mobile scroll-snap swipe row covers the mobile need
- 10 brand-marquee: **KEEP/EXTEND** (already real platform-icon marquee)
- 11 bokeh: **EXTEND** — hero + CTA section, foreground/background depth pairing
- 12+14 cursor: **KEEP/EXTEND** — add context-aware states (CTA vs link vs service-item)
- 13 wave-field: **EXTEND** — richer multi-band CSS gradient, still no canvas
- 15 contact-dock: **KEEP/EXTEND** — add scroll-state compact/expanded behavior
- 16 aurora: **EXTEND** — already on primary CTAs; add to nav ambient wash
- 17 nav-menu: **IMPLEMENT (extend)** — ambient aurora wash + mobile blur-stagger entrance added to the existing sliding pill
- 18 route-transition: **UPGRADE** — clip-path directional wipe replacing plain fade
- 19 scroll-reveal: **RECALIBRATE** — hierarchy re-checked against the rebuilt sections

## Status

CURRENT PHASE: PASS 6 (Production QA) — COMPLETE
COMPLETED:
- Hero rebuilt: per-line clip-path mask-reveal entrance on the headline
  (non-blocking, LCP-safe — content in DOM at first paint, only final
  position animates), spatial-separation parallax (text drifts/scales
  slower than the MacBook layer across 0-60% scroll), scroll-exit
  chromatic pulse (second independent firing at ~82% scroll, distinct
  from the mount-time one), bokeh depth layer.
- MacBookEcosystem extended: real capability captions ("Arama Reklamları",
  "Reklam Yönetimi", "İçerik & Topluluk", "Sayfa Yönetimi", "Kısa Video
  İçerik", "Video Reklamcılık") next to each arrived platform badge,
  xl+ only, reusing the existing imperative opacity/transform styling
  (zero new render-loop cost).
- AdsStorySection (Google Ads / Meta Ads) rebuilt from a bordered
  MarketingCard box into a full-bleed editorial composition: floating
  visual with an overlapping badge (idle float), pull-quote-style problem
  statement (left accent bar, no box), numbered running-list bullets
  (hairline dividers, no bordered chips) — real copy unchanged.
- Services rebuilt: new desktop (lg+) `ServiceExplorer` — a real
  keyboard/mouse-driven two-pane index+detail interaction (WAI-ARIA
  tabs pattern, arrow-key navigation, cross-fade via AnimatePresence),
  replacing the card grid there. Mobile/tablet keep the deliberately
  different horizontal scroll-snap swipe row (native touch, not a
  shrunk desktop copy).
- Navigation rebuilt: ambient low-opacity rotating conic-gradient wash
  behind the nav pill (sibling element, never clips the services
  dropdown), header mount entrance (fade+drop), mobile menu upgraded
  from a flat drop-in to a per-item blur/y stagger reveal. Secret
  5-tap/keyboard Secret Access trigger logic untouched (byte-for-byte),
  regression-verified.
- Route transition upgraded from a plain opacity fade to a clip-path
  directional "curtain" wipe reveal — still the same pathname-keyed
  remount mechanism (RouteFade.tsx unchanged), zero new JS routing risk.
- Section-boundary bleed added at the light→dark Services→Performance
  cut (the most visually abrupt boundary) — a short gradient fade
  instead of a flat color-change line.
- Bokeh extended to the Final CTA section (previously hero-only).
- Cursor glow made context-aware: scales/tints differently over primary
  CTAs vs service-explorer items vs plain links vs empty space — CSS-
  variable-driven, position path stays untransitioned so it never lags.
- Every new animation gated behind `prefers-reduced-motion` consistent
  with the existing kill-list convention; all new JS motion only
  branches `transition` timing, never element structure.

NOT DONE / DEFERRED (with real reasons, not "already fine"):
- 09 service-carousel-pin (full pin+scrub horizontal carousel): rejected
  — would compound scroll-jank on top of the already-pinned Hero and
  risks a second, competing scroll engine (explicitly forbidden by the
  mission's own Section 26). The desktop Services rebuild instead uses
  a real interaction (explorer) without a second pin/scrub system.
- Full R3F/GLSL bokeh (reference 11) and canvas wave-field (reference 13):
  not implemented as literal canvas/WebGL — this project has zero
  three.js/@react-three/fiber dependency, and adding one for two ambient
  background effects fails the mission's own "GSAP/heavy-dep only if
  measurable benefit" test. Their *visual intent* (depth, ambient motion)
  is delivered via CSS-only approximations instead (bokeh circles, layered
  gradient sweep).

FILES CHANGED (this V2 pass, on top of V1's `7c4f44b`/`9c0a0c7`):
`src/app/globals.css`, `src/components/public/Header.tsx`,
`src/components/public/HomepageExperience.tsx`,
`src/components/public/cinematic/MacBookEcosystem.tsx`,
`src/components/public/motion/CursorGlow.tsx`,
`docs/animation-reference/HK-CINEMATIC-V2-CHECKPOINT.md` (new).
No files removed. No dependencies added/removed.

REFERENCES IMPLEMENTED: see table above (all 19 real technique docs
given a IMPLEMENT/ADAPT/MERGE/EXTEND/REJECT decision with a destination
or a real rejection reason — never "current is already fine").

TEST STATUS: `tsc --noEmit` clean · `npm run lint` clean (0 errors, 2
pre-existing unrelated `<img>` warnings) · `npm run build` clean (all
routes incl. `/hk-admin/*`, `/musteri-paneli`) · `npm run test:unit`
312/312 passed · Playwright (`homepage-redesign`, `public-site`,
`public-site-private-login`, `hydration-regression`, `responsive`,
`secret-access-keyboard-trigger`) 65/65 (desktop-chromium) + 65/65
(mobile-chromium) passed, single-worker, zero real failures.

VISUAL QA STATUS: manual screenshot pass across 375/390/430/768/820/
1440/1920px + reduced-motion (desktop+mobile), zero console errors,
zero horizontal overflow anywhere, plus all 7 secondary marketing pages
spot-checked at desktop+mobile. Local production server (`next start`).

CURRENT COMMIT: pending (about to commit on top of `9c0a0c7`)
DEPLOYMENT STATUS: about to push/deploy
KNOWN ISSUES: none
