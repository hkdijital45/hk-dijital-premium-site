"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Mail, MapPin, MessageCircle, Phone, ShieldCheck } from "lucide-react";

// Canonical 25-tab set shared by every Customer 360 container (drawer + modal).
// Resolves the previous 24 vs 25 tab drift between CustomerDetailDrawer and
// CustomerProfileModal — both now render this exact same list in this order.
export const CUSTOMER_360_TABS = [
  "Genel Bilgi",
  "Büyüme",
  "Müşteri Kurulumu",
  "Entegrasyonlar",
  "Platform Yönetimi",
  "Müşteri Paneli Yetkileri",
  "Bağlantı Bilgileri",
  "Marka Varlıkları",
  "İletişim",
  "İletişim Geçmişi",
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
] as const;

function isArchived(item: any) {
  return Boolean(item?.deleted_at || item?.archived_at || item?.status === "Arşivli" || item?.status === "Silindi");
}

function customerHealth(company: any, content: any) {
  const today = new Date().toISOString().slice(0, 10);
  const companyId = company?.id;
  const payments = (content?.paymentRecords || []).filter((item: any) => item.company_id === companyId && !isArchived(item));
  const tasks = (content?.agencyTasks || []).filter((item: any) => item.company_id === companyId && !isArchived(item));
  const reports = (content?.reports || []).filter((item: any) => item.company_id === companyId);
  const overduePayments = payments.filter((item: any) => !["Ödendi", "Tahsil Edildi"].includes(item.status) && item.due_date && item.due_date < today);
  const overdueTasks = tasks.filter((item: any) => !["Tamamlandı", "İptal"].includes(item.status) && item.due_date && item.due_date < today);
  let score = 100;
  if (overduePayments.length) score -= 22;
  if (overdueTasks.length) score -= 16;
  if (!reports.length) score -= 8;
  score = Math.max(0, Math.min(100, score));
  return {
    score,
    status: score >= 75 ? "Sağlıklı" : score >= 50 ? "Riskli" : "Kritik",
    tone: score >= 75 ? "success" : score >= 50 ? "warning" : "danger",
    pendingPayments: payments.filter((item: any) => !["Ödendi", "Tahsil Edildi"].includes(item.status)),
    paidTotal: payments.filter((item: any) => ["Ödendi", "Tahsil Edildi"].includes(item.status)).reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0),
    openTasks: tasks.filter((item: any) => !["Tamamlandı", "İptal"].includes(item.status))
  };
}

function setupProgress(company: any, content: any) {
  const integration = (content?.customerIntegrations || []).find((item: any) => item.company_id === company?.id) || {};
  const users = (content?.users || []).filter((item: any) => item.company_id === company?.id);
  const steps = [
    Boolean(company?.name && company?.sector && company?.city),
    Boolean(company?.customer_package_name || company?.customer_package_type),
    users.length > 0,
    Boolean(integration.meta_pixel_id || integration.ga4_measurement_id || integration.google_ads_customer_id),
    Boolean((content?.campaigns || []).some((item: any) => item.company_id === company?.id))
  ];
  const done = steps.filter(Boolean).length;
  return { done, total: steps.length, percent: Math.round((done / steps.length) * 100) };
}

