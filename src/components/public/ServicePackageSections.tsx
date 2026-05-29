"use client";

import Link from "next/link";
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
        .map((service) => {
          const Icon = serviceIcons[service.icon] ?? serviceIcons.Sparkles;
          return (
            <PremiumCard key={service.id} className="group">
              <div className="grid size-12 place-items-center rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 text-cyan-200 transition group-hover:scale-105">
                <Icon size={22} />
              </div>
              <h2 className="mt-5 text-xl font-black text-white">{service.name}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">{service.description}</p>
              <Link href="/teklif-al" className="mt-5 inline-flex text-sm font-bold text-cyan-200">
                {service.cta}
              </Link>
            </PremiumCard>
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
        .map((item) => (
          <PremiumCard key={item.id} className={item.recommended ? "relative border-cyan-200/50 bg-cyan-200/[0.08]" : ""}>
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
        ))}
    </div>
  );
}
