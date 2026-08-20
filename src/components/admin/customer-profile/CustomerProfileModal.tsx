"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { ActionResultPanel } from "@/components/admin/ActionResultPanel";
import type { ActionResult } from "@/lib/action-result";
import { CUSTOMER_MODULE_REGISTRY, CUSTOMER_PLATFORM_REGISTRY, DEFAULT_CUSTOMER_MODULES, normalizeModuleKeys, normalizePlatformKeys } from "@/lib/customer-portal-registry";
import { formatTurkishPhone, isEmptyLikeValue, normalizePhoneInput } from "@/lib/phone-format";
import { CUSTOMER_360_TABS, Customer360Header } from "./customer360-shared";
import { AdminTabs } from "@/components/admin/ui/AdminTabs";

const paidStatuses = ["Ödendi", "Tahsil Edildi"];

function isArchived(item: any) {
  return Boolean(item?.deleted_at || item?.archived_at || item?.status === "Arşivli" || item?.status === "Silindi");
}

function defaultHealth(company: any, content: any) {
  const today = new Date().toISOString().slice(0, 10);
  const payments = (content?.paymentRecords || []).filter((item: any) => item.company_id === company?.id && !isArchived(item));
  const tasks = (content?.agencyTasks || []).filter((item: any) => item.company_id === company?.id && !isArchived(item));
  const reports = (content?.reports || []).filter((item: any) => item.company_id === company?.id && !isArchived(item));
  const integrations = (content?.customerIntegrations || []).find((item: any) => item.company_id === company?.id) || {};
  const overduePayments = payments.filter((item: any) => !paidStatuses.includes(item.status) && item.due_date && item.due_date < today);
  const overdueTasks = tasks.filter((item: any) => !["Tamamlandı", "İptal"].includes(item.status) && item.due_date && item.due_date < today);
  let score = 100;
  const reasons: string[] = [];
  if (overduePayments.length) { score -= 22; reasons.push(`${overduePayments.length} tahsilat gecikmiş.`); }
  if (overdueTasks.length) { score -= 16; reasons.push(`${overdueTasks.length} görev gecikmiş.`); }
  if (!reports.length) { score -= 8; reasons.push("Rapor kaydı bulunamadı."); }
  if (!integrations.meta_pixel_id && !integrations.ga4_measurement_id) { score -= 12; reasons.push("Pixel/GA4 kurulum bilgisi eksik."); }
  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, status: score >= 75 ? "Sağlıklı" : score >= 50 ? "Riskli" : "Kritik", reasons: reasons.length ? reasons : ["Operasyon sinyalleri düzenli."] };
}

function integrationSummary(company: any, content: any) {
  return (content?.customerIntegrations || []).find((item: any) => item.company_id === company?.id) || {};
}

