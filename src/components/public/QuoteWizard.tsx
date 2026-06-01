"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, MessageCircle, Sparkles, Target, Trophy } from "lucide-react";
import type { PackageItem, SiteContent } from "@/lib/types";
import { trackEvent } from "./TrackingPlaceholders";

type Answers = Record<string, string>;
type QuoteContent = Pick<SiteContent, "quoteWizard" | "packages" | "contact">;

const steps = ["İşletme", "Hedef", "Bütçe", "Öneri", "İletişim"];

const businessCards = [
  { id: "bakery", label: "Butik Pasta", emoji: "🎂", hint: "Sipariş, özel gün ve yerel talep" },
  { id: "cafe", label: "Kafe", emoji: "☕", hint: "Konum, ziyaret ve sosyal görünürlük" },
  { id: "restaurant", label: "Restoran", emoji: "🍽️", hint: "Rezervasyon, paket servis ve bilinirlik" },
  { id: "health", label: "Sağlık", emoji: "🏥", hint: "Güven, randevu ve bilgilendirme" },
  { id: "real-estate", label: "Emlak", emoji: "🏠", hint: "Portföy, talep ve düzenli takip sistemi" },
  { id: "education", label: "Eğitim", emoji: "🎓", hint: "Başvuru, kayıt ve marka algısı" },
  { id: "ecommerce", label: "E-Ticaret", emoji: "🛒", hint: "Satış hunisi ve yeniden pazarlama" },
  { id: "other", label: "Diğer", emoji: "➕", hint: "İhtiyaca göre özel analiz" }
];

const goalCards = [
  { id: "sales", label: "Daha Fazla Satış", emoji: "📈", hint: "Satın alma niyetini artıran kampanya kurgusu" },
  { id: "lead", label: "Daha Fazla Mesaj", emoji: "💬", hint: "Form, WhatsApp, doğrudan mesaj ve arama odaklı talep akışı" },
  { id: "awareness", label: "Marka Bilinirliği", emoji: "🌍", hint: "Daha geniş kitleye güven veren görünürlük" },
  { id: "remarketing", label: "Büyüme", emoji: "🚀", hint: "Müşteri yolculuğu ve yeniden pazarlama ile ölçekleme" }
];

const budgetCards = [
  { id: "under10", label: "3.000-5.000 TL", hint: "Kontrollü başlangıç ve ilk performans sinyalleri" },
  { id: "5to10", label: "5.000-10.000 TL", hint: "Yerel işletmeler için dengeli başlangıç" },
  { id: "10to30", label: "10.000-20.000 TL", hint: "Daha düzenli optimizasyon alanı" },
  { id: "30to75", label: "20.000+ TL", hint: "Çoklu kampanya ve büyüme alanı" }
];

function getPackageById(content: QuoteContent, id: string) {
  return content.packages.find((item) => item.id === id) ?? content.packages[0];
}

function selectedLabel(cards: { id: string; label: string }[], id?: string) {
  return cards.find((item) => item.id === id)?.label || id || "-";
}

