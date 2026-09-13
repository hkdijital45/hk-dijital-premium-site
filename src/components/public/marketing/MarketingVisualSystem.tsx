"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, BarChart3, CalendarDays, Layers, MessageCircle, Search, Sparkles, Users2 } from "lucide-react";
import { trackMetaCtaClick } from "@/lib/meta-pixel";
// ServiceVisualVariant / serviceVisualVariantForKey live in the sibling
// serviceVisualVariant.ts (deliberately NOT "use client") so Server
// Components (e.g. /hizmetler/page.tsx) can call the mapping function
// directly — re-exporting it from this "use client" file would turn it back
// into an unusable client reference from the server's perspective. Import
// serviceVisualVariantForKey from "./serviceVisualVariant" directly instead.
import type { ServiceVisualVariant } from "./serviceVisualVariant";

/**
 * Site-wide visual motifs shared by secondary public pages, extending the
 * homepage's MacBook/digital-ecosystem language without repeating the
 * MacBook itself. Kept deliberately small: a decorative network backdrop, a
 * per-service mini "dashboard" fragment (the same visual family as the
 * homepage's Google/Meta Ads cards), a small stat chip, and one reusable
 * closing CTA — reused across pages instead of each page inventing its own
 * markup. Everything here is presentational; no page content/copy lives in
 * this file.
 */

/* ------------------------------ Network backdrop ------------------------------ */

/**
 * A quiet decorative network of nodes + connecting lines behind a page hero
 * — the same visual DNA as the homepage's hero connector paths, without a
 * MacBook. Purely aria-hidden; renders as a static (non-animated) SVG under
 * prefers-reduced-motion.
 */
export function MarketingNetworkBackground({ variant = "default" }: { variant?: "default" | "converge" }) {
  const reduced = useReducedMotion();
  const nodes = variant === "converge"
    ? [[8, 20], [92, 15], [12, 82], [88, 78], [50, 50]]
    : [[10, 15], [85, 10], [95, 60], [15, 85], [55, 40]];
  const center = variant === "converge" ? [50, 50] : [50, 45];
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible opacity-[0.55]" viewBox="0 0 100 100" preserveAspectRatio="none" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="mk-net-thread" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--mk-violet)" stopOpacity="0.35" />
          <stop offset="1" stopColor="var(--mk-blue)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {nodes.map(([x, y], index) => (
        <motion.line
          key={`line-${x}-${y}`}
          x1={x} y1={y} x2={center[0]} y2={center[1]}
          stroke="url(#mk-net-thread)" strokeWidth={0.25}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={reduced ? { delay: 0, duration: 0.01 } : { delay: 0.15 + index * 0.08, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        />
      ))}
      {[...nodes, center].map(([x, y], index) => (
        <circle key={`node-${x}-${y}`} cx={x} cy={y} r={index === nodes.length ? 1.1 : 0.6} fill="var(--mk-violet)" opacity={index === nodes.length ? 0.5 : 0.3} />
      ))}
    </svg>
  );
}

/* ------------------------------- Service visuals ------------------------------- */

