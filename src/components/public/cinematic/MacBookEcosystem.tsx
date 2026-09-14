"use client";

import { useReducedMotion, motion } from "framer-motion";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { BarChart3, CalendarDays } from "lucide-react";
import { MacBookMockup, MacBookScreenChip } from "../MacBookMockup";
import { FacebookMark, GoogleMark, InstagramMark, MetaMark, TikTokMark, YouTubeMark } from "../PlatformIcons";

/**
 * The homepage hero's cinematic centerpiece, rebuilt to match a supplied
 * reference video frame-by-frame: a calm subject that itself disintegrates
 * into flowing strand/fiber particles, travels outward, coils into a radial
 * formation, blooms, and resolves into the final composition. The MacBook
 * plays the reference's "subject" role — it visibly fades/rotates/dissolves
 * during the transformation, it does not sit still while decorations fly
 * around it.
 *
 * ONE shared clock (a plain mutable ref, `elapsedRef`, advanced by a single
 * requestAnimationFrame loop below) drives every visible piece: the
 * MacBook's transform/opacity/blur, every platform badge/data card's
 * arrival, AND the canvas particle/strand/bloom system. An earlier version
 * of this component used Framer Motion's own declarative `animate` timeline
 * for the MacBook/badges alongside a *separate* manually-accumulated clock
 * for the canvas — visual QA caught the two clocks drifting apart
 * unpredictably between page loads (Framer's internal animation clock does
 * not start at exactly the same tick as a plain rAF loop started in a
 * sibling effect), so the MacBook and badges would visibly desync from the
 * strand/bloom effect. Driving literally everything off one imperative
 * clock (via direct DOM style mutation on plain refs, not Framer) removes
 * that class of bug entirely: every consumer reads the exact same number
 * every frame.
 *
 * Reduced motion: the JSX/`style` markup React actually renders is a fixed,
 * unconditional value for every element (never branched on
 * useReducedMotion()) — that hook resolves to `null` during SSR (no
 * matchMedia) but can resolve synchronously on the client's very first
 * render, so branching rendered markup on it disagrees with the
 * server-rendered HTML -> React hydration error #418 (root-caused and
 * fixed sitewide already; this rewrite must not reintroduce it). All the
 * actual motion — including the reduced-motion "jump straight to settled"
 * behavior — happens via this file's *own* effect mutating DOM styles
 * imperatively after mount, which never touches hydration at all. That
 * effect uses useLayoutEffect (client-only; a no-op during SSR) so a
 * reduced-motion visitor's very first paint already reflects the settled
 * state, with zero flash of the pre-animation pose.
 */

// ---- Timeline (seconds) — recalibrated against a live-production visual
// fidelity audit (frame-by-frame comparison against the reference video),
// which found three concrete gaps against the first cut of this timeline:
// disintegration started too late (MacBook sat fully solid too long),
// strand density read as "a handful of thin lines" instead of a fiber mass,
// and the bloom flashed and faded almost immediately instead of holding.
// This timeline fixes the pacing; PARTICLE_START deliberately precedes
// ROTATE_END so strands begin escaping the MacBook's edges *before* its own
// rotation has finished — the two stages overlap instead of handing off
// abruptly — and RADIAL_END/BLOOM_RISE_END/BLOOM_HOLD_END are spaced out so
// the bloom gets a real, held beat before the reveal begins. ----
const CALM_END = 1.7;
const ROTATE_END = 2.9;
const PARTICLE_START = 2.2; // strands begin escaping before rotation finishes
const DISINTEGRATE_END = 3.6;
const TRAVEL_END = 4.9;
const RADIAL_END = 7.3; // coil formation completes
const BLOOM_RISE_END = 8.0; // bloom rises to peak
const BLOOM_HOLD_END = 8.7; // bloom holds near peak — the viewer gets a real beat to register it
const REVEAL_START = BLOOM_HOLD_END; // reveal never begins before the hold ends
const REVEAL_END = 9.5;
const SETTLE_END = 10.2;

