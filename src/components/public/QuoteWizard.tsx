"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, MessageCircle, Sparkles, Target, Trophy } from "lucide-react";
import type { PackageItem, SiteContent } from "@/lib/types";
import { CONTENT_NEED_OPTIONS, SOCIAL_STATUS_OPTIONS, URGENCY_OPTIONS, formatBudgetRange, formatTRY, getPackagePricing, packageChoiceLabel, recommendServicePackage, type AdBudgetEstimate } from "@/lib/packages";
import { trackEvent } from "./TrackingPlaceholders";

type Answers = Record<string, string>;
type QuoteContent = Pick<SiteContent, "quoteWizard" | "packages" | "contact">;
type QuoteFormField = SiteContent["quoteWizard"]["formFields"][number];
type AiBudgetResearch = {
  source: "gemini" | "groq" | "openai" | "anthropic" | "manus" | "openrouter" | "ollama" | "demo" | "fallback";
  providerLabel?: string;
  fallbackUsed?: boolean;
  providerNotice?: string | null;
  marketSummary: string;
  recommendedBudget: {
    minimum: number;
    ideal: number;
    aggressive: number;
    dailyIdeal: number;
  };
  platformSplit: Array<{ label: string; percent: number; note: string }>;
  reasoningBullets: string[];
  first30DaysPlan: string[];
  risks: string[];
  extraServiceSuggestions: string[];
  disclaimer: string;
};
type AiBudgetResearchInput = {
  sector: string;
  marketLocation: string;
  goal: string;
  platformNeed: string;
  monthlyAdBudget: string;
  contentNeed: string;
  startTiming: string;
  socialStatus: string;
  selectedPackageSlug: string;
  selectedPackageName: string;
  packageBasePrice: number;
};
type ContactStepProps = {
  wizard: SiteContent["quoteWizard"];
  form: Answers;
  setForm: Dispatch<SetStateAction<Answers>>;
  error: string;
  sent: boolean;
  submit: () => void;
  whatsappUrl: string;
  back: () => void;
};

const steps = ["İşletme", "Hedef", "Platform", "Bütçe", "İhtiyaç", "Öneri", "İletişim"];

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
  { id: "5000", label: "5.000 TL altı", hint: "Kontrollü başlangıç ve ilk performans sinyalleri" },
  { id: "20000", label: "5.000-20.000 TL", hint: "Yerel işletmeler için dengeli başlangıç" },
  { id: "60000", label: "20.000-60.000 TL", hint: "Daha düzenli optimizasyon alanı" },
  { id: "90000", label: "60.000 TL üzeri", hint: "Çoklu kampanya ve büyüme alanı" }
];

const platformCards = [
  { id: "Meta", label: "Meta", emoji: "📣", hint: "Instagram ve Facebook reklamları" },
  { id: "Google", label: "Google", emoji: "🔎", hint: "Google Ads ve arama niyeti" },
  { id: "Sosyal Medya", label: "Sosyal Medya", emoji: "✨", hint: "İçerik takvimi ve marka görünürlüğü" },
  { id: "Hepsi", label: "Hepsi", emoji: "⚡", hint: "Meta + Google + içerik yaklaşımı" }
];

function getPackageById(content: QuoteContent, id: string) {
  return content.packages.find((item) => item.id === id) ?? content.packages[0];
}

function selectedLabel(cards: { id: string; label: string }[], id?: string) {
  return cards.find((item) => item.id === id)?.label || id || "-";
}

