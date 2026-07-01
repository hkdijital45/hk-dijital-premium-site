"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { ActionResultPanel } from "@/components/admin/ActionResultPanel";
import type { ActionResult } from "@/lib/action-result";
import { formatTurkishPhone, isEmptyLikeValue, normalizePhoneInput } from "@/lib/phone-format";

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
    <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-4">
      <h3 className="font-black text-slate-950">{title}</h3>
      <div className="mt-3 grid gap-1 text-sm text-slate-600">
        {lines.map((line) => <span key={line}>{line}</span>)}
      </div>
    </div>
  );
}

const profileTabs = [
  "Genel Bilgi",
  "Müşteri Kurulumu",
  "Entegrasyonlar",
  "Marka Varlıkları",
  "İletişim",
  "Satış Durumu",
  "Reklam Hesapları",
  "Kampanyalar",
  "Teklifler",
  "Ödemeler",
  "Yapılacaklar",
  "Raporlar",
  "Dosyalar",
  "Zaman Çizelgesi",
  "Panel Görünürlüğü",
  "Giriş Bilgileri",
  "Metrikler",
  "Yapılan Çalışmalar",
  "Aktivite Geçmişi",
  "Notlar"
];

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

function statusLabel(status: string, isActive?: boolean) {
  if (status === "passive" || isActive === false) return "Pasif";
  if (status === "needs_review") return "Kontrol gerekli";
  return "Aktif";
}

