"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

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
  const branches = customerBranches(company, content);
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

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/50 p-0 sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[85vh] sm:max-w-6xl sm:rounded-[26px]" onMouseDown={(event) => event.stopPropagation()}>
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 p-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">Müşteri Profili</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">{company.name}</h2>
            <p className="mt-1 text-sm text-slate-500">{company.status || "Aktif"} · {company.city || "Şehir yok"} · {company.sector || "Sektör yok"}</p>
          </div>
          <button onClick={onClose} aria-label="Kapat" className="rounded-full border border-slate-200 p-2 text-slate-500"><X size={18} /></button>
        </header>
        <div className="flex-1 overflow-y-auto p-5">
          {showOverview && (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <SummaryBox title="Genel bilgiler" lines={[`Firma: ${company.name}`, `Yetkili: ${company.contact_name || company.authorized_person || "Yok"}`, `Web: ${company.website || "Yok"}`, `Instagram: ${company.instagram || "Yok"}`]} />
                <SummaryBox title="İletişim" lines={[`E-posta: ${company.email || "Yok"}`, `Telefon: ${company.phone || "Yok"}`, `Şehir: ${company.city || "Yok"}`, `Not: ${company.notes || "Yok"}`]} />
                <SummaryBox title="Kurulum durumu" lines={[`Sağlık skoru: ${profileHealth.score}/100`, `Durum: ${profileHealth.status}`, ...(profileHealth.reasons || [])]} />
                <SummaryBox title="Entegrasyonlar" lines={[`Pixel: ${integration.meta_pixel_id ? "Var" : "Eksik"}`, `Dataset: ${integration.meta_dataset_id ? "Var" : "Eksik"}`, `GA4: ${integration.ga4_measurement_id || integration.ga4_property_id ? "Var" : "Eksik"}`, `Google Ads: ${integration.google_ads_customer_id ? "Var" : "Eksik"}`]} />
                <SummaryBox title="Operasyon özeti" lines={[`Görev: ${tasks.length}`, `Rapor: ${reports.length}`, `Tahsilat: ${payments.length}`, `Kampanya: ${campaigns.length}`]} />
                <SummaryBox title="Ajans Operasyon Özeti" lines={[`Uygulanan paket: ${applications.length}`, `Şube: ${branches.length}`, `Aktif görev: ${tasks.filter((item: any) => !["Tamamlandı", "İptal"].includes(item.status)).length}`, `Bekleyen rapor: ${reports.filter((item: any) => !item.visible_to_customer).length}`, `Eksik entegrasyon: ${missingIntegrations.length ? missingIntegrations.join(", ") : "Yok"}`, `Sonraki 7 gün planı: ${(latestApplication.seven_day_plan || []).length} adım`]} />
                <SummaryBox title="Tahsilat özeti" lines={[`Toplam kayıt: ${payments.length}`, `Bekleyen: ${payments.filter((item: any) => !paidStatuses.includes(item.status)).length}`, `Tahsil edilen: ${payments.filter((item: any) => paidStatuses.includes(item.status)).length}`]} />
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
          <section className="mt-5 rounded-[18px] border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-black text-slate-950">Şubeler</h3>
                <p className="mt-1 text-sm text-slate-500">Şube bazlı reklam, rapor, entegrasyon ve KPI yönetimi için kayıtlı lokasyonlar.</p>
              </div>
              <button onClick={() => onGo?.("Müşteriler", "Şube ekleme için müşteri detayları açıldı.")} className="rounded-[12px] bg-cyan-500 px-4 py-2.5 text-sm font-black text-white">Şube Ekle</button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {branches.map((branch: any) => (
                <div key={branch.id} className="rounded-[16px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-black text-slate-950">{branch.branch_name || "Adsız şube"}</p>
                      <p className="mt-1 text-xs text-slate-500">{branch.city || "Şehir yok"} · {branch.district || "İlçe yok"} · {branch.status || (branch.is_active === false ? "pasif" : "active")}</p>
                    </div>
                    <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-cyan-700 ring-1 ring-cyan-200">{branch.monthly_ad_budget ? `Bütçe ${branch.monthly_ad_budget} TL` : "Bütçe yok"}</span>
                  </div>
                  <div className="mt-3 grid gap-1 text-xs leading-5 text-slate-600">
                    <span>Adres: {branch.address || "Yok"}</span>
                    <span>Telefon/WhatsApp: {branch.phone || branch.whatsapp || "Yok"}</span>
                    <span>E-posta: {branch.email || "Yok"}</span>
                    <span>Website/Landing: {branch.website_url || branch.landing_page_url || "Yok"}</span>
                    <span>Meta: {branch.meta_ad_account_id || "Eksik"} · Google Ads: {branch.google_ads_customer_id || "Eksik"} · GA4: {branch.ga4_property_id || "Eksik"}</span>
                    <span>Sorumlu: {branch.responsible_person || "Belirtilmedi"}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={() => onGo?.("Müşteriler", "Şube düzenleme için müşteri detayları açıldı.")} className="rounded-[10px] bg-cyan-500 px-3 py-1.5 text-xs font-black text-white">Şubeyi Düzenle</button>
                    <button onClick={() => onGo?.("Müşteri Raporları", "Şube raporu oluşturma alanı açıldı.")} className="rounded-[10px] border border-cyan-200 bg-white px-3 py-1.5 text-xs font-black text-cyan-700">Şube Raporu Oluştur</button>
                    <button onClick={() => onGo?.("HK Agent Hub", "Şube için Agent analizi açıldı.")} className="rounded-[10px] border border-cyan-200 bg-white px-3 py-1.5 text-xs font-black text-cyan-700">Şube İçin Agent Analizi</button>
                    {branch.google_maps_url && <button onClick={() => window.open(branch.google_maps_url, "_blank", "noopener,noreferrer")} className="rounded-[10px] border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-600">Google Maps’te Aç</button>}
                  </div>
                </div>
              ))}
              {!branches.length && <p className="rounded-[14px] border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Bu müşteri için henüz şube kaydı yok. Şube Ekle ile ilk lokasyonu tanımlayabilirsin.</p>}
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
          {children && <div className="mt-5">{children}</div>}
        </div>
      </section>
    </div>
  );
}
