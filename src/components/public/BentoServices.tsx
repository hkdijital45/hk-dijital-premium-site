"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import type { Service } from "@/lib/types";
import { platformMarks, type PlatformKey } from "./PlatformIcons";

export type BentoServiceItem = {
  name: string;
  Icon: LucideIcon;
  href: string;
  outcome: string;
  platforms?: PlatformKey[];
};

function PlatformTag({ platform }: { platform: PlatformKey }) {
  const mark = platformMarks.find((item) => item.key === platform);
  if (!mark) return null;
  const { Icon, label } = mark;
  return (
    <span title={label} className="grid size-7 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.05] p-1">
      <Icon className="h-full w-full" />
    </span>
  );
}

export function BentoServices({ items, services }: { items: BentoServiceItem[]; services: Service[] }) {
  const reduced = useReducedMotion();

  return (
    <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item, index) => {
        const matched = services.find((service) => service.name.toLocaleLowerCase("tr").includes(item.name.split(" ")[0].toLocaleLowerCase("tr")));
        const featured = index === 0;
        return (
          <motion.div
            key={item.name}
            initial={reduced ? false : { opacity: 0, y: 32 }}
            whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.55, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
            className={`cinematic-bento group flex flex-col p-7 ${featured ? "md:col-span-2 xl:col-span-2 cinematic-bento-featured" : ""}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="grid size-12 place-items-center rounded-[12px] border border-[#a78bfa]/30 bg-gradient-to-br from-[#7c3aed]/25 to-[#4fa8f0]/15 text-[#c4b5fd] transition group-hover:scale-110 group-hover:text-white">
                <item.Icon size={22} />
              </div>
              {item.platforms && item.platforms.length > 0 && (
                <div className="flex -space-x-2">
                  {item.platforms.map((platform) => <PlatformTag key={platform} platform={platform} />)}
                </div>
              )}
            </div>
            <h3 className="mt-6 text-xl font-black text-white">{item.name}</h3>
            {matched?.problem && <p className="mt-3 text-xs font-bold uppercase tracking-[.05em] text-slate-500">Problem: {matched.problem}</p>}
            <p className="mt-3 text-sm leading-7 text-slate-400">{matched?.description || "Strateji, kurulum, optimizasyon ve raporlama tek merkezde yönetilir."}</p>
            <p className="mt-4 flex items-center gap-2 text-xs font-bold text-[#c4b5fd]"><Sparkles size={13} /> {item.outcome}</p>
            <Link href={item.href} className="mt-5 inline-flex items-center gap-2 text-sm font-black text-white transition group-hover:gap-3">
              Hizmeti incele <ArrowRight size={16} className="transition group-hover:translate-x-1" />
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
