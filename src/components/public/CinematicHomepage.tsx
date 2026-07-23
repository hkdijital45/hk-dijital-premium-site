"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { motion, MotionConfig } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  CalendarClock,
  ChevronDown,
  ClipboardCheck,
  Compass,
  FileSearch2,
  Handshake,
  Lightbulb,
  LineChart,
  Map,
  MessageCircle,
  MousePointerClick,
  Repeat2,
  Rocket,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  Wallet,
  Zap
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { SiteContent } from "@/lib/types";
import { ContactForm } from "./ContactForm";
import { ServiceGrid } from "./ServicePackageSections";
import { trackMetaCtaClick } from "@/lib/meta-pixel";
import { trackEvent } from "./TrackingPlaceholders";
import { blogPosts } from "@/lib/public-seo-content";
import { PACKAGE_CATEGORIES, formatTRY, getPackagePricing, servicePackagesByCategory } from "@/lib/packages";
import { CheckCircle2 } from "@/lib/icons";
import { DeviceShowcase } from "./DeviceShowcase";

const fixedServices: Array<{ name: string; Icon: LucideIcon; href: string; outcome: string }> = [
  { name: "Meta Reklam Yönetimi", Icon: BarChart3, href: "/hizmetler/meta-reklam-yonetimi", outcome: "Ölçülebilir mesaj, form ve mağaza trafiği." },
  { name: "Google Ads Yönetimi", Icon: Search, href: "/hizmetler/google-ads-yonetimi", outcome: "Arama niyeti yüksek talebi yakalama." },
  { name: "Sosyal Medya Yönetimi", Icon: Users, href: "/hizmetler/sosyal-medya-yonetimi", outcome: "Düzenli içerik ve marka güveni." },
  { name: "Dijital Pazarlama Danışmanlığı", Icon: BrainCircuit, href: "/hizmetler/dijital-pazarlama-danismanligi", outcome: "Kanalları tek büyüme planına bağlama." },
  { name: "Ölçümleme ve Raporlama", Icon: Target, href: "/hizmetler#raporlama", outcome: "Harcamanın karşılığını net görme." },
  { name: "Web Sitesi ve Dönüşüm Danışmanlığı", Icon: ShieldCheck, href: "/hizmetler#web-donusum", outcome: "Ziyaretçiyi talebe çevirme." }
];

const expertiseStrip: Array<{ label: string; Icon: LucideIcon }> = [
  { label: "Meta Ads", Icon: BarChart3 },
  { label: "Google Ads", Icon: Search },
  { label: "Sosyal Medya Yönetimi", Icon: Users },
  { label: "İçerik Stratejisi", Icon: Lightbulb },
  { label: "Yerel SEO", Icon: Map },
  { label: "Remarketing", Icon: Repeat2 },
  { label: "Raporlama", Icon: LineChart },
  { label: "Lead Generation", Icon: Target }
];

const processSteps: Array<{ label: string; text: string; Icon: LucideIcon }> = [
  { label: "Analiz", text: "İşletme, hedef kitle ve mevcut dijital varlıklar birlikte değerlendirilir.", Icon: FileSearch2 },
  { label: "Strateji", text: "Kanal, bütçe ve mesaj önceliği hedefe göre netleştirilir.", Icon: Compass },
  { label: "Kurulum", text: "Kampanya, ölçümleme ve içerik altyapısı devreye alınır.", Icon: ClipboardCheck },
  { label: "Yayın", text: "Reklam ve içerikler planlanan takvimle yayına çıkar.", Icon: Rocket },
  { label: "Optimizasyon", text: "Sinyaller izlenir, bütçe ve kreatif buna göre ayarlanır.", Icon: Zap },
  { label: "Raporlama", text: "Sonuçlar anlaşılır bir dille, sade raporla paylaşılır.", Icon: LineChart },
  { label: "Büyüme", text: "Öğrenilenler bir sonraki döneme aksiyon olarak taşınır.", Icon: Sparkles }
];

