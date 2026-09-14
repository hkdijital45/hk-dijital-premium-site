"use client";

import { useReducedMotion, motion, type MotionValue } from "framer-motion";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { BarChart3, CalendarDays } from "lucide-react";
import { FacebookMark, GoogleMark, InstagramMark, MetaMark, TikTokMark, YouTubeMark } from "../PlatformIcons";

/**
 * The homepage hero's cinematic centerpiece: a PRE-RENDERED video (the
 * MacBook itself disintegrating into flowing fiber particles, traveling,
 * coiling into a radial rosette, blooming, and resolving back into the
 * reformed device) whose timeline is scrubbed directly off SCROLL PROGRESS
 * through the hero section — never an independent autoplaying clock. The
 * parent `Hero()` (HomepageExperience.tsx) owns a tall (~200vh) section with
 * a scroll-linked "fake sticky" inner viewport and a `useScroll` hook
 * targeting it; the resulting 0..1 `scrollYProgress` MotionValue is passed
 * in as `progress` and mapped directly to `video.currentTime`.
 *
 * The video was produced by an offline, deterministic Canvas2D renderer
 * (progress in, frame out via canvas.toDataURL — NOT page.screenshot, which
 * flattens alpha) driven frame-by-frame, sampling real pixels from the
 * previously-approved MacBook mockup bitmap so the strand material is
 * genuinely the device's own material eroding away (a destination-out mask
 * punches holes in the laptop bitmap in exact sync with each particle's
 * emission) — not a decorative particle system spawned near a fading
 * laptop. Encoded as VP9/yuva420p WebM (true alpha) with an H.264 MP4
 * fallback composited onto a solid background, both with a `-g 6` keyframe
 * interval so `currentTime` seeks stay smooth under scroll-scrubbing
 * without the multi-times-larger size of an all-keyframe encode.
 *
 * Reduced motion: the JSX this component renders is a FIXED, unconditional
 * structure for every visitor — video and poster `<img>` both always
 * present in the DOM (never branched on useReducedMotion(), which can
 * resolve synchronously on the client's very first render and so disagrees
 * with server-rendered HTML if branched on -> hydration error #418,
 * root-caused and fixed sitewide already). All behavioral differences
 * (which layer is visible, whether the video ever loads/scrubs, the
 * mobile entrance) are applied imperatively post-mount via
 * `useIsoLayoutEffect` mutating DOM styles/attributes directly, so a
 * reduced-motion visitor's very first paint already shows the settled
 * poster with zero flash of any pre-animation state, and the video is
 * never even told to fetch its bytes.
 *
 * Mobile deliberately never scrubs the video at all — a bounded
 * sticky-pinned scroll choreography on a small touch viewport reads as a
 * "scroll trap," not a website, and a multi-MB video has no business
 * downloading on a likely-metered small-screen connection. Below the
 * tablet breakpoint this component shows the poster (the fully-reformed
 * final frame) plus one short, lightweight CSS-transition entrance for the
 * badges shortly after mount. The parent's own section markup also drops
 * the tall/sticky treatment below that same breakpoint via CSS.
 */

const VIDEO_WEBM = "/cinematic/hero-transform.webm";
const VIDEO_MP4 = "/cinematic/hero-transform.mp4";
const POSTER = "/cinematic/hero-poster.png";

// The video's own internal timeline reserves its final stretch for the
// bloom hold -> reveal (see the offline renderer's P_BLOOM_HOLD_END, tuned
// against the reference's own bloom/reveal timing). Badges arrive from
// that same point in SCROLL progress, so the platform/result ecosystem
// visibly emerges from the video's own payoff moment rather than fading in
// on an unrelated schedule.
const ARRIVAL_START = 0.881;
const ARRIVAL_STAGGER = 0.013;
const ARRIVAL_DURATION = 0.085;

// Client-only alias so the one-shot style-setting effect applies before
// first paint (avoiding any reduced-motion flash) without ever calling the
// real useLayoutEffect during server rendering.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }
function easeOutCubic(t: number) { return 1 - Math.pow(1 - t, 3); }

