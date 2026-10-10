"use client";

import { Fragment, useState, type Dispatch, type KeyboardEvent, type SetStateAction } from "react";
import type { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle2, MessageCircle } from "lucide-react";
import type { SiteContent } from "@/lib/types";
import { CONTENT_NEED_OPTIONS, SOCIAL_STATUS_OPTIONS, URGENCY_OPTIONS, packageChoiceLabel } from "@/lib/packages";
import { businessCards, isValidCustomCategory, normalizeCustomCategory, OTHER_BUSINESS_TYPE_ID, MAX_BUSINESS_CATEGORY_LENGTH, resolveBusinessCategory } from "@/lib/business-category";
import { PLATFORM_OPTIONS, isAllPlatformsSelected, platformSelectionLabel, toggleAllPlatforms, togglePlatform, type PlatformKey } from "@/lib/platform-selection";
import { trackEvent } from "./TrackingPlaceholders";
import { resolvePublicWhatsappNumber } from "@/lib/public-contact";

type Answers = Record<string, string>;
type QuoteContent = Pick<SiteContent, "quoteWizard" | "packages" | "contact">;
type QuoteFormField = SiteContent["quoteWizard"]["formFields"][number];
type ContactStepProps = {
  wizard: SiteContent["quoteWizard"];
  form: Answers;
  setForm: Dispatch<SetStateAction<Answers>>;
  error: string;
  sent: boolean;
  submit: () => void;
  whatsappUrl: string | null;
  back: () => void;
};

const steps = ["İşletme", "Hedef", "Platform", "Bütçe", "İhtiyaç", "Analiz", "İletişim"];

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

function selectedLabel(cards: { id: string; label: string }[], id?: string) {
  return cards.find((item) => item.id === id)?.label || id || "-";
}

export function QuoteWizard({ content }: { content: QuoteContent }) {
  const wizard = content.quoteWizard;
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [customBusinessType, setCustomBusinessType] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformKey[]>([]);
  const [platformError, setPlatformError] = useState("");
  const [form, setForm] = useState<Answers>({});
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const resolvedBusinessCategory = resolveBusinessCategory(answers.businessType, customBusinessType);
  const resolvedPlatformLabel = platformSelectionLabel(selectedPlatforms);

  const analysisSummary = [
    { label: "İşletme Profili", value: resolvedBusinessCategory || "Belirtilmedi" },
    { label: "Ana Hedef", value: selectedLabel(goalCards, answers.goal) },
    { label: "Tercih Edilen Kanallar", value: resolvedPlatformLabel || "Belirtilmedi" },
    { label: "Aylık Reklam Bütçesi", value: selectedLabel(budgetCards, answers.budget) },
    { label: "İçerik İhtiyacı", value: packageChoiceLabel("content", answers.contentNeed) || "Belirtilmedi" },
    { label: "Başlangıç Planı", value: packageChoiceLabel("urgency", answers.urgency) || "Belirtilmedi" },
    { label: "Mevcut Durum", value: packageChoiceLabel("social", answers.socialStatus) || "Belirtilmedi" }
  ];

  function select(key: string, value: string) {
    if (step === 0) {
      trackEvent("quote_wizard_started");
      trackEvent("pre_analysis_started");
    }
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
      })
    });
    if (!response.ok) {
      setError("Form gönderilemedi. Lütfen bilgileri kontrol edip tekrar deneyin.");
      return;
    }
    setSent(true);
    // A single event per successful submission — this used to also fire a
    // second "lead_form_submitted" right after, which double-counted the
    // same conversion in Meta Pixel, first-party analytics and now GA4
    // (all three key off the "form_submitted" substring in trackEvent).
    trackEvent("quote_form_submitted", { form_name: "Dijital Pazarlama Ön Analizi" });
  }

  const whatsappNumber = resolvePublicWhatsappNumber(content.contact.whatsappNumber);
  const whatsappMessage = encodeURIComponent(
    `HK Dijital dijital pazarlama ön analizi\nİşletme türü: ${resolvedBusinessCategory}\nHedef: ${selectedLabel(goalCards, answers.goal)}\nPlatform: ${resolvedPlatformLabel}\nBütçe: ${selectedLabel(budgetCards, answers.budget)}\nİçerik ihtiyacı: ${packageChoiceLabel("content", answers.contentNeed)}\nBaşlangıç: ${packageChoiceLabel("urgency", answers.urgency)}\nMevcut durum: ${packageChoiceLabel("social", answers.socialStatus)}`
  );
  const whatsappUrl = whatsappNumber ? `https://wa.me/${whatsappNumber}?text=${whatsappMessage}` : null;
  const progress = ((step + 1) / steps.length) * 100;

  return (
    <section className="marketing-shell mx-auto max-w-6xl">
      <div className="marketing-card relative overflow-hidden p-5 sm:p-8 lg:p-10">
        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-3xl">
              <p className="marketing-eyebrow">Dijital pazarlama ön analizi</p>
              <h2 className="mt-5 text-3xl font-black leading-tight sm:text-5xl" style={{ color: "var(--mk-ink)" }}>İşletmenizi Tanıyalım</h2>
              <p className="mt-4 max-w-2xl text-base leading-8 sm:text-lg" style={{ color: "var(--mk-ink-soft)" }}>1 dakikalık ön analiz ile hedeflerinizi ve ihtiyaçlarınızı netleştirin.</p>
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
                  <Options title="İşletme Türünüz" text="Sektörünüzü seçin; ön analiziniz buna göre hazırlanır." options={businessCards} selectedId={answers.businessType} onSelect={(value) => select("businessType", value)} />
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
              {step === 3 && <StepPanel key="budget"><Options title="Aylık Reklam Bütçesi" text="Reklam bütçesi hizmet bedeline dahil değildir; bu seçim ön analizin kapsamını netleştirir." options={budgetCards} onSelect={(value) => select("budget", value)} /></StepPanel>}
              {step === 4 && <StepPanel key="needs"><NeedsStep answers={answers} setAnswers={setAnswers} onNext={() => { trackEvent("pre_analysis_completed"); setStep(5); }} /></StepPanel>}
              {step === 5 && <StepPanel key="analysis"><PreAnalysisResult summary={analysisSummary} platforms={selectedPlatforms} whatsappUrl={whatsappUrl} onNext={() => setStep(6)} /></StepPanel>}
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
              style={{ borderColor: isSelected ? "var(--mk-violet)" : "var(--mk-border)", background: isSelected ? "rgba(16, 124, 115,.06)" : "var(--mk-surface)" }}
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
              className="group relative min-h-40 rounded-2xl border p-5 text-left shadow-[0_10px_30px_rgba(15,16,36,.06)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#107C73]"
              style={{ borderColor: isSelected ? "var(--mk-violet)" : "var(--mk-border)", background: isSelected ? "rgba(16, 124, 115,.06)" : "var(--mk-surface)" }}
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
          className="group relative min-h-40 rounded-2xl border p-5 text-left shadow-[0_10px_30px_rgba(15,16,36,.06)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#107C73]"
          style={{ borderColor: allSelected ? "var(--mk-violet)" : "var(--mk-border)", background: allSelected ? "rgba(16, 124, 115,.06)" : "var(--mk-surface)" }}
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
        {showError ? "En az 2 anlamlı karakter girin." : "Ön analiziniz bu sektöre göre hazırlanacaktır."}
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
        <p className="mt-3 text-base leading-7" style={{ color: "var(--mk-ink-soft)" }}>Ön analizinizi içerik üretimi, başlangıç zamanı ve mevcut sosyal medya durumuna göre netleştirin.</p>
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
        Analizi Görüntüle <ArrowRight size={18} />
      </button>
    </div>
  );
}

