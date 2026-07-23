"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * A purely decorative CSS-3D MacBook visual used on the public homepage.
 * This is not an interactive control and must never link to the private
 * admin login — everything here (screen content, glow, reflections) is
 * aria-hidden so assistive tech announces nothing for it.
 */
export function MacBookMockup({
  size = "large",
  showHint = false,
  className = "",
  screen
}: {
  size?: "large" | "small";
  showHint?: boolean;
  className?: string;
  screen: ReactNode;
}) {
  const reduced = useReducedMotion();
  const dims = size === "large" ? "w-full max-w-xl" : "w-full max-w-[220px]";

  return (
    <div className={`macbook-mockup relative ${dims} ${className}`} aria-hidden="true">
      <motion.div
        initial={false}
        whileHover={reduced ? undefined : { rotateY: -6, rotateX: 3, y: -6, scale: 1.015 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="macbook-mockup-body relative"
        style={{ transformStyle: "preserve-3d" }}
      >
        <div className="macbook-mockup-glow" />
        {/* Lid + screen */}
        <div className="macbook-mockup-lid">
          <div className="macbook-mockup-camera" />
          <div className="macbook-mockup-screen">{screen}</div>
          <div className="macbook-mockup-reflection" />
        </div>
        {/* Base / keyboard hint */}
        <div className="macbook-mockup-base">
          <div className="macbook-mockup-hinge" />
          <div className="macbook-mockup-trackpad" />
        </div>
        <div className="macbook-mockup-shadow" />
      </motion.div>
      {showHint && (
        <motion.p
          initial={reduced ? false : { opacity: 0, y: 6 }}
          whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="pointer-events-none mt-4 text-center text-xs font-black uppercase tracking-[.2em] text-cyan-100/80"
        >
          Ajans Operasyon Sistemi
        </motion.p>
      )}
    </div>
  );
}

export function MacBookScreenChip({ label, note, icon }: { label: string; note?: string; icon?: ReactNode }) {
  return (
    <div className="macbook-screen-chip">
      {icon || <span className="macbook-screen-dot" />}
      <span className="min-w-0">
        <span className="block truncate text-[11px] font-black text-white">{label}</span>
        {note && <span className="block truncate text-[9px] text-cyan-100/70">{note}</span>}
      </span>
    </div>
  );
}