export function QuoteWizard({ content }: { content: QuoteContent }) {
  const wizard = content.quoteWizard;
  const searchParams = useSearchParams();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({ selectedPackage: searchParams.get("paket") || "" });
  const [form, setForm] = useState<Answers>({});
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const recommendation = useMemo(() => {
    const selected = answers.selectedPackage ? getPackageById(content, answers.selectedPackage) : null;
    const smart = recommendServicePackage({
      sector: selectedLabel(businessCards, answers.businessType),
      goal: selectedLabel(goalCards, answers.goal),
      platform: selectedLabel(platformCards, answers.platform),
      budget: answers.budget,
      contentNeed: answers.contentNeed,
      urgency: answers.urgency,
      socialStatus: answers.socialStatus
    });
    return {
      recommended: selected || getPackageById(content, smart.recommended.slug),
      alternative: getPackageById(content, smart.alternative.slug),
      reason: smart.reason,
      startingStrategy: smart.startingStrategy,
      roadmap: smart.roadmap,
      adBudget: smart.adBudget
    };
  }, [answers, content]);
  const budgetResearchInput = useMemo<AiBudgetResearchInput>(() => {
    const pricing = getPackagePricing(recommendation.recommended.id);
    return {
      sector: selectedLabel(businessCards, answers.businessType),
      marketLocation: "Türkiye",
      goal: selectedLabel(goalCards, answers.goal),
      platformNeed: selectedLabel(platformCards, answers.platform),
      monthlyAdBudget: selectedLabel(budgetCards, answers.budget),
      contentNeed: packageChoiceLabel("content", answers.contentNeed),
      startTiming: packageChoiceLabel("urgency", answers.urgency),
      socialStatus: packageChoiceLabel("social", answers.socialStatus),
      selectedPackageSlug: recommendation.recommended.id,
      selectedPackageName: recommendation.recommended.name,
      packageBasePrice: pricing?.basePrice || 0
    };
  }, [answers, recommendation.recommended]);

  function select(key: string, value: string) {
    if (step === 0) trackEvent("quote_wizard_started");
    setAnswers((current) => ({ ...current, [key]: value }));
    trackEvent("quote_step_completed", { step: key, value });
    setStep((current) => Math.min(current + 1, 5));
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
    const response = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "quote",
        ...form,
        businessType: selectedLabel(businessCards, answers.businessType),
        goal: selectedLabel(goalCards, answers.goal),
        platformNeed: selectedLabel(platformCards, answers.platform),
        budget: selectedLabel(budgetCards, answers.budget),
        contentNeed: packageChoiceLabel("content", answers.contentNeed),
        urgency: packageChoiceLabel("urgency", answers.urgency),
        socialStatus: packageChoiceLabel("social", answers.socialStatus),
        recommendedPackage: recommendation.recommended.name,
        alternativePackage: recommendation.alternative.name
      })
    });
    if (!response.ok) {
      setError("Form gönderilemedi. Lütfen bilgileri kontrol edip tekrar deneyin.");
      return;
    }
    setSent(true);
    trackEvent("quote_form_submitted", { package: recommendation.recommended.id, form_name: "Paket Öneri Robotu" });
  }

  const whatsappMessage = encodeURIComponent(
    `HK Dijital akıllı paket analizi\nPaket: ${recommendation.recommended.name}\nAlternatif: ${recommendation.alternative.name}\nİşletme türü: ${selectedLabel(businessCards, answers.businessType)}\nHedef: ${selectedLabel(goalCards, answers.goal)}\nPlatform: ${selectedLabel(platformCards, answers.platform)}\nBütçe: ${selectedLabel(budgetCards, answers.budget)}\nİçerik ihtiyacı: ${packageChoiceLabel("content", answers.contentNeed)}\nAciliyet: ${packageChoiceLabel("urgency", answers.urgency)}\nSosyal medya durumu: ${packageChoiceLabel("social", answers.socialStatus)}\nAd Soyad: ${form.name || "-"}\nFirma: ${form.company || "-"}\nE-posta: ${form.email || "-"}\nTelefon: ${form.phone || "-"}\nInstagram: ${form.instagram || "-"}\nWeb: ${form.website || "-"}\nNot: ${form.note || "-"}`
  );
  const whatsappUrl = `https://wa.me/${content.contact.whatsappNumber.replace(/\D/g, "")}?text=${whatsappMessage}`;
  const progress = ((step + 1) / steps.length) * 100;

  return (
    <section className="mx-auto max-w-6xl">
      <div className="glass-card relative overflow-hidden p-5 sm:p-8 lg:p-10">
        <div className="premium-grid pointer-events-none absolute inset-0 opacity-40" />

        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-3xl">
              <p className="inline-flex rounded-full border border-cyan-200/20 bg-cyan-200/10 px-4 py-2 text-xs font-black uppercase tracking-[.24em] text-cyan-100">
                Akıllı paket analizi
              </p>
              <h2 className="mt-5 text-3xl font-black leading-tight text-white sm:text-5xl">{wizard.title}</h2>
              <p className="mt-4 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">{wizard.subtitle}</p>
            </div>
            <div className="rounded-[8px] border border-white/10 bg-black/25 p-4 text-right">
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
              {step === 2 && <StepPanel key="platform"><Options title="Platform İhtiyacınız" text="Meta, Google, sosyal medya veya hepsini kapsayan yapıyı seçin." options={platformCards} onSelect={(value) => select("platform", value)} /></StepPanel>}
              {step === 3 && <StepPanel key="budget"><Options title="Aylık Reklam Bütçesi" text="Reklam bütçesi hizmet bedeline dahil değildir; bu seçim öneri seviyesini netleştirir." options={budgetCards} onSelect={(value) => select("budget", value)} /></StepPanel>}
              {step === 4 && <StepPanel key="needs"><NeedsStep answers={answers} setAnswers={setAnswers} onNext={() => setStep(5)} /></StepPanel>}
              {step === 5 && <StepPanel key="recommendation"><Recommendation recommended={recommendation.recommended} alternative={recommendation.alternative} reason={recommendation.reason} startingStrategy={recommendation.startingStrategy} roadmap={recommendation.roadmap} adBudget={recommendation.adBudget} budgetResearchInput={budgetResearchInput} whatsappUrl={whatsappUrl} onNext={() => setStep(6)} /></StepPanel>}
              {step === 6 && (
                <StepPanel key="contact">
                  <ContactStep wizard={wizard} form={form} setForm={setForm} error={error} sent={sent} submit={submit} whatsappUrl={whatsappUrl} back={() => setStep(5)} />
                </StepPanel>
              )}
            </AnimatePresence>
          </div>

          {step > 0 && step < 6 && (
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
            className="group min-h-40 rounded-[8px] border border-white/10 bg-white/[0.055] p-5 text-left shadow-[0_18px_50px_rgba(0,0,0,.24)] transition hover:border-cyan-200/50 hover:bg-cyan-200/10"
          >
            <span className="grid size-14 place-items-center rounded-[8px] border border-white/10 bg-black/25 text-3xl shadow-inner">{option.emoji || "✨"}</span>
            <span className="mt-5 block text-xl font-black text-white">{option.label}</span>
            <span className="mt-2 block text-sm leading-6 text-slate-400 group-hover:text-slate-200">{option.hint}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

function NeedsStep({ answers, setAnswers, onNext }: { answers: Answers; setAnswers: Dispatch<SetStateAction<Answers>>; onNext: () => void }) {
  const groups = [
    { key: "contentNeed", title: "İçerik üretim ihtiyacı", options: CONTENT_NEED_OPTIONS },
    { key: "urgency", title: "Başlangıç zamanlaması", options: URGENCY_OPTIONS },
    { key: "socialStatus", title: "Mevcut sosyal medya durumu", options: SOCIAL_STATUS_OPTIONS }
  ];
  return (
    <div>
      <div className="max-w-3xl">
        <h2 className="text-3xl font-black text-white sm:text-4xl">Operasyon İhtiyacınız</h2>
        <p className="mt-3 text-base leading-7 text-slate-300">Paket önerisini içerik üretimi, aciliyet ve mevcut sosyal medya durumuna göre netleştirin.</p>
      </div>
      <div className="mt-8 grid gap-5">
        {groups.map((group) => (
          <div key={group.key} className="rounded-[22px] border border-white/10 bg-white/[0.045] p-5">
            <p className="text-sm font-black text-cyan-100">{group.title}</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {group.options.map((option) => {
                const selected = answers[group.key] === option.value;
                return (
                <button
                  key={option.value}
                  type="button"
                  aria-label={`${group.title}: ${option.label}`}
                  onClick={() => setAnswers((current) => ({ ...current, [group.key]: option.value }))}
                  className={`rounded-[18px] border p-4 text-left transition hover:-translate-y-0.5 ${selected ? "border-cyan-200 bg-cyan-300 text-slate-950 shadow-[0_0_34px_rgba(18,217,255,.2)]" : "border-white/10 bg-black/20 text-slate-200 hover:border-cyan-200/40 hover:bg-cyan-200/10"}`}
                >
                  <span className="block text-sm font-black">{option.label}</span>
                  <span className={`mt-1 block text-xs leading-5 ${selected ? "text-slate-800" : "text-slate-400"}`}>{option.description}</span>
                </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <button onClick={onNext} className="mt-8 inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-cyan-300 px-7 text-base font-black text-slate-950 shadow-[0_0_38px_rgba(18,217,255,.28)] transition hover:-translate-y-0.5">
        Paketi Öner <ArrowRight size={18} />
      </button>
    </div>
  );
}

function Recommendation({ recommended, alternative, reason, startingStrategy, roadmap, adBudget, budgetResearchInput, whatsappUrl, onNext }: { recommended: PackageItem; alternative: PackageItem; reason?: string; startingStrategy?: string; roadmap?: string[]; adBudget: AdBudgetEstimate; budgetResearchInput: AiBudgetResearchInput; whatsappUrl: string; onNext: () => void }) {
  const pricing = getPackagePricing(recommended.id);
  const [aiBudget, setAiBudget] = useState<AiBudgetResearch | null>(null);
  const [aiBudgetLoading, setAiBudgetLoading] = useState(false);
  const [aiBudgetError, setAiBudgetError] = useState("");
  async function createAiBudgetResearch() {
    if (aiBudget) return;
    setAiBudgetLoading(true);
    setAiBudgetError("");
    try {
      const response = await fetch("/api/ai/ad-budget-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(budgetResearchInput)
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) throw new Error("AI bütçe analizi oluşturulamadı.");
      setAiBudget(data);
      trackEvent("ai_budget_research_created", { source: data.source, package: recommended.id });
    } catch {
      setAiBudgetError("AI bütçe analizi şu anda oluşturulamadı. HK Dijital analiz modeliyle hesaplanan öneriyi kullanabilirsiniz.");
    } finally {
      setAiBudgetLoading(false);
    }
  }
  return (
    <div>
      <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
        <div className="rounded-[26px] border border-cyan-200/30 bg-cyan-200/10 p-6 shadow-[0_24px_90px_rgba(18,217,255,.16)] sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="inline-flex items-center gap-2 rounded-full bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950"><Trophy size={18} /> Önerilen Paket</p>
            <Sparkles className="text-yellow-200" />
          </div>
          <h2 className="mt-6 text-4xl font-black text-white">{recommended.name}</h2>
          <div className="mt-4 rounded-[20px] border border-cyan-200/25 bg-black/20 p-4">
            <p className="text-sm font-bold text-cyan-100">Aylık hizmet bedeli</p>
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <p className="text-4xl font-black text-white">{pricing ? formatTRY(pricing.basePrice) : recommended.price}</p>
              {pricing && <span className="mb-1 rounded-full bg-yellow-300 px-3 py-1 text-xs font-black text-slate-950">+ KDV</span>}
            </div>
            {pricing && <div className="mt-3 grid gap-2 text-sm text-slate-200 sm:grid-cols-2">
              <span>KDV: <b>{pricing.vatDisplay}</b></span>
              <span>KDV dahil: <b>{pricing.totalDisplay}</b></span>
            </div>}
          </div>
          <p className="mt-4 text-base leading-8 text-slate-200">{recommended.description}</p>
          {reason && <p className="mt-4 rounded-2xl border border-cyan-200/20 bg-black/20 p-4 text-sm leading-7 text-cyan-50">{reason}</p>}
          <ul className="mt-6 grid gap-3">
            {recommended.features.slice(0, 6).map((feature) => (
              <li key={feature} className="flex gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-slate-200">
                <CheckCircle2 className="mt-0.5 shrink-0 text-cyan-200" size={18} /> {feature}
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-4">
          <InsightCard icon={<Target />} title="AI Destekli Reklam Bütçesi Önerisi" text={`Minimum ${formatBudgetRange(...adBudget.minimumRange)}, ideal ${formatBudgetRange(...adBudget.idealRange)}. Günlük ortalama ideal aralık ${formatTRY(adBudget.dailyAverageRange[0])} - ${formatTRY(adBudget.dailyAverageRange[1])}.`} />
          <InsightCard icon={<Sparkles />} title="Tavsiye Edilen Strateji" text={startingStrategy || "Önce ölçümleme ve teklif netliği, ardından kampanya kurulumu, test ve düzenli müşteri takibi."} />
          <InsightCard icon={<CalendarDays />} title="Kurulum Yol Haritası" text={(roadmap || ["Analiz", "Kurulum", "Optimizasyon ve raporlama"]).join(" · ")} />
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_.8fr]">
        <div className="rounded-[22px] border border-cyan-200/20 bg-cyan-200/10 p-5">
          <p className="text-xs font-black uppercase tracking-[.18em] text-cyan-100">Akıllı Reklam Bütçesi Önerisi</p>
          <p className="mt-3 text-sm leading-7 text-slate-200">Bu öneri sektör, hedef, platform ve başlangıç seviyesine göre oluşturulan tahmini medya bütçesidir. Kesin sonuç garantisi vermez; test ve optimizasyonla netleşir.</p>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <BudgetBox label="Minimum" value={formatBudgetRange(...adBudget.minimumRange)} />
            <BudgetBox label="İdeal" value={formatBudgetRange(...adBudget.idealRange)} highlight />
            <BudgetBox label="Agresif büyüme" value={formatBudgetRange(...adBudget.aggressiveRange)} />
          </div>
          <p className="mt-4 rounded-[16px] border border-white/10 bg-black/20 p-4 text-sm leading-7 text-cyan-50">{adBudget.reason} {adBudget.budgetFit}</p>
          <div className="mt-5 flex flex-col gap-3 rounded-[18px] border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-white">Piyasa Yorumu</p>
              <p className="mt-1 text-xs leading-5 text-slate-300">İşletme bilgilerinize göre kısa bir reklam bütçesi ve kanal yorumu hazırlanır. Sonuç garantisi vermez; ön değerlendirme niteliğindedir.</p>
            </div>
            <button type="button" onClick={createAiBudgetResearch} disabled={aiBudgetLoading || Boolean(aiBudget)} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-yellow-300 px-5 text-sm font-black text-slate-950 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60">
              {aiBudgetLoading ? "Analiz oluşturuluyor..." : aiBudget ? "Analiz hazır" : "Bütçe Analizi Oluştur"}
            </button>
          </div>
          {aiBudgetError && <p className="mt-3 rounded-[14px] border border-red-200/30 bg-red-500/10 p-3 text-sm text-red-100">{aiBudgetError}</p>}
        </div>
        <div className="rounded-[22px] border border-white/10 bg-white/[0.045] p-5">
          <p className="text-sm font-black text-white">Platform bütçe dağılımı</p>
          <div className="mt-4 grid gap-3">
            {adBudget.platformSplit.map((item) => (
              <div key={item.label}>
                <div className="mb-1 flex justify-between text-xs font-bold text-slate-300"><span>{item.label}</span><span>%{item.percent}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-yellow-300" style={{ width: `${item.percent}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {aiBudget && (
        <div className="mt-6 rounded-[24px] border border-yellow-200/25 bg-yellow-200/10 p-5 shadow-[0_20px_80px_rgba(250,204,21,.12)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[.18em] text-yellow-100">{aiBudget.source !== "fallback" && aiBudget.source !== "demo" ? "AI Destekli Piyasa Yorumu" : "HK Dijital analiz modeli"}</p>
              <h3 className="mt-2 text-2xl font-black text-white">Piyasa ve medya bütçesi değerlendirmesi</h3>
            </div>
            <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-black text-slate-950">{aiBudget.providerLabel || (aiBudget.source === "fallback" ? "Yerel yedek" : "Otomatik AI")}</span>
          </div>
          <p className="mt-4 text-sm leading-7 text-yellow-50">{aiBudget.marketSummary}</p>
          {aiBudget.providerNotice && <p className="mt-3 rounded-[14px] border border-yellow-100/20 bg-black/20 p-3 text-xs leading-5 text-yellow-50">{aiBudget.providerNotice}</p>}
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <BudgetBox label="Minimum" value={formatTRY(aiBudget.recommendedBudget.minimum)} />
            <BudgetBox label="İdeal" value={formatTRY(aiBudget.recommendedBudget.ideal)} highlight />
            <BudgetBox label="Agresif" value={formatTRY(aiBudget.recommendedBudget.aggressive)} />
            <BudgetBox label="Günlük ideal" value={formatTRY(aiBudget.recommendedBudget.dailyIdeal)} />
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <PlanList title="Neden bu bütçe?" items={aiBudget.reasoningBullets} />
            <PlanList title="Riskler ve dikkat noktaları" items={aiBudget.risks} />
          </div>
          <div className="mt-5 rounded-[18px] border border-white/10 bg-black/20 p-4">
            <p className="text-sm font-black text-white">AI platform dağılımı</p>
            <div className="mt-4 grid gap-3">
              {aiBudget.platformSplit.map((item) => (
                <div key={`${item.label}-${item.percent}`} className="rounded-[14px] border border-white/10 bg-white/[0.045] p-3">
                  <div className="mb-2 flex justify-between text-xs font-bold text-slate-200"><span>{item.label}</span><span>%{item.percent}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-yellow-300" style={{ width: `${item.percent}%` }} /></div>
                  <p className="mt-2 text-xs leading-5 text-slate-300">{item.note}</p>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-4 text-xs leading-6 text-yellow-100">{aiBudget.disclaimer}</p>
        </div>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <PlanList title="İlk 30 Günlük Aksiyon Planı" items={adBudget.first30DaysPlan} />
        <PlanList title="Dikkat Edilmesi Gerekenler" items={adBudget.notes.slice(1)} />
        <PlanList title="Ek Hizmet Önerileri" items={adBudget.extraServices.length ? adBudget.extraServices : ["Performans raporlama düzeni", "Kreatif test planı", "Dönüşüm ölçüm kontrolü"]} />
      </div>

      <div className="mt-6 rounded-[22px] border border-yellow-200/20 bg-yellow-200/10 p-5 text-sm leading-7 text-yellow-50">
        <b>HK Dijital yorumu:</b> Bu yapı hızlı satış vaadi yerine kontrollü test, veri toplama ve optimizasyon üzerine kurulmalıdır. Hizmet bedeline reklam harcamaları dahil değildir.
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
          <MessageCircle size={20} /> WhatsApp&apos;tan Görüşelim
        </a>
        <button onClick={onNext} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-cyan-300 px-7 text-base font-black text-slate-950 shadow-[0_0_38px_rgba(18,217,255,.28)] transition hover:-translate-y-0.5">
          Bilgilerimi Bırakayım <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

function BudgetBox({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-[16px] border p-4 ${highlight ? "border-yellow-200/40 bg-yellow-300/15" : "border-white/10 bg-black/20"}`}>
      <p className="text-xs font-black uppercase tracking-[.14em] text-slate-300">{label}</p>
      <p className="mt-2 text-lg font-black text-white">{value}</p>
    </div>
  );
}

function PlanList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/[0.045] p-5">
      <p className="text-sm font-black text-white">{title}</p>
      <div className="mt-4 grid gap-2">
        {items.map((item) => <p key={item} className="rounded-[12px] bg-black/20 p-3 text-sm leading-6 text-slate-300">{item}</p>)}
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

function ContactStep({ wizard, form, setForm, error, sent, submit, whatsappUrl, back }: ContactStepProps) {
  return (
    <div>
      <h2 className="text-3xl font-black text-white sm:text-4xl">İletişim Bilgileriniz</h2>
      <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">Öneriyi netleştirmek ve işletmenize göre ilk değerlendirmeyi hazırlamak için birkaç bilgi yeterli.</p>
      <div className="mt-6 rounded-[22px] border border-cyan-200/20 bg-cyan-200/10 p-5 text-sm text-cyan-100">
        Form gönderimi satış garantisi anlamına gelmez; süreç karşılıklı değerlendirme ile ilerler.
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {wizard.formFields.map((field: QuoteFormField) => (
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
            WhatsApp&apos;tan Görüşelim
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
