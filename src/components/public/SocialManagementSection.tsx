"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CalendarDays, MessagesSquare, PenTool, TrendingUp } from "lucide-react";
import { MacBookMockup, MacBookScreenChip } from "./MacBookMockup";
import { FacebookMark, InstagramMark, TikTokMark, YouTubeMark } from "./PlatformIcons";

const workflowCards = [
  { label: "İçerik Takvimi", Icon: CalendarDays, corner: "top-[-6%] left-[-8%] sm:left-[-4%]" },
  { label: "Kreatif Üretim", Icon: PenTool, corner: "top-[8%] right-[-10%] sm:right-[-6%]" },
  { label: "Topluluk Yönetimi", Icon: MessagesSquare, corner: "bottom-[10%] left-[-10%] sm:left-[-6%]" },
  { label: "Performans Analizi", Icon: TrendingUp, corner: "bottom-[-4%] right-[-8%] sm:right-[-4%]" }
] as const;

const platformChips = [
  { Icon: InstagramMark, label: "Instagram" },
  { Icon: TikTokMark, label: "TikTok" },
  { Icon: FacebookMark, label: "Facebook" },
  { Icon: YouTubeMark, label: "YouTube" }
];

export function SocialManagementSection() {
  const reduced = useReducedMotion();

  return (
    <div className="relative mx-auto mt-4 max-w-3xl">
      <div className="relative mx-auto">
        <div className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(124,58,237,.2),transparent_65%)] blur-3xl" aria-hidden="true" />
        <MacBookMockup
          screen={
            <div className="flex h-full flex-col gap-[6%] p-[7%]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-[.14em] text-[#c4b5fd]">Sosyal Medya Takvimi</span>
                <span className="macbook-screen-dot" aria-hidden="true" />
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 21 }).map((_, index) => (
                  <span key={index} className={`aspect-square rounded-[3px] ${[2, 5, 9, 13, 16, 19].includes(index) ? "bg-gradient-to-br from-[#7c3aed] to-[#4fa8f0]" : "bg-white/[0.06]"}`} />
                ))}
              </div>
              <div className="grid gap-2">
                <MacBookScreenChip label="Instagram gönderisi" note="Yayına hazır" />
                <MacBookScreenChip label="TikTok video" note="Kreatif onayında" />
              </div>
            </div>
          }
        />

        {/* Floating platform workflow cards — decorative on mobile (stacked
            below instead of absolutely positioned) to avoid overlapping text. */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:hidden">
          {workflowCards.map((card) => (
            <div key={card.label} className="cinematic-card flex items-center gap-2 rounded-[12px] border border-white/10 bg-white/[0.03] p-3">
              <card.Icon size={16} className="text-[#c4b5fd]" />
              <span className="text-xs font-bold text-slate-200">{card.label}</span>
            </div>
          ))}
        </div>

        {workflowCards.map((card, index) => (
          <motion.div
            key={card.label}
            initial={reduced ? false : { opacity: 0, scale: 0.85 }}
            whileInView={reduced ? undefined : { opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.5, delay: 0.15 + index * 0.1, ease: [0.16, 1, 0.3, 1] }}
            className={`cinematic-float-icon hidden sm:absolute sm:flex sm:items-center sm:gap-2 sm:px-3 sm:py-2.5 ${card.corner}`}
          >
            <card.Icon size={15} className="text-[#c4b5fd]" />
            <span className="whitespace-nowrap text-xs font-black text-white">{card.label}</span>
          </motion.div>
        ))}
      </div>

      <div className="mt-16 flex flex-wrap items-center justify-center gap-6 sm:mt-8">
        {platformChips.map(({ Icon, label }) => (
          <div key={label} className="flex items-center gap-2 opacity-80 transition hover:opacity-100">
            <Icon className="size-7" />
            <span className="text-xs font-bold text-slate-400">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
