"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, BarChart3, BrainCircuit, Gauge, Layers3, MessageCircle, MousePointerClick, Rocket, Search, ShieldCheck, Sparkles, Target, Zap } from "lucide-react";
import type { ReactNode } from "react";
import type { SiteContent } from "@/lib/types";
import { ContactForm } from "./ContactForm";
import { ElevatorFloor, ElevatorNav } from "./ElevatorNav";
import { PackageCards, ServiceGrid } from "./ServicePackageSections";

const floors: ElevatorFloor[] = [
  { id: "hero", number: "01", label: "Ana Sayfa" },
  { id: "services", number: "02", label: "Hizmetler" },
  { id: "intelligence", number: "03", label: "HK Intelligence" },
  { id: "packages", number: "04", label: "Paketler" },
  { id: "process", number: "05", label: "Süreç" },
  { id: "contact", number: "06", label: "İletişim" }
];

const floatingCards = [
  ["Meta Ads", "Kreatif, hedef kitle, dönüşüm", BarChart3],
  ["Google Ads", "Arama niyeti ve bütçe kontrolü", Search],
  ["AI Analiz", "Net yorum ve sonraki adım", BrainCircuit],
  ["CRM", "Lead takibi ve müşteri akışı", Target],
  ["Raporlama", "Anlaşılır performans merkezi", Layers3],
  ["Lead Skoru", "Öncelik ve satış potansiyeli", Gauge]
];

const fixedServices = [
  "Meta Reklam Yönetimi",
  "Google Ads Yönetimi",
  "Sosyal Medya Yönetimi",
  "AI Destekli Raporlama",
  "CRM ve Lead Takibi",
  "Web Site & Landing Page"
];

const intelligenceMetrics = [
  ["Müşteri Sıcaklık Puanı", "82", "Satış ve takip önceliği"],
  ["Dijital Olgunluk Skoru", "64", "Dijital altyapı seviyesi"],
  ["Reklam Performansı", "İyi", "Bütçe, tıklama ve erişim dengesi"],
  ["AI Yorum", "Hazır", "Müşteri dostu aksiyon özeti"],
  ["Teklif Motoru", "Aktif", "Paket ve funnel önerisi"],
  ["CRM Takibi", "Canlı", "Lead, görev ve tahsilat akışı"]
];

const processSteps = ["Keşif", "Analiz", "Strateji", "Kurulum", "Yayın", "Raporlama", "Optimizasyon"];

type SectionShellProps = {
  id: string;
  eyebrow?: string;
  title?: string;
  text?: string;
  children: ReactNode;
  className?: string;
};

function SectionShell({ id, eyebrow, title, text, children, className = "" }: SectionShellProps) {
  const reduced = useReducedMotion();
  return (
    <motion.section
      id={id}
      initial={reduced ? false : { opacity: 0, y: 70 }}
      whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.28 }}
      transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
      className={`cinematic-floor relative min-h-[92svh] scroll-mt-24 overflow-hidden px-4 py-20 sm:px-6 lg:px-8 ${className}`}
    >
      <div className="cinematic-floor-glow" aria-hidden="true" />
      <div className="relative mx-auto max-w-7xl">
        {(eyebrow || title || text) && (
          <div className="max-w-3xl">
            {eyebrow && <p className="cinematic-eyebrow text-xs font-black uppercase tracking-[.28em] text-cyan-200">{eyebrow}</p>}
            {title && <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">{title}</h2>}
            {text && <p className="mt-5 text-base leading-8 text-slate-300 sm:text-lg">{text}</p>}
          </div>
        )}
        {children}
      </div>
    </motion.section>
  );
}

function CinematicButton({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: "primary" | "ghost" }) {
  const className = variant === "primary"
    ? "border-cyan-200/50 bg-cyan-300 text-slate-950 shadow-[0_0_54px_rgba(34,211,238,.28)] hover:bg-cyan-100"
    : "border-white/15 bg-white/[0.055] text-white hover:border-amber-200/50 hover:bg-amber-200/10";
  return <Link href={href} className={`cinematic-press inline-flex min-h-13 items-center justify-center gap-2 rounded-full border px-6 text-sm font-black transition focus:outline-none focus:ring-2 focus:ring-cyan-300 ${className}`}>{children}</Link>;
}

