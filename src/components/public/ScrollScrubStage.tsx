"use client";

import { useRef } from "react";
import { motion, useMotionTemplate, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { BarChart3, BrainCircuit, Gauge, Layers3, MessageCircle, Search, Target, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const orbitItems: Array<{ label: string; Icon: LucideIcon; angle: number; start: number }> = [
  { label: "Meta Reklam", Icon: BarChart3, angle: -90, start: 0.28 },
  { label: "Google Ads", Icon: Search, angle: -45, start: 0.36 },
  { label: "Sosyal Medya", Icon: Users, angle: 0, start: 0.44 },
  { label: "Talep Takibi", Icon: Target, angle: 45, start: 0.52 },
  { label: "Raporlama", Icon: Layers3, angle: 90, start: 0.6 },
  { label: "Performans Yorumu", Icon: BrainCircuit, angle: 135, start: 0.68 },
  { label: "Önceliklendirme", Icon: Gauge, angle: 180, start: 0.76 },
  { label: "Destek", Icon: MessageCircle, angle: -135, start: 0.84 }
];

function OrbitIcon({ item, progress }: { item: (typeof orbitItems)[number]; progress: import("framer-motion").MotionValue<number> }) {
  const local = useTransform(progress, [item.start, item.start + 0.14], [0, 1]);
  const radians = (item.angle * Math.PI) / 180;
  const radius = 220;
  const x = useTransform(local, (value) => Math.cos(radians) * radius * value);
  const y = useTransform(local, (value) => Math.sin(radians) * radius * value * 0.72);
  const scale = useTransform(local, [0, 1], [0.4, 1]);
  const opacity = local;
  const transform = useMotionTemplate`translate(${x}px, ${y}px) scale(${scale})`;

  return (
    <motion.div style={{ opacity, transform }} className="absolute left-1/2 top-1/2 flex w-[76px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2">
      <div className="grid size-14 place-items-center rounded-full border border-white/10 bg-white/[0.05] text-[#4fa8f0] backdrop-blur">
        <item.Icon size={20} aria-hidden="true" />
      </div>
      <span className="whitespace-nowrap text-[10px] font-black uppercase tracking-[.08em] text-slate-300">{item.label}</span>
    </motion.div>
  );
}

/**
 * Scroll-scrubbed hero visual matching the reference design's "MacBook opens
 * as you scroll, platform icons orbit outward" stage. Pure function of
 * scroll progress (framer-motion useScroll bound to this container), so
 * scrolling back up reverses it automatically — nothing is "played".
 *
 * Skips the tall pinned scroll section entirely for reduced-motion users and
 * on small screens: they get the same visual already fully "open" and
 * static, per the accessibility/mobile-simplification requirement.
 */
export function ScrollScrubStage() {
  const reduced = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start start", "end end"] });

  const screenAngle = useTransform(scrollYProgress, [0, 0.32], [-92, 0], { clamp: true });
  const glow = useTransform(scrollYProgress, [0, 0.32], [0, 1], { clamp: true });
  const macRotateY = useTransform(scrollYProgress, [0, 1], [-18, 8]);

  if (reduced) {
    return (
      <div className="relative mx-auto flex max-w-md flex-col items-center py-16 lg:hidden">
        <StaticMacBook />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative hidden h-[350vh] lg:block">
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden">
        <p className="absolute left-[8vw] top-28 text-xs font-black uppercase tracking-[.3em] text-[#4fa8f0]">HK Dijital Çalışma Sistemi</p>
        <div className="relative flex h-[min(72vw,720px)] w-[min(72vw,720px)] items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-white/10" />
          <div style={{ perspective: 1400 }}>
            <motion.div style={{ rotateY: macRotateY }} className="relative w-[220px]" >
              <motion.div
                style={{ rotateX: screenAngle }}
                className="relative h-[150px] w-[220px] origin-bottom rounded-t-[10px] rounded-b-[3px] border border-white/10 bg-gradient-to-br from-[#15151a] to-[#050506] shadow-[0_0_50px_rgba(47,91,255,.25)]"
              >
                <div className="absolute inset-2 grid place-items-center overflow-hidden rounded-[4px] bg-[radial-gradient(circle_at_50%_30%,#0b1230,#020204_75%)]">
                  <motion.div style={{ opacity: glow }} className="size-3/5 rounded-full bg-[radial-gradient(circle,rgba(47,91,255,.6),transparent_70%)]" />
                </div>
              </motion.div>
              <div className="relative -ml-[15px] mt-1 h-3.5 w-[250px] rounded-b-[8px] rounded-t-[4px] border border-white/10 bg-gradient-to-br from-[#1d1d22] to-[#0a0a0c]" />
            </motion.div>
          </div>
          {orbitItems.map((item) => (
            <OrbitIcon key={item.label} item={item} progress={scrollYProgress} />
          ))}
        </div>
        <p className="absolute bottom-16 left-0 right-0 text-center text-sm font-black uppercase tracking-[.14em] text-slate-400">
          Aşağı kaydır — sistem <span className="text-white">tek panelde</span> açılıyor
        </p>
      </div>
    </div>
  );
}

function StaticMacBook() {
  return (
    <div className="relative w-[220px]" style={{ perspective: 1400 }}>
      <div className="relative h-[150px] w-[220px] rounded-t-[10px] rounded-b-[3px] border border-white/10 bg-gradient-to-br from-[#15151a] to-[#050506] shadow-[0_0_50px_rgba(47,91,255,.25)]">
        <div className="absolute inset-2 grid place-items-center overflow-hidden rounded-[4px] bg-[radial-gradient(circle_at_50%_30%,#0b1230,#020204_75%)]">
          <div className="size-3/5 rounded-full bg-[radial-gradient(circle,rgba(47,91,255,.6),transparent_70%)]" />
        </div>
      </div>
      <div className="relative -ml-[15px] mt-1 h-3.5 w-[250px] rounded-b-[8px] rounded-t-[4px] border border-white/10 bg-gradient-to-br from-[#1d1d22] to-[#0a0a0c]" />
      <div className="mt-10 grid grid-cols-4 gap-3">
        {orbitItems.slice(0, 8).map((item) => (
          <div key={item.label} className="flex flex-col items-center gap-1.5">
            <div className="grid size-11 place-items-center rounded-full border border-white/10 bg-white/[0.05] text-[#4fa8f0]">
              <item.Icon size={16} aria-hidden="true" />
            </div>
            <span className="text-center text-[8px] font-black uppercase leading-tight text-slate-400">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
