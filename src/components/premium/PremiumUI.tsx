"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { BarChart3, BrainCircuit, CheckCircle2, CircleDollarSign, Gauge, LineChart, Sparkles, Target } from "lucide-react";

const accentStyles = {
  cyan: "border-cyan-200/40 bg-gradient-to-br from-cyan-400 via-sky-500 to-blue-600 text-white shadow-[0_22px_55px_rgba(6,182,212,.28)]",
  amber: "border-amber-100/45 bg-gradient-to-br from-yellow-300 via-amber-400 to-orange-500 text-white shadow-[0_22px_55px_rgba(245,158,11,.28)]",
  blue: "border-blue-100/45 bg-gradient-to-br from-blue-500 via-sky-500 to-cyan-400 text-white shadow-[0_22px_55px_rgba(59,130,246,.30)]",
  emerald: "border-emerald-100/45 bg-gradient-to-br from-emerald-400 via-green-500 to-teal-600 text-white shadow-[0_22px_55px_rgba(16,185,129,.30)]",
  purple: "border-purple-100/45 bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 text-white shadow-[0_22px_55px_rgba(168,85,247,.30)]",
  orange: "border-orange-100/45 bg-gradient-to-br from-orange-400 via-pink-500 to-rose-500 text-white shadow-[0_22px_55px_rgba(249,115,22,.30)]",
  pink: "border-pink-100/45 bg-gradient-to-br from-pink-400 via-rose-500 to-fuchsia-500 text-white shadow-[0_22px_55px_rgba(236,72,153,.30)]",
  indigo: "border-indigo-100/45 bg-gradient-to-br from-indigo-500 via-blue-600 to-violet-600 text-white shadow-[0_22px_55px_rgba(99,102,241,.30)]",
  yellow: "border-yellow-100/45 bg-gradient-to-br from-yellow-300 via-amber-400 to-orange-400 text-white shadow-[0_22px_55px_rgba(250,204,21,.32)]",
  gold: "border-yellow-100/45 bg-gradient-to-br from-yellow-300 via-orange-400 to-amber-600 text-white shadow-[0_22px_55px_rgba(250,204,21,.34)]",
  red: "border-red-100/45 bg-gradient-to-br from-red-500 via-orange-500 to-amber-500 text-white shadow-[0_22px_55px_rgba(239,68,68,.30)]",
  slate: "border-cyan-100/35 bg-gradient-to-br from-slate-500 via-cyan-600 to-sky-700 text-white shadow-[0_22px_55px_rgba(14,165,233,.26)]",
  rose: "border-rose-100/45 bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-500 text-white shadow-[0_22px_55px_rgba(244,63,94,.30)]",
  teal: "border-teal-100/45 bg-gradient-to-br from-teal-400 via-cyan-500 to-emerald-600 text-white shadow-[0_22px_55px_rgba(20,184,166,.30)]",
  coral: "border-orange-100/45 bg-gradient-to-br from-orange-400 via-red-400 to-pink-500 text-white shadow-[0_22px_55px_rgba(251,113,133,.30)]",
  lime: "border-lime-100/45 bg-gradient-to-br from-lime-400 via-green-500 to-emerald-600 text-white shadow-[0_22px_55px_rgba(132,204,22,.30)]"
};

export function GlassCard({ children, className = "", interactive = false }: { children: ReactNode; className?: string; interactive?: boolean }) {
  return <motion.div whileHover={interactive ? { y: -8, scale: 1.018, rotateX: 2, rotateY: -2 } : undefined} whileTap={interactive ? { scale: 0.985 } : undefined} transition={{ duration: 0.2 }} className={`glass-card ${interactive ? "impact-card" : ""} ${className}`}>{children}</motion.div>;
}