function preAnalysisTopics(platforms: PlatformKey[]) {
  const paidChannels = [platforms.includes("meta") && "Meta", platforms.includes("google") && "Google Ads"].filter(Boolean).join(" ve ");
  return [
    { title: "Reklam Stratejisi", text: paidChannels ? `Hedefinize uygun ${paidChannels} yapısının değerlendirilmesi.` : "Hedefinize uygun reklam yapısının değerlendirilmesi." },
    { title: "Bütçe Planlaması", text: "Reklam bütçesinin hedefler ve kullanılacak kanallar doğrultusunda planlanması." },
    { title: "İçerik & Kreatif", text: "Reklam ve sosyal medya için gerekli içerik ve kreatif yapısının belirlenmesi." },
    { title: "Ölçüm & Raporlama", text: "Dönüşüm takibi ve performans ölçüm altyapısının değerlendirilmesi." }
  ];
}

function PreAnalysisResult({ summary, platforms, whatsappUrl, onNext }: { summary: { label: string; value: string }[]; platforms: PlatformKey[]; whatsappUrl: string | null; onNext: () => void }) {
  return (
    <div>
      <div className="max-w-3xl">
        <h2 className="text-3xl font-black sm:text-4xl" style={{ color: "var(--mk-ink)" }}>Dijital Pazarlama Ön Analiziniz</h2>
        <p className="mt-3 text-base leading-7" style={{ color: "var(--mk-ink-soft)" }}>Verdiğiniz bilgiler doğrultusunda işletmenizin mevcut ihtiyacını özetledik.</p>
      </div>
      <dl className="mt-8 grid gap-3 sm:grid-cols-2">
        {summary.map((item) => (
          <div key={item.label} className="min-w-0 rounded-2xl border p-4" style={{ borderColor: "var(--mk-border)", background: "var(--mk-surface)" }}>
            <dt className="text-xs font-black uppercase tracking-wide" style={{ color: "var(--mk-violet)" }}>{item.label}</dt>
            <dd className="mt-2 break-words text-base font-bold" style={{ color: "var(--mk-ink)" }}>{item.value}</dd>
          </div>
        ))}
      </dl>
      <h3 className="mt-10 text-xl font-black" style={{ color: "var(--mk-ink)" }}>Görüşmede Neleri Planlayacağız?</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {preAnalysisTopics(platforms).map((topic) => (
          <div key={topic.title} className="min-w-0 rounded-2xl border p-5" style={{ borderColor: "var(--mk-border)", background: "var(--mk-surface)" }}>
            <p className="font-black" style={{ color: "var(--mk-ink)" }}>{topic.title}</p>
            <p className="mt-2 text-sm leading-6" style={{ color: "var(--mk-ink-soft)" }}>{topic.text}</p>
          </div>
        ))}
      </div>
      <p className="mt-6 rounded-2xl p-4 text-sm leading-6" style={{ background: "var(--mk-bg-alt)", color: "var(--mk-ink-soft)" }}>
        Bu ön analiz otomatik bir fiyat teklifi değildir. Nihai strateji ve hizmet kapsamı, işletmenizin mevcut yapısı incelendikten sonra belirlenir.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button onClick={onNext} className="marketing-btn marketing-btn-primary">İletişim Bilgilerine Geç <ArrowRight size={18} /></button>
        {whatsappUrl && (
          <a href={whatsappUrl} onClick={() => trackEvent("whatsapp_cta_clicked")} target="_blank" rel="noreferrer" className="marketing-btn marketing-btn-secondary"><MessageCircle size={17} /> WhatsApp ile Görüşün</a>
        )}
      </div>
    </div>
  );
}