type BadgeState = { x: number; y: number; scale: number; opacity: number };
function badgeStateAt(t: number, delay: number, duration: number, from: { x: number; y: number }): BadgeState {
  if (t <= delay) return { x: from.x, y: from.y, scale: 0.25, opacity: 0 };
  const localT = clamp01((t - delay) / duration);
  const e = easeOutCubic(localT);
  return { x: lerp(from.x, 0, e), y: lerp(from.y, 0, e), scale: lerp(0.25, 1, e), opacity: lerp(0, 1, e) };
}
function applyBadgeStyle(el: HTMLDivElement, t: number, delay: number, duration: number, from: { x: number; y: number }) {
  const s = badgeStateAt(t, delay, duration, from);
  el.style.opacity = String(s.opacity);
  el.style.transform = `translate(${s.x}px, ${s.y}px) scale(${s.scale})`;
}

type EcoNode = {
  key: string;
  render: () => ReactNode;
  posClass: string; // final resting position (Tailwind, absolute)
  flyFrom: { x: number; y: number }; // px offset the node animates FROM (biased back toward the MacBook center) on arrival
};

const platformNodes: EcoNode[] = [
  { key: "google", render: () => <GoogleMark className="h-full w-full" />, posClass: "-left-7 top-4", flyFrom: { x: 130, y: 90 } },
  { key: "meta", render: () => <MetaMark className="h-full w-full" />, posClass: "-right-5 top-14", flyFrom: { x: -130, y: 70 } },
  { key: "instagram", render: () => <InstagramMark className="h-full w-full" />, posClass: "-bottom-4 left-12", flyFrom: { x: 55, y: -130 } },
  { key: "facebook", render: () => <FacebookMark className="h-full w-full" />, posClass: "-right-7 bottom-10", flyFrom: { x: -95, y: -105 } },
  { key: "tiktok", render: () => <TikTokMark className="h-full w-full" />, posClass: "left-1/2 -top-9 -translate-x-1/2", flyFrom: { x: 0, y: 130 } },
  { key: "youtube", render: () => <YouTubeMark className="h-full w-full" />, posClass: "-left-10 bottom-24", flyFrom: { x: 140, y: -40 } }
];

// Positions verified against the real .macbook-mockup-screen bounding box on
// a 390px viewport (measured via Playwright) — top badges must clear the
// screen's top edge entirely, not just look clear at desktop width.
const mobilePlatformNodes: EcoNode[] = [
  { key: "google-m", render: () => <GoogleMark className="h-full w-full" />, posClass: "-left-2 -top-3", flyFrom: { x: 90, y: 70 } },
  { key: "meta-m", render: () => <MetaMark className="h-full w-full" />, posClass: "-right-4 -top-4", flyFrom: { x: -90, y: 55 } },
  { key: "instagram-m", render: () => <InstagramMark className="h-full w-full" />, posClass: "-bottom-2 left-8", flyFrom: { x: 45, y: -90 } }
];

const dataCardNodes: Array<EcoNode & { label: string; sub: string; Icon: typeof BarChart3 }> = [
  { key: "analytics", Icon: BarChart3, label: "Performans", sub: "ROAS 5.4x", posClass: "right-[-2.5rem] top-1/2 -translate-y-1/2", flyFrom: { x: -150, y: 0 }, render: () => null },
  { key: "calendar", Icon: CalendarDays, label: "İçerik Takvimi", sub: "Bu hafta 4 gönderi", posClass: "left-[-2.75rem] top-1/2 -translate-y-1/2", flyFrom: { x: 150, y: 0 }, render: () => null }
];

