"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Bot, CheckCircle2, ExternalLink, Globe2, Search, ShieldCheck, XCircle } from "lucide-react";
import { buildCustomerSetupSummary, getCustomerSetupSteps, type CustomerSetupSummary } from "@/lib/customer-onboarding";

const cmsOptions = ["WordPress", "Next.js", "Shopify", "İkas", "Ticimax", "Ideasoft", "Diğer"];
const aiOptions = [
  ["auto", "Auto Router / Otomatik Seçim"],
  ["openai", "OpenAI / ChatGPT"],
  ["gemini", "Google Gemini"],
  ["groq", "Groq"],
  ["anthropic", "Claude"],
  ["manus", "Manus AI"],
  ["demo", "Demo / Yerel Yedek Akış"]
];

const emptyIntegration: Record<string, string> = {
  domain: "",
  website_url: "",
  cms_provider: "",
  hosting_notes: "",
  meta_business_id: "",
  meta_ad_account_id: "",
  meta_pixel_id: "",
  meta_dataset_id: "",
  meta_page_id: "",
  instagram_business_id: "",
  meta_access_token_masked: "",
  ga4_measurement_id: "",
  ga4_property_id: "",
  google_ads_customer_id: "",
  search_console_site_url: "",
  gtm_container_id: "",
  google_service_account_email: "",
  google_service_account_status: "not_configured",
  clarity_project_id: "",
  hotjar_site_id: "",
  preferred_ai_provider: "auto",
  ai_notes: ""
};

function statusLabel(status: string) {
  if (status === "completed") return "Tamamlandı";
  if (status === "optional") return "Opsiyonel";
  if (status === "check") return "Kontrol Edilecek";
  return "Eksik";
}

function statusClass(status: string) {
  if (status === "completed") return "bg-emerald-100 text-emerald-700";
  if (status === "optional") return "bg-sky-100 text-sky-700";
  if (status === "check") return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
}

function Input({ label, value, onChange, placeholder = "" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-slate-700">
      {label}
      <input value={value || ""} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="min-h-11 rounded-[10px] border border-slate-200 bg-slate-50 px-3 text-slate-900 placeholder:text-slate-400" />
    </label>
  );
}

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-slate-700">
      {label}
      <textarea rows={4} value={value || ""} onChange={(event) => onChange(event.target.value)} className="rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-3 text-slate-900" />
    </label>
  );
}

function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-[14px] bg-cyan-50 text-cyan-700">{icon}</span>
        <h3 className="text-base font-black text-slate-950">{title}</h3>
      </div>
      <div className="grid gap-3 md:grid-cols-2">{children}</div>
    </section>
  );
}

