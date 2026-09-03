"use client";

import { useMemo, useState, type Dispatch, type KeyboardEvent, type SetStateAction } from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, MessageCircle, Sparkles, Target, Trophy } from "lucide-react";
import type { PackageItem, SiteContent } from "@/lib/types";
import { CONTENT_NEED_OPTIONS, SOCIAL_STATUS_OPTIONS, URGENCY_OPTIONS, formatBudgetRange, formatTRY, getPackagePricing, packageChoiceLabel, recommendServicePackage, type AdBudgetEstimate } from "@/lib/packages";
import { businessCards, isValidCustomCategory, normalizeCustomCategory, OTHER_BUSINESS_TYPE_ID, MAX_BUSINESS_CATEGORY_LENGTH, resolveBusinessCategory } from "@/lib/business-category";
import { PLATFORM_OPTIONS, isAllPlatformsSelected, platformSelectionLabel, toggleAllPlatforms, togglePlatform, type PlatformKey } from "@/lib/platform-selection";
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
  platforms: PlatformKey[];
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
  const [customBusinessType, setCustomBusinessType] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformKey[]>([]);
  const [platformError, setPlatformError] = useState("");
  const [form, setForm] = useState<Answers>({});
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const resolvedBusinessCategory = resolveBusinessCategory(answers.businessType, customBusinessType);
  const resolvedPlatformLabel = platformSelectionLabel(selectedPlatforms);

  const recommendation = useMemo(() => {
    const selected = answers.selectedPackage ? getPackageById(content, answers.selectedPackage) : null;
    const smart = recommendServicePackage({
      sector: resolvedBusinessCategory,
      goal: selectedLabel(goalCards, answers.goal),
      platform: selectedPlatforms,
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
  }, [answers, content, resolvedBusinessCategory, selectedPlatforms]);
  const budgetResearchInput = useMemo<AiBudgetResearchInput>(() => {
    const pricing = getPackagePricing(recommendation.recommended.id);
    return {
      sector: resolvedBusinessCategory,
      marketLocation: "Türkiye",
      goal: selectedLabel(goalCards, answers.goal),
      platforms: selectedPlatforms,
      platformNeed: resolvedPlatformLabel,
      monthlyAdBudget: selectedLabel(budgetCards, answers.budget),
      contentNeed: packageChoiceLabel("content", answers.contentNeed),
      startTiming: packageChoiceLabel("urgency", answers.urgency),
      socialStatus: packageChoiceLabel("social", answers.socialStatus),
      selectedPackageSlug: recommendation.recommended.id,
      selectedPackageName: recommendation.recommended.name,
      packageBasePrice: pricing?.basePrice || 0
    };
  }, [answers, recommendation.recommended, resolvedBusinessCategory, resolvedPlatformLabel, selectedPlatforms]);

  function select(key: string, value: string) {
    if (step === 0) trackEvent("quote_wizard_started");
    setAnswers((current) => ({ ...current, [key]: value }));
    trackEvent("quote_step_completed", { step: key, value });
    if (key === "businessType") {
      if (value === OTHER_BUSINESS_TYPE_ID) return; // stay on this step until a valid custom sector is entered
      setCustomBusinessType("");
    }
    setStep((current) => Math.min(current + 1, 5));
  }

  function confirmCustomBusinessType() {
    if (!isValidCustomCategory(customBusinessType)) return;
    trackEvent("quote_step_completed", { step: "businessType", value: normalizeCustomCategory(customBusinessType) });
    setStep((current) => Math.min(current + 1, 5));
  }

  function togglePlatformSelection(key: PlatformKey) {
    setPlatformError("");
    setSelectedPlatforms((current) => togglePlatform(current, key));
  }

  function toggleAllPlatformsSelection() {
    setPlatformError("");
    setSelectedPlatforms((current) => toggleAllPlatforms(current));
  }

  function confirmPlatforms() {
    if (!selectedPlatforms.length) {
      setPlatformError("Devam etmek için en az bir platform seçin.");
      return;
    }
    setPlatformError("");
    trackEvent("quote_step_completed", { step: "platform", value: selectedPlatforms.join(",") });
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
        businessType: resolvedBusinessCategory,
        goal: selectedLabel(goalCards, answers.goal),
        platforms: selectedPlatforms,
        platformNeed: resolvedPlatformLabel,
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
    `HK Dijital akıllı paket analizi\nPaket: ${recommendation.recommended.name}\nAlternatif: ${recommendation.alternative.name}\nİşletme türü: ${resolvedBusinessCategory}\nHedef: ${selectedLabel(goalCards, answers.goal)}\nPlatform: ${resolvedPlatformLabel}\nBütçe: ${selectedLabel(budgetCards, answers.budget)}\nİçerik ihtiyacı: ${packageChoiceLabel("content", answers.contentNeed)}\nAciliyet: ${packageChoiceLabel("urgency", answers.urgency)}\nSosyal medya durumu: ${packageChoiceLabel("social", answers.socialStatus)}\nAd Soyad: ${form.name || "-"}\nFirma: ${form.company || "-"}\nE-posta: ${form.email || "-"}\nTelefon: ${form.phone || "-"}\nInstagram: ${form.instagram || "-"}\nWeb: ${form.website || "-"}\nNot: ${form.note || "-"}`
  );
  const whatsappUrl = `https://wa.me/${content.contact.whatsappNumber.replace(/\D/g, "")}?text=${whatsappMessage}`;
  const progress = ((step + 1) / steps.length) * 100;

  return (
    <section className="marketing-shell mx-auto max-w-6xl">
      <div className="marketing-card relative overflow-hidden p-5 sm:p-8 lg:p-10">
        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-3xl">
              <p className="marketing-eyebrow">Akıllı paket analizi</p>
              <h2 className="mt-5 text-3xl font-black leading-tight sm:text-5xl" style={{ color: "var(--mk-ink)" }}>{wizard.title}</h2>
              <p className="mt-4 max-w-2xl text-base leading-8 sm:text-lg" style={{ color: "var(--mk-ink-soft)" }}>{wizard.subtitle}</p>
            </div>
            <div className="rounded-xl border p-4 text-right" style={{ borderColor: "var(--mk-border)", background: "var(--mk-bg-alt)" }}>
              <p className="text-sm" style={{ color: "var(--mk-ink-faint)" }}>Aşama</p>
              <p className="mt-1 text-2xl font-black" style={{ color: "var(--mk-violet)" }}>{step + 1} / {steps.length}</p>
            </div>
          </div>

          <div className="mt-8">
            <div className="flex flex-wrap gap-2">
              {steps.map((label, index) => (
                <div key={label} className="rounded-full px-3 py-2 text-xs font-bold" style={{ background: index <= step ? "var(--mk-violet)" : "var(--mk-bg-alt)", color: index <= step ? "#fff" : "var(--mk-ink-faint)" }}>
                  {label}
                </div>
              ))}
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full" style={{ background: "var(--mk-bg-alt)" }}>
              <motion.div className="h-full rounded-full" style={{ background: "linear-gradient(90deg, var(--mk-violet), var(--mk-blue), var(--mk-pink))" }} animate={{ width: `${progress}%` }} transition={{ duration: 0.35 }} />
            </div>
          </div>

          <div className="mt-10 min-h-[430px]">
            <AnimatePresence mode="wait">
              {step === 0 && (
                <StepPanel key="business">
                  <Options title="İşletme Türünüz" text="Sektörünüzü seçin; öneri sistemi strateji seviyesini buna göre yorumlar." options={businessCards} selectedId={answers.businessType} onSelect={(value) => select("businessType", value)} />
                  {answers.businessType === OTHER_BUSINESS_TYPE_ID && (
                    <CustomBusinessTypeField value={customBusinessType} onChange={setCustomBusinessType} onContinue={confirmCustomBusinessType} />
                  )}
                </StepPanel>
              )}
              {step === 1 && <StepPanel key="goal"><Options title="Ana Hedefiniz" text="Reklam çalışmasının ana odağını seçin. Her hedef farklı bir kampanya kurgusu gerektirir." options={goalCards} onSelect={(value) => select("goal", value)} /></StepPanel>}
              {step === 2 && (
                <StepPanel key="platform">
                  <PlatformMultiSelect
                    selected={selectedPlatforms}
                    onTogglePlatform={togglePlatformSelection}
                    onToggleAll={toggleAllPlatformsSelection}
                    onContinue={confirmPlatforms}
                    error={platformError}
                  />
                </StepPanel>
              )}
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
            <button onClick={goBack} className="marketing-btn marketing-btn-secondary mt-4">
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

function Options({ title, text, options, onSelect, selectedId }: { title: string; text: string; options: { id: string; label: string; emoji?: string; hint?: string }[]; onSelect: (value: string) => void; selectedId?: string }) {
  return (
    <div>
      <div className="max-w-3xl">
        <h2 className="text-3xl font-black sm:text-4xl" style={{ color: "var(--mk-ink)" }}>{title}</h2>
        <p className="mt-3 text-base leading-7" style={{ color: "var(--mk-ink-soft)" }}>{text}</p>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {options.map((option) => {
          const isSelected = selectedId === option.id;
          return (
            <motion.button
              key={`${option.id}-${option.label}`}
              whileHover={{ y: -6, scale: 1.015 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelect(option.id)}
              aria-pressed={isSelected}
              className="group min-h-40 rounded-2xl border p-5 text-left shadow-[0_10px_30px_rgba(15,16,36,.06)] transition"
              style={{ borderColor: isSelected ? "var(--mk-violet)" : "var(--mk-border)", background: isSelected ? "rgba(124,58,237,.06)" : "var(--mk-surface)" }}
            >
              <span className="grid size-14 place-items-center rounded-xl text-3xl" style={{ background: "var(--mk-bg-alt)" }}>{option.emoji || "✨"}</span>
              <span className="mt-5 block text-xl font-black" style={{ color: "var(--mk-ink)" }}>{option.label}</span>
              <span className="mt-2 block text-sm leading-6" style={{ color: "var(--mk-ink-soft)" }}>{option.hint}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function PlatformMultiSelect({ selected, onTogglePlatform, onToggleAll, onContinue, error }: { selected: PlatformKey[]; onTogglePlatform: (key: PlatformKey) => void; onToggleAll: () => void; onContinue: () => void; error: string }) {
  const allSelected = isAllPlatformsSelected(selected);
  const canContinue = selected.length > 0;
  return (
    <div>
      <div className="max-w-3xl">
        <h2 className="text-3xl font-black sm:text-4xl" style={{ color: "var(--mk-ink)" }}>Platform İhtiyacınız</h2>
        <p className="mt-3 text-base leading-7" style={{ color: "var(--mk-ink-soft)" }}>Meta, Google ve sosyal medyadan birini, birkaçını veya hepsini birlikte seçebilirsiniz. En az bir platform seçmelisiniz.</p>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLATFORM_OPTIONS.map((option) => {
          const isSelected = selected.includes(option.id);
          return (
            <motion.button
              key={option.id}
              type="button"
              data-testid={`platform-card-${option.id}`}
              whileHover={{ y: -6, scale: 1.015 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onTogglePlatform(option.id)}
              aria-pressed={isSelected}
              className="group relative min-h-40 rounded-2xl border p-5 text-left shadow-[0_10px_30px_rgba(15,16,36,.06)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c3aed]"
              style={{ borderColor: isSelected ? "var(--mk-violet)" : "var(--mk-border)", background: isSelected ? "rgba(124,58,237,.06)" : "var(--mk-surface)" }}
            >
              {isSelected && (
                <span className="absolute right-3 top-3 grid size-6 place-items-center rounded-full text-white" style={{ background: "var(--mk-violet)" }}>
                  <CheckCircle2 size={16} />
                </span>
              )}
              <span className="grid size-14 place-items-center rounded-xl text-3xl" style={{ background: "var(--mk-bg-alt)" }}>{option.emoji}</span>
              <span className="mt-5 block text-xl font-black" style={{ color: "var(--mk-ink)" }}>{option.label}</span>
              <span className="mt-2 block text-sm leading-6" style={{ color: "var(--mk-ink-soft)" }}>{option.hint}</span>
            </motion.button>
          );
        })}
        <motion.button
          type="button"
          data-testid="platform-card-all"
          whileHover={{ y: -6, scale: 1.015 }}
          whileTap={{ scale: 0.98 }}
          onClick={onToggleAll}
          aria-pressed={allSelected}
          className="group relative min-h-40 rounded-2xl border p-5 text-left shadow-[0_10px_30px_rgba(15,16,36,.06)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c3aed]"
          style={{ borderColor: allSelected ? "var(--mk-violet)" : "var(--mk-border)", background: allSelected ? "rgba(124,58,237,.06)" : "var(--mk-surface)" }}
        >
          {allSelected && (
            <span className="absolute right-3 top-3 grid size-6 place-items-center rounded-full text-white" style={{ background: "var(--mk-violet)" }}>
              <CheckCircle2 size={16} />
            </span>
          )}
          <span className="grid size-14 place-items-center rounded-xl text-3xl" style={{ background: "var(--mk-bg-alt)" }}>⚡</span>
          <span className="mt-5 block text-xl font-black" style={{ color: "var(--mk-ink)" }}>Hepsi</span>
          <span className="mt-2 block text-sm leading-6" style={{ color: "var(--mk-ink-soft)" }}>{allSelected ? "Tüm platformları temizle" : "Meta + Google + Sosyal Medya'yı birlikte seç"}</span>
        </motion.button>
      </div>
      {error && <p data-testid="platform-error" className="mt-4 rounded-2xl border p-3 text-sm" style={{ borderColor: "rgba(220,38,38,.3)", background: "rgba(220,38,38,.06)", color: "#b91c1c" }}>{error}</p>}
      <button
        type="button"
        data-testid="platform-continue"
        onClick={onContinue}
        disabled={!canContinue}
        className="marketing-btn marketing-btn-primary mt-6 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Devam <ArrowRight size={16} />
      </button>
    </div>
  );
}

function CustomBusinessTypeField({ value, onChange, onContinue }: { value: string; onChange: (value: string) => void; onContinue: () => void }) {
  const [touched, setTouched] = useState(false);
  const valid = isValidCustomCategory(value);
  const showError = touched && value.length > 0 && !valid;

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (valid) onContinue();
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} className="mt-6 rounded-2xl border p-5" style={{ borderColor: "var(--mk-border-strong)", background: "var(--mk-bg-alt)" }}>
      <label htmlFor="custom-business-type" className="block text-sm font-bold" style={{ color: "var(--mk-ink)" }}>
        İşletme sektörünüzü yazın
      </label>
      <input
        id="custom-business-type"
        type="text"
        value={value}
        maxLength={MAX_BUSINESS_CATEGORY_LENGTH}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => setTouched(true)}
        onKeyDown={handleKeyDown}
        placeholder="Örn. Mobilya mağazası, güzellik merkezi, oto servis, hukuk bürosu"
        aria-invalid={showError}
        aria-describedby="custom-business-type-helper"
        className="mt-3 min-h-14 w-full rounded-xl border px-4 outline-none focus:ring-2"
        style={{ borderColor: showError ? "#f87171" : "var(--mk-border-strong)", background: "var(--mk-surface)", color: "var(--mk-ink)" }}
      />
      <p id="custom-business-type-helper" className="mt-2 text-xs leading-5" style={{ color: "var(--mk-ink-faint)" }}>
        {showError ? "En az 2 anlamlı karakter girin." : "Analiz ve bütçe önerisi bu sektöre göre hazırlanacaktır."}
      </p>
      <button
        type="button"
        onClick={onContinue}
        disabled={!valid}
        className="marketing-btn marketing-btn-primary mt-5 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Devam <ArrowRight size={16} />
      </button>
    </motion.div>
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
        <h2 className="text-3xl font-black sm:text-4xl" style={{ color: "var(--mk-ink)" }}>Operasyon İhtiyacınız</h2>
        <p className="mt-3 text-base leading-7" style={{ color: "var(--mk-ink-soft)" }}>Paket önerisini içerik üretimi, aciliyet ve mevcut sosyal medya durumuna göre netleştirin.</p>
      </div>
      <div className="mt-8 grid gap-5">
        {groups.map((group) => (
          <div key={group.key} className="rounded-2xl border p-5" style={{ borderColor: "var(--mk-border)", background: "var(--mk-bg-alt)" }}>
            <p className="text-sm font-black" style={{ color: "var(--mk-violet)" }}>{group.title}</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {group.options.map((option) => {
                const selected = answers[group.key] === option.value;
                return (
                <button
                  key={option.value}
                  type="button"
                  aria-label={`${group.title}: ${option.label}`}
                  onClick={() => setAnswers((current) => ({ ...current, [group.key]: option.value }))}
                  className="rounded-2xl border p-4 text-left transition hover:-translate-y-0.5"
                  style={selected ? { borderColor: "var(--mk-violet)", background: "var(--mk-violet)", color: "#fff" } : { borderColor: "var(--mk-border)", background: "var(--mk-surface)", color: "var(--mk-ink)" }}
                >
                  <span className="block text-sm font-black">{option.label}</span>
                  <span className="mt-1 block text-xs leading-5" style={{ color: selected ? "rgba(255,255,255,.85)" : "var(--mk-ink-faint)" }}>{option.description}</span>
                </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <button onClick={onNext} className="marketing-btn marketing-btn-primary mt-8">
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
        <div className="rounded-[26px] border p-6 sm:p-8" style={{ borderColor: "var(--mk-border-strong)", background: "linear-gradient(135deg, rgba(124,58,237,.06), rgba(37,99,235,.04))" }}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black text-white" style={{ background: "var(--mk-violet)" }}><Trophy size={18} /> Önerilen Paket</p>
            <Sparkles style={{ color: "var(--mk-pink)" }} />
          </div>
          <h2 className="mt-6 text-4xl font-black" style={{ color: "var(--mk-ink)" }}>{recommended.name}</h2>
          <div className="mt-4 rounded-2xl border p-4" style={{ borderColor: "var(--mk-border)", background: "var(--mk-surface)" }}>
            <p className="text-sm font-bold" style={{ color: "var(--mk-violet)" }}>Aylık hizmet bedeli</p>
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <p className="text-4xl font-black" style={{ color: "var(--mk-ink)" }}>{pricing ? formatTRY(pricing.basePrice) : recommended.price}</p>
              {pricing && <span className="mb-1 rounded-full px-3 py-1 text-xs font-black text-white" style={{ background: "var(--mk-pink)" }}>+ KDV</span>}
            </div>
            {pricing && <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2" style={{ color: "var(--mk-ink-soft)" }}>
              <span>KDV: <b style={{ color: "var(--mk-ink)" }}>{pricing.vatDisplay}</b></span>
              <span>KDV dahil: <b style={{ color: "var(--mk-ink)" }}>{pricing.totalDisplay}</b></span>
            </div>}
          </div>
          <p className="mt-4 text-base leading-8" style={{ color: "var(--mk-ink-soft)" }}>{recommended.description}</p>
          {reason && <p className="mt-4 rounded-2xl border p-4 text-sm leading-7" style={{ borderColor: "var(--mk-border)", background: "var(--mk-surface)", color: "var(--mk-ink)" }}>{reason}</p>}
          <ul className="mt-6 grid gap-3">
            {recommended.features.slice(0, 6).map((feature) => (
              <li key={feature} className="flex gap-3 rounded-2xl border p-3 text-sm" style={{ borderColor: "var(--mk-border)", background: "var(--mk-surface)", color: "var(--mk-ink)" }}>
                <CheckCircle2 className="mt-0.5 shrink-0 text-[#7c3aed]" size={18} /> {feature}
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
        <div className="rounded-2xl border p-5" style={{ borderColor: "var(--mk-border)", background: "var(--mk-bg-alt)" }}>
          <p className="marketing-eyebrow">Akıllı Reklam Bütçesi Önerisi</p>
          <p className="mt-3 text-sm leading-7" style={{ color: "var(--mk-ink-soft)" }}>Bu öneri sektör, hedef, platform ve başlangıç seviyesine göre oluşturulan tahmini medya bütçesidir. Kesin sonuç garantisi vermez; test ve optimizasyonla netleşir.</p>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <BudgetBox label="Minimum" value={formatBudgetRange(...adBudget.minimumRange)} />
            <BudgetBox label="İdeal" value={formatBudgetRange(...adBudget.idealRange)} highlight />
            <BudgetBox label="Agresif büyüme" value={formatBudgetRange(...adBudget.aggressiveRange)} />
          </div>
          <p className="mt-4 rounded-xl border p-4 text-sm leading-7" style={{ borderColor: "var(--mk-border)", background: "var(--mk-surface)", color: "var(--mk-ink)" }}>{adBudget.reason} {adBudget.budgetFit}</p>
          <div className="mt-5 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--mk-border)", background: "var(--mk-surface)" }}>
            <div>
              <p className="text-sm font-black" style={{ color: "var(--mk-ink)" }}>Piyasa Yorumu</p>
              <p className="mt-1 text-xs leading-5" style={{ color: "var(--mk-ink-soft)" }}>İşletme bilgilerinize göre kısa bir reklam bütçesi ve kanal yorumu hazırlanır. Sonuç garantisi vermez; ön değerlendirme niteliğindedir.</p>
            </div>
            <button type="button" onClick={createAiBudgetResearch} disabled={aiBudgetLoading || Boolean(aiBudget)} className="marketing-btn marketing-btn-primary shrink-0 disabled:cursor-not-allowed disabled:opacity-60">
              {aiBudgetLoading ? "Analiz oluşturuluyor..." : aiBudget ? "Analiz hazır" : "Bütçe Analizi Oluştur"}
            </button>
          </div>
          {aiBudgetError && <p className="mt-3 rounded-xl border p-3 text-sm" style={{ borderColor: "rgba(220,38,38,.3)", background: "rgba(220,38,38,.06)", color: "#b91c1c" }}>{aiBudgetError}</p>}
        </div>
        <div className="rounded-2xl border p-5" style={{ borderColor: "var(--mk-border)", background: "var(--mk-surface)" }}>
          <p className="text-sm font-black" style={{ color: "var(--mk-ink)" }}>Platform bütçe dağılımı</p>
          <div className="mt-4 grid gap-3">
            {adBudget.platformSplit.map((item) => (
              <div key={item.label}>
                <div className="mb-1 flex justify-between text-xs font-bold" style={{ color: "var(--mk-ink-soft)" }}><span>{item.label}</span><span>%{item.percent}</span></div>
                <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--mk-bg-alt)" }}><div className="h-full rounded-full" style={{ width: `${item.percent}%`, background: "linear-gradient(90deg, var(--mk-violet), var(--mk-pink))" }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {aiBudget && (
        <div className="mt-6 rounded-[24px] border p-5" style={{ borderColor: "var(--mk-border-strong)", background: "rgba(124,58,237,.05)" }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="marketing-eyebrow">{aiBudget.source !== "fallback" && aiBudget.source !== "demo" ? "AI Destekli Piyasa Yorumu" : "HK Dijital analiz modeli"}</p>
              <h3 className="mt-2 text-2xl font-black" style={{ color: "var(--mk-ink)" }}>Piyasa ve medya bütçesi değerlendirmesi</h3>
            </div>
            <span className="rounded-full px-3 py-1 text-xs font-black text-white" style={{ background: "var(--mk-violet)" }}>{aiBudget.providerLabel || (aiBudget.source === "fallback" ? "Yerel yedek" : "Otomatik AI")}</span>
          </div>
          <p className="mt-4 text-sm leading-7" style={{ color: "var(--mk-ink)" }}>{aiBudget.marketSummary}</p>
          {aiBudget.providerNotice && <p className="mt-3 rounded-xl border p-3 text-xs leading-5" style={{ borderColor: "var(--mk-border)", background: "var(--mk-surface)", color: "var(--mk-ink-soft)" }}>{aiBudget.providerNotice}</p>}
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
          <div className="mt-5 rounded-xl border p-4" style={{ borderColor: "var(--mk-border)", background: "var(--mk-surface)" }}>
            <p className="text-sm font-black" style={{ color: "var(--mk-ink)" }}>AI platform dağılımı</p>
            <div className="mt-4 grid gap-3">
              {aiBudget.platformSplit.map((item) => (
                <div key={`${item.label}-${item.percent}`} className="rounded-xl border p-3" style={{ borderColor: "var(--mk-border)", background: "var(--mk-bg-alt)" }}>
                  <div className="mb-2 flex justify-between text-xs font-bold" style={{ color: "var(--mk-ink)" }}><span>{item.label}</span><span>%{item.percent}</span></div>
                  <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--mk-border)" }}><div className="h-full rounded-full" style={{ width: `${item.percent}%`, background: "linear-gradient(90deg, var(--mk-violet), var(--mk-pink))" }} /></div>
                  <p className="mt-2 text-xs leading-5" style={{ color: "var(--mk-ink-soft)" }}>{item.note}</p>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-4 text-xs leading-6" style={{ color: "var(--mk-ink-faint)" }}>{aiBudget.disclaimer}</p>
        </div>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <PlanList title="İlk 30 Günlük Aksiyon Planı" items={adBudget.first30DaysPlan} />
        <PlanList title="Dikkat Edilmesi Gerekenler" items={adBudget.notes.slice(1)} />
        <PlanList title="Ek Hizmet Önerileri" items={adBudget.extraServices.length ? adBudget.extraServices : ["Performans raporlama düzeni", "Kreatif test planı", "Dönüşüm ölçüm kontrolü"]} />
      </div>

      <div className="mt-6 rounded-2xl border p-5 text-sm leading-7" style={{ borderColor: "var(--mk-border)", background: "var(--mk-bg-alt)", color: "var(--mk-ink)" }}>
        <b>HK Dijital yorumu:</b> Bu yapı hızlı satış vaadi yerine kontrollü test, veri toplama ve optimizasyon üzerine kurulmalıdır. Hizmet bedeline reklam harcamaları dahil değildir.
      </div>

      <div className="mt-6 rounded-2xl border p-5" style={{ borderColor: "var(--mk-border)", background: "var(--mk-surface)" }}>
        <p className="text-sm font-bold" style={{ color: "var(--mk-ink-faint)" }}>Alternatif Paket</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-2xl font-black" style={{ color: "var(--mk-ink)" }}>{alternative.name}</h3>
            <p className="mt-1" style={{ color: "var(--mk-violet)" }}>{alternative.price}</p>
          </div>
          <p className="max-w-xl text-sm leading-6" style={{ color: "var(--mk-ink-soft)" }}>Kapsam veya bütçe seviyesi değişirse alternatif paket birlikte değerlendirilebilir.</p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border p-5 text-sm leading-7" style={{ borderColor: "var(--mk-border)", background: "var(--mk-bg-alt)", color: "var(--mk-ink)" }}>
        Fiyatlara KDV dahil değildir. Reklam bütçesi hizmet bedeline dahil değildir. Satış garantisi verilmez; strateji, kurulum, optimizasyon ve raporlama süreci yönetilir.
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <a href={whatsappUrl} onClick={() => trackEvent("whatsapp_clicked")} target="_blank" rel="noreferrer" className="marketing-btn" style={{ background: "#25D366", color: "#fff", boxShadow: "0 12px 30px rgba(37,211,102,.28)" }}>
          <MessageCircle size={20} /> WhatsApp&apos;tan Görüşelim
        </a>
        <button onClick={onNext} className="marketing-btn marketing-btn-primary">
          Bilgilerimi Bırakayım <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

function BudgetBox({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: highlight ? "var(--mk-violet)" : "var(--mk-border)", background: highlight ? "rgba(124,58,237,.06)" : "var(--mk-surface)" }}>
      <p className="text-xs font-black uppercase tracking-wide" style={{ color: "var(--mk-ink-faint)" }}>{label}</p>
      <p className="mt-2 text-lg font-black" style={{ color: "var(--mk-ink)" }}>{value}</p>
    </div>
  );
}

function PlanList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border p-5" style={{ borderColor: "var(--mk-border)", background: "var(--mk-bg-alt)" }}>
      <p className="text-sm font-black" style={{ color: "var(--mk-ink)" }}>{title}</p>
      <div className="mt-4 grid gap-2">
        {items.map((item) => <p key={item} className="rounded-xl p-3 text-sm leading-6" style={{ background: "var(--mk-surface)", color: "var(--mk-ink-soft)" }}>{item}</p>)}
      </div>
    </div>
  );
}

function InsightCard({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-2xl border p-5" style={{ borderColor: "var(--mk-border)", background: "var(--mk-surface)" }}>
      <div className="grid size-12 place-items-center rounded-2xl" style={{ background: "var(--mk-bg-alt)", color: "var(--mk-violet)" }}>{icon}</div>
      <h3 className="mt-4 text-xl font-black" style={{ color: "var(--mk-ink)" }}>{title}</h3>
      <p className="mt-2 text-sm leading-7" style={{ color: "var(--mk-ink-soft)" }}>{text}</p>
    </div>
  );
}

function ContactStep({ wizard, form, setForm, error, sent, submit, whatsappUrl, back }: ContactStepProps) {
  return (
    <div>
      <h2 className="text-3xl font-black sm:text-4xl" style={{ color: "var(--mk-ink)" }}>İletişim Bilgileriniz</h2>
      <p className="mt-3 max-w-2xl text-base leading-7" style={{ color: "var(--mk-ink-soft)" }}>Öneriyi netleştirmek ve işletmenize göre ilk değerlendirmeyi hazırlamak için birkaç bilgi yeterli.</p>
      <div className="mt-6 rounded-2xl border p-5 text-sm" style={{ borderColor: "var(--mk-border)", background: "var(--mk-bg-alt)", color: "var(--mk-ink)" }}>
        Form gönderimi satış garantisi anlamına gelmez; süreç karşılıklı değerlendirme ile ilerler.
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {wizard.formFields.map((field: QuoteFormField) => (
          <label key={field.id} className={`grid gap-2 text-sm font-semibold ${field.type === "textarea" ? "md:col-span-2" : ""}`} style={{ color: "var(--mk-ink)" }}>
            {field.label}{field.required ? " *" : ""}
            {field.type === "textarea" ? (
              <textarea rows={5} value={form[field.id] || ""} onChange={(event) => setForm((current: Answers) => ({ ...current, [field.id]: event.target.value }))} className="rounded-xl border px-4 py-3 outline-none focus:ring-2" style={{ borderColor: "var(--mk-border-strong)", background: "var(--mk-surface)", color: "var(--mk-ink)" }} />
            ) : (
              <input type={field.type} value={form[field.id] || ""} onChange={(event) => setForm((current: Answers) => ({ ...current, [field.id]: event.target.value }))} className="min-h-14 rounded-xl border px-4 outline-none focus:ring-2" style={{ borderColor: "var(--mk-border-strong)", background: "var(--mk-surface)", color: "var(--mk-ink)" }} />
            )}
          </label>
        ))}
      </div>
      {error && <p className="mt-5 rounded-2xl p-4 text-sm" style={{ background: "rgba(220,38,38,.06)", color: "#b91c1c" }}>{error}</p>}
      {sent && (
        <div className="mt-5 rounded-2xl border p-5 text-sm" style={{ borderColor: "rgba(16,185,129,.3)", background: "rgba(16,185,129,.06)", color: "#047857" }}>
          {wizard.successMessage}
          <a href={whatsappUrl} onClick={() => trackEvent("whatsapp_clicked")} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-full px-5 py-3 font-black text-white" style={{ background: "#25D366" }}>
            WhatsApp&apos;tan Görüşelim
          </a>
        </div>
      )}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button onClick={back} className="marketing-btn marketing-btn-secondary"><ArrowLeft size={17} /> Geri</button>
        <button onClick={submit} className="marketing-btn marketing-btn-primary">{wizard.ctaTexts.submit}</button>
      </div>
    </div>
  );
}
