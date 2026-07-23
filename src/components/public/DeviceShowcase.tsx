"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { BarChart3, CalendarDays, Layers3, PackageSearch, Target, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { MacBookMockup, MacBookScreenChip } from "./MacBookMockup";

type DeviceModule = {
  label: string;
  text: string;
  Icon: LucideIcon;
  chips: Array<{ label: string; note: string }>;
};

const modules: DeviceModule[] = [
  {
    label: "Müşteri Yönetimi",
    text: "Her müşterinin hizmet kapsamı, iletişim geçmişi ve durumu tek panelde tutulur.",
    Icon: Users,
    chips: [
      { label: "Aktif müşteri", note: "Kapsam ve paket bilgisiyle" },
      { label: "İletişim geçmişi", note: "Tek panelde kayıtlı" }
    ]
  },
  {
    label: "Reklam Yönetimi",
    text: "Meta ve Google Ads kampanyaları aynı ekranda karşılaştırılıp optimize edilir.",
    Icon: BarChart3,
    chips: [
      { label: "Meta Ads", note: "Erişim ve mesaj sinyali" },
      { label: "Google Ads", note: "Arama niyeti ve maliyet" }
    ]
  },
  {
    label: "İçerik Planlama",
    text: "Sosyal medya içerik takvimi kampanyalarla uyumlu şekilde ilerler.",
    Icon: CalendarDays,
    chips: [
      { label: "İçerik takvimi", note: "Haftalık planlama" },
      { label: "Kreatif onayı", note: "Yayın öncesi kontrol" }
    ]
  },
  {
    label: "Lead Takibi",
    text: "Yeni talep, teklif ve takip aşamaları tek pipeline üzerinde görünür kalır.",
    Icon: Target,
    chips: [
      { label: "Yeni talep", note: "Anlık bildirim" },
      { label: "Takip aşaması", note: "Kaçırılan lead kalmaz" }
    ]
  },
  {
    label: "Raporlama",
    text: "Aylık performans raporu anlaşılır Türkçe yorumlarla müşteriye sunulur.",
    Icon: Layers3,
    chips: [
      { label: "Aylık rapor", note: "Sade, anlaşılır dil" },
      { label: "Aksiyon önerisi", note: "Sonraki adım netleşir" }
    ]
  },
  {
    label: "Paket Önerisi",
    text: "Paket Seçme Robotu; hedef, sektör ve bütçeye göre uygun paketi önerir.",
    Icon: PackageSearch,
    chips: [
      { label: "Hedef ve bütçe", note: "Birkaç soruda netleşir" },
      { label: "Önerilen paket", note: "Teklif akışına bağlanır" }
    ]
  }
];

const ROTATE_MS = 4200;

/**
 * Replaces the previous scroll-jacked 3D stage: that version tied the
 * MacBook screen's opening animation to scroll progress inside a 350vh
 * sticky container. Because the public <main> wrapper (Shell.tsx) sets
 * overflow-hidden, position:sticky loses its viewport-relative containing
 * block, so the "pinned" stage never reliably tracked scroll — it could
 * freeze mid-open, misjudge state after a refresh at a mid-scroll offset,
 * and burned ~3.5 screens of scroll height on very little content.
 *
 * This version is a normal-flow section: nothing here is scroll-linked, so
 * there is no scroll trap, no stuck state, and no dependency on sticky or a
 * fragile pixel offset. It reveals once via whileInView, then the active
 * module simply rotates on an interval (paused entirely for
 * prefers-reduced-motion, which just shows the first module statically).
 */
export function DeviceShowcase() {
  const reduced = useReducedMotion();
  const [active, setActive] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (reduced) return;
    timerRef.current = setInterval(() => setActive((value) => (value + 1) % modules.length), ROTATE_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [reduced]);

  const select = (index: number) => {
    setActive(index);
    if (timerRef.current) clearInterval(timerRef.current);
    if (!reduced) timerRef.current = setInterval(() => setActive((value) => (value + 1) % modules.length), ROTATE_MS);
  };

  const current = modules[active];

  return (
    <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.05fr]">
      <div>
        <div className="grid gap-2" role="tablist" aria-label="HK Dijital çalışma sistemi modülleri">
          {modules.map((module, index) => {
            const isActive = index === active;
            return (
              <button
                key={module.label}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => select(index)}
                className={`cinematic-card flex items-start gap-4 rounded-[14px] border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4fa8f0] ${isActive ? "border-[#4fa8f0]/60 bg-[#2f5bff]/[0.1]" : "border-white/10 bg-white/[0.02] hover:border-white/20"}`}
              >
                <span className={`mt-0.5 grid size-10 shrink-0 place-items-center rounded-[10px] border transition ${isActive ? "border-[#4fa8f0]/50 bg-[#2f5bff]/20 text-[#4fa8f0]" : "border-white/10 bg-white/[0.03] text-slate-400"}`}>
                  <module.Icon size={18} />
                </span>
                <span>
                  <span className={`block text-sm font-black ${isActive ? "text-white" : "text-slate-300"}`}>{module.label}</span>
                  <span className="mt-1 block text-xs leading-6 text-slate-500">{module.text}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative mx-auto flex w-full max-w-xl justify-center">
        <div className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(47,91,255,.16),transparent_65%)] blur-2xl" aria-hidden="true" />
        <MacBookMockup
          screen={
            <motion.div
              key={current.label}
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex h-full flex-col gap-[6%] p-[7%]"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-[.14em] text-[#4fa8f0]">{current.label}</span>
                <span className="macbook-screen-dot" aria-hidden="true" />
              </div>
              <div className="grid gap-2">
                {current.chips.map((chip) => (
                  <MacBookScreenChip key={chip.label} label={chip.label} note={chip.note} />
                ))}
              </div>
              <div className="mt-auto flex gap-1.5" aria-hidden="true">
                {modules.map((module, index) => (
                  <span key={module.label} className={`h-[3px] flex-1 rounded-full transition-colors ${index === active ? "bg-[#4fa8f0]" : "bg-white/10"}`} />
                ))}
              </div>
            </motion.div>
          }
        />
      </div>
    </div>
  );
}