export function CustomerIntegrationsPanel({ company, users = [], campaigns = [], reports = [], content, setContent, notify }: any) {
  const localIntegration = (content?.customerIntegrations || []).find((item: any) => item.company_id === company.id) || {};
  const [form, setForm] = useState<Record<string, string>>({ ...emptyIntegration, ...localIntegration });
  const [setup, setSetup] = useState<CustomerSetupSummary>(() => buildCustomerSetupSummary(getCustomerSetupSteps(company, users, form, campaigns, reports)));
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const response = await fetch(`/api/admin/customers/${company.id}/integrations`, { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Entegrasyon bilgisi alınamadı.");
        if (!mounted) return;
        const next: Record<string, string> = { ...emptyIntegration, ...(payload.integration || {}) };
        setForm(next);
        setSetup(payload.setup || buildCustomerSetupSummary(getCustomerSetupSteps(company, users, next, campaigns, reports)));
      } catch {
        const steps = getCustomerSetupSteps(company, users, localIntegration, campaigns, reports);
        if (mounted) setSetup(buildCustomerSetupSummary(steps));
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [company.id]);

  const liveSetup = useMemo(() => buildCustomerSetupSummary(getCustomerSetupSteps(company, users, form, campaigns, reports)), [company, users, form, campaigns, reports]);
  const displaySetup = setup?.progress === liveSetup.progress ? setup : liveSetup;

  function update(key: string, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/customers/${company.id}/integrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.details?.join(" ") || payload.supabaseError || payload.error || "Entegrasyon bilgileri kaydedilemedi.");
      setForm({ ...emptyIntegration, ...(payload.integration || form) });
      setSetup(payload.setup || liveSetup);
      setContent?.({
        ...content,
        customerIntegrations: [
          payload.integration || { ...form, company_id: company.id, setup_progress: payload.setup?.progress || liveSetup.progress },
          ...(content?.customerIntegrations || []).filter((item: any) => item.company_id !== company.id)
        ]
      });
      setEditing(false);
      setMessage("Entegrasyon bilgileri kaydedildi.");
      notify?.("✓ Entegrasyon bilgileri kaydedildi.", "success");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Entegrasyon bilgileri kaydedilemedi.";
      setMessage(errorMessage);
      notify?.(errorMessage, "error");
    } finally {
      setLoading(false);
    }
  }

  async function testIntegrations() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/customers/${company.id}/integrations/test`, { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.supabaseError || payload.error || "Test tamamlanamadı.");
      setMessage(payload.results?.map((item: any) => `${item.label}: ${item.status}`).join(" · ") || payload.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Test tamamlanamadı.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-[20px] border border-cyan-200 bg-cyan-50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">Müşteri Kurulum Durumu</p>
            <h3 className="mt-2 text-2xl font-black text-slate-950">%{displaySetup.progress} tamamlandı</h3>
            <p className="mt-1 text-sm font-semibold text-cyan-900">{displaySetup.completedSteps} / {displaySetup.totalSteps} adım tamamlandı. Opsiyonel davranış analitiği adımları ilerlemeyi düşürmez.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setEditing((current) => !current)} className="rounded-full bg-cyan-500 px-4 py-2 text-xs font-black text-white">{editing ? "Düzenlemeyi Kapat" : "Düzenle"}</button>
            <button type="button" onClick={testIntegrations} disabled={loading} className="rounded-full border border-cyan-300 bg-white px-4 py-2 text-xs font-black text-cyan-800 disabled:opacity-60">Test Et</button>
            <a href={`/hk-admin/website-analytics?companyId=${company.id}`} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700">Website Analytics’te Gör</a>
            <a href={`/hk-admin/agent-hub?companyId=${company.id}`} className="rounded-full border border-violet-200 bg-white px-4 py-2 text-xs font-black text-violet-700">Agent Hub’da Analiz Et</a>
          </div>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-white">
          <div className="h-full rounded-full bg-cyan-500" style={{ width: `${displaySetup.progress}%` }} />
        </div>
        {message && <p className="mt-4 rounded-[12px] border border-cyan-200 bg-white p-3 text-sm font-semibold text-cyan-900">{message}</p>}
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {displaySetup.steps.map((item) => (
          <article key={item.key} className="rounded-[16px] border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-black text-slate-950">{item.title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p>
              </div>
              <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-black ${statusClass(item.status)}`}>{statusLabel(item.status)}</span>
            </div>
            <a href={item.actionHref} className="mt-3 inline-flex items-center gap-2 text-xs font-black text-cyan-700">{item.actionLabel} <ExternalLink size={13} /></a>
          </article>
        ))}
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="Web Sitesi" icon={<Globe2 size={18} />}>
          <Input label="Domain" value={form.domain} onChange={(value) => update("domain", value)} placeholder="example.com" />
          <Input label="Website URL" value={form.website_url} onChange={(value) => update("website_url", value)} placeholder="https://example.com" />
          <label className="grid gap-2 text-sm font-semibold text-slate-700">CMS / altyapı
            <select disabled={!editing} value={form.cms_provider || ""} onChange={(event) => update("cms_provider", event.target.value)} className="min-h-11 rounded-[10px] border border-slate-200 bg-slate-50 px-3 text-slate-900">
              <option value="">Seçin</option>
              {cmsOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <Textarea label="Hosting notu" value={form.hosting_notes} onChange={(value) => update("hosting_notes", value)} />
        </Section>

        <Section title="Meta" icon={<ShieldCheck size={18} />}>
          <Input label="Meta Business ID" value={form.meta_business_id} onChange={(value) => update("meta_business_id", value)} />
          <Input label="Meta Ad Account ID" value={form.meta_ad_account_id} onChange={(value) => update("meta_ad_account_id", value)} />
          <Input label="Meta Pixel ID" value={form.meta_pixel_id} onChange={(value) => update("meta_pixel_id", value)} />
          <Input label="Meta Dataset ID (veri seti kimliği)" value={form.meta_dataset_id} onChange={(value) => update("meta_dataset_id", value)} />
          <Input label="Meta Page ID" value={form.meta_page_id} onChange={(value) => update("meta_page_id", value)} />
          <Input label="Instagram Business ID" value={form.instagram_business_id} onChange={(value) => update("instagram_business_id", value)} />
          <Input label="Meta Access Token durumu" value={form.meta_access_token_masked} onChange={(value) => update("meta_access_token_masked", value)} placeholder="Tanımlı / Eksik / Maskeli" />
          <p className="rounded-[12px] bg-slate-50 p-3 text-xs leading-5 text-slate-600 md:col-span-2">Dataset ID, Events Manager &gt; Data Sources &gt; Pixel/Dataset &gt; Settings alanından alınır. Gerçek token bu ekranda saklanmaz.</p>
        </Section>

        <Section title="Google" icon={<Search size={18} />}>
          <Input label="GA4 Measurement ID" value={form.ga4_measurement_id} onChange={(value) => update("ga4_measurement_id", value)} placeholder="G-XXXXXXXXXX" />
          <Input label="GA4 Property ID (Google Analytics mülk kimliği)" value={form.ga4_property_id} onChange={(value) => update("ga4_property_id", value)} />
          <Input label="Google Ads Customer ID" value={form.google_ads_customer_id} onChange={(value) => update("google_ads_customer_id", value)} />
          <Input label="Search Console Site URL" value={form.search_console_site_url} onChange={(value) => update("search_console_site_url", value)} placeholder="https://example.com/" />
          <Input label="GTM Container ID (etiket yöneticisi)" value={form.gtm_container_id} onChange={(value) => update("gtm_container_id", value)} placeholder="GTM-XXXXXXX" />
          <Input label="Google servis hesabı e-posta" value={form.google_service_account_email} onChange={(value) => update("google_service_account_email", value)} />
          <Input label="Google servis hesabı durumu" value={form.google_service_account_status} onChange={(value) => update("google_service_account_status", value)} />
          <p className="rounded-[12px] bg-slate-50 p-3 text-xs leading-5 text-slate-600 md:col-span-2">Private key müşteri profilinde gösterilmez. GA4 ve Search Console yetkisi servis hesabı maili üzerinden verilir.</p>
        </Section>

        <Section title="Davranış Analitiği + AI" icon={<Bot size={18} />}>
          <Input label="Microsoft Clarity Project ID" value={form.clarity_project_id} onChange={(value) => update("clarity_project_id", value)} />
          <Input label="Hotjar Site ID" value={form.hotjar_site_id} onChange={(value) => update("hotjar_site_id", value)} />
          <label className="grid gap-2 text-sm font-semibold text-slate-700">Müşteri bazlı AI modu
            <select disabled={!editing} value={form.preferred_ai_provider || "auto"} onChange={(event) => update("preferred_ai_provider", event.target.value)} className="min-h-11 rounded-[10px] border border-slate-200 bg-slate-50 px-3 text-slate-900">
              {aiOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <Textarea label="AI notları" value={form.ai_notes} onChange={(value) => update("ai_notes", value)} />
        </Section>
      </div>

      {editing && (
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => setEditing(false)} className="rounded-full border border-slate-200 px-5 py-3 text-sm font-black text-slate-700">Vazgeç</button>
          <button type="button" onClick={save} disabled={loading} className="rounded-full bg-cyan-500 px-5 py-3 text-sm font-black text-white shadow-sm disabled:opacity-60">{loading ? "Kaydediliyor..." : "Kaydet"}</button>
        </div>
      )}

      <div className="rounded-[16px] border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          {displaySetup.missing.length ? <XCircle className="mt-0.5 text-amber-700" size={18} /> : <CheckCircle2 className="mt-0.5 text-emerald-700" size={18} />}
          <p className="text-sm leading-6 text-amber-900">Token, API anahtarı, refresh token ve private key gibi secret değerleri bu ekranda açık saklanmaz. Sadece durum veya maskeli bilgi tutulur.</p>
        </div>
      </div>
    </div>
  );
}