function packageApplications(company: any, content: any) {
  return (content?.hkMarketplacePackageApplications || content?.marketplacePackageApplications || [])
    .filter((item: any) => item.company_id === company?.id)
    .sort((a: any, b: any) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
}

function customerBranches(company: any, content: any) {
  return (content?.customerBranches || [])
    .filter((item: any) => item.company_id === company?.id && !isArchived(item))
    .sort((a: any, b: any) => String(a.branch_name || "").localeCompare(String(b.branch_name || ""), "tr"));
}

function packageTitle(application: any) {
  return application?.result_summary?.packageName || application?.created_records?.packageName || application?.package_name || "Hazır paket";
}

function countFromSummary(application: any, key: string) {
  return Number(application?.result_summary?.[key] || 0);
}

function applicationStatus(status: string) {
  return status === "applied" ? "Uygulandı" : status === "failed" ? "Hata" : status || "Uygulandı";
}

function SummaryBox({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="rounded-[18px] border border-[var(--admin-border)] bg-[var(--admin-surface-soft)] p-4">
      <h3 className="font-black text-[var(--admin-text-primary)]">{title}</h3>
      <div className="mt-3 grid gap-1 text-sm text-[var(--admin-text-secondary)]">
        {lines.map((line) => <span key={line}>{line}</span>)}
      </div>
    </div>
  );
}

const emptyBranchForm = {
  branch_name: "",
  city: "",
  district: "",
  address: "",
  phone: "",
  whatsapp: "",
  email: "",
  google_maps_url: "",
  website_url: "",
  landing_page_url: "",
  meta_ad_account_id: "",
  google_ads_customer_id: "",
  ga4_property_id: "",
  search_console_site_url: "",
  gtm_container_id: "",
  monthly_ad_budget: "",
  monthly_service_fee: "",
  responsible_person: "",
  status: "active",
  notes: ""
};

const editableProfileTabs = new Set(["Genel Bilgi", "İletişim", "Satış Durumu", "Müşteri Kurulumu", "Notlar"]);

function toProfileForm(company: any) {
  return {
    name: company?.name || "",
    sector: company?.sector || "",
    custom_sector: company?.custom_sector || company?.sector_other || "",
    city: company?.city || "",
    website: company?.website || "",
    instagram: company?.instagram || "",
    phone: formatTurkishPhone(company?.phone || ""),
    email: company?.email || "",
    status: company?.status || "Aktif",
    notes: company?.notes || "",
    contact_name: company?.contact_name || company?.authorized_person || "",
    sales_status: company?.sales_status || "",
    pipeline_stage: company?.pipeline_stage || company?.lifecycle_stage || "",
    last_contact_at: company?.last_contact_at ? String(company.last_contact_at).slice(0, 10) : "",
    next_action_at: company?.next_action_at ? String(company.next_action_at).slice(0, 10) : "",
    next_action: company?.next_action || "",
    follow_up_note: company?.follow_up_note || ""
  };
}

function profilePayload(form: Record<string, any>) {
  return {
    name: form.name,
    sector: form.custom_sector || form.sector,
    custom_sector: form.custom_sector,
    city: form.city,
    website: form.website,
    instagram: form.instagram,
    phone: normalizePhoneInput(form.phone),
    email: form.email,
    status: form.status,
    notes: form.notes,
    contact_name: form.contact_name,
    lifecycle_stage: form.pipeline_stage,
    sales_status: form.sales_status,
    pipeline_stage: form.pipeline_stage,
    last_contact_at: form.last_contact_at || null,
    next_action_at: form.next_action_at || null,
    next_action: form.next_action,
    follow_up_note: form.follow_up_note
  };
}

function FieldBox({ label, children, help }: { label: string; children: ReactNode; help?: string }) {
  return (
    <label className="grid gap-1 text-sm font-bold text-[var(--admin-text-secondary)]">
      {label}
      {children}
      {help && <span className="text-xs font-medium text-[var(--admin-text-muted)]">{help}</span>}
    </label>
  );
}

function TextInput({ value, onChange, type = "text", placeholder = "" }: { value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return <input type={type} value={value || ""} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="min-h-11 rounded-[12px] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-[var(--admin-text-primary)] outline-none focus:ring-2 focus:ring-cyan-300" />;
}

function TextBox({ value, onChange, placeholder = "" }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <textarea value={value || ""} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="min-h-24 rounded-[12px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3 text-[var(--admin-text-primary)] outline-none focus:ring-2 focus:ring-cyan-300" />;
}

function statusLabel(status: string, isActive?: boolean) {
  if (status === "passive" || isActive === false) return "Pasif";
  if (status === "needs_review") return "Kontrol gerekli";
  return "Aktif";
}

function toBranchForm(branch?: any) {
  return {
    ...emptyBranchForm,
    ...(branch || {}),
    phone: formatTurkishPhone(branch?.phone || ""),
    whatsapp: formatTurkishPhone(branch?.whatsapp || ""),
    monthly_ad_budget: branch?.monthly_ad_budget ? String(branch.monthly_ad_budget) : "",
    monthly_service_fee: branch?.monthly_service_fee ? String(branch.monthly_service_fee) : "",
    status: branch?.status || (branch?.is_active === false ? "passive" : "active")
  };
}

function branchDisplay(value: unknown) {
  return isEmptyLikeValue(value) ? "Mevcut değil" : String(value || "Mevcut değil");
}

function googleMapsTarget(branch: any) {
  if (branch?.google_maps_url) return String(branch.google_maps_url);
  const query = [branch?.address, branch?.district, branch?.city, branch?.branch_name].filter(Boolean).join(" ");
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : "";
}

export function CustomerProfileModal({
  company,
  content,
  health,
  onClose,
  onGo,
  children,
  showOverview = true
}: {
  company: any;
  content: any;
  health?: any;
  onClose: () => void;
  onGo?: (target: string, message?: string) => void;
  children?: ReactNode;
  showOverview?: boolean;
}) {
  const profileHealth = health || defaultHealth(company, content);
  const integration = integrationSummary(company, content);
  const integrationAssets = Array.isArray(integration?.integration_assets)
    ? integration.integration_assets
    : Array.isArray(integration?.assets)
      ? integration.assets
      : (content?.customerIntegrations || []).filter((item: any) => item.company_id === company?.id);
  const tasks = (content?.agencyTasks || []).filter((item: any) => item.company_id === company?.id);
  const reports = (content?.reports || []).filter((item: any) => item.company_id === company?.id);
  const payments = (content?.paymentRecords || []).filter((item: any) => item.company_id === company?.id);
  const campaigns = (content?.campaigns || []).filter((item: any) => item.company_id === company?.id);
  const applications = packageApplications(company, content);
  const today = new Date().toISOString().slice(0, 10);
  const overduePayments = payments.filter((item: any) => !paidStatuses.includes(item.status) && item.due_date && item.due_date < today);
  const [localBranches, setLocalBranches] = useState<any[]>(() => customerBranches(company, content));
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [branchEditor, setBranchEditor] = useState<any>(null);
  const [branchForm, setBranchForm] = useState<Record<string, any>>(emptyBranchForm);
  const [branchSaving, setBranchSaving] = useState(false);
  const [branchMessage, setBranchMessage] = useState("");
  const [actionResult, setActionResult] = useState<ActionResult | null>(null);
  const [branchAction, setBranchAction] = useState<any>(null);
  const [activeProfileTab, setActiveProfileTab] = useState("Genel Bilgi");
  const [profileCompanyId, setProfileCompanyId] = useState(company?.id || "");
  const [profileForm, setProfileForm] = useState<Record<string, any>>(() => toProfileForm(company));
  const [profileDirty, setProfileDirty] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState("");
  const [enabledPlatforms, setEnabledPlatforms] = useState<string[]>(() => normalizePlatformKeys(integration?.metadata?.enabled_platforms));
  const [enabledModules, setEnabledModules] = useState<string[]>(() => normalizeModuleKeys(integration?.metadata?.enabled_customer_modules));
  const [portalSaving, setPortalSaving] = useState(false);
  const [portalMessage, setPortalMessage] = useState("");
  const branches = localBranches;
  const latestApplication = applications[0] || {};
  const missingIntegrations = [
    !integration.meta_pixel_id ? "Meta Pixel" : "",
    !integration.meta_dataset_id ? "Meta Dataset" : "",
    !integration.ga4_measurement_id && !integration.ga4_property_id ? "GA4" : "",
    !integration.google_ads_customer_id ? "Google Ads" : "",
    !integration.search_console_site_url ? "Search Console" : ""
  ].filter(Boolean);

  if (company?.id && profileCompanyId !== company.id) {
    setProfileCompanyId(company.id);
    setProfileForm(toProfileForm(company));
    setProfileDirty(false);
    setProfileMessage("");
    setLastSavedAt("");
    setEnabledPlatforms(normalizePlatformKeys(integration?.metadata?.enabled_platforms));
    setEnabledModules(normalizeModuleKeys(integration?.metadata?.enabled_customer_modules));
    setPortalMessage("");
  }

  const requestClose = useCallback(() => {
    if (profileDirty && !window.confirm("Kaydedilmemiş değişiklikler var. Kapatmak istediğinize emin misiniz?")) return;
    onClose();
  }, [onClose, profileDirty]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [requestClose]);

  if (!company) return null;

  function updateProfile(key: string, value: string) {
    setProfileForm((current) => ({ ...current, [key]: value }));
    setProfileDirty(true);
    setProfileMessage("");
  }

  async function saveProfile() {
    if (!company?.id || !profileDirty) return;
    setProfileSaving(true);
    setProfileMessage("");
    try {
      const response = await fetch(`/api/admin/companies/${encodeURIComponent(company.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profilePayload(profileForm))
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.supabaseError || payload.error || "Müşteri bilgileri kaydedilemedi.");
      setProfileDirty(false);
      setLastSavedAt(new Date().toLocaleString("tr-TR"));
      setProfileMessage("Müşteri bilgileri kaydedildi.");
      setActionResult({
        title: "Müşteri profili güncellendi",
        status: "success",
        summary: `${profileForm.name || company.name} için profil bilgileri kaydedildi.`,
        nextActions: ["Değişiklikleri müşteri listesinde kontrol edin.", "Entegrasyon veya rapor sekmelerinde ilgili aksiyona devam edin."],
        customerVisibility: { showToCustomer: false, label: "Sadece admin" },
        technicalDetails: { endpoint: `/api/admin/companies/${company.id}`, scope: "customer_profile_partial_update" }
      } as ActionResult);
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : "Müşteri bilgileri kaydedilemedi.");
    } finally {
      setProfileSaving(false);
    }
  }

  function cancelProfileChanges() {
    setProfileForm(toProfileForm(company));
    setProfileDirty(false);
    setProfileMessage("Değişiklikler geri alındı.");
  }

  function toggleListValue(list: string[], value: string) {
    return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
  }

  async function savePortalSettings() {
    if (!company?.id) return;
    setPortalSaving(true);
    setPortalMessage("");
    try {
      const response = await fetch(`/api/admin/customers/${encodeURIComponent(company.id)}/portal-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled_platforms: enabledPlatforms,
          enabled_customer_modules: enabledModules
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.supabaseError || payload.error || "Müşteri panel ayarları kaydedilemedi.");
      setPortalMessage(payload.message || "Müşteri platform ve panel yetkileri kaydedildi.");
      setActionResult({
        title: "Müşteri panel yetkileri güncellendi",
        status: "success",
        summary: `${company.name} için ${enabledPlatforms.length} platform ve ${enabledModules.length} panel modülü aktif.`,
        nextActions: ["Müşteri panelini önizleyerek görünür modülleri kontrol edin.", "Hesap Bağla ekranında yalnız aktif platformların göründüğünü doğrulayın."],
        customerVisibility: { showToCustomer: true, label: "Müşteri paneli görünümü güncellendi" },
        technicalDetails: { endpoint: `/api/admin/customers/${company.id}/portal-settings`, storage: "customer_integrations.metadata" }
      } as ActionResult);
    } catch (error) {
      setPortalMessage(error instanceof Error ? error.message : "Müşteri panel ayarları kaydedilemedi.");
    } finally {
      setPortalSaving(false);
    }
  }

  function resetPortalSettings(type: "platforms" | "modules") {
    if (type === "platforms") setEnabledPlatforms([]);
    if (type === "modules") setEnabledModules(DEFAULT_CUSTOMER_MODULES);
    setPortalMessage(type === "platforms" ? "Platform seçimleri temizlendi. Kaydettiğinizde müşteri panelinde platform kartı görünmez." : "Müşteri panel modülleri varsayılan sete alındı. Kaydetmeyi unutmayın.");
  }

  function openBranchForm(branch?: any) {
    setBranchEditor(branch || null);
    setBranchForm(toBranchForm(branch));
    setBranchMessage("");
    setBranchModalOpen(true);
  }

  async function saveBranch() {
    if (!company?.id) return;
    setBranchSaving(true);
    setBranchMessage("");
    const editing = Boolean(branchEditor?.id);
    const url = editing
      ? `/api/admin/customers/${encodeURIComponent(company.id)}/branches/${encodeURIComponent(branchEditor.id)}`
      : `/api/admin/customers/${encodeURIComponent(company.id)}/branches`;
    try {
      const response = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(branchForm)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.details?.join?.(" ") || payload.error || "Şube kaydedilemedi.");
      const saved = payload.branch;
      setLocalBranches((items) => {
        const exists = items.some((item) => item.id === saved.id);
        const next = exists ? items.map((item) => item.id === saved.id ? saved : item) : [...items, saved];
        return next.sort((a, b) => String(a.branch_name || "").localeCompare(String(b.branch_name || ""), "tr"));
      });
      setBranchEditor(saved);
      setBranchForm(toBranchForm(saved));
      setBranchMessage(payload.message || "Şube kaydedildi.");
      setActionResult(payload.actionResult || null);
    } catch (error) {
      setBranchMessage(error instanceof Error ? error.message : "Şube kaydedilemedi.");
    } finally {
      setBranchSaving(false);
    }
  }

  async function passiveBranch(branch: any) {
    setBranchSaving(true);
    setBranchMessage("");
    try {
      const response = await fetch(`/api/admin/customers/${encodeURIComponent(company.id)}/branches/${encodeURIComponent(branch.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "passive" })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Şube pasife alınamadı.");
      const saved = payload.branch;
      setLocalBranches((items) => items.map((item) => item.id === saved.id ? saved : item));
      setBranchMessage(payload.message || "Şube pasife alındı.");
      setActionResult(payload.actionResult || null);
    } catch (error) {
      setBranchMessage(error instanceof Error ? error.message : "Şube pasife alınamadı.");
    } finally {
      setBranchSaving(false);
    }
  }

  function openMaps(branch: any) {
    const target = googleMapsTarget(branch);
    if (!target) {
      setBranchAction({ type: "message", title: "Google Maps bağlantısı eksik", branch, message: "Google Maps bağlantısı için adres veya Google Maps URL gir." });
      return;
    }
    window.open(target, "_blank", "noopener,noreferrer");
  }

  function startBranchAnalysis(branch: any) {
    const missing = [
      !branch.meta_ad_account_id ? "Meta Ad Account ID" : "",
      !branch.google_ads_customer_id ? "Google Ads Customer ID" : "",
      !branch.ga4_property_id ? "GA4 Property ID" : "",
      !branch.search_console_site_url ? "Search Console URL" : ""
    ].filter(Boolean);
    setBranchAction({ type: "agent", title: "Şube Analizi Başlat", branch, missing });
  }

  function createBranchReport(branch: any) {
    setBranchAction({ type: "report", title: "Şube Raporu Hazırla", branch, reportType: "Haftalık şube özeti" });
  }

  function activeTabCards() {
    if (activeProfileTab === "Platform Yönetimi") {
      return [
        { title: "Aktif platformlar", lines: [`Açık platform: ${enabledPlatforms.length}`, `Kapalı platform: ${CUSTOMER_PLATFORM_REGISTRY.length - enabledPlatforms.length}`, `Hesap Bağla ekranı: ${enabledPlatforms.length ? "Dinamik kartlarla çalışır" : "Platform açılana kadar kapalı"}`] },
        { title: "Performans notu", lines: ["Kapalı platformlar müşteri panelinde render edilmez.", "OAuth ve hesap listeleme butonları yalnız aktif platformlarda çalışır.", "Yeni platformlar registry dosyasından yönetilir."] }
      ];
    }
    if (activeProfileTab === "Müşteri Paneli Yetkileri") {
      return [
        { title: "Panel modülleri", lines: [`Gösterilen modül: ${enabledModules.length}`, `Gizlenen modül: ${CUSTOMER_MODULE_REGISTRY.length - enabledModules.length}`, `AI Asistan: ${enabledModules.includes("ai_assistant") ? "Açık" : "Kapalı"}`] },
        { title: "Erişim davranışı", lines: ["Kapalı modüller navigation içinde görünmez.", "Kapalı modül içeriği müşteri panelinde render edilmez.", "Elle açılan modül isteğinde yetki mesajı gösterilir."] }
      ];
    }
    if (activeProfileTab === "Entegrasyonlar") {
      return [
        { title: "Entegrasyonlar", lines: [`Pixel: ${integration.meta_pixel_id ? "Var" : "Eksik"}`, `Dataset: ${integration.meta_dataset_id ? "Var" : "Eksik"}`, `GA4: ${integration.ga4_measurement_id || integration.ga4_property_id ? "Var" : "Eksik"}`, `Google Ads: ${integration.google_ads_customer_id ? "Var" : "Eksik"}`, `Eksikler: ${missingIntegrations.length ? missingIntegrations.join(", ") : "Yok"}`] },
        { title: "Web analitiği", lines: [`Website: ${company.website || "Yok"}`, `Search Console: ${integration.search_console_site_url ? "Var" : "Eksik"}`, `GTM: ${integration.gtm_container_id ? "Var" : "Eksik"}`, `Analytics durumu: ${integration.setup_progress || 0}%`] }
      ];
    }
    if (activeProfileTab === "Bağlantı Bilgileri") {
      const sensitiveCount = integrationAssets.filter((item: any) => item.login_email || item.login_username || item.login_password || item.access_note || item.sensitive_metadata).length;
      const lastSyncedAsset = integrationAssets.find((item: any) => item.last_synced_at);
      return [
        {
          title: "Bağlı hesap özeti",
          lines: [
            `Toplam bağlantı: ${integrationAssets.length}`,
            `Kontrol bekleyen: ${integrationAssets.filter((item: any) => ["pending_review", "waiting", "Kontrol Bekliyor"].includes(item.status || item.admin_review_status)).length}`,
            `Hassas bilgi içeren: ${sensitiveCount}`,
            `Son senkronizasyon: ${lastSyncedAsset?.last_synced_at ? new Date(lastSyncedAsset.last_synced_at).toLocaleString("tr-TR") : "Yok"}`
          ]
        },
        {
          title: "Platform kayıtları",
          lines: integrationAssets.length
            ? integrationAssets.slice(0, 5).map((item: any) => `${item.platform || item.provider || "Platform"} · ${item.asset_type || item.account_type || "Varlık"} · ${item.provider_account_name || item.asset_name || item.account_id || item.provider_account_id || "Hesap adı yok"} · ${item.connection_method || item.connection_mode || item.source || "Manuel"}`)
            : ["Bu müşteri henüz hesap bilgisi eklemedi.", "Müşteri panelindeki Hesap Bağla alanından veya Entegrasyon Merkezi’nden eklenebilir."]
        }
      ];
    }
    if (activeProfileTab === "Büyüme") {
      return [
        { title: "Büyüme özeti", lines: [`Sağlık skoru: ${profileHealth.score}/100`, `Durum: ${profileHealth.status}`, `Açık görev: ${tasks.filter((item: any) => !["Tamamlandı", "İptal"].includes(item.status)).length}`, `Eksik entegrasyon: ${missingIntegrations.length ? missingIntegrations.join(", ") : "Yok"}`] },
        { title: "Önerilen aksiyon", lines: [`İlk iş: ${missingIntegrations.length ? "Entegrasyonları tamamla" : overduePayments.length ? "Tahsilatı kontrol et" : "Büyüme planını güncelle"}`, `7 günlük plan: ${(latestApplication.seven_day_plan || []).length || "Hazırlanmalı"} adım`, `30 günlük plan: ${(latestApplication.thirty_day_plan || []).length || "Hazırlanmalı"} hafta`] }
      ];
    }
    if (activeProfileTab === "İletişim") {
      return [
        { title: "İletişim", lines: [`Yetkili: ${company.contact_name || company.authorized_person || "Yok"}`, `E-posta: ${company.email || "Yok"}`, `Telefon: ${formatTurkishPhone(company.phone) || "Yok"}`, `Instagram: ${company.instagram || "Yok"}`] },
        { title: "Adres", lines: [`Şehir: ${company.city || "Yok"}`, `Sektör: ${company.sector || "Yok"}`, `Web sitesi: ${company.website || "Yok"}`, `Not: ${company.notes || "Yok"}`] }
      ];
    }
    if (activeProfileTab === "Ödemeler") {
      return [
        { title: "Müşteri Finans Özeti", lines: [`Toplam tahsilat kaydı: ${payments.length}`, `Bekleyen ödeme: ${payments.filter((item: any) => !paidStatuses.includes(item.status)).length}`, `Tahsil edilen: ${payments.filter((item: any) => paidStatuses.includes(item.status)).length}`, `Geciken ödeme: ${overduePayments.length}`] },
        { title: "Ödeme sinyalleri", lines: [`Son ödeme: ${payments[0]?.paid_at || payments[0]?.due_date || "Yok"}`, `Tahsilat durumu: ${overduePayments.length ? "Kontrol gerekli" : "Normal"}`, `Müşteriye açık kayıt: ${payments.filter((item: any) => item.show_to_customer).length}`] }
      ];
    }
    if (activeProfileTab === "Yapılacaklar") {
      return [
        { title: "Yapılacaklar", lines: [`Toplam görev: ${tasks.length}`, `Aktif görev: ${tasks.filter((item: any) => !["Tamamlandı", "İptal"].includes(item.status)).length}`, `Geciken görev: ${tasks.filter((item: any) => item.due_date && item.due_date < new Date().toISOString().slice(0, 10)).length}`, `Müşteriye açık görev: ${tasks.filter((item: any) => item.show_to_customer).length}`] },
        { title: "Sonraki aksiyon", lines: [`Eksik entegrasyon: ${missingIntegrations.length ? missingIntegrations.join(", ") : "Yok"}`, `Sonraki 7 gün planı: ${(latestApplication.seven_day_plan || []).length} adım`, `Aktif kampanya: ${campaigns.length}`] }
      ];
    }
    if (activeProfileTab === "Raporlar") {
      return [
        { title: "Raporlar", lines: [`Toplam rapor: ${reports.length}`, `Müşteriye açık rapor: ${reports.filter((item: any) => item.show_to_customer || item.visible_to_customer).length}`, `Bekleyen rapor: ${reports.filter((item: any) => !item.visible_to_customer).length}`, `Son rapor: ${reports[0]?.created_at ? new Date(reports[0].created_at).toLocaleDateString("tr-TR") : "Yok"}`] },
        { title: "Rapor aksiyonu", lines: [`Kampanya: ${campaigns.length}`, `Paket planı: ${applications.length}`, `Rapor önerisi: ${reports.length ? "Güncelle" : "İlk raporu hazırla"}`] }
      ];
    }
    return [
      { title: "Genel bilgiler", lines: [`Firma: ${company.name}`, `Sektör: ${company.sector || "Yok"}`, `Şehir: ${company.city || "Yok"}`, `Web: ${company.website || "Yok"}`, `Instagram: ${company.instagram || "Yok"}`] },
      { title: "Temel iletişim", lines: [`Yetkili: ${company.contact_name || company.authorized_person || "Yok"}`, `E-posta: ${company.email || "Yok"}`, `Telefon: ${formatTurkishPhone(company.phone) || "Yok"}`, `Durum: ${company.status || "Aktif"}`, `Dahili not: ${company.notes || "Yok"}`] }
    ];
  }

  function profileFormSection() {
    if (activeProfileTab === "Platform Yönetimi") {
      return (
        <section className="mt-5 rounded-[20px] border border-cyan-200 bg-cyan-50 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">Platform Yönetimi</p>
              <h3 className="mt-1 text-xl font-black text-[var(--admin-text-primary)]">Müşteriye açık platformları seç</h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--admin-text-secondary)]">Kapalı platformlar müşteri panelindeki Hesap Bağla ekranında görünmez; OAuth, API ve hesap listeleme akışları çalışmaz.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => resetPortalSettings("platforms")} className="rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2 text-xs font-black text-[var(--admin-text-secondary)]">Reset</button>
              <button type="button" onClick={savePortalSettings} disabled={portalSaving} className="hk-button hk-button-communication px-4 py-2 text-xs disabled:opacity-60">{portalSaving ? "Kaydediliyor..." : "Kaydet"}</button>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {CUSTOMER_PLATFORM_REGISTRY.map((platform) => {
              const active = enabledPlatforms.includes(platform.key);
              return (
                <div key={platform.key} className={`rounded-[16px] border p-4 transition ${active ? "border-cyan-200 bg-[var(--admin-surface)] shadow-sm" : "border-[var(--admin-border)] bg-[var(--admin-surface-soft)]"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className={`mb-3 grid size-11 place-items-center rounded-[14px] ${active ? "bg-cyan-100 text-cyan-700" : "bg-[var(--admin-surface)] text-[var(--admin-text-muted)]"}`}>{platform.title.slice(0, 1)}</div>
                      <h4 className="font-black text-[var(--admin-text-primary)]">{platform.title}</h4>
                      <p className="mt-2 text-xs leading-5 text-[var(--admin-text-muted)]">{platform.description}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-black ${active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-[var(--admin-text-secondary)]"}`}>{active ? "Aktif" : "Pasif"}</span>
                  </div>
                  <label className="mt-4 flex items-center justify-between gap-3 rounded-[12px] bg-[var(--admin-surface-soft)] px-3 py-2 text-xs font-black text-[var(--admin-text-secondary)]">
                    <span>{active ? "Müşteriye açık" : "Gizli"}</span>
                    <input type="checkbox" checked={active} onChange={() => setEnabledPlatforms((current) => toggleListValue(current, platform.key))} className="size-5 accent-cyan-500" />
                  </label>
                </div>
              );
            })}
          </div>
          {portalMessage && <p className="mt-4 rounded-[12px] border border-cyan-200 bg-[var(--admin-surface)] p-3 text-sm font-bold text-cyan-900">{portalMessage}</p>}
        </section>
      );
    }

    if (activeProfileTab === "Müşteri Paneli Yetkileri") {
      return (
        <section className="mt-5 rounded-[20px] border border-violet-200 bg-violet-50 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[.16em] text-violet-700">Müşteri Paneli Yetkilendirme Merkezi</p>
              <h3 className="mt-1 text-xl font-black text-[var(--admin-text-primary)]">Müşteri panelinde görünecek modüller</h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--admin-text-secondary)]">Kapalı modüller navigation ve içerik alanında render edilmez. Elle açılmaya çalışılırsa yetki mesajı gösterilir.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => resetPortalSettings("modules")} className="rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2 text-xs font-black text-[var(--admin-text-secondary)]">Reset</button>
              <button type="button" onClick={savePortalSettings} disabled={portalSaving} className="rounded-full bg-violet-500 px-4 py-2 text-xs font-black text-white disabled:opacity-60">{portalSaving ? "Kaydediliyor..." : "Kaydet"}</button>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {CUSTOMER_MODULE_REGISTRY.map((module) => {
              const active = enabledModules.includes(module.key);
              return (
                <div key={module.key} className={`rounded-[16px] border p-4 transition ${active ? "border-violet-200 bg-[var(--admin-surface)] shadow-sm" : "border-[var(--admin-border)] bg-[var(--admin-surface-soft)]"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-black text-[var(--admin-text-primary)]">{module.title}</h4>
                      <p className="mt-2 text-xs leading-5 text-[var(--admin-text-muted)]">{module.description}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-black ${active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-[var(--admin-text-secondary)]"}`}>{active ? "Göster" : "Gizle"}</span>
                  </div>
                  <label className="mt-4 flex items-center justify-between gap-3 rounded-[12px] bg-[var(--admin-surface-soft)] px-3 py-2 text-xs font-black text-[var(--admin-text-secondary)]">
                    <span>{active ? "Müşteri görür" : "Müşteriden gizli"}</span>
                    <input type="checkbox" checked={active} onChange={() => setEnabledModules((current) => toggleListValue(current, module.key))} className="size-5 accent-violet-500" />
                  </label>
                </div>
              );
            })}
          </div>
          {portalMessage && <p className="mt-4 rounded-[12px] border border-violet-200 bg-[var(--admin-surface)] p-3 text-sm font-bold text-violet-900">{portalMessage}</p>}
        </section>
      );
    }

    if (activeProfileTab === "İletişim Geçmişi") {
      return (
        <section className="mt-5 rounded-[20px] border border-cyan-200 bg-cyan-50 p-5">
          <p className="text-xs font-black uppercase tracking-[.14em] text-cyan-700">Uygulama içi iletişim</p>
          <h3 className="mt-1 text-xl font-black text-[var(--admin-text-primary)]">{company.name} konuşmaları</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--admin-text-secondary)]">Müşteri taleplerini, ekip yanıtlarını, atamaları ve iç notları birleşik gelen kutusunda yönetin.</p>
          <button type="button" onClick={() => onGo?.("İletişim Merkezi", "İletişim geçmişi açıldı.")} className="mt-4 inline-flex min-h-11 items-center rounded-[10px] bg-cyan-600 px-5 text-sm font-black text-white">İletişim geçmişini aç</button>
        </section>
      );
    }

    if (!editableProfileTabs.has(activeProfileTab)) {
      return (
        <section className="mt-5 rounded-[18px] border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-soft)] p-5">
          <h3 className="font-black text-[var(--admin-text-primary)]">Bu bölüm bilgilendirme amaçlıdır</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--admin-text-secondary)]">{activeProfileTab} sekmesinde düzenlenebilir alan yoksa kayıtlar ilgili modülde yönetilir. Alt sabit kaydet butonu yalnız profil formunda değişiklik olduğunda aktifleşir.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => onGo?.("Müşteriler", "İlgili müşteri modülü açıldı.")} className="rounded-full border border-cyan-200 bg-[var(--admin-surface)] px-4 py-2 text-xs font-black text-cyan-700">İlgili modüle git</button>
            <button type="button" onClick={() => setProfileMessage(`${activeProfileTab} sekmesi bilgi amaçlıdır; kaydedilecek form alanı bulunmuyor.`)} className="rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2 text-xs font-black text-[var(--admin-text-secondary)]">Açıklamayı göster</button>
          </div>
        </section>
      );
    }

    return (
      <section className="mt-5 rounded-[20px] border border-cyan-200 bg-cyan-50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[.14em] text-cyan-700">Düzenlenebilir Profil Alanları</p>
            <h3 className="mt-1 text-lg font-black text-[var(--admin-text-primary)]">{activeProfileTab} kaydı</h3>
            <p className="mt-1 text-sm text-cyan-900">Değişiklikler alt sabit bardaki “Değişiklikleri Kaydet” butonu ile kaydedilir.</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-black ${profileDirty ? "bg-amber-100 text-amber-800 ring-1 ring-amber-200" : "bg-[var(--admin-surface)] text-[var(--admin-text-secondary)] ring-1 ring-slate-200"}`}>{profileDirty ? "Kaydedilmemiş değişiklik var" : "Değişiklik yok"}</span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {["Genel Bilgi", "Müşteri Kurulumu", "Notlar"].includes(activeProfileTab) && (
            <>
              <FieldBox label="Firma adı"><TextInput value={profileForm.name} onChange={(value) => updateProfile("name", value)} /></FieldBox>
              <FieldBox label="Sektör"><TextInput value={profileForm.sector} onChange={(value) => updateProfile("sector", value)} /></FieldBox>
              <FieldBox label="Sektörü yazın" help="Hazır sektör listesinde yoksa özel sektör adını yazın."><TextInput value={profileForm.custom_sector} onChange={(value) => updateProfile("custom_sector", value)} /></FieldBox>
              <FieldBox label="Şehir"><TextInput value={profileForm.city} onChange={(value) => updateProfile("city", value)} /></FieldBox>
              <FieldBox label="Web sitesi"><TextInput value={profileForm.website} onChange={(value) => updateProfile("website", value)} placeholder="https://..." /></FieldBox>
              <FieldBox label="Instagram"><TextInput value={profileForm.instagram} onChange={(value) => updateProfile("instagram", value)} placeholder="@hesap veya profil linki" /></FieldBox>
              <FieldBox label="Durum"><select value={profileForm.status} onChange={(event) => updateProfile("status", event.target.value)} className="min-h-11 rounded-[12px] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-[var(--admin-text-primary)] outline-none focus:ring-2 focus:ring-cyan-300">{["Aktif", "Pasif", "Kontrol gerekli", "Onboarding", "Teklif", "Beklemede"].map((item) => <option key={item}>{item}</option>)}</select></FieldBox>
              <FieldBox label="Dahili notlar"><TextBox value={profileForm.notes} onChange={(value) => updateProfile("notes", value)} /></FieldBox>
            </>
          )}
          {activeProfileTab === "İletişim" && (
            <>
              <FieldBox label="Yetkili kişi"><TextInput value={profileForm.contact_name} onChange={(value) => updateProfile("contact_name", value)} /></FieldBox>
              <FieldBox label="Telefon"><TextInput value={profileForm.phone} onChange={(value) => updateProfile("phone", formatTurkishPhone(value))} /></FieldBox>
              <FieldBox label="E-posta"><TextInput type="email" value={profileForm.email} onChange={(value) => updateProfile("email", value)} /></FieldBox>
              <FieldBox label="Instagram"><TextInput value={profileForm.instagram} onChange={(value) => updateProfile("instagram", value)} /></FieldBox>
              <FieldBox label="Takip notu"><TextBox value={profileForm.follow_up_note} onChange={(value) => updateProfile("follow_up_note", value)} /></FieldBox>
            </>
          )}
          {activeProfileTab === "Satış Durumu" && (
            <>
              <FieldBox label="Satış durumu"><TextInput value={profileForm.sales_status} onChange={(value) => updateProfile("sales_status", value)} placeholder="Teklif, Takipte, Kazanıldı..." /></FieldBox>
              <FieldBox label="Pipeline aşaması"><TextInput value={profileForm.pipeline_stage} onChange={(value) => updateProfile("pipeline_stage", value)} placeholder="Onboarding, Aktif, Riskli..." /></FieldBox>
              <FieldBox label="Son temas tarihi"><TextInput type="date" value={profileForm.last_contact_at} onChange={(value) => updateProfile("last_contact_at", value)} /></FieldBox>
              <FieldBox label="Sıradaki aksiyon tarihi"><TextInput type="date" value={profileForm.next_action_at} onChange={(value) => updateProfile("next_action_at", value)} /></FieldBox>
              <FieldBox label="Sıradaki aksiyon notu"><TextBox value={profileForm.next_action} onChange={(value) => updateProfile("next_action", value)} /></FieldBox>
              <FieldBox label="Takip notu"><TextBox value={profileForm.follow_up_note} onChange={(value) => updateProfile("follow_up_note", value)} /></FieldBox>
            </>
          )}
        </div>
      </section>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/65 p-0 backdrop-blur-sm sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
      <section className="hk-customer-profile-shell flex h-[100dvh] w-full flex-col overflow-hidden bg-[var(--admin-surface)] shadow-2xl sm:h-auto sm:max-h-[92vh] sm:w-[92vw] sm:max-w-[1440px] sm:rounded-[28px]" onMouseDown={(event) => event.stopPropagation()}>
        <header className="hk-customer-profile-header admin-card flex items-center justify-between gap-4 rounded-none border-b p-3">
          <p className="text-xs font-black uppercase tracking-[.18em]" style={{ color: "var(--nav-accent-text, #0e7490)" }}>Müşteri Profili · {company.name}</p>
          <button type="button" onClick={requestClose} aria-label="Müşteri profilini kapat" className="hk-icon-button shrink-0"><X size={20} /></button>
        </header>
        <div className="hk-customer-profile-content flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6">
          {actionResult && <div className="mb-5"><ActionResultPanel result={actionResult} onNavigate={(href) => window.location.assign(href)} /></div>}
          {!showOverview && children && <div className="hk-customer-profile-workspace mb-5">{children}</div>}
          {showOverview && (
            <>
              <Customer360Header company={company} content={content} onNavigate={(target, message) => onGo?.(target, message)} />
              <AdminTabs items={CUSTOMER_360_TABS} active={activeProfileTab} onChange={setActiveProfileTab} ariaLabel="Müşteri 360 sekmeleri" sticky />
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {activeTabCards().map((card) => <SummaryBox key={card.title} title={card.title} lines={card.lines} />)}
              </div>
              {profileFormSection()}
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <SummaryBox title="Kurulum durumu" lines={[`Sağlık skoru: ${profileHealth.score}/100`, `Durum: ${profileHealth.status}`, ...(profileHealth.reasons || [])]} />
                <SummaryBox title="Operasyon özeti" lines={[`Görev: ${tasks.length}`, `Rapor: ${reports.length}`, `Tahsilat: ${payments.length}`, `Kampanya: ${campaigns.length}`]} />
                <SummaryBox title="Ajans Operasyon Özeti" lines={[`Uygulanan paket: ${applications.length}`, `Şube: ${branches.length}`, `Aktif görev: ${tasks.filter((item: any) => !["Tamamlandı", "İptal"].includes(item.status)).length}`, `Bekleyen rapor: ${reports.filter((item: any) => !item.visible_to_customer).length}`, `Eksik entegrasyon: ${missingIntegrations.length ? missingIntegrations.join(", ") : "Yok"}`, `Sonraki 7 gün planı: ${(latestApplication.seven_day_plan || []).length} adım`]} />
                <SummaryBox title="Müşteri Finans Özeti" lines={[`Toplam tahsilat kaydı: ${payments.length}`, `Bekleyen ödeme: ${payments.filter((item: any) => !paidStatuses.includes(item.status)).length}`, `Tahsil edilen: ${payments.filter((item: any) => paidStatuses.includes(item.status)).length}`, `Geciken ödeme: ${overduePayments.length}`]} />
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <button onClick={() => onGo?.("Müşteriler", "Müşteri detayına gidildi.")} className="hk-button hk-button-communication px-4 py-3 text-sm">Müşteri detayına git</button>
                <button onClick={() => onGo?.("Web Site Analitiği")} className="hk-button hk-button-outline px-4 py-3 text-sm">Entegrasyonları aç</button>
                <button onClick={() => onGo?.("HK Agent Hub")} className="hk-button hk-button-outline px-4 py-3 text-sm">Agent Hub’da analiz et</button>
                <button onClick={() => onGo?.("Müşteri Raporları")} className="hk-button hk-button-outline px-4 py-3 text-sm">Rapor oluştur</button>
                <button onClick={() => onGo?.("Görevler")} className="hk-button hk-button-outline px-4 py-3 text-sm">Görev oluştur</button>
              </div>
            </>
          )}
          <div className="mt-8 flex items-baseline justify-between gap-3 border-t pt-5" style={{ borderColor: "var(--admin-border)" }}>
            <div>
              <span className="hk-page-eyebrow text-xs font-black uppercase tracking-[.14em]">Operasyon Detayları</span>
              <h3 className="mt-1 text-lg font-black text-[var(--admin-text-primary)]">Şubeler, rakipler ve uygulanan planlar</h3>
            </div>
          </div>
          <section className="mt-4 rounded-[18px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-black text-[var(--admin-text-primary)]">Şubeler</h3>
                <p className="mt-1 text-sm text-[var(--admin-text-muted)]">Şube bazlı reklam, rapor, entegrasyon ve KPI yönetimi için kayıtlı lokasyonlar.</p>
              </div>
              <button onClick={() => openBranchForm()} className="hk-button hk-button-communication px-4 py-2.5 text-sm">Şube Ekle</button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {branches.map((branch: any) => (
                <div key={branch.id} className="rounded-[16px] border border-[var(--admin-border)] bg-[var(--admin-surface-soft)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-black text-[var(--admin-text-primary)]">{branch.branch_name || "Adsız şube"}</p>
                      <p className="mt-1 text-xs text-[var(--admin-text-muted)]">{branch.city || "Şehir yok"} · {branch.district || "İlçe yok"}</p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <span className={`hk-badge px-2 py-1 text-[10px] ${branch.status === "passive" || branch.is_active === false ? "hk-badge-neutral" : branch.status === "needs_review" ? "hk-badge-warning" : "hk-badge-success"}`}>{statusLabel(branch.status, branch.is_active)}</span>
                      <span className="rounded-full bg-[var(--admin-surface)] px-2 py-1 text-[10px] font-black text-cyan-700 ring-1 ring-cyan-200">{branch.monthly_ad_budget ? `Bütçe ${branch.monthly_ad_budget} TL` : "Bütçe yok"}</span>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-1 text-xs leading-5 text-[var(--admin-text-secondary)]">
                    <span>Adres: {branchDisplay(branch.address)}</span>
                    <span>Telefon/WhatsApp: {formatTurkishPhone(branch.phone || branch.whatsapp) || "Mevcut değil"}</span>
                    <span>E-posta: {branchDisplay(branch.email)}</span>
                    <span>Website/Landing: {branchDisplay(branch.website_url || branch.landing_page_url)}</span>
                    <span>Meta: {branch.meta_ad_account_id || "Eksik"} · Google Ads: {branch.google_ads_customer_id || "Eksik"} · GA4: {branch.ga4_property_id || "Eksik"}</span>
                    <span>Sorumlu: {branch.responsible_person || "Belirtilmedi"}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={() => openBranchForm(branch)} className="hk-button hk-button-communication px-3 py-1.5 text-xs">Şubeyi Düzenle</button>
                    <button onClick={() => passiveBranch(branch)} disabled={branchSaving || branch.status === "passive" || branch.is_active === false} className="rounded-[10px] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-1.5 text-xs font-black text-[var(--admin-text-secondary)] disabled:opacity-50">Şubeyi Pasife Al</button>
                    <button onClick={() => createBranchReport(branch)} className="hk-button hk-button-outline px-3 py-1.5 text-xs">Şube Raporu Oluştur</button>
                    <button onClick={() => startBranchAnalysis(branch)} className="hk-button hk-button-outline px-3 py-1.5 text-xs">Şube İçin Agent Analizi</button>
                    <button onClick={() => openMaps(branch)} className="rounded-[10px] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-1.5 text-xs font-black text-[var(--admin-text-secondary)]">Google Maps’te Aç</button>
                  </div>
                </div>
              ))}
              {!branches.length && <p className="rounded-[14px] border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-soft)] p-4 text-sm text-[var(--admin-text-muted)]">Bu müşteri için henüz şube yok. İlk şubeyi ekleyerek şube bazlı rapor ve reklam takibine başlayabilirsin.</p>}
            </div>
            {branchMessage && <p className="mt-3 rounded-[12px] border border-cyan-200 bg-cyan-50 p-3 text-sm font-bold text-cyan-800">{branchMessage}</p>}
          </section>
          <section className="mt-5 rounded-[18px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-black text-[var(--admin-text-primary)]">Rakipler</h3>
                <p className="mt-1 text-sm text-[var(--admin-text-muted)]">Rakip firma izleme, reklam/paylaşım sinyali, Google yorum takibi ve müşteriye açık rekabet özeti.</p>
              </div>
              <button onClick={() => onGo?.("Rakip Analizi", "Rakip ekleme ve AI ile rakip bulma alanı açıldı.")} className="hk-button hk-button-communication px-4 py-2.5 text-sm">Rakip Analizine Git</button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {(content?.competitorWatchlist || content?.competitorAnalyses || []).filter((item: any) => item.company_id === company?.id).slice(0, 6).map((item: any) => (
                <div key={item.id || item.competitor_name || item.name} className="rounded-[14px] border border-[var(--admin-border)] bg-[var(--admin-surface-soft)] p-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-black text-[var(--admin-text-primary)]">{item.competitor_name || item.name || item.sector || "Rakip kaydı"}</p>
                      <p className="mt-1 text-xs text-[var(--admin-text-muted)]">{item.website_url || item.website || "Web sitesi yok"} · {item.city || company.city || "Şehir yok"} / {item.district || "İlçe yok"}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-black ring-1 ${item.show_to_customer || item.show_customer_summary ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-[var(--admin-surface)] text-[var(--admin-text-secondary)] ring-slate-200"}`}>{item.show_to_customer || item.show_customer_summary ? "Müşteriye açık" : "Sadece admin"}</span>
                  </div>
                  <div className="mt-3 grid gap-1 text-xs text-[var(--admin-text-secondary)]">
                    <span>Rakip skoru: {item.competitor_score || 0} · Tehdit: {item.threat_score || 0} · Fırsat: {item.opportunity_score || 0}</span>
                    <span>Son kontrol: {item.last_checked_at ? new Date(item.last_checked_at).toLocaleDateString("tr-TR") : "Henüz yok"}</span>
                    <span>Google Maps kontrolü: {item.last_maps_checked_at ? new Date(item.last_maps_checked_at).toLocaleDateString("tr-TR") : "Henüz yok"} · Meta kontrolü: {item.last_meta_checked_at ? new Date(item.last_meta_checked_at).toLocaleDateString("tr-TR") : "Henüz yok"}</span>
                    <span>Bildirimler: {item.notify_on_new_ads || item.notify_on_review_change || item.notify_on_price_change ? "Aktif" : "Kapalı"}</span>
                    <span>{item.customer_summary || item.customer_visible_summary || item.last_analysis_summary || "Müşteri özeti henüz üretilmedi."}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a href={item.google_place_id ? `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(item.google_place_id)}` : item.google_maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([item.competitor_name || item.name, item.address, item.city, item.district].filter(Boolean).join(" "))}`} target="_blank" rel="noreferrer" className="hk-button hk-button-outline px-3 py-1.5 text-xs">Google Maps’te aç</a>
                    <a href={item.meta_ad_library_url || `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=TR&q=${encodeURIComponent(item.competitor_name || item.name || "")}`} target="_blank" rel="noreferrer" className="rounded-[10px] border border-blue-200 bg-[var(--admin-surface)] px-3 py-1.5 text-xs font-black text-blue-700">Meta reklamlarını aç</a>
                    <button onClick={() => onGo?.("HK Agent Hub", "Rakip için Agent analizi açıldı.")} className="hk-button hk-button-outline px-3 py-1.5 text-xs">Agent ile analiz et</button>
                    <button onClick={() => onGo?.("Rakip Analizi", "Rakip reklam kontrolü açıldı.")} className="rounded-[10px] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-1.5 text-xs font-black text-[var(--admin-text-secondary)]">Reklamları kontrol et</button>
                    <button onClick={() => onGo?.("Rakip Analizi", "Rakip detay inceleme modalı açıldı.")} className="rounded-[10px] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-1.5 text-xs font-black text-[var(--admin-text-secondary)]">Detaylı gör</button>
                    <button onClick={() => onGo?.("Rakip Analizi", "AI ile rakip bulma ve müşteri özeti alanı açıldı.")} className="rounded-[10px] border border-emerald-200 bg-[var(--admin-surface)] px-3 py-1.5 text-xs font-black text-emerald-700">AI ile rakip bul</button>
                  </div>
                </div>
              ))}
              {!(content?.competitorWatchlist || content?.competitorAnalyses || []).filter((item: any) => item.company_id === company?.id).length && (
                <p className="rounded-[14px] border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-soft)] p-4 text-sm text-[var(--admin-text-muted)]">Henüz rakip kaydı yok. Rakip Analizi ekranından rakip ekleyebilir veya AI ile öneri üretebilirsin.</p>
              )}
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-[14px] border border-emerald-200 bg-emerald-50 p-3">
                <h4 className="font-black text-[var(--admin-text-primary)]">Takip Edilen Rakipler</h4>
                <div className="mt-3 grid gap-2">
                  {(content?.competitorWatchlist || []).filter((item: any) => item.company_id === company?.id && (item.is_tracking || item.notify_on_new_ads || item.notify_on_review_change || item.notify_on_price_change)).slice(0, 4).map((item: any) => (
                    <div key={item.id || item.competitor_name} className="rounded-[10px] bg-[var(--admin-surface)] p-2 text-xs text-[var(--admin-text-secondary)] ring-1 ring-emerald-200">
                      <p className="font-black text-[var(--admin-text-primary)]">{item.competitor_name || item.name || "Rakip"}</p>
                      <p>Skor: {item.competitor_score || 0} · Tehdit: {item.threat_score || 0} · Son kontrol: {item.last_checked_at ? new Date(item.last_checked_at).toLocaleDateString("tr-TR") : "Henüz yok"}</p>
                      <p>{item.show_to_customer || item.show_customer_summary ? "Müşteriye açık" : "Sadece admin"} · Bildirim: {item.notification_channels?.length || item.notify_on_new_ads ? "Açık" : "Kapalı"}</p>
                    </div>
                  ))}
                  {!(content?.competitorWatchlist || []).filter((item: any) => item.company_id === company?.id && (item.is_tracking || item.notify_on_new_ads || item.notify_on_review_change || item.notify_on_price_change)).length && <p className="text-sm text-emerald-800">Bu müşteri için takip edilen rakip yok.</p>}
                </div>
              </div>
              <div className="rounded-[14px] border border-blue-200 bg-blue-50 p-3">
                <h4 className="font-black text-[var(--admin-text-primary)]">Yeni Sinyaller</h4>
                <div className="mt-3 grid gap-2">
                  {(content?.competitorSignals || []).filter((signal: any) => signal.company_id === company?.id).slice(0, 4).map((signal: any) => (
                    <div key={signal.id || signal.title} className="rounded-[10px] bg-[var(--admin-surface)] p-2 text-xs text-[var(--admin-text-secondary)] ring-1 ring-blue-200">
                      <p className="font-black text-[var(--admin-text-primary)]">{signal.title || "Rakip sinyali"}</p>
                      <p>{signal.customer_visible_summary || signal.summary || "Sinyal özeti hazırlanıyor."}</p>
                      <p>{signal.show_to_customer ? "Müşteriye açık" : "Sadece admin"} · {signal.resolved_at ? "Çözüldü" : "Aksiyon bekliyor"}</p>
                    </div>
                  ))}
                  {!(content?.competitorSignals || []).filter((signal: any) => signal.company_id === company?.id).length && <p className="text-sm text-blue-800">Bu müşteri için yeni rakip sinyali yok.</p>}
                </div>
              </div>
            </div>
            </div>
          </section>
          <section className="mt-5 rounded-[18px] border border-cyan-200 bg-cyan-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-black text-[var(--admin-text-primary)]">Uygulanan Paketler / Planlar</h3>
                <p className="mt-1 text-sm text-cyan-900">Hazır paket uygulamaları, takip metrikleri ve ilk 7/30 günlük plan özetleri.</p>
              </div>
              <span className="rounded-full bg-[var(--admin-surface)] px-3 py-1 text-xs font-black text-cyan-700 ring-1 ring-cyan-200">{applications.length} kayıt</span>
            </div>
            <div className="mt-4 grid gap-2">
              {applications.slice(0, 5).map((application: any) => (
                <div key={application.id || application.created_at} className="rounded-[14px] border border-cyan-200 bg-[var(--admin-surface)] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-black text-[var(--admin-text-primary)]">{packageTitle(application)}</p>
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700 ring-1 ring-emerald-200">{applicationStatus(application.status)}</span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--admin-text-muted)]">Uygulama tarihi: {application.created_at ? new Date(application.created_at).toLocaleString("tr-TR") : "Tarih yok"}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold text-[var(--admin-text-secondary)]">
                    <span>Görev: {countFromSummary(application, "tasks")}</span>
                    <span>Hafıza: {countFromSummary(application, "memory")}</span>
                    <span>Rapor: {countFromSummary(application, "reportTemplate")}</span>
                    <span>Teklif: {countFromSummary(application, "proposalDraft")}</span>
                    <span>Takip metriği: {(application.tracking_metrics || []).length}</span>
                    <span>7 gün: {(application.seven_day_plan || []).length} adım</span>
                    <span>30 gün: {(application.thirty_day_plan || []).length} hafta</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={() => onGo?.("HK Intelligence CEO", "Uygulanan plan açıldı.")} className="hk-button hk-button-communication px-3 py-1.5 text-xs">Aç / Devam Et</button>
                    <button onClick={() => onGo?.("Müşteri Raporları", "Rapor oluşturma alanı açıldı.")} className="hk-button hk-button-outline px-3 py-1.5 text-xs">Rapor Oluştur</button>
                  </div>
                </div>
              ))}
              {!applications.length && <p className="rounded-[12px] border border-dashed border-cyan-200 bg-[var(--admin-surface)] p-4 text-sm text-cyan-800">Bu müşteri için uygulanmış hazır paket henüz yok.</p>}
            </div>
          </section>
          <section className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-[18px] border border-purple-200 bg-purple-50 p-4">
              <h3 className="font-black text-[var(--admin-text-primary)]">Son AI Önerileri</h3>
              <p className="mt-1 text-sm text-purple-900">Rakip, paket ve görev sinyallerinden gelen son ajans aksiyonları.</p>
              <div className="mt-3 grid gap-2">
                {[
                  ...((content?.competitorSignals || []).filter((item: any) => item.company_id === company?.id).map((item: any) => item.agency_action || item.customer_visible_summary || item.summary).filter(Boolean)),
                  ...((latestApplication?.next_actions || []).map((item: any) => typeof item === "string" ? item : item.title || item.action).filter(Boolean))
                ].slice(0, 5).map((line: string) => <p key={line} className="rounded-[10px] bg-[var(--admin-surface)] p-2 text-sm leading-5 text-[var(--admin-text-secondary)] ring-1 ring-purple-100">{line}</p>)}
                {!((content?.competitorSignals || []).filter((item: any) => item.company_id === company?.id).length || (latestApplication?.next_actions || []).length) && <p className="rounded-[10px] bg-[var(--admin-surface)] p-3 text-sm text-purple-800">Henüz AI önerisi yok. Rakip analizi, paket uygulaması veya Agent Hub çalıştırıldığında burada görünür.</p>}
              </div>
            </div>
            <div className="rounded-[18px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
              <h3 className="font-black text-[var(--admin-text-primary)]">Son Aktiviteler</h3>
              <p className="mt-1 text-sm text-[var(--admin-text-muted)]">Müşteri operasyon zincirinde son kayıtlar.</p>
              <div className="mt-3 grid gap-2">
                {[
                  ...((content?.activityLogs || []).filter((item: any) => item.company_id === company?.id).map((item: any) => ({ title: item.action_type || item.title || "Aktivite", date: item.created_at }))),
                  ...tasks.slice(0, 3).map((item: any) => ({ title: `Görev: ${item.title || "Görev"}`, date: item.updated_at || item.created_at })),
                  ...reports.slice(0, 3).map((item: any) => ({ title: `Rapor: ${item.title || item.report_month || "Rapor"}`, date: item.created_at || item.updated_at }))
                ].slice(0, 6).map((item: any) => <p key={`${item.title}-${item.date || ""}`} className="rounded-[10px] bg-[var(--admin-surface-soft)] p-2 text-sm text-[var(--admin-text-secondary)] ring-1 ring-slate-200"><strong>{item.title}</strong><span className="ml-2 text-xs text-[var(--admin-text-muted)]">{item.date ? new Date(item.date).toLocaleDateString("tr-TR") : "Tarih yok"}</span></p>)}
                {!((content?.activityLogs || []).filter((item: any) => item.company_id === company?.id).length || tasks.length || reports.length) && <p className="rounded-[10px] bg-[var(--admin-surface-soft)] p-3 text-sm text-[var(--admin-text-muted)]">Henüz operasyon aktivitesi yok.</p>}
              </div>
            </div>
          </section>
          <section className="mt-5 rounded-[18px] border border-emerald-200 bg-emerald-50 p-4">
            <h3 className="font-black text-[var(--admin-text-primary)]">Müşteri Operasyon Zinciri</h3>
            <p className="mt-1 text-sm text-emerald-900">Müşteri → Rakip Analizi → AI Strateji → Paket Önerisi → Görev → İçerik Takvimi → Reklam Kurulumu → Rapor → Tahsilat → Yenileme hattını tek yerden takip et.</p>
            <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
              {[
                ["Rakip Analizi", "Rakip Analizi"],
                ["AI Strateji", "HK Agent Hub"],
                ["Paket Önerisi", "HK Intelligence CEO"],
                ["Görev Oluştur", "Görevler"],
                ["İçerik Takvimi", "Sosyal Medya Planı"],
                ["Reklam Kurulumu", "Kampanyalar"],
                ["Rapor", "Müşteri Raporları"],
                ["Tahsilat", "Tahsilat"],
                ["Yenileme", "Takip Merkezi"]
              ].map(([label, target]) => <button key={label} onClick={() => onGo?.(target, `${label} adımı açıldı.`)} className="rounded-[12px] border border-emerald-200 bg-[var(--admin-surface)] p-3 text-left text-xs font-black text-emerald-800 hover:bg-emerald-50"><span className="block">{label}</span><span className="mt-1 block font-medium text-[var(--admin-text-muted)]">Git / görev oluştur</span></button>)}
            </div>
          </section>
          {showOverview && children && <div className="mt-5">{children}</div>}
        </div>
        <footer className="sticky bottom-0 z-20 border-t border-[var(--admin-border)] bg-[var(--admin-surface)]/95 p-4 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="grid gap-1 text-xs font-bold text-[var(--admin-text-secondary)]">
              <span className={profileDirty ? "text-amber-700" : "text-emerald-700"}>
                {profileDirty ? "Kaydedilmemiş değişiklik var. Kapatmadan önce kaydetmeniz önerilir." : "Kaydedilmemiş değişiklik yok."}
              </span>
              <span>Son kaydetme zamanı: {lastSavedAt || "Bu oturumda henüz kayıt yapılmadı."}</span>
              {profileMessage && <span className="text-cyan-700">{profileMessage}</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={cancelProfileChanges}
                disabled={!profileDirty || profileSaving}
                title={!profileDirty ? "Geri alınacak değişiklik yok." : "Kaydedilmemiş değişiklikleri geri alır."}
                className="rounded-[12px] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2.5 text-sm font-black text-[var(--admin-text-secondary)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={requestClose}
                className="rounded-[12px] border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-sm font-black text-cyan-800"
              >
                Kapat
              </button>
              <button
                type="button"
                onClick={saveProfile}
                disabled={!profileDirty || profileSaving}
                title={!profileDirty ? "Kaydedilecek değişiklik yok." : "Profil formundaki değişiklikleri kaydeder."}
                className="hk-button hk-button-primary px-4 py-2.5 text-sm disabled:opacity-60"
              >
                {profileSaving ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}
              </button>
            </div>
          </div>
        </footer>
      </section>
      {branchModalOpen && (
        <BranchEditorModal
          branch={branchEditor}
          form={branchForm}
          setForm={setBranchForm}
          saving={branchSaving}
          message={branchMessage}
          onSave={saveBranch}
          onClose={() => { setBranchModalOpen(false); setBranchEditor(null); setBranchMessage(""); }}
          onGo={onGo}
        />
      )}
      {branchAction && <BranchActionModal action={branchAction} company={company} onClose={() => setBranchAction(null)} onGo={onGo} />}
    </div>
  );
}

function BranchEditorModal({ branch, form, setForm, saving, message, onSave, onClose, onGo }: any) {
  const editing = Boolean(branch?.id);
  const fields = [
    ["branch_name", "Şube adı"],
    ["city", "Şehir"],
    ["district", "İlçe"],
    ["address", "Adres"],
    ["phone", "Telefon"],
    ["whatsapp", "WhatsApp"],
    ["email", "E-posta"],
    ["google_maps_url", "Google Maps URL"],
    ["website_url", "Web sitesi"],
    ["landing_page_url", "Landing Page URL"],
    ["meta_ad_account_id", "Meta Ad Account ID"],
    ["google_ads_customer_id", "Google Ads Customer ID"],
    ["ga4_property_id", "GA4 Property ID"],
    ["search_console_site_url", "Search Console URL"],
    ["gtm_container_id", "GTM ID"],
    ["monthly_ad_budget", "Aylık reklam bütçesi"],
    ["monthly_service_fee", "Aylık hizmet bedeli"],
    ["responsible_person", "Sorumlu kişi"]
  ];
  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/55 p-0 sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[var(--admin-surface)] shadow-2xl sm:h-auto sm:max-h-[88vh] sm:max-w-4xl sm:rounded-[24px]" onMouseDown={(event) => event.stopPropagation()}>
        <header className="flex items-start justify-between gap-3 border-b border-[var(--admin-border)] p-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">Şube Yönetimi</p>
            <h2 className="mt-1 text-2xl font-black text-[var(--admin-text-primary)]">{editing ? "Şubeyi Düzenle" : "Yeni Şube Ekle"}</h2>
            <p className="mt-1 text-sm text-[var(--admin-text-muted)]">Şube bazlı reklam, rapor ve entegrasyon takibi için gerekli alanları doldurun.</p>
          </div>
          <button onClick={onClose} aria-label="Kapat" className="rounded-full border border-[var(--admin-border)] p-2 text-[var(--admin-text-muted)]"><X size={18} /></button>
        </header>
        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid gap-3 md:grid-cols-3">
            {fields.map(([key, label]) => (
              <label key={key} className="grid gap-1 text-sm font-bold text-[var(--admin-text-secondary)]">
                {label}
                <input
                  value={form[key] || ""}
                  onChange={(event) => setForm({ ...form, [key]: key === "phone" || key === "whatsapp" ? formatTurkishPhone(event.target.value) : event.target.value })}
                  onBlur={() => (key === "phone" || key === "whatsapp") && setForm({ ...form, [key]: formatTurkishPhone(normalizePhoneInput(form[key])) })}
                  className="rounded-[12px] border border-[var(--admin-border)] bg-[var(--admin-surface-soft)] px-3 py-2.5 text-sm font-medium text-[var(--admin-text-primary)]"
                />
              </label>
            ))}
            <label className="grid gap-1 text-sm font-bold text-[var(--admin-text-secondary)]">
              Durum
              <select value={form.status || "active"} onChange={(event) => setForm({ ...form, status: event.target.value })} className="rounded-[12px] border border-[var(--admin-border)] bg-[var(--admin-surface-soft)] px-3 py-2.5 text-sm font-medium text-[var(--admin-text-primary)]">
                <option value="active">Aktif</option>
                <option value="passive">Pasif</option>
                <option value="needs_review">Kontrol gerekli</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-bold text-[var(--admin-text-secondary)] md:col-span-3">
              Notlar
              <textarea value={form.notes || ""} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="min-h-24 rounded-[12px] border border-[var(--admin-border)] bg-[var(--admin-surface-soft)] px-3 py-2.5 text-sm font-medium text-[var(--admin-text-primary)]" />
            </label>
          </div>
          {message && <p className="mt-4 rounded-[12px] border border-cyan-200 bg-cyan-50 p-3 text-sm font-bold text-cyan-800">{message}</p>}
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-border)] p-5">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => window.open(form.google_maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([form.address, form.district, form.city, form.branch_name].filter(Boolean).join(" "))}`, "_blank", "noopener,noreferrer")} className="rounded-[12px] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2.5 text-sm font-black text-[var(--admin-text-secondary)]">Google Maps’te Aç</button>
            <button onClick={() => onGo?.("HK Agent Hub", "Şube için Agent analizi açıldı.")} className="hk-button hk-button-outline px-4 py-2.5 text-sm">Şube İçin Agent Analizi</button>
            <button onClick={() => onGo?.("Müşteri Raporları", "Şube raporu oluşturma alanı açıldı.")} className="hk-button hk-button-outline px-4 py-2.5 text-sm">Şube Raporu Oluştur</button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={onClose} className="rounded-[12px] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2.5 text-sm font-black text-[var(--admin-text-secondary)]">Vazgeç</button>
            <button onClick={onSave} disabled={saving} className="hk-button hk-button-communication px-4 py-2.5 text-sm disabled:opacity-60">{saving ? "Kaydediliyor..." : editing ? "Şubeyi Güncelle" : "Kaydet"}</button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function BranchActionModal({ action, company, onClose, onGo }: any) {
  const branch = action.branch || {};
  const reportTypes = ["Haftalık şube özeti", "Google Maps görünürlük", "Reklam performansı", "Entegrasyon kontrolü", "7 günlük aksiyon planı"];
  const [reportType, setReportType] = useState(action.reportType || reportTypes[0]);
  const agentHref = `/hk-admin/agent-hub?companyId=${encodeURIComponent(company.id)}&branchId=${encodeURIComponent(branch.id || "")}&taskType=${action.type === "agent" ? "branch_analysis" : "customer_report"}&prompt=${encodeURIComponent(`${branch.branch_name || "Şube"} için ${action.type === "agent" ? "reklam, SEO, Maps ve rakip" : reportType} analizi hazırla.`)}`;
  const reportPayload = {
    title: `${branch.branch_name || "Şube"} - ${reportType}`,
    customerName: company.name,
    branchName: branch.branch_name,
    createdAt: new Date().toISOString(),
    sections: ["Yönetici özeti", "Eksik entegrasyonlar", "Bulgular", "Riskler", "7 günlük aksiyon planı"]
  };

  return (
    <div className="fixed inset-0 z-[130] grid place-items-center bg-slate-950/55 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="w-full max-w-2xl rounded-[22px] bg-[var(--admin-surface)] p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[.14em] text-cyan-700">Şube Aksiyonu</p>
            <h3 className="mt-1 text-xl font-black text-[var(--admin-text-primary)]">{action.title}</h3>
            <p className="mt-1 text-sm text-[var(--admin-text-muted)]">{branch.branch_name || "Şube"} · {company.name}</p>
          </div>
          <button onClick={onClose} className="rounded-full border border-[var(--admin-border)] p-2 text-[var(--admin-text-muted)]"><X size={18} /></button>
        </div>
        {action.type === "message" && <p className="mt-4 rounded-[14px] border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">{action.message}</p>}
        {action.type === "agent" && (
          <div className="mt-4 grid gap-3">
            <p className="text-sm text-[var(--admin-text-secondary)]">Eksik entegrasyonlar: <b>{action.missing?.length ? action.missing.join(", ") : "Kritik eksik görünmüyor"}</b></p>
            <div className="grid gap-2 sm:grid-cols-5">{["reklam", "SEO", "Maps", "rakip", "genel"].map((item) => <span key={item} className="rounded-full bg-cyan-50 px-3 py-2 text-center text-xs font-black text-cyan-700 ring-1 ring-cyan-200">{item}</span>)}</div>
            <button onClick={() => window.location.assign(agentHref)} className="hk-button hk-button-communication px-4 py-3 text-sm">Agent Hub’da Şube Analizi Başlat</button>
          </div>
        )}
        {action.type === "report" && (
          <div className="mt-4 grid gap-3">
            <label className="grid gap-2 text-sm font-bold text-[var(--admin-text-secondary)]">Rapor türü<select value={reportType} onChange={(event) => setReportType(event.target.value)} className="rounded-[12px] border border-[var(--admin-border)] bg-[var(--admin-surface-soft)] px-3 py-3 text-[var(--admin-text-primary)]">{reportTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
            <pre className="max-h-48 overflow-auto rounded-[12px] bg-slate-950 p-3 text-xs text-cyan-50">{JSON.stringify(reportPayload, null, 2)}</pre>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => onGo?.("Müşteri Raporları", `${reportType} hazırlık verisi oluşturuldu.`)} className="hk-button hk-button-communication px-4 py-3 text-sm">Rapor Oluştur</button>
              <button onClick={() => navigator.clipboard?.writeText(JSON.stringify(reportPayload, null, 2))} className="hk-button hk-button-outline px-4 py-3 text-sm">Hazırlık Verisini Kopyala</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
