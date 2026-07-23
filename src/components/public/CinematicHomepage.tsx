"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, BarChart3, BrainCircuit, CalendarDays, ChevronDown, Layers3, MessageCircle, MousePointerClick, Rocket, Search, ShieldCheck, Target, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { SiteContent } from "@/lib/types";
import { ContactForm } from "./ContactForm";
import { ServiceGrid } from "./ServicePackageSections";
import { trackMetaCtaClick } from "@/lib/meta-pixel";
import { trackEvent } from "./TrackingPlaceholders";
import { blogPosts, serviceOverviewCards } from "@/lib/public-seo-content";
import { PACKAGE_CATEGORIES, formatTRY, getPackagePricing, servicePackagesByCategory } from "@/lib/packages";
import { CheckCircle2 } from "@/lib/icons";
import { ScrollScrubStage } from "./ScrollScrubStage";

const fixedServices = [
  "Meta Reklam Yönetimi",
  "Google Ads Yönetimi",
  "Sosyal Medya Yönetimi",
  "Dijital Pazarlama Danışmanlığı",
  "Ölçümleme ve Raporlama",
  "Web Sitesi ve Dönüşüm Danışmanlığı"
];

const processSteps = ["Keşif", "Analiz", "Strateji", "Kurulum", "Yayın", "Raporlama", "Optimizasyon"];

const faqEntries: Array<[string, string]> = [
  ["Manisa dışındaki işletmelere hizmet veriliyor mu?", "Evet. HK Dijital Manisa merkezlidir; Türkiye genelindeki işletmelerle uzaktan çalışma modeli kurulabilir."],
  ["Satış garantisi veriliyor mu?", "Hayır. Satış garantisi verilmez; strateji, kurulum, optimizasyon, dönüşüm takibi ve raporlama süreci yönetilir."],
  ["Hangi reklam kanalıyla başlamalıyım?", "Bu karar sektör, hedef, bütçe ve mevcut dijital varlıklara göre ön görüşmede netleştirilir."]
];

const proofMetrics = [
  ["3.8%", "CTR", "Reklamı görenlerin tıklama davranışını görünür hale getirir."],
  ["₺4,20", "CPC", "Reklam bütçesini daha kontrollü yönetmeye yardımcı olur."],
  ["5.4x", "ROAS", "Satış garantisi değil, ölçülebilir büyüme sistemi."],
  ["128", "Dönüşüm", "Form, arama, WhatsApp veya satış aksiyonu tek ekranda takip edilir."]
];

const dashboardBlocks: Array<[string, string, LucideIcon]> = [
  ["Meta Ads performans kartı", "Gösterim, erişim, mesaj ve kreatif testleri tek özet içinde takip edilir.", BarChart3],
  ["Google Ads arama performansı", "Arama niyeti, tıklama maliyeti ve dönüşüm sinyali birlikte okunur.", Search],
  ["Sosyal medya içerik takvimi", "Reels, hikâye, gönderi ve kampanya içerikleri planlı ilerler.", CalendarDays],
  ["Lead pipeline kartı", "Yeni lead, teklif, takip ve kazanım aşamaları görünür kalır.", Target],
  ["AI analiz kartı", "Metrikler sade Türkçe yorumlara ve sonraki aksiyonlara dönüşür.", BrainCircuit],
  ["Aylık rapor önizleme", "Müşteriye sunulabilir rapor, notlar ve öneriler aynı akışta hazırlanır.", Layers3]
];