export function AnimatedKpiCounter({ value }: { value: string | number }) {
  const numeric = typeof value === "number" ? value : Number(String(value).replace(/[^\d.]/g, ""));
  const reduceMotion = useReducedMotion();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!Number.isFinite(numeric) || reduceMotion) return;
    const start = performance.now();
    const duration = 900;
    let frame = 0;
    const tick = (time: number) => {
      const progress = Math.min(1, (time - start) / duration);
      setCurrent(Math.round(numeric * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [numeric, reduceMotion]);

  if (!Number.isFinite(numeric) || String(value).match(/[^\d]/)) return <>{value}</>;
  if (reduceMotion) return <>{numeric}</>;
  return <>{current}</>;
}

export function MetricCard3D({ label, value, note, accent = "cyan", icon }: { label: string; value: string | number; note?: string; accent?: keyof typeof accentStyles; icon?: ReactNode }) {
  return <motion.div initial={{ opacity: 0, y: 18, rotateX: 5 }} whileInView={{ opacity: 1, y: 0, rotateX: 0 }} viewport={{ once: true, margin: "-60px" }} whileHover={{ y: -8, rotateX: 3, rotateY: -3, scale: 1.015 }} className={`glass-card metric-card-3d relative overflow-hidden border p-5 ${accentStyles[accent]}`}>
    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,.16),transparent)] opacity-0 transition group-hover:opacity-100" />
    <div className={`pointer-events-none absolute -right-10 -top-10 size-28 rounded-full blur-3xl ${accentStyles[accent]}`} />
    <div className="flex items-center justify-between gap-3"><p className="text-xs font-black uppercase tracking-[.16em] text-white/75">{label}</p><span className="grid size-9 place-items-center rounded-[8px] border border-white/25 bg-white/15 text-white shadow-[0_0_24px_rgba(255,255,255,.12)]">{icon || <BarChart3 size={17} />}</span></div>
    <p className="mt-5 text-3xl font-black text-white"><AnimatedKpiCounter value={value} /></p>{note && <p className="mt-3 text-xs leading-5 text-white/72">{note}</p>}
  </motion.div>;
}

export function FloatingDashboardObject({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 5.4, delay, repeat: Infinity, ease: "easeInOut" }} className={`absolute glass-card p-3 ${className}`}>{children}</motion.div>;
}

export function AnimatedChart({ label = "Performans akışı", values = [24, 32, 28, 48, 42, 63, 58, 82] }: { label?: string; values?: number[] }) {
  const points = values.map((value, index) => `${index * (100 / Math.max(1, values.length - 1))},${100 - value}`).join(" ");
  return <div className="overflow-hidden rounded-[8px] border border-white/10 bg-black/20 p-4">
    <div className="flex items-center justify-between gap-4"><p className="text-xs font-black uppercase tracking-[.16em] text-slate-400">{label}</p><LineChart size={16} className="text-cyan-200" /></div>
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="mt-4 h-32 w-full"><polyline className="chart-draw-line" fill="none" stroke="#67e8f9" strokeWidth="2.6" points={points} vectorEffect="non-scaling-stroke" /></svg>
  </div>;
}

export function AnimatedBarChart({ values = [64, 48, 78, 56, 88, 72], labels = ["Meta", "Google", "CRM", "AI", "ROAS", "Lead"] }: { values?: number[]; labels?: string[] }) {
  return <div className="grid h-40 grid-cols-6 items-end gap-2">
    {values.map((value, index) => (
      <div key={`${labels[index]}-${index}`} className="flex h-full flex-col justify-end gap-2">
        <motion.div initial={{ height: 8 }} whileInView={{ height: `${Math.max(12, Math.min(100, value))}%` }} viewport={{ once: true }} transition={{ duration: .85, delay: index * .06, ease: "easeOut" }} className="rounded-t-[7px] border border-cyan-100/20 bg-gradient-to-t from-cyan-400/70 via-blue-300/55 to-amber-200/75 shadow-[0_0_22px_rgba(34,211,238,.2)]" />
        <span className="truncate text-center text-[10px] font-black text-slate-500">{labels[index]}</span>
      </div>
    ))}
  </div>;
}

