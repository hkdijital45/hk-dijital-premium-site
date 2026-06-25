"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, react-hooks/exhaustive-deps, @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, FileText, ImagePlus, Loader2, Palette, Trash2, UploadCloud } from "lucide-react";
import type { CustomerAssetType } from "@/lib/customer-assets";

type NotifyFn = (message: string, type?: "success" | "error" | "warning" | "info") => void;

type CustomerBrandAssetsProps = {
  company: any;
  content: any;
  setContent: (updater: any) => void;
  notify?: NotifyFn;
  mode?: "compact" | "full";
  setTab?: (tab: string) => void;
};

const defaultBranding = (company: any, saved: any = {}) => ({
  brand_name: saved.brand_name || company?.name || "",
  logo_url: saved.logo_url || "",
  logo_light_url: saved.logo_light_url || "",
  logo_dark_url: saved.logo_dark_url || "",
  primary_color: saved.primary_color || "#22d3ee",
  secondary_color: saved.secondary_color || "#2563eb",
  brand_accent_color: saved.brand_accent_color || "#f59e0b",
  brand_font_heading: saved.brand_font_heading || "Inter",
  brand_font_body: saved.brand_font_body || "Inter",
  social_profile_image_url: saved.social_profile_image_url || "",
  email_signature_html: saved.email_signature_html || "",
  letterhead_url: saved.letterhead_url || "",
  brand_notes: saved.brand_notes || "",
  welcome_text: saved.welcome_text || "Performans raporlarınız ve ajans çalışmalarınız burada.",
  report_title: saved.report_title || `${company?.name || "Müşteri"} Performans Raporu`,
  contact_phone: saved.contact_phone || company?.phone || "",
  contact_email: saved.contact_email || company?.email || "",
  contact_whatsapp: saved.contact_whatsapp || company?.phone || "",
  brand_assets: saved.brand_assets || {}
});

const assetLabels: Record<CustomerAssetType, string> = {
  logo: "Ana logo",
  logo_light: "Açık zemin logo",
  logo_dark: "Koyu zemin logo",
  favicon: "Favicon / küçük ikon",
  social_profile: "Profil fotoğrafı",
  social_cover: "Sosyal kapak görseli",
  instagram_profile: "Instagram profil görseli",
  facebook_cover: "Facebook kapak görseli",
  linkedin_cover: "LinkedIn kapak görseli",
  letterhead: "Antetli kağıt",
  business_card: "Kartvizit taslağı",
  brochure: "Broşür / PDF",
  proposal_document: "Teklif dokümanı",
  brand_document: "Kurumsal doküman"
};

const jsonKeyByAsset: Partial<Record<CustomerAssetType, string>> = {
  favicon: "favicon_url",
  social_cover: "social_cover_url",
  instagram_profile: "instagram_profile_image_url",
  facebook_cover: "facebook_cover_url",
  linkedin_cover: "linkedin_cover_url",
  business_card: "business_card_url",
  brochure: "brochure_url",
  proposal_document: "proposal_document_url",
  brand_document: "brand_document_url"
};

const imageAccept = "image/png,image/jpeg,image/jpg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg";
const documentAssetTypes = new Set<CustomerAssetType>(["letterhead", "business_card", "brochure", "proposal_document", "brand_document"]);
const allowedImageTypes = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"]);
const allowedImageExtensions = new Set(["png", "jpg", "jpeg", "webp", "svg"]);

function assetUrl(branding: any, assetType: CustomerAssetType) {
  if (assetType === "logo") return branding.logo_url || "";
  if (assetType === "logo_light") return branding.logo_light_url || "";
  if (assetType === "logo_dark") return branding.logo_dark_url || "";
  if (assetType === "social_profile") return branding.social_profile_image_url || "";
  if (assetType === "letterhead") return branding.letterhead_url || "";
  const key = jsonKeyByAsset[assetType];
  return key ? branding.brand_assets?.[key] || "" : "";
}

function isImageUrl(url: string) {
  return /\.(png|jpe?g|webp|svg)(\?|$)/i.test(url);
}