export function QuoteWizard({ content }: { content: QuoteContent }) {
  const wizard = content.quoteWizard;
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [form, setForm] = useState<Answers>({});
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const recommendation = useMemo(() => {
    const rule =
      wizard.recommendationRules.find((item) => item.budget === answers.budget) ??
      wizard.recommendationRules.find((item) => item.goal === answers.goal) ??
      wizard.recommendationRules[1];
    return {
      recommended: getPackageById(content, rule.recommendedPackage),
      alternative: getPackageById(content, rule.alternativePackage)
    };
  }, [answers.budget, answers.goal, content, wizard.recommendationRules]);

  function select(key: string, value: string) {
    if (step === 0) trackEvent("quote_wizard_started");
    setAnswers((current) => ({ ...current, [key]: value }));
    trackEvent("quote_step_completed", { step: key, value });
    setStep((current) => Math.min(current + 1, 3));
  }

  function goBack() {
    setStep((current) => Math.max(current - 1, 0));
  }

  async function submit() {
    const missing = wizard.formFields.find((field) => field.required && !form[field.id]?.trim());
    if (missing) {
      setError(`${missing.label} alanı zorunludur.`);
      return;
    }
    setError("");
    setSent(true);
    trackEvent("quote_form_submitted", { package: recommendation.recommended.id });
    await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "quote",
        ...form,
        businessType: selectedLabel(businessCards, answers.businessType),
        goal: selectedLabel(goalCards, answers.goal),
        budget: selectedLabel(budgetCards, answers.budget),
        recommendedPackage: recommendation.recommended.name,
        alternativePackage: recommendation.alternative.name
      })
    });
  }

  const whatsappMessage = encodeURIComponent(
    `HK Dijital akıllı paket analizi\nPaket: ${recommendation.recommended.name}\nAlternatif: ${recommendation.alternative.name}\nİşletme türü: ${selectedLabel(businessCards, answers.businessType)}\nHedef: ${selectedLabel(goalCards, answers.goal)}\nBütçe: ${selectedLabel(budgetCards, answers.budget)}\nAd Soyad: ${form.name || "-"}\nFirma: ${form.company || "-"}\nE-posta: ${form.email || "-"}\nTelefon: ${form.phone || "-"}\nInstagram: ${form.instagram || "-"}\nWeb: ${form.website || "-"}\nNot: ${form.note || "-"}`
  );
  const whatsappUrl = `https://wa.me/${content.contact.whatsappNumber.replace(/\D/g, "")}?text=${whatsappMessage}`;
  const progress = ((step + 1) / steps.length) * 100;

  return (
    <section className="mx-auto max-w-6xl">
      <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.055] p-5 shadow-[0_30px_120px_rgba(0,0,0,.45)] backdrop-blur-2xl sm:p-8 lg:p-10">
        <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-8 size-72 rounded-full bg-yellow-300/10 blur-3xl" />

        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-3xl">
              <p className="inline-flex rounded-full border border-cyan-200/20 bg-cyan-200/10 px-4 py-2 text-xs font-black uppercase tracking-[.24em] text-cyan-100">
                HK Intelligence destekli akıllı analiz
              </p>
              <h1 className="mt-5 text-3xl font-black leading-tight text-white sm:text-5xl">{wizard.title}</h1>
              <p className="mt-4 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">{wizard.subtitle}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-right">
              <p className="text-sm text-slate-400">Aşama</p>
              <p className="mt-1 text-2xl font-black text-cyan-100">{step + 1} / {steps.length}</p>
            </div>
          </div>

          <div className="mt-8">
            <div className="flex flex-wrap gap-2">
              {steps.map((label, index) => (
                <div key={label} className={`rounded-full px-3 py-2 text-xs font-bold ${index <= step ? "bg-cyan-300 text-slate-950" : "bg-white/10 text-slate-400"}`}>
                  {label}
                </div>
              ))}
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
              <motion.div className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-blue-300 to-yellow-300" animate={{ width: `${progress}%` }} transition={{ duration: 0.35 }} />
            </div>
          </div>

          <div className="mt-10 min-h-[430px]">
            <AnimatePresence mode="wait">
              {step === 0 && <StepPanel key="business"><Options title="İşletme Türünüz" text="Sektörünüzü seçin; öneri sistemi strateji seviyesini buna göre yorumlar." options={businessCards} onSelect={(value) => select("businessType", value)} /></StepPanel>}
              {step === 1 && <StepPanel key="goal"><Options title="Ana Hedefiniz" text="Reklam çalışmasının ana odağını seçin. Her hedef farklı bir kampanya kurgusu gerektirir." options={goalCards} onSelect={(value) => select("goal", value)} /></StepPanel>}
              {step === 2 && <StepPanel key="budget"><Options title="Aylık Reklam Bütçesi" text="Reklam bütçesi hizmet bedeline dahil değildir; bu seçim öneri seviyesini netleştirir." options={budgetCards} onSelect={(value) => select("budget", value)} /></StepPanel>}
              {step === 3 && <StepPanel key="recommendation"><Recommendation recommended={recommendation.recommended} alternative={recommendation.alternative} whatsappUrl={whatsappUrl} onNext={() => setStep(4)} /></StepPanel>}
              {step === 4 && (
                <StepPanel key="contact">
                  <ContactStep wizard={wizard} form={form} setForm={setForm} error={error} sent={sent} submit={submit} whatsappUrl={whatsappUrl} back={() => setStep(3)} />
                </StepPanel>
              )}
            </AnimatePresence>
          </div>

          {step > 0 && step < 4 && (
            <button onClick={goBack} className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10">
              <ArrowLeft size={16} /> Geri
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function StepPanel({ children }: { children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 18, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12, scale: 0.985 }} transition={{ duration: 0.28, ease: "easeOut" }}>
      {children}
    </motion.div>
  );
}