export function Customer360Header({
  company,
  content,
  onNavigate,
  onWhatsApp,
  onResetPassword
}: {
  company: any;
  content: any;
  onNavigate?: (target: string, message?: string) => void;
  onWhatsApp?: () => void;
  onResetPassword?: () => void;
}) {
  if (!company) return null;
  const health = customerHealth(company, content);
  const setup = setupProgress(company, content);
  const packageName = company.customer_package_name || company.customer_package_type || "Paketsiz";
  const monthlyFee = Number(company.customer_package_price || 0);
  const initials = String(company.name || "?").trim().slice(0, 2).toLocaleUpperCase("tr");

  return (
    <div className="hk-customer-header admin-card mb-5 overflow-hidden rounded-[24px]">
      <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
        <div className="flex min-w-0 items-start gap-4">
          <span className="grid size-16 shrink-0 place-items-center rounded-[18px] bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 text-2xl font-black text-white shadow-lg">{initials}</span>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[.18em]" style={{ color: "var(--nav-accent-text, #0e7490)" }}>Müşteri 360</p>
            <h2 className="mt-1 truncate text-2xl font-black tracking-tight sm:text-3xl" style={{ color: "var(--admin-text-primary)" }}>{company.name}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-semibold" style={{ color: "var(--admin-text-secondary)" }}>
              <span className="inline-flex items-center gap-1"><MapPin size={14} />{company.city || "Şehir yok"}</span>
              <span aria-hidden="true">·</span>
              <span>{company.sector || "Sektör yok"}</span>
              <span className="rounded-full px-2.5 py-0.5 text-xs font-black ring-1" style={{ background: "var(--admin-surface-soft)", borderColor: "var(--admin-border)", color: "var(--admin-text-secondary)" }}>{company.status || "Aktif"}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {onWhatsApp && <button type="button" onClick={onWhatsApp} className="hk-button hk-button-success hk-button-compact"><MessageCircle size={15} /> WhatsApp</button>}
          {company.phone && <a href={`tel:${company.phone}`} className="hk-button hk-button-info hk-button-compact"><Phone size={15} /> Ara</a>}
          {company.email && <a href={`mailto:${company.email}`} className="hk-button hk-button-neutral hk-button-compact"><Mail size={15} /> E-posta</a>}
          {onResetPassword && <button type="button" onClick={onResetPassword} className="hk-button hk-button-warning hk-button-compact"><ShieldCheck size={15} /> Şifre Sıfırla</button>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 border-t p-4 sm:grid-cols-4 sm:p-5" style={{ borderColor: "var(--admin-border)" }}>
        <div className={`hk-kpi-card hk-kpi-${health.tone}`}>
          <span className="hk-kpi-icon">🩺</span>
          <span className="mt-3 block text-xs font-black" style={{ color: "var(--admin-text-secondary)" }}>Sağlık Skoru</span>
          <strong className="mt-1 block text-xl" style={{ color: "var(--admin-text-primary)" }}>{health.score}/100</strong>
          <span className="mt-1 block text-xs" style={{ color: "var(--admin-text-muted)" }}>{health.status}</span>
        </div>
        <div className="hk-kpi-card hk-kpi-primary">
          <span className="hk-kpi-icon">📦</span>
          <span className="mt-3 block text-xs font-black" style={{ color: "var(--admin-text-secondary)" }}>Paket</span>
          <strong className="mt-1 block truncate text-xl" style={{ color: "var(--admin-text-primary)" }}>{packageName}</strong>
          <span className="mt-1 block text-xs" style={{ color: "var(--admin-text-muted)" }}>{monthlyFee ? `${monthlyFee.toLocaleString("tr-TR")} TL/ay` : "Ücret tanımsız"}</span>
        </div>
        <div className="hk-kpi-card hk-kpi-warning">
          <span className="hk-kpi-icon">💳</span>
          <span className="mt-3 block text-xs font-black" style={{ color: "var(--admin-text-secondary)" }}>Bekleyen Tahsilat</span>
          <strong className="mt-1 block text-xl" style={{ color: "var(--admin-text-primary)" }}>{health.pendingPayments.length}</strong>
          <span className="mt-1 block text-xs" style={{ color: "var(--admin-text-muted)" }}>{health.paidTotal.toLocaleString("tr-TR")} TL tahsil edildi</span>
        </div>
        <div className="hk-kpi-card hk-kpi-success">
          <span className="hk-kpi-icon">✅</span>
          <span className="mt-3 block text-xs font-black" style={{ color: "var(--admin-text-secondary)" }}>Kurulum İlerlemesi</span>
          <strong className="mt-1 block text-xl" style={{ color: "var(--admin-text-primary)" }}>%{setup.percent}</strong>
          <span className="mt-1 block text-xs" style={{ color: "var(--admin-text-muted)" }}>{setup.done}/{setup.total} adım tamam</span>
        </div>
      </div>
      {onNavigate && (
        <div className="flex flex-wrap gap-2 border-t p-4 sm:p-5" style={{ borderColor: "var(--admin-border)" }}>
          <button type="button" onClick={() => onNavigate("Satış Hunisi")} className="hk-button hk-button-info hk-button-compact">Satış Hunisini Aç</button>
          <button type="button" onClick={() => onNavigate("Müşteri Raporları")} className="hk-button hk-button-neutral hk-button-compact">Rapor Oluştur</button>
          <button type="button" onClick={() => onNavigate("Görevler")} className="hk-button hk-button-neutral hk-button-compact">Görev Oluştur</button>
          <button type="button" onClick={() => onNavigate("HK Agent Hub")} className="hk-button hk-button-ai hk-button-compact">Agent Hub&apos;da Analiz Et</button>
        </div>
      )}
    </div>
  );
}

