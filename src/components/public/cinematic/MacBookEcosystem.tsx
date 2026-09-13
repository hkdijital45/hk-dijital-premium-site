"use client";

import { useReducedMotion, motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { BarChart3, CalendarDays } from "lucide-react";
import { MacBookMockup, MacBookScreenChip } from "../MacBookMockup";
import { FacebookMark, GoogleMark, InstagramMark, MetaMark, TikTokMark, YouTubeMark } from "../PlatformIcons";

/**
 * The homepage hero's cinematic centerpiece: a calm MacBook that "activates,"
 * dissolves into flowing data strands, and blooms into the real HK Dijital
 * ecosystem (Google/Meta/Instagram/Facebook/TikTok/YouTube + two result
 * cards) — one continuous, mount-triggered sequence (not scroll-linked, so
 * it can never repeat the old scroll-jacked-stage bug this codebase already
 * fixed once). Motion grammar: calm -> activation -> transformation ->
 * flowing strands -> radial bloom -> settle, over ~8s, matching the
 * reference video's own face -> strand-explosion -> starburst -> reveal arc.
 *
 * Reduced motion: every motion.* element below always declares the SAME
 * `initial`/`animate` regardless of prefers-reduced-motion — never branched
 * on a `reduced` boolean read at render time. HomepageExperience already
 * wraps the whole page in <MotionConfig reducedMotion="user">, which
 * collapses these transitions to their instant final state for
 * reduced-motion users automatically. Branching the JSX/initial-prop VALUES
 * on useReducedMotion() here directly caused a real bug during development:
 * that hook resolves synchronously to `true` in a reduced-motion browser
 * context but the server has no matchMedia, so the very first client render
 * disagreed with the server-rendered HTML -> React hydration error #418 ->
 * the whole #hero subtree got torn down and remounted. Do not reintroduce
 * that pattern here.
 */

// ---- Timeline (seconds) — mirrors the reference video's own beat. ----
const CALM_END = 1.5;
const ACTIVATE_END = 2.5;
const TRANSFORM_END = 4.0;
const FLOW_END = 5.5;
const BLOOM_END = 7.0;
const SETTLE_END = 8.0;
const T = (s: number) => s / SETTLE_END;

// A cubic bezier from the MacBook screen's center to a node's landing spot,
// shared by the visible connector line AND the traveling spark (sampled
// directly from these same four points, so the spark can never drift off
// the line it's supposedly following).
type Curve = [[number, number], [number, number], [number, number], [number, number]];

function curveToPath([[x0, y0], [x1, y1], [x2, y2], [x3, y3]]: Curve): string {
  return `M${x0},${y0} C${x1},${y1} ${x2},${y2} ${x3},${y3}`;
}

function pointOnCubic([[x0, y0], [x1, y1], [x2, y2], [x3, y3]]: Curve, t: number): [number, number] {
  const mt = 1 - t;
  const x = mt * mt * mt * x0 + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t * x3;
  const y = mt * mt * mt * y0 + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t * y3;
  return [x, y];
}

// MotionConfig reducedMotion="user" (wrapping the whole homepage) zeroes
// animation DURATION for reduced-motion users but was observed to still
// honor an explicit `delay` — meaning a naive 8s-delayed entrance would
// still make reduced-motion visitors wait out that same ~8s before
// "instantly" popping in, one element at a time, exactly the "complex
// entrance sequence" they're supposed to never see. This helper collapses
// both delay and duration to ~0 for reduced-motion users while leaving the
// full choreography untouched for everyone else. Safe to base on
// useReducedMotion() here specifically because it only affects the
// `transition` prop, never `initial` — the piece Next.js actually renders
// into the server HTML — so it cannot reintroduce a hydration mismatch.
function rt(reduced: boolean | null, transition: Record<string, unknown>) {
  return reduced ? { ...transition, delay: 0, duration: 0.01 } : transition;
}

type EcoNode = {
  key: string;
  render: () => ReactNode;
  posClass: string; // final resting position (Tailwind, absolute)
  curve: Curve; // in a 400x320 space, matching the SVG viewBox
  flyFrom: { x: number; y: number }; // px offset the node animates FROM (biased back toward the MacBook center) on arrival
};

const platformNodes: EcoNode[] = [
  { key: "google", render: () => <GoogleMark className="h-full w-full" />, posClass: "-left-7 top-4", curve: [[200, 150], [120, 120], [70, 90], [40, 60]], flyFrom: { x: 130, y: 90 } },
  { key: "meta", render: () => <MetaMark className="h-full w-full" />, posClass: "-right-5 top-14", curve: [[200, 150], [280, 130], [330, 100], [362, 72]], flyFrom: { x: -130, y: 70 } },
  { key: "instagram", render: () => <InstagramMark className="h-full w-full" />, posClass: "-bottom-4 left-12", curve: [[200, 150], [170, 220], [140, 260], [110, 300]], flyFrom: { x: 55, y: -130 } },
  { key: "facebook", render: () => <FacebookMark className="h-full w-full" />, posClass: "-right-7 bottom-10", curve: [[200, 150], [260, 210], [300, 250], [330, 290]], flyFrom: { x: -95, y: -105 } },
  { key: "tiktok", render: () => <TikTokMark className="h-full w-full" />, posClass: "left-1/2 -top-9 -translate-x-1/2", curve: [[200, 150], [200, 100], [200, 60], [200, 20]], flyFrom: { x: 0, y: 130 } },
  { key: "youtube", render: () => <YouTubeMark className="h-full w-full" />, posClass: "-left-10 bottom-24", curve: [[200, 150], [140, 170], [90, 190], [30, 210]], flyFrom: { x: 140, y: -40 } }
];

// Positions verified against the real .macbook-mockup-screen bounding box on
// a 390px viewport (measured via Playwright) — top badges must clear the
// screen's top edge entirely, not just look clear at desktop width.
const mobilePlatformNodes: EcoNode[] = [
  { key: "google-m", render: () => <GoogleMark className="h-full w-full" />, posClass: "-left-2 -top-3", curve: [[200, 150], [150, 120], [100, 90], [60, 60]], flyFrom: { x: 90, y: 70 } },
  { key: "meta-m", render: () => <MetaMark className="h-full w-full" />, posClass: "-right-4 -top-4", curve: [[200, 150], [260, 130], [300, 100], [320, 80]], flyFrom: { x: -90, y: 55 } },
  { key: "instagram-m", render: () => <InstagramMark className="h-full w-full" />, posClass: "-bottom-2 left-8", curve: [[200, 150], [180, 200], [160, 230], [130, 260]], flyFrom: { x: 45, y: -90 } }
];

const dataCardNodes: Array<EcoNode & { label: string; sub: string; Icon: typeof BarChart3 }> = [
  { key: "analytics", Icon: BarChart3, label: "Performans", sub: "ROAS 5.4x", posClass: "right-[-2.5rem] top-1/2 -translate-y-1/2", curve: [[200, 150], [260, 150], [320, 150], [380, 150]], flyFrom: { x: -150, y: 0 }, render: () => null },
  { key: "calendar", Icon: CalendarDays, label: "İçerik Takvimi", sub: "Bu hafta 4 gönderi", posClass: "left-[-2.75rem] top-1/2 -translate-y-1/2", curve: [[200, 150], [140, 150], [80, 150], [20, 150]], flyFrom: { x: 150, y: 0 }, render: () => null }
];

// Flow-phase window each strand animates within — deliberately still
// mid-flight at 5.5s and only fully arrived by ~7s, so "strands flowing"
// and "network bloomed" read as two visibly different moments.
const STRAND_START = TRANSFORM_END - 0.3; // 3.7s
const STRAND_SPAN = BLOOM_END - STRAND_START; // ~3.3s
const ARRIVAL_START = FLOW_END - 0.4; // 5.1s
const ARRIVAL_STAGGER = 0.17;
const ARRIVAL_DURATION = 1.35;

function ConnectorPath({ curve, index }: { curve: Curve; index: number }) {
  const reduced = useReducedMotion();
  const d = curveToPath(curve);
  const delay = STRAND_START + index * 0.09;
  return (
    <>
      {/* Soft glow duplicate underneath the crisp line — sells "glowing strand," not just a thin fading line. */}
      <motion.path
        d={d}
        stroke="url(#hero-thread-glow)"
        strokeWidth={5}
        strokeLinecap="round"
        fill="none"
        style={{ filter: "blur(3px)" }}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: [0, 1, 1], opacity: [0, 0.5, 0.18] }}
        transition={rt(reduced, { delay, duration: STRAND_SPAN, times: [0, 0.55, 1], ease: "easeInOut" })}
      />
      <motion.path
        d={d}
        stroke="url(#hero-thread)"
        strokeWidth={1.8}
        strokeLinecap="round"
        fill="none"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: [0, 1, 1], opacity: [0, 0.95, 0.5] }}
        transition={rt(reduced, { delay, duration: STRAND_SPAN, times: [0, 0.55, 1], ease: "easeInOut" })}
      />
    </>
  );
}

