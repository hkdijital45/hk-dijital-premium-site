"use client";

import Link from "next/link";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, BarChart3, BrainCircuit, CalendarDays, Gauge, Layers3, MessageCircle, MousePointerClick, PieChart, Rocket, Search, ShieldCheck, Sparkles, Target, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { SiteContent } from "@/lib/types";
import { ContactForm } from "./ContactForm";
import { PackageCards, ServiceGrid } from "./ServicePackageSections";
import { trackMetaCtaClick } from "@/lib/meta-pixel";
import { blogPosts, serviceOverviewCards } from "@/lib/public-seo-content";
import { MacBookMockup, MacBookScreenChip } from "./MacBookMockup";

const osModules: Array<[string, string, LucideIcon]> = [
  ["Meta Reklamları", "Kreatif, hedef kitle, dönüşüm", BarChart3],
  ["Google Ads", "Arama niyeti ve bütçe kontrolü", Search],
  ["Performans Yorumu", "Net yorum ve sonraki adım", BrainCircuit],
  ["Talep Takibi", "Başvuru, teklif ve takip düzeni", Target],
  ["Raporlama", "Anlaşılır performans merkezi", Layers3],
  ["Önceliklendirme", "Satış potansiyeli ve takip sırası", Gauge]
];

const fixedServices = [
  "Meta Reklam Yönetimi",
  "Google Ads Yönetimi",
  "Sosyal Medya Yönetimi",
  "Dijital Pazarlama Danışmanlığı",
  "Ölçümleme ve Raporlama",
  "Web Sitesi ve Dönüşüm Danışmanlığı"
];

const intelligenceMetrics = [
  ["Kanal Önceliği", "Net", "Meta, Google veya sosyal medya sırası"],
  ["Dijital Hazırlık", "Kontrol", "Web, ölçüm ve teklif netliği"],
  ["Reklam Performansı", "Yorum", "Bütçe, tıklama ve erişim dengesi"],
  ["Aksiyon Özeti", "Hazır", "Müşteri dostu sonraki adımlar"],
  ["Teklif Uygunluğu", "Planlı", "Paket ve hizmet kapsamı önerisi"],
  ["Talep Takibi", "Düzenli", "Form, WhatsApp ve görüşme akışı"]
];

const processSteps = ["Keşif", "Analiz", "Strateji", "Kurulum", "Yayın", "Raporlama", "Optimizasyon"];

const proofMetrics = [
  ["CTR", "Tıklama oranı", "Reklamı görenlerin tıklama davranışını görünür hale getirir."],
  ["CPC", "Tıklama başı maliyet", "Reklam bütçesini daha kontrollü yönetmeye yardımcı olur."],
  ["ROAS", "Reklam harcamasının geri dönüşü", "Satış garantisi değil, ölçülebilir büyüme sistemi."],
  ["Dönüşüm", "Form, arama, WhatsApp veya satış aksiyonu", "Aksiyonları tek ekranda takip etmeye yardımcı olur."]
];

const dashboardBlocks: Array<[string, string, LucideIcon]> = [
  ["Meta Ads performans kartı", "Gösterim, erişim, mesaj ve kreatif testleri tek özet içinde takip edilir.", BarChart3],
  ["Google Ads arama performansı", "Arama niyeti, tıklama maliyeti ve dönüşüm sinyali birlikte okunur.", Search],
  ["Sosyal medya içerik takvimi", "Reels, hikâye, gönderi ve kampanya içerikleri planlı ilerler.", CalendarDays],
  ["Lead pipeline kartı", "Yeni lead, teklif, takip ve kazanım aşamaları görünür kalır.", Target],
  ["AI analiz kartı", "Metrikler sade Türkçe yorumlara ve sonraki aksiyonlara dönüşür.", BrainCircuit],
  ["Aylık rapor önizleme", "Müşteriye sunulabilir rapor, notlar ve öneriler aynı akışta hazırlanır.", Layers3]
];

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