function updateBrandingInContent(setContent: CustomerBrandAssetsProps["setContent"], companyId: string, branding: any) {
  setContent((current: any) => ({
    ...current,
    customerBranding: (current.customerBranding || []).some((item: any) => item.company_id === companyId)
      ? (current.customerBranding || []).map((item: any) => item.company_id === companyId ? branding : item)
      : [branding, ...(current.customerBranding || [])]
  }));
}

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="grid gap-1 text-sm font-bold text-slate-700">
      {label}
      <input
        type={type}
        value={value || ""}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-950 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
      />
    </label>
  );
}

function AssetUploadCard({ assetType, branding, companyId, onUploaded, notify, compact = false }: { assetType: CustomerAssetType; branding: any; companyId: string; onUploaded: (branding: any) => void; notify?: NotifyFn; compact?: boolean }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const url = assetUrl(branding, assetType);
  const isImage = isImageUrl(url);
  const acceptsDocuments = documentAssetTypes.has(assetType);
  const acceptValue = acceptsDocuments ? `${imageAccept},application/pdf,.pdf` : imageAccept;

  function isSupportedFile(file: File) {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (allowedImageTypes.has(file.type) || allowedImageExtensions.has(ext)) return true;
    return acceptsDocuments && (file.type === "application/pdf" || ext === "pdf");
  }

  async function upload(file: File | null) {
    if (!file) return;
    if (!isSupportedFile(file)) {
      notify?.("Logo yüklenemedi. PNG, JPG, JPEG, WEBP veya güvenli SVG dosyası seçin.", "error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      notify?.("Logo yüklenemedi. Dosya formatını ve boyutunu kontrol edin.", "error");
      return;
    }
    setUploading(true);
    setProgress(20);
    try {
      const form = new FormData();
      form.append("assetType", assetType);
      form.append("file", file);
      form.append("previousUrl", url || "");
      setProgress(55);
      const response = await fetch(`/api/admin/customers/${companyId}/assets`, { method: "POST", body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.branding) throw new Error(data.detail || data.error || "Logo yüklenemedi.");
      setProgress(100);
      onUploaded(data.branding);
      notify?.(assetType === "logo" ? "Logo başarıyla yüklendi." : "Marka dosyası başarıyla yüklendi.", "success");
    } catch (error) {
      notify?.(error instanceof Error ? error.message : "Logo yüklenemedi. Dosya formatını ve boyutunu kontrol edin.", "error");
    } finally {
      setTimeout(() => {
        setUploading(false);
        setProgress(0);
      }, 450);
    }
  }

  async function remove() {
    if (!url) return;
    setUploading(true);
    try {
      const response = await fetch(`/api/admin/customers/${companyId}/assets`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetType, url })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.branding) throw new Error(data.detail || data.error || "Dosya kaldırılamadı.");
      onUploaded(data.branding);
      notify?.("Marka dosyası kaldırıldı.", "success");
    } catch (error) {
      notify?.(error instanceof Error ? error.message : "Dosya kaldırılamadı.", "error");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        upload(event.dataTransfer.files?.[0] || null);
      }}
      className={`rounded-[18px] border bg-white p-4 transition ${dragging ? "border-cyan-400 ring-4 ring-cyan-100" : "border-slate-200"} ${compact ? "" : "shadow-[0_8px_30px_rgba(15,23,42,.05)]"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-slate-950">{assetLabels[assetType]}</p>
          <p className="mt-1 text-xs text-slate-500">PNG, JPG, JPEG, WEBP ve güvenli SVG desteklenir. En fazla 5 MB.</p>
        </div>
        <UploadCloud className="h-5 w-5 text-cyan-600" />
      </div>
      <div className="mt-4 flex min-h-28 items-center justify-center overflow-hidden rounded-[14px] border border-dashed border-slate-200 bg-slate-50 p-3">
        {url ? (
          isImage ? <img src={url} alt={assetLabels[assetType]} className="max-h-24 max-w-full object-contain" /> : <div className="flex items-center gap-2 text-sm font-bold text-slate-600"><FileText className="h-5 w-5" /> Dosya yüklendi</div>
        ) : (
          <div className="text-center text-sm font-semibold text-slate-500">
            <ImagePlus className="mx-auto mb-2 h-7 w-7 text-slate-400" />
            {assetType === "logo" ? "Henüz logo yüklenmedi" : "Henüz dosya yüklenmedi"}
          </div>
        )}
      </div>
      {uploading && (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-cyan-500 transition-all" style={{ width: `${progress || 35}%` }} />
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <input ref={inputRef} type="file" accept={acceptValue} className="hidden" onChange={(event) => upload(event.target.files?.[0] || null)} />
        <button type="button" disabled={uploading} onClick={() => inputRef.current?.click()} className="rounded-[12px] bg-cyan-500 px-3 py-2 text-xs font-black text-white transition hover:-translate-y-0.5 disabled:opacity-50">
          {uploading ? <span className="inline-flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Yükleniyor</span> : url ? "Dosyayı değiştir" : "Dosya seç"}
        </button>
        {url && <button type="button" disabled={uploading} onClick={remove} className="rounded-[12px] border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 disabled:opacity-50"><Trash2 className="mr-1 inline h-3 w-3" /> Kaldır</button>}
      </div>
      {url && (
        <details className="mt-3 text-xs text-slate-500">
          <summary className="cursor-pointer font-bold text-slate-600">Teknik bilgi</summary>
          <p className="mt-2 break-all rounded-[10px] bg-slate-50 p-2">{url}</p>
        </details>
      )}
    </div>
  );
}

export function CustomerBrandAssets({ company, content, setContent, notify, mode = "full", setTab }: CustomerBrandAssetsProps) {
  const savedBranding = useMemo(() => (content.customerBranding || []).find((item: any) => item.company_id === company.id) || {}, [content.customerBranding, company.id]);
  const [draft, setDraft] = useState(defaultBranding(company, savedBranding));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(defaultBranding(company, savedBranding));
  }, [company.id, savedBranding.id, savedBranding.updated_at]);

  const updateDraft = (patch: Record<string, unknown>) => setDraft((current) => ({ ...current, ...patch }));
  const updateBrandAssets = (patch: Record<string, unknown>) => updateDraft({ brand_assets: { ...(draft.brand_assets || {}), ...patch } });

  function handleBrandingUpdate(branding: any) {
    setDraft(defaultBranding(company, branding));
    updateBrandingInContent(setContent, company.id, branding);
  }

  async function saveBranding() {
    if (!draft.brand_name.trim()) {
      notify?.("Panel marka adı zorunludur.", "warning");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/admin/customer-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: company.id,
          company: {
            name: company.name || draft.brand_name,
            phone: company.phone || draft.contact_phone,
            email: company.email || draft.contact_email,
            website: company.website || "",
            lifecycle_stage: company.lifecycle_stage || "Onboarding"
          },
          branding: draft,
          onboardingData: {},
          complete: Boolean(savedBranding.onboarding_completed_at)
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.branding) throw new Error(data.detail || data.error || "Marka varlıkları kaydedilemedi.");
      handleBrandingUpdate(data.branding);
      notify?.("Marka varlıkları kaydedildi.", "success");
    } catch (error) {
      notify?.(error instanceof Error ? error.message : "Marka varlıkları kaydedilemedi.", "error");
    } finally {
      setSaving(false);
    }
  }

  const previewLogo = draft.logo_url;
  const initials = String(draft.brand_name || company.name || "HK").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  if (mode === "compact") {
    return (
      <div className="grid gap-4 rounded-[18px] border border-slate-200 bg-white p-4 shadow-[0_8px_30px_rgba(15,23,42,.04)] lg:grid-cols-[1fr_1.1fr]">
        <AssetUploadCard assetType="logo" branding={draft} companyId={company.id} onUploaded={handleBrandingUpdate} notify={notify} compact />
        <div className="grid gap-4">
          <div className="rounded-[16px] border border-cyan-100 bg-cyan-50 p-4">
            <p className="text-sm font-black text-slate-950">Müşteri Logosu ve Marka Renkleri</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">Logo burada yüklendiğinde Marka Varlıkları sekmesi, müşteri paneli ve rapor görünümü aynı kaydı kullanır.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Ana renk" type="color" value={draft.primary_color} onChange={(primary_color) => updateDraft({ primary_color })} />
            <Field label="İkincil renk" type="color" value={draft.secondary_color} onChange={(secondary_color) => updateDraft({ secondary_color })} />
            <Field label="Vurgu rengi" type="color" value={draft.brand_accent_color} onChange={(brand_accent_color) => updateDraft({ brand_accent_color })} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={saveBranding} disabled={saving} className="rounded-[12px] bg-blue-600 px-4 py-2 text-xs font-black text-white disabled:opacity-50">{saving ? "Kaydediliyor..." : "Marka ayarlarını kaydet"}</button>
            <button type="button" onClick={() => setTab?.("Marka Varlıkları")} className="rounded-[12px] border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700">Marka Varlıkları sekmesine git</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="grid gap-5">
        <section className="rounded-[18px] border border-cyan-200 bg-cyan-50 p-5">
          <h3 className="text-lg font-black text-slate-950">Marka Varlıkları</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Logo seti, marka renkleri, font bilgileri, sosyal medya görselleri ve raporlarda kullanılacak kurumsal dokümanları bu müşteriye özel yönetin.</p>
        </section>

        <section className="grid gap-4">
          <h4 className="text-base font-black text-slate-950">Logo Seti</h4>
          <div className="grid gap-4 lg:grid-cols-2">
            {(["logo", "logo_light", "logo_dark", "favicon"] as CustomerAssetType[]).map((type) => <AssetUploadCard key={type} assetType={type} branding={draft} companyId={company.id} onUploaded={handleBrandingUpdate} notify={notify} />)}
          </div>
        </section>

        <section className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,.05)]">
          <div className="mb-4 flex items-center gap-2"><Palette className="h-5 w-5 text-cyan-600" /><h4 className="text-base font-black text-slate-950">Marka Renkleri ve Fontlar</h4></div>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Ana renk" type="color" value={draft.primary_color} onChange={(primary_color) => updateDraft({ primary_color })} />
            <Field label="İkincil renk" type="color" value={draft.secondary_color} onChange={(secondary_color) => updateDraft({ secondary_color })} />
            <Field label="Vurgu rengi" type="color" value={draft.brand_accent_color} onChange={(brand_accent_color) => updateDraft({ brand_accent_color })} />
            <Field label="Başlık fontu" value={draft.brand_font_heading} onChange={(brand_font_heading) => updateDraft({ brand_font_heading })} />
            <Field label="Gövde fontu" value={draft.brand_font_body} onChange={(brand_font_body) => updateDraft({ brand_font_body })} />
            <Field label="Rapor başlığı" value={draft.report_title} onChange={(report_title) => updateDraft({ report_title })} />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[draft.primary_color, draft.secondary_color, draft.brand_accent_color].map((color, index) => <div key={`${color}-${index}`} className="rounded-[14px] border border-slate-200 bg-slate-50 p-3"><div className="h-12 rounded-[10px]" style={{ backgroundColor: color }} /><p className="mt-2 text-xs font-black text-slate-700">{color}</p></div>)}
          </div>
        </section>

        <section className="grid gap-4">
          <h4 className="text-base font-black text-slate-950">Sosyal Medya Varlıkları</h4>
          <div className="grid gap-4 lg:grid-cols-2">
            {(["social_profile", "social_cover", "instagram_profile", "facebook_cover", "linkedin_cover"] as CustomerAssetType[]).map((type) => <AssetUploadCard key={type} assetType={type} branding={draft} companyId={company.id} onUploaded={handleBrandingUpdate} notify={notify} />)}
          </div>
        </section>

        <section className="grid gap-4">
          <h4 className="text-base font-black text-slate-950">Kurumsal Dokümanlar</h4>
          <div className="grid gap-4 lg:grid-cols-2">
            {(["letterhead", "business_card", "brochure", "proposal_document", "brand_document"] as CustomerAssetType[]).map((type) => <AssetUploadCard key={type} assetType={type} branding={draft} companyId={company.id} onUploaded={handleBrandingUpdate} notify={notify} />)}
          </div>
        </section>

        <section className="grid gap-4 rounded-[18px] border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,.05)]">
          <h4 className="text-base font-black text-slate-950">E-posta İmzası ve Marka Notları</h4>
          <label className="grid gap-1 text-sm font-bold text-slate-700">E-posta imzası HTML / metin
            <textarea value={draft.email_signature_html} onChange={(event) => updateDraft({ email_signature_html: event.target.value })} rows={5} className="rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-950 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100" />
          </label>
          <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-black text-slate-950">İmza önizleme</p>
              <button type="button" onClick={() => navigator.clipboard?.writeText(draft.email_signature_html || "")} className="rounded-[10px] border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700"><Copy className="mr-1 inline h-3 w-3" /> Kopyala</button>
            </div>
            <div className="min-h-16 rounded-[12px] bg-white p-3 text-sm text-slate-700" dangerouslySetInnerHTML={{ __html: draft.email_signature_html || "Henüz e-posta imzası girilmedi." }} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Ses tonu" value={draft.brand_assets?.voice_tone || ""} onChange={(voice_tone) => updateBrandAssets({ voice_tone })} placeholder="Örn. güven veren, sade, profesyonel" />
            <Field label="Kullanılacak CTA'lar" value={draft.brand_assets?.preferred_ctas || ""} onChange={(preferred_ctas) => updateBrandAssets({ preferred_ctas })} placeholder="Örn. Randevu Al, Teklif İste" />
            <Field label="Yasaklı kelimeler" value={draft.brand_assets?.forbidden_words || ""} onChange={(forbidden_words) => updateBrandAssets({ forbidden_words })} />
            <Field label="Kampanya dili" value={draft.brand_assets?.campaign_language || ""} onChange={(campaign_language) => updateBrandAssets({ campaign_language })} />
          </div>
          <label className="grid gap-1 text-sm font-bold text-slate-700">Özel müşteri notları
            <textarea value={draft.brand_notes} onChange={(event) => updateDraft({ brand_notes: event.target.value })} rows={4} className="rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-950 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100" />
          </label>
        </section>

        <div className="flex justify-end">
          <button type="button" disabled={saving} onClick={saveBranding} className="rounded-[14px] bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 disabled:opacity-50">{saving ? "Kaydediliyor..." : "Marka Varlıklarını Kaydet"}</button>
        </div>
      </div>

      <aside className="h-fit rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,.06)] xl:sticky xl:top-4">
        <p className="text-sm font-black text-slate-950">Canlı Marka Önizleme</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">Müşteri paneli, rapor ve tekliflerde kullanılacak temel görünüm.</p>
        <div className="mt-4 rounded-[18px] border border-slate-200 p-4" style={{ borderTop: `5px solid ${draft.primary_color}` }}>
          <div className="flex items-center gap-3">
            {previewLogo ? <img src={previewLogo} alt={`${draft.brand_name} logosu`} className="h-12 max-w-[150px] rounded-[8px] object-contain" /> : <div className="grid h-12 w-12 place-items-center rounded-[14px] text-sm font-black text-white" style={{ backgroundColor: draft.primary_color }}>{initials}</div>}
            <div>
              <h4 className="font-black text-slate-950" style={{ fontFamily: draft.brand_font_heading }}>{draft.brand_name || company.name}</h4>
              <p className="text-xs text-slate-500">{draft.report_title}</p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-600" style={{ fontFamily: draft.brand_font_body }}>{draft.welcome_text}</p>
          <button type="button" className="mt-4 rounded-[12px] px-4 py-2 text-xs font-black text-white" style={{ backgroundColor: draft.brand_accent_color }}>Örnek aksiyon</button>
        </div>
        <div className="mt-4 rounded-[18px] bg-slate-50 p-4">
          <p className="text-xs font-black uppercase tracking-[.18em] text-slate-500">Örnek sosyal kart</p>
          <h5 className="mt-2 font-black text-slate-950">Kampanya duyurusu</h5>
          <p className="mt-2 text-sm text-slate-600">Marka renkleri ve notları kreatif üretim, rapor ve müşteri özeti alanlarında referans alınır.</p>
          <div className="mt-3 h-2 rounded-full" style={{ background: `linear-gradient(90deg, ${draft.primary_color}, ${draft.secondary_color}, ${draft.brand_accent_color})` }} />
        </div>
      </aside>
    </div>
  );
}
