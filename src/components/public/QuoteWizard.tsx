"use client";

import { useMemo, useState } from "react";
import type { PackageItem, SiteContent } from "@/lib/types";
import { trackEvent } from "./TrackingPlaceholders";
import { PremiumCard } from "./ui";

type Answers = Record<string, string>;

type QuoteContent = Pick<SiteContent, "quoteWizard" | "packages" | "contact">;

function getPackageById(content: QuoteContent, id: string) {
  return content.packages.find((item) => item.id === id) ?? content.packages[0];
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
    setStep((current) => Math.min(current + 1, 4));
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
        businessType: answers.businessType,
        goal: answers.goal,
        budget: answers.budget,
        recommendedPackage: recommendation.recommended.name,
        alternativePackage: recommendation.alternative.name
      })
    });
    // Replace local JSON lead storage with real CRM/backend integration here.
  }

  const whatsappMessage = encodeURIComponent(
    `HK Dijital teklif talebi\nPaket: ${recommendation.recommended.name}\nAlternatif: ${recommendation.alternative.name}\nİşletme türü: ${answers.businessType || "-"}\nHedef: ${answers.goal || "-"}\nBütçe: ${answers.budget || "-"}\nAd Soyad: ${form.name || "-"}\nFirma: ${form.company || "-"}\nE-posta: ${form.email || "-"}\nTelefon: ${form.phone || "-"}\nInstagram: ${form.instagram || "-"}\nWeb: ${form.website || "-"}\nNot: ${form.note || "-"}`
  );
  const whatsappUrl = `https://wa.me/${content.contact.whatsappNumber.replace(/\D/g, "")}?text=${whatsappMessage}`;

  return (
    <PremiumCard className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[.22em] text-cyan-200">Teklif Sihirbazı</p>
          <h1 className="mt-3 text-3xl font-black text-white">{wizard.title}</h1>
          <p className="mt-2 text-slate-300">{wizard.subtitle}</p>
        </div>
        <span className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300">{step + 1} / 5</span>
      </div>

      <div className="mt-8">
        {step === 0 && <Options title="İşletme Türünüz" options={wizard.businessTypes} onSelect={(value) => select("businessType", value)} />}
        {step === 1 && <Options title="Ana Hedefiniz" options={wizard.goals} onSelect={(value) => select("goal", value)} />}
        {step === 2 && <Options title="Aylık Reklam Bütçesi" options={wizard.budgets} onSelect={(value) => select("budget", value)} />}
        {step === 3 && (
          <Recommendation recommended={recommendation.recommended} alternative={recommendation.alternative} onNext={() => setStep(4)} />
        )}
        {step === 4 && (
          <div>
            <h2 className="text-2xl font-black text-white">İletişim Bilgileriniz</h2>
            <div className="mt-5 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-4 text-sm text-cyan-100">
              Seçilen öneri: {recommendation.recommended.name} - {recommendation.recommended.price}
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {wizard.formFields.map((field) => (
                <label key={field.id} className={`grid gap-2 text-sm font-semibold text-slate-200 ${field.type === "textarea" ? "md:col-span-2" : ""}`}>
                  {field.label}{field.required ? " *" : ""}
                  {field.type === "textarea" ? (
                    <textarea rows={5} value={form[field.id] || ""} onChange={(event) => setForm((current) => ({ ...current, [field.id]: event.target.value }))} className="rounded-[8px] border border-white/10 bg-black/30 px-4 py-3 text-white focus:ring-2 focus:ring-cyan-300" />
                  ) : (
                    <input type={field.type} value={form[field.id] || ""} onChange={(event) => setForm((current) => ({ ...current, [field.id]: event.target.value }))} className="min-h-12 rounded-[8px] border border-white/10 bg-black/30 px-4 text-white focus:ring-2 focus:ring-cyan-300" />
                  )}
                </label>
              ))}
            </div>
            {error && <p className="mt-4 rounded-[8px] bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}
            {sent && (
              <div className="mt-4 rounded-[8px] bg-cyan-300/10 p-4 text-sm text-cyan-100">
                {wizard.successMessage}
                <a href={whatsappUrl} onClick={() => trackEvent("whatsapp_clicked")} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-full bg-cyan-300 px-4 py-2 font-black text-slate-950">
                  {wizard.ctaTexts.whatsapp}
                </a>
              </div>
            )}
            <div className="mt-6 flex gap-3">
              <button onClick={() => setStep(3)} className="rounded-full border border-white/15 px-5 py-3 text-sm font-bold text-white">{wizard.ctaTexts.back}</button>
              <button onClick={submit} className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950">{wizard.ctaTexts.submit}</button>
            </div>
          </div>
        )}
      </div>
    </PremiumCard>
  );
}

function Options({ title, options, onSelect }: { title: string; options: { id: string; label: string }[]; onSelect: (value: string) => void }) {
  return (
    <div>
      <h2 className="text-2xl font-black text-white">{title}</h2>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((option) => (
          <button key={option.id} onClick={() => onSelect(option.id)} className="min-h-20 rounded-[8px] border border-white/10 bg-white/[0.045] px-5 text-left text-base font-bold text-slate-100 transition hover:border-cyan-200/50 hover:bg-cyan-200/10">
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Recommendation({ recommended, alternative, onNext }: { recommended: PackageItem; alternative: PackageItem; onNext: () => void }) {
  return (
    <div>
      <h2 className="text-2xl font-black text-white">Size Özel Önerimiz</h2>
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <PackageSummary title="Önerilen Paket" item={recommended} highlight />
        <PackageSummary title="Alternatif Paket" item={alternative} />
      </div>
      <div className="mt-5 rounded-[8px] border border-white/10 bg-white/[0.035] p-4 text-sm leading-7 text-slate-300">
        Fiyatlara KDV dahil değildir. Reklam bütçesi hizmet bedeline dahil değildir. Satış garantisi verilmez; strateji, kurulum, optimizasyon ve raporlama süreci yönetilir.
      </div>
      <button onClick={onNext} className="mt-6 rounded-full bg-cyan-300 px-6 py-3 text-sm font-black text-slate-950">İletişim Bilgilerine Geç</button>
    </div>
  );
}

function PackageSummary({ title, item, highlight = false }: { title: string; item: PackageItem; highlight?: boolean }) {
  return (
    <div className={`rounded-[8px] border p-5 ${highlight ? "border-cyan-200/50 bg-cyan-200/10" : "border-white/10 bg-white/[0.04]"}`}>
      <p className="text-sm font-bold text-cyan-200">{title}</p>
      <h3 className="mt-3 text-2xl font-black text-white">{item.name}</h3>
      <p className="mt-2 text-xl font-black text-cyan-100">{item.price}</p>
      <ul className="mt-4 space-y-2 text-sm text-slate-300">
        {item.features.map((feature) => <li key={feature}>{feature}</li>)}
      </ul>
    </div>
  );
}