export function AnimatedFunnel() {
  const stages = [
    ["Farkındalık", "86%", "from-cyan-300/70 to-blue-500/35"],
    ["Trafik", "64%", "from-blue-300/70 to-indigo-500/35"],
    ["Remarketing", "42%", "from-amber-300/70 to-orange-500/35"],
    ["Dönüşüm", "18%", "from-emerald-300/70 to-teal-500/35"]
  ];
  return <div className="grid gap-2">
    {stages.map(([label, value, color], index) => (
      <motion.div key={label} initial={{ opacity: 0, scaleX: .72 }} whileInView={{ opacity: 1, scaleX: 1 }} viewport={{ once: true }} transition={{ duration: .65, delay: index * .08 }} className={`mx-auto flex h-11 origin-center items-center justify-between rounded-[8px] border border-white/10 bg-gradient-to-r ${color} px-4 text-xs font-black text-white shadow-[0_18px_40px_rgba(0,0,0,.16)]`} style={{ width: `${100 - index * 14}%` }}>
        <span>{label}</span><span>{value}</span>
      </motion.div>
    ))}
  </div>;
}

const brandEcosystemItems = [
  ["Apple", "", "from-slate-100/95 to-white/55"],
  ["Meta", "∞", "from-blue-300/90 to-cyan-300/55"],
  ["Facebook", "f", "from-blue-500/90 to-sky-400/55"],
  ["Instagram", "◎", "from-pink-400/90 to-orange-300/55"],
  ["Google", "G", "from-blue-300/90 to-emerald-300/55"],
  ["Google Ads", "Ads", "from-cyan-300/90 to-blue-400/55"],
  ["Google Maps", "Pin", "from-emerald-300/90 to-lime-300/55"],
  ["YouTube", "▶", "from-red-400/90 to-rose-300/55"],
  ["TikTok", "♪", "from-slate-100/95 to-pink-300/55"],
  ["LinkedIn", "in", "from-sky-400/90 to-blue-300/55"],
  ["WhatsApp", "WA", "from-green-300/90 to-lime-300/55"],
  ["OpenAI", "AI", "from-emerald-200/90 to-slate-100/55"],
  ["Gemini", "Gem", "from-violet-300/90 to-cyan-300/55"],
  ["Groq", "GQ", "from-orange-300/90 to-amber-200/55"]
];

export function BrandEcosystemStrip({ compact = false }: { compact?: boolean }) {
  const items = compact ? brandEcosystemItems.slice(0, 8) : brandEcosystemItems;
  return <div className="flex flex-wrap gap-2">
    {items.map(([name, mark, color], index) => (
      <motion.div
        key={name}
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: .45, delay: index * .035 }}
        className="brand-chip inline-flex min-h-10 items-center gap-2 rounded-full border border-white/12 bg-white/[0.065] px-3 text-[10px] font-black uppercase tracking-[.12em] text-white shadow-[0_14px_38px_rgba(0,0,0,.2)] backdrop-blur-xl"
      >
        <span className={`grid size-6 place-items-center rounded-full bg-gradient-to-br ${color} text-[10px] font-black text-slate-950 shadow-[0_0_22px_rgba(255,255,255,.12)]`}>{mark}</span>
        {!compact && <span>{name}</span>}
      </motion.div>
    ))}
  </div>;
}

export function FloatingBrandEcosystem({ subtle = false }: { subtle?: boolean }) {
  const positions = [
    "left-[4%] top-[12%]", "right-[7%] top-[16%]", "left-[13%] top-[48%]", "right-[14%] top-[46%]",
    "left-[6%] bottom-[18%]", "right-[9%] bottom-[20%]", "left-[42%] top-[8%]", "right-[38%] bottom-[10%]"
  ];
  return <div className="pointer-events-none absolute inset-0 hidden overflow-hidden lg:block">
    {brandEcosystemItems.slice(0, 8).map(([name, mark, color], index) => (
      <motion.div
        key={name}
        animate={{ y: [0, -12, 0], opacity: subtle ? [.18, .34, .18] : [.35, .72, .35] }}
        transition={{ duration: 7 + index * .35, delay: index * .25, repeat: Infinity, ease: "easeInOut" }}
        className={`absolute ${positions[index]} rounded-full border border-white/10 bg-white/[0.055] px-3 py-2 text-[10px] font-black uppercase tracking-[.12em] text-white/80 shadow-[0_18px_60px_rgba(0,0,0,.22)] backdrop-blur-xl`}
      >
        <span className={`mr-2 inline-grid size-5 place-items-center rounded-full bg-gradient-to-br ${color} text-[9px] text-slate-950`}>{mark}</span>
        {name}
      </motion.div>
    ))}
  </div>;
}