function EcoBadge({ node, domRef, displayClass }: { node: EcoNode; domRef: (el: HTMLDivElement | null) => void; displayClass: string }) {
  return (
    <div
      ref={domRef}
      className={`absolute ${node.posClass} ${displayClass} place-items-center rounded-2xl border bg-white p-2.5 shadow-[0_18px_46px_rgba(15,16,36,.16)]`}
      style={{ borderColor: "var(--mk-border)", opacity: 0, transform: `translate(${node.flyFrom.x}px, ${node.flyFrom.y}px) scale(0.25)` }}
    >
      {node.render()}
    </div>
  );
}

function EcoCard({ node, domRef }: { node: EcoNode & { label: string; sub: string; Icon: typeof BarChart3 }; domRef: (el: HTMLDivElement | null) => void }) {
  return (
    <div
      ref={domRef}
      className={`absolute ${node.posClass} hidden max-w-[9.5rem] items-center gap-2.5 rounded-xl border bg-white px-3.5 py-3 shadow-[0_18px_46px_rgba(15,16,36,.14)] lg:flex`}
      style={{ borderColor: "var(--mk-border)", opacity: 0, transform: `translate(${node.flyFrom.x}px, ${node.flyFrom.y}px) scale(0.25)` }}
    >
      <node.Icon size={16} className="shrink-0 text-[#7c3aed]" />
      <span className="min-w-0">
        <span className="block truncate text-[11px] font-black" style={{ color: "var(--mk-ink)" }}>{node.label}</span>
        <span className="block truncate text-[10px] font-bold text-[#7c3aed]">{node.sub}</span>
      </span>
    </div>
  );
}

type Tier = "desktop" | "tablet" | "mobile";