const valueBenefits = [
  "Daha düzenli müşteri takibi",
  "Ölçülebilir reklam yönetimi",
  "İçerik planlama disiplini",
  "Daha hızlı teklif süreci",
  "Düzenli raporlama",
  "Yerel müşteri görünürlüğü",
  "Tek merkezden operasyon"
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
  ["Paket Seçme Robotu nasıl çalışır?", "İşletme türünüzü, hedefinizi ve bütçe aralığınızı seçtiğinizde sistem bu bilgileri değerlendirip size uygun paketi ve tahmini kapsamı önerir; sonuç doğrudan teklif formuna bağlanır."],
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
          <div key={question} className="border-b border-white/10 py-1">
            <h3>
              <button
                type="button"
                id={buttonId}
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenIndex(open ? null : index)}
                className="flex w-full items-center justify-between gap-4 py-4 text-left text-base font-bold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4fa8f0]"
              >
                {question}
                <ChevronDown size={18} className={`shrink-0 text-[#4fa8f0] transition-transform duration-300 ${open ? "rotate-180" : ""}`} aria-hidden="true" />
              </button>
            </h3>
            <div id={panelId} role="region" aria-labelledby={buttonId} hidden={!open} className="pb-4">
              <p className="max-w-xl text-sm leading-7 text-slate-400">{answer}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

type SectionShellProps = {
  id: string;
  eyebrow?: string;
  title?: ReactNode;
  text?: string;
  children: ReactNode;
  className?: string;
};

function Divider() {
  return <div className="h-px w-full bg-white/10" aria-hidden="true" />;
}

function SectionShell({ id, eyebrow, title, text, children, className = "" }: SectionShellProps) {
  // Reduced-motion handling lives on the <MotionConfig reducedMotion="user">
  // provider wrapping the whole homepage (see CinematicHomepage below), not
  // here: a local `useReducedMotion()` ternary that swaps `initial`/
  // `whileInView` to `false`/`undefined` looks equivalent but isn't — the
  // hook resolves asynchronously (it's null on the very first render, since
  // it reads a media query that only exists client-side), so the section
  // mounts with the animated `initial` already applied, then `whileInView`
  // flips to `undefined` once the hook catches up — leaving the section
  // permanently stuck at opacity:0 with nothing left to animate it into
  // view. MotionConfig avoids the race entirely: it still lets whileInView
  // fire on scroll, it just makes the transition instant for reduced-motion
  // users instead of skipping it.
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 60 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
      className={`relative scroll-mt-24 overflow-hidden px-4 py-20 sm:px-6 lg:px-8 lg:py-24 ${className}`}
    >
      <div className="mx-auto max-w-7xl">
        {(eyebrow || title || text) && (
          <div className="max-w-3xl">
            {eyebrow && <p className="cinematic-eyebrow text-xs font-black uppercase tracking-[.22em]">{eyebrow}</p>}
            {title && <h2 className="cinematic-title mt-5 text-3xl sm:text-5xl lg:text-6xl">{title}</h2>}
            {text && <p className="mt-5 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">{text}</p>}
          </div>
        )}
        {children}
      </div>
    </motion.section>
  );
}

function CinematicButton({ href, children, variant = "primary", trackingLabel = "Public CTA" }: { href: string; children: ReactNode; variant?: "primary" | "ghost" | "whatsapp"; trackingLabel?: string }) {
  const className =
    variant === "primary"
      ? "border-[#4fa8f0]/50 bg-gradient-to-r from-[#2f5bff] to-[#4fa8f0] text-white shadow-[0_0_54px_rgba(47,91,255,.35)] hover:brightness-110"
      : variant === "whatsapp"
        ? "border-[#25D366]/50 bg-[#25D366] text-white shadow-[0_0_44px_rgba(37,211,102,.3)] hover:bg-[#20bd5b]"
        : "border-white/15 bg-white/[0.05] text-white hover:border-[#4fa8f0]/50 hover:bg-[#2f5bff]/10";
  return <Link href={href} onClick={() => trackMetaCtaClick(trackingLabel, href)} target={variant === "whatsapp" ? "_blank" : undefined} rel={variant === "whatsapp" ? "noreferrer" : undefined} className={`cinematic-press inline-flex min-h-13 items-center justify-center gap-2 rounded-full border px-6 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-[#4fa8f0] ${className}`}>{children}</Link>;
}

function MetricCounter({ value, label, text }: { value: string; label: string; text: string }) {
  return (
    <div className="border-r border-white/10 px-6 py-8 last:border-r-0 sm:px-8">
      <p className="text-4xl font-black italic text-white">{value}</p>
      <h4 className="mt-2 text-xs font-black uppercase tracking-[.1em] text-[#4fa8f0]">{label}</h4>
      <p className="mt-2 text-xs leading-6 text-slate-500">{text}</p>
    </div>
  );
}