export function PremiumBackground({ className = "" }: { className?: string }) {
  return <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
    <div className="premium-grid public-grid-drive absolute inset-0 opacity-90" />
    <div className="cinematic-light cinematic-light-a" />
    <div className="cinematic-light cinematic-light-b" />
    <div className="public-beam public-beam-a" />
    <div className="public-beam public-beam-b" />
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(125,211,252,.20),transparent_38%),linear-gradient(180deg,rgba(255,255,255,.035),transparent_24%)]" />
    <FloatingBrandEcosystem subtle />
    <div className="noise-layer absolute inset-0 opacity-[.08]" />
  </div>;
}

export function FloatingBadge({ label, className = "", delay = 0 }: { label: string; className?: string; delay?: number }) {
  return <motion.div initial={{ opacity: 0, y: 12, scale: .94 }} animate={{ opacity: 1, y: [0, -9, 0], scale: 1 }} transition={{ opacity: { duration: .4, delay }, y: { duration: 5.2, delay, repeat: Infinity, ease: "easeInOut" } }} className={`absolute rounded-full border border-white/15 bg-white/[0.08] px-3 py-2 text-[10px] font-black uppercase tracking-[.14em] text-white shadow-[0_18px_50px_rgba(0,0,0,.24)] backdrop-blur-xl ${className}`}>{label}</motion.div>;
}

export function AnimatedMarketingDashboard({ className = "" }: { className?: string }) {
  const chartValues = useMemo(() => [22, 38, 34, 58, 46, 72, 64, 86], []);
  return <motion.div initial={{ opacity: 0, y: 44, rotateX: 12, rotateY: -12, scale: .94 }} animate={{ opacity: 1, y: 0, rotateX: 0, rotateY: 0, scale: 1 }} transition={{ duration: .78, ease: [0.16, 1, 0.3, 1] }} whileHover={{ rotateX: 3, rotateY: -5, y: -10, scale: 1.015 }} className={`perspective-scene relative mx-auto max-w-2xl ${className}`}>
    <div className="dashboard-impact-panel relative rounded-[18px] border border-white/15 bg-slate-950/80 p-3 shadow-[0_36px_120px_rgba(0,0,0,.55),0_0_70px_rgba(34,211,238,.14)]">
      <div className="flex h-7 items-center gap-2 rounded-t-[12px] border border-white/10 bg-white/[0.06] px-3">
        <span className="size-2 rounded-full bg-red-300" /><span className="size-2 rounded-full bg-amber-300" /><span className="size-2 rounded-full bg-emerald-300" />
        <span className="ml-3 text-[10px] font-black uppercase tracking-[.16em] text-slate-500">HK Dijital Command Center</span>
      </div>
      <div className="grid gap-3 rounded-b-[12px] border-x border-b border-white/10 bg-[linear-gradient(145deg,rgba(15,23,42,.88),rgba(2,6,23,.98))] p-4 md:grid-cols-[1.15fr_.85fr]">
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-3">
            {[["ROAS", "4.8x", "cyan"], ["Lead", "214", "amber"], ["CRM", "92%", "emerald"]].map(([label, value, accent]) => (
              <div key={label} className={`rounded-[8px] border p-3 ${accentStyles[accent as keyof typeof accentStyles]}`}>
                <p className="text-[10px] font-black uppercase tracking-[.14em] text-white/65">{label}</p>
                <p className="mt-2 text-xl font-black text-white">{value}</p>
              </div>
            ))}
          </div>
          <AnimatedChart label="Reklam performans çizgisi" values={chartValues} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[8px] border border-orange-200/20 bg-orange-300/[0.08] p-3"><p className="text-xs font-black text-orange-100">Meta Ads</p><p className="mt-2 text-[11px] leading-5 text-slate-300">Kreatif testi ve remarketing akışı hazır.</p></div>
            <div className="rounded-[8px] border border-cyan-200/20 bg-cyan-300/[0.08] p-3"><p className="text-xs font-black text-cyan-100">Google Ads</p><p className="mt-2 text-[11px] leading-5 text-slate-300">Yüksek niyetli aramalar ayrıştırıldı.</p></div>
          </div>
        </div>
        <div className="grid gap-3">
          <div className="rounded-[8px] border border-purple-200/20 bg-purple-300/[0.08] p-3"><p className="text-xs font-black text-purple-100">AI Insight</p><p className="mt-2 text-[11px] leading-5 text-slate-300">Sıcak lead için teklif ve takip önerisi üretildi.</p></div>
          <AnimatedFunnel />
          <div className="rounded-[8px] border border-emerald-200/20 bg-emerald-300/[0.08] p-3"><p className="text-xs font-black text-emerald-100">CRM Lead</p><div className="mt-3 h-2 rounded-full bg-white/10"><motion.div initial={{ width: "20%" }} animate={{ width: ["42%", "78%", "64%"] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }} className="h-full rounded-full bg-emerald-300" /></div></div>
        </div>
      </div>
      <div className="border-t border-white/10 p-3">
        <BrandEcosystemStrip compact />
      </div>
    </div>
    <FloatingBadge label="META" className="-left-5 top-10 hidden sm:block" delay={.15} />
    <FloatingBadge label="GOOGLE" className="-right-6 top-24 hidden sm:block" delay={.45} />
    <FloatingBadge label="AI" className="bottom-16 left-4 hidden sm:block" delay={.8} />
    <FloatingBadge label="LEADS" className="-bottom-4 right-10 hidden sm:block" delay={1.05} />
    <div className="mx-auto h-4 w-[70%] rounded-b-[16px] bg-gradient-to-r from-slate-800 via-slate-500 to-slate-800 shadow-[0_18px_40px_rgba(0,0,0,.4)]" />
  </motion.div>;
}