function MiniOsPanel() {
  return (
    <div className="cinematic-dashboard relative mx-auto mt-12 max-w-5xl rounded-[18px] border border-cyan-200/18 bg-[#04101d]/70 p-4 shadow-[0_34px_110px_rgba(0,0,0,.42)] backdrop-blur-2xl lg:mt-0">
      <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.22em] text-cyan-200">HK Intelligence OS</p>
          <h3 className="mt-1 text-xl font-black text-white">Canlı büyüme ekranı</h3>
        </div>
        <span className="rounded-full bg-emerald-300 px-3 py-1 text-xs font-black text-slate-950">Aktif</span>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {intelligenceMetrics.map(([title, value, note], index) => (
          <motion.div key={title} whileHover={{ y: -6, rotateX: 4 }} className="cinematic-card rounded-[14px] border border-white/10 bg-white/[0.055] p-4">
            <p className="text-xs font-bold text-slate-400">{title}</p>
            <p className="mt-3 text-3xl font-black text-white">{value}</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-amber-200" style={{ width: `${58 + index * 6}%` }} />
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-400">{note}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export function CinematicHomepage({ content }: { content: SiteContent }) {
  const reduced = useReducedMotion();
  const packages = content.packages?.length ? content.packages : [];
  const services = content.services?.length ? content.services : [];
  const whatsappUrl = content.socials?.whatsapp || (content.contact?.whatsappNumber ? `https://wa.me/${content.contact.whatsappNumber.replace(/\D/g, "")}` : "/iletisim");

  return (
    <div className="cinematic-home relative">
      <ElevatorNav floors={floors} />
      <div className="cinematic-aurora pointer-events-none absolute inset-0" aria-hidden="true" />

      <section id="hero" className="cinematic-floor relative flex min-h-[calc(100svh-76px)] scroll-mt-24 items-center overflow-hidden px-4 py-16 sm:px-6 lg:px-8">
        <div className="cinematic-floor-glow" aria-hidden="true" />
        <div className="relative mx-auto grid w-full max-w-7xl items-center gap-12 lg:grid-cols-[.95fr_1.05fr]">
          <motion.div initial={reduced ? false : { opacity: 0, y: 40 }} animate={reduced ? undefined : { opacity: 1, y: 0 }} transition={{ duration: .75, ease: [0.16, 1, 0.3, 1] }}>
            <p className="cinematic-eyebrow text-xs font-black uppercase tracking-[.3em] text-amber-200">HK Dijital büyüme sistemi</p>
            <h1 className="cinematic-title mt-5 text-4xl font-black leading-[.96] tracking-tight text-white sm:text-6xl lg:text-7xl">
              Reklam vermek kolaydır. Büyümeyi yönetmek zordur.
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-8 text-slate-300 sm:text-xl">
              HK Dijital; Meta reklamları, Google Ads, sosyal medya yönetimi, CRM, raporlama ve yapay zekâ destekli analizleri tek merkezde birleştirir.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <CinematicButton href="/teklif-al">Teklif Al <ArrowRight size={18} /></CinematicButton>
              <CinematicButton href="/digital-center" variant="ghost">Demo Gör <MousePointerClick size={18} /></CinematicButton>
            </div>
          </motion.div>

          <motion.div initial={reduced ? false : { opacity: 0, scale: .92, rotateX: 10 }} animate={reduced ? undefined : { opacity: 1, scale: 1, rotateX: 0 }} transition={{ duration: .9, delay: .15, ease: [0.16, 1, 0.3, 1] }} className="relative">
            <div className="cinematic-orbit">
              {floatingCards.map(([title, text, Icon], index) => (
                <motion.div key={String(title)} initial={reduced ? false : { opacity: 0, y: 28 }} animate={reduced ? undefined : { opacity: 1, y: 0 }} transition={{ delay: .25 + index * .07, duration: .52 }} className={`cinematic-float-card cinematic-float-${index}`}>
                  <Icon size={20} className="text-cyan-200" />
                  <div>
                    <p className="font-black text-white">{String(title)}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">{String(text)}</p>
                  </div>
                </motion.div>
              ))}
              <div className="cinematic-core">
                <Sparkles className="text-amber-200" size={34} />
                <p className="mt-4 text-sm font-black uppercase tracking-[.2em] text-cyan-100">Büyüme kontrol merkezi</p>
                <p className="mt-3 text-5xl font-black text-white">HK OS</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <SectionShell id="services" eyebrow="02 Hizmetler" title="Reklam, içerik ve takip tek operasyon disiplininde birleşir." text="Her kanal kendi başına değil; hedef, bütçe, CRM ve rapor akışıyla birlikte yönetildiğinde gerçek sistem oluşur.">
        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {fixedServices.map((name, index) => {
            const matched = services.find((service) => service.name.toLocaleLowerCase("tr").includes(name.split(" ")[0].toLocaleLowerCase("tr")));
            const Icon = [BarChart3, Search, Rocket, BrainCircuit, Target, ShieldCheck][index] || Zap;
            return (
              <motion.div key={name} whileHover={{ y: -12, rotateX: 5, rotateY: index % 2 ? 3 : -3 }} className="cinematic-card group rounded-[18px] border border-white/10 bg-white/[0.045] p-6 shadow-[0_24px_80px_rgba(0,0,0,.22)]">
                <div className="grid size-13 place-items-center rounded-[14px] border border-cyan-200/20 bg-cyan-200/10 text-cyan-100 transition group-hover:scale-110 group-hover:bg-amber-200/15 group-hover:text-amber-100"><Icon size={24} /></div>
                <h3 className="mt-6 text-2xl font-black text-white">{name}</h3>
                <p className="mt-4 text-sm leading-7 text-slate-300">{matched?.description || "Strateji, kurulum, optimizasyon ve raporlama tek merkezde yönetilir."}</p>
                <Link href="/teklif-al" className="mt-6 inline-flex items-center gap-2 text-sm font-black text-cyan-200">Bu hizmeti konuşalım <ArrowRight size={16} /></Link>
              </motion.div>
            );
          })}
        </div>
        {services.length > 0 && <div className="mt-12"><ServiceGrid services={services} /></div>}
      </SectionShell>

      <SectionShell id="intelligence" eyebrow="03 HK Intelligence" title="Ajans hizmeti değil, işletme işletim sistemi." text="HK Intelligence; reklam sinyallerini, lead kalitesini, müşteri takibini ve AI yorumlarını tek bir karar ekranına taşır.">
        <div className="mt-12 grid items-center gap-10 lg:grid-cols-[.9fr_1.1fr]">
          <div className="grid gap-4">
            {["Müşteri Sıcaklık Puanı", "Dijital Olgunluk Skoru", "Reklam Performansı", "AI Yorum", "Teklif Motoru", "CRM Takibi"].map((item, index) => (
              <motion.div key={item} initial={reduced ? false : { opacity: 0, x: -30 }} whileInView={reduced ? undefined : { opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: index * .05 }} className="flex items-center gap-4 rounded-[16px] border border-white/10 bg-black/20 p-4">
                <span className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-cyan-300 to-amber-200 text-sm font-black text-slate-950">{index + 1}</span>
                <span className="font-black text-white">{item}</span>
              </motion.div>
            ))}
          </div>
          <MiniOsPanel />
        </div>
      </SectionShell>

      <SectionShell id="packages" eyebrow="04 Paketler" title="Paketler net, sistem güçlü, karar süreci sade." text={content.pages.packages?.intro || "Başlangıç, büyüme ve premium operasyon ihtiyaçlarına göre paketleri karşılaştırın."}>
        <div className="mt-12">
          <PackageCards packages={packages} />
        </div>
      </SectionShell>

      <SectionShell id="process" eyebrow="05 Süreç" title="Her kat bir sonraki büyüme kararına çıkar." text="Keşiften optimizasyona kadar her adım ölçülebilir, takip edilebilir ve müşteriye anlatılabilir şekilde ilerler.">
        <div className="relative mt-14">
          <div className="absolute left-5 top-0 hidden h-full w-px bg-gradient-to-b from-cyan-300 via-amber-200 to-orange-400 md:block" />
          <div className="grid gap-4">
            {processSteps.map((step, index) => (
              <motion.div key={step} initial={reduced ? false : { opacity: 0, x: -42 }} whileInView={reduced ? undefined : { opacity: 1, x: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ delay: index * .06, duration: .55 }} className="cinematic-card ml-0 grid gap-4 rounded-[18px] border border-white/10 bg-white/[0.045] p-5 md:ml-14 md:grid-cols-[120px_1fr]">
                <p className="text-3xl font-black text-cyan-200">0{index + 1}</p>
                <div>
                  <h3 className="text-2xl font-black text-white">{step}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-300">Bu aşamada veri toplanır, karar netleşir ve bir sonraki operasyon adımı hazırlanır.</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </SectionShell>

      <SectionShell id="contact" eyebrow="06 İletişim" title="İşletmenizi sadece reklama değil, sisteme bağlayalım." text="Kısa bir keşif görüşmesiyle reklam, CRM, raporlama ve AI analiz akışınızı nasıl kuracağımızı netleştirelim.">
        <div className="mt-10 grid items-start gap-8 lg:grid-cols-[.9fr_1.1fr]">
          <div className="cinematic-card rounded-[20px] border border-amber-200/18 bg-amber-200/[0.06] p-6">
            <MessageCircle className="text-amber-100" size={32} />
            <h3 className="mt-5 text-2xl font-black text-white">Hızlı başlangıç</h3>
            <p className="mt-4 text-sm leading-7 text-slate-300">İsterseniz WhatsApp üzerinden doğrudan yazın, isterseniz teklif formunu açıp işletmenizin hedeflerini gönderin.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <CinematicButton href={whatsappUrl}>WhatsApp ile Görüş</CinematicButton>
              <CinematicButton href="/teklif-al" variant="ghost">Teklif Formunu Aç</CinematicButton>
            </div>
          </div>
          <ContactForm />
        </div>
      </SectionShell>
    </div>
  );
}
