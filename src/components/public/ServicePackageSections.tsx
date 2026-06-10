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
            <motion.div key={service.id} initial={{ opacity: 0, y: 58, rotateX: 12, scale: .94 }} whileInView={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }} viewport={{ once: true, margin: "-90px" }} transition={{ duration: .58, delay: index * .055, ease: [0.16, 1, 0.3, 1] }} whileHover={{ y: -10, rotateX: 4, rotateY: index % 2 ? 4 : -4, scale: 1.012 }} whileTap={{ scale: .985 }}>
              <PremiumCard className="group impact-card relative h-full overflow-hidden">
                <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/80 to-yellow-200/70 opacity-0 transition group-hover:opacity-100" />
                <div className="absolute -right-10 -top-10 size-28 rounded-full bg-cyan-300/10 blur-3xl transition group-hover:bg-yellow-300/20" />
                <div className="grid size-12 place-items-center rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 text-cyan-200 transition group-hover:scale-110 group-hover:bg-cyan-200/20 group-hover:text-yellow-100">
                  <Icon size={22} />
                </div>
                <h2 className="mt-5 text-xl font-black text-white">{service.name}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">{service.description}</p>
                <Link href="/teklif-al" className="impact-link mt-5 inline-flex text-sm font-black text-cyan-200">
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
          <motion.div key={item.id} initial={{ opacity: 0, y: 62, rotateX: 10, scale: .92 }} whileInView={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: .65, delay: index * .08, ease: [0.16, 1, 0.3, 1] }} whileHover={{ y: -12, rotateX: 4, rotateY: index === 1 ? 0 : index === 0 ? -4 : 4, scale: 1.015 }} whileTap={{ scale: .985 }}>
            <PremiumCard className={`group impact-card h-full overflow-hidden ${item.recommended ? "relative border-cyan-200/50 bg-cyan-200/[0.08] shadow-[0_0_70px_rgba(34,211,238,.16)]" : "relative"}`}>
              <div className="absolute -right-10 -top-12 h-32 w-32 rounded-full bg-cyan-300/10 blur-3xl transition group-hover:bg-yellow-300/20" />
              {item.recommended && (
                <span className="pulse-badge absolute right-5 top-5 rounded-full bg-amber-300 px-3 py-1 text-xs font-black text-slate-950">
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
              <Link href="/teklif-al" onClick={() => trackEvent("package_clicked", { package: item.id })} className="impact-btn mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-white px-5 text-sm font-black text-slate-950 transition hover:bg-cyan-100">
                {item.cta}
              </Link>
            </PremiumCard>
          </motion.div>
        ))}
    </div>
  );
}