export function PremiumAnimatedHero({ headline, subheadline, primaryCta, secondaryCta }: { headline: string; subheadline: string; primaryCta: ReactNode; secondaryCta: ReactNode }) {
  return <section className="hero-impact relative min-h-[760px] overflow-hidden border-b border-white/5 px-4 pb-20 pt-20 sm:px-6 lg:px-8 lg:pb-28 lg:pt-28">
    <PremiumBackground />
    <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[.95fr_1.05fr]">
      <motion.div initial={{ opacity: 0, y: 46, skewY: 1.4 }} animate={{ opacity: 1, y: 0, skewY: 0 }} transition={{ duration: .74, ease: [0.16, 1, 0.3, 1] }}>
        <p className="glitch-label inline-flex rounded-full border border-cyan-200/20 bg-cyan-200/10 px-4 py-2 text-sm font-black text-cyan-100 shadow-[0_0_30px_rgba(34,211,238,.12)]" data-text="HK Dijital Marketing OS">
          HK Dijital Marketing OS · Meta Ads · Google Ads · AI Raporlama
        </p>
        <h1 className="split-reveal mt-7 max-w-4xl text-4xl font-black leading-[1.04] tracking-tight text-white sm:text-6xl lg:text-7xl">
          {headline}
        </h1>
        <p className="mt-7 max-w-2xl text-base leading-8 text-slate-200 sm:text-lg">{subheadline}</p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">{primaryCta}{secondaryCta}</div>
        <div className="mt-10"><PlatformSignalStrip /></div>
        <div className="mt-5"><BrandEcosystemStrip compact /></div>
      </motion.div>
      <AnimatedMarketingDashboard />
    </div>
  </section>;
}

export function AIInsightCard({ title, text }: { title: string; text: string }) {
  return <GlassCard className="p-5" interactive><div className="flex items-center gap-3"><BrainCircuit className="text-amber-100" size={20} /><p className="text-xs font-black uppercase tracking-[.16em] text-amber-100">HK Intelligence</p></div><h3 className="mt-5 text-lg font-black text-white">{title}</h3><p className="mt-3 text-sm leading-7 text-slate-300">{text}</p></GlassCard>;
}

