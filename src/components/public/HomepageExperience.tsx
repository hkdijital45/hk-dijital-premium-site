"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { motion, MotionConfig, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from "framer-motion";
import {
  ArrowRight, BarChart3, CalendarDays, ChevronDown, Clapperboard, ClipboardCheck, Compass, FileSearch2,
  Handshake, LineChart, Map, MessageCircle, MousePointerClick, Rocket, ShieldCheck,
  Sparkles, Target, Wallet, Zap
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { SiteContent } from "@/lib/types";
import { serviceIcons } from "@/lib/icons";
import { ContactForm } from "./ContactForm";
import { trackMetaCtaClick } from "@/lib/meta-pixel";
import { blogPosts } from "@/lib/public-seo-content";
import { PACKAGE_CATEGORIES, formatTRY, getPackagePricing, servicePackagesByCategory } from "@/lib/packages";
import { CheckCircle2 } from "@/lib/icons";
import { MacBookMockup, MacBookScreenChip } from "./MacBookMockup";
import { MarketingBadge, MarketingCard, MarketingEyebrow, MarketingHeading, MarketingReveal, MarketingSection } from "./marketing/MarketingUI";
import { GoogleMark, InstagramMark, MetaMark, platformMarks } from "./PlatformIcons";

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

const proofMetrics: Array<[string, string, string]> = [
  ["3.8%", "CTR", "Reklamı görenlerin tıklama davranışını görünür hale getirir."],
  ["₺4,20", "CPC", "Reklam bütçesini daha kontrollü yönetmeye yardımcı olur."],
  ["5.4x", "ROAS", "Satış garantisi değil, ölçülebilir büyüme sistemi."],
  ["128", "Dönüşüm", "Form, arama, WhatsApp veya satış aksiyonu tek ekranda takip edilir."]
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

function FaqAccordion() {
  const baseId = useId();
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  return (
    <div className="grid gap-1">
      {faqEntries.map(([question, answer], index) => {
        const open = openIndex === index;
        const panelId = `${baseId}-panel-${index}`;
        const buttonId = `${baseId}-button-${index}`;
        return (
          <div key={question} className="border-b py-1" style={{ borderColor: "var(--mk-border)" }}>
            <h3>
              <button type="button" id={buttonId} aria-expanded={open} aria-controls={panelId} onClick={() => setOpenIndex(open ? null : index)} className="flex w-full items-center justify-between gap-4 py-4 text-left text-base font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7c3aed]" style={{ color: "var(--mk-ink)" }}>
                {question}
                <ChevronDown size={18} className="shrink-0 text-[#7c3aed] transition-transform duration-300" style={{ transform: open ? "rotate(180deg)" : undefined }} aria-hidden="true" />
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

function PrimaryLink({ href, children, trackingLabel }: { href: string; children: ReactNode; trackingLabel: string }) {
  return <Link href={href} onClick={() => trackMetaCtaClick(trackingLabel, href)} className="marketing-btn marketing-btn-primary">{children}</Link>;
}
function SecondaryLink({ href, children, trackingLabel }: { href: string; children: ReactNode; trackingLabel: string }) {
  return <Link href={href} onClick={() => trackMetaCtaClick(trackingLabel, href)} className="marketing-btn marketing-btn-secondary">{children}</Link>;
}
function WhatsappLink({ href, children, trackingLabel }: { href: string; children: ReactNode; trackingLabel: string }) {
  return <a href={href} target="_blank" rel="noreferrer" onClick={() => trackMetaCtaClick(trackingLabel, href)} className="marketing-btn" style={{ background: "#25D366", color: "#fff", boxShadow: "0 12px 30px rgba(37,211,102,.28)" }}>{children}</a>;
}

/* ------------------------------- Hero -------------------------------- */

function HeroDeviceComposition() {
  const reduced = useReducedMotion();
  return (
    <div className="relative mx-auto w-full max-w-lg">
      <div className="pointer-events-none absolute inset-0 rounded-full blur-3xl" style={{ background: "radial-gradient(circle, rgba(124,58,237,.16), transparent 65%)" }} aria-hidden="true" />
      <MacBookMockup
        screen={
          <div className="flex h-full flex-col gap-[6%] p-[7%]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-[.14em] text-[#c4b5fd]">Kampanya Genel Bakış</span>
              <span className="macbook-screen-dot" aria-hidden="true" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[["ROAS", "—"], ["CTR", "—"], ["Lead", "—"]].map(([label, value]) => (
                <div key={label} className="rounded-[6px] border border-white/10 bg-white/[0.04] p-2 text-center">
                  <p className="text-[8px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
                  <p className="mt-1 text-sm font-black text-white">{value}</p>
                </div>
              ))}
            </div>
            <div className="grid gap-2">
              <MacBookScreenChip label="Google Ads kampanyası" note="Yayında" />
              <MacBookScreenChip label="Instagram içerik takvimi" note="Bu hafta 4 gönderi" />
            </div>
            <p className="mt-auto text-[8px] leading-4 text-slate-500">Örnek/illüstratif çalışma alanı görünümü.</p>
          </div>
        }
      />
      {!reduced && (
        <>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5 }} className="absolute -left-6 top-6 grid size-14 place-items-center rounded-2xl border bg-white p-3 shadow-[0_18px_46px_rgba(15,16,36,.16)]" style={{ borderColor: "var(--mk-border)" }}>
            <GoogleMark className="h-full w-full" />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.5 }} className="absolute -right-4 top-16 grid size-14 place-items-center rounded-2xl border bg-white p-3 shadow-[0_18px_46px_rgba(15,16,36,.16)]" style={{ borderColor: "var(--mk-border)" }}>
            <MetaMark className="h-full w-full" />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.5 }} className="absolute -bottom-3 left-10 grid size-14 place-items-center rounded-2xl border bg-white p-3 shadow-[0_18px_46px_rgba(15,16,36,.16)]" style={{ borderColor: "var(--mk-border)" }}>
            <InstagramMark className="h-full w-full" />
          </motion.div>
        </>
      )}
    </div>
  );
}

function Hero({ whatsappUrl }: { whatsappUrl: string }) {
  return (
    <section className="relative overflow-hidden border-b" style={{ borderColor: "var(--mk-border)" }}>
      <div className="marketing-glow" style={{ width: 480, height: 480, top: -200, left: "-10%", background: "rgba(124,58,237,.13)" }} aria-hidden="true" />
      <div className="marketing-glow" style={{ width: 380, height: 380, top: -100, right: "-8%", background: "rgba(37,99,235,.1)" }} aria-hidden="true" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 py-20 sm:px-6 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:py-28">
        <MarketingReveal>
          <MarketingEyebrow>Manisa merkezli dijital pazarlama ve reklam ajansı</MarketingEyebrow>
          <MarketingHeading as="h1" className="mt-6 text-4xl sm:text-6xl lg:text-[4.4rem]">
            Dijitalde Büyümeyi <span className="marketing-gradient-text">Şansa</span> Bırakmayın
          </MarketingHeading>
          <p className="mt-7 max-w-xl text-base leading-8 sm:text-lg" style={{ color: "var(--mk-ink-soft)" }}>
            HK Dijital; Google Ads, Meta reklamları ve sosyal medya yönetimini tek stratejide birleştirip yapay zekâ destekli görünürlük analiziyle destekleyen ölçülebilir bir dijital büyüme sistemi kurar.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <PrimaryLink href="/teklif-al" trackingLabel="Hero Paketini Bul">Paketini Bul <ArrowRight size={18} /></PrimaryLink>
            <SecondaryLink href="/hizmetler" trackingLabel="Hero Hizmetleri İncele">Hizmetleri İncele</SecondaryLink>
            <WhatsappLink href={whatsappUrl} trackingLabel="Hero WhatsApp'tan Görüş">WhatsApp&apos;tan Görüşelim <MessageCircle size={18} /></WhatsappLink>
          </div>
          <div className="mt-9 flex flex-wrap gap-2">
            {["Manisa merkezli", "Türkiye geneli hizmet", "Şeffaf raporlama", "Satış garantisi değil, ölçülebilir sistem"].map((item) => (
              <MarketingBadge key={item}>{item}</MarketingBadge>
            ))}
          </div>
        </MarketingReveal>
        <MarketingReveal delay={0.15}>
          <HeroDeviceComposition />
        </MarketingReveal>
      </div>
    </section>
  );
}

/* --------------------------- Platform strip --------------------------- */

function PlatformStrip() {
  return (
    <MarketingSection alt className="!py-14 border-y" >
      <div className="mx-auto max-w-6xl px-4 text-center sm:px-6 lg:px-8">
        <MarketingReveal>
          <p className="text-xl font-bold sm:text-2xl" style={{ color: "var(--mk-ink)" }}>Markanız her yerde. <span className="marketing-gradient-text">Stratejiniz tek yerde.</span></p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-5">
            {platformMarks.map(({ key, label, Icon }) => (
              <div key={key} className="flex items-center gap-2 opacity-80 transition hover:opacity-100">
                <Icon className="size-7" />
                <span className="text-sm font-bold" style={{ color: "var(--mk-ink-soft)" }}>{label}</span>
              </div>
            ))}
          </div>
        </MarketingReveal>
      </div>
    </MarketingSection>
  );
}

/* --------------------------- Ads story sections ------------------------ */

function AdsStorySection({
  id, reverse, badgeIcon: BadgeIcon, eyebrow, title, description, problem, bullets, ctaLabel, trackingLabel
}: {
  id: string; reverse?: boolean; badgeIcon: LucideIcon; eyebrow: string; title: string; description: string; problem: string; bullets: string[]; ctaLabel: string; trackingLabel: string;
}) {
  return (
    <MarketingSection id={id}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className={`grid items-center gap-12 lg:grid-cols-2 ${reverse ? "lg:[&>*:first-child]:order-2" : ""}`}>
          <MarketingReveal>
            <div className="relative">
              <div className="marketing-glow" style={{ width: 260, height: 260, top: -40, left: reverse ? undefined : -40, right: reverse ? -40 : undefined, background: "rgba(124,58,237,.1)" }} aria-hidden="true" />
              <MarketingCard feature className="relative p-8">
                <div className="grid h-14 w-14 place-items-center rounded-2xl" style={{ background: "linear-gradient(135deg, rgba(124,58,237,.12), rgba(37,99,235,.1))", color: "var(--mk-violet)" }}>
                  <BadgeIcon size={26} />
                </div>
                <div className="mt-6 grid gap-3">
                  {bullets.map((bullet) => (
                    <div key={bullet} className="flex items-start gap-2.5 rounded-xl border p-3 text-sm font-semibold" style={{ borderColor: "var(--mk-border)", color: "var(--mk-ink)" }}>
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#7c3aed]" /> {bullet}
                    </div>
                  ))}
                </div>
              </MarketingCard>
            </div>
          </MarketingReveal>
          <MarketingReveal delay={0.1}>
            <MarketingEyebrow>{eyebrow}</MarketingEyebrow>
            <MarketingHeading className="mt-4 text-3xl sm:text-4xl">{title}</MarketingHeading>
            <p className="mt-5 text-base leading-8" style={{ color: "var(--mk-ink-soft)" }}>{description}</p>
            <p className="mt-4 rounded-xl border p-4 text-sm leading-6" style={{ borderColor: "var(--mk-border)", background: "var(--mk-bg-alt)", color: "var(--mk-ink-soft)" }}><b style={{ color: "var(--mk-ink)" }}>Hangi problemi çözer? </b>{problem}</p>
            <div className="mt-7">
              <PrimaryLink href="/teklif-al" trackingLabel={trackingLabel}>{ctaLabel} <ArrowRight size={18} /></PrimaryLink>
            </div>
          </MarketingReveal>
        </div>
      </div>
    </MarketingSection>
  );
}

/* ------------------------ Social media management ----------------------- */

function PhoneMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[240px]">
      <div className="rounded-[2.4rem] border-[6px] p-2 shadow-[0_30px_80px_rgba(15,16,36,.22)]" style={{ borderColor: "#14132b", background: "#14132b" }}>
        <div className="relative aspect-[9/19] overflow-hidden rounded-[1.9rem]" style={{ background: "#0b0a1a" }}>
          <div className="absolute left-1/2 top-2 h-4 w-20 -translate-x-1/2 rounded-full bg-black/60" aria-hidden="true" />
          <div className="flex h-full flex-col gap-3 p-4 pt-8">
            <div className="flex items-center gap-2">
              <InstagramMark className="size-6" />
              <span className="text-[10px] font-black uppercase tracking-wide text-white/80">Reels Planı</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {Array.from({ length: 9 }).map((_, index) => (
                <div key={index} className="aspect-square rounded-[6px]" style={{ background: [1, 4, 7].includes(index) ? "linear-gradient(135deg, #7c3aed, #db2777)" : "rgba(255,255,255,.08)" }} />
              ))}
            </div>
            <div className="mt-auto rounded-xl p-3" style={{ background: "rgba(255,255,255,.06)" }}>
              <p className="text-[9px] font-bold text-white/70">Bu hafta yayında</p>
              <p className="mt-1 text-[10px] font-black text-white">3 Reels · 2 Gönderi</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SocialMediaSection({ description }: { description: string }) {
  const reduced = useReducedMotion();
  const cards = [
    { label: "İçerik Takvimi", Icon: CalendarDays, pos: { top: "4%", left: "-6%" } },
    { label: "Kreatif Üretim", Icon: Clapperboard, pos: { top: "20%", right: "-10%" } },
    { label: "Topluluk & Analiz", Icon: BarChart3, pos: { bottom: "8%", left: "-10%" } }
  ];
  return (
    <MarketingSection id="sosyal-medya-yonetimi" alt>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <MarketingReveal>
            <MarketingEyebrow>Sosyal Medya Yönetimi</MarketingEyebrow>
            <MarketingHeading className="mt-4 text-3xl sm:text-5xl">İçerikten <span className="marketing-gradient-text">Topluluğa</span> Tek Akış</MarketingHeading>
            <p className="mt-5 text-base leading-8" style={{ color: "var(--mk-ink-soft)" }}>{description}</p>
          </MarketingReveal>
        </div>
        <div className="relative mx-auto mt-14 max-w-md">
          <PhoneMockup />
          {!reduced && cards.map((card, index) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, amount: "some" }}
              transition={{ duration: 0.5, delay: 0.15 + index * 0.12 }}
              className="absolute hidden items-center gap-2 rounded-2xl border bg-white px-4 py-3 shadow-[0_18px_46px_rgba(15,16,36,.14)] sm:flex"
              style={{ ...card.pos, borderColor: "var(--mk-border)" }}
            >
              <card.Icon size={16} className="text-[#7c3aed]" />
              <span className="whitespace-nowrap text-xs font-black" style={{ color: "var(--mk-ink)" }}>{card.label}</span>
            </motion.div>
          ))}
          <div className="mt-10 grid grid-cols-1 gap-3 sm:hidden">
            {cards.map((card) => (
              <div key={card.label} className="flex items-center gap-2 rounded-xl border bg-white px-4 py-3" style={{ borderColor: "var(--mk-border)" }}>
                <card.Icon size={16} className="text-[#7c3aed]" />
                <span className="text-xs font-black" style={{ color: "var(--mk-ink)" }}>{card.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MarketingSection>
  );
}

/* -------------------------------- Services ------------------------------ */

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
        <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((service, index) => {
            const Icon = serviceIcons[service.icon] ?? Sparkles;
            const featured = index === 0 || index === 1;
            return (
              <MarketingReveal key={service.id} delay={index * 0.05} className={featured ? "md:col-span-2 xl:col-span-1" : ""}>
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

/* --------------------------- Performance (dark) -------------------------- */

function PerformanceSection() {
  return (
    <MarketingSection dark id="performans">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <MarketingReveal>
          <MarketingEyebrow>Performans Pazarlama</MarketingEyebrow>
          <MarketingHeading className="mt-4 max-w-2xl text-3xl sm:text-5xl">Veriye bakmak yetmez. <span className="marketing-gradient-text">Veriyi aksiyona</span> dönüştürmek gerekir.</MarketingHeading>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-400">Aşağıdaki gösterge panosu örnek bir senaryodur — satış garantisi değil, ölçülebilir bir sistemdir.</p>
        </MarketingReveal>
        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {proofMetrics.map(([value, label, text]) => (
            <MarketingReveal key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-3xl font-black text-white">{value}</p>
              <p className="mt-2 text-xs font-black uppercase tracking-wide text-[#c4b5fd]">{label}</p>
              <p className="mt-2 text-xs leading-5 text-slate-500">{text}</p>
            </MarketingReveal>
          ))}
        </div>
      </div>
    </MarketingSection>
  );
}

/* --------------------------------- AI / GEO ------------------------------ */

function AiGeoSection() {
  const reduced = useReducedMotion();
  return (
    <MarketingSection dark id="ai-geo" className="border-t border-white/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_.9fr]">
          <MarketingReveal>
            <MarketingEyebrow>Yapay Zekâ Destekli Görünürlük</MarketingEyebrow>
            <MarketingHeading className="mt-4 text-3xl sm:text-4xl">Reklam ve sosyal medya operasyonunuz, <span className="marketing-gradient-text">yapay zekâ ile desteklenir.</span></MarketingHeading>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-400">
              Arama artık yalnızca Google değil; kullanıcılar Gemini gibi yapay zekâ motorlarına da soru soruyor. HK Dijital&apos;in kullandığı yapay zekâ katmanı; görünürlük analizi, dijital olgunluk değerlendirmesi ve içerik/kampanya fikirleriyle ana reklam ve sosyal medya çalışmasını destekler.
            </p>
            <Link href="/hk-intelligence" className="mt-7 inline-flex items-center gap-2 text-sm font-black text-white">HK Intelligence sistemini inceleyin <ArrowRight size={16} /></Link>
          </MarketingReveal>
          <MarketingReveal delay={0.1}>
            <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              {!reduced && <div className="marketing-scanline" aria-hidden="true" />}
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Örnek görselleştirme — gerçek müşteri verisi değildir</p>
              <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs font-bold text-slate-400">&quot;Bölgede güvenilir hizmet sağlayıcı önerir misin?&quot;</p>
                <p className="mt-2 text-sm leading-6 text-slate-200">Yapay zekâ yanıtında markanızın adı, alternatif adları ve rakip görünürlüğü tespit edilir.</p>
              </div>
              <div className="mt-3 flex items-center justify-between rounded-xl border border-[#a78bfa]/25 bg-[#7c3aed]/[0.1] p-4">
                <span className="text-xs font-bold text-slate-300">Görünürlük Skoru</span>
                <span className="text-lg font-black text-white">—/100</span>
              </div>
            </div>
          </MarketingReveal>
        </div>
      </div>
    </MarketingSection>
  );
}

/* --------------------------------- Process ------------------------------- */

function ProcessSection() {
  const reduced = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start 0.75", "end 0.35"] });
  const fillScale = useTransform(scrollYProgress, [0, 1], [0, 1]);
  useMotionValueEvent(scrollYProgress, "change", (value) => {
    setActive(Math.min(processSteps.length - 1, Math.max(0, Math.floor(value * processSteps.length))));
  });

  return (
    <MarketingSection id="process" alt>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <MarketingReveal>
          <MarketingEyebrow>Nasıl Çalışıyoruz</MarketingEyebrow>
          <MarketingHeading className="mt-4 max-w-2xl text-3xl sm:text-5xl">Keşiften <span className="marketing-gradient-text">Rapora</span> Kadar</MarketingHeading>
        </MarketingReveal>
        <div ref={containerRef} className="mt-12 grid gap-8 lg:grid-cols-[auto_1fr]">
          <div className="hidden lg:flex lg:justify-center">
            <div className="marketing-progress-track h-full min-h-[480px]">
              <motion.div className="marketing-progress-fill" style={reduced ? { height: "100%" } : { scaleY: fillScale, height: "100%" }} />
            </div>
          </div>
          <div className="grid gap-3">
            {processSteps.map((step, index) => {
              const isActive = !reduced && index === active;
              return (
                <motion.div
                  key={step.label}
                  initial={reduced ? false : { opacity: 0, x: 20 }}
                  whileInView={reduced ? undefined : { opacity: 1, x: 0 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: 0.5 }}
                  className="flex items-center gap-4 rounded-2xl border p-5 transition"
                  style={{ borderColor: isActive ? "var(--mk-violet)" : "var(--mk-border)", background: isActive ? "rgba(124,58,237,.06)" : "var(--mk-surface)" }}
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-full border text-sm font-black italic" style={{ borderColor: isActive ? "var(--mk-violet)" : "var(--mk-border-strong)", color: isActive ? "var(--mk-violet)" : "var(--mk-ink-faint)" }}>0{index + 1}</span>
                  <step.Icon size={20} className={isActive ? "text-[#7c3aed]" : ""} style={{ color: isActive ? undefined : "var(--mk-ink-faint)" }} />
                  <div>
                    <h3 className="text-base font-black sm:text-lg" style={{ color: "var(--mk-ink)" }}>{step.label}</h3>
                    <p className="mt-1 text-sm leading-6" style={{ color: "var(--mk-ink-soft)" }}>{step.text}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </MarketingSection>
  );
}

/* --------------------------------- Packages entry ------------------------- */

function PackagesTeaser({ intro }: { intro: string }) {
  const [active, setActive] = useState(PACKAGE_CATEGORIES[0].key);
  const activeCategory = PACKAGE_CATEGORIES.find((category) => category.key === active) || PACKAGE_CATEGORIES[0];
  return (
    <MarketingSection id="packages">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <MarketingReveal>
          <MarketingEyebrow>Paketler</MarketingEyebrow>
          <MarketingHeading className="mt-4 max-w-2xl text-3xl sm:text-5xl">Kapsamı ve <span className="marketing-gradient-text">bütçeyi</span> netleştirin</MarketingHeading>
          <p className="mt-5 max-w-2xl text-base leading-8" style={{ color: "var(--mk-ink-soft)" }}>{intro}</p>
        </MarketingReveal>
        <div className="mt-8 flex flex-wrap gap-2">
          {PACKAGE_CATEGORIES.map((category) => (
            <button key={category.key} type="button" onClick={() => setActive(category.key)} className="rounded-full border px-5 py-2.5 text-sm font-bold transition" style={{ borderColor: active === category.key ? "var(--mk-violet)" : "var(--mk-border-strong)", background: active === category.key ? "var(--mk-violet)" : "transparent", color: active === category.key ? "#fff" : "var(--mk-ink-soft)" }}>
              {category.shortLabel}
            </button>
          ))}
        </div>
        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {servicePackagesByCategory(activeCategory.key).slice(0, 3).map((pkg) => {
            const pricing = getPackagePricing(pkg);
            return (
              <MarketingCard key={pkg.slug} feature={pkg.popular} className="relative p-7">
                {pkg.popular && <span className="absolute right-6 top-6 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white" style={{ background: "linear-gradient(97deg, var(--mk-violet), var(--mk-blue))" }}>Önerilen</span>}
                <h3 className="text-xl font-black" style={{ color: "var(--mk-ink)" }}>{pkg.name}</h3>
                <p className="mt-2 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--mk-ink-faint)" }}>{pkg.idealFor}</p>
                <p className="mt-4 text-3xl font-black" style={{ color: "var(--mk-ink)" }}>{formatTRY(pricing?.basePrice || pkg.monthlyPrice)}<span className="ml-2 text-xs font-bold" style={{ color: "var(--mk-ink-faint)" }}>+KDV/ay</span></p>
                <ul className="mt-5 space-y-2.5">
                  {pkg.features.slice(0, 3).map((feature) => (
                    <li key={feature.label} className="flex gap-2 text-xs leading-5" style={{ color: "var(--mk-ink-soft)" }}>
                      <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-[#7c3aed]" /> <span><b style={{ color: "var(--mk-ink)" }}>{feature.label}:</b> {feature.value}</span>
                    </li>
                  ))}
                </ul>
                <Link href={`/teklif-al?paket=${pkg.slug}`} className="marketing-btn marketing-btn-secondary mt-6 w-full">Bu Paketi Seç</Link>
              </MarketingCard>
            );
          })}
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link href="/paketler" className="marketing-btn-ghost inline-flex items-center gap-1.5">Tüm paketleri görüntüle <ArrowRight size={15} /></Link>
        </div>
      </div>
    </MarketingSection>
  );
}

/* --------------------------------- Trust --------------------------------- */

function TrustSection() {
  return (
    <MarketingSection id="neden-hk" alt>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <MarketingReveal>
          <MarketingEyebrow>Neden HK Dijital</MarketingEyebrow>
          <MarketingHeading className="mt-4 max-w-2xl text-3xl sm:text-5xl">Deneyim ve <span className="marketing-gradient-text">şeffaflık</span></MarketingHeading>
        </MarketingReveal>
        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {whyHkPoints.map((point) => (
            <MarketingCard key={point.title} className="p-6">
              <point.Icon size={22} className="text-[#7c3aed]" />
              <h3 className="mt-4 text-lg font-black" style={{ color: "var(--mk-ink)" }}>{point.title}</h3>
              <p className="mt-2 text-sm leading-7" style={{ color: "var(--mk-ink-soft)" }}>{point.text}</p>
            </MarketingCard>
          ))}
        </div>
      </div>
    </MarketingSection>
  );
}

/* ------------------------------ FAQ + Blog -------------------------------- */

function FaqBlogSection() {
  return (
    <MarketingSection id="faq-blog">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <MarketingReveal>
          <MarketingEyebrow>Kaynaklar</MarketingEyebrow>
          <MarketingHeading className="mt-4 max-w-2xl text-3xl sm:text-5xl">Merak <span className="marketing-gradient-text">Ettikleriniz</span></MarketingHeading>
        </MarketingReveal>
        <div className="mt-10 grid gap-8 lg:grid-cols-[.95fr_1.05fr]">
          <FaqAccordion />
          <div className="grid gap-4">
            {blogPosts.map((post) => (
              <Link key={post.slug} href={`/blog/${post.slug}`}>
                <MarketingCard className="p-6">
                  <p className="text-xs font-black uppercase tracking-wide text-[#7c3aed]">{post.readingTime}</p>
                  <h3 className="mt-3 text-xl font-black" style={{ color: "var(--mk-ink)" }}>{post.title}</h3>
                  <p className="mt-3 text-sm leading-7" style={{ color: "var(--mk-ink-soft)" }}>{post.description}</p>
                </MarketingCard>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </MarketingSection>
  );
}

/* -------------------------------- Final CTA -------------------------------- */

function FinalCtaSection({ whatsappUrl }: { whatsappUrl: string }) {
  return (
    <MarketingSection>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <MarketingReveal>
          <div className="relative overflow-hidden rounded-[28px] px-6 py-16 text-center sm:px-16" style={{ background: "linear-gradient(120deg, #5b21b6, #4338ca 55%, #a21caf)" }}>
            <p className="text-xs font-black uppercase tracking-[.22em] text-white/80">Sonraki Adım</p>
            <h2 className="mt-5 text-3xl font-black leading-tight text-white sm:text-5xl">Reklamınızı Büyümeye Çevirin</h2>
            <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-white/85">Satış garantisi vermeyiz — strateji, kurulum, optimizasyon, dönüşüm takibi ve raporlama sürecini uçtan uca yönetiriz.</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link href="/teklif-al" onClick={() => trackMetaCtaClick("Final CTA Paketini Bul", "/teklif-al")} className="inline-flex min-h-13 items-center gap-2 rounded-full bg-white px-6 text-sm font-black text-[#4338ca] transition hover:-translate-y-0.5">Paketini Bul <ArrowRight size={18} /></Link>
              <a href={whatsappUrl} target="_blank" rel="noreferrer" onClick={() => trackMetaCtaClick("Final CTA WhatsApp", whatsappUrl)} className="inline-flex min-h-13 items-center gap-2 rounded-full border border-white/40 bg-white/10 px-6 text-sm font-black text-white backdrop-blur transition hover:bg-white/20">WhatsApp&apos;tan Görüş <MessageCircle size={18} /></a>
            </div>
          </div>
        </MarketingReveal>
      </div>
    </MarketingSection>
  );
}

/* -------------------------------- Contact --------------------------------- */

function ContactSection({ whatsappUrl }: { whatsappUrl: string }) {
  return (
    <MarketingSection id="contact" alt>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <MarketingReveal>
          <MarketingEyebrow>İletişim</MarketingEyebrow>
          <MarketingHeading className="mt-4 max-w-2xl text-3xl sm:text-5xl">Yol Haritasını <span className="marketing-gradient-text">Netleştirelim</span></MarketingHeading>
        </MarketingReveal>
        <div className="mt-10 grid items-start gap-8 lg:grid-cols-[.9fr_1.1fr]">
          <MarketingCard className="p-7">
            <MessageCircle className="text-[#7c3aed]" size={30} />
            <h3 className="mt-5 text-xl font-black" style={{ color: "var(--mk-ink)" }}>Hızlı başlangıç</h3>
            <p className="mt-4 text-sm leading-7" style={{ color: "var(--mk-ink-soft)" }}>İsterseniz WhatsApp üzerinden doğrudan yazın, isterseniz teklif formunu açıp işletmenizin hedeflerini gönderin.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <WhatsappLink href={whatsappUrl} trackingLabel="Final WhatsApp ile Görüş">WhatsApp ile Görüş</WhatsappLink>
              <SecondaryLink href="/teklif-al" trackingLabel="Final Teklif Formunu Aç">Teklif Formunu Aç</SecondaryLink>
            </div>
            <div className="mt-7 grid gap-2 border-t pt-6 text-xs" style={{ borderColor: "var(--mk-border)", color: "var(--mk-ink-faint)" }}>
              <span className="flex items-center gap-2"><Wallet size={14} className="text-[#7c3aed]" /> Fiyatlara KDV dahil değildir.</span>
              <span className="flex items-center gap-2"><Target size={14} className="text-[#7c3aed]" /> Reklam bütçesi hizmet bedelinden ayrıdır.</span>
              <span className="flex items-center gap-2"><MousePointerClick size={14} className="text-[#7c3aed]" /> Satış garantisi verilmez, süreç ölçülür ve raporlanır.</span>
            </div>
          </MarketingCard>
          <ContactForm />
        </div>
      </div>
    </MarketingSection>
  );
}

/* -------------------------------- Local SEO -------------------------------- */

function LocalSeoSection() {
  const districts = ["Şehzadeler", "Yunusemre", "Akhisar", "Turgutlu", "Salihli", "Soma", "Alaşehir", "Saruhanlı"];
  return (
    <MarketingSection id="local-seo" alt>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <MarketingReveal>
          <MarketingEyebrow>Manisa ve Türkiye geneli</MarketingEyebrow>
          <MarketingHeading className="mt-4 max-w-2xl text-3xl sm:text-5xl">Yerel bilgi, <span className="marketing-gradient-text">geniş kapsam</span></MarketingHeading>
          <p className="mt-5 max-w-2xl text-base leading-8" style={{ color: "var(--mk-ink-soft)" }}>Şehzadeler, Yunusemre, Akhisar, Turgutlu, Salihli, Soma, Alaşehir ve Saruhanlı başta olmak üzere Manisa merkez ve ilçelerine; ayrıca Türkiye geneline uzaktan hizmet veriyoruz.</p>
          <div className="mt-7 flex flex-wrap gap-2">
            {[...districts, "Türkiye Geneli (Uzaktan)"].map((item) => <MarketingBadge key={item}>{item}</MarketingBadge>)}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <SecondaryLink href="/manisa-dijital-pazarlama" trackingLabel="Manisa Landing İncele">Manisa dijital pazarlama hizmetleri</SecondaryLink>
            <Link href="/hakkimda" className="marketing-btn-ghost inline-flex items-center gap-1.5">HK Dijital&apos;i Tanıyın <ArrowRight size={15} /></Link>
          </div>
        </MarketingReveal>
      </div>
    </MarketingSection>
  );
}

/* ------------------------------- Composition -------------------------------- */

export function HomepageExperience({ content }: { content: SiteContent }) {
  const whatsappUrl = content.socials?.whatsapp || (content.contact?.whatsappNumber ? `https://wa.me/${content.contact.whatsappNumber.replace(/\D/g, "")}` : "/iletisim");
  const services = content.services || [];
  const googleAds = services.find((service) => service.id === "google-ads");
  const metaAds = services.find((service) => service.id === "meta-ads");
  const socialStrategy = services.find((service) => service.id === "social-strategy");

  return (
    <MotionConfig reducedMotion="user">
      <div className="marketing-shell relative">
        <Hero whatsappUrl={whatsappUrl} />
        <PlatformStrip />
        {googleAds && (
          <AdsStorySection
            id="google-ads" badgeIcon={GoogleMark as unknown as LucideIcon} eyebrow="Google Ads Yönetimi" title={googleAds.name}
            description={googleAds.description} problem={googleAds.problem}
            bullets={["Anahtar kelime ve teklif stratejisi", "Arama niyeti yüksek trafik", "Ölçülebilir dönüşüm takibi"]}
            ctaLabel="Google Ads için teklif al" trackingLabel="Google Ads Story CTA"
          />
        )}
        {metaAds && (
          <AdsStorySection
            id="meta-ads" reverse badgeIcon={MetaMark as unknown as LucideIcon} eyebrow="Meta Ads Yönetimi" title={metaAds.name}
            description={metaAds.description} problem={metaAds.problem}
            bullets={["Instagram ve Facebook reklam kurgusu", "Kreatif ve hedef kitle testi", "Bütçe ve teklif optimizasyonu"]}
            ctaLabel="Meta Ads için teklif al" trackingLabel="Meta Ads Story CTA"
          />
        )}
        <SocialMediaSection description={socialStrategy?.description || "İçerik, konumlandırma ve reklam dilini markanızın hedeflerine göre sistemleştirin."} />
        <ServicesSection services={services} />
        <PerformanceSection />
        <AiGeoSection />
        <ProcessSection />
        <PackagesTeaser intro={content.pages.packages?.intro || "Meta, Google Ads, kombin reklam yönetimi ve sosyal medya hizmetlerini net kapsam, fiyat ve raporlama disipliniyle karşılaştırın."} />
        <TrustSection />
        <LocalSeoSection />
        <FaqBlogSection />
        <FinalCtaSection whatsappUrl={whatsappUrl} />
        <ContactSection whatsappUrl={whatsappUrl} />
      </div>
    </MotionConfig>
  );
}