// Badges/cards emerge FROM the transformation's bloom rather than fading in
// independently — arrival never starts before the bloom has held its peak,
// so they read as what the bloom resolves into, not a separate step.
const ARRIVAL_START = REVEAL_START;
const ARRIVAL_STAGGER = 0.08;
const ARRIVAL_DURATION = 0.95;

// Client-only alias so the one-shot style-setting effect below applies
// before first paint (avoiding any reduced-motion flash) without ever
// calling the real useLayoutEffect during server rendering.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }
function easeOutCubic(t: number) { return 1 - Math.pow(1 - t, 3); }
function easeInOutCubic(t: number) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

// Samples a piecewise-eased keyframe track at absolute time `t` (seconds).
function sampleTrack(times: number[], values: number[], t: number): number {
  if (t <= times[0]) return values[0];
  const last = times.length - 1;
  if (t >= times[last]) return values[last];
  for (let i = 1; i <= last; i++) {
    if (t <= times[i]) {
      const localT = (t - times[i - 1]) / (times[i] - times[i - 1]);
      return lerp(values[i - 1], values[i], easeInOutCubic(localT));
    }
  }
  return values[last];
}

const MAC_TIMES = [0, CALM_END, ROTATE_END, DISINTEGRATE_END, BLOOM_HOLD_END, REVEAL_END, SETTLE_END];
const MAC_OPACITY = [0, 1, 1, 0.12, 0.06, 1, 1];
const MAC_Y = [26, 0, -3, -8, -6, 2, 0];
const MAC_ROTATE_X = [9, 2, 4, 6, 4, 1, 0];
const MAC_ROTATE_Y = [0, 0, 34, 46, 50, 6, 0];
const MAC_SCALE = [0.92, 1, 1.04, 0.72, 0.68, 1.06, 1];
const MAC_BLUR = [6, 0, 0, 4, 6, 1, 0];

function applyMacStyle(el: HTMLDivElement, t: number) {
  const opacity = sampleTrack(MAC_TIMES, MAC_OPACITY, t);
  const y = sampleTrack(MAC_TIMES, MAC_Y, t);
  const rx = sampleTrack(MAC_TIMES, MAC_ROTATE_X, t);
  const ry = sampleTrack(MAC_TIMES, MAC_ROTATE_Y, t);
  const scale = sampleTrack(MAC_TIMES, MAC_SCALE, t);
  const blur = sampleTrack(MAC_TIMES, MAC_BLUR, t);
  el.style.opacity = String(opacity);
  el.style.transform = `translateY(${y}px) scale(${scale}) rotateX(${rx}deg) rotateY(${ry}deg)`;
  el.style.filter = blur > 0.05 ? `blur(${blur}px)` : "none";
}

