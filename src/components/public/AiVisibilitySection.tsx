"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, BrainCircuit, Radar, ScanSearch, Sparkles } from "lucide-react";

const aiFeatures = [
  "Markanızın yapay zekâ arama motorlarında (GEO) nasıl göründüğünü ölçme",
  "Yapay zekâ destekli içerik ve kampanya fikirleri",
  "Dijital olgunluk ve reklam hazırlığı analizi",
  "Anlaşılır Türkçe raporlama ve aksiyon önerileri"
];

export function AiVisibilitySection() {
  const reduced = useReducedMotion();

  return (
    <section id="ai-geo" className="cinematic-ai-grid relative overflow-hidden border-y border-white/10 px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
      <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_.95fr]">
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 40 }}
          whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="cinematic-eyebrow text-xs font-black uppercase tracking-[.22em]">Yapay Zekâ &amp; GEO Görünürlük</p>
          <h2 className="cinematic-title mt-5 text-3xl sm:text-5xl">
            MARKANIZ <span className="cinematic-title-highlight">YAPAY ZEKÂYA</span> GÖRÜNÜYOR MU?
          </h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-400 sm:text-lg">
            Arama artık yalnızca Google değil; kullanıcılar Gemini gibi yapay zekâ motorlarına da soru soruyor. HK Dijital, markanızın bu motorlarda nasıl konumlandığını izleyen ve içerik/pazarlama kararlarına bağlayan bir yapay zekâ altyapısı kullanır.
          </p>
          <ul className="mt-7 grid gap-3">
            {aiFeatures.map((feature) => (
              <li key={feature} className="flex items-start gap-3 text-sm leading-6 text-slate-300">
                <Sparkles size={15} className="mt-0.5 shrink-0 text-[#c4b5fd]" />
                {feature}
              </li>
            ))}
          </ul>
          <Link href="/hk-intelligence" className="mt-8 inline-flex items-center gap-2 text-sm font-black text-white">
            HK Intelligence sistemini inceleyin <ArrowRight size={16} />
          </Link>
        </motion.div>

        <motion.div
          initial={reduced ? false : { opacity: 0, scale: 0.94 }}
          whileInView={reduced ? undefined : { opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="relative mx-auto w-full max-w-md"
        >
          <div className="relative overflow-hidden rounded-[22px] border border-[#a78bfa]/25 bg-[#0a0714]/90 p-6 shadow-[0_30px_100px_rgba(0,0,0,.5)]">
            {!reduced && <div className="cinematic-scan-line" aria-hidden="true" />}
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.15em] text-[#c4b5fd]">
              <BrainCircuit size={16} /> Yapay Zekâ Görünürlük Taraması
            </div>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[.1em] text-slate-500">Örnek görselleştirme — gerçek müşteri verisi değildir</p>

            <div className="mt-5 grid gap-3">
              <div className="rounded-[14px] border border-white/10 bg-white/[0.03] p-4">
                <p className="flex items-center gap-2 text-xs font-bold text-slate-400"><ScanSearch size={13} /> &quot;Bölgede güvenilir hizmet sağlayıcı önerir misin?&quot;</p>
                <p className="mt-2 text-sm leading-6 text-slate-200">Yapay zekâ yanıtında markanızın adı, alternatif adları ve rakip görünürlüğü tespit edilir.</p>
              </div>
              <div className="flex items-center justify-between rounded-[14px] border border-[#a78bfa]/25 bg-[#7c3aed]/[0.08] p-4">
                <span className="text-xs font-bold text-slate-300">Görünürlük Skoru</span>
                <span className="text-lg font-black text-white">—/100</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {["Marka Geçme", "Öneri Konumu", "Rakip Payı"].map((label) => (
                  <div key={label} className="rounded-[10px] border border-white/10 bg-white/[0.03] p-2.5 text-center">
                    <Radar size={13} className="mx-auto text-[#4fa8f0]" />
                    <p className="mt-1 text-[9px] font-bold uppercase leading-tight tracking-wide text-slate-500">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {!reduced && (
            <>
              <span className="cinematic-node absolute -left-4 top-8 size-3" aria-hidden="true" />
              <span className="cinematic-node absolute -right-3 bottom-16 size-2.5" style={{ animationDelay: "-1.2s" }} aria-hidden="true" />
              <span className="cinematic-node absolute right-10 -top-3 size-2" style={{ animationDelay: "-2s" }} aria-hidden="true" />
            </>
          )}
        </motion.div>
      </div>
    </section>
  );
}
