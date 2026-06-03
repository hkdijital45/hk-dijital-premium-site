"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { PackageItem, Service } from "@/lib/types";
import { CheckCircle2, serviceIcons } from "@/lib/icons";
import { PremiumCard } from "./ui";
import { trackEvent } from "./TrackingPlaceholders";

export function ServiceGrid({ services }: { services: Service[] }) {
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {services
        .filter((service) => service.visible)
        .sort((a, b) => a.order - b.order)
        .map((service, index) => {
          const Icon = serviceIcons[service.icon] ?? serviceIcons.Sparkles;
          return (
            <motion.div key={service.id} initial={{ opacity: 0, y: 28, rotateX: 5 }} whileInView={{ opacity: 1, y: 0, rotateX: 0 }} viewport={{ once: true, margin: "-70px" }} transition={{ duration: .6, delay: index * .06 }}>
              <PremiumCard className="group relative h-full overflow-hidden">
                <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/60 to-transparent opacity-0 transition group-hover:opacity-100" />
                <div className="grid size-12 place-items-center rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 text-cyan-200 transition group-hover:scale-105 group-hover:bg-cyan-200/20">
                  <Icon size={22} />
                </div>
                <h2 className="mt-5 text-xl font-black text-white">{service.name}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">{service.description}</p>
                <Link href="/teklif-al" className="mt-5 inline-flex text-sm font-bold text-cyan-200">
                  {service.cta}
                </Link>
              </PremiumCard>
            </motion.div>
          );
        })}
    </div>
  );
}

export function PackageCards({ packages }: { packages: PackageItem[] }) {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {packages
        .filter((item) => item.visible)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((item, index) => (
          <motion.div key={item.id} initial={{ opacity: 0, y: 32, scale: .96 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true, margin: "-70px" }} transition={{ duration: .65, delay: index * .08 }}>
            <PremiumCard className={`h-full overflow-hidden ${item.recommended ? "relative border-cyan-200/50 bg-cyan-200/[0.08] shadow-[0_0_70px_rgba(34,211,238,.16)]" : "relative"}`}>
              <div className="absolute -right-10 -top-12 h-32 w-32 rounded-full bg-cyan-300/10 blur-3xl" />
              {item.recommended && (
                <span className="absolute right-5 top-5 rounded-full bg-amber-300 px-3 py-1 text-xs font-black text-slate-950">
                  Önerilen
                </span>
              )}
              <h2 className="text-2xl font-black text-white">{item.name}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">{item.description}</p>
              <p className="mt-6 text-3xl font-black text-cyan-200">{item.price}</p>
              <ul className="mt-6 space-y-3">
                {item.features.map((feature) => (
                  <li key={feature} className="flex gap-3 text-sm leading-6 text-slate-300">
                    <CheckCircle2 className="mt-1 shrink-0 text-cyan-200" size={17} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Link href="/teklif-al" onClick={() => trackEvent("package_clicked", { package: item.id })} className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-white px-5 text-sm font-black text-slate-950 transition hover:bg-cyan-100">
                {item.cta}
              </Link>
            </PremiumCard>
          </motion.div>
        ))}
    </div>
  );
}
