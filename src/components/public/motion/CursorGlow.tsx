"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Desktop-only pointer glow — merged adaptation of
 * docs/animation-reference/12-cursor-glow-kuyruklu-yildiz.md and
 * 14-custom-cursor.md, deliberately simplified to a single soft radial
 * glow (no particle trail — the references themselves warn against a
 * dense "toy particle rain" for a professional agency site).
 *
 * Renders nothing until a post-mount check confirms a fine pointer with
 * real hover support and no prefers-reduced-motion — this both keeps SSR
 * and first client render identical (no hydration mismatch: `enabled`
 * always starts `false`) and fully disables the effect on touch devices.
 * Position updates go straight to a CSS custom property on the DOM node
 * via a ref, never through React state, so pointer movement never
 * triggers a re-render.
 */
export function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const compute = () => {
      const fine = window.matchMedia("(pointer: fine) and (hover: hover)").matches;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      setEnabled(fine && !reduced);
    };
    compute();
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let frame = 0;
    let pending: { x: number; y: number } | null = null;

    const flush = () => {
      frame = 0;
      if (pending && ref.current) {
        ref.current.style.setProperty("--cx", `${pending.x}px`);
        ref.current.style.setProperty("--cy", `${pending.y}px`);
      }
    };
    // Context-aware sizing (V2 rebuild): the glow grows and shifts tone
    // over a primary CTA / service-explorer item versus a plain link,
    // giving the pointer a small amount of real affordance feedback —
    // still a single element, still transform/opacity+CSS-var only, no
    // extra DOM per interactive target.
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      pending = { x: event.clientX, y: event.clientY };
      const el = ref.current;
      if (el) {
        el.setAttribute("data-visible", "true");
        const target = event.target as Element | null;
        const context = target?.closest(".marketing-btn-primary, .marketing-aurora-btn")
          ? "cta"
          : target?.closest(".service-explorer-item")
          ? "service"
          : target?.closest("a, button")
          ? "link"
          : "default";
        el.setAttribute("data-context", context);
      }
      if (!frame) frame = requestAnimationFrame(flush);
    };
    const onLeave = () => ref.current?.setAttribute("data-visible", "false");

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [enabled]);

  if (!enabled) return null;
  return <div ref={ref} className="marketing-cursor-glow" data-visible="false" aria-hidden="true" />;
}
