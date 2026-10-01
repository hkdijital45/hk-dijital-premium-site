"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Bot, CheckCircle2, ExternalLink, Globe2, Search, ShieldCheck, XCircle } from "lucide-react";
import { buildCustomerSetupSummary, getCustomerSetupSteps, type CustomerSetupSummary } from "@/lib/customer-onboarding";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminStatusBadge, type AdminStatusTone } from "@/components/admin/ui/AdminStatusBadge";

type HkConnectMetaIdentity = {
  companyId: string; connected: boolean;
  businessId: string | null; adAccountId: string | null; pageId: string | null; instagramBusinessId: string | null;
  pixelAvailable: false; datasetAvailable: false;
  tokenStatus: "not_connected" | "connected" | "expired";
  lastSyncedAt: string | null;
  multipleAdAccounts: boolean; multiplePages: boolean; multipleInstagramAccounts: boolean;
};

function assetTone(value: string | null): AdminStatusTone {
  return value ? "success" : "neutral";
}
function assetLabel(value: string | null): string {
  return value ? "BAĞLI" : "BAĞLANTI YOK";
}
function fmtSyncDate(value: string | null) {
  if (!value) return "Bilgi yok";
  try { return new Date(value).toLocaleString("tr-TR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return "Bilgi yok"; }
}

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
    <label className="grid gap-2 text-sm font-semibold text-[var(--admin-text-secondary)]">
      {label}
      <input value={value || ""} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="min-h-11 rounded-[10px] border border-[var(--admin-border)] bg-[var(--admin-surface-soft)] px-3 text-[var(--admin-text-primary)] placeholder:text-slate-400" />
    </label>
  );
}

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-[var(--admin-text-secondary)]">
      {label}
      <textarea rows={4} value={value || ""} onChange={(event) => onChange(event.target.value)} className="rounded-[10px] border border-[var(--admin-border)] bg-[var(--admin-surface-soft)] px-3 py-3 text-[var(--admin-text-primary)]" />
    </label>
  );
}

function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-[10px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-[8px] bg-cyan-50 text-cyan-700">{icon}</span>
        <h3 className="text-xs font-black uppercase tracking-wide text-[var(--admin-text-primary)]">{title}</h3>
      </div>
      <div className="grid gap-2 md:grid-cols-2">{children}</div>
    </section>
  );
}