function Options({ title, text, options, onSelect }: { title: string; text: string; options: { id: string; label: string; emoji?: string; hint?: string }[]; onSelect: (value: string) => void }) {
  return (
    <div>
      <div className="max-w-3xl">
        <h2 className="text-3xl font-black text-white sm:text-4xl">{title}</h2>
        <p className="mt-3 text-base leading-7 text-slate-300">{text}</p>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {options.map((option) => (
          <motion.button
            key={`${option.id}-${option.label}`}
            whileHover={{ y: -6, scale: 1.015 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(option.id)}
            className="group min-h-40 rounded-[22px] border border-white/10 bg-white/[0.055] p-5 text-left shadow-[0_18px_50px_rgba(0,0,0,.24)] transition hover:border-cyan-200/50 hover:bg-cyan-200/10"
          >
            <span className="grid size-14 place-items-center rounded-2xl border border-white/10 bg-black/25 text-3xl shadow-inner">{option.emoji || "✨"}</span>
            <span className="mt-5 block text-xl font-black text-white">{option.label}</span>
            <span className="mt-2 block text-sm leading-6 text-slate-400 group-hover:text-slate-200">{option.hint}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

function Recommendation({ recommended, alternative, whatsappUrl, onNext }: { recommended: PackageItem; alternative: PackageItem; whatsappUrl: string; onNext: () => void }) {
  return (
    <div>
      <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
        <div className="rounded-[26px] border border-cyan-200/30 bg-cyan-200/10 p-6 shadow-[0_24px_90px_rgba(18,217,255,.16)] sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="inline-flex items-center gap-2 rounded-full bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950"><Trophy size={18} /> Önerilen Paket</p>
            <Sparkles className="text-yellow-200" />
          </div>
          <h2 className="mt-6 text-4xl font-black text-white">{recommended.name}</h2>
          <p className="mt-3 text-3xl font-black text-cyan-100">{recommended.price}</p>
          <p className="mt-4 text-base leading-8 text-slate-200">{recommended.description}</p>
          <ul className="mt-6 grid gap-3">
            {recommended.features.slice(0, 6).map((feature) => (
              <li key={feature} className="flex gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-slate-200">
                <CheckCircle2 className="mt-0.5 shrink-0 text-cyan-200" size={18} /> {feature}
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-4">
          <InsightCard icon={<Target />} title="Tavsiye Edilen Reklam Bütçesi" text="Başlangıç testleri için kontrollü bütçe, performans sinyali geldikçe kademeli optimizasyon önerilir." />
          <InsightCard icon={<Sparkles />} title="Tavsiye Edilen Strateji" text="Önce ölçümleme ve teklif netliği, ardından Meta ve Google kampanya kurulumu, yeniden pazarlama ve düzenli müşteri takibi." />
          <InsightCard icon={<CalendarDays />} title="İlk 30 Gün Planı" text="Analiz, kurulum, reklam görseli denemeleri, hedef kitle iyileştirme, haftalık optimizasyon ve anlaşılır performans raporu." />
        </div>
      </div>

      <div className="mt-6 rounded-[22px] border border-white/10 bg-white/[0.045] p-5">
        <p className="text-sm font-bold text-slate-400">Alternatif Paket</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-2xl font-black text-white">{alternative.name}</h3>
            <p className="mt-1 text-cyan-100">{alternative.price}</p>
          </div>
          <p className="max-w-xl text-sm leading-6 text-slate-300">Kapsam veya bütçe seviyesi değişirse alternatif paket birlikte değerlendirilebilir.</p>
        </div>
      </div>

      <div className="mt-6 rounded-[22px] border border-yellow-200/20 bg-yellow-200/10 p-5 text-sm leading-7 text-yellow-50">
        Fiyatlara KDV dahil değildir. Reklam bütçesi hizmet bedeline dahil değildir. Satış garantisi verilmez; strateji, kurulum, optimizasyon ve raporlama süreci yönetilir.
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <a href={whatsappUrl} onClick={() => trackEvent("whatsapp_clicked")} target="_blank" rel="noreferrer" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-[#25D366] px-7 text-base font-black text-white shadow-[0_0_44px_rgba(37,211,102,.32)] transition hover:-translate-y-0.5">
          <MessageCircle size={20} /> WhatsApp'tan Görüşelim
        </a>
        <button onClick={onNext} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-cyan-300 px-7 text-base font-black text-slate-950 shadow-[0_0_38px_rgba(18,217,255,.28)] transition hover:-translate-y-0.5">
          Bilgilerimi Bırakayım <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

function InsightCard({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/[0.055] p-5 shadow-[0_18px_50px_rgba(0,0,0,.22)]">
      <div className="grid size-12 place-items-center rounded-2xl bg-cyan-200/10 text-cyan-100">{icon}</div>
      <h3 className="mt-4 text-xl font-black text-white">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-slate-300">{text}</p>
    </div>
  );
}

function ContactStep({ wizard, form, setForm, error, sent, submit, whatsappUrl, back }: any) {
  return (
    <div>
      <h2 className="text-3xl font-black text-white sm:text-4xl">İletişim Bilgileriniz</h2>
      <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">Öneriyi netleştirmek ve işletmenize göre ilk değerlendirmeyi hazırlamak için birkaç bilgi yeterli.</p>
      <div className="mt-6 rounded-[22px] border border-cyan-200/20 bg-cyan-200/10 p-5 text-sm text-cyan-100">
        Form gönderimi satış garantisi anlamına gelmez; süreç karşılıklı değerlendirme ile ilerler.
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {wizard.formFields.map((field: any) => (
          <label key={field.id} className={`grid gap-2 text-sm font-semibold text-slate-200 ${field.type === "textarea" ? "md:col-span-2" : ""}`}>
            {field.label}{field.required ? " *" : ""}
            {field.type === "textarea" ? (
              <textarea rows={5} value={form[field.id] || ""} onChange={(event) => setForm((current: Answers) => ({ ...current, [field.id]: event.target.value }))} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white focus:ring-2 focus:ring-cyan-300" />
            ) : (
              <input type={field.type} value={form[field.id] || ""} onChange={(event) => setForm((current: Answers) => ({ ...current, [field.id]: event.target.value }))} className="min-h-14 rounded-2xl border border-white/10 bg-black/30 px-4 text-white focus:ring-2 focus:ring-cyan-300" />
            )}
          </label>
        ))}
      </div>
      {error && <p className="mt-5 rounded-2xl bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}
      {sent && (
        <div className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-5 text-sm text-emerald-100">
          {wizard.successMessage}
          <a href={whatsappUrl} onClick={() => trackEvent("whatsapp_clicked")} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-full bg-[#25D366] px-5 py-3 font-black text-white">
            WhatsApp'tan Görüşelim
          </a>
        </div>
      )}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button onClick={back} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full border border-white/15 px-6 text-sm font-bold text-white transition hover:bg-white/10"><ArrowLeft size={17} /> Geri</button>
        <button onClick={submit} className="inline-flex min-h-14 items-center justify-center rounded-full bg-cyan-300 px-7 text-sm font-black text-slate-950 shadow-[0_0_38px_rgba(18,217,255,.28)]">{wizard.ctaTexts.submit}</button>
      </div>
    </div>
  );
}
