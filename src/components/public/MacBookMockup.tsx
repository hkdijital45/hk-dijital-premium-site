"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { trackMetaCtaClick } from "@/lib/meta-pixel";

const LOGIN_ROUTE = "/digital-center";
const LOGIN_LABEL = "HK Dijital uygulamasına giriş yap";

/**
 * A single, reusable CSS-3D MacBook visual that also functions as the site's
 * global login entry point. One <Link> is the only interactive element —
 * everything inside (screen content, glow, reflections) is decorative and
 * aria-hidden, so assistive tech sees exactly one control with one name.
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
    <div className={`macbook-mockup relative ${dims} ${className}`}>
      <Link
        href={LOGIN_ROUTE}
        aria-label={LOGIN_LABEL}
        onClick={() => trackMetaCtaClick(size === "large" ? "Hero MacBook Girişi" : "Floating MacBook Girişi", LOGIN_ROUTE)}
        className="macbook-mockup-link group block rounded-[8%] focus:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/60"
      >
        <motion.div
          aria-hidden="true"
          initial={false}
          whileHover={reduced ? undefined : { rotateY: -6, rotateX: 3, y: -6, scale: 1.015 }}
          whileFocus={reduced ? undefined : { rotateY: -6, rotateX: 3, y: -6, scale: 1.015 }}
          whileTap={reduced ? undefined : { scale: 0.985 }}
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
      </Link>
      {showHint && (
        <motion.p
          initial={reduced ? false : { opacity: 0, y: 6 }}
          whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="pointer-events-none mt-4 text-center text-xs font-black uppercase tracking-[.2em] text-cyan-100/80"
        >
          Uygulamaya giriş yap
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
