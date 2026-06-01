"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { BarChart3, BrainCircuit, CheckCircle2, CircleDollarSign, Gauge, LineChart, Sparkles, Target } from "lucide-react";

const accentStyles = {
  cyan: "border-cyan-200/20 bg-cyan-200/[0.07] text-cyan-100",
  amber: "border-amber-200/20 bg-amber-200/[0.07] text-amber-100",
  blue: "border-blue-300/20 bg-blue-300/[0.07] text-blue-100",
  emerald: "border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-100"
};

export function GlassCard({ children, className = "", interactive = false }: { children: ReactNode; className?: string; interactive?: boolean }) {
  return <motion.div whileHover={interactive ? { y: -5, scale: 1.01 } : undefined} transition={{ duration: 0.24 }} className={`glass-card ${className}`}>{children}</motion.div>;
}

export function MetricCard3D({ label, value, note, accent = "cyan", icon }: { label: string; value: string | number; note?: string; accent?: keyof typeof accentStyles; icon?: ReactNode }) {
  return <motion.div whileHover={{ y: -6, rotateX: 2, rotateY: -2 }} className="glass-card metric-card-3d p-5">
    <div className="flex items-center justify-between gap-3"><p className="text-xs font-black uppercase tracking-[.16em] text-slate-400">{label}</p><span className={`grid size-9 place-items-center rounded-[8px] border ${accentStyles[accent]}`}>{icon || <BarChart3 size={17} />}</span></div>
    <p className="mt-5 text-3xl font-black text-white">{value}</p>{note && <p className="mt-3 text-xs leading-5 text-slate-400">{note}</p>}
  </motion.div>;
}

export function FloatingDashboardObject({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 5.4, delay, repeat: Infinity, ease: "easeInOut" }} className={`absolute glass-card p-3 ${className}`}>{children}</motion.div>;
}

export function AnimatedChart({ label = "Performans akışı", values = [24, 32, 28, 48, 42, 63, 58, 82] }: { label?: string; values?: number[] }) {
  const points = values.map((value, index) => `${index * (100 / Math.max(1, values.length - 1))},${100 - value}`).join(" ");
  return <div className="overflow-hidden rounded-[8px] border border-white/10 bg-black/20 p-4">
    <div className="flex items-center justify-between gap-4"><p className="text-xs font-black uppercase tracking-[.16em] text-slate-400">{label}</p><LineChart size={16} className="text-cyan-200" /></div>
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="mt-4 h-32 w-full"><polyline fill="none" stroke="#67e8f9" strokeWidth="2.6" points={points} vectorEffect="non-scaling-stroke" /></svg>
  </div>;
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

export function LoginShell3D({ children }: { children: ReactNode }) {
  return <section className="relative overflow-hidden px-4 py-16 sm:px-6 lg:px-8 lg:py-24"><div className="premium-grid absolute inset-0 opacity-70" /><div className="relative mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[.95fr_1.05fr]"><div><p className="text-xs font-black uppercase tracking-[.24em] text-cyan-100">Güvenli erişim noktası</p><h1 className="mt-5 text-4xl font-black leading-tight text-white sm:text-6xl">HK Dijital Marketing Center</h1><p className="mt-5 max-w-xl text-base leading-8 text-slate-300">Müşteri panelinize veya yönetim merkezine güvenli giriş yapın. Raporlarınız, süreç notlarınız ve performans özetleriniz tek merkezde.</p></div><div>{children}</div></div></section>;
}

export function PlatformSignalStrip() {
  return <div className="flex flex-wrap gap-2">{[["ADS", CircleDollarSign], ["AI", BrainCircuit], ["CRM", Target], ["META", BarChart3], ["GOOGLE", LineChart], ["ROAS", Gauge], ["REPORT", Sparkles], ["LEADS", CheckCircle2]].map(([label, Icon]) => <div key={String(label)} className="keyboard-key"><Icon size={14} /><span>{String(label)}</span></div>)}</div>;
}