function GoogleAdsFragment() {
  return (
    <div className="grid gap-2.5 rounded-xl border p-3.5" style={{ borderColor: "var(--mk-border)", background: "var(--mk-bg-alt)" }} aria-hidden="true">
      <div className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2" style={{ borderColor: "var(--mk-border)" }}>
        <Search size={14} className="shrink-0 text-[#4285F4]" />
        <span className="truncate text-xs font-bold" style={{ color: "var(--mk-ink-soft)" }}>&quot;manisa diş kliniği randevu&quot;</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {["Yüksek niyet", "Rakip terimi", "Yerel arama"].map((tag) => (
          <span key={tag} className="rounded-full border px-2.5 py-1 text-[10px] font-black" style={{ borderColor: "var(--mk-border)", color: "var(--mk-ink-faint)" }}>{tag}</span>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[["ROAS", "—"], ["CPC", "—"], ["Dönüşüm", "—"]].map(([label, value]) => (
          <div key={label} className="rounded-lg bg-white p-2 text-center" style={{ border: "1px solid var(--mk-border)" }}>
            <p className="text-[8px] font-bold uppercase tracking-wide" style={{ color: "var(--mk-ink-faint)" }}>{label}</p>
            <p className="text-sm font-black" style={{ color: "var(--mk-ink)" }}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetaAdsFragment() {
  const rows = [
    { label: "Kampanya", sub: "Randevu hedefli", Icon: Layers },
    { label: "Reklam Seti", sub: "18-45 · yerel hedef kitle", Icon: Users2 },
    { label: "Kreatif", sub: "Video + karusel varyantı", Icon: Sparkles }
  ];
  return (
    <div className="grid gap-2 rounded-xl border p-3.5" style={{ borderColor: "var(--mk-border)", background: "var(--mk-bg-alt)" }} aria-hidden="true">
      {rows.map((row, index) => (
        <div key={row.label} className="flex items-center gap-2.5 rounded-lg border bg-white px-3 py-2" style={{ borderColor: "var(--mk-border)", marginLeft: index * 10 }}>
          <row.Icon size={14} className="shrink-0 text-[#7c3aed]" />
          <span className="min-w-0">
            <span className="block truncate text-[11px] font-black" style={{ color: "var(--mk-ink)" }}>{row.label}</span>
            <span className="block truncate text-[10px] font-bold" style={{ color: "var(--mk-ink-faint)" }}>{row.sub}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function SocialMediaFragment() {
  return (
    <div className="grid gap-2 rounded-xl border p-3.5" style={{ borderColor: "var(--mk-border)", background: "var(--mk-bg-alt)" }} aria-hidden="true">
      <div className="grid grid-cols-4 gap-1.5">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="aspect-square rounded-[5px]" style={{ background: [1, 4].includes(index) ? "linear-gradient(135deg, #7c3aed, #db2777)" : "rgba(15,16,36,.06)" }} />
        ))}
      </div>
      <div className="flex items-center gap-2.5 rounded-lg border bg-white px-3 py-2" style={{ borderColor: "var(--mk-border)" }}>
        <CalendarDays size={14} className="shrink-0 text-[#7c3aed]" />
        <span className="text-[11px] font-black" style={{ color: "var(--mk-ink)" }}>Bu hafta 4 gönderi · 3 Reels</span>
      </div>
    </div>
  );
}

function ConsultancyFragment() {
  const steps = ["Hedef", "Kanal", "Bütçe", "Ölçüm"];
  return (
    <div className="grid gap-2 rounded-xl border p-3.5" style={{ borderColor: "var(--mk-border)", background: "var(--mk-bg-alt)" }} aria-hidden="true">
      <div className="flex items-center gap-1.5">
        {steps.map((step, index) => (
          <div key={step} className="flex flex-1 items-center gap-1.5">
            <span className="grid size-6 shrink-0 place-items-center rounded-full text-[9px] font-black text-white" style={{ background: "var(--mk-violet)" }}>{index + 1}</span>
            {index < steps.length - 1 && <span className="h-px flex-1" style={{ background: "var(--mk-border-strong)" }} />}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2.5 rounded-lg border bg-white px-3 py-2" style={{ borderColor: "var(--mk-border)" }}>
        <BarChart3 size={14} className="shrink-0 text-[#7c3aed]" />
        <span className="text-[11px] font-black" style={{ color: "var(--mk-ink)" }}>Tek stratejide birleşen sistem</span>
      </div>
    </div>
  );
}

/** A small, service-specific mini-dashboard fragment — the same visual family as the homepage's Google/Meta Ads cards, reused on /hizmetler and its detail pages instead of a generic icon. */
export function ServiceVisual({ variant, className = "" }: { variant: ServiceVisualVariant; className?: string }) {
  const content =
    variant === "googleAds" ? <GoogleAdsFragment /> :
    variant === "metaAds" ? <MetaAdsFragment /> :
    variant === "socialMedia" ? <SocialMediaFragment /> :
    <ConsultancyFragment />;
  return <div className={className}>{content}</div>;
}

/* --------------------------------- Stat chip --------------------------------- */

// Takes an already-rendered icon element (icon={<MapPin size={16} />}), not a
// bare component reference — a raw function/component reference passed as a
// prop value from a Server Component to this Client Component is not
// serializable ("Functions cannot be passed directly to Client Components");
// a rendered ReactNode is.
export function MarketingDashboardCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-white p-3.5 text-center" style={{ borderColor: "var(--mk-border)" }}>
      <div className="mx-auto grid size-6 place-items-center text-[#7c3aed]">{icon}</div>
      <p className="mt-2 text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--mk-ink-faint)" }}>{label}</p>
      <p className="mt-1 text-sm font-black" style={{ color: "var(--mk-ink)" }}>{value}</p>
    </div>
  );
}

/* ------------------------------- Reusable closing CTA ------------------------------- */

export function MarketingCTA({
  eyebrow = "Sonraki Adım", title, text, primaryHref = "/teklif-al", primaryLabel = "Paketini Bul",
  secondaryHref, secondaryLabel, trackingPrefix = "CTA"
}: {
  eyebrow?: string; title: string; text?: string; primaryHref?: string; primaryLabel?: string;
  secondaryHref?: string; secondaryLabel?: string; trackingPrefix?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-[28px] px-6 py-14 text-center sm:px-16" style={{ background: "linear-gradient(120deg, #5b21b6, #4338ca 55%, #a21caf)" }}>
      <p className="text-xs font-black uppercase tracking-[.22em] text-white/80">{eyebrow}</p>
      <h2 className="mx-auto mt-5 max-w-2xl text-3xl font-black leading-tight text-white sm:text-4xl">{title}</h2>
      {text && <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-white/85">{text}</p>}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <Link href={primaryHref} onClick={() => trackMetaCtaClick(`${trackingPrefix} ${primaryLabel}`, primaryHref)} className="inline-flex min-h-13 items-center gap-2 rounded-full bg-white px-6 text-sm font-black text-[#4338ca] transition hover:-translate-y-0.5">
          {primaryLabel} <ArrowRight size={18} />
        </Link>
        {secondaryHref && secondaryLabel && (
          <a href={secondaryHref} target={secondaryHref.startsWith("http") ? "_blank" : undefined} rel={secondaryHref.startsWith("http") ? "noreferrer" : undefined} onClick={() => trackMetaCtaClick(`${trackingPrefix} ${secondaryLabel}`, secondaryHref)} className="inline-flex min-h-13 items-center gap-2 rounded-full border border-white/40 bg-white/10 px-6 text-sm font-black text-white backdrop-blur transition hover:bg-white/20">
            {secondaryLabel} {secondaryHref.startsWith("http") ? <MessageCircle size={18} /> : <ArrowRight size={18} />}
          </a>
        )}
      </div>
    </div>
  );
}

export function MarketingCTASection({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">{children}</div>;
}
