"use client";

import { useRef, useState } from "react";
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from "framer-motion";
import type { LucideIcon } from "lucide-react";

export type ProcessStep = { label: string; text: string; Icon: LucideIcon };

/**
 * A non-sticky scroll storyline: the vertical progress line's fill tracks
 * overall scroll progress through the section (useScroll with a target
 * ref, no position:sticky). Sticky was deliberately avoided here — see
 * DeviceShowcase.tsx's module comment: the public <main> wrapper
 * (Shell.tsx) has overflow-hidden, which breaks sticky's viewport-relative
 * containing block in this app. Each step still visually reacts as it
 * becomes the active one, just via whileInView/active-state styling
 * instead of a pinned visual.
 */
export function ProcessStoryline({ steps }: { steps: ProcessStep[] }) {
  const reduced = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start 0.75", "end 0.35"] });
  const fillScale = useTransform(scrollYProgress, [0, 1], [0, 1]);

  useMotionValueEvent(scrollYProgress, "change", (value) => {
    const index = Math.min(steps.length - 1, Math.max(0, Math.floor(value * steps.length)));
    setActive(index);
  });

  return (
    <div ref={containerRef} className="mt-12 grid gap-8 lg:grid-cols-[auto_1fr]">
      <div className="hidden lg:flex lg:justify-center">
        <div className="cinematic-progress-track h-full min-h-[520px]">
          <motion.div className="cinematic-progress-fill" style={reduced ? { height: "100%" } : { scaleY: fillScale, height: "100%" }} />
        </div>
      </div>

      <div className="grid gap-3">
        {steps.map((step, index) => {
          const isActive = !reduced && index === active;
          return (
            <motion.div
              key={step.label}
              initial={reduced ? false : { opacity: 0, x: 24 }}
              whileInView={reduced ? undefined : { opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className={`cinematic-card flex items-start gap-4 rounded-[18px] border p-5 transition sm:items-center ${isActive ? "border-[#a78bfa]/60 bg-[#7c3aed]/[0.1]" : "border-white/10 bg-white/[0.03]"}`}
            >
              <span className={`grid size-11 shrink-0 place-items-center rounded-full border text-sm font-black italic transition ${isActive ? "border-[#a78bfa]/60 bg-[#7c3aed]/30 text-white" : "border-white/10 bg-[#030304] text-slate-400"}`}>
                0{index + 1}
              </span>
              <step.Icon size={20} className={isActive ? "text-white" : "text-[#4fa8f0]"} aria-hidden="true" />
              <div>
                <h3 className="text-base font-black text-white sm:text-lg">{step.label}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-400">{step.text}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
