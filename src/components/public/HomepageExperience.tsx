"use client";
import { resolvePublicWhatsappUrl } from "@/lib/public-contact";

import Link from "next/link";
import { ArrowRight, Blocks, BookOpen, ClipboardList, Handshake, MessageCircle, PackageCheck } from "lucide-react";
import type { ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import type { PublicSiteContent } from "@/lib/types";
import { trackMetaCtaClick } from "@/lib/meta-pixel";
import { MarketingBadge, MarketingCard, MarketingEyebrow, MarketingHeading, MarketingReveal, MarketingSection } from "./marketing/MarketingUI";
import { platformMarks } from "./PlatformIcons";
import { AdOperationsPanel } from "./AdOperationsPanel";

/* ---------------------------------------------------------------------
   2026-10-11 IA simplification, Phase 4: the homepage is now exactly the
   6-point structure requested — logo/nav (Header, rendered by Shell, not
   here), hero + CTA + AdOperationsPanel, slogan + platform marquee, ONE
   compact discovery area linking to the real detail pages, one closing
   CTA, footer (Shell again). Every other section that used to live here
   (service explorer, process/trust/AI-GEO, package category pills, FAQ,
   blog teasers, brand gallery) was REMOVED from this file, not hidden —
   their real content/data already lives on, or was moved to, the
   dedicated page the matching discovery card links to:
     Hizmetler        -> /hizmetler (already had everything)
     Paketler          -> /paketler (already had everything; FAQ moved there)
     Nasıl Çalışıyoruz -> /hizmetler#surec (moved there, see processSteps)
     Çalıştığımız Markalar -> /calistigimiz-markalar (already had the full
                               gallery — this page no longer imports
                               BrandShowcaseSection at all, so brand data
                               is fetched/rendered exactly once sitewide)
     Blog              -> /blog (already had everything)
   See docs/PUBLIC-SITE-REDESIGN-2026-10.md for the full before/after
   section table.
   --------------------------------------------------------------------- */

function PrimaryLink({ href, children, trackingLabel, aurora }: { href: string; children: ReactNode; trackingLabel: string; aurora?: boolean }) {
  return <Link href={href} onClick={() => trackMetaCtaClick(trackingLabel, href)} className={`marketing-btn marketing-btn-primary${aurora ? " marketing-aurora-btn" : ""}`}>{children}</Link>;
}
function SecondaryLink({ href, children, trackingLabel }: { href: string; children: ReactNode; trackingLabel: string }) {
  return <Link href={href} onClick={() => trackMetaCtaClick(trackingLabel, href)} className="marketing-btn marketing-btn-secondary">{children}</Link>;
}
function WhatsappLink({ href, children, trackingLabel }: { href: string; children: ReactNode; trackingLabel: string }) {
  return <a href={href} target="_blank" rel="noreferrer" onClick={() => trackMetaCtaClick(trackingLabel, href)} className="marketing-btn" style={{ background: "#25D366", color: "#fff", boxShadow: "0 12px 30px rgba(37,211,102,.28)" }}>{children}</a>;
}

/* ------------------------------- Hero -------------------------------- */

function Hero({ whatsappUrl }: { whatsappUrl: string | null }) {
  return (
    <section id="hero" className="relative border-b" style={{ borderColor: "var(--mk-border)", overflowX: "clip" }}>
      <div className="marketing-bokeh" aria-hidden="true">
        <span style={{ width: 90, height: 90, top: "12%", left: "6%" }} />
        <span style={{ width: 54, height: 54, top: "62%", left: "18%", animationDelay: "-4s" }} />
      </div>
      <div className="marketing-glow" style={{ width: 480, height: 480, top: -200, left: "-10%", background: "rgba(16, 124, 115,.13)" }} aria-hidden="true" />
      <div className="marketing-glow" style={{ width: 380, height: 380, top: -100, right: "-8%", background: "rgba(16, 124, 115,.1)" }} aria-hidden="true" />
      <div className="relative mx-auto grid w-full max-w-7xl items-center gap-14 px-4 py-20 sm:px-6 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:py-28">
        <div>
          <MarketingReveal>
            <MarketingEyebrow>Manisa merkezli dijital pazarlama ve reklam ajansı</MarketingEyebrow>
            <MarketingHeading as="h1" className="hero-headline mt-6 text-4xl sm:text-6xl lg:text-[4.4rem]">
              <span className="hero-headline-line"><span className="hero-headline-line-inner">Dijitalde</span></span>
              <span className="hero-headline-line"><span className="hero-headline-line-inner">Büyümeyi <span className="marketing-gradient-text marketing-chroma" data-text="Şansa">Şansa</span></span></span>
              <span className="hero-headline-line"><span className="hero-headline-line-inner">Bırakmayın</span></span>
            </MarketingHeading>
            <p className="mt-7 max-w-xl text-base leading-8 sm:text-lg" style={{ color: "var(--mk-ink-soft)" }}>
              HK Dijital; Google Ads, Meta reklamları ve sosyal medya yönetimini tek stratejide birleştirip yapay zekâ destekli görünürlük analiziyle destekleyen ölçülebilir bir dijital büyüme sistemi kurar.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <PrimaryLink href="/teklif-al" trackingLabel="Hero Paketini Bul" aurora>Ücretsiz Ön Analiz <ArrowRight size={18} /></PrimaryLink>
              <SecondaryLink href="/hizmetler" trackingLabel="Hero Hizmetleri İncele">Hizmetleri İncele</SecondaryLink>
              {whatsappUrl && <WhatsappLink href={whatsappUrl} trackingLabel="Hero WhatsApp'tan Görüş">WhatsApp&apos;tan Görüşelim <MessageCircle size={18} /></WhatsappLink>}
            </div>
            <div className="mt-9 flex flex-wrap gap-2">
              {["Manisa merkezli", "Türkiye geneli hizmet", "Şeffaf raporlama", "Satış garantisi değil, ölçülebilir sistem"].map((item) => (
                <MarketingBadge key={item}>{item}</MarketingBadge>
              ))}
            </div>
          </MarketingReveal>
        </div>
        <div className="relative mx-auto w-full max-w-lg py-6">
          <MarketingReveal delay={0.1}>
            <AdOperationsPanel />
          </MarketingReveal>
        </div>
      </div>
    </section>
  );
}

/* --------------------------- Platform strip --------------------------- */

function PlatformStrip() {
  // Seamless marquee of the same real platform marks already used
  // elsewhere on the site (never implying partnership — see
  // PlatformIcons.tsx). Track is duplicated once so the -50% loop point
  // lines up exactly; under prefers-reduced-motion, globals.css freezes
  // the animation and wraps the (now-doubled) row instead, so the
  // duplicate set is hidden there via the nth-child(n+8) rule.
  return (
    <MarketingSection alt className="!py-14 border-y">
      <div className="mx-auto max-w-6xl px-4 text-center sm:px-6 lg:px-8">
        <MarketingReveal>
          <p className="text-xl font-bold sm:text-2xl" style={{ color: "var(--mk-ink)" }}>Markanız her yerde. <span className="marketing-gradient-text">Stratejiniz tek yerde.</span></p>
        </MarketingReveal>
      </div>
      <div className="marketing-marquee mt-8">
        <div className="marketing-marquee-track">
          {[...platformMarks, ...platformMarks].map(({ key, label, Icon }, index) => (
            <div key={`${key}-${index}`} className="flex items-center gap-2 opacity-80 transition hover:opacity-100">
              <Icon className="size-7" />
              <span className="whitespace-nowrap text-sm font-bold" style={{ color: "var(--mk-ink-soft)" }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </MarketingSection>
  );
}

/* ------------------------------ Discovery ------------------------------ */

const DISCOVERY_CARDS = [
  { href: "/hizmetler", Icon: Blocks, title: "Hizmetler", text: "Meta, Google Ads, sosyal medya ve danışmanlık kapsamını inceleyin.", tracking: "Discovery Hizmetler" },
  { href: "/paketler", Icon: PackageCheck, title: "Paketler", text: "Fiyat, kapsam ve Paket Analiz Robotu ile doğru başlangıcı bulun.", tracking: "Discovery Paketler" },
  { href: "/hizmetler#surec", Icon: ClipboardList, title: "Nasıl Çalışıyoruz", text: "Analizden raporlamaya kadar çalışma sürecimizi görün.", tracking: "Discovery Süreç" },
  { href: "/calistigimiz-markalar", Icon: Handshake, title: "Çalıştığımız Markalar", text: "Birlikte çalıştığımız markaları ve kapsamı inceleyin.", tracking: "Discovery Markalar" },
  { href: "/blog", Icon: BookOpen, title: "Blog", text: "Reklam ve dijital pazarlama üzerine pratik rehberler okuyun.", tracking: "Discovery Blog" }
] as const;

function DiscoverySection() {
  return (
    <MarketingSection id="kesif">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <MarketingReveal>
          <MarketingEyebrow>Keşfedin</MarketingEyebrow>
          <MarketingHeading className="mt-4 max-w-2xl text-3xl sm:text-5xl">Detaylar <span className="marketing-gradient-text">ilgili sayfada</span></MarketingHeading>
        </MarketingReveal>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DISCOVERY_CARDS.map((card, index) => (
            <MarketingReveal key={card.href} delay={index * 0.04} className={index === 0 ? "sm:col-span-2 lg:col-span-1" : ""}>
              <Link href={card.href} onClick={() => trackMetaCtaClick(card.tracking, card.href)} className="block h-full">
                <MarketingCard className="flex h-full flex-col p-6">
                  <div className="grid size-11 place-items-center rounded-xl" style={{ background: "var(--mk-bg-alt)", color: "var(--mk-violet)" }}>
                    <card.Icon size={20} />
                  </div>
                  <h3 className="mt-5 text-lg font-black" style={{ color: "var(--mk-ink)" }}>{card.title}</h3>
                  <p className="mt-2 text-sm leading-6" style={{ color: "var(--mk-ink-soft)" }}>{card.text}</p>
                  <span className="mt-auto flex items-center gap-1.5 pt-4 text-sm font-black" style={{ color: "#107C73" }}>İncele <ArrowRight size={15} /></span>
                </MarketingCard>
              </Link>
            </MarketingReveal>
          ))}
        </div>
      </div>
    </MarketingSection>
  );
}

/* -------------------------------- Final CTA -------------------------------- */

function FinalCtaSection({ whatsappUrl }: { whatsappUrl: string | null }) {
  return (
    <MarketingSection>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <MarketingReveal>
          <div className="relative overflow-hidden rounded-[28px] px-6 py-16 text-center sm:px-16" style={{ background: "linear-gradient(120deg, #07111B, #0D1B28 55%, #107C73)" }}>
            <div className="marketing-bokeh" aria-hidden="true">
              <span style={{ width: 70, height: 70, top: "10%", left: "8%" }} />
              <span style={{ width: 46, height: 46, top: "65%", left: "20%", animationDelay: "-5s" }} />
              <span style={{ width: 56, height: 56, top: "20%", right: "12%", animationDelay: "-9s" }} />
            </div>
            <div className="marketing-wave-bg" aria-hidden="true" />
            <p className="text-xs font-black uppercase tracking-[.22em] text-white/80">Sonraki Adım</p>
            <h2 className="mt-5 text-3xl font-black leading-tight text-white sm:text-5xl">Reklamınızı Büyümeye Çevirin</h2>
            <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-white/85">Satış garantisi vermeyiz — strateji, kurulum, optimizasyon, dönüşüm takibi ve raporlama sürecini uçtan uca yönetiriz.</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link href="/teklif-al" onClick={() => trackMetaCtaClick("Final CTA Paketini Bul", "/teklif-al")} className="marketing-aurora-btn inline-flex min-h-13 items-center gap-2 rounded-full bg-white px-6 text-sm font-black text-[#107C73] transition hover:-translate-y-0.5">Ücretsiz Ön Analiz <ArrowRight size={18} /></Link>
              {whatsappUrl && <a href={whatsappUrl} target="_blank" rel="noreferrer" onClick={() => trackMetaCtaClick("Final CTA WhatsApp", whatsappUrl)} className="inline-flex min-h-13 items-center gap-2 rounded-full border border-white/40 bg-white/10 px-6 text-sm font-black text-white backdrop-blur transition hover:bg-white/20">WhatsApp&apos;tan Görüş <MessageCircle size={18} /></a>}
            </div>
          </div>
        </MarketingReveal>
      </div>
    </MarketingSection>
  );
}

/* ------------------------------- Composition -------------------------------- */

export function HomepageExperience({ content }: { content: PublicSiteContent }) {
  const whatsappUrl = resolvePublicWhatsappUrl(content.socials?.whatsapp, content.contact?.whatsappNumber, undefined, content.contact?.whatsappDefaultMessage);

  return (
    <MotionConfig reducedMotion="user">
      <div className="marketing-shell relative">
        <Hero whatsappUrl={whatsappUrl} />
        <PlatformStrip />
        <DiscoverySection />
        <FinalCtaSection whatsappUrl={whatsappUrl} />
      </div>
    </MotionConfig>
  );
}