function statusTone(status: string, isActive?: boolean) {
  if (status === "passive" || isActive === false) return "bg-slate-50 text-slate-600 ring-slate-200";
  if (status === "needs_review") return "bg-amber-50 text-amber-700 ring-amber-200";
  return "bg-emerald-50 text-emerald-700 ring-emerald-200";
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
  const branches = localBranches;
  const latestApplication = applications[0] || {};
  const missingIntegrations = [
    !integration.meta_pixel_id ? "Meta Pixel" : "",
    !integration.meta_dataset_id ? "Meta Dataset" : "",
    !integration.ga4_measurement_id && !integration.ga4_property_id ? "GA4" : "",
    !integration.google_ads_customer_id ? "Google Ads" : "",
    !integration.search_console_site_url ? "Search Console" : ""
  ].filter(Boolean);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  if (!company) return null;

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
    if (activeProfileTab === "Entegrasyonlar") {
      return [
        { title: "Entegrasyonlar", lines: [`Pixel: ${integration.meta_pixel_id ? "Var" : "Eksik"}`, `Dataset: ${integration.meta_dataset_id ? "Var" : "Eksik"}`, `GA4: ${integration.ga4_measurement_id || integration.ga4_property_id ? "Var" : "Eksik"}`, `Google Ads: ${integration.google_ads_customer_id ? "Var" : "Eksik"}`, `Eksikler: ${missingIntegrations.length ? missingIntegrations.join(", ") : "Yok"}`] },
        { title: "Web analitiği", lines: [`Website: ${company.website || "Yok"}`, `Search Console: ${integration.search_console_site_url ? "Var" : "Eksik"}`, `GTM: ${integration.gtm_container_id ? "Var" : "Eksik"}`, `Analytics durumu: ${integration.setup_progress || 0}%`] }
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

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/50 p-0 sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[88vh] sm:w-[min(1200px,94vw)] sm:rounded-[26px]" onMouseDown={(event) => event.stopPropagation()}>
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 p-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">Müşteri Profili</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">{company.name}</h2>
            <p className="mt-1 text-sm text-slate-500">{company.status || "Aktif"} · {company.city || "Şehir yok"} · {company.sector || "Sektör yok"}</p>
          </div>
          <button onClick={onClose} aria-label="Kapat" className="rounded-full border border-slate-200 p-2 text-slate-500"><X size={18} /></button>
        </header>
        <div className="flex-1 overflow-y-auto p-5">
          {actionResult && <div className="mb-5"><ActionResultPanel result={actionResult} onNavigate={(href) => window.location.assign(href)} /></div>}
          {!showOverview && children && <div className="mb-5">{children}</div>}
          {showOverview && (
            <>
              <div className="sticky top-0 z-10 -mx-5 -mt-5 border-b border-slate-200 bg-white/95 px-5 py-3 backdrop-blur">
                <div className="premium-scrollbar flex gap-2 overflow-x-auto pb-1">
                  {profileTabs.map((tab) => (
                    <button key={tab} type="button" onClick={() => setActiveProfileTab(tab)} className={`shrink-0 rounded-full px-3 py-2 text-xs font-black ring-1 transition ${activeProfileTab === tab ? "bg-cyan-500 text-white ring-cyan-500" : "bg-slate-50 text-slate-600 ring-slate-200 hover:bg-cyan-50 hover:text-cyan-700"}`}>
                      {tab}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {activeTabCards().map((card) => <SummaryBox key={card.title} title={card.title} lines={card.lines} />)}
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <SummaryBox title="Kurulum durumu" lines={[`Sağlık skoru: ${profileHealth.score}/100`, `Durum: ${profileHealth.status}`, ...(profileHealth.reasons || [])]} />
                <SummaryBox title="Operasyon özeti" lines={[`Görev: ${tasks.length}`, `Rapor: ${reports.length}`, `Tahsilat: ${payments.length}`, `Kampanya: ${campaigns.length}`]} />
                <SummaryBox title="Ajans Operasyon Özeti" lines={[`Uygulanan paket: ${applications.length}`, `Şube: ${branches.length}`, `Aktif görev: ${tasks.filter((item: any) => !["Tamamlandı", "İptal"].includes(item.status)).length}`, `Bekleyen rapor: ${reports.filter((item: any) => !item.visible_to_customer).length}`, `Eksik entegrasyon: ${missingIntegrations.length ? missingIntegrations.join(", ") : "Yok"}`, `Sonraki 7 gün planı: ${(latestApplication.seven_day_plan || []).length} adım`]} />
                <SummaryBox title="Müşteri Finans Özeti" lines={[`Toplam tahsilat kaydı: ${payments.length}`, `Bekleyen ödeme: ${payments.filter((item: any) => !paidStatuses.includes(item.status)).length}`, `Tahsil edilen: ${payments.filter((item: any) => paidStatuses.includes(item.status)).length}`, `Geciken ödeme: ${overduePayments.length}`]} />
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <button onClick={() => onGo?.("Müşteriler", "Müşteri detayına gidildi.")} className="rounded-[12px] bg-cyan-500 px-4 py-3 text-sm font-black text-white">Müşteri detayına git</button>
                <button onClick={() => onGo?.("Web Site Analitiği")} className="rounded-[12px] border border-cyan-200 bg-white px-4 py-3 text-sm font-black text-cyan-700">Entegrasyonları aç</button>
                <button onClick={() => onGo?.("HK Agent Hub")} className="rounded-[12px] border border-cyan-200 bg-white px-4 py-3 text-sm font-black text-cyan-700">Agent Hub’da analiz et</button>
                <button onClick={() => onGo?.("Müşteri Raporları")} className="rounded-[12px] border border-cyan-200 bg-white px-4 py-3 text-sm font-black text-cyan-700">Rapor oluştur</button>
                <button onClick={() => onGo?.("Görevler")} className="rounded-[12px] border border-cyan-200 bg-white px-4 py-3 text-sm font-black text-cyan-700">Görev oluştur</button>
              </div>
            </>
          )}
          <section className="mt-6 rounded-[22px] border border-slate-200 bg-slate-50 p-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[.14em] text-cyan-700">Operasyon Detayları</p>
              <h3 className="mt-1 text-lg font-black text-slate-950">Şubeler, rakipler ve uygulanan planlar</h3>
              <p className="mt-1 text-sm text-slate-500">Bu bloklar temel müşteri bilgileri ve sekme içeriklerinden sonra gösterilir.</p>
            </div>
          </section>
          <section className="mt-4 rounded-[18px] border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-black text-slate-950">Şubeler</h3>
                <p className="mt-1 text-sm text-slate-500">Şube bazlı reklam, rapor, entegrasyon ve KPI yönetimi için kayıtlı lokasyonlar.</p>
              </div>
              <button onClick={() => openBranchForm()} className="rounded-[12px] bg-cyan-500 px-4 py-2.5 text-sm font-black text-white">Şube Ekle</button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {branches.map((branch: any) => (
                <div key={branch.id} className="rounded-[16px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-black text-slate-950">{branch.branch_name || "Adsız şube"}</p>
                      <p className="mt-1 text-xs text-slate-500">{branch.city || "Şehir yok"} · {branch.district || "İlçe yok"}</p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <span className={`rounded-full px-2 py-1 text-[10px] font-black ring-1 ${statusTone(branch.status, branch.is_active)}`}>{statusLabel(branch.status, branch.is_active)}</span>
                      <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-cyan-700 ring-1 ring-cyan-200">{branch.monthly_ad_budget ? `Bütçe ${branch.monthly_ad_budget} TL` : "Bütçe yok"}</span>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-1 text-xs leading-5 text-slate-600">
                    <span>Adres: {branchDisplay(branch.address)}</span>
                    <span>Telefon/WhatsApp: {formatTurkishPhone(branch.phone || branch.whatsapp) || "Mevcut değil"}</span>
                    <span>E-posta: {branchDisplay(branch.email)}</span>
                    <span>Website/Landing: {branchDisplay(branch.website_url || branch.landing_page_url)}</span>
                    <span>Meta: {branch.meta_ad_account_id || "Eksik"} · Google Ads: {branch.google_ads_customer_id || "Eksik"} · GA4: {branch.ga4_property_id || "Eksik"}</span>
                    <span>Sorumlu: {branch.responsible_person || "Belirtilmedi"}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={() => openBranchForm(branch)} className="rounded-[10px] bg-cyan-500 px-3 py-1.5 text-xs font-black text-white">Şubeyi Düzenle</button>
                    <button onClick={() => passiveBranch(branch)} disabled={branchSaving || branch.status === "passive" || branch.is_active === false} className="rounded-[10px] border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-600 disabled:opacity-50">Şubeyi Pasife Al</button>
                    <button onClick={() => createBranchReport(branch)} className="rounded-[10px] border border-cyan-200 bg-white px-3 py-1.5 text-xs font-black text-cyan-700">Şube Raporu Oluştur</button>
                    <button onClick={() => startBranchAnalysis(branch)} className="rounded-[10px] border border-cyan-200 bg-white px-3 py-1.5 text-xs font-black text-cyan-700">Şube İçin Agent Analizi</button>
                    <button onClick={() => openMaps(branch)} className="rounded-[10px] border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-600">Google Maps’te Aç</button>
                  </div>
                </div>
              ))}
              {!branches.length && <p className="rounded-[14px] border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Bu müşteri için henüz şube yok. İlk şubeyi ekleyerek şube bazlı rapor ve reklam takibine başlayabilirsin.</p>}
            </div>
            {branchMessage && <p className="mt-3 rounded-[12px] border border-cyan-200 bg-cyan-50 p-3 text-sm font-bold text-cyan-800">{branchMessage}</p>}
          </section>
          <section className="mt-5 rounded-[18px] border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-black text-slate-950">Rakipler</h3>
                <p className="mt-1 text-sm text-slate-500">Rakip firma izleme, reklam/paylaşım sinyali, Google yorum takibi ve müşteriye açık rekabet özeti.</p>
              </div>
              <button onClick={() => onGo?.("Rakip Analizi", "Rakip ekleme ve AI ile rakip bulma alanı açıldı.")} className="rounded-[12px] bg-cyan-500 px-4 py-2.5 text-sm font-black text-white">Rakip Analizine Git</button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {(content?.competitorWatchlist || content?.competitorAnalyses || []).filter((item: any) => item.company_id === company?.id).slice(0, 6).map((item: any) => (
                <div key={item.id || item.competitor_name || item.name} className="rounded-[14px] border border-slate-200 bg-slate-50 p-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-black text-slate-950">{item.competitor_name || item.name || item.sector || "Rakip kaydı"}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.website_url || item.website || "Web sitesi yok"} · {item.city || company.city || "Şehir yok"} / {item.district || "İlçe yok"}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-black ring-1 ${item.show_to_customer || item.show_customer_summary ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-white text-slate-600 ring-slate-200"}`}>{item.show_to_customer || item.show_customer_summary ? "Müşteriye açık" : "Sadece admin"}</span>
                  </div>
                  <div className="mt-3 grid gap-1 text-xs text-slate-600">
                    <span>Rakip skoru: {item.competitor_score || 0} · Tehdit: {item.threat_score || 0} · Fırsat: {item.opportunity_score || 0}</span>
                    <span>Son kontrol: {item.last_checked_at ? new Date(item.last_checked_at).toLocaleDateString("tr-TR") : "Henüz yok"}</span>
                    <span>Google Maps kontrolü: {item.last_maps_checked_at ? new Date(item.last_maps_checked_at).toLocaleDateString("tr-TR") : "Henüz yok"} · Meta kontrolü: {item.last_meta_checked_at ? new Date(item.last_meta_checked_at).toLocaleDateString("tr-TR") : "Henüz yok"}</span>
                    <span>Bildirimler: {item.notify_on_new_ads || item.notify_on_review_change || item.notify_on_price_change ? "Aktif" : "Kapalı"}</span>
                    <span>{item.customer_summary || item.customer_visible_summary || item.last_analysis_summary || "Müşteri özeti henüz üretilmedi."}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a href={item.google_place_id ? `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(item.google_place_id)}` : item.google_maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([item.competitor_name || item.name, item.address, item.city, item.district].filter(Boolean).join(" "))}`} target="_blank" rel="noreferrer" className="rounded-[10px] border border-cyan-200 bg-white px-3 py-1.5 text-xs font-black text-cyan-700">Google Maps’te aç</a>
                    <a href={item.meta_ad_library_url || `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=TR&q=${encodeURIComponent(item.competitor_name || item.name || "")}`} target="_blank" rel="noreferrer" className="rounded-[10px] border border-blue-200 bg-white px-3 py-1.5 text-xs font-black text-blue-700">Meta reklamlarını aç</a>
                    <button onClick={() => onGo?.("HK Agent Hub", "Rakip için Agent analizi açıldı.")} className="rounded-[10px] border border-cyan-200 bg-white px-3 py-1.5 text-xs font-black text-cyan-700">Agent ile analiz et</button>
                    <button onClick={() => onGo?.("Rakip Analizi", "Rakip reklam kontrolü açıldı.")} className="rounded-[10px] border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700">Reklamları kontrol et</button>
                    <button onClick={() => onGo?.("Rakip Analizi", "Rakip detay inceleme modalı açıldı.")} className="rounded-[10px] border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700">Detaylı gör</button>
                    <button onClick={() => onGo?.("Rakip Analizi", "AI ile rakip bulma ve müşteri özeti alanı açıldı.")} className="rounded-[10px] border border-emerald-200 bg-white px-3 py-1.5 text-xs font-black text-emerald-700">AI ile rakip bul</button>
                  </div>
                </div>
              ))}
              {!(content?.competitorWatchlist || content?.competitorAnalyses || []).filter((item: any) => item.company_id === company?.id).length && (
                <p className="rounded-[14px] border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Henüz rakip kaydı yok. Rakip Analizi ekranından rakip ekleyebilir veya AI ile öneri üretebilirsin.</p>
              )}
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-[14px] border border-emerald-200 bg-emerald-50 p-3">
                <h4 className="font-black text-slate-950">Takip Edilen Rakipler</h4>
                <div className="mt-3 grid gap-2">
                  {(content?.competitorWatchlist || []).filter((item: any) => item.company_id === company?.id && (item.is_tracking || item.notify_on_new_ads || item.notify_on_review_change || item.notify_on_price_change)).slice(0, 4).map((item: any) => (
                    <div key={item.id || item.competitor_name} className="rounded-[10px] bg-white p-2 text-xs text-slate-700 ring-1 ring-emerald-200">
                      <p className="font-black text-slate-950">{item.competitor_name || item.name || "Rakip"}</p>
                      <p>Skor: {item.competitor_score || 0} · Tehdit: {item.threat_score || 0} · Son kontrol: {item.last_checked_at ? new Date(item.last_checked_at).toLocaleDateString("tr-TR") : "Henüz yok"}</p>
                      <p>{item.show_to_customer || item.show_customer_summary ? "Müşteriye açık" : "Sadece admin"} · Bildirim: {item.notification_channels?.length || item.notify_on_new_ads ? "Açık" : "Kapalı"}</p>
                    </div>
                  ))}
                  {!(content?.competitorWatchlist || []).filter((item: any) => item.company_id === company?.id && (item.is_tracking || item.notify_on_new_ads || item.notify_on_review_change || item.notify_on_price_change)).length && <p className="text-sm text-emerald-800">Bu müşteri için takip edilen rakip yok.</p>}
                </div>
              </div>
              <div className="rounded-[14px] border border-blue-200 bg-blue-50 p-3">
                <h4 className="font-black text-slate-950">Yeni Sinyaller</h4>
                <div className="mt-3 grid gap-2">
                  {(content?.competitorSignals || []).filter((signal: any) => signal.company_id === company?.id).slice(0, 4).map((signal: any) => (
                    <div key={signal.id || signal.title} className="rounded-[10px] bg-white p-2 text-xs text-slate-700 ring-1 ring-blue-200">
                      <p className="font-black text-slate-950">{signal.title || "Rakip sinyali"}</p>
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
                <h3 className="font-black text-slate-950">Uygulanan Paketler / Planlar</h3>
                <p className="mt-1 text-sm text-cyan-900">Hazır paket uygulamaları, takip metrikleri ve ilk 7/30 günlük plan özetleri.</p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-cyan-700 ring-1 ring-cyan-200">{applications.length} kayıt</span>
            </div>
            <div className="mt-4 grid gap-2">
              {applications.slice(0, 5).map((application: any) => (
                <div key={application.id || application.created_at} className="rounded-[14px] border border-cyan-200 bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-black text-slate-950">{packageTitle(application)}</p>
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700 ring-1 ring-emerald-200">{applicationStatus(application.status)}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Uygulama tarihi: {application.created_at ? new Date(application.created_at).toLocaleString("tr-TR") : "Tarih yok"}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold text-slate-600">
                    <span>Görev: {countFromSummary(application, "tasks")}</span>
                    <span>Hafıza: {countFromSummary(application, "memory")}</span>
                    <span>Rapor: {countFromSummary(application, "reportTemplate")}</span>
                    <span>Teklif: {countFromSummary(application, "proposalDraft")}</span>
                    <span>Takip metriği: {(application.tracking_metrics || []).length}</span>
                    <span>7 gün: {(application.seven_day_plan || []).length} adım</span>
                    <span>30 gün: {(application.thirty_day_plan || []).length} hafta</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={() => onGo?.("HK Intelligence CEO", "Uygulanan plan açıldı.")} className="rounded-[10px] bg-cyan-500 px-3 py-1.5 text-xs font-black text-white">Aç / Devam Et</button>
                    <button onClick={() => onGo?.("Müşteri Raporları", "Rapor oluşturma alanı açıldı.")} className="rounded-[10px] border border-cyan-200 bg-white px-3 py-1.5 text-xs font-black text-cyan-700">Rapor Oluştur</button>
                  </div>
                </div>
              ))}
              {!applications.length && <p className="rounded-[12px] border border-dashed border-cyan-200 bg-white p-4 text-sm text-cyan-800">Bu müşteri için uygulanmış hazır paket henüz yok.</p>}
            </div>
          </section>
          {showOverview && children && <div className="mt-5">{children}</div>}
        </div>
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
      <section className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[88vh] sm:max-w-4xl sm:rounded-[24px]" onMouseDown={(event) => event.stopPropagation()}>
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 p-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">Şube Yönetimi</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">{editing ? "Şubeyi Düzenle" : "Yeni Şube Ekle"}</h2>
            <p className="mt-1 text-sm text-slate-500">Şube bazlı reklam, rapor ve entegrasyon takibi için gerekli alanları doldurun.</p>
          </div>
          <button onClick={onClose} aria-label="Kapat" className="rounded-full border border-slate-200 p-2 text-slate-500"><X size={18} /></button>
        </header>
        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid gap-3 md:grid-cols-3">
            {fields.map(([key, label]) => (
              <label key={key} className="grid gap-1 text-sm font-bold text-slate-700">
                {label}
                <input
                  value={form[key] || ""}
                  onChange={(event) => setForm({ ...form, [key]: key === "phone" || key === "whatsapp" ? formatTurkishPhone(event.target.value) : event.target.value })}
                  onBlur={() => (key === "phone" || key === "whatsapp") && setForm({ ...form, [key]: formatTurkishPhone(normalizePhoneInput(form[key])) })}
                  className="rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900"
                />
              </label>
            ))}
            <label className="grid gap-1 text-sm font-bold text-slate-700">
              Durum
              <select value={form.status || "active"} onChange={(event) => setForm({ ...form, status: event.target.value })} className="rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900">
                <option value="active">Aktif</option>
                <option value="passive">Pasif</option>
                <option value="needs_review">Kontrol gerekli</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-bold text-slate-700 md:col-span-3">
              Notlar
              <textarea value={form.notes || ""} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="min-h-24 rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900" />
            </label>
          </div>
          {message && <p className="mt-4 rounded-[12px] border border-cyan-200 bg-cyan-50 p-3 text-sm font-bold text-cyan-800">{message}</p>}
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 p-5">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => window.open(form.google_maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([form.address, form.district, form.city, form.branch_name].filter(Boolean).join(" "))}`, "_blank", "noopener,noreferrer")} className="rounded-[12px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700">Google Maps’te Aç</button>
            <button onClick={() => onGo?.("HK Agent Hub", "Şube için Agent analizi açıldı.")} className="rounded-[12px] border border-cyan-200 bg-white px-4 py-2.5 text-sm font-black text-cyan-700">Şube İçin Agent Analizi</button>
            <button onClick={() => onGo?.("Müşteri Raporları", "Şube raporu oluşturma alanı açıldı.")} className="rounded-[12px] border border-cyan-200 bg-white px-4 py-2.5 text-sm font-black text-cyan-700">Şube Raporu Oluştur</button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={onClose} className="rounded-[12px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-600">Vazgeç</button>
            <button onClick={onSave} disabled={saving} className="rounded-[12px] bg-cyan-500 px-4 py-2.5 text-sm font-black text-white disabled:opacity-60">{saving ? "Kaydediliyor..." : editing ? "Şubeyi Güncelle" : "Kaydet"}</button>
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
      <section className="w-full max-w-2xl rounded-[22px] bg-white p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[.14em] text-cyan-700">Şube Aksiyonu</p>
            <h3 className="mt-1 text-xl font-black text-slate-950">{action.title}</h3>
            <p className="mt-1 text-sm text-slate-500">{branch.branch_name || "Şube"} · {company.name}</p>
          </div>
          <button onClick={onClose} className="rounded-full border border-slate-200 p-2 text-slate-500"><X size={18} /></button>
        </div>
        {action.type === "message" && <p className="mt-4 rounded-[14px] border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">{action.message}</p>}
        {action.type === "agent" && (
          <div className="mt-4 grid gap-3">
            <p className="text-sm text-slate-600">Eksik entegrasyonlar: <b>{action.missing?.length ? action.missing.join(", ") : "Kritik eksik görünmüyor"}</b></p>
            <div className="grid gap-2 sm:grid-cols-5">{["reklam", "SEO", "Maps", "rakip", "genel"].map((item) => <span key={item} className="rounded-full bg-cyan-50 px-3 py-2 text-center text-xs font-black text-cyan-700 ring-1 ring-cyan-200">{item}</span>)}</div>
            <button onClick={() => window.location.assign(agentHref)} className="rounded-[12px] bg-cyan-500 px-4 py-3 text-sm font-black text-white">Agent Hub’da Şube Analizi Başlat</button>
          </div>
        )}
        {action.type === "report" && (
          <div className="mt-4 grid gap-3">
            <label className="grid gap-2 text-sm font-bold text-slate-700">Rapor türü<select value={reportType} onChange={(event) => setReportType(event.target.value)} className="rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-3 text-slate-900">{reportTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
            <pre className="max-h-48 overflow-auto rounded-[12px] bg-slate-950 p-3 text-xs text-cyan-50">{JSON.stringify(reportPayload, null, 2)}</pre>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => onGo?.("Müşteri Raporları", `${reportType} hazırlık verisi oluşturuldu.`)} className="rounded-[12px] bg-cyan-500 px-4 py-3 text-sm font-black text-white">Rapor Oluştur</button>
              <button onClick={() => navigator.clipboard?.writeText(JSON.stringify(reportPayload, null, 2))} className="rounded-[12px] border border-cyan-200 bg-white px-4 py-3 text-sm font-black text-cyan-700">Hazırlık Verisini Kopyala</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