function AddressField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-sm font-semibold md:col-span-2" style={{ color: "var(--mk-ink)" }}>
      Açık Adres
      <input type="text" autoComplete="street-address" maxLength={500} value={value} onChange={(event) => onChange(event.target.value)} placeholder="Mahalle, sokak, bina ve kapı no" className="min-h-14 rounded-xl border px-4 outline-none focus:ring-2" style={{ borderColor: "var(--mk-border-strong)", background: "var(--mk-surface)", color: "var(--mk-ink)" }} />
      <span className="text-xs font-normal leading-5" style={{ color: "var(--mk-ink-faint)" }}>Yerel işletme ön incelemesinde konum ve bölge değerlendirmesi için kullanılır.</span>
    </label>
  );
}

function ContactStep({ wizard, form, setForm, error, sent, submit, whatsappUrl, back }: ContactStepProps) {
  return (
    <div>
      <h2 className="text-3xl font-black sm:text-4xl" style={{ color: "var(--mk-ink)" }}>Analizinizi Tamamlayın</h2>
      <p className="mt-3 max-w-2xl text-base leading-7" style={{ color: "var(--mk-ink-soft)" }}>İşletmeniz için verdiğiniz bilgileri HK Dijital’e iletin. İhtiyaçlarınızı birlikte değerlendirelim.</p>
      <div className="mt-6 rounded-2xl border p-5 text-sm" style={{ borderColor: "var(--mk-border)", background: "var(--mk-bg-alt)", color: "var(--mk-ink)" }}>
        Form gönderimi satış garantisi anlamına gelmez; süreç karşılıklı değerlendirme ile ilerler.
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {wizard.formFields.map((field: QuoteFormField) => (
          <Fragment key={field.id}>
          {field.type === "textarea" && <AddressField value={form.address || ""} onChange={(address) => setForm((current: Answers) => ({ ...current, address }))} />}
          <label key={field.id} className={`grid gap-2 text-sm font-semibold ${field.type === "textarea" ? "md:col-span-2" : ""}`} style={{ color: "var(--mk-ink)" }}>
            {field.label}{field.required ? " *" : ""}
            {field.type === "textarea" ? (
              <textarea rows={5} value={form[field.id] || ""} onChange={(event) => setForm((current: Answers) => ({ ...current, [field.id]: event.target.value }))} className="rounded-xl border px-4 py-3 outline-none focus:ring-2" style={{ borderColor: "var(--mk-border-strong)", background: "var(--mk-surface)", color: "var(--mk-ink)" }} />
            ) : (
              <input type={field.type} value={form[field.id] || ""} onChange={(event) => setForm((current: Answers) => ({ ...current, [field.id]: event.target.value }))} className="min-h-14 rounded-xl border px-4 outline-none focus:ring-2" style={{ borderColor: "var(--mk-border-strong)", background: "var(--mk-surface)", color: "var(--mk-ink)" }} />
            )}
          </label>
          </Fragment>
        ))}
      </div>
      {error && <p className="mt-5 rounded-2xl p-4 text-sm" style={{ background: "rgba(220,38,38,.06)", color: "#b91c1c" }}>{error}</p>}
      {sent && (
        <div className="mt-5 rounded-2xl border p-5 text-sm" style={{ borderColor: "rgba(16,185,129,.3)", background: "rgba(16,185,129,.06)", color: "#047857" }}>
          {wizard.successMessage}
          {whatsappUrl && (
            <a href={whatsappUrl} onClick={() => trackEvent("whatsapp_clicked")} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-full px-5 py-3 font-black text-white" style={{ background: "#25D366" }}>
              WhatsApp&apos;tan Görüşelim
            </a>
          )}
        </div>
      )}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button onClick={back} className="marketing-btn marketing-btn-secondary"><ArrowLeft size={17} /> Geri</button>
        <button onClick={submit} className="marketing-btn marketing-btn-primary">Analizimi Gönder</button>
      </div>
    </div>
  );
}
