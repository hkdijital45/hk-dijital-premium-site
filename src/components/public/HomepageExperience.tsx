"use client";
import { resolvePublicWhatsappUrl } from "@/lib/public-contact";

import { useId, useState } from "react";
import type { KeyboardEvent } from "react";
import Link from "next/link";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import {
  ArrowRight, ChevronDown, ClipboardCheck, Compass, FileSearch2,
  Handshake, LineChart, Map, MessageCircle, MousePointerClick, Rocket, ShieldCheck,
  Sparkles, Target, Wallet, Zap
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { SiteContent } from "@/lib/types";
import type { PublicBrandShowcase } from "@/lib/brand-showcase-public";
import { BrandShowcaseSection } from "./BrandShowcaseSection";
import { serviceIcons } from "@/lib/icons";
import { trackMetaCtaClick } from "@/lib/meta-pixel";
import { trackEvent } from "./TrackingPlaceholders";
import { blogPosts } from "@/lib/public-seo-content";
import { PACKAGE_CATEGORIES } from "@/lib/packages";
import { MarketingBadge, MarketingCard, MarketingEyebrow, MarketingHeading, MarketingReveal, MarketingSection } from "./marketing/MarketingUI";
import { platformMarks } from "./PlatformIcons";
import { ServiceVisual } from "./marketing/MarketingVisualSystem";
import { serviceVisualVariantForKey } from "./marketing/serviceVisualVariant";
import { AdOperationsPanel } from "./AdOperationsPanel";

/* ---------------------------------------------------------------------
   Real content, pulled directly from Supabase-backed site content — no
   invented services, prices, or claims. The 8 real services (with their
   real icon assignments) come from content.services; process/trust/FAQ
   copy is the same real HK Dijital copy this site already used before
   this visual redesign, only the presentation changed.
   --------------------------------------------------------------------- */

const processSteps: Array<{ label: string; text: string; Icon: LucideIcon }> = [
  { label: "Analiz", text: "İşletme, hedef kitle ve mevcut dijital varlıklar birlikte değerlendirilir.", Icon: FileSearch2 },
  { label: "Strateji", text: "Kanal, bütçe ve mesaj önceliği hedefe göre netleştirilir.", Icon: Compass },
  { label: "Kurulum", text: "Kampanya, ölçümleme ve içerik altyapısı devreye alınır.", Icon: ClipboardCheck },
  { label: "Yayın", text: "Reklam ve içerikler planlanan takvimle yayına çıkar.", Icon: Rocket },
  { label: "Optimizasyon", text: "Sinyaller izlenir, bütçe ve kreatif buna göre ayarlanır.", Icon: Zap },
  { label: "Raporlama", text: "Sonuçlar anlaşılır bir dille, sade raporla paylaşılır.", Icon: LineChart },
  { label: "Büyüme", text: "Öğrenilenler bir sonraki döneme aksiyon olarak taşınır.", Icon: Sparkles }
];

const whyHkPoints: Array<{ title: string; text: string; Icon: LucideIcon }> = [
  { title: "Yerel bilgi", text: "Manisa ve ilçelerindeki işletme dinamiklerini yakından tanıyan bir ajans deneyimi.", Icon: Map },
  { title: "Kişisel ilgi", text: "Her hesap toplu bir şablon değil, kendi hedefine göre yönetilen ayrı bir çalışma olarak ele alınır.", Icon: Handshake },
  { title: "Şeffaf iletişim", text: "Bütçe, kapsam ve beklenti başında netleşir; süreç boyunca aynı netlikte iletişim sürer.", Icon: MessageCircle },
  { title: "Veri odaklı yaklaşım", text: "Kararlar izlenime değil, ölçülen sinyale — tıklama, mesaj, form, maliyet — dayanır.", Icon: LineChart },
  { title: "Önce strateji, sonra reklam", text: "Bütçe yayına çıkmadan önce hedef, teklif ve kanal uyumu netleştirilir.", Icon: Compass },
  { title: "Gerçekçi beklenti", text: "Satış garantisi verilmez; ölçülebilir bir büyüme sistemi kurulur ve işletilir.", Icon: ShieldCheck }
];

const faqEntries: Array<[string, string]> = [
  ["Hangi işletmelerle çalışıyorsunuz?", "Manisa merkez ve ilçelerindeki yerel işletmelerle; ayrıca Türkiye genelinde uzaktan çalışma modeliyle büyümek isteyen markalarla çalışıyoruz."],
  ["Reklam bütçesi hizmet ücretine dahil mi?", "Hayır. Reklam bütçesi doğrudan Meta veya Google'a ödenir; hizmet bedeli strateji, kurulum, optimizasyon ve raporlama çalışmasını kapsar."],
  ["Satış garantisi veriyor musunuz?", "Hayır. Satış garantisi verilmez; strateji, kurulum, optimizasyon, dönüşüm takibi ve raporlama süreci yönetilir."],
  ["Sonuçlar ne kadar sürede görülür?", "İlk sinyaller genellikle kampanya yayına girdikten sonraki ilk haftalarda görülür; sağlıklı bir değerlendirme için 60-90 günlük bir optimizasyon süreci önerilir."],
  ["Paket nasıl seçilir?", "Paket seçimi sektör, hedef ve bütçeye göre değişir. Paket Seçme Robotu birkaç soruyla size uygun paketi önerir; ön görüşmede birlikte netleştirebiliriz."],
  ["Sözleşme veya taahhüt var mı?", "Kapsam ve çalışma süresi ön görüşmede netleştirilir; şartlar teklif aşamasında açıkça paylaşılır."],
  ["Raporlama nasıl yapılır?", "Kampanya ve içerik performansı düzenli aralıklarla, anlaşılır Türkçe yorumlar ve sonraki adım önerileriyle raporlanır."]
];

function FaqAccordion({ limit }: { limit?: number } = {}) {
  const baseId = useId();
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const entries = limit ? faqEntries.slice(0, limit) : faqEntries;
  return (
    <div className="grid gap-1">
      {entries.map(([question, answer], index) => {
        const open = openIndex === index;
        const panelId = `${baseId}-panel-${index}`;
        const buttonId = `${baseId}-button-${index}`;
        return (
          <div key={question} className="border-b py-1" style={{ borderColor: "var(--mk-border)" }}>
            <h3>
              <button type="button" id={buttonId} aria-expanded={open} aria-controls={panelId} onClick={() => setOpenIndex(open ? null : index)} className="flex w-full items-center justify-between gap-4 py-4 text-left text-base font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#107C73]" style={{ color: "var(--mk-ink)" }}>
                {question}
                <ChevronDown size={18} className="shrink-0 text-[#107C73] transition-transform duration-300" style={{ transform: open ? "rotate(180deg)" : undefined }} aria-hidden="true" />
              </button>
            </h3>
            <div id={panelId} role="region" aria-labelledby={buttonId} hidden={!open} className="pb-4">
              <p className="max-w-xl text-sm leading-7" style={{ color: "var(--mk-ink-soft)" }}>{answer}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

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

/**
 * Performance cleanup: the hero previously pinned a 200vh section and
 * scroll-scrubbed a multi-MB video (MacBookEcosystem) — a heavy
 * requestAnimationFrame loop, an always-fetched video/poster pair, and an
 * artificial scroll-hijack-adjacent "fake sticky" transform, all removed.
 * This is now a normal-flow section — the only motion left is the one-shot
 * mount entrance (MarketingReveal fade/rise + the CSS-only headline
 * mask-reveal/chroma accent in globals.css) — no scroll listeners, no RAF
 * loop, no video fetch at all.
 *
 * 2026-10 repaint: the device-mockup screenshot (hero-poster.png — a
 * blurry raster image with its own text baked into the pixels) is replaced
 * by AdOperationsPanel, a real HTML/CSS/SVG illustrative ad-ops panel —
 * crisp at any zoom, translatable/selectable text, no invented metrics.
 */
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

/* -------------------------------- Services ------------------------------ */

/**
 * Desktop (lg+) service explorer — replaces the plain card grid with a
 * real two-pane interaction: a keyboard/mouse-driven index on the left,
 * the active service's real copy + visual cross-fading on the right.
 * Adapts docs/animation-reference/08-service-explorer.md's interaction
 * grammar to this project's real 8 services (no fabricated metrics — the
 * per-service visual is the same ServiceVisual fragment family already
 * used elsewhere, which itself only ever shows literal "—" placeholders).
 * Mobile/tablet get a deliberately different composition (the existing
 * horizontal scroll-snap swipe row below), not a shrunk copy of this.
 */
function ServiceExplorer({ services }: { services: SiteContent["services"] }) {
  const [active, setActive] = useState(0);
  const service = services[active] ?? services[0];
  if (!service) return null;
  const Icon = serviceIcons[service.icon] ?? Sparkles;
  const variant = serviceVisualVariantForKey(service.id);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowDown") { event.preventDefault(); setActive((i) => (i + 1) % services.length); }
    if (event.key === "ArrowUp") { event.preventDefault(); setActive((i) => (i - 1 + services.length) % services.length); }
  }

  return (
    <div className="service-explorer hidden lg:grid" role="tablist" aria-label="Hizmetler" aria-orientation="vertical" onKeyDown={onKeyDown}>
      <div className="service-explorer-list">
        {services.map((item, index) => {
          const ItemIcon = serviceIcons[item.icon] ?? Sparkles;
          const isActive = index === active;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`service-tab-${item.id}`}
              aria-selected={isActive}
              aria-controls={`service-panel-${item.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActive(index)}
              onFocus={() => setActive(index)}
              className={`service-explorer-item ${isActive ? "service-explorer-item-active" : ""}`}
            >
              <span className="service-explorer-item-index">0{index + 1}</span>
              <ItemIcon size={18} className="shrink-0" />
              <span className="service-explorer-item-label">{item.name}</span>
              <ArrowRight size={16} className="service-explorer-item-arrow" />
            </button>
          );
        })}
      </div>
      <div className="service-explorer-panel" role="tabpanel" id={`service-panel-${service.id}`} aria-labelledby={`service-tab-${service.id}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={service.id}
            initial={{ opacity: 0, y: 16, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.985 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="ads-story-visual max-w-sm">
              <div className="ads-story-badge grid h-14 w-14 place-items-center rounded-2xl" style={{ color: "var(--mk-violet)" }}>
                <Icon size={24} />
              </div>
              <ServiceVisual variant={variant} />
            </div>
            <MarketingHeading className="mt-8 text-2xl sm:text-[1.85rem]">{service.name}</MarketingHeading>
            <p className="mt-4 max-w-md text-sm leading-7" style={{ color: "var(--mk-ink-soft)" }}>{service.description}</p>
            <p className="ads-story-problem">
              <span className="ads-story-problem-label">Hangi problemi çözer?</span> {service.problem}
            </p>
            <div className="mt-7">
              <Link href="/hizmetler" className="marketing-btn marketing-btn-secondary inline-flex items-center gap-1.5">Hizmeti incele <ArrowRight size={16} /></Link>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function ServicesSection({ services }: { services: SiteContent["services"] }) {
  const visible = services.filter((service) => service.visible).sort((a, b) => a.order - b.order);
  return (
    <MarketingSection id="services">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <MarketingReveal>
          <MarketingEyebrow>Hizmetler</MarketingEyebrow>
          <MarketingHeading className="mt-4 max-w-2xl text-3xl sm:text-5xl">Markanızı <span className="marketing-gradient-text">büyümeye</span> bağlayan sistem</MarketingHeading>
          <p className="mt-5 max-w-2xl text-base leading-8" style={{ color: "var(--mk-ink-soft)" }}>Her kanal kendi başına değil; hedef, bütçe, teklif, dönüşüm takibi ve raporlamayla birlikte yönetildiğinde sağlıklı karar üretir.</p>
        </MarketingReveal>
        <MarketingReveal delay={0.1} className="mt-12">
          <ServiceExplorer services={visible} />
        </MarketingReveal>
        <div className="marketing-swipe-row mt-12 grid gap-4 lg:hidden md:grid-cols-2">
          {visible.map((service, index) => {
            const Icon = serviceIcons[service.icon] ?? Sparkles;
            const featured = index === 0 || index === 1;
            return (
              <MarketingReveal key={service.id} delay={index * 0.05} className={featured ? "md:col-span-2" : ""}>
                <MarketingCard feature={featured} className="flex h-full flex-col p-7">
                  <div className="grid size-12 place-items-center rounded-xl" style={{ background: "var(--mk-bg-alt)", color: "var(--mk-violet)" }}>
                    <Icon size={22} />
                  </div>
                  <h3 className="mt-6 text-xl font-black" style={{ color: "var(--mk-ink)" }}>{service.name}</h3>
                  <p className="mt-3 text-sm leading-7" style={{ color: "var(--mk-ink-soft)" }}>{service.description}</p>
                  <p className="mt-4 text-xs font-bold" style={{ color: "var(--mk-ink-faint)" }}>{service.problem}</p>
                  <div className="mt-auto pt-5">
                    <Link href="/hizmetler" className="marketing-btn-ghost inline-flex items-center gap-1.5 text-sm">Hizmeti incele <ArrowRight size={15} /></Link>
                  </div>
                </MarketingCard>
              </MarketingReveal>
            );
          })}
        </div>
      </div>
    </MarketingSection>
  );
}

/* ----------------------- Strategic value proposition ---------------------- */

/**
 * 2026-10 IA simplification: merges what used to be four separate homepage
 * sections (Performance/proofMetrics, AI-GEO, Process, Trust) into one.
 * Nothing here is new copy — every sentence already existed in one of
 * those four sections; this just drops the redundant parts (the 4 numeric
 * "proof metric" cards, which repeated the same "örnek senaryo" idea the
 * hero's AdOperationsPanel already shows more concretely, and the AI/GEO
 * example-query visual, which repeated the same "örnek görselleştirme"
 * pattern) and compacts the rest. `id="process"` is kept so the existing
 * header link (/#process) and any external links to it keep working.
 */
function ValuePropSection() {
  return (
    <MarketingSection dark id="process" className="overflow-hidden">
      <div className="marketing-section-bleed" aria-hidden="true" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <MarketingReveal>
          <MarketingEyebrow>Neden HK Dijital</MarketingEyebrow>
          <MarketingHeading className="mt-4 max-w-2xl text-3xl sm:text-5xl">Deneyim, <span className="marketing-gradient-text">şeffaflık</span> ve net bir süreç</MarketingHeading>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-400">Satış garantisi vermeyiz; kararlar izlenime değil ölçülen sinyale dayanır, bütçe yayına çıkmadan önce hedef ve kanal uyumu netleştirilir.</p>
        </MarketingReveal>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {whyHkPoints.slice(0, 3).map((point) => (
            <MarketingReveal key={point.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <point.Icon size={20} className="text-[#23D9CE]" />
              <h3 className="mt-3 text-base font-black text-white">{point.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{point.text}</p>
            </MarketingReveal>
          ))}
        </div>

        <div className="mt-10 border-t border-white/10 pt-10">
          <MarketingEyebrow>Nasıl Çalışıyoruz</MarketingEyebrow>
          <div className="mt-5 flex flex-wrap gap-2.5">
            {processSteps.map((step, index) => (
              <div key={step.label} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] py-2 pl-2.5 pr-4">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white/10 text-[11px] font-black text-white">{index + 1}</span>
                <step.Icon size={14} className="text-[#23D9CE]" />
                <span className="text-xs font-bold text-white">{step.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start gap-3 border-t border-white/10 pt-10 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-sm leading-7 text-slate-400">
            <span className="font-black text-white">Yapay zekâ destekli görünürlük:</span> arama artık yalnızca Google değil — HK Intelligence, Gemini gibi motorlardaki marka görünürlüğünüzü de analiz eder.
          </p>
          <Link href="/hk-intelligence" className="inline-flex shrink-0 items-center gap-2 text-sm font-black text-white">HK Intelligence&apos;ı inceleyin <ArrowRight size={16} /></Link>
        </div>
      </div>
    </MarketingSection>
  );
}

/* -------------------------------- Final CTA -------------------------------- */

/**
 * Also carries a compact package-category strip (replacing the old
 * separate, full PackagesTeaser section — same 4 real categories, same
 * /paketler destination, no invented pricing shown here since the real
 * prices already live on /paketler and in the full AdsStorySection-era
 * teaser this replaces) so "see pricing" and "take action" read as one
 * beat instead of two separate sections.
 */
function FinalCtaSection({ whatsappUrl }: { whatsappUrl: string | null }) {
  return (
    <MarketingSection>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <MarketingReveal>
          <div className="flex flex-wrap items-center justify-center gap-2.5 pb-6">
            {PACKAGE_CATEGORIES.map((category) => (
              <Link key={category.key} href="/paketler" onClick={() => trackEvent("package_category_clicked", { category: category.key, href: "/paketler" })} className="rounded-full border px-4 py-2 text-xs font-bold transition hover:-translate-y-0.5" style={{ borderColor: "var(--mk-border-strong)", color: "var(--mk-ink-soft)" }}>
                {category.shortLabel}
              </Link>
            ))}
          </div>
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

/* --------------------------- FAQ + Blog + Contact -------------------------- */

/**
 * Replaces the old separate FaqBlogSection + full-width ContactSection
 * (which embedded a second copy of <ContactForm>). The FAQ is trimmed to
 * its top 4 of 7 real questions (most-asked first, per the original
 * array order); the rest remain exactly where they always were — nothing
 * deleted, just not all shown twice on the homepage. The contact form
 * itself is NOT duplicated here: this section only offers the same
 * WhatsApp/teklif-form quick actions the old ContactSection already had
 * alongside its embedded form, and links to /iletisim for the full form
 * (still exactly as it was, untouched).
 */
function FaqAndContactSection({ whatsappUrl }: { whatsappUrl: string | null }) {
  return (
    <MarketingSection id="faq-blog" alt>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <MarketingReveal>
          <MarketingEyebrow>Kaynaklar</MarketingEyebrow>
          <MarketingHeading className="mt-4 max-w-2xl text-3xl sm:text-5xl">Merak <span className="marketing-gradient-text">Ettikleriniz</span></MarketingHeading>
        </MarketingReveal>
        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_.85fr]">
          <FaqAccordion limit={4} />
          <div className="grid gap-4">
            {blogPosts.map((post) => (
              <Link key={post.slug} href={`/blog/${post.slug}`}>
                <MarketingCard className="p-6">
                  <p className="text-xs font-black uppercase tracking-wide text-[#107C73]">{post.readingTime}</p>
                  <h3 className="mt-3 text-xl font-black" style={{ color: "var(--mk-ink)" }}>{post.title}</h3>
                  <p className="mt-3 text-sm leading-7" style={{ color: "var(--mk-ink-soft)" }}>{post.description}</p>
                </MarketingCard>
              </Link>
            ))}
          </div>
        </div>
        <div className="mt-10 flex flex-col items-start justify-between gap-5 border-t pt-8 sm:flex-row sm:items-center" style={{ borderColor: "var(--mk-border)" }}>
          <div className="grid gap-2 text-xs" style={{ color: "var(--mk-ink-faint)" }}>
            <span className="flex items-center gap-2"><Wallet size={14} className="text-[#107C73]" /> Fiyatlara KDV dahil değildir.</span>
            <span className="flex items-center gap-2"><Target size={14} className="text-[#107C73]" /> Reklam bütçesi hizmet bedelinden ayrıdır.</span>
            <span className="flex items-center gap-2"><MousePointerClick size={14} className="text-[#107C73]" /> Satış garantisi verilmez, süreç ölçülür ve raporlanır.</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {whatsappUrl && <WhatsappLink href={whatsappUrl} trackingLabel="Final WhatsApp ile Görüş">WhatsApp ile Görüş</WhatsappLink>}
            <SecondaryLink href="/iletisim" trackingLabel="Final İletişim Formu">İletişim Formunu Aç</SecondaryLink>
          </div>
        </div>
      </div>
    </MarketingSection>
  );
}

/* ------------------------------- Composition -------------------------------- */

// 2026-10 IA simplification: 16 sections → 7. Every KEEP/MOVE/MERGE/REMOVE
// decision is documented in docs/PUBLIC-SITE-REDESIGN-2026-10.md. Nothing
// here is new copy — removed sections' real content either already lives
// on its own dedicated page (Google/Meta Ads "story" detail →
// /hizmetler/*, Manisa/district content → /manisa-dijital-pazarlama, now
// linked from the footer) or was folded, trimmed, into ValuePropSection /
// FaqAndContactSection above.
export function HomepageExperience({ content, brands = [] }: { content: SiteContent; brands?: PublicBrandShowcase[] }) {
  const whatsappUrl = resolvePublicWhatsappUrl(content.socials?.whatsapp, content.contact?.whatsappNumber);
  const services = content.services || [];

  return (
    <MotionConfig reducedMotion="user">
      <div className="marketing-shell relative">
        <Hero whatsappUrl={whatsappUrl} />
        <PlatformStrip />
        <ServicesSection services={services} />
        <ValuePropSection />
        <BrandShowcaseSection brands={brands} />
        <FinalCtaSection whatsappUrl={whatsappUrl} />
        <FaqAndContactSection whatsappUrl={whatsappUrl} />
      </div>
    </MotionConfig>
  );
}
