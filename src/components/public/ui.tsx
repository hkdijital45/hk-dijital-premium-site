import Link from "next/link";
import type { ReactNode } from "react";

export function GlowBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute left-[8%] top-16 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl" />
      <div className="absolute right-[8%] top-52 h-80 w-80 rounded-full bg-amber-300/10 blur-3xl" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.045)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_72%)]" />
    </div>
  );
}

export function SectionHeader({ eyebrow, title, text }: { eyebrow?: string; title: string; text?: string }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      {eyebrow && <p className="text-sm font-bold uppercase tracking-[.26em] text-cyan-200">{eyebrow}</p>}
      <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl">{title}</h1>
      {text && <p className="mt-5 text-base leading-8 text-slate-300 sm:text-lg">{text}</p>}
    </div>
  );
}

export function PremiumCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-[8px] border border-white/10 bg-white/[0.055] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,.08),0_24px_70px_rgba(0,0,0,.35)] backdrop-blur-xl ${className}`}>
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
    <Link href={href} className={`inline-flex min-h-12 items-center justify-center rounded-full px-6 text-sm font-black transition focus:outline-none focus:ring-2 focus:ring-cyan-300 ${className}`}>
      {children}
    </Link>
  );
}

export function PageHero({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <section className="relative overflow-hidden px-4 py-20 sm:px-6 lg:px-8">
      <GlowBackground />
      <div className="relative mx-auto max-w-7xl">
        <SectionHeader eyebrow={eyebrow} title={title} text={text} />
      </div>
    </section>
  );
}