type BadgeState = { x: number; y: number; scale: number; opacity: number };
function badgeStateAt(t: number, delay: number, from: { x: number; y: number }): BadgeState {
  if (t <= delay) return { x: from.x, y: from.y, scale: 0.25, opacity: 0 };
  const localT = clamp01((t - delay) / ARRIVAL_DURATION);
  const e = easeOutCubic(localT);
  return { x: lerp(from.x, 0, e), y: lerp(from.y, 0, e), scale: lerp(0.25, 1, e), opacity: lerp(0, 1, e) };
}
function applyBadgeStyle(el: HTMLDivElement, t: number, delay: number, from: { x: number; y: number }) {
  const s = badgeStateAt(t, delay, from);
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

/* ------------------------- Particle/strand/bloom engine ------------------------- */

type Particle = {
  ox: number; oy: number; // origin on the MacBook's silhouette outline (container-local px)
  outX: number; outY: number; // outward "flow" waypoint (container-local px)
  ctrlX: number; ctrlY: number; // quadratic-bezier control point, bulged off the straight origin->outward line so flow paths curve and overlap instead of reading as straight spokes
  angle: number; outR: number; // polar coords of the outward waypoint, relative to the focal (coil) center
  spin: number; // radians of additional rotation swept during the radial-coil phase
  coilR: number; // tight radius the particle coils down to at the core
  size: number;
  gold: boolean;
  stagger: number; // 0..~0.32, staggers this particle's start within the active window
  trailMax: number;
  trail: Array<{ x: number; y: number }>;
};

// Fraction of the particles' active window (PARTICLE_START..RADIAL_END)
// spent in the outward "flow" phase before switching to the inward radial
// coil — derived from TRAVEL_END so the two phase boundaries stay in sync
// with the named timeline above instead of an arbitrary constant.
const FLOW_SPLIT = (TRAVEL_END - PARTICLE_START) / (RADIAL_END - PARTICLE_START);
// Gentle continued rotation applied to the coiled core during the bloom
// hold (after the coil has fully formed) so the bloom reads as a living,
// slowly-turning mass rather than a frozen still frame during its hold.
const HOLD_SPIN_RATE = 0.55;

const VIOLET: [number, number, number] = [124, 58, 237];
const GOLD: [number, number, number] = [251, 191, 36];

function buildPalette(rgb: [number, number, number]) {
  const steps: string[] = [];
  for (let i = 0; i <= 20; i++) steps.push(`rgba(${rgb[0]},${rgb[1]},${rgb[2]},${(i / 20).toFixed(3)})`);
  return steps;
}
const VIOLET_PALETTE = buildPalette(VIOLET);
const GOLD_PALETTE = buildPalette(GOLD);
function paletteColor(gold: boolean, alpha: number) {
  const clamped = Math.max(0, Math.min(1, alpha));
  const idx = Math.round(clamped * 20);
  return (gold ? GOLD_PALETTE : VIOLET_PALETTE)[idx];
}

function generateParticles(rect: { x: number; y: number; w: number; h: number }, count: number): Particle[] {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const perimeter = 2 * (rect.w + rect.h);
  const out: Particle[] = [];
  for (let i = 0; i < count; i++) {
    // Sample a point on the MacBook's outline (screen + body silhouette) so
    // particles visibly originate from its edges, not its filled interior.
    let d = Math.random() * perimeter;
    let ox: number, oy: number;
    if (d < rect.w) { ox = rect.x + d; oy = rect.y; }
    else if ((d -= rect.w) < rect.h) { ox = rect.x + rect.w; oy = rect.y + d; }
    else if ((d -= rect.h) < rect.w) { ox = rect.x + rect.w - d; oy = rect.y + rect.h; }
    else { d -= rect.w; ox = rect.x; oy = rect.y + rect.h - d; }
    ox += (Math.random() - 0.5) * 10;
    oy += (Math.random() - 0.5) * 10;

    const dx0 = ox - cx;
    const dy0 = oy - cy - rect.h * 0.18; // upward bias, so strands trail up-and-out like flowing fiber
    const len = Math.hypot(dx0, dy0) || 1;
    const dx = dx0 / len, dy = dy0 / len;
    const dist = (rect.w + rect.h) / 2 * (0.55 + Math.random() * 0.85);
    const outX = ox + dx * dist;
    const outY = oy + dy * dist;

    // Bulge the flight path off a straight line so strands curve and cross
    // each other instead of reading as isolated straight spokes — this is
    // what turns a handful of lines into a fiber MASS.
    const mx = (ox + outX) / 2, my = (oy + outY) / 2;
    const perpLen = Math.hypot(outX - ox, outY - oy) || 1;
    const perpX = -(outY - oy) / perpLen, perpY = (outX - ox) / perpLen;
    const bulge = (Math.random() - 0.5) * dist * 0.7;
    const ctrlX = mx + perpX * bulge;
    const ctrlY = my + perpY * bulge;

    const vx = outX - cx;
    const vy = (outY - cy) / 0.82;
    const gold = Math.random() < 0.3;
    out.push({
      ox, oy, outX, outY, ctrlX, ctrlY,
      angle: Math.atan2(vy, vx),
      outR: Math.hypot(vx, vy),
      spin: 4.5 + Math.random() * 3.2, // all particles coil the same direction for one coherent spiral
      coilR: 4 + Math.random() * 10,
      size: gold ? 2.0 + Math.random() * 2.2 : 1.5 + Math.random() * 3.2,
      gold,
      stagger: Math.random() * 0.32,
      trailMax: 10 + Math.floor(Math.random() * 9),
      trail: []
    });
  }
  return out;
}

function particlePos(p: Particle, rawProg: number, holdElapsed: number, center: { x: number; y: number }): { x: number; y: number; alpha: number } | null {
  const local = clamp01((rawProg - p.stagger) / (1 - p.stagger));
  if (local <= 0) return null;
  const fadeIn = clamp01(local / 0.08);
  if (local < FLOW_SPLIT) {
    const t = easeOutCubic(local / FLOW_SPLIT);
    const mt = 1 - t;
    // Quadratic bezier through the curved control point — flow paths arc
    // and overlap instead of tracing straight spokes out of the MacBook.
    const x = mt * mt * p.ox + 2 * mt * t * p.ctrlX + t * t * p.outX;
    const y = mt * mt * p.oy + 2 * mt * t * p.ctrlY + t * t * p.outY;
    return { x, y, alpha: fadeIn };
  }
  const t2 = easeInOutCubic((local - FLOW_SPLIT) / (1 - FLOW_SPLIT));
  const radius = lerp(p.outR, p.gold ? p.coilR * 0.55 : p.coilR, t2);
  // Once the coil has fully formed (t2 reaches 1), keep it slowly turning
  // through the bloom hold rather than freezing — a still frame during a
  // multi-second hold would read as dead, not as energy building.
  const angle = p.angle + p.spin * t2 + (t2 >= 1 ? HOLD_SPIN_RATE * holdElapsed : 0);
  const goldPull = p.gold ? 1.15 : 1;
  return {
    x: center.x + Math.cos(angle) * radius * goldPull,
    y: center.y + Math.sin(angle) * radius * 0.82 * goldPull,
    alpha: fadeIn
  };
}

/* ------------------------------- Main component ------------------------------- */

export function MacBookEcosystem() {
  const reduced = useReducedMotion();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const macRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const badgeElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const [tier, setTier] = useState<"desktop" | "tablet" | "mobile" | null>(null);

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
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const mac = macRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !container || !mac || !wrapper) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isReduced = !!reduced;
    // Desktop/tablet raised materially per visual-fidelity audit: the prior
    // counts (130/60) read as "a handful of thin lines" against the
    // reference's dense fiber mass. Mobile is kept light on purpose (already
    // a simplified fallback with fewer badges and no data cards).
    const count = tier === "desktop" ? 240 : tier === "tablet" ? 120 : 28;
    let particles: Particle[] = [];
    let center = { x: 0, y: 0 };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = container.clientWidth;
      const h = container.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      // mac's offsetLeft/Top are relative to the outer wrapper (its
      // offsetParent). canvas's own offsetLeft/Top are relative to
      // `container` instead (canvas's offsetParent, since container is the
      // positioned ancestor) and are always 0 by construction — using them
      // here would silently ignore container's own -15% inset relative to
      // the wrapper. Subtract container's wrapper-relative offset instead
      // so canvas-local coordinates line up with the real MacBook position.
      const offsetX = mac.offsetLeft - container.offsetLeft;
      const offsetY = mac.offsetTop - container.offsetTop;
      ctx.setTransform(dpr, 0, 0, dpr, -offsetX * dpr, -offsetY * dpr);
      const rect = { x: mac.offsetLeft, y: mac.offsetTop, w: mac.offsetWidth, h: mac.offsetHeight };
      particles = generateParticles(rect, count);
      center = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    let visible = true;
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { threshold: 0.05 });
    io.observe(wrapper);

    const applyAll = (t: number) => {
      applyMacStyle(mac, t);
      for (const { node, delay } of badgeConfigs) {
        const el = badgeElsRef.current.get(node.key);
        if (el) applyBadgeStyle(el, t, delay, node.flyFrom);
      }
    };

    if (isReduced) {
      // Reduced motion: jump straight to the fully settled frame, draw no
      // particles at all, and never start the loop — zero ongoing cost and
      // (via useIsoLayoutEffect) zero visible flash of the pre-animation pose.
      applyAll(SETTLE_END);
      ctx.clearRect(-9999, -9999, 99999, 99999);
      return () => { ro.disconnect(); io.disconnect(); };
    }

    let raf = 0;
    let elapsed = 0;
    let last = performance.now();

    const draw = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (visible) elapsed += dt;

      applyAll(elapsed);

      if (elapsed > SETTLE_END + 0.5) { ctx.clearRect(-9999, -9999, 99999, 99999); return; }
      raf = requestAnimationFrame(draw);
      if (!visible) return;

      ctx.clearRect(-9999, -9999, 99999, 99999);
      const winStart = PARTICLE_START;
      const winEnd = RADIAL_END;
      const rawProg = clamp01((elapsed - winStart) / (winEnd - winStart));
      const holdElapsed = Math.max(0, elapsed - RADIAL_END);
      // Strands stay fully visible through the entire bloom hold (not just
      // up to its rise) and only fade out once the reveal actually starts —
      // the audit's "reveal begins before the bloom has held" gap was partly
      // this: strands (and the bloom) used to fade before badges arrived.
      let globalFade = 1;
      if (elapsed > BLOOM_HOLD_END) globalFade = 1 - clamp01((elapsed - BLOOM_HOLD_END) / (REVEAL_END - BLOOM_HOLD_END));
      if (elapsed < winStart || globalFade <= 0.001) return;

      ctx.globalCompositeOperation = "lighter";
      for (const p of particles) {
        const pos = particlePos(p, rawProg, holdElapsed, center);
        if (!pos) continue;
        p.trail.push({ x: pos.x, y: pos.y });
        if (p.trail.length > p.trailMax) p.trail.shift();
        const baseAlpha = pos.alpha * globalFade;
        for (let i = 1; i < p.trail.length; i++) {
          const segAlpha = baseAlpha * (i / p.trail.length) * 0.92;
          ctx.strokeStyle = paletteColor(p.gold, segAlpha);
          ctx.lineWidth = p.size * (i / p.trail.length);
          ctx.beginPath();
          ctx.moveTo(p.trail[i - 1].x, p.trail[i - 1].y);
          ctx.lineTo(p.trail[i].x, p.trail[i].y);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.fillStyle = paletteColor(p.gold, Math.min(1, baseAlpha * 1.4));
        ctx.arc(pos.x, pos.y, p.size * 0.85, 0, Math.PI * 2);
        ctx.fill();
      }

      // Bloom: rises as the coil completes, HOLDS at peak brightness for a
      // deliberate beat, then fades only once the reveal begins — the
      // three-phase rise/hold/fade shape the audit found missing (the prior
      // version rose and faded almost immediately, with no held peak).
      const bloomRiseStart = RADIAL_END - 0.3;
      let intensity = 0;
      if (elapsed >= bloomRiseStart && elapsed < BLOOM_RISE_END) {
        intensity = easeOutCubic(clamp01((elapsed - bloomRiseStart) / (BLOOM_RISE_END - bloomRiseStart)));
      } else if (elapsed >= BLOOM_RISE_END && elapsed < BLOOM_HOLD_END) {
        intensity = 1;
      } else if (elapsed >= BLOOM_HOLD_END && elapsed <= REVEAL_END) {
        intensity = 1 - easeInOutCubic(clamp01((elapsed - BLOOM_HOLD_END) / (REVEAL_END - BLOOM_HOLD_END)));
      }
      if (intensity > 0.001) {
        const riseProg = clamp01((elapsed - bloomRiseStart) / (BLOOM_RISE_END - bloomRiseStart));
        const maxRadius = Math.min(center.x, 90);
        // A tiny sinusoidal pulse during the hold keeps the bloom reading as
        // a living, energetic core rather than a static painted circle.
        const pulse = elapsed >= BLOOM_RISE_END && elapsed < BLOOM_HOLD_END ? 1 + Math.sin(elapsed * 5) * 0.035 : 1;
        const radius = lerp(6, maxRadius, easeOutCubic(riseProg)) * pulse;
        const grad = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, radius);
        grad.addColorStop(0, `rgba(255,255,255,${(0.97 * intensity).toFixed(3)})`);
        grad.addColorStop(0.35, `rgba(253,230,138,${(0.7 * intensity).toFixed(3)})`);
        grad.addColorStop(0.7, `rgba(124,58,237,${(0.4 * intensity).toFixed(3)})`);
        grad.addColorStop(1, "rgba(124,58,237,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier, reduced]);

  return (
    <div ref={wrapperRef} className="relative mx-auto w-full max-w-lg py-6" style={{ perspective: 1200 }}>
      {/* Ambient glow: dim at rest, rises through the transformation, settles to a soft ambient wash. This is the one purely-decorative piece still left on Framer's own declarative timeline (a plain fade/scale wash, not something that needs frame-perfect sync with the strand/bloom system) — reduced-motion users land directly on its last keyframe via MotionConfig's duration collapse, never the raw start value. */}
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(124,58,237,.16), transparent 65%)" }}
        aria-hidden="true"
        initial={{ opacity: 0.2, scale: 0.8 }}
        animate={{ opacity: [0.2, 0.24, 0.42, 0.9, 0.48], scale: [0.8, 0.85, 1.0, 1.35, 1.05] }}
        transition={{ duration: SETTLE_END, times: [0, CALM_END / SETTLE_END, ROTATE_END / SETTLE_END, BLOOM_HOLD_END / SETTLE_END, 1], ease: "easeInOut" }}
      />

      {/* The subject itself: calm -> rotates/tilts -> dissolves (fades, shrinks, blurs) while the canvas strands take over -> stays mostly hidden through the radial/bloom stages -> reforms at the reveal. Styled entirely by the single shared clock above via direct DOM mutation — this inline style is only the safe, unconditional SSR/first-paint value. */}
      <div ref={macRef} style={{ opacity: 0, transform: "translateY(26px) scale(0.92) rotateX(9deg) rotateY(0deg)", filter: "blur(6px)", transformStyle: "preserve-3d" }}>
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
      </div>

      {/* The disintegration/strand/radial-bloom transformation itself — an imperative canvas engine, entirely client-driven. */}
      <div ref={containerRef} className="pointer-events-none absolute -inset-[15%]" aria-hidden="true">
        <canvas ref={canvasRef} className="absolute left-0 top-0" />
      </div>

      {/* What the bloom resolves into: the real 6-platform network + result cards (desktop/tablet), emerging from the transformation rather than fading in independently. */}
      {platformNodes.map((node) => (
        <EcoBadge key={node.key} node={node} domRef={(el) => { if (el) badgeElsRef.current.set(node.key, el); else badgeElsRef.current.delete(node.key); }} displayClass="hidden md:grid size-12" />
      ))}
      {dataCardNodes.map((node) => (
        <EcoCard key={node.key} node={node} domRef={(el) => { if (el) badgeElsRef.current.set(node.key, el); else badgeElsRef.current.delete(node.key); }} />
      ))}

      {/* Mobile: same grammar, compact — 3 marks only, lighter particle count, no data cards, so the hero stays light there. */}
      {mobilePlatformNodes.map((node) => (
        <EcoBadge key={node.key} node={node} domRef={(el) => { if (el) badgeElsRef.current.set(node.key, el); else badgeElsRef.current.delete(node.key); }} displayClass="grid md:hidden size-11" />
      ))}
    </div>
  );
}