function CinematicButton({ href, children, variant = "primary", trackingLabel = "Public CTA" }: { href: string; children: ReactNode; variant?: "primary" | "ghost"; trackingLabel?: string }) {
  const className = variant === "primary"
    ? "border-cyan-200/50 bg-cyan-300 text-slate-950 shadow-[0_0_54px_rgba(34,211,238,.28)] hover:bg-cyan-100"
    : "border-white/15 bg-white/[0.055] text-white hover:border-amber-200/50 hover:bg-amber-200/10";
  return <Link href={href} onClick={() => trackMetaCtaClick(trackingLabel, href)} className={`cinematic-press inline-flex min-h-13 items-center justify-center gap-2 rounded-full border px-6 text-sm font-black transition focus:outline-none focus:ring-2 focus:ring-cyan-300 ${className}`}>{children}</Link>;
}

function MiniOsPanel() {
  return (
    <div className="cinematic-dashboard relative mx-auto mt-12 max-w-5xl rounded-[18px] border border-cyan-200/18 bg-[#04101d]/70 p-4 shadow-[0_34px_110px_rgba(0,0,0,.42)] backdrop-blur-2xl lg:mt-0">
      <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.22em] text-cyan-200">Çalışma sistemimiz</p>
          <h3 className="mt-1 text-xl font-black text-white">Ölçüm ve raporlama görünümü</h3>
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

function MetricCounter({ value, label, text }: { value: string; label: string; text: string }) {
  return (
    <motion.div whileHover={{ y: -7, rotateX: 4 }} className="cinematic-card rounded-[16px] border border-white/10 bg-white/[0.045] p-5">
      <p className="text-3xl font-black text-white">{value}</p>
      <p className="mt-2 text-sm font-black text-cyan-100">{label}</p>
      <p className="mt-3 text-xs leading-5 text-slate-400">{text}</p>
    </motion.div>
  );
}

function CampaignVisualGrid() {
  return (
    <div className="mt-12 grid gap-4 lg:grid-cols-[1fr_.8fr]">
      <div className="cinematic-card rounded-[20px] border border-cyan-200/15 bg-[#06111f]/72 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-cyan-200">Kampanya panosu</p>
            <h3 className="mt-2 text-2xl font-black text-white">Bütçe, funnel ve lead kalitesi</h3>
          </div>
          <span className="rounded-full bg-amber-300 px-3 py-1 text-xs font-black text-slate-950">Kontrollü büyüme</span>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-4">
          {proofMetrics.map(([value, label, text]) => <MetricCounter key={value} value={value} label={label} text={text} />)}
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {["Bütçe dağılımı", "Dönüşüm hunisi", "ROAS değerlendirme"].map((item, index) => (
            <div key={item} className="rounded-[14px] border border-white/10 bg-black/18 p-4">
              <p className="text-sm font-black text-white">{item}</p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-amber-200 to-orange-400" style={{ width: `${62 + index * 13}%` }} />
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-400">Performansı görünür hale getirir; kesin satış garantisi vermez.</p>
            </div>
          ))}
        </div>
      </div>
      <div className="cinematic-card rounded-[20px] border border-amber-200/15 bg-amber-200/[0.055] p-5">
        <PieChart className="text-amber-100" size={32} />
        <h3 className="mt-5 text-2xl font-black text-white">Mini dönüşüm hunisi</h3>
        <div className="mt-5 grid gap-3">
          {["Görünürlük", "Tıklama", "Mesaj / Form", "Takip", "Teklif"].map((step, index) => (
            <div key={step} className="flex items-center gap-3">
              <span className="grid size-8 place-items-center rounded-full bg-cyan-300 text-xs font-black text-slate-950">{index + 1}</span>
              <div className="h-9 flex-1 rounded-full bg-white/10 p-1">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-amber-200" style={{ width: `${94 - index * 12}%` }} />
              </div>
              <span className="w-24 text-xs font-bold text-slate-300">{step}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HeroMacBookScreen() {
  return (
    <div className="flex h-full flex-col p-[6%]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-black uppercase tracking-[.2em] text-cyan-200">Ajans çalışma sistemi</span>
        <Sparkles className="text-amber-200" size={14} aria-hidden="true" />
      </div>
      <p className="mt-1 text-lg font-black text-white">HK Dijital</p>
      <div className="mt-3 grid flex-1 grid-cols-2 gap-1.5 content-start">
        {osModules.map(([title, text, Icon]) => (
          <MacBookScreenChip key={title} label={title} note={text.split(" ").slice(0, 3).join(" ")} icon={<Icon size={11} className="text-cyan-200" aria-hidden="true" />} />
        ))}
      </div>
    </div>
  );
}

function HeroOsVisual({ reduced }: { reduced: boolean | null }) {
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, scale: .97, y: 22 }}
      animate={reduced ? undefined : { opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: .72, delay: .2, ease: [0.16, 1, 0.3, 1] }}
      className="relative mx-auto flex w-full max-w-xl flex-col items-center"
    >
      <MacBookMockup size="large" showHint screen={<HeroMacBookScreen />} />
    </motion.div>
  );
}

function FloatingMacBook() {
  const { scrollYProgress } = useScroll();
  const opacity = useTransform(scrollYProgress, [0, 0.05, 0.1], [0, 0, 1]);
  const scale = useTransform(scrollYProgress, [0, 0.05, 0.1], [0.85, 0.85, 1]);
  return (
    <motion.div style={{ opacity, scale }} className="macbook-mockup-floating">
      <MacBookMockup
        size="small"
        screen={
          <div className="flex h-full flex-col items-center justify-center gap-1 p-[8%] text-center">
            <span className="text-[9px] font-black uppercase tracking-[.16em] text-cyan-200">HK Dijital</span>
            <span className="text-[8px] text-cyan-100/70">Giriş</span>
          </div>
        }
      />
    </motion.div>
  );
}

export function CinematicHomepage({ content }: { content: SiteContent }) {
  const reduced = useReducedMotion();
  const packages = content.packages?.length ? content.packages : [];
  const services = content.services?.length ? content.services : [];
  const whatsappUrl = content.socials?.whatsapp || (content.contact?.whatsappNumber ? `https://wa.me/${content.contact.whatsappNumber.replace(/\D/g, "")}` : "/iletisim");

  return (
    <div className="cinematic-home relative">
      <div className="cinematic-aurora pointer-events-none absolute inset-0" aria-hidden="true" />
      <FloatingMacBook />

      <section id="hero" className="cinematic-floor relative flex min-h-[calc(100svh-76px)] scroll-mt-20 items-center overflow-hidden px-4 py-20 sm:px-6 lg:px-8">
        <div className="cinematic-floor-glow" aria-hidden="true" />
        <div className="relative mx-auto grid w-full max-w-7xl items-center gap-14 lg:grid-cols-[1fr_1fr]">
          <motion.div initial={reduced ? false : { opacity: 0, y: 32 }} animate={reduced ? undefined : { opacity: 1, y: 0 }} transition={{ duration: .75, ease: [0.16, 1, 0.3, 1] }} className="relative z-10">
            <p className="cinematic-eyebrow text-xs font-black uppercase tracking-[.3em] text-amber-200">Manisa merkezli dijital pazarlama ajansı</p>
            <h1 className="cinematic-title mt-5 text-4xl font-black leading-[.96] tracking-tight text-white sm:text-6xl lg:text-7xl">
              Manisa Dijital Pazarlama Ajansı ile Reklamlarınızı Büyümeye Dönüştürün
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-8 text-slate-300 sm:text-xl">
              HK Dijital; Manisa merkezli işletmelere ve Türkiye genelindeki markalara Meta reklamları, Google Ads, sosyal medya stratejisi, dönüşüm takibi ve anlaşılır performans raporlaması sunar.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <CinematicButton href="/teklif-al" trackingLabel="Hero Ön Görüşme Al">Ücretsiz Ön Görüşme Al <ArrowRight size={18} /></CinematicButton>
              <CinematicButton href="/hizmetler" variant="ghost" trackingLabel="Hero Hizmetleri İncele">Hizmetleri İncele <MousePointerClick size={18} /></CinematicButton>
            </div>
            <div className="mt-6 flex flex-wrap gap-2 text-xs font-black text-slate-300">
              {["Manisa dijital pazarlama", "Meta reklamları", "Google Ads", "Sosyal medya", "Dönüşüm takibi"].map((item) => (
                <span key={item} className="rounded-full border border-cyan-200/20 bg-white/[0.06] px-3 py-2 shadow-[0_0_24px_rgba(34,211,238,.08)]">{item}</span>
              ))}
            </div>
          </motion.div>

          <HeroOsVisual reduced={reduced} />
        </div>
      </section>

      <SectionShell id="services" eyebrow="02 Hizmetler" title="Meta, Google Ads ve sosyal medya çalışmalarını tek stratejiye bağlayın." text="Her kanal kendi başına değil; hedef, bütçe, teklif, dönüşüm takibi ve raporlamayla birlikte yönetildiğinde sağlıklı karar üretir.">
        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {fixedServices.map((name, index) => {
            const matched = services.find((service) => service.name.toLocaleLowerCase("tr").includes(name.split(" ")[0].toLocaleLowerCase("tr")));
            const Icon = [BarChart3, Search, Rocket, BrainCircuit, Target, ShieldCheck][index] || Zap;
            return (
              <motion.div key={name} whileHover={{ y: -12, rotateX: 5, rotateY: index % 2 ? 3 : -3 }} className="cinematic-card group rounded-[18px] border border-white/10 bg-white/[0.045] p-6 shadow-[0_24px_80px_rgba(0,0,0,.22)]">
                <div className="grid size-13 place-items-center rounded-[14px] border border-cyan-200/20 bg-cyan-200/10 text-cyan-100 transition group-hover:scale-110 group-hover:bg-amber-200/15 group-hover:text-amber-100"><Icon size={24} /></div>
                <h3 className="mt-6 text-2xl font-black text-white">{name}</h3>
                <p className="mt-4 text-sm leading-7 text-slate-300">{matched?.description || "Strateji, kurulum, optimizasyon ve raporlama tek merkezde yönetilir."}</p>
                <Link href={serviceOverviewCards[index]?.href || "/hizmetler"} className="mt-6 inline-flex items-center gap-2 text-sm font-black text-cyan-200">Hizmeti incele <ArrowRight size={16} /></Link>
              </motion.div>
            );
          })}
        </div>
        {services.length > 0 && <div className="mt-12"><ServiceGrid services={services} /></div>}
        <CampaignVisualGrid />
      </SectionShell>

      <SectionShell id="intelligence" eyebrow="03 Çalışma sistemimiz" title="Reklam verisini anlaşılır karar ve aksiyonlara çeviririz." text="HK Dijital’in iç analiz sistemi; reklam sinyallerini, talep kalitesini ve raporlama notlarını müşteriye sade anlatılabilir hale getirir. Ana hizmet reklam ve dijital pazarlama danışmanlığıdır.">
        <div className="mt-12 grid items-center gap-10 lg:grid-cols-[.9fr_1.1fr]">
          <div className="grid gap-4">
            {["Kanal önceliği", "Dijital hazırlık", "Reklam performansı", "Aksiyon özeti", "Teklif uygunluğu", "Talep takibi"].map((item, index) => (
              <motion.div key={item} initial={reduced ? false : { opacity: 0, x: -30 }} whileInView={reduced ? undefined : { opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: index * .05 }} className="flex items-center gap-4 rounded-[16px] border border-white/10 bg-black/20 p-4">
                <span className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-cyan-300 to-amber-200 text-sm font-black text-slate-950">{index + 1}</span>
                <span className="font-black text-white">{item}</span>
              </motion.div>
            ))}
          </div>
          <MiniOsPanel />
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {dashboardBlocks.map(([title, text, Icon]) => (
            <div key={String(title)} className="cinematic-card rounded-[18px] border border-white/10 bg-white/[0.04] p-5">
              <Icon className="text-cyan-100" size={26} />
              <h3 className="mt-4 text-xl font-black text-white">{String(title)}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-300">{String(text)}</p>
            </div>
          ))}
        </div>
      </SectionShell>

      <SectionShell id="packages" eyebrow="04 Paketler" title="Hizmet kapsamını, bütçeyi ve beklentiyi baştan netleştirin." text={content.pages.packages?.intro || "Başlangıç, büyüme ve premium operasyon ihtiyaçlarına göre paketleri karşılaştırın."}>
        <div className="mt-12">
          <PackageCards packages={packages} />
        </div>
      </SectionShell>

      <SectionShell id="process" eyebrow="05 Süreç" title="Keşiften rapora kadar sade ve izlenebilir çalışma süreci." text="Keşiften optimizasyona kadar her adım ölçülebilir, takip edilebilir ve müşteriye anlatılabilir şekilde ilerler.">
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

      <SectionShell id="local-seo" eyebrow="06 Manisa ve Türkiye geneli" title="Manisa merkezli işletmeler için yerel dijital pazarlama desteği." text="Şehzadeler, Yunusemre, Akhisar, Turgutlu, Salihli, Soma, Alaşehir ve Saruhanlı başta olmak üzere Manisa merkez ve ilçelerine; ayrıca Türkiye geneline uzaktan hizmet veriyoruz.">
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {["Yerel işletmeler", "Hizmet markaları", "E-ticaret ve danışmanlık ekipleri"].map((title) => (
            <div key={title} className="cinematic-card rounded-[18px] border border-white/10 bg-white/[0.045] p-6">
              <h3 className="text-xl font-black text-white">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-300">Reklam, sosyal medya, dönüşüm takibi ve raporlama ihtiyacı işletmenin hizmet alanına göre planlanır.</p>
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <CinematicButton href="/manisa-dijital-pazarlama" trackingLabel="Manisa Landing İncele">Manisa dijital pazarlama hizmetleri</CinematicButton>
          <CinematicButton href="/hakkimda" variant="ghost" trackingLabel="HK Dijital Hakkında">HK Dijital&apos;i Tanıyın</CinematicButton>
        </div>
      </SectionShell>

      <SectionShell id="faq-blog" eyebrow="07 Kaynaklar" title="Sık sorulan sorular ve başlangıç rehberleri." text="Karar vermeden önce kanal seçimi, bütçe ve ölçümleme mantığını sade biçimde inceleyebilirsiniz.">
        <div className="mt-10 grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
          <div className="grid gap-4">
            {[
              ["Manisa dışındaki işletmelere hizmet veriliyor mu?", "Evet. HK Dijital Manisa merkezlidir; Türkiye genelindeki işletmelerle uzaktan çalışma modeli kurulabilir."],
              ["Satış garantisi veriliyor mu?", "Hayır. Satış garantisi verilmez; strateji, kurulum, optimizasyon, dönüşüm takibi ve raporlama süreci yönetilir."],
              ["Hangi reklam kanalıyla başlamalıyım?", "Bu karar sektör, hedef, bütçe ve mevcut dijital varlıklara göre ön görüşmede netleştirilir."]
            ].map(([question, answer]) => (
              <div key={question} className="cinematic-card rounded-[18px] border border-white/10 bg-white/[0.045] p-6">
                <h3 className="text-lg font-black text-white">{question}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">{answer}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-4">
            {blogPosts.map((post) => (
              <Link key={post.slug} href={`/blog/${post.slug}`} className="cinematic-card block rounded-[18px] border border-cyan-200/15 bg-cyan-200/[0.055] p-6 transition hover:-translate-y-1 hover:border-cyan-200/30">
                <p className="text-xs font-black uppercase tracking-[.2em] text-cyan-200">{post.readingTime}</p>
                <h3 className="mt-3 text-xl font-black text-white">{post.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">{post.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </SectionShell>

      <SectionShell id="contact" eyebrow="08 İletişim" title="İşletmenizin dijital pazarlama yol haritasını netleştirelim." text="Kısa bir keşif görüşmesiyle reklam, dönüşüm takibi ve raporlama ihtiyacınızı değerlendirelim.">
        <div className="mt-10 grid items-start gap-8 lg:grid-cols-[.9fr_1.1fr]">
          <div className="cinematic-card rounded-[20px] border border-amber-200/18 bg-amber-200/[0.06] p-6">
            <MessageCircle className="text-amber-100" size={32} />
            <h3 className="mt-5 text-2xl font-black text-white">Hızlı başlangıç</h3>
            <p className="mt-4 text-sm leading-7 text-slate-300">İsterseniz WhatsApp üzerinden doğrudan yazın, isterseniz teklif formunu açıp işletmenizin hedeflerini gönderin.</p>
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