export function CustomerIntegrationsPanel({ company, users = [], campaigns = [], reports = [], content, setContent, notify }: any) {
  const localIntegration = (content?.customerIntegrations || []).find((item: any) => item.company_id === company.id) || {};
  const [form, setForm] = useState<Record<string, string>>({ ...emptyIntegration, ...localIntegration });
  const onboardingContext = useMemo(() => ({ branches: content?.customerBranches || [], tasks: content?.agencyTasks || [] }), [content?.customerBranches, content?.agencyTasks]);
  const [setup, setSetup] = useState<CustomerSetupSummary>(() => buildCustomerSetupSummary(getCustomerSetupSteps(company, users, form, campaigns, reports, onboardingContext)));
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [hkConnectIdentity, setHkConnectIdentity] = useState<HkConnectMetaIdentity | null>(null);
  const [hkConnectBusy, setHkConnectBusy] = useState<"fetch" | "verify" | null>(null);
  const [hkConnectMessage, setHkConnectMessage] = useState("");

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
        setSetup(payload.setup || buildCustomerSetupSummary(getCustomerSetupSteps(company, users, next, campaigns, reports, onboardingContext)));
      } catch {
        const steps = getCustomerSetupSteps(company, users, localIntegration, campaigns, reports, onboardingContext);
        if (mounted) setSetup(buildCustomerSetupSummary(steps));
      }
    }
    load();
    return () => {
      mounted = false;
    };
    // Refetch only when the active customer changes; mutable editor props must not restart the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id]);

  const liveSetup = useMemo(() => buildCustomerSetupSummary(getCustomerSetupSteps(company, users, form, campaigns, reports, onboardingContext)), [company, users, form, campaigns, reports, onboardingContext]);
  const displaySetup = setup?.progress === liveSetup.progress ? setup : liveSetup;

  function update(key: string, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function fetchHkConnectIdentity(): Promise<HkConnectMetaIdentity | null> {
    const response = await fetch(`/api/admin/customers/${company.id}/hk-connect-meta`, { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "HK Connect bağlantı bilgisi alınamadı.");
    return payload.identity || null;
  }

  async function importFromHkConnect() {
    setHkConnectBusy("fetch");
    setHkConnectMessage("");
    try {
      const identity = await fetchHkConnectIdentity();
      setHkConnectIdentity(identity);
      if (!identity || !identity.connected) {
        setHkConnectMessage("Bu müşteri için HK Connect Meta bağlantısı bulunamadı.");
        return;
      }
      const found: string[] = [];
      const missing: string[] = [];
      const apply = (key: string, value: string | null, label: string) => {
        if (value) { update(key, value); found.push(label); } else { missing.push(label); }
      };
      apply("meta_business_id", identity.businessId, "Business ID");
      apply("meta_ad_account_id", identity.adAccountId, "Ad Account ID");
      apply("meta_page_id", identity.pageId, "Page ID");
      apply("instagram_business_id", identity.instagramBusinessId, "Instagram Business ID");
      if (identity.tokenStatus !== "not_connected") {
        update("meta_access_token_masked", identity.tokenStatus === "expired" ? "Süresi Dolmuş" : "Geçerli");
        found.push("Token durumu");
      }
      setEditing(true);
      const ambiguityNote = identity.multipleAdAccounts || identity.multiplePages || identity.multipleInstagramAccounts
        ? " Birden fazla bağlı hesap bulundu; ilk eşleşen kullanıldı."
        : "";
      setHkConnectMessage(
        missing.length
          ? `Bağlantı bulundu ancak bazı Meta kimlikleri mevcut değil (eksik: ${missing.join(", ")}).${ambiguityNote}`
          : `HK Connect Meta bilgileri getirildi (${found.join(", ")}). Değişiklikleri kaydederek müşteri profiline uygulayabilirsiniz.${ambiguityNote}`
      );
    } catch (error) {
      setHkConnectMessage(error instanceof Error ? error.message : "HK Connect bağlantı bilgisi alınamadı.");
    } finally {
      setHkConnectBusy(null);
    }
  }

  async function verifyHkConnect() {
    setHkConnectBusy("verify");
    setHkConnectMessage("");
    try {
      const identity = await fetchHkConnectIdentity();
      setHkConnectIdentity(identity);
      setHkConnectMessage(identity?.connected ? "HK Connect Meta bağlantısı doğrulandı." : "Bu müşteri için HK Connect Meta bağlantısı bulunamadı.");
    } catch (error) {
      setHkConnectMessage(error instanceof Error ? error.message : "HK Connect bağlantı bilgisi alınamadı.");
    } finally {
      setHkConnectBusy(null);
    }
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
    <div className="grid gap-3">
      <section className="rounded-[10px] border border-cyan-200 bg-cyan-50 p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.14em] text-cyan-700">Müşteri Kurulum Durumu</p>
            <h3 className="mt-1 text-lg font-black text-[var(--admin-text-primary)]">%{displaySetup.progress} tamamlandı</h3>
            <p className="mt-0.5 text-xs font-semibold text-cyan-900">{displaySetup.completedSteps} / {displaySetup.totalSteps} adım tamamlandı.</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <AdminButton compact variant="info" onClick={() => setEditing((current) => !current)}>{editing ? "Düzenlemeyi Kapat" : "Düzenle"}</AdminButton>
            <AdminButton compact variant="secondary" disabled={loading} onClick={testIntegrations}>Test Et</AdminButton>
            <a href={`/hk-admin/website-analytics?companyId=${company.id}`} className="hk-button hk-button-neutral hk-button-compact">Website Analytics</a>
            <a href={`/hk-admin/agent-hub?companyId=${company.id}`} className="hk-button hk-button-ai hk-button-compact">Agent Hub</a>
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--admin-surface)]">
          <div className="h-full rounded-full bg-cyan-500" style={{ width: `${displaySetup.progress}%` }} />
        </div>
        {message && <p className="mt-3 rounded-[8px] border border-cyan-200 bg-[var(--admin-surface)] p-2 text-xs font-semibold text-cyan-900">{message}</p>}
      </section>

      <section className="admin-data-grid-scroll premium-scrollbar">
        <table className="admin-data-grid">
          <thead><tr><th>Entegrasyon</th><th>Açıklama</th><th style={{ textAlign: "center" }}>Durum</th><th style={{ textAlign: "right" }}>Hızlı Aksiyon</th></tr></thead>
          <tbody>
            {displaySetup.steps.map((item) => (
              <tr key={item.key}>
                <td><strong>{item.title}</strong></td>
                <td className="text-xs" style={{ color: "var(--admin-text-muted)" }}>{item.description}</td>
                <td style={{ textAlign: "center" }}><span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${statusClass(item.status)}`}>{statusLabel(item.status)}</span></td>
                <td style={{ textAlign: "right" }}><a href={item.actionHref} className="inline-flex items-center gap-1 text-xs font-black text-cyan-700">{item.actionLabel} <ExternalLink size={12} /></a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="Web Sitesi" icon={<Globe2 size={18} />}>
          <Input label="Domain" value={form.domain} onChange={(value) => update("domain", value)} placeholder="example.com" />
          <Input label="Website URL" value={form.website_url} onChange={(value) => update("website_url", value)} placeholder="https://example.com" />
          <label className="grid gap-2 text-sm font-semibold text-[var(--admin-text-secondary)]">CMS / altyapı
            <select disabled={!editing} value={form.cms_provider || ""} onChange={(event) => update("cms_provider", event.target.value)} className="min-h-11 rounded-[10px] border border-[var(--admin-border)] bg-[var(--admin-surface-soft)] px-3 text-[var(--admin-text-primary)]">
              <option value="">Seçin</option>
              {cmsOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <Textarea label="Hosting notu" value={form.hosting_notes} onChange={(value) => update("hosting_notes", value)} />
        </Section>

        <Section title="Meta" icon={<ShieldCheck size={18} />}>
          <div className="rounded-[10px] border border-[var(--admin-border)] bg-[var(--admin-surface-soft)] p-3 md:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-black uppercase tracking-wide text-[var(--admin-text-primary)]">HK Connect Meta Bağlantısı — {company.name || company.company_name}</h4>
              <div className="flex flex-wrap gap-1.5">
                <AdminButton compact variant="info" loading={hkConnectBusy === "fetch"} onClick={importFromHkConnect}>HK Connect&apos;ten Getir</AdminButton>
                <AdminButton compact variant="secondary" loading={hkConnectBusy === "verify"} onClick={verifyHkConnect}>Bağlantıyı Doğrula</AdminButton>
              </div>
            </div>
            {hkConnectIdentity && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                <AdminStatusBadge tone={assetTone(hkConnectIdentity.pageId)}>Facebook Page: {assetLabel(hkConnectIdentity.pageId)}</AdminStatusBadge>
                <AdminStatusBadge tone={assetTone(hkConnectIdentity.instagramBusinessId)}>Instagram: {assetLabel(hkConnectIdentity.instagramBusinessId)}</AdminStatusBadge>
                <AdminStatusBadge tone={assetTone(hkConnectIdentity.adAccountId)}>Meta Ads: {assetLabel(hkConnectIdentity.adAccountId)}</AdminStatusBadge>
                <AdminStatusBadge tone={assetTone(hkConnectIdentity.businessId)}>Business: {assetLabel(hkConnectIdentity.businessId)}</AdminStatusBadge>
                <AdminStatusBadge tone="neutral">Pixel: BULUNAMADI</AdminStatusBadge>
                <AdminStatusBadge tone="neutral">Dataset: BULUNAMADI</AdminStatusBadge>
              </div>
            )}
            {hkConnectIdentity?.lastSyncedAt && <p className="mt-2 text-xs text-[var(--admin-text-secondary)]">Son senkronizasyon: {fmtSyncDate(hkConnectIdentity.lastSyncedAt)}</p>}
            {hkConnectMessage && <p className="mt-2 rounded-[8px] bg-[var(--admin-surface)] p-2 text-xs font-semibold text-[var(--admin-text-primary)]">{hkConnectMessage}</p>}
          </div>
          <Input label="Meta Business ID" value={form.meta_business_id} onChange={(value) => update("meta_business_id", value)} />
          <Input label="Meta Ad Account ID" value={form.meta_ad_account_id} onChange={(value) => update("meta_ad_account_id", value)} />
          <Input label="Meta Pixel ID" value={form.meta_pixel_id} onChange={(value) => update("meta_pixel_id", value)} />
          <Input label="Meta Dataset ID (veri seti kimliği)" value={form.meta_dataset_id} onChange={(value) => update("meta_dataset_id", value)} />
          <Input label="Meta Page ID" value={form.meta_page_id} onChange={(value) => update("meta_page_id", value)} />
          <Input label="Instagram Business ID" value={form.instagram_business_id} onChange={(value) => update("instagram_business_id", value)} />
          <Input label="Meta Access Token durumu" value={form.meta_access_token_masked} onChange={(value) => update("meta_access_token_masked", value)} placeholder="Tanımlı / Eksik / Maskeli" />
          <p className="rounded-[12px] bg-[var(--admin-surface-soft)] p-3 text-xs leading-5 text-[var(--admin-text-secondary)] md:col-span-2">Dataset ID, Events Manager &gt; Data Sources &gt; Pixel/Dataset &gt; Settings alanından alınır. Gerçek token bu ekranda saklanmaz.</p>
        </Section>

        <Section title="Google" icon={<Search size={18} />}>
          <Input label="GA4 Measurement ID" value={form.ga4_measurement_id} onChange={(value) => update("ga4_measurement_id", value)} placeholder="G-XXXXXXXXXX" />
          <Input label="GA4 Property ID (Google Analytics mülk kimliği)" value={form.ga4_property_id} onChange={(value) => update("ga4_property_id", value)} />
          <Input label="Google Ads Customer ID" value={form.google_ads_customer_id} onChange={(value) => update("google_ads_customer_id", value)} />
          <Input label="Search Console Site URL" value={form.search_console_site_url} onChange={(value) => update("search_console_site_url", value)} placeholder="https://example.com/" />
          <Input label="GTM Container ID (etiket yöneticisi)" value={form.gtm_container_id} onChange={(value) => update("gtm_container_id", value)} placeholder="GTM-XXXXXXX" />
          <Input label="Google servis hesabı e-posta" value={form.google_service_account_email} onChange={(value) => update("google_service_account_email", value)} />
          <Input label="Google servis hesabı durumu" value={form.google_service_account_status} onChange={(value) => update("google_service_account_status", value)} />
          <p className="rounded-[12px] bg-[var(--admin-surface-soft)] p-3 text-xs leading-5 text-[var(--admin-text-secondary)] md:col-span-2">Private key müşteri profilinde gösterilmez. GA4 ve Search Console yetkisi servis hesabı maili üzerinden verilir.</p>
        </Section>

        <Section title="Davranış Analitiği + AI" icon={<Bot size={18} />}>
          <Input label="Microsoft Clarity Project ID" value={form.clarity_project_id} onChange={(value) => update("clarity_project_id", value)} />
          <Input label="Hotjar Site ID" value={form.hotjar_site_id} onChange={(value) => update("hotjar_site_id", value)} />
          <label className="grid gap-2 text-sm font-semibold text-[var(--admin-text-secondary)]">Müşteri bazlı AI modu
            <select disabled={!editing} value={form.preferred_ai_provider || "auto"} onChange={(event) => update("preferred_ai_provider", event.target.value)} className="min-h-11 rounded-[10px] border border-[var(--admin-border)] bg-[var(--admin-surface-soft)] px-3 text-[var(--admin-text-primary)]">
              {aiOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <Textarea label="AI notları" value={form.ai_notes} onChange={(value) => update("ai_notes", value)} />
        </Section>
      </div>

      {editing && (
        <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t bg-[var(--admin-surface)]/95 py-2" style={{ borderColor: "var(--admin-border)" }}>
          <AdminButton compact variant="secondary" onClick={() => setEditing(false)}>Vazgeç</AdminButton>
          <AdminButton compact variant="primary" disabled={loading} onClick={save}>{loading ? "Kaydediliyor..." : "Kaydet"}</AdminButton>
        </div>
      )}

      <div className="rounded-[8px] border border-amber-200 bg-amber-50 p-2.5">
        <div className="flex items-start gap-2">
          {displaySetup.missing.length ? <XCircle className="mt-0.5 shrink-0 text-amber-700" size={14} /> : <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-700" size={14} />}
          <p className="text-xs leading-5 text-amber-900">Token, API anahtarı, refresh token ve private key gibi secret değerleri bu ekranda açık saklanmaz. Sadece durum veya maskeli bilgi tutulur.</p>
        </div>
      </div>
    </div>
  );
}
