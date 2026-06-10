import Link from "next/link";
import type { ReactNode } from "react";
import { AnimatedMarketingDashboard, BrandEcosystemStrip, PremiumBackground } from "@/components/premium/PremiumUI";

export function GlowBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="premium-grid public-grid-drive absolute inset-0" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/70 to-yellow-200/40" />
      <div className="absolute bottom-0 left-1/2 h-64 w-[72rem] -translate-x-1/2 bg-[radial-gradient(ellipse_at_bottom,rgba(14,116,144,.22),transparent_64%)]" />
      <div className="public-beam public-beam-a" />
      <div className="public-beam public-beam-b" />
    </div>
  );
}

export function SectionHeader({ eyebrow, title, text }: { eyebrow?: string; title: string; text?: string }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      {eyebrow && <p className="glitch-label text-sm font-black uppercase tracking-[.26em] text-cyan-200" data-text={eyebrow}>{eyebrow}</p>}
      <h1 className="split-reveal mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl">{title}</h1>
      {text && <p className="mt-5 text-base leading-8 text-slate-300 sm:text-lg">{text}</p>}
    </div>
  );
}

export function PremiumCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`impact-card glass-card p-6 transition duration-300 hover:-translate-y-1 hover:border-cyan-200/25 ${className}`}>
      {children}
    </div>
  );
}

export function ButtonLink({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: "primary" | "ghost" }) {
  const className =
    variant === "primary"
      ? "bg-cyan-300 text-slate-950 shadow-[0_0_38px_rgba(18,217,255,.28)] hover:bg-cyan-200"
      : "border border-white/15 bg-white/[0.05] text-white hover:border-cyan-200/50";

  return (
    <Link href={href} className={`impact-btn inline-flex min-h-12 items-center justify-center rounded-full px-6 text-sm font-black transition focus:outline-none focus:ring-2 focus:ring-cyan-300 ${className}`}>
      {children}
    </Link>
  );
}

export function PageHero({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <section className="page-impact-hero relative overflow-hidden border-b border-white/5 px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
      <PremiumBackground />
      <div className="relative mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[.95fr_1.05fr]">
        <div className="text-left">
          <p className="glitch-label text-sm font-black uppercase tracking-[.26em] text-cyan-200" data-text={eyebrow}>{eyebrow}</p>
          <h1 className="split-reveal mt-4 text-3xl font-black tracking-tight text-white sm:text-6xl">{title}</h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">{text}</p>
          <div className="mt-7"><BrandEcosystemStrip compact /></div>
        </div>
        <AnimatedMarketingDashboard className="scale-95 lg:scale-100" />
      </div>
    </section>
  );
}