function FlowSpark({ curve, index }: { curve: Curve; index: number }) {
  const reduced = useReducedMotion();
  const progress = useMotionValue(0);
  const left = useTransform(progress, (t) => `${pointOnCubic(curve, t)[0] / 4}%`);
  const top = useTransform(progress, (t) => `${pointOnCubic(curve, t)[1] / 3.2}%`);
  const opacity = useTransform(progress, [0, 0.08, 0.85, 1], [0, 1, 1, 0]);

  useEffect(() => {
    // Only gates whether the imperative travel animation runs — never
    // changes what this component renders, so it can't cause a hydration
    // mismatch (this effect only executes client-side, post-hydration).
    if (reduced) return;
    const delay = STRAND_START + index * 0.09;
    const controls = animate(progress, 1, { delay, duration: STRAND_SPAN * 0.62, ease: [0.4, 0, 0.2, 1] });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
      style={{
        left, top, opacity,
        background: "radial-gradient(circle, #fff, var(--mk-violet) 70%)",
        boxShadow: "0 0 10px 3px rgba(196,181,253,.9)"
      }}
    />
  );
}

function EcoBadge({ node, index, displayClass }: { node: EcoNode; index: number; displayClass: string }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.25, x: node.flyFrom.x, y: node.flyFrom.y }}
      animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
      transition={rt(reduced, { delay: ARRIVAL_START + index * ARRIVAL_STAGGER, duration: ARRIVAL_DURATION, ease: [0.16, 1, 0.3, 1] })}
      className={`absolute ${node.posClass} ${displayClass} place-items-center rounded-2xl border bg-white p-2.5 shadow-[0_18px_46px_rgba(15,16,36,.16)]`}
      style={{ borderColor: "var(--mk-border)" }}
    >
      {node.render()}
    </motion.div>
  );
}