export function MacBookEcosystem({ progress }: { progress: MotionValue<number> }) {
  const reduced = useReducedMotion();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const badgeElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const [tier, setTier] = useState<Tier | null>(null);

  useEffect(() => {
    const compute = () => setTier(window.innerWidth >= 1024 ? "desktop" : window.innerWidth >= 640 ? "tablet" : "mobile");
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  const badgeConfigs = [
    ...platformNodes.map((node, index) => ({ node, delay: ARRIVAL_START + index * ARRIVAL_STAGGER })),
    ...dataCardNodes.map((node, index) => ({ node, delay: ARRIVAL_START + (platformNodes.length + index) * ARRIVAL_STAGGER })),
    ...mobilePlatformNodes.map((node, index) => ({ node, delay: ARRIVAL_START + index * ARRIVAL_STAGGER }))
  ];

  useIsoLayoutEffect(() => {
    if (!tier) return;
    const video = videoRef.current;
    const wrapper = wrapperRef.current;
    if (!video || !wrapper) return;

    const isReduced = !!reduced;

    const applyBadges = (t: number) => {
      for (const { node, delay } of badgeConfigs) {
        const el = badgeElsRef.current.get(node.key);
        if (el) applyBadgeStyle(el, t, delay, ARRIVAL_DURATION, node.flyFrom);
      }
    };

    if (isReduced) {
      // Reduced motion: poster only, forever. The video is never told to
      // fetch or play — zero ongoing cost, and (via useIsoLayoutEffect) the
      // very first paint already shows the fully settled ecosystem.
      video.style.opacity = "0";
      applyBadges(1);
      return;
    }

    if (tier === "mobile") {
      // Mobile: poster + one short CSS-driven entrance, no video download,
      // no scroll-progress model at all.
      video.style.opacity = "0";
      for (const { node, delay } of badgeConfigs) {
        const el = badgeElsRef.current.get(node.key);
        if (el) el.style.transition = `opacity .5s cubic-bezier(.16,1,.3,1) ${Math.min(delay, 0.3)}s, transform .5s cubic-bezier(.16,1,.3,1) ${Math.min(delay, 0.3)}s`;
      }
      applyBadges(0);
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => applyBadges(1)));
      return () => cancelAnimationFrame(raf);
    }

    // Desktop/tablet: fetch the video now (default markup ships
    // preload="none" so mobile/reduced-motion visitors never request it),
    // then scroll-scrub `currentTime` off the SAME `progress` MotionValue
    // the parent's useScroll owns — one source of truth, no independent
    // clock. Sampled via a lightweight rAF loop (native scroll events don't
    // fire densely enough for buttery seeks) and paused whenever the hero
    // has scrolled out of view.
    for (const { node } of badgeConfigs) {
      const el = badgeElsRef.current.get(node.key);
      if (el) el.style.transition = "none";
    }

    let metadataReady = video.readyState >= 1;
    const onLoadedMetadata = () => { metadataReady = true; };
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.preload = "auto";
    video.load();

    let visible = true;
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { threshold: 0.02 });
    io.observe(wrapper);

    let fadedIn = false;
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!visible || !metadataReady) return;
      if (!fadedIn) { video.style.opacity = "1"; fadedIn = true; }
      const t = clamp01(progress.get());
      const duration = video.duration || 9.167;
      const target = t * duration;
      if (Math.abs(video.currentTime - target) > 0.008) video.currentTime = target;
      applyBadges(t);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); io.disconnect(); video.removeEventListener("loadedmetadata", onLoadedMetadata); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier, reduced]);

  return (
    <div ref={wrapperRef} className="relative mx-auto w-full max-w-lg py-6">
      {/* Ambient glow: dim at rest, rises through the transformation, settles to a soft ambient wash. Framer's own MotionConfig reducedMotion="user" collapses this to its last keyframe for reduced-motion users — safe, since it's driven declaratively, not by our own scroll-progress engine. */}
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(124,58,237,.16), transparent 65%)" }}
        aria-hidden="true"
        initial={{ opacity: 0.2, scale: 0.8 }}
        animate={{ opacity: [0.2, 0.24, 0.42, 0.9, 0.48], scale: [0.8, 0.85, 1.0, 1.35, 1.05] }}
        transition={{ duration: 1.6, times: [0, 0.12, 0.29, 0.881, 1], ease: "easeInOut" }}
      />

      {/* The subject itself: a fixed-aspect box holding the poster (always visible, the safe default) and the scroll-scrubbed video (crossfaded in imperatively once loaded, desktop/tablet, non-reduced-motion only). Identical DOM for every visitor — only opacity/preload are ever mutated post-mount. */}
      <div className="relative w-full overflow-hidden rounded-[20px]" style={{ aspectRatio: "1300 / 1100" }}>
        <img src={POSTER} alt="HK Dijital dijital pazarlama gösterge paneli" className="hero-cinematic-poster absolute inset-0 h-full w-full object-contain" />
        <video
          ref={videoRef}
          muted
          playsInline
          preload="none"
          poster={POSTER}
          aria-hidden="true"
          className="hero-cinematic-video absolute inset-0 h-full w-full object-contain"
          style={{ opacity: 0, transition: "opacity .5s ease" }}
        >
          <source src={VIDEO_WEBM} type="video/webm" />
          <source src={VIDEO_MP4} type="video/mp4" />
        </video>
      </div>

      {/* What the bloom resolves into: the real 6-platform network + result cards (desktop/tablet), emerging from the video's own reveal rather than fading in independently. */}
      {platformNodes.map((node) => (
        <EcoBadge key={node.key} node={node} domRef={(el) => { if (el) badgeElsRef.current.set(node.key, el); else badgeElsRef.current.delete(node.key); }} displayClass="hidden md:grid size-12" />
      ))}
      {dataCardNodes.map((node) => (
        <EcoCard key={node.key} node={node} domRef={(el) => { if (el) badgeElsRef.current.set(node.key, el); else badgeElsRef.current.delete(node.key); }} />
      ))}

      {/* Mobile: same grammar, compact — 3 marks only, no data cards, no video, so the hero stays light there. */}
      {mobilePlatformNodes.map((node) => (
        <EcoBadge key={node.key} node={node} domRef={(el) => { if (el) badgeElsRef.current.set(node.key, el); else badgeElsRef.current.delete(node.key); }} displayClass="grid md:hidden size-11" />
      ))}
    </div>
  );
}