function FaqAccordion() {
  const baseId = useId();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="grid gap-4">
      {faqEntries.map(([question, answer], index) => {
        const open = openIndex === index;
        const panelId = `${baseId}-panel-${index}`;
        const buttonId = `${baseId}-button-${index}`;
        return (
          <div key={question} className="border-b border-white/10 py-2">
            <h3>
              <button
                type="button"
                id={buttonId}
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenIndex(open ? null : index)}
                className="flex w-full items-center justify-between gap-4 py-5 text-left text-lg font-bold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4fa8f0]"
              >
                {question}
                <ChevronDown size={18} className={`shrink-0 text-[#4fa8f0] transition-transform duration-300 ${open ? "rotate-180" : ""}`} aria-hidden="true" />
              </button>
            </h3>
            <div id={panelId} role="region" aria-labelledby={buttonId} hidden={!open} className="pb-5">
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
  const reduced = useReducedMotion();
  return (
    <motion.section
      id={id}
      initial={reduced ? false : { opacity: 0, y: 60 }}
      whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
      className={`relative scroll-mt-24 overflow-hidden px-4 py-24 sm:px-6 lg:px-8 ${className}`}
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

function CinematicButton({ href, children, variant = "primary", trackingLabel = "Public CTA" }: { href: string; children: ReactNode; variant?: "primary" | "ghost"; trackingLabel?: string }) {
  const className = variant === "primary"
    ? "border-[#4fa8f0]/50 bg-gradient-to-r from-[#2f5bff] to-[#4fa8f0] text-white shadow-[0_0_54px_rgba(47,91,255,.35)] hover:brightness-110"
    : "border-white/15 bg-white/[0.05] text-white hover:border-[#4fa8f0]/50 hover:bg-[#2f5bff]/10";
  return <Link href={href} onClick={() => trackMetaCtaClick(trackingLabel, href)} className={`cinematic-press inline-flex min-h-13 items-center justify-center gap-2 rounded-full border px-6 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-[#4fa8f0] ${className}`}>{children}</Link>;
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

function PackageTabs({ intro }: { intro?: string }) {
  const [active, setActive] = useState(PACKAGE_CATEGORIES[0].key);
  const activeCategory = PACKAGE_CATEGORIES.find((category) => category.key === active) || PACKAGE_CATEGORIES[0];

  return (
    <div>
      {intro && <p className="mb-6 max-w-2xl text-sm leading-7 text-slate-400">{intro}</p>}
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
              <p className="mt-2 text-sm leading-6 text-slate-400">{pkg.description}</p>
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
            {["Manisa dijital pazarlama", "Meta reklamları", "Google Ads", "Sosyal medya", "Dönüşüm takibi"].map((item) => (
              <span key={item} className="rounded-full border border-white/10 px-3.5 py-2">{item}</span>
            ))}
          </div>
          <div className="mt-9 flex flex-wrap gap-4">
            <CinematicButton href="/teklif-al" trackingLabel="Hero Ön Görüşme Al">Ücretsiz Ön Görüşme Al <ArrowRight size={18} /></CinematicButton>
            <CinematicButton href="/hizmetler" variant="ghost" trackingLabel="Hero Hizmetleri İncele">Hizmetleri İncele <MousePointerClick size={18} /></CinematicButton>
          </div>
        </div>
      </section>

      <ScrollScrubStage />

      <SectionShell id="kpi" eyebrow="Kampanya Panosu" title={<>BÜTÇE, FUNNEL VE <span className="cinematic-title-highlight">LEAD KALİTESİ</span></>} text="Kontrollü büyüme için takip edilen temel göstergeler.">
        <p className="mt-3 text-xs font-bold uppercase tracking-[.1em] text-slate-500">Örnek gösterge panelidir — satış garantisi değil, ölçülebilir bir sistemdir.</p>
        <div className="mt-10 grid grid-cols-2 divide-y divide-white/10 border border-white/10 sm:grid-cols-4 sm:divide-y-0">
          {proofMetrics.map(([value, label, text]) => <MetricCounter key={label} value={value} label={label} text={text} />)}
        </div>
      </SectionShell>

      <Divider />

      <SectionShell id="services" eyebrow="02 — Hizmetler" title={<>MARKANIZI <span className="cinematic-title-highlight">BÜYÜMEYE</span> BAĞLAYAN SİSTEM</>} text="Her kanal kendi başına değil; hedef, bütçe, teklif, dönüşüm takibi ve raporlamayla birlikte yönetildiğinde sağlıklı karar üretir.">
        <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {fixedServices.map((name, index) => {
            const matched = services.find((service) => service.name.toLocaleLowerCase("tr").includes(name.split(" ")[0].toLocaleLowerCase("tr")));
            const Icon = [BarChart3, Search, Rocket, BrainCircuit, Target, ShieldCheck][index] || Zap;
            return (
              <div key={name} className="cinematic-card group rounded-[18px] border border-white/10 bg-white/[0.03] p-7">
                <div className="grid size-12 place-items-center rounded-[10px] border border-[#4fa8f0]/25 bg-[#2f5bff]/10 text-[#4fa8f0] transition group-hover:scale-110"><Icon size={22} /></div>
                <h3 className="mt-6 text-xl font-black text-white">{name}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-400">{matched?.description || "Strateji, kurulum, optimizasyon ve raporlama tek merkezde yönetilir."}</p>
                <Link href={serviceOverviewCards[index]?.href || "/hizmetler"} className="mt-5 inline-flex items-center gap-2 text-sm font-black text-[#4fa8f0]">Hizmeti incele <ArrowRight size={16} /></Link>
              </div>
            );
          })}
        </div>
        {services.length > 0 && <div className="mt-12"><ServiceGrid services={services} /></div>}
        <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {dashboardBlocks.map(([title, text, Icon]) => (
            <div key={String(title)} className="rounded-[18px] border border-white/10 bg-white/[0.02] p-5">
              <Icon className="text-[#4fa8f0]" size={24} />
              <h3 className="mt-4 text-lg font-black text-white">{String(title)}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-400">{String(text)}</p>
            </div>
          ))}
        </div>
      </SectionShell>

      <section className="relative overflow-hidden bg-gradient-to-br from-[#1730b5] via-[#2f5bff] to-[#3f6bff] px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <p className="cinematic-eyebrow text-xs font-black uppercase tracking-[.22em] text-white/90 [&::before]:bg-white/90">03 — Neden HK Dijital</p>
          <h2 className="mt-5 text-4xl font-black italic uppercase leading-[.96] tracking-tight text-white sm:text-6xl">Reklamınızı<br />Büyümeye Çevirin</h2>
          <p className="mt-6 max-w-2xl text-base leading-7 text-white/85">Satış garantisi vermeyiz — strateji, kurulum, optimizasyon, dönüşüm takibi ve raporlama sürecini uçtan uca yönetiriz.</p>
          <Link href="/teklif-al" onClick={() => trackMetaCtaClick("CTA Blok Ön Görüşme", "/teklif-al")} className="mt-8 inline-flex min-h-13 items-center gap-2 rounded-full bg-white px-6 text-sm font-black text-[#1730b5] transition hover:-translate-y-0.5">
            Ücretsiz Ön Görüşme Al <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      <SectionShell id="process" eyebrow="04 — Süreç" title={<>KEŞİFTEN <span className="cinematic-title-highlight">RAPORA</span> KADAR</>} text="Her adım ölçülebilir, takip edilebilir ve müşteriye anlatılabilir şekilde ilerler.">
        <div className="relative mt-14">
          <div className="absolute left-6 top-0 hidden h-full w-px bg-white/10 md:block" />
          <div className="grid gap-3">
            {processSteps.map((step, index) => (
              <div key={step} className="relative py-4 md:pl-16">
                <span className="mb-3 grid size-12 place-items-center rounded-full border border-white/10 bg-[#030304] font-black italic text-slate-400 md:absolute md:left-0 md:top-4 md:mb-0">0{index + 1}</span>
                <div>
                  <h3 className="text-xl font-black text-white">{step}</h3>
                  <p className="mt-1 max-w-xl text-sm leading-7 text-slate-400">Bu aşamada veri toplanır, karar netleşir ve bir sonraki operasyon adımı hazırlanır.</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </SectionShell>

      <Divider />

      <SectionShell id="packages" eyebrow="05 — Paketler" title={<>KAPSAMI VE <span className="cinematic-title-highlight">BÜTÇEYİ</span> NETLEŞTİRİN</>} text={content.pages.packages?.intro || "Meta, Google Ads, kombin reklam yönetimi ve sosyal medya hizmetlerini net kapsam, fiyat ve raporlama disipliniyle karşılaştırın."}>
        <div className="mt-10">
          <PackageTabs />
        </div>
        <div className="mt-6">
          <Link href="/paketler" className="text-sm font-black text-[#4fa8f0]">Tüm paket detaylarını ve Paket Öneri Robotu&apos;nu görüntüle →</Link>
        </div>
      </SectionShell>

      <SectionShell id="local-seo" eyebrow="06 — Manisa ve Türkiye geneli" title={<>YEREL BİLGİ, <span className="cinematic-title-highlight">GENİŞ KAPSAM</span></>} text="Şehzadeler, Yunusemre, Akhisar, Turgutlu, Salihli, Soma, Alaşehir ve Saruhanlı başta olmak üzere Manisa merkez ve ilçelerine; ayrıca Türkiye geneline uzaktan hizmet veriyoruz.">
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

      <SectionShell id="faq-blog" eyebrow="07 — Kaynaklar" title={<>MERAK <span className="cinematic-title-highlight">ETTİKLERİNİZ</span></>} text="Karar vermeden önce kanal seçimi, bütçe ve ölçümleme mantığını sade biçimde inceleyebilirsiniz.">
        <div className="mt-10 grid gap-8 lg:grid-cols-[.9fr_1.1fr]">
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

      <SectionShell id="contact" eyebrow="08 — İletişim" title={<>YOL HARİTASINI <span className="cinematic-title-highlight">NETLEŞTİRELİM</span></>} text="Kısa bir keşif görüşmesiyle reklam, dönüşüm takibi ve raporlama ihtiyacınızı değerlendirelim.">
        <div className="mt-10 grid items-start gap-8 lg:grid-cols-[.9fr_1.1fr]">
          <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-7">
            <MessageCircle className="text-[#4fa8f0]" size={30} />
            <h3 className="mt-5 text-xl font-black text-white">Hızlı başlangıç</h3>
            <p className="mt-4 text-sm leading-7 text-slate-400">İsterseniz WhatsApp üzerinden doğrudan yazın, isterseniz teklif formunu açıp işletmenizin hedeflerini gönderin.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <CinematicButton href={whatsappUrl} trackingLabel="Final WhatsApp ile Görüş">WhatsApp ile Görüş</CinematicButton>
              <CinematicButton href="/teklif-al" variant="ghost" trackingLabel="Final Teklif Formunu Aç">Teklif Formunu Aç</CinematicButton>
            </div>
          </div>
          <ContactForm />
        </div>
      </SectionShell>
    </div>
  );
}
