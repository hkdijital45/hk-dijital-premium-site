"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { trackMetaCtaClick } from "@/lib/meta-pixel";

/**
 * Shared primitives for the "marketing v2" bright/editorial public-site
 * redesign. Deliberately new and self-contained — does NOT import from
 * src/components/public/ui.tsx or src/components/premium/PremiumUI.tsx,
 * both of which are also used by /sifre-sifirla, /auth/callback, /kurulum,
 * /super-admin-kurulum, /musteri-paneli and the admin dashboard (confirmed
 * via a full-repo usage audit before this redesign started). Reusing or
 * editing those shared files would risk visually changing protected
 * surfaces this redesign must never touch.
 */

export function MarketingReveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 28 }}
      whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function MarketingSection({ id, dark = false, alt = false, className = "", children }: { id?: string; dark?: boolean; alt?: boolean; className?: string; children: ReactNode }) {
  return (
    <section id={id} className={`marketing-section ${dark ? "marketing-section-dark" : alt ? "marketing-section-alt" : ""} ${className}`}>
      {children}
    </section>
  );
}

export function MarketingEyebrow({ children }: { children: ReactNode }) {
  return <p className="marketing-eyebrow">{children}</p>;
}

export function MarketingHeading({ as: Tag = "h2", children, className = "" }: { as?: "h1" | "h2" | "h3"; children: ReactNode; className?: string }) {
  return <Tag className={`marketing-heading ${className}`}>{children}</Tag>;
}

export function MarketingBadge({ children }: { children: ReactNode }) {
  return <span className="marketing-badge">{children}</span>;
}

export function MarketingCard({ children, className = "", feature = false }: { children: ReactNode; className?: string; feature?: boolean }) {
  return <div className={`marketing-card ${feature ? "marketing-card-feature" : ""} p-6 ${className}`}>{children}</div>;
}

export function MarketingCardDark({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`marketing-card-dark p-6 ${className}`}>{children}</div>;
}

type MarketingButtonProps = {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "whatsapp";
  trackingLabel?: string;
  className?: string;
};

export function MarketingButton({ href, children, variant = "primary", trackingLabel = "Marketing CTA", className = "" }: MarketingButtonProps) {
  const external = href.startsWith("http") || href.startsWith("https://wa.me");
  const variantClass =
    variant === "primary" ? "marketing-btn marketing-btn-primary" :
    variant === "secondary" ? "marketing-btn marketing-btn-secondary" :
    variant === "whatsapp" ? "marketing-btn" : "marketing-btn-ghost inline-flex items-center gap-1.5";
  const whatsappStyle = variant === "whatsapp" ? { background: "#25D366", color: "#fff", boxShadow: "0 12px 30px rgba(37,211,102,.28)" } : undefined;
  return (
    <Link
      href={href}
      onClick={() => trackMetaCtaClick(trackingLabel, href)}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      style={whatsappStyle}
      className={`${variantClass} ${className}`}
    >
      {children}
    </Link>
  );
}

export function MarketingPageHero({
  eyebrow, title, text, actions
}: { eyebrow: string; title: ReactNode; text?: string; actions?: ReactNode }) {
  return (
    <section className="relative overflow-hidden border-b" style={{ borderColor: "var(--mk-border)" }}>
      <div className="marketing-glow" style={{ width: 420, height: 420, top: -160, left: "-8%", background: "rgba(124,58,237,.14)" }} aria-hidden="true" />
      <div className="marketing-glow" style={{ width: 320, height: 320, top: -80, right: "-6%", background: "rgba(37,99,235,.12)" }} aria-hidden="true" />
      <div className="relative mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <MarketingReveal>
          <MarketingEyebrow>{eyebrow}</MarketingEyebrow>
          <MarketingHeading as="h1" className="mt-5 text-4xl sm:text-6xl">{title}</MarketingHeading>
          {text && <p className="mt-6 max-w-2xl text-base leading-8 sm:text-lg" style={{ color: "var(--mk-ink-soft)" }}>{text}</p>}
          {actions && <div className="mt-8 flex flex-wrap gap-3">{actions}</div>}
        </MarketingReveal>
      </div>
    </section>
  );
}