const proofMetrics = [
  ["3.8%", "CTR", "Reklamı görenlerin tıklama davranışını görünür hale getirir."],
  ["₺4,20", "CPC", "Reklam bütçesini daha kontrollü yönetmeye yardımcı olur."],
  ["5.4x", "ROAS", "Satış garantisi değil, ölçülebilir büyüme sistemi."],
  ["128", "Dönüşüm", "Form, arama, WhatsApp veya satış aksiyonu tek ekranda takip edilir."]
];

function PackageTabs() {
  const [active, setActive] = useState(PACKAGE_CATEGORIES[0].key);
  const activeCategory = PACKAGE_CATEGORIES.find((category) => category.key === active) || PACKAGE_CATEGORIES[0];

  return (
    <div>
      <div role="tablist" aria-label="Paket kategorileri" className="flex flex-wrap gap-2">
        {PACKAGE_CATEGORIES.map((category) => (
          <button
            key={category.key}
            type="button"
            role="tab"
            id={`pkg-tab-${category.key}`}
            aria-selected={active === category.key}
            aria-controls={`pkg-panel-${category.key}`}
            onClick={() => setActive(category.key)}
            className={`rounded-full border px-5 py-2.5 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4fa8f0] ${active === category.key ? "border-[#4fa8f0] bg-[#2f5bff] text-white" : "border-white/15 bg-transparent text-slate-400 hover:text-white"}`}
          >
            {category.shortLabel}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`pkg-panel-${activeCategory.key}`} aria-labelledby={`pkg-tab-${activeCategory.key}`} className="mt-8 grid gap-5 lg:grid-cols-3">
        {servicePackagesByCategory(activeCategory.key).map((pkg) => {
          const pricing = getPackagePricing(pkg);
          return (
            <div key={pkg.slug} className={`relative rounded-[18px] border p-7 transition hover:-translate-y-1 ${pkg.popular ? "border-[#4fa8f0]/60 bg-[#2f5bff]/[0.09]" : "border-white/10 bg-white/[0.03]"}`}>
              {pkg.popular && <span className="absolute right-6 top-6 rounded-full bg-gradient-to-r from-[#2f5bff] to-[#4fa8f0] px-3 py-1 text-[10px] font-black uppercase tracking-[.08em] text-white">Önerilen</span>}
              <h3 className="text-xl font-black text-white">{pkg.name}</h3>
              <p className="mt-2 text-xs font-bold uppercase tracking-[.08em] text-slate-500">{pkg.idealFor}</p>
              <p className="mt-3 text-sm leading-6 text-slate-400">{pkg.description}</p>
              <p className="mt-5 text-3xl font-black italic text-white">
                {formatTRY(pricing?.basePrice || pkg.monthlyPrice)}
                <span className="ml-2 text-xs font-bold not-italic text-slate-500">+KDV/ay</span>
              </p>
              <ul className="mt-5 space-y-2.5">
                {pkg.features.slice(0, 4).map((feature) => (
                  <li key={feature.label} className="flex gap-2 text-xs leading-5 text-slate-400">
                    <CheckCircle2 className="mt-0.5 shrink-0 text-[#4fa8f0]" size={14} />
                    <span><b className="text-slate-200">{feature.label}:</b> {feature.value}</span>
                  </li>
                ))}
              </ul>
              <Link href={`/teklif-al?paket=${pkg.slug}`} onClick={() => trackEvent("package_clicked", { package: pkg.slug, href: "/teklif-al" })} className="mt-7 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-[#4fa8f0]/40 bg-white/[0.04] px-5 text-sm font-bold text-white transition hover:bg-[#2f5bff]">
                Bu Paketi Seç
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CinematicHomepage({ content }: { content: SiteContent }) {
  const services = content.services?.length ? content.services : [];
  const whatsappUrl = content.socials?.whatsapp || (content.contact?.whatsappNumber ? `https://wa.me/${content.contact.whatsappNumber.replace(/\D/g, "")}` : "/iletisim");

  return (
    <MotionConfig reducedMotion="user">
    <div className="cinematic-home relative">
      <div className="cinematic-aurora pointer-events-none absolute inset-0" aria-hidden="true" />

      <section id="hero" className="cinematic-floor relative flex min-h-[calc(100svh-76px)] scroll-mt-20 items-center overflow-hidden px-4 py-20 sm:px-6 lg:px-8">
        <div className="cinematic-floor-glow" aria-hidden="true" />
        <div className="relative mx-auto max-w-4xl">
          <p className="cinematic-eyebrow text-xs font-black uppercase tracking-[.3em]">Manisa merkezli dijital pazarlama ajansı</p>
          <h1 className="cinematic-title mt-6 text-4xl sm:text-6xl lg:text-[5.2rem]">
            Manisa Dijital Pazarlama Ajansı ile <span className="cinematic-title-highlight">Reklamlarınızı</span> Büyümeye Dönüştürün
          </h1>
          <div className="mt-8 h-px w-full bg-white/10" />
          <p className="mt-8 max-w-2xl text-base leading-8 text-slate-400 sm:text-lg">
            HK Dijital; Manisa merkezli işletmelere ve Türkiye genelindeki markalara Meta reklamları, Google Ads, sosyal medya stratejisi, dönüşüm takibi ve anlaşılır performans raporlaması sunar.
          </p>
          <div className="mt-8 flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-[.05em] text-slate-400">
            {["Manisa merkezli", "Türkiye geneli hizmet", "Şeffaf raporlama", "Strateji + reklam + içerik", "Satış garantisi değil, ölçülebilir sistem"].map((item) => (
              <span key={item} className="rounded-full border border-white/10 px-3.5 py-2">{item}</span>
            ))}
          </div>
          <div className="mt-9 flex flex-wrap gap-4">
            <CinematicButton href="/teklif-al" trackingLabel="Hero Paketini Bul">Paketini Bul <ArrowRight size={18} /></CinematicButton>
            <CinematicButton href={whatsappUrl} variant="whatsapp" trackingLabel="Hero WhatsApp'tan Görüş">WhatsApp&apos;tan Görüş <MessageCircle size={18} /></CinematicButton>
          </div>
        </div>
      </section>

      <Divider />

      <section aria-label="Uzmanlık alanları" className="border-b border-white/10 bg-white/[0.015] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-8 gap-y-5 sm:justify-between">
          {expertiseStrip.map((item) => (
            <div key={item.label} className="flex items-center gap-2.5 text-slate-300">
              <item.Icon size={17} className="text-[#4fa8f0]" aria-hidden="true" />
              <span className="whitespace-nowrap text-xs font-bold uppercase tracking-[.08em]">{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      <SectionShell id="services" eyebrow="01 — Hizmetler" title={<>MARKANIZI <span className="cinematic-title-highlight">BÜYÜMEYE</span> BAĞLAYAN SİSTEM</>} text="Her kanal kendi başına değil; hedef, bütçe, teklif, dönüşüm takibi ve raporlamayla birlikte yönetildiğinde sağlıklı karar üretir.">
        <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {fixedServices.map(({ name, Icon, href, outcome }) => {
            const matched = services.find((service) => service.name.toLocaleLowerCase("tr").includes(name.split(" ")[0].toLocaleLowerCase("tr")));
            return (
              <div key={name} className="cinematic-card group flex flex-col rounded-[18px] border border-white/10 bg-white/[0.03] p-7">
                <div className="grid size-12 place-items-center rounded-[10px] border border-[#4fa8f0]/25 bg-[#2f5bff]/10 text-[#4fa8f0] transition group-hover:scale-110"><Icon size={22} /></div>
                <h3 className="mt-6 text-xl font-black text-white">{name}</h3>
                {matched?.problem && <p className="mt-3 text-xs font-bold uppercase tracking-[.05em] text-slate-500">Problem: {matched.problem}</p>}
                <p className="mt-3 text-sm leading-7 text-slate-400">{matched?.description || "Strateji, kurulum, optimizasyon ve raporlama tek merkezde yönetilir."}</p>
                <p className="mt-4 flex items-center gap-2 text-xs font-bold text-[#4fa8f0]"><Sparkles size={13} /> {outcome}</p>
                <Link href={href} className="mt-5 inline-flex items-center gap-2 text-sm font-black text-white">Hizmeti incele <ArrowRight size={16} /></Link>
              </div>
            );
          })}
        </div>
        {/* Only CMS-managed services beyond the 6 fixed cards above (e.g. an
            admin-added extra service) render here — avoids showing the same
            service twice while still surfacing anything editors add. */}
        {(() => {
          const matchedIds = new Set(
            fixedServices
              .map(({ name }) => services.find((service) => service.name.toLocaleLowerCase("tr").includes(name.split(" ")[0].toLocaleLowerCase("tr")))?.id)
              .filter(Boolean)
          );
          const extraServices = services.filter((service) => !matchedIds.has(service.id));
          return extraServices.length > 0 ? <div className="mt-12"><ServiceGrid services={extraServices} /></div> : null;
        })()}
      </SectionShell>

      <Divider />

      <SectionShell id="process" eyebrow="02 — Süreç" title={<>KEŞİFTEN <span className="cinematic-title-highlight">RAPORA</span> KADAR</>} text="Her adım ölçülebilir, takip edilebilir ve müşteriye anlatılabilir şekilde ilerler.">
        <div className="mt-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {processSteps.map((step, index) => (
            <div key={step.label} className="cinematic-card rounded-[18px] border border-white/10 bg-white/[0.03] p-6">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-full border border-white/10 bg-[#030304] text-sm font-black italic text-slate-400">0{index + 1}</span>
                <step.Icon size={18} className="text-[#4fa8f0]" aria-hidden="true" />
              </div>
              <h3 className="mt-5 text-lg font-black text-white">{step.label}</h3>
              <p className="mt-2 text-sm leading-7 text-slate-400">{step.text}</p>
            </div>
          ))}
        </div>
      </SectionShell>

      <SectionShell id="device" className="border-y border-white/10 bg-white/[0.015]" eyebrow="03 — HK Dijital Çalışma Sistemi" title={<>OPERASYON <span className="cinematic-title-highlight">TEK PANELDE</span></>} text="Müşteri yönetimi, reklam performansı, içerik takvimi, lead takibi, raporlama ve paket önerisi aynı çalışma sisteminin parçasıdır.">
        <div className="mt-12">
          <DeviceShowcase />
        </div>
      </SectionShell>

      <Divider />

      <SectionShell id="value" eyebrow="04 — Değer" title={<>DAHA <span className="cinematic-title-highlight">DÜZENLİ</span> BİR OPERASYON</>} text="Sayısal örnekler yalnızca fikir vermek içindir; asıl fark günlük operasyonun nasıl yönetildiğidir.">
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {valueBenefits.map((benefit) => (
            <div key={benefit} className="flex items-start gap-2.5 rounded-[14px] border border-white/10 bg-white/[0.03] p-4">
              <CheckCircle2 className="mt-0.5 shrink-0 text-[#4fa8f0]" size={16} />
              <span className="text-sm font-bold text-slate-200">{benefit}</span>
            </div>
          ))}
        </div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[.08em] text-slate-500">Aşağıdaki gösterge panosu örnek bir senaryodur — satış garantisi değil, ölçülebilir bir sistemdir.</p>
        <div className="mt-6 grid grid-cols-2 divide-y divide-white/10 border border-white/10 sm:grid-cols-4 sm:divide-y-0">
          {proofMetrics.map(([value, label, text]) => <MetricCounter key={label} value={value} label={label} text={text} />)}
        </div>
      </SectionShell>

      <Divider />

      <SectionShell id="packages" eyebrow="05 — Paketler" title={<>KAPSAMI VE <span className="cinematic-title-highlight">BÜTÇEYİ</span> NETLEŞTİRİN</>} text={content.pages.packages?.intro || "Meta, Google Ads, kombin reklam yönetimi ve sosyal medya hizmetlerini net kapsam, fiyat ve raporlama disipliniyle karşılaştırın."}>
        <div className="mt-10">
          <PackageTabs />
        </div>
        <div className="mt-10 flex flex-wrap items-center gap-4 rounded-[18px] border border-[#4fa8f0]/30 bg-[#2f5bff]/[0.08] p-6">
          <div className="flex-1">
            <p className="text-lg font-black text-white">Hangi paket sana uygun?</p>
            <p className="mt-1 text-sm leading-6 text-slate-400">Paket Seçme Robotu; hedefine ve bütçene göre birkaç saniyede önerir.</p>
          </div>
          <CinematicButton href="/teklif-al" trackingLabel="Paket Bölümü Robotu Başlat">Paket Seçme Robotunu Başlat <ArrowRight size={18} /></CinematicButton>
        </div>
        <div className="mt-5">
          <Link href="/paketler" className="text-sm font-black text-[#4fa8f0]">Tüm paket detaylarını görüntüle →</Link>
        </div>
      </SectionShell>

      <section id="paket-robotu" className="relative overflow-hidden bg-gradient-to-br from-[#1730b5] via-[#2f5bff] to-[#3f6bff] px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
          <div>
            <p className="cinematic-eyebrow text-xs font-black uppercase tracking-[.22em] text-white/90 [&::before]:bg-white/90">06 — Paket Seçme Robotu</p>
            <h2 className="mt-5 text-3xl font-black italic uppercase leading-[.98] tracking-tight text-white sm:text-5xl">{content.quoteWizard.title || "Size Uygun Paketi Birlikte Bulalım"}</h2>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/85">{content.quoteWizard.subtitle || "Birkaç soruda işletme türünüzü, hedefinizi ve bütçe aralığınızı belirtin; sistem size uygun paketi önerir."}</p>
            <ol className="mt-7 grid gap-2.5 text-sm leading-6 text-white/90">
              <li className="flex gap-3"><span className="font-black">01</span> İşletme türünü ve hedefini seçersiniz.</li>
              <li className="flex gap-3"><span className="font-black">02</span> Bütçe aralığınızı ve zamanlamayı belirtirsiniz.</li>
              <li className="flex gap-3"><span className="font-black">03</span> Sistem size uygun paketi önerir ve teklif akışına bağlar.</li>
            </ol>
            <Link href="/teklif-al" onClick={() => trackMetaCtaClick("Robot Bölümü Başlat", "/teklif-al")} className="mt-8 inline-flex min-h-13 items-center gap-2 rounded-full bg-white px-6 text-sm font-black text-[#1730b5] transition hover:-translate-y-0.5">
              Paket Seçme Robotunu Başlat <ArrowRight size={18} />
            </Link>
          </div>
          <div className="grid gap-3">
            {["Hedef ve sektöre göre öneri", "Bütçe aralığına uygun kapsam", "Sonuç doğrudan teklif formuna bağlanır"].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-[14px] border border-white/20 bg-white/10 p-4 text-sm font-bold text-white backdrop-blur">
                <CheckCircle2 size={18} /> {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <SectionShell id="neden-hk" eyebrow="07 — Neden HK Dijital" title={<>DENEYİM VE <span className="cinematic-title-highlight">ŞEFFAFLIK</span></>} text="Reklam yayınlamak kolaydır; doğru strateji, takip ve raporlamayla yönetmek fark yaratır.">
        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {whyHkPoints.map((point) => (
            <div key={point.title} className="rounded-[18px] border border-white/10 bg-white/[0.03] p-6">
              <point.Icon className="text-[#4fa8f0]" size={22} />
              <h3 className="mt-4 text-lg font-black text-white">{point.title}</h3>
              <p className="mt-2 text-sm leading-7 text-slate-400">{point.text}</p>
            </div>
          ))}
        </div>
      </SectionShell>

      <Divider />

      <SectionShell id="local-seo" eyebrow="08 — Manisa ve Türkiye geneli" title={<>YEREL BİLGİ, <span className="cinematic-title-highlight">GENİŞ KAPSAM</span></>} text="Şehzadeler, Yunusemre, Akhisar, Turgutlu, Salihli, Soma, Alaşehir ve Saruhanlı başta olmak üzere Manisa merkez ve ilçelerine; ayrıca Türkiye geneline uzaktan hizmet veriyoruz.">
        <div className="mt-8 flex flex-wrap gap-2">
          {["Şehzadeler", "Yunusemre", "Akhisar", "Turgutlu", "Salihli", "Soma", "Alaşehir", "Saruhanlı", "Türkiye Geneli (Uzaktan)"].map((item) => (
            <span key={item} className="rounded-full border border-white/10 px-4 py-2 text-xs font-bold text-slate-400 transition hover:border-[#4fa8f0]/40 hover:text-white">{item}</span>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <CinematicButton href="/manisa-dijital-pazarlama" trackingLabel="Manisa Landing İncele">Manisa dijital pazarlama hizmetleri</CinematicButton>
          <CinematicButton href="/hakkimda" variant="ghost" trackingLabel="HK Dijital Hakkında">HK Dijital&apos;i Tanıyın</CinematicButton>
        </div>
      </SectionShell>

      <Divider />

      <SectionShell id="faq-blog" eyebrow="09 — Kaynaklar" title={<>MERAK <span className="cinematic-title-highlight">ETTİKLERİNİZ</span></>} text="Karar vermeden önce kanal seçimi, bütçe ve ölçümleme mantığını sade biçimde inceleyebilirsiniz.">
        <div className="mt-10 grid gap-8 lg:grid-cols-[.95fr_1.05fr]">
          <FaqAccordion />
          <div className="grid gap-4">
            {blogPosts.map((post) => (
              <Link key={post.slug} href={`/blog/${post.slug}`} className="cinematic-card block rounded-[18px] border border-white/10 bg-white/[0.03] p-6 transition hover:-translate-y-1 hover:border-[#4fa8f0]/30">
                <p className="text-xs font-black uppercase tracking-[.2em] text-[#4fa8f0]">{post.readingTime}</p>
                <h3 className="mt-3 text-xl font-black text-white">{post.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-400">{post.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </SectionShell>

      <section className="relative overflow-hidden bg-gradient-to-br from-[#1730b5] via-[#2f5bff] to-[#3f6bff] px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <p className="cinematic-eyebrow justify-center text-xs font-black uppercase tracking-[.22em] text-white/90 [&::before]:bg-white/90">10 — Sonraki Adım</p>
          <h2 className="mt-5 text-4xl font-black italic uppercase leading-[.96] tracking-tight text-white sm:text-6xl">Reklamınızı<br />Büyümeye Çevirin</h2>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-white/85">Satış garantisi vermeyiz — strateji, kurulum, optimizasyon, dönüşüm takibi ve raporlama sürecini uçtan uca yönetiriz.</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link href="/teklif-al" onClick={() => trackMetaCtaClick("Final CTA Paketini Bul", "/teklif-al")} className="inline-flex min-h-13 items-center gap-2 rounded-full bg-white px-6 text-sm font-black text-[#1730b5] transition hover:-translate-y-0.5">
              Paketini Bul <ArrowRight size={18} />
            </Link>
            <a href={whatsappUrl} target="_blank" rel="noreferrer" onClick={() => trackMetaCtaClick("Final CTA WhatsApp", whatsappUrl)} className="inline-flex min-h-13 items-center gap-2 rounded-full border border-white/40 bg-white/10 px-6 text-sm font-black text-white backdrop-blur transition hover:bg-white/20">
              WhatsApp&apos;tan Görüş <MessageCircle size={18} />
            </a>
          </div>
        </div>
      </section>

      <SectionShell id="contact" eyebrow="11 — İletişim" title={<>YOL HARİTASINI <span className="cinematic-title-highlight">NETLEŞTİRELİM</span></>} text="Kısa bir keşif görüşmesiyle reklam, dönüşüm takibi ve raporlama ihtiyacınızı değerlendirelim.">
        <div className="mt-10 grid items-start gap-8 lg:grid-cols-[.9fr_1.1fr]">
          <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-7">
            <MessageCircle className="text-[#4fa8f0]" size={30} />
            <h3 className="mt-5 text-xl font-black text-white">Hızlı başlangıç</h3>
            <p className="mt-4 text-sm leading-7 text-slate-400">İsterseniz WhatsApp üzerinden doğrudan yazın, isterseniz teklif formunu açıp işletmenizin hedeflerini gönderin.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <CinematicButton href={whatsappUrl} variant="whatsapp" trackingLabel="Final WhatsApp ile Görüş">WhatsApp ile Görüş</CinematicButton>
              <CinematicButton href="/teklif-al" variant="ghost" trackingLabel="Final Teklif Formunu Aç">Teklif Formunu Aç</CinematicButton>
            </div>
            <div className="mt-7 grid gap-2 border-t border-white/10 pt-6 text-xs text-slate-500">
              <span className="flex items-center gap-2"><Wallet size={14} className="text-[#4fa8f0]" /> Fiyatlara KDV dahil değildir.</span>
              <span className="flex items-center gap-2"><CalendarClock size={14} className="text-[#4fa8f0]" /> Reklam bütçesi hizmet bedelinden ayrıdır.</span>
              <span className="flex items-center gap-2"><MousePointerClick size={14} className="text-[#4fa8f0]" /> Satış garantisi verilmez, süreç ölçülür ve raporlanır.</span>
            </div>
          </div>
          <ContactForm />
        </div>
      </SectionShell>
    </div>
    </MotionConfig>
  );
}