function EcoCard({ node, index }: { node: EcoNode & { label: string; sub: string; Icon: typeof BarChart3 }; index: number }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.25, x: node.flyFrom.x, y: node.flyFrom.y }}
      animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
      transition={rt(reduced, { delay: ARRIVAL_START + (platformNodes.length + index) * ARRIVAL_STAGGER, duration: ARRIVAL_DURATION, ease: [0.16, 1, 0.3, 1] })}
      className={`absolute ${node.posClass} hidden max-w-[9.5rem] items-center gap-2.5 rounded-xl border bg-white px-3.5 py-3 shadow-[0_18px_46px_rgba(15,16,36,.14)] lg:flex`}
      style={{ borderColor: "var(--mk-border)" }}
    >
      <node.Icon size={16} className="shrink-0 text-[#7c3aed]" />
      <span className="min-w-0">
        <span className="block truncate text-[11px] font-black" style={{ color: "var(--mk-ink)" }}>{node.label}</span>
        <span className="block truncate text-[10px] font-bold text-[#7c3aed]">{node.sub}</span>
      </span>
    </motion.div>
  );
}

export function MacBookEcosystem() {
  const reduced = useReducedMotion();
  const allDesktopNodes = [...platformNodes, ...dataCardNodes];

  return (
    <div className="relative mx-auto w-full max-w-lg py-6">
      {/* Ambient glow: dim at rest, rises through activation, settles to a soft ambient wash after the bloom. Reduced-motion users land directly on the last keyframe (0.5 opacity) — a calm ambient glow, never the raw 0.22 start value. */}
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(124,58,237,.16), transparent 65%)" }}
        aria-hidden="true"
        initial={{ opacity: 0.22, scale: 0.8 }}
        animate={{ opacity: [0.22, 0.28, 0.45, 0.85, 0.95, 0.5], scale: [0.8, 0.85, 0.95, 1.15, 1.3, 1.05] }}
        transition={rt(reduced, { duration: SETTLE_END, times: [0, T(CALM_END), T(ACTIVATE_END), T(TRANSFORM_END), T(BLOOM_END), 1], ease: "easeInOut" })}
      />
      {/* Explosion-core flash: concentrated on the screen itself, a real bright plateau spanning the transformation beat, fading to fully transparent by the end — reduced-motion users land on that final 0 opacity, i.e. never see it. */}
      <motion.div
        className="pointer-events-none absolute left-1/2 top-[44%] size-48 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, #fff 0%, #fef3c7 22%, #e9d5ff 45%, rgba(124,58,237,.75) 65%, transparent 80%)" }}
        aria-hidden="true"
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: [0, 0, 0.25, 1, 1, 0.45, 0], scale: [0.4, 0.5, 0.75, 1.5, 1.9, 2.4, 2.8] }}
        transition={rt(reduced, { duration: SETTLE_END, times: [0, T(ACTIVATE_END), T(TRANSFORM_END - 0.5), T(TRANSFORM_END - 0.1), T(TRANSFORM_END + 0.5), T(FLOW_END), T(BLOOM_END)], ease: "easeInOut" })}
      />
      {/* Activation pulse: a quick, distinct brightening before transformation — also ends at 0 opacity, invisible to reduced-motion users. */}
      <motion.div
        className="pointer-events-none absolute left-1/2 top-[44%] size-28 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,.9), rgba(196,181,253,.6) 50%, transparent 75%)" }}
        aria-hidden="true"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: [0, 0, 0.9, 0.3, 0, 0], scale: [0.6, 0.7, 1, 1.1, 1.1, 1.1] }}
        transition={rt(reduced, { duration: SETTLE_END, times: [0, T(CALM_END), T(ACTIVATE_END), T(ACTIVATE_END + 0.5), T(TRANSFORM_END), 1], ease: "easeInOut" })}
      />

      <svg className="pointer-events-none absolute inset-0 hidden h-full w-full overflow-visible md:block" viewBox="0 0 400 320" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="hero-thread" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f5f3ff" stopOpacity="0.95" />
            <stop offset="0.4" stopColor="var(--mk-violet)" stopOpacity="0.85" />
            <stop offset="1" stopColor="var(--mk-blue)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="hero-thread-glow" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--mk-violet)" stopOpacity="0.6" />
            <stop offset="1" stopColor="var(--mk-blue)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {allDesktopNodes.map((node, index) => (
          <ConnectorPath key={node.key} curve={node.curve} index={index} />
        ))}
      </svg>
      {allDesktopNodes.map((node, index) => (
        <div key={`spark-${node.key}`} className="pointer-events-none absolute inset-0 hidden md:block">
          <FlowSpark curve={node.curve} index={index} />
        </div>
      ))}

      {/* Stage 1: fades/settles to a calm rest pose. Stage 2: a distinct small activation tilt+scale pulse. Stage 3: a sharper transformation "kick" right at the flash. Stage 5-6: eases back and settles to rest — the same final rest pose reduced-motion users land on directly. */}
      <motion.div
        initial={{ opacity: 0, y: 26, rotateX: 9, rotateZ: 0, scale: 0.94 }}
        animate={{ opacity: [0, 1, 1, 1, 1, 1, 1], y: [26, 0, -3, 0, -5, 1, 0], rotateX: [9, 2, 6, 5, -5, 2, 0], rotateZ: [0, 0, -1.2, 1, 2.2, -0.8, 0], scale: [0.94, 1, 1.035, 1.02, 1.09, 1.02, 1] }}
        transition={rt(reduced, { duration: SETTLE_END, times: [0, T(CALM_END), T(ACTIVATE_END - 0.3), T(ACTIVATE_END), T(TRANSFORM_END), T(BLOOM_END), 1], ease: "easeInOut" })}
      >
        <MacBookMockup
          screen={
            <div className="flex h-full flex-col gap-[6%] p-[7%]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-[.14em] text-[#c4b5fd]">Kampanya Genel Bakış</span>
                <span className="macbook-screen-dot" aria-hidden="true" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[["ROAS", "—"], ["CTR", "—"], ["Lead", "—"]].map(([label, value]) => (
                  <div key={label} className="rounded-[6px] border border-white/10 bg-white/[0.04] p-2 text-center">
                    <p className="text-[8px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
                    <p className="mt-1 text-sm font-black text-white">{value}</p>
                  </div>
                ))}
              </div>
              <div className="grid gap-2">
                <MacBookScreenChip label="Google Ads kampanyası" note="Yayında" />
                <MacBookScreenChip label="Instagram içerik takvimi" note="Bu hafta 4 gönderi" />
              </div>
              <p className="mt-auto text-[8px] leading-4 text-slate-500">Örnek/illüstratif çalışma alanı görünümü.</p>
            </div>
          }
        />
      </motion.div>

      {/* Stage 4-5: strands flow outward and bloom into the real 6-platform network + result cards (desktop/tablet). */}
      {platformNodes.map((node, index) => (
        <EcoBadge key={node.key} node={node} index={index} displayClass="hidden md:grid size-12" />
      ))}
      {dataCardNodes.map((node, index) => (
        <EcoCard key={node.key} node={node} index={index} />
      ))}

      {/* Mobile: same grammar, compact — 3 marks only, no data cards or strand SVG, so the hero stays light there. */}
      {mobilePlatformNodes.map((node, index) => (
        <EcoBadge key={node.key} node={node} index={index} displayClass="grid md:hidden size-11" />
      ))}
    </div>
  );
}