export function CRMKanban() {
  return <div className="grid gap-3 sm:grid-cols-3">{[["Yeni Talepler", "12", "cyan"], ["Teklif Süreci", "08", "amber"], ["Takipte", "16", "blue"]].map(([title, count, accent]) => <div key={title} className={`rounded-[8px] border p-4 ${accentStyles[accent as keyof typeof accentStyles]}`}><p className="text-xs font-black uppercase tracking-[.14em]">{title}</p><p className="mt-5 text-3xl font-black text-white">{count}</p><div className="mt-4 space-y-2">{[1, 2].map((item) => <div key={item} className="h-7 rounded-[6px] border border-white/10 bg-black/15" />)}</div></div>)}</div>;
}

export function CustomerMetricCard({ title, value, help, accent = "cyan" }: { title: string; value: string | number; help: string; accent?: keyof typeof accentStyles }) {
  return <GlassCard className="p-5" interactive><div className="flex items-center justify-between gap-3"><p className="text-sm font-bold text-slate-300">{title}</p><span className={`grid size-9 place-items-center rounded-[8px] border ${accentStyles[accent]}`}><Gauge size={17} /></span></div><p className="mt-5 text-3xl font-black text-white">{value}</p><p className="mt-3 text-xs leading-5 text-slate-400">{help}</p></GlassCard>;
}

export function ReportPreview() {
  return <GlassCard className="p-5"><p className="text-xs font-black uppercase tracking-[.16em] text-cyan-100">Canlı raporlama</p><h3 className="mt-2 text-xl font-black text-white">Kanal performansı tek görünümde</h3><div className="mt-5 grid gap-3 sm:grid-cols-3">{[["ROAS", "4.2x"], ["Potansiyel müşteri", "186"], ["Maliyet", "₺14,8K"]].map(([label, value]) => <div key={label} className="rounded-[8px] border border-white/10 bg-black/20 p-3"><p className="text-xs text-slate-400">{label}</p><p className="mt-1 text-lg font-black text-white">{value}</p></div>)}</div><div className="mt-4"><AnimatedChart label="Son 30 gün performansı" /></div></GlassCard>;
}

export function ScrollScene3D({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <motion.div initial={{ opacity: 0, y: 28, rotateX: 4 }} whileInView={{ opacity: 1, y: 0, rotateX: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.7 }} className={`perspective-scene ${className}`}>{children}</motion.div>;
}

export function LoginShell3D({ children, logo }: { children: ReactNode; logo?: ReactNode }) {
  return <section className="relative overflow-hidden px-4 py-16 sm:px-6 lg:px-8 lg:py-24"><div className="premium-grid absolute inset-0 opacity-70" /><div className="relative mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[.95fr_1.05fr]"><div>{logo && <div className="mb-8">{logo}</div>}<p className="text-xs font-black uppercase tracking-[.24em] text-cyan-100">Digital Marketing Command Center</p><h1 className="mt-5 text-4xl font-black leading-tight text-white sm:text-6xl">HK Operating System</h1><p className="mt-3 text-sm font-black uppercase tracking-[.2em] text-amber-100">Powered by HK Dijital</p><p className="mt-5 max-w-xl text-base leading-8 text-slate-300">Müşteri panelinize veya yönetim merkezine güvenli giriş yapın. Raporlarınız, süreç notlarınız ve performans özetleriniz tek merkezde.</p></div><div>{children}</div></div></section>;
}

export function PlatformSignalStrip() {
  return <div className="flex flex-wrap gap-2">{[["ADS", CircleDollarSign], ["AI", BrainCircuit], ["CRM", Target], ["META", BarChart3], ["GOOGLE", LineChart], ["ROAS", Gauge], ["REPORT", Sparkles], ["LEADS", CheckCircle2]].map(([label, Icon]) => <div key={String(label)} className="keyboard-key"><Icon size={14} /><span>{String(label)}</span></div>)}</div>;
}
