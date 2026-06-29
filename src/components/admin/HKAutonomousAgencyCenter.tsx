"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Bot,
  BrainCircuit,
  BriefcaseBusiness,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  Command,
  Copy,
  Database,
  FileText,
  Gauge,
  HeartPulse,
  Layers3,
  LineChart,
  Megaphone,
  MessageSquareText,
  Palette,
  Plus,
  Save,
  Search,
  ShieldAlert,
  Sparkles,
  Target,
  UsersRound,
  X,
  Zap
} from "lucide-react";
import { CustomerProfileModal } from "@/components/admin/customer-profile/CustomerProfileModal";
import { CustomerBranchFilter, getCompanyBranches } from "@/components/admin/customer-profile/CustomerBranchFilter";

const paidStatuses = ["Ödendi", "Tahsil Edildi"];
const doneStatuses = ["Tamamlandı", "İptal"];
const closedLeadStatuses = ["Kazanıldı", "Kaybedildi", "Dönüştürüldü", "Müşteri Oldu", "Reddedildi"];
const marketplaceSectors = ["Emlak", "Klinik", "Oto Galeri", "Nail Studio", "Diş Kliniği", "Cafe", "Restoran", "Kuaför", "Avukat", "Muhasebeci"];

function n(value: any) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  return Number(String(value ?? "").replace(/[^0-9,.-]/g, "").replace(",", ".")) || 0;
}

function money(value: any) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(n(value));
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function monthKey() {
  return todayKey().slice(0, 7);
}

function isArchived(item: any) {
  return Boolean(item?.deleted_at || item?.archived_at || item?.status === "Arşivli" || item?.status === "Silindi");
}

function daysSince(value: any) {
  if (!value) return 999;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 999;
  return Math.floor((Date.now() - date.getTime()) / 86400000);
}

function companyName(companies: any[], companyId: string) {
  return companies.find((item) => item.id === companyId)?.name || "Firma belirtilmedi";
}

function toneForSeverity(severity: string) {
  if (severity === "Kritik") return "bg-red-50 text-red-700 ring-red-200";
  if (severity === "Orta") return "bg-amber-50 text-amber-700 ring-amber-200";
  return "bg-cyan-50 text-cyan-700 ring-cyan-200";
}

function customerHealth(company: any, content: any) {
  const today = todayKey();
  const payments = (content.paymentRecords || []).filter((item: any) => item.company_id === company.id && !isArchived(item));
  const tasks = (content.agencyTasks || []).filter((item: any) => item.company_id === company.id && !isArchived(item));
  const campaigns = (content.campaigns || []).filter((item: any) => item.company_id === company.id && !isArchived(item));
  const reports = (content.reports || []).filter((item: any) => item.company_id === company.id && !isArchived(item));
  const integrations = (content.customerIntegrations || []).find((item: any) => item.company_id === company.id) || {};
  const overduePayments = payments.filter((item: any) => !paidStatuses.includes(item.status) && item.due_date && item.due_date < today);
  const overdueTasks = tasks.filter((item: any) => !doneStatuses.includes(item.status) && item.due_date && item.due_date < today);
  const activeCampaigns = campaigns.filter((item: any) => item.status === "Aktif");
  const reportAge = Math.min(...reports.map((item: any) => daysSince(item.updated_at || item.created_at)), 999);
  let score = 100;
  const reasons: string[] = [];
  if (overduePayments.length) { score -= 22; reasons.push(`${overduePayments.length} tahsilat gecikmiş.`); }
  if (overdueTasks.length) { score -= 16; reasons.push(`${overdueTasks.length} görev gecikmiş.`); }
  if (!activeCampaigns.length) { score -= 10; reasons.push("Aktif kampanya yok."); }
  if (reportAge > 45) { score -= 10; reasons.push("Rapor güncelliği 45 günü geçti."); }
  if (!integrations.meta_pixel_id && !integrations.ga4_measurement_id) { score -= 12; reasons.push("Pixel/GA4 kurulum bilgisi eksik."); }
  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, reasons: reasons.length ? reasons : ["Operasyon sinyalleri düzenli."], status: score >= 75 ? "Sağlıklı" : score >= 50 ? "Riskli" : "Kritik" };
}

function teamAgents(content: any) {
  const agentRuns = content.agentRuns || [];
  const roles = [
    ["CEO", "Tüm ajanları yönetir", "HK Intelligence Final Layer", Bot],
    ["Satış Müdürü", "Lead ve teklif önceliği", "OpenAI / Claude", Target],
    ["CRM Uzmanı", "Takip ve segmentasyon", "Gemini / OpenAI", UsersRound],
    ["Google Ads Uzmanı", "Google Ads ve Search Console", "Gemini", LineChart],
    ["Meta Ads Uzmanı", "Pixel, Dataset ve kreatif performansı", "OpenAI / Gemini", Megaphone],
    ["SEO Uzmanı", "SEO ve teknik görünürlük", "Gemini", Search],
    ["Kreatif Direktör", "Kreatif yön ve format", "Claude / OpenAI", Palette],
    ["Video Uzmanı", "Reels, Shorts, video fikirleri", "OpenAI", Zap],
    ["Reklam Metni Yazarı", "Metin ve kampanya dili", "Claude", MessageSquareText],
    ["Veri Analisti", "KPI, ROAS, LTV analizi", "Gemini / OpenAI", Gauge],
    ["Finans Yöneticisi", "Tahsilat ve kârlılık", "Yerel karar motoru", CircleDollarSign],
    ["Raporlama Yöneticisi", "Rapor ve müşteri özeti", "Claude / OpenAI", FileText],
    ["Müşteri Başarı Uzmanı", "Risk, onboarding ve yenileme", "HK Intelligence", HeartPulse]
  ];
  return roles.map(([name, task, ai, Icon], index) => {
    const relatedRun = agentRuns[index % Math.max(agentRuns.length, 1)] || {};
    const success = Math.max(72, 96 - index * 2);
    return {
      name,
      task,
      ai,
      Icon,
      status: index < 3 ? "Çalışıyor" : relatedRun.status === "failed" ? "Hatalı" : "Hazır",
      success,
      lastRun: relatedRun.created_at ? new Date(relatedRun.created_at).toLocaleString("tr-TR") : "Henüz çalışmadı",
      cost: money(n(relatedRun.estimated_cost) || index * 8)
    };
  });
}

function recommendations(content: any, riskyCustomers: any[], overduePayments: any[], openLeads: any[]) {
  const list = [
    riskyCustomers[0] ? { title: `${riskyCustomers[0].company.name} için müşteri kurtarma planı`, impact: "Yüksek", difficulty: "Orta", duration: "2 saat", cost: "Düşük", probability: 78, action: "Müşteri başarı görevi oluştur" } : null,
    overduePayments[0] ? { title: `${companyName(content.companies || [], overduePayments[0].company_id)} tahsilat hatırlatması`, impact: "Yüksek", difficulty: "Kolay", duration: "15 dk", cost: "Yok", probability: 70, action: "WhatsApp takip mesajı hazırla" } : null,
    openLeads[0] ? { title: `${openLeads[0].company || openLeads[0].name} için teklif ve arama planı`, impact: "Orta", difficulty: "Kolay", duration: "30 dk", cost: "Yok", probability: 64, action: "AI Satış Asistanı çalıştır" } : null,
    { title: "Aktif müşteriler için haftalık remarketing kontrolü", impact: "Orta", difficulty: "Orta", duration: "1 saat", cost: "Düşük", probability: 58, action: "Meta/Google kontrol görevi oluştur" },
    { title: "En iyi kreatifleri HK Öğrenme Merkezi hafızasına al", impact: "Orta", difficulty: "Kolay", duration: "20 dk", cost: "Yok", probability: 66, action: "AI Hafızası güncelle" }
  ].filter(Boolean);
  return list as Array<Record<string, any>>;
}

export function HKAutonomousAgencyCenter({ content, setActive, notify, compact = false }: any) {
  const [copilotQuestion, setCopilotQuestion] = useState("Bu hafta hangi müşterileri aramalıyım?");
  const [copilotAnswer, setCopilotAnswer] = useState("");
  const [commandQuery, setCommandQuery] = useState("");
  const [detail, setDetail] = useState<any>(null);
  const [marketplaceOpen, setMarketplaceOpen] = useState(false);
  const [marketplaceLoading, setMarketplaceLoading] = useState(false);
  const [marketplaceDraft, setMarketplaceDraft] = useState<any>(null);
  const [applyWizard, setApplyWizard] = useState<any>(null);
  const [applyResult, setApplyResult] = useState<any>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState("all");
  const [customerSearch, setCustomerSearch] = useState("");
  const [packageBuilderMode, setPackageBuilderMode] = useState<"ai" | "manual">("ai");
  const [selectedCustomerProfile, setSelectedCustomerProfile] = useState<any>(null);
  const [applicationDetail, setApplicationDetail] = useState<any>(null);
  const [applyOptions, setApplyOptions] = useState({
    saveMemory: true,
    createCustomerNote: true,
    createTasks: true,
    createWorkflowDraft: true,
    createKpiTemplate: true,
    createReportTemplate: true,
    createProposalDraft: true
  });
  const [packageForm, setPackageForm] = useState({
    sector: "Nail Studio",
    niche: "Premium tırnak ve bakım",
    targetCustomer: "Yerel hizmet işletmesi",
    region: "",
    serviceTypes: "Google Ads, Meta Ads, SEO, Landing Page, WhatsApp",
    monthlyBudgetRange: "30.000 - 100.000 TL",
    serviceFeeRange: "15.000 - 45.000 TL",
    mainGoal: "randevu",
    channels: "Meta, Google Ads, SEO, WhatsApp, içerik, web site",
    customerProblem: "Randevu kalitesi, ölçümleme ve düzenli takip eksikliği",
    competitionLevel: "Orta",
    salesProcess: "Keşif görüşmesi, teklif, takip, rapor disiplini",
    offerTone: "sade",
    packageLevel: "profesyonel",
    packageDuration: "30 gün",
    outputType: "hepsi",
    notes: ""
  });

  const data = useMemo(() => {
    const today = todayKey();
    const month = monthKey();
    const companies = (content.companies || []).filter((item: any) => !isArchived(item));
    const activeCustomers = companies.filter((item: any) => item.status === "Aktif");
    const passiveCustomers = companies.filter((item: any) => item.status === "Pasif");
    const leads = (content.leads || []).filter((item: any) => !isArchived(item));
    const openLeads = leads.filter((item: any) => !closedLeadStatuses.includes(item.status) && !closedLeadStatuses.includes(item.pipeline_stage));
    const newLeads = leads.filter((item: any) => String(item.created_at || "").startsWith(today));
    const tasks = (content.agencyTasks || []).filter((item: any) => !isArchived(item));
    const criticalTasks = tasks.filter((item: any) => !doneStatuses.includes(item.status) && (item.priority === "Kritik" || item.due_date && item.due_date <= today));
    const completedToday = tasks.filter((item: any) => doneStatuses.includes(item.status) && String(item.completed_at || item.updated_at || "").startsWith(today));
    const payments = (content.paymentRecords || []).filter((item: any) => !isArchived(item));
    const pendingPayments = payments.filter((item: any) => !paidStatuses.includes(item.status) && item.status !== "İptal");
    const overduePayments = pendingPayments.filter((item: any) => item.due_date && item.due_date < today);
    const paidThisMonth = payments.filter((item: any) => paidStatuses.includes(item.status) && String(item.payment_date || item.paid_at || item.updated_at || "").startsWith(month));
    const campaigns = (content.campaigns || []).filter((item: any) => !isArchived(item));
    const activeCampaigns = campaigns.filter((item: any) => item.status === "Aktif");
    const reports = (content.reports || []).filter((item: any) => !isArchived(item));
    const integrations = content.customerIntegrations || [];
    const customerBranches = (content.customerBranches || []).filter((item: any) => !isArchived(item));
    const healthRows = companies.map((company: any) => ({ company, health: customerHealth(company, content) })).sort((a: any, b: any) => a.health.score - b.health.score);
    const riskyCustomers = healthRows.filter((item: any) => item.health.score < 70);
    const revenue = paidThisMonth.reduce((sum: number, item: any) => sum + n(item.amount), 0);
    const receivable = pendingPayments.reduce((sum: number, item: any) => sum + n(item.amount), 0);
    const adSpend = campaigns.reduce((sum: number, item: any) => sum + n(item.spent_budget ?? item.spent), 0);
    const roasRows = campaigns.map((campaign: any) => ({ campaign, roas: n(campaign.revenue || campaign.conversion_value) / Math.max(1, n(campaign.spent_budget ?? campaign.spent)) })).sort((a: any, b: any) => b.roas - a.roas);
    const risks = [
      ...overduePayments.map((item: any) => ({ title: `${companyName(companies, item.company_id)} tahsilatı gecikti`, severity: "Kritik", module: "Tahsilat", detail: `${money(item.amount)} · Vade ${item.due_date}` })),
      ...criticalTasks.map((item: any) => ({ title: item.title || "Kritik görev", severity: item.priority === "Kritik" ? "Kritik" : "Orta", module: "Görev", detail: companyName(companies, item.company_id) })),
      ...integrations.filter((item: any) => !item.meta_pixel_id).slice(0, 6).map((item: any) => ({ title: `${companyName(companies, item.company_id)} Pixel eksik`, severity: "Orta", module: "Meta", detail: "Pixel çalışıyor mu kontrol edilmeli." })),
      ...integrations.filter((item: any) => !item.meta_dataset_id).slice(0, 6).map((item: any) => ({ title: `${companyName(companies, item.company_id)} Dataset eksik`, severity: "Orta", module: "Meta Dataset", detail: "Conversions API hazırlığı eksik." })),
      ...integrations.filter((item: any) => !item.ga4_property_id && !item.ga4_measurement_id).slice(0, 6).map((item: any) => ({ title: `${companyName(companies, item.company_id)} GA4 eksik`, severity: "Bilgi", module: "GA4", detail: "Analytics raporlaması sınırlı." }))
    ];
    return { today, month, companies, activeCustomers, passiveCustomers, leads, openLeads, newLeads, tasks, criticalTasks, completedToday, payments, pendingPayments, overduePayments, paidThisMonth, campaigns, activeCampaigns, reports, integrations, customerBranches, healthRows, riskyCustomers, revenue, receivable, adSpend, roasRows, risks };
  }, [content]);

  const agents = useMemo(() => teamAgents(content), [content]);
  const myPackages = useMemo(() => (content.hkMarketplacePackages || []).filter((item: any) => !isArchived(item)), [content.hkMarketplacePackages]);
  const recs = useMemo(() => recommendations(content, data.riskyCustomers, data.overduePayments, data.openLeads), [content, data.riskyCustomers, data.overduePayments, data.openLeads]);
  const packageFollowups = (content.hkMarketplacePackageApplications || []).filter((item: any) => item.status === "applied" && !(item.result_summary?.tasks > 0)).slice(0, 3);
  const branchSetupMissing = data.customerBranches.filter((branch: any) => branch.status !== "passive" && (!branch.meta_ad_account_id || !branch.google_ads_customer_id || !branch.ga4_property_id)).slice(0, 3);
  const todayAdvice = [
    ...data.criticalTasks.slice(0, 3).map((task: any) => ({ title: task.title || "Kritik görev", note: companyName(data.companies, task.company_id), target: "Görevler" })),
    ...data.riskyCustomers.slice(0, 3).map((item: any) => ({ title: `${item.company.name} kontrol edilmeli`, note: `Sağlık skoru ${item.health.score}/100`, company: item.company })),
    ...data.integrations.filter((item: any) => !item.meta_pixel_id || !item.ga4_measurement_id).slice(0, 3).map((item: any) => ({ title: `${companyName(data.companies, item.company_id)} entegrasyon kontrolü`, note: "Pixel / GA4 bilgisi eksik olabilir.", target: "Web Site Analitiği" })),
    ...packageFollowups.map((item: any) => ({ title: `${companyName(data.companies, item.company_id)} paket takip kontrolü`, note: "Paket uygulanmış; takip görevleri ve plan durumu kontrol edilmeli.", target: "HK Intelligence CEO" })),
    ...branchSetupMissing.map((branch: any) => ({ title: `${branch.branch_name || "Şube"} kurulumu eksik`, note: `${companyName(data.companies, branch.company_id)} · Meta/Google/GA4 alanlarını kontrol et.`, target: "Web Site Analitiği" })),
    ...data.pendingPayments.slice(0, 2).map((payment: any) => ({ title: `${companyName(data.companies, payment.company_id)} tahsilat bekliyor`, note: `${money(payment.amount)} · ${payment.due_date || "vade yok"}`, target: "Tahsilat" })),
    ...data.reports.filter((report: any) => !report.visible_to_customer).slice(0, 2).map((report: any) => ({ title: report.title || report.report_type || "Rapor bekliyor", note: "Rapor görünürlüğünü ve aksiyonları kontrol et.", target: "Müşteri Raporları" }))
  ].slice(0, 6);
  const ceoSummary = [
    `Bugün ${data.criticalTasks.length} kritik görev, ${data.overduePayments.length} geciken tahsilat ve ${data.newLeads.length} yeni lead var.`,
    `${data.riskyCustomers.length} müşteri riskli görünüyor; en düşük skor ${data.riskyCustomers[0]?.company?.name || "yok"}.`,
    `Bu ay tahsil edilen ${money(data.revenue)}, bekleyen gelir ${money(data.receivable)}.`,
    data.roasRows[0]?.roas > 0 ? `En yüksek ROAS ${data.roasRows[0].campaign.name} kampanyasında ${data.roasRows[0].roas.toFixed(2)}x.` : "ROAS için yeterli kampanya gelir verisi yok."
  ].join(" ");

  const kpis = [
    ["MRR", money(data.revenue), "Bu ay tahsil edilen", CircleDollarSign],
    ["ARR", money(data.revenue * 12), "Yıllıklaştırılmış gelir", LineChart],
    ["Churn", `%${data.activeCustomers.length ? Math.round(data.passiveCustomers.length / Math.max(1, data.activeCustomers.length + data.passiveCustomers.length) * 100) : 0}`, "Pasif müşteri oranı", HeartPulse],
    ["LTV", money(data.activeCustomers.length ? data.revenue / Math.max(1, data.activeCustomers.length) * 8 : 0), "Tahmini yaşam boyu değer", BrainCircuit],
    ["CAC", money(data.openLeads.length ? data.adSpend / Math.max(1, data.openLeads.length) : 0), "Tahmini edinim maliyeti", Target],
    ["ROAS", data.adSpend ? `${(data.revenue / Math.max(1, data.adSpend)).toFixed(2)}x` : "Veri yok", "Gelir / reklam harcaması", Gauge],
    ["Aktif müşteri", data.activeCustomers.length, "Hizmeti süren", UsersRound],
    ["Riskli müşteri", data.riskyCustomers.length, "Skoru düşük hesap", ShieldAlert]
  ];

  const calendar = [
    ["Pazartesi", "Rakip analizi, SEO kontrolü, Meta kontrolü"],
    ["Salı", "Google Ads kontrolü, lead arama, teklif hazırlığı"],
    ["Çarşamba", "Tahsilat kontrolü, CRM güncelleme, kreatif üretimi"],
    ["Perşembe", "Müşteri toplantıları, rapor taslakları, landing page kontrolü"],
    ["Cuma", "Haftalık rapor, risk özeti, AI öğrenme kayıtları"],
    ["Aylık", "Aylık rapor, KPI inceleme, yenileme ve churn kontrolü"]
  ];

  const commands = ["Müşteri aç", "Yeni görev oluştur", "Yeni teklif oluştur", "Agent çalıştır", "Rapor oluştur", "Tahsilat ekle", "QA Center aç", "Website Analytics aç", "Google Intelligence aç", "Meta Intelligence aç"];
  const filteredCommands = commands.filter((item) => item.toLocaleLowerCase("tr").includes(commandQuery.toLocaleLowerCase("tr")));
  const filteredCustomers = data.companies.filter((company: any) => `${company.name || ""} ${company.status || ""} ${company.city || ""}`.toLocaleLowerCase("tr").includes(customerSearch.toLocaleLowerCase("tr")));

  useEffect(() => {
    if (!selectedCustomerProfile && !applicationDetail && !applyWizard && !detail && !marketplaceOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedCustomerProfile(null);
        setApplicationDetail(null);
        setApplyWizard(null);
        setDetail(null);
        setMarketplaceOpen(false);
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [selectedCustomerProfile, applicationDetail, applyWizard, detail, marketplaceOpen]);

  function go(target: string, message?: string) {
    setActive(target);
    if (message) notify?.(message, "success");
  }

  function openDetail(title: string, description: string, actions: Array<{ label: string; target?: string; payload?: any }> = [], payload?: any) {
    setDetail({ title, description, actions, payload });
  }

  function openCustomerProfile(company: any) {
    const health = customerHealth(company, content);
    setSelectedCustomerProfile({ company, health });
  }

  function openApplicationDetail(application: any, company?: any, packageData?: any, options?: any) {
    setApplicationDetail({ application, company, packageData, options });
  }

  function openApplyWizard(sector: string, draft?: any) {
    const prepared = draft || buildMarketplaceFallback({ ...packageForm, sector });
    setMarketplaceDraft(prepared);
    setSelectedCompanyId(data.companies[0]?.id || "");
    setSelectedBranchId("all");
    setApplyResult(null);
    setApplyWizard(prepared);
  }

  async function copyText(text: string) {
    await navigator.clipboard?.writeText(text).catch(() => null);
    notify?.("Kopyalandı.", "success");
  }

  async function generateMarketplacePackage(sector = packageForm.sector) {
    setMarketplaceLoading(true);
    try {
      const body = {
        ...packageForm,
        sector,
        serviceTypes: packageForm.serviceTypes.split(",").map((item) => item.trim()).filter(Boolean),
        channels: packageForm.channels.split(",").map((item) => item.trim()).filter(Boolean)
      };
      const response = await fetch("/api/admin/hk-intelligence-ceo/marketplace/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Paket üretilemedi.");
      setMarketplaceDraft(payload.package);
      setMarketplaceOpen(true);
      notify?.("Hazır paket üretildi.", "success");
    } catch (error) {
      const fallback = buildMarketplaceFallback({ ...packageForm, sector });
      setMarketplaceDraft(fallback);
      setMarketplaceOpen(true);
      notify?.(error instanceof Error ? error.message : "Paket hazırlık modunda üretildi.", "warning");
    } finally {
      setMarketplaceLoading(false);
    }
  }

  async function saveMarketplacePackage() {
    if (!marketplaceDraft) return;
    const response = await fetch("/api/admin/hk-intelligence-ceo/marketplace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(marketplaceDraft)
    });
    if (response.ok) notify?.("Hazır paket kaydedildi.", "success");
    else notify?.("Paket kaydedilemedi; Supabase bağlantısını kontrol edin.", "error");
  }

  async function applyPackageToCustomer() {
    if (!applyWizard || !selectedCompanyId) {
      notify?.("Paketi uygulamak için müşteri seçin.", "error");
      return;
    }
    const packageId = applyWizard.id || "prepared";
    const response = await fetch(`/api/admin/hk-intelligence-ceo/marketplace/${encodeURIComponent(packageId)}/apply-to-customer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: selectedCompanyId, branchId: selectedBranchId === "all" ? null : selectedBranchId, package: applyWizard, options: applyOptions })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      notify?.(payload.error || "Paket uygulanamadı.", "error");
      setApplyResult(payload);
      return;
    }
    const selectedCompany = data.companies.find((company: any) => company.id === selectedCompanyId);
    const selectedBranch = data.customerBranches.find((branch: any) => branch.id === selectedBranchId);
    setApplyResult({ ...payload, company: selectedCompany, branch: selectedBranch, packageData: applyWizard });
    notify?.(payload.message || "Paket müşteriye uygulandı.", "success");
  }

  async function askCopilot() {
    const local = `${copilotQuestion}\n\nHK Intelligence cevabı: ${ceoSummary} Öncelik: ${recs[0]?.title || "kritik risk görünmüyor"}.`;
    setCopilotAnswer(local);
    try {
      const response = await fetch("/api/admin/hk-intelligence-ceo/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: copilotQuestion, context: { summary: ceoSummary, risks: data.risks.slice(0, 5), recommendations: recs.slice(0, 5) } })
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload.answer) setCopilotAnswer(payload.answer);
    } catch {
      setCopilotAnswer(local);
    }
    notify?.("HK Intelligence Copilot yanıtı hazırlandı.", "success");
  }

  return (
    <div className="grid gap-5">
      <section className="overflow-hidden rounded-[26px] border border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-blue-50 p-5 shadow-[0_18px_45px_rgba(14,165,233,.12)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.18em] text-cyan-700">HK Intelligence CEO</p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">HK CEO Masası</h1>
            <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-700">{ceoSummary}</p>
          </div>
          <button onClick={() => setActive("HK Agent Hub")} className="inline-flex items-center gap-2 rounded-[14px] bg-cyan-500 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5">
            <Sparkles size={17} /> Agent Hub’a Git
          </button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Bugünkü kritik görevler", data.criticalTasks.length, "Görevler"],
            ["Acil riskler", data.risks.filter((item: any) => item.severity === "Kritik").length, "Risk Merkezi"],
            ["Bugünkü reklam harcaması", money(data.adSpend), "Kampanyalar"],
            ["Tahsil edilecek ödemeler", money(data.receivable), "Tahsilat"],
            ["Yeni leadler", data.newLeads.length, "Leadler"],
            ["Bugün tamamlanan görevler", data.completedToday.length, "Görevler"],
            ["Çalışan AI ajanları", agents.filter((item) => item.status === "Çalışıyor").length, "HK Agent Hub"],
            ["Hata veren AI ajanları", agents.filter((item) => item.status === "Hatalı").length, "HK Agent Hub"]
          ].map(([label, value, target]) => (
            <button key={label} onClick={() => setActive(target)} className="rounded-[18px] border border-white bg-white/80 p-4 text-left shadow-sm ring-1 ring-cyan-100 transition hover:-translate-y-0.5">
              <p className="text-xs font-bold text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
            </button>
          ))}
        </div>
      </section>

      {!compact && (
        <>
          <PanelCard title="Bugün Ne Yapmalıyım?" subtitle="Gerçek müşteri, görev, risk ve entegrasyon sinyallerinden üretilen öncelikler" icon={<ClipboardList size={20} />}>
            {todayAdvice.length ? (
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {todayAdvice.map((item: any, index) => (
                  <button key={`${item.title}-${index}`} onClick={() => item.company ? openCustomerProfile(item.company) : go(item.target || "Görevler")} className="rounded-[14px] border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-cyan-200 hover:bg-cyan-50">
                    <p className="text-[11px] font-black uppercase tracking-[.12em] text-cyan-700">Öncelik {index + 1}</p>
                    <p className="mt-1 font-black text-slate-950">{item.title}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{item.note}</p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-[16px] border border-dashed border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                Bugün için kritik kayıt bulunamadı. Yeni müşteri ekleyebilir, paket uygulayabilir veya entegrasyon kontrolü yapabilirsin.
              </div>
            )}
          </PanelCard>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{kpis.map(([label, value, note, Icon]: any) => <div key={label} className="rounded-[18px] border border-slate-200 bg-white p-4 shadow-sm"><span className="grid size-10 place-items-center rounded-[13px] bg-cyan-50 text-cyan-700"><Icon size={18} /></span><p className="mt-3 text-xs font-bold text-slate-500">{label}</p><p className="mt-1 text-2xl font-black text-slate-950">{value}</p><p className="mt-1 text-xs text-slate-500">{note}</p></div>)}</section>

          <section className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
            <PanelCard title="HK Dijital Ekibi" subtitle="Sanal ajans ekibi ve görev dağılımı" icon={<Bot size={20} />}>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{agents.map(({ Icon, ...agent }: any) => <button key={agent.name} onClick={() => openDetail(agent.name, `${agent.task} Ajan durumu, kullandığı AI, başarı oranı, maliyet ve performans geçmişi buradan yönetilir.`, [{ label: "Agent Çalıştır", target: "HK Agent Hub" }, { label: "Görev Oluştur", target: "Görevler" }, { label: "Performans Geçmişi", target: "HK Agent Hub" }], agent)} className="rounded-[16px] border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-cyan-200 hover:bg-cyan-50"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-[13px] bg-white text-cyan-700"><Icon size={18} /></span><div className="min-w-0"><p className="font-black text-slate-950">{agent.name}</p><p className="mt-1 text-xs leading-5 text-slate-500">{agent.task}</p></div></div><div className="mt-3 grid gap-2 text-xs text-slate-600"><span>Durum: <strong>{agent.status}</strong></span><span>Başarı: <strong>%{agent.success}</strong></span><span>AI: <strong>{agent.ai}</strong></span><span>Maliyet: <strong>{agent.cost}</strong></span></div><span className="mt-3 inline-flex text-xs font-black text-cyan-700">Detay aç</span></button>)}</div>
            </PanelCard>
            <PanelCard title="AI Operasyon Takvimi" subtitle="Haftalık ajans ritmi" icon={<CalendarDays size={20} />}>
              <div className="grid gap-3">{calendar.map(([day, plan]) => <button key={day} onClick={() => openDetail(`${day} operasyonu`, plan, [{ label: "Bugün Çalıştır", target: "HK Agent Hub" }, { label: "Göreve Dönüştür", target: "Görevler" }, { label: "Agent Hub’da Planla", target: "HK Agent Hub" }])} className="rounded-[14px] border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-cyan-200 hover:bg-cyan-50"><p className="font-black text-slate-950">{day}</p><p className="mt-1 text-sm leading-6 text-slate-600">{plan}</p><span className="mt-2 inline-flex text-xs font-black text-cyan-700">Düzenle / çalıştır</span></button>)}</div>
            </PanelCard>
          </section>

          <section className="grid gap-5 xl:grid-cols-3">
            <PanelCard title="Risk Merkezi" subtitle="Teknik, reklam, ödeme ve analytics riskleri" icon={<ShieldAlert size={20} />}>
              <div className="grid gap-2">{data.risks.slice(0, 10).map((risk: any) => <button key={`${risk.module}-${risk.title}`} onClick={() => openDetail(risk.title, `${risk.module}: ${risk.detail}`, [{ label: "Görev oluştur", target: "Görevler" }, { label: "Müşteri profilini aç", target: "Müşteriler" }, { label: "Rapor oluştur", target: "Müşteri Raporları" }, { label: "Agent ile analiz et", target: "HK Agent Hub" }], risk)} className="rounded-[14px] border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-cyan-200 hover:bg-cyan-50"><div className="flex items-start justify-between gap-2"><p className="text-sm font-black text-slate-900">{risk.title}</p><span className={`rounded-full px-2 py-1 text-[10px] font-black ring-1 ${toneForSeverity(risk.severity)}`}>{risk.severity}</span></div><p className="mt-1 text-xs leading-5 text-slate-500">{risk.module} · {risk.detail}</p><span className="mt-2 inline-flex text-xs font-black text-cyan-700">Aksiyona dönüştür</span></button>)}{!data.risks.length && <Empty text="Kritik risk sinyali yok." />}</div>
            </PanelCard>
            <PanelCard title="Rakip Alarm Merkezi" subtitle="Rakip reklam, fiyat ve web değişim sinyalleri" icon={<Megaphone size={20} />}>
              {["Rakip yeni kampanya açtı mı kontrol et", "Rakip fiyat değişimi için haftalık tarama", "Google yorum artışı ve sosyal büyüme sinyali", "Rakip web sitesi ve landing page değişimi"].map((item) => <ActionRow key={item} title={item} note="Derin araştırma için Manus / Gemini zinciri önerilir." onClick={() => openDetail(item, "Rakip alarmı için watchlist kaydı, agent araştırması ve takip görevi hazırlanır.", [{ label: "Agent çalıştır", target: "HK Agent Hub" }, { label: "Görev oluştur", target: "Görevler" }, { label: "Rakip Analizi aç", target: "Rakip Analizi" }])} />)}
            </PanelCard>
            <PanelCard title="AI Öneri Motoru" subtitle="Beklenen etki, süre, maliyet ve başarı olasılığı" icon={<BrainCircuit size={20} />}>
              {recs.map((item) => <button key={item.title} onClick={() => openDetail(item.title, `Etki: ${item.impact}. Zorluk: ${item.difficulty}. Süre: ${item.duration}. Maliyet: ${item.cost}. Başarı olasılığı: %${item.probability}.`, [{ label: "Görev oluştur", target: "Görevler" }, { label: "Müşteriye not olarak kaydet", target: "Müşteriler" }, { label: "AI Hafızasına kaydet", target: "HK Agent Hub" }, { label: "Uygula / planla", target: "Takvim" }, ...(data.riskyCustomers[0]?.company ? [{ label: "Müşteriyi Görüntüle", payload: { companyId: data.riskyCustomers[0].company.id } }] : [])], item)} className="rounded-[14px] border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-cyan-200 hover:bg-cyan-50"><p className="font-black text-slate-950">{item.title}</p><p className="mt-1 text-xs text-slate-500">Etki: {item.impact} · Zorluk: {item.difficulty} · Süre: {item.duration} · Maliyet: {item.cost} · Başarı: %{item.probability}</p><p className="mt-2 text-xs font-black text-cyan-700">{item.action}</p></button>)}
            </PanelCard>
          </section>

          <section className="grid gap-5 xl:grid-cols-3">
            <PanelCard title="AI Yardımcı Sohbet" subtitle="Tüm sistem için doğal dil komut ekranı" icon={<MessageSquareText size={20} />}>
              <textarea value={copilotQuestion} onChange={(event) => setCopilotQuestion(event.target.value)} className="min-h-24 w-full rounded-[14px] border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900" />
              <button onClick={askCopilot} className="mt-3 rounded-[12px] bg-cyan-500 px-4 py-3 text-sm font-black text-white">HK Intelligence ile Yanıtla</button>
              {copilotAnswer && <div className="mt-3 rounded-[14px] bg-cyan-50 p-3"><p className="whitespace-pre-line text-sm leading-6 text-cyan-950">{copilotAnswer}</p><div className="mt-3 flex flex-wrap gap-2"><SmallButton onClick={() => go("Müşteriler")}>Müşterilere git</SmallButton><SmallButton onClick={() => go("Görevler")}>Görev oluştur</SmallButton><SmallButton onClick={() => go("HK Agent Hub")}>Agent Hub’da analiz et</SmallButton><SmallButton onClick={() => go("Müşteri Raporları")}>Rapor oluştur</SmallButton></div></div>}
            </PanelCard>
            <PanelCard title="Akıllı Komut Merkezi" subtitle="Cmd/Ctrl+K komut mantığı" icon={<Command size={20} />}>
              <input value={commandQuery} onChange={(event) => setCommandQuery(event.target.value)} placeholder="Komut ara: müşteri aç, rapor oluştur..." className="w-full rounded-[14px] border border-slate-200 bg-slate-50 px-3 py-3 text-sm" />
              <div className="mt-3 grid gap-2">{filteredCommands.map((item) => <button key={item} onClick={() => go(commandToTarget(item), `${item} komutu açıldı.`)} className="flex items-center justify-between rounded-[12px] bg-slate-50 px-3 py-2 text-left text-sm font-bold text-slate-700 transition hover:bg-cyan-50 hover:text-cyan-700"><span>{item}</span><ArrowRight size={14} /></button>)}</div>
            </PanelCard>
            <PanelCard title="Genel Arama" subtitle="Müşteri, görev, belge, rapor ve hafıza araması" icon={<Search size={20} />}>
              {[["Müşteriler", data.companies.length], ["Görevler", data.tasks.length], ["Raporlar", data.reports.length], ["Tahsilatlar", data.payments.length], ["Kampanyalar", data.campaigns.length], ["AI Hafızası", (content.agentMemories || []).length]].map(([label, count]) => <ActionRow key={label} title={`${label}: ${count}`} note="Kategori bazlı arama indeksine dahil." onClick={() => String(label).includes("Müşteri") && data.companies[0] ? openCustomerProfile(data.companies[0]) : go(searchTarget(String(label)))} />)}
            </PanelCard>
          </section>

          <section className="grid gap-5 xl:grid-cols-4">
            <MiniModule title="AI Kreatif Stüdyosu" icon={<Palette size={19} />} items={["Instagram", "Facebook", "Google Display", "Carousel", "Story", "Reels", "TikTok", "YouTube Shorts", "Banner", "Thumbnail", "Blog", "Mail", "WhatsApp", "SMS"]} onClick={() => openDetail("AI Kreatif Stüdyosu", "Seçilen formatlar için komut metni göstermeden kreatif brief, metin ve üretim hazırlığı yapılır.", [{ label: "AI Studio aç", target: "AI Studio" }, { label: "Komut metni üret", target: "HK Agent Hub" }])} />
            <MiniModule title="AI Satış Asistanı" icon={<Target size={19} />} items={["Arama metni", "WhatsApp", "Teklif", "Toplantı", "Takip görevi", "CRM güncelle"]} onClick={() => openDetail("AI Satış Asistanı", "Lead için arama metni, WhatsApp, teklif, toplantı ve CRM takip hazırlık verisi üretir.", [{ label: "Lead Workspace aç", target: "CRM & Lead Workspace" }, { label: "Teklif oluştur", target: "Teklif Oluştur" }])} />
            <MiniModule title="HK Öğrenme Merkezi" icon={<BrainCircuit size={19} />} items={["Başarılı reklam", "Kreatif", "Hedef kitle", "Teklif", "Satış süreci", "AI Hafızası"]} onClick={() => openDetail("HK Öğrenme Merkezi", "Başarılı reklam, kreatif ve satış süreçleri AI Hafızasına öğrenme kaydı olarak hazırlanır.", [{ label: "Agent Hub aç", target: "HK Agent Hub" }, { label: "Kaydet", payload: "learning" }])} />
            <MiniModule title="Dijital İkiz" icon={<Layers3 size={19} />} items={["12 ay", "Google", "Meta", "SEO", "CRM", "Rapor", "Tahsilat", "Notlar"]} onClick={() => openDetail("Dijital İkiz", "Müşteri geçmişi, raporları, tahsilatları, notları ve entegrasyonları tek müşteri ikizi bağlamında özetlenir.", [{ label: "Müşteri seç", target: "Müşteriler" }, { label: "Agent ile sor", target: "HK Agent Hub" }])} />
          </section>

          <section className="grid gap-5 xl:grid-cols-3">
            <PanelCard title="Paket Pazarı" subtitle="Hazır paketler ve AI ile üretilen kullanıcı paketleri" icon={<BriefcaseBusiness size={20} />}>
              <button onClick={() => setMarketplaceOpen(true)} className="mb-4 inline-flex items-center gap-2 rounded-[12px] bg-cyan-500 px-4 py-2.5 text-sm font-black text-white"><Plus size={16} /> AI Destekli Yeni Paket Üret</button>
              <div className="grid gap-4">
                <section>
                  <h3 className="mb-2 text-sm font-black text-slate-950">Hazır Paketler</h3>
                  <div className="grid gap-2 sm:grid-cols-2">{marketplaceSectors.map((item) => <div key={item} className="rounded-[12px] border border-slate-200 bg-slate-50 p-3"><div className="flex items-start justify-between gap-2"><p className="font-black text-slate-900">{item}</p><span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-700 ring-1 ring-amber-200">Hazırlık</span></div><p className="mt-1 text-xs text-slate-500">Komut metni, iş akışı, AI ekibi, KPI ve rapor şablonu.</p><div className="mt-3 flex flex-wrap gap-1.5"><TinyButton onClick={() => generateMarketplacePackage(item)}>Paketi Aç</TinyButton><TinyButton onClick={() => openApplyWizard(item)}>Müşteriye Uygula</TinyButton></div></div>)}</div>
                </section>
                <section>
                  <h3 className="mb-2 text-sm font-black text-slate-950">Benim Paketlerim</h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {myPackages.slice(0, 6).map((pkg: any) => <div key={pkg.id} className="rounded-[12px] border border-cyan-200 bg-cyan-50 p-3"><div className="flex items-start justify-between gap-2"><p className="font-black text-slate-900">{pkg.package_name}</p><span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-cyan-700 ring-1 ring-cyan-200">{pkg.status || "taslak"}</span></div><p className="mt-1 text-xs text-slate-600">{pkg.sector} · {pkg.main_goal || "hedef yok"} · v{pkg.version_number || 1}</p><div className="mt-3 flex flex-wrap gap-1.5"><TinyButton onClick={() => { setMarketplaceDraft(pkg); setMarketplaceOpen(true); }}>Paketi Aç</TinyButton><TinyButton onClick={() => openApplyWizard(pkg.sector, pkg)}>Müşteriye Uygula</TinyButton><TinyButton onClick={() => copyText(JSON.stringify(pkg, null, 2))}>Kopyala</TinyButton></div></div>)}
                    {!myPackages.length && <p className="rounded-[12px] border border-dashed border-cyan-200 bg-white p-3 text-sm text-cyan-800">Henüz kaydedilmiş kullanıcı paketi yok. AI Destekli Yeni Paket Üret ile ilk paketi oluşturabilirsin.</p>}
                  </div>
                </section>
              </div>
            </PanelCard>
            <PanelCard title="Çok Şubeli Yapı" subtitle="Tek panel, ayrı şube KPI ve raporları" icon={<BuildingIcon />}>
              {data.companies.slice(0, 5).map((company: any) => <ActionRow key={company.id} title={company.name} note="Şube altyapısı customer_branches tablosu ile hazır." onClick={() => openCustomerProfile(company)} />)}
            </PanelCard>
            <PanelCard title="Sağlık / Maliyet / Yedekleme Merkezi" subtitle="Sistem sağlığı, AI maliyeti ve yedekleme" icon={<Database size={20} />}>
              {["Database, Supabase, Storage, Cron, Queue, API", "OpenAI, Gemini, Claude, Groq, OpenRouter, Manus, Ollama", "Meta API, Google Ads API, GA4, Search Console, SMTP, Resend, Discord", "Otomatik günlük/haftalık/aylık yedek hazırlığı"].map((item) => <ActionRow key={item} title={item} note="Durum, son kontrol, yanıt süresi ve çözüm önerisi izlenir." onClick={() => go(healthTarget(item))} />)}
              <div className="mt-3 flex flex-wrap gap-2"><SmallButton onClick={() => go("QA Merkezi")}>Sağlık Kontrolü Yap</SmallButton><SmallButton onClick={() => go("HK Agent Hub")}>AI Maliyetlerini Aç</SmallButton><SmallButton onClick={() => go("Veri Aktarma")}>Yedeğe Git</SmallButton></div>
            </PanelCard>
          </section>

          <PanelCard title="Müşteri Zaman Çizelgesi" subtitle="Müşteri tarihçesi ve operasyon olayları" icon={<ClipboardList size={20} />}>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{data.healthRows.slice(0, 8).map(({ company, health }: any) => <button key={company.id} onClick={() => openCustomerProfile(company)} className="rounded-[16px] border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-cyan-200 hover:bg-cyan-50"><p className="font-black text-slate-950">{company.name}</p><p className="mt-1 text-xs text-slate-500">Oluşturuldu → İlk görüşme → Teklif → Sözleşme → Pixel/GA4 → Kampanya → Rapor → Tahsilat</p><span className={`mt-3 inline-flex rounded-full px-3 py-1 text-[11px] font-black ring-1 ${toneForSeverity(health.status === "Kritik" ? "Kritik" : health.status === "Riskli" ? "Orta" : "Bilgi")}`}>{health.score}/100</span></button>)}</div>
          </PanelCard>
        </>
      )}
      {detail && <ActionModal detail={detail} onClose={() => setDetail(null)} onGo={go} onCopy={copyText} onOpenCustomerById={(companyId: string) => {
        const company = data.companies.find((item: any) => item.id === companyId);
        if (company) openCustomerProfile(company);
      }} />}
      {marketplaceOpen && <MarketplaceModal form={packageForm} setForm={setPackageForm} draft={marketplaceDraft} loading={marketplaceLoading} mode={packageBuilderMode} setMode={setPackageBuilderMode} onClose={() => setMarketplaceOpen(false)} onGenerate={() => generateMarketplacePackage()} onPreview={() => { setMarketplaceDraft(buildMarketplaceFallback(packageForm)); notify?.("Manuel paket önizlemesi hazırlandı.", "success"); }} onSave={saveMarketplacePackage} onCopy={copyText} onApply={(draftPackage: any) => openApplyWizard(draftPackage.sector || packageForm.sector, draftPackage)} />}
      {applyWizard && <ApplyWizardModal packageData={applyWizard} companies={filteredCustomers} branches={data.customerBranches} search={customerSearch} setSearch={setCustomerSearch} selectedCompanyId={selectedCompanyId} setSelectedCompanyId={setSelectedCompanyId} selectedBranchId={selectedBranchId} setSelectedBranchId={setSelectedBranchId} options={applyOptions} setOptions={setApplyOptions} result={applyResult} onApply={applyPackageToCustomer} onClose={() => setApplyWizard(null)} onOpenCustomer={(company: any) => openCustomerProfile(company)} onGo={go} onApplicationDetail={openApplicationDetail} />}
      {applicationDetail && <ApplicationDetailModal detail={applicationDetail} onClose={() => setApplicationDetail(null)} onGo={go} onOpenCustomer={(company: any) => company && openCustomerProfile(company)} />}
      {selectedCustomerProfile && <CustomerProfileModal company={selectedCustomerProfile.company} content={content} health={selectedCustomerProfile.health} onClose={() => setSelectedCustomerProfile(null)} onGo={go} />}
    </div>
  );
}

function commandToTarget(command: string) {
  const normalized = command.toLocaleLowerCase("tr");
  if (normalized.includes("müşteri")) return "Müşteriler";
  if (normalized.includes("görev")) return "Görevler";
  if (normalized.includes("teklif")) return "Teklif Oluştur";
  if (normalized.includes("agent")) return "HK Agent Hub";
  if (normalized.includes("rapor")) return "Müşteri Raporları";
  if (normalized.includes("tahsilat")) return "Tahsilat";
  if (normalized.includes("qa")) return "QA Merkezi";
  if (normalized.includes("website")) return "Web Site Analitiği";
  if (normalized.includes("google")) return "Google İstihbarat";
  if (normalized.includes("meta")) return "Meta İstihbarat";
  return "Dashboard";
}

function searchTarget(label: string) {
  if (label.includes("Müşteri")) return "Müşteriler";
  if (label.includes("Görev")) return "Görevler";
  if (label.includes("Rapor")) return "Müşteri Raporları";
  if (label.includes("Tahsilat")) return "Tahsilat";
  if (label.includes("Kampanya")) return "Kampanyalar";
  return "HK Agent Hub";
}

function healthTarget(title: string) {
  if (title.includes("Database") || title.includes("Supabase") || title.includes("Cron")) return "QA Merkezi";
  if (title.includes("OpenAI") || title.includes("Ollama")) return "HK Agent Hub";
  if (title.includes("Meta")) return "Meta İstihbarat";
  if (title.includes("Google") || title.includes("GA4") || title.includes("Search")) return "Web Site Analitiği";
  return "Veri Aktarma";
}

function buildMarketplaceFallback(input: any) {
  const sector = input.sector || "Sektör";
  const niche = input.niche || input.subSector || "";
  const sectorLabel = niche ? `${sector} - ${niche}` : sector;
  const channels = Array.isArray(input.channels) ? input.channels : String(input.channels || "Meta, Google Ads, SEO").split(",").map((item) => item.trim()).filter(Boolean);
  const serviceTypes = Array.isArray(input.serviceTypes) ? input.serviceTypes : String(input.serviceTypes || "Google Ads, Meta Ads").split(",").map((item) => item.trim()).filter(Boolean);
  return {
    packageName: `${sectorLabel} Growth OS Paketi`,
    package_name: `${sectorLabel} Growth OS Paketi`,
    sector,
    niche,
    region: input.region || "",
    targetCustomer: input.targetCustomer || input.target_customer || "Yerel hizmet işletmesi",
    target_customer: input.targetCustomer || input.target_customer || "Yerel hizmet işletmesi",
    serviceTypes,
    service_types: serviceTypes,
    channels,
    monthlyBudgetRange: input.monthlyBudgetRange || input.monthly_budget_range || "30.000 - 100.000 TL",
    monthly_budget_range: input.monthlyBudgetRange || input.monthly_budget_range || "30.000 - 100.000 TL",
    serviceFeeRange: input.serviceFeeRange || input.service_fee_range || "15.000 - 45.000 TL",
    service_fee_range: input.serviceFeeRange || input.service_fee_range || "15.000 - 45.000 TL",
    customerProblem: input.customerProblem || input.customer_problem || "Ölçümleme, lead kalitesi ve rapor disiplini eksikliği",
    customer_problem: input.customerProblem || input.customer_problem || "Ölçümleme, lead kalitesi ve rapor disiplini eksikliği",
    competitionLevel: input.competitionLevel || input.competition_level || "Orta",
    competition_level: input.competitionLevel || input.competition_level || "Orta",
    salesProcess: input.salesProcess || input.sales_process || "Keşif, teklif, takip, raporlama",
    sales_process: input.salesProcess || input.sales_process || "Keşif, teklif, takip, raporlama",
    offerTone: input.offerTone || input.offer_tone || "sade",
    offer_tone: input.offerTone || input.offer_tone || "sade",
    packageLevel: input.packageLevel || input.package_level || "profesyonel",
    package_level: input.packageLevel || input.package_level || "profesyonel",
    packageDuration: input.packageDuration || input.package_duration || "30 gün",
    package_duration: input.packageDuration || input.package_duration || "30 gün",
    mainGoal: input.mainGoal || input.main_goal || "lead",
    main_goal: input.mainGoal || input.main_goal || "lead",
    generatedPrompt: `${sectorLabel} sektörü için Google, Meta, SEO, WhatsApp ve raporlama verilerini analiz et. Satış garantisi verme. İlk 30 gün için öncelikli aksiyon, risk, fırsat, KPI ve teklif dilini Türkçe üret.`,
    generated_prompt: `${sectorLabel} sektörü için Google, Meta, SEO, WhatsApp ve raporlama verilerini analiz et. Satış garantisi verme. İlk 30 gün için öncelikli aksiyon, risk, fırsat, KPI ve teklif dilini Türkçe üret.`,
    workflowSteps: ["Müşteri hedefini doğrula", "Rakip ve arama görünürlüğünü incele", "Google/Meta fırsatlarını çıkar", "Landing page ve WhatsApp akışını planla", "İlk teklif ve 7 günlük takip planı üret"],
    workflow_steps: ["Müşteri hedefini doğrula", "Rakip ve arama görünürlüğünü incele", "Google/Meta fırsatlarını çıkar", "Landing page ve WhatsApp akışını planla", "İlk teklif ve 7 günlük takip planı üret"],
    aiTeam: ["CEO", "Satış Müdürü", "Google Ads Uzmanı", "Meta Ads Uzmanı", "SEO Uzmanı", "Kreatif Direktör", "Raporlama Yöneticisi"],
    ai_team: ["CEO", "Satış Müdürü", "Google Ads Uzmanı", "Meta Ads Uzmanı", "SEO Uzmanı", "Kreatif Direktör", "Raporlama Yöneticisi"],
    kpiTemplate: ["Lead sayısı", "Mesaj sayısı", "Randevu oranı", "CPL", "CTR", "CPC", "ROAS", "Harcama", "WhatsApp dönüşümü", "Rapor görünürlüğü"],
    kpi_template: ["Lead sayısı", "Mesaj sayısı", "Randevu oranı", "CPL", "CTR", "CPC", "ROAS", "Harcama", "WhatsApp dönüşümü", "Rapor görünürlüğü"],
    reportTemplate: ["Yönetici özeti", "Kanal performansı", "Riskler", "Fırsatlar", "7 günlük plan"],
    report_template: ["Yönetici özeti", "Kanal performansı", "Riskler", "Fırsatlar", "7 günlük plan"],
    proposalDraft: `${sector} için başlangıçta ${serviceTypes.join(" + ")} paketi önerilir. Hedef ${input.mainGoal || "lead"} olduğundan ilk ay ölçümleme, hızlı kazanımlar ve rapor disiplini önceliklendirilir.`,
    proposal_draft: `${sector} için başlangıçta ${serviceTypes.join(" + ")} paketi önerilir. Hedef ${input.mainGoal || "lead"} olduğundan ilk ay ölçümleme, hızlı kazanımlar ve rapor disiplini önceliklendirilir.`,
    operationPlan: ["1. hafta: analiz ve kurulum", "2. hafta: kampanya ve kreatif yayına alma", "3. hafta: optimizasyon", "4. hafta: rapor ve yenileme teklifi"],
    operation_plan: ["1. hafta: analiz ve kurulum", "2. hafta: kampanya ve kreatif yayına alma", "3. hafta: optimizasyon", "4. hafta: rapor ve yenileme teklifi"],
    sevenDayPlan: ["Gün 1: Kurulum kontrolü", "Gün 2: Reklam ve hedef kitle kontrolü", "Gün 3: Kreatif kontrolü", "Gün 4: İlk optimizasyon", "Gün 5: Ara rapor", "Gün 6: Müşteri geri bildirimi", "Gün 7: Haftalık rapor ve yeni aksiyonlar"],
    seven_day_plan: ["Gün 1: Kurulum kontrolü", "Gün 2: Reklam ve hedef kitle kontrolü", "Gün 3: Kreatif kontrolü", "Gün 4: İlk optimizasyon", "Gün 5: Ara rapor", "Gün 6: Müşteri geri bildirimi", "Gün 7: Haftalık rapor ve yeni aksiyonlar"],
    thirtyDayPlan: ["1. hafta: Kurulum ve veri toplama", "2. hafta: İlk optimizasyon", "3. hafta: Kreatif / teklif / hedef kitle iyileştirme", "4. hafta: Raporlama ve yenileme önerisi"],
    thirty_day_plan: ["1. hafta: Kurulum ve veri toplama", "2. hafta: İlk optimizasyon", "3. hafta: Kreatif / teklif / hedef kitle iyileştirme", "4. hafta: Raporlama ve yenileme önerisi"],
    ninetyDayPlan: ["1. ay: Ölçümleme, kurulum ve ilk öğrenme", "2. ay: Kreatif, hedef kitle ve teklif optimizasyonu", "3. ay: Bütçe ölçekleme, rapor standardı ve yenileme planı"],
    ninety_day_plan: ["1. ay: Ölçümleme, kurulum ve ilk öğrenme", "2. ay: Kreatif, hedef kitle ve teklif optimizasyonu", "3. ay: Bütçe ölçekleme, rapor standardı ve yenileme planı"],
    socialMediaPlan: ["Haftalık 3 post: güven kanıtı, hizmet anlatımı ve kampanya çağrısı", "Haftalık 2 Reels: süreç, sonuç ve müşteri sorusu formatı", "Günlük Story: randevu/iletişim çağrısı ve sosyal kanıt", "Ayda 1 müşteri başarı hikayesi"],
    social_media_plan: ["Haftalık 3 post: güven kanıtı, hizmet anlatımı ve kampanya çağrısı", "Haftalık 2 Reels: süreç, sonuç ve müşteri sorusu formatı", "Günlük Story: randevu/iletişim çağrısı ve sosyal kanıt", "Ayda 1 müşteri başarı hikayesi"],
    contentCalendar: ["Pazartesi: problem farkındalığı", "Çarşamba: hizmet/fayda anlatımı", "Cuma: kampanya ve WhatsApp çağrısı", "Pazar: haftalık güven içeriği"],
    content_calendar: ["Pazartesi: problem farkındalığı", "Çarşamba: hizmet/fayda anlatımı", "Cuma: kampanya ve WhatsApp çağrısı", "Pazar: haftalık güven içeriği"],
    creativeIdeas: [`${sectorLabel} için önce/sonra veya süreç odaklı kısa video`, "WhatsApp mesajına yönlendiren sosyal kanıt kreatifi", "Bölgesel güven vurgulu reklam görseli"],
    creative_ideas: [`${sectorLabel} için önce/sonra veya süreç odaklı kısa video`, "WhatsApp mesajına yönlendiren sosyal kanıt kreatifi", "Bölgesel güven vurgulu reklam görseli"],
    approvalWorkflow: ["İç brief hazırlandı", "Kreatif taslak üretildi", "İç onay", "Müşteri onayı", "Revize istendi", "Yayına hazır", "Yayınlandı"],
    approval_workflow: ["İç brief hazırlandı", "Kreatif taslak üretildi", "İç onay", "Müşteri onayı", "Revize istendi", "Yayına hazır", "Yayınlandı"],
    campaignOperations: ["Kampanya kurulumu", "Pixel/Dataset kontrolü", "GA4 kontrolü", "Reklam bütçesi", "Hedef kitle", "Kreatif", "İlk 72 saat kontrolü", "7 günlük optimizasyon"],
    campaign_operations: ["Kampanya kurulumu", "Pixel/Dataset kontrolü", "GA4 kontrolü", "Reklam bütçesi", "Hedef kitle", "Kreatif", "İlk 72 saat kontrolü", "7 günlük optimizasyon"],
    clientCommunicationPlan: ["İlk arama", "Teklif gönderildi", "Sözleşme", "Kurulum bilgilendirmesi", "Haftalık rapor", "Aylık değerlendirme", "Yenileme görüşmesi"],
    client_communication_plan: ["İlk arama", "Teklif gönderildi", "Sözleşme", "Kurulum bilgilendirmesi", "Haftalık rapor", "Aylık değerlendirme", "Yenileme görüşmesi"],
    reportApprovalFlow: ["Rapor oluşturuldu", "İç kontrol", "Müşteriye hazır", "Gönderildi", "Müşteri görüntüledi"],
    report_approval_flow: ["Rapor oluşturuldu", "İç kontrol", "Müşteriye hazır", "Gönderildi", "Müşteri görüntüledi"],
    trackingMetrics: ["Lead sayısı", "Mesaj sayısı", "Randevu oranı", "CPL", "CTR", "CPC", "ROAS", "Harcama", "WhatsApp dönüşümü", "Google yorumları", "Website form dönüşümü"],
    tracking_metrics: ["Lead sayısı", "Mesaj sayısı", "Randevu oranı", "CPL", "CTR", "CPC", "ROAS", "Harcama", "WhatsApp dönüşümü", "Google yorumları", "Website form dönüşümü"],
    risks: ["Ölçümleme eksikse kampanya öğrenmesi yavaşlar", "Kreatif çeşitliliği düşük kalırsa performans sınırlanır"],
    opportunities: ["WhatsApp takip akışı dönüşümü artırabilir", "Düzenli raporlama müşteri güvenini artırır"],
    salesArguments: ["İlk ay veri toplama ve hızlı optimizasyon dönemidir", "Satış garantisi değil, ölçülebilir karar disiplini sunulur"],
    sales_arguments: ["İlk ay veri toplama ve hızlı optimizasyon dönemidir", "Satış garantisi değil, ölçülebilir karar disiplini sunulur"],
    customerSummary: `${sectorLabel} için hazırlanan bu paket, ${channels.join(", ")} kanallarını ve düzenli rapor disiplinini tek operasyon planında toplar.`,
    customer_summary: `${sectorLabel} için hazırlanan bu paket, ${channels.join(", ")} kanallarını ve düzenli rapor disiplinini tek operasyon planında toplar.`,
    versionNumber: 1,
    version_number: 1,
    source: "ai_generated",
    status: "draft"
  };
}

function PanelCard({ title, subtitle, icon, children }: { title: string; subtitle: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-[16px] bg-cyan-50 text-cyan-700">{icon}</span>
        <div><h2 className="text-lg font-black text-slate-950">{title}</h2><p className="text-sm text-slate-500">{subtitle}</p></div>
      </div>
      {children}
    </section>
  );
}

function ActionRow({ title, note, onClick }: { title: string; note: string; onClick: () => void }) {
  return <button onClick={onClick} className="rounded-[14px] border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-cyan-200 hover:bg-cyan-50"><p className="text-sm font-black text-slate-900">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{note}</p><span className="mt-2 inline-flex text-xs font-black text-cyan-700">Detay / aksiyon</span></button>;
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-[14px] border border-dashed border-slate-200 p-4 text-sm text-slate-500">{text}</p>;
}

function MiniModule({ title, icon, items, onClick }: { title: string; icon: ReactNode; items: string[]; onClick: () => void }) {
  return <button onClick={onClick} className="rounded-[22px] border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-cyan-200 hover:bg-cyan-50"><div className="mb-3 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-[14px] bg-cyan-50 text-cyan-700">{icon}</span><h2 className="font-black text-slate-950">{title}</h2></div><div className="flex flex-wrap gap-2">{items.map((item) => <span key={item} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">{item}</span>)}</div><span className="mt-3 inline-flex text-xs font-black text-cyan-700">Çıktı üret / aç</span></button>;
}

function BuildingIcon() {
  return <BriefcaseBusiness size={20} />;
}

function SmallButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button onClick={onClick} className="rounded-[10px] border border-cyan-200 bg-white px-3 py-2 text-xs font-black text-cyan-700 transition hover:bg-cyan-100">{children}</button>;
}

function TinyButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button onClick={onClick} className="rounded-full border border-cyan-200 bg-white px-2.5 py-1 text-[10px] font-black text-cyan-700 transition hover:bg-cyan-100">{children}</button>;
}

function ActionModal({ detail, onClose, onGo, onCopy, onOpenCustomerById }: { detail: any; onClose: () => void; onGo: (target: string, message?: string) => void; onCopy: (text: string) => void; onOpenCustomerById?: (companyId: string) => void }) {
  const payload = JSON.stringify(detail.payload || { title: detail.title, description: detail.description }, null, 2);
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/45 p-4">
      <section className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-[24px] bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">HK CEO Aksiyon</p><h2 className="mt-1 text-2xl font-black text-slate-950">{detail.title}</h2></div>
          <button onClick={onClose} className="rounded-full border border-slate-200 p-2 text-slate-500"><X size={18} /></button>
        </div>
        <p className="mt-4 whitespace-pre-line text-sm leading-7 text-slate-700">{detail.description}</p>
        <div className="mt-4 rounded-[16px] bg-slate-50 p-3">
          <p className="text-xs font-black text-slate-500">Hazırlık verisi</p>
          <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-700">{payload}</pre>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {(detail.actions || []).map((action: any) => <button key={action.label} onClick={() => {
            if (action.payload?.companyId && action.label.includes("Müşteri")) {
              onOpenCustomerById?.(action.payload.companyId);
              return;
            }
            if (action.target) onGo(action.target, `${action.label} açıldı.`);
            else onCopy(JSON.stringify(action.payload || detail.payload || detail, null, 2));
          }} className="rounded-[12px] bg-cyan-500 px-4 py-2.5 text-sm font-black text-white">{action.label}</button>)}
          <button onClick={() => onCopy(payload)} className="inline-flex items-center gap-2 rounded-[12px] border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-700"><Copy size={15} /> Kopyala</button>
          <button onClick={onClose} className="rounded-[12px] border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-500">Kapat</button>
        </div>
      </section>
    </div>
  );
}

function MarketplaceModal({ form, setForm, draft, loading, mode, setMode, onClose, onGenerate, onPreview, onSave, onCopy, onApply }: any) {
  const [activeSection, setActiveSection] = useState("Özet");
  const draftText = draft ? JSON.stringify(draft, null, 2) : "";
  const draftSections = draft ? [
    ["Özet", [draft.customer_summary || draft.customerSummary || `${draft.sector} için paket özeti hazırlandı.`, `Hedef müşteri: ${draft.target_customer || draft.targetCustomer || "Belirtilmedi"}`, `Ana hedef: ${draft.main_goal || draft.mainGoal || "Belirtilmedi"}`]],
    ["Strateji", [draft.generated_prompt || draft.generatedPrompt || "Strateji komut metni henüz üretilmedi."]],
    ["Reklam Planı", draft.campaign_operations || draft.campaignOperations || draft.workflow_steps || draft.workflowSteps || []],
    ["Sosyal Medya Planı", draft.social_media_plan || draft.socialMediaPlan || []],
    ["İçerik Takvimi", draft.content_calendar || draft.contentCalendar || []],
    ["İş Akışı", draft.workflow_steps || draft.workflowSteps || []],
    ["AI Ekibi", draft.ai_team || draft.aiTeam || []],
    ["KPI", draft.kpi_template || draft.kpiTemplate || []],
    ["Rapor", draft.report_template || draft.reportTemplate || []],
    ["Teklif", [draft.proposal_draft || draft.proposalDraft || "Teklif taslağı henüz yok."]],
    ["7 Günlük Plan", draft.seven_day_plan || draft.sevenDayPlan || []],
    ["30 Günlük Plan", draft.thirty_day_plan || draft.thirtyDayPlan || []],
    ["90 Günlük Plan", draft.ninety_day_plan || draft.ninetyDayPlan || []],
    ["Onay Akışı", draft.approval_workflow || draft.approvalWorkflow || []],
    ["Müşteri İletişimi", draft.client_communication_plan || draft.clientCommunicationPlan || []],
    ["Rapor Onayı", draft.report_approval_flow || draft.reportApprovalFlow || []],
    ["Kreatif Fikirler", draft.creative_ideas || draft.creativeIdeas || []],
    ["Riskler", draft.risks || []],
    ["Fırsatlar", draft.opportunities || []],
    ["Satış Argümanları", draft.sales_arguments || draft.salesArguments || []],
    ["Uygulama Geçmişi", ["Bu paket müşteriye uygulandığında kayıtlar müşteri profilindeki Uygulanan Paketler / Planlar bölümünde görünür."]]
  ] : [];
  const activeLines = (draftSections.find(([title]) => title === activeSection)?.[1] || []) as string[];
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/45 p-4">
      <section className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-[24px] bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">Paket Pazarı</p><h2 className="mt-1 text-2xl font-black text-slate-950">AI Destekli Yeni Paket Üret</h2><p className="mt-1 text-sm text-slate-500">Sektör bilgisinden uygulanabilir komut metni, iş akışı, KPI, rapor ve teklif paketi üret.</p></div>
          <button onClick={onClose} className="rounded-full border border-slate-200 p-2 text-slate-500"><X size={18} /></button>
        </div>
        <div className="mt-5 grid gap-2 rounded-[18px] border border-cyan-200 bg-cyan-50 p-3 sm:grid-cols-2">
          <button onClick={() => setMode("ai")} className={`rounded-[14px] px-4 py-3 text-left text-sm font-black transition ${mode === "ai" ? "bg-cyan-500 text-white" : "bg-white text-cyan-800"}`}>AI ile Otomatik Doldur<p className="mt-1 text-xs font-medium opacity-80">Sadece temel bilgileri gir, sistem strateji, plan, KPI ve içerikleri üretir.</p></button>
          <button onClick={() => setMode("manual")} className={`rounded-[14px] px-4 py-3 text-left text-sm font-black transition ${mode === "manual" ? "bg-cyan-500 text-white" : "bg-white text-cyan-800"}`}>Manuel Doldur<p className="mt-1 text-xs font-medium opacity-80">Tüm alanları kendin doldurup önizleme ve kayıt al.</p></button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {[
            ["sector", "Sektör adı"],
            ["niche", "Alt sektör / niş"],
            ["targetCustomer", "Hedef müşteri tipi"],
            ["region", "Şehir / bölge"],
            ["serviceTypes", "Hizmet türleri"],
            ["monthlyBudgetRange", "Aylık bütçe aralığı"],
            ["serviceFeeRange", "Hizmet bedeli aralığı"],
            ["mainGoal", "Ana hedef"],
            ["channels", "Kullanılacak kanallar"],
            ["customerProblem", "Müşteri problemi"],
            ["competitionLevel", "Rekabet seviyesi"],
            ["salesProcess", "Satış süreci"],
            ["offerTone", "Teklif dili"],
            ["packageLevel", "Paket seviyesi"],
            ["packageDuration", "Süre"],
            ["notes", "Ek notlar"],
            ["outputType", "Çıktı tipi"]
          ].map(([key, label]) => <label key={key} className="grid gap-1 text-sm font-bold text-slate-700">{label}<input value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900" /></label>)}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button disabled={loading} onClick={onGenerate} className="inline-flex items-center gap-2 rounded-[12px] bg-cyan-500 px-4 py-2.5 text-sm font-black text-white disabled:opacity-60"><Sparkles size={16} /> {loading ? "Üretiliyor..." : mode === "ai" ? "AI ile Doldur" : "AI ile Paketi Üret"}</button>
          <button onClick={onPreview} className="inline-flex items-center gap-2 rounded-[12px] border border-cyan-200 bg-white px-4 py-2.5 text-sm font-black text-cyan-700">Paketi Önizle</button>
          {draft && <button onClick={onSave} className="inline-flex items-center gap-2 rounded-[12px] border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-sm font-black text-cyan-700"><Save size={16} /> Paketi Kaydet</button>}
          {draft && <button onClick={() => onApply(draft)} className="inline-flex items-center gap-2 rounded-[12px] bg-emerald-500 px-4 py-2.5 text-sm font-black text-white">Müşteriye Uygula</button>}
          {draft && <button onClick={() => onCopy(draftText)} className="inline-flex items-center gap-2 rounded-[12px] border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-700"><Copy size={16} /> Çıktıyı Kopyala</button>}
          {draft && <button onClick={onGenerate} className="inline-flex items-center gap-2 rounded-[12px] border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-700">Yeni Versiyon Üret</button>}
        </div>
        {draft && (
          <div className="mt-5 grid gap-3">
            <div className="rounded-[16px] border border-cyan-200 bg-cyan-50 p-4">
              <h3 className="font-black text-slate-950">{draft.package_name || draft.packageName}</h3>
              <p className="mt-1 text-sm leading-6 text-cyan-950">{draft.customer_summary || draft.customerSummary || "Paket özeti hazırlandı."}</p>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {draftSections.map(([title]) => <button key={title} onClick={() => setActiveSection(String(title))} className={`shrink-0 rounded-full px-3 py-2 text-xs font-black ${activeSection === title ? "bg-cyan-500 text-white" : "bg-slate-100 text-slate-600"}`}>{title}</button>)}
            </div>
            <section className="rounded-[16px] border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-black text-slate-950">{activeSection}</h4>
                <div className="flex gap-2">
                  <TinyButton onClick={() => onCopy((activeLines.length ? activeLines : ["Bu alan için veri üretilmedi."]).join("\n"))}>Kopyala</TinyButton>
                  <TinyButton onClick={onSave}>Kaydet</TinyButton>
                </div>
              </div>
              <div className="mt-3 grid gap-2 text-sm leading-6 text-slate-600">
                {(Array.isArray(activeLines) && activeLines.length ? activeLines : ["Bu alan için veri üretilmedi."]).map((line: string, index: number) => <span key={`${activeSection}-${index}`}>{line}</span>)}
              </div>
            </section>
          </div>
        )}
      </section>
    </div>
  );
}

function resultCards(result: any, options: any) {
  const summary = result?.summary || {};
  const mode = result?.mode === "prepared_payload" ? "Hazırlık modu" : "";
  const rows = [
    ["memory", "AI Hafızası", "kayıt oluşturuldu", "Oluşturuldu"],
    ["customerNote", "Müşteri Notu", "not oluşturuldu", "Oluşturuldu"],
    ["tasks", "Görevler", "görev taslağı oluşturuldu", "Oluşturuldu"],
    ["workflowDraft", "İş Akışı Taslağı", "taslak hazırlandı", "Hazırlandı"],
    ["kpiTemplate", "KPI Şablonu", "şablon hazırlandı", "Hazırlandı"],
    ["reportTemplate", "Rapor Şablonu", "şablon hazırlandı", "Hazırlandı"],
    ["proposalDraft", "Teklif Taslağı", "taslak hazırlandı", "Hazırlandı"]
  ];
  const optionKey: Record<string, string> = {
    memory: "saveMemory",
    customerNote: "createCustomerNote",
    tasks: "createTasks",
    workflowDraft: "createWorkflowDraft",
    kpiTemplate: "createKpiTemplate",
    reportTemplate: "createReportTemplate",
    proposalDraft: "createProposalDraft"
  };
  return rows.map(([key, label, suffix, okLabel]) => {
    const selected = Boolean(options?.[optionKey[key]]);
    const count = Number(summary?.[key] || 0);
    const status = !selected ? "Atlandı" : mode || (count > 0 ? okLabel : "Kontrol gerekli");
    return { key, label, text: !selected ? "Seçilmedi" : count > 0 ? `${count} ${suffix}` : mode || "Kayıt doğrulanmalı", status };
  });
}

function ResultBadge({ status }: { status: string }) {
  const tone = status === "Oluşturuldu" || status === "Hazırlandı"
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : status === "Atlandı"
      ? "bg-slate-50 text-slate-600 ring-slate-200"
      : status === "Hazırlık modu"
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : "bg-red-50 text-red-700 ring-red-200";
  return <span className={`rounded-full px-2 py-1 text-[10px] font-black ring-1 ${tone}`}>{status}</span>;
}

function ApplySuccessPanel({ result, selectedCompany, selectedBranch, packageData, options, onOpenCustomer, onGo, onApplicationDetail }: any) {
  const packageName = result?.summary?.packageName || packageData.package_name || packageData.packageName || "Paket";
  const customerName = selectedCompany?.name || result?.company?.name || "seçilen müşteri";
  const cards = resultCards(result, options);
  const application = result?.application || {};
  const postPlan = application.post_apply_plan || result?.postApplyPlan || {};
  const nextActions = application.next_actions || result?.nextActions || [];
  const trackingMetrics = application.tracking_metrics || result?.trackingMetrics || [];
  const sevenDayPlan = application.seven_day_plan || result?.sevenDayPlan || [];
  const thirtyDayPlan = application.thirty_day_plan || result?.thirtyDayPlan || [];
  const channels = postPlan.channels || packageData.channels || [];
  const whatHappened = postPlan.whatHappened || `Bu işlemle ${customerName} için ${packageName} planı kuruldu. Sistem görevler, AI hafızası, iş akışı taslağı, KPI ve rapor şablonu hazırladı. Şimdi ilk olarak entegrasyonları kontrol edip 7 günlük reklam sağlık raporunu hazırlamalısın.`;
  return (
    <section className="rounded-[18px] border border-emerald-200 bg-emerald-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-emerald-950">Uygulanan Plan Sonrası Operasyon Paneli</h3>
          <p className="mt-1 text-sm leading-6 text-emerald-900">Bu paket müşteriye uygulandıktan sonra oluşan kayıtlar, yapılacak işler ve takip edilmesi gereken metrikler aşağıdadır.</p>
        </div>
        <ResultBadge status={result?.mode === "prepared_payload" ? "Hazırlık modu" : "Oluşturuldu"} />
      </div>
      <div className="mt-4 rounded-[16px] border border-emerald-200 bg-white p-4">
        <h4 className="font-black text-slate-950">Ne Yapıldı?</h4>
        <p className="mt-2 text-sm leading-6 text-slate-700">{whatHappened}</p>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <section className="rounded-[16px] border border-emerald-200 bg-white p-4">
          <h4 className="font-black text-slate-950">Plan Özeti</h4>
          <div className="mt-3 grid gap-2 text-sm text-slate-600">
            <span><b>Paket adı:</b> {packageName}</span>
            <span><b>Uygulanan müşteri:</b> {customerName}</span>
            <span><b>Şube:</b> {selectedBranch?.branch_name || postPlan.branchName || "Tüm şubeler"}</span>
            <span><b>Uygulama tarihi:</b> {application.created_at ? new Date(application.created_at).toLocaleString("tr-TR") : "Yeni oluşturuldu"}</span>
            <span><b>Ana hedef:</b> {postPlan.mainGoal || packageData.main_goal || packageData.mainGoal || "lead / randevu"}</span>
            <span><b>Kanallar:</b> {Array.isArray(channels) ? channels.join(", ") : String(channels || "Meta, Google Ads, SEO")}</span>
            <span><b>Başarı hedefi:</b> {postPlan.successTarget || "Ölçümleme ve raporlanabilir aksiyon planı kurmak"}</span>
            <span><b>Tahmini süre:</b> {postPlan.estimatedDuration || "30 gün"}</span>
            <span><b>Tahmini zorluk:</b> {postPlan.difficulty || "Orta"}</span>
            <span><b>AI sağlayıcı:</b> {postPlan.aiProvider || packageData.mode || "Demo / Yerel yedek akış"}</span>
          </div>
        </section>
        <section className="rounded-[16px] border border-emerald-200 bg-white p-4">
          <h4 className="font-black text-slate-950">Sonraki Adımlar</h4>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => selectedCompany && onOpenCustomer(selectedCompany)} className="rounded-[12px] bg-cyan-500 px-4 py-2.5 text-sm font-black text-white">Müşteri Profilini Aç</button>
            <button onClick={() => onGo("Görevler", "Görevler açıldı.")} className="rounded-[12px] border border-cyan-200 bg-white px-4 py-2.5 text-sm font-black text-cyan-700">Görevleri Gör</button>
            <button onClick={() => onGo("HK Agent Hub", "AI Hafızası açıldı.")} className="rounded-[12px] border border-cyan-200 bg-white px-4 py-2.5 text-sm font-black text-cyan-700">AI Hafızasında Aç</button>
            <button onClick={() => onGo("HK Agent Hub", "İş akışları açıldı.")} className="rounded-[12px] border border-cyan-200 bg-white px-4 py-2.5 text-sm font-black text-cyan-700">İş Akışını Aç</button>
            <button onClick={() => onGo("Müşteri Raporları", "İlk rapor alanı açıldı.")} className="rounded-[12px] border border-cyan-200 bg-white px-4 py-2.5 text-sm font-black text-cyan-700">İlk Raporu Oluştur</button>
            <button onClick={() => onGo("Teklif Oluştur", "Teklif taslağı açıldı.")} className="rounded-[12px] border border-cyan-200 bg-white px-4 py-2.5 text-sm font-black text-cyan-700">Teklif Taslağını Aç</button>
            <button onClick={() => onGo("HK Agent Hub", "Agent Hub analizi açıldı.")} className="rounded-[12px] border border-cyan-200 bg-white px-4 py-2.5 text-sm font-black text-cyan-700">Agent Hub’da Analiz Et</button>
            <button onClick={() => onGo("Web Site Analitiği", "Website Analytics açıldı.")} className="rounded-[12px] border border-cyan-200 bg-white px-4 py-2.5 text-sm font-black text-cyan-700">Website Analytics’te Kontrol Et</button>
            <button onClick={() => onGo("Google İstihbarat", "Google İstihbarat açıldı.")} className="rounded-[12px] border border-cyan-200 bg-white px-4 py-2.5 text-sm font-black text-cyan-700">Google İstihbarat Aç</button>
            <button onClick={() => onGo("Meta İstihbarat", "Meta İstihbarat açıldı.")} className="rounded-[12px] border border-cyan-200 bg-white px-4 py-2.5 text-sm font-black text-cyan-700">Meta İstihbarat Aç</button>
            <button onClick={() => onApplicationDetail(result?.application || result, selectedCompany, packageData, options)} className="rounded-[12px] border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-black text-emerald-700">Uygulama Kaydını Aç</button>
          </div>
        </section>
      </div>
      <section className="mt-4 rounded-[16px] border border-emerald-200 bg-white p-4">
        <h4 className="font-black text-slate-950">Oluşturulan Kayıtlar</h4>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.key} className="rounded-[14px] border border-emerald-200 bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-black text-slate-950">{card.label}</p>
              <ResultBadge status={card.status} />
            </div>
            <p className="mt-1 text-xs text-slate-600">{card.text}</p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => onGo(card.key === "tasks" ? "Görevler" : card.key === "memory" ? "HK Agent Hub" : card.key === "proposalDraft" ? "Teklif Oluştur" : "Müşteri Raporları")} className="rounded-[10px] bg-cyan-500 px-3 py-1.5 text-xs font-black text-white">Aç</button>
              <button onClick={() => onApplicationDetail(result?.application || result, selectedCompany, packageData, options)} className="rounded-[10px] border border-slate-200 px-3 py-1.5 text-xs font-black text-slate-600">Detay</button>
            </div>
          </div>
        ))}
        </div>
      </section>
      <section className="mt-4 rounded-[16px] border border-emerald-200 bg-white p-4">
        <h4 className="font-black text-slate-950">Yapılacaklar</h4>
        <div className="mt-3 grid gap-2">
          {(nextActions.length ? nextActions : []).map((action: any, index: number) => <div key={`${action.title}-${index}`} className="rounded-[14px] border border-slate-200 bg-slate-50 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-black text-slate-950">{index + 1}. {action.title}</p><ResultBadge status={action.status || "Yapılacak"} /></div><p className="mt-1 text-xs text-slate-500">Öncelik: {action.priority} · Sorumlu AI ajanı: {action.owner} · Tahmini süre: {action.estimatedTime}</p><div className="mt-2 flex gap-2"><button onClick={() => onGo("Görevler")} className="rounded-[10px] bg-cyan-500 px-3 py-1.5 text-xs font-black text-white">Görevlerde Aç</button><button onClick={() => onApplicationDetail(result?.application || result, selectedCompany, packageData, options)} className="rounded-[10px] border border-slate-200 px-3 py-1.5 text-xs font-black text-slate-600">Tamamlandı İşaretle</button></div></div>)}
        </div>
      </section>
      <section className="mt-4 rounded-[16px] border border-emerald-200 bg-white p-4">
        <h4 className="font-black text-slate-950">Takip Edilecek Metrikler</h4>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {(trackingMetrics.length ? trackingMetrics : []).map((metric: any, index: number) => <div key={`${metric.name}-${index}`} className="rounded-[14px] border border-slate-200 bg-slate-50 p-3"><p className="font-black text-slate-950">{metric.name}</p><p className="mt-1 text-xs leading-5 text-slate-500">{metric.description}</p><p className="mt-1 text-xs text-slate-500">Hedef: {metric.target} · Kaynak: {metric.source} · Sıklık: {metric.frequency}</p><button onClick={() => onGo("Müşteri Raporları")} className="mt-2 rounded-[10px] bg-cyan-500 px-3 py-1.5 text-xs font-black text-white">Raporlara Bağla</button></div>)}
        </div>
      </section>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <section className="rounded-[16px] border border-emerald-200 bg-white p-4">
          <h4 className="font-black text-slate-950">İlk 7 Günlük Plan</h4>
          <div className="mt-3 grid gap-2 text-sm text-slate-600">{sevenDayPlan.map((item: any, index: number) => <span key={`${item.title}-${index}`}>{item.day ? `Gün ${item.day}: ` : ""}{item.title} · {item.status || "Planlandı"}</span>)}</div>
        </section>
        <section className="rounded-[16px] border border-emerald-200 bg-white p-4">
          <h4 className="font-black text-slate-950">İlk 30 Günlük Plan</h4>
          <div className="mt-3 grid gap-2 text-sm text-slate-600">{thirtyDayPlan.map((item: any, index: number) => <span key={`${item.title}-${index}`}>{item.week ? `${item.week}. hafta: ` : ""}{item.focus || item.title} · {item.status || "Planlandı"}</span>)}</div>
        </section>
      </div>
    </section>
  );
}

function ApplyWizardModal({ packageData, companies, branches, search, setSearch, selectedCompanyId, setSelectedCompanyId, selectedBranchId, setSelectedBranchId, options, setOptions, result, onApply, onClose, onOpenCustomer, onGo, onApplicationDetail }: any) {
  const selectedCompany = companies.find((company: any) => company.id === selectedCompanyId) || companies[0];
  const selectedBranch = getCompanyBranches(branches, selectedCompanyId).find((branch: any) => branch.id === selectedBranchId);
  const workflow = packageData.workflow_steps || packageData.workflowSteps || [];
  const kpis = packageData.kpi_template || packageData.kpiTemplate || [];
  const reports = packageData.report_template || packageData.reportTemplate || [];
  const tasks = (packageData.operation_plan || packageData.operationPlan || []).slice(0, 8);
  const selectedCount = Object.values(options).filter(Boolean).length;
  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-slate-950/50 p-0 sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[85vh] sm:max-w-5xl sm:rounded-[26px]">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 p-5">
          <div><p className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">Paket Uygulama Sihirbazı</p><h2 className="mt-1 text-2xl font-black text-slate-950">Paketi Müşteriye Uygula</h2><p className="mt-1 text-sm text-slate-500">{packageData.package_name || packageData.packageName} · {packageData.sector}</p></div>
          <button onClick={onClose} className="rounded-full border border-slate-200 p-2 text-slate-500"><X size={18} /></button>
        </header>
        <div className="grid flex-1 gap-5 overflow-y-auto p-5 lg:grid-cols-[.95fr_1.05fr]">
          <div className="grid content-start gap-4">
            <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-4">
              <h3 className="font-black text-slate-950">1. Paket özeti</h3>
              <div className="mt-3 grid gap-2 text-sm text-slate-600">
                <span><b>Paket:</b> {packageData.package_name || packageData.packageName}</span>
                <span><b>Sektör:</b> {packageData.sector}</span>
                <span><b>Ana hedef:</b> {packageData.main_goal || packageData.mainGoal || "lead / randevu"}</span>
                <span><b>Kanallar:</b> {(packageData.channels || []).join(", ") || "Meta, Google Ads, SEO"}</span>
                <span><b>Varlıklar:</b> AI hafızası, müşteri notu, görev planı, iş akışı, KPI, rapor ve teklif taslağı</span>
              </div>
            </div>
            <div className="rounded-[18px] border border-slate-200 bg-white p-4">
              <h3 className="font-black text-slate-950">2. Müşteri seçimi</h3>
              <div className="mt-3 rounded-[14px] border border-cyan-200 bg-cyan-50 p-3">
                <CustomerBranchFilter
                  companies={companies}
                  branches={branches}
                  selectedCompanyId={selectedCompanyId}
                  selectedBranchId={selectedBranchId}
                  onCompanyChange={setSelectedCompanyId}
                  onBranchChange={setSelectedBranchId}
                  compact
                />
              </div>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Müşteri/firma ara..." className="mt-3 w-full rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" />
              <div className="mt-3 grid max-h-72 gap-2 overflow-y-auto pr-1">
                {companies.map((company: any) => (
                  <button key={company.id} onClick={() => setSelectedCompanyId(company.id)} className={`rounded-[14px] border p-3 text-left transition ${selectedCompanyId === company.id ? "border-cyan-300 bg-cyan-50" : "border-slate-200 bg-slate-50 hover:border-cyan-200"}`}>
                    <div className="flex items-start justify-between gap-2"><p className="font-black text-slate-950">{company.name}</p><span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-slate-500 ring-1 ring-slate-200">{company.status || "Aktif"}</span></div>
                    <p className="mt-1 text-xs text-slate-500">{company.city || "Şehir yok"} · {company.sector || "Sektör yok"} · Kurulum: {company.setup_progress || company.onboarding_progress || 0}%</p>
                  </button>
                ))}
                {!companies.length && <p className="rounded-[12px] border border-dashed border-slate-200 p-3 text-sm text-slate-500">Eşleşen aktif müşteri bulunamadı.</p>}
              </div>
            </div>
            <div className="rounded-[18px] border border-slate-200 bg-white p-4">
              <h3 className="font-black text-slate-950">3. Uygulanacaklar</h3>
              <div className="mt-3 grid gap-2">
                {[
                  ["saveMemory", "AI Hafızasına strateji kaydet"],
                  ["createCustomerNote", "Müşteri notu oluştur"],
                  ["createTasks", "30 günlük görev planı oluştur"],
                  ["createWorkflowDraft", "Agent Hub iş akışı taslağı hazırla"],
                  ["createKpiTemplate", "KPI şablonu hazırla"],
                  ["createReportTemplate", "Rapor şablonu hazırla"],
                  ["createProposalDraft", "Teklif taslağı hazırla"]
                ].map(([key, label]) => <label key={key} className="flex items-center gap-2 rounded-[12px] bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700"><input type="checkbox" checked={Boolean(options[key])} onChange={(event) => setOptions({ ...options, [key]: event.target.checked })} />{label}</label>)}
              </div>
            </div>
          </div>
          <div className="grid content-start gap-4">
            <div className="rounded-[18px] border border-cyan-200 bg-cyan-50 p-4">
              <h3 className="font-black text-slate-950">4. Önizleme</h3>
              <p className="mt-2 text-sm leading-6 text-cyan-950">{selectedCompany ? `${packageData.sector} paketi ${selectedCompany.name} müşterisine ${selectedBranch ? `${selectedBranch.branch_name} şubesi için` : "tüm şubeler kapsamında"} uygulanacak.` : "Uygulamak için müşteri seçin."}</p>
              <div className="mt-3 grid gap-2 text-sm text-slate-700">
                <span>Oluşacak görev sayısı: <b>{options.createTasks ? Math.max(5, tasks.length || 5) : 0}</b></span>
                <span>Hafıza özeti: <b>{options.saveMemory ? "Strateji + operasyon planı" : "Kapalı"}</b></span>
                <span>Müşteri notu: <b>{options.createCustomerNote ? "Uygulama özeti" : "Kapalı"}</b></span>
                <span>İş akışı adımları: <b>{options.createWorkflowDraft ? workflow.length || 5 : 0}</b></span>
                <span>KPI başlıkları: <b>{options.createKpiTemplate ? kpis.join(", ") || "Lead, CPL, ROAS" : "Kapalı"}</b></span>
                <span>Rapor başlıkları: <b>{options.createReportTemplate ? reports.join(", ") || "Yönetici özeti, riskler" : "Kapalı"}</b></span>
              </div>
            </div>
            <div className="rounded-[18px] border border-slate-200 bg-white p-4">
              <h3 className="font-black text-slate-950">5. Uygula</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">Seçili {selectedCount} varlık için kayıt oluşturulur. Uygun tablo yoksa uygulama kaydına hazırlık verisi olarak eklenir.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button disabled={!selectedCompanyId} onClick={onApply} className="rounded-[12px] bg-cyan-500 px-4 py-3 text-sm font-black text-white disabled:opacity-50">Paketi Uygula</button>
                {selectedCompany && <button onClick={() => onOpenCustomer(selectedCompany)} className="rounded-[12px] border border-cyan-200 bg-white px-4 py-3 text-sm font-black text-cyan-700">Müşteriyi Görüntüle</button>}
              </div>
            </div>
            {result && <ApplySuccessPanel result={result} selectedCompany={selectedCompany} selectedBranch={selectedBranch} packageData={packageData} options={options} onOpenCustomer={onOpenCustomer} onGo={onGo} onApplicationDetail={onApplicationDetail} />}
          </div>
        </div>
      </section>
    </div>
  );
}

function ApplicationDetailModal({ detail, onClose, onGo, onOpenCustomer }: any) {
  const application = detail?.application || {};
  const company = detail?.company;
  const packageData = detail?.packageData || {};
  const summary = application.result_summary || detail?.summary || {};
  const createdRecords = application.created_records || detail?.createdRecords || {};
  const options = application.options || detail?.options || {};
  const nextActions = application.next_actions || detail?.nextActions || [];
  const trackingMetrics = application.tracking_metrics || detail?.trackingMetrics || [];
  const sevenDayPlan = application.seven_day_plan || detail?.sevenDayPlan || [];
  const thirtyDayPlan = application.thirty_day_plan || detail?.thirtyDayPlan || [];
  const packageName = summary.packageName || packageData.package_name || packageData.packageName || "Hazır paket";
  const statusText = application.status === "failed" ? "Hata" : application.status === "applied" ? "Uygulandı" : application.status || detail?.mode || "Uygulandı";
  const optionLabels: Record<string, string> = {
    saveMemory: "AI Hafızasına strateji kaydet",
    createCustomerNote: "Müşteri notu oluştur",
    createTasks: "30 günlük görev planı oluştur",
    createWorkflowDraft: "İş akışı taslağı hazırla",
    createKpiTemplate: "KPI şablonu hazırla",
    createReportTemplate: "Rapor şablonu hazırla",
    createProposalDraft: "Teklif taslağı hazırla"
  };
  const recordLines = resultCards({ summary }, options).map((item) => `${item.label}: ${item.text}`);
  return (
    <div className="fixed inset-0 z-[105] grid place-items-center bg-slate-950/50 p-0 sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[85vh] sm:max-w-3xl sm:rounded-[26px]">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 p-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">Uygulama Kaydı</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">Paket Uygulama Kaydı</h2>
            <p className="mt-1 text-sm text-slate-500">{packageName} · {company?.name || "Müşteri seçimi"}</p>
          </div>
          <button onClick={onClose} className="rounded-full border border-slate-200 p-2 text-slate-500"><X size={18} /></button>
        </header>
        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid gap-3 md:grid-cols-2">
            <InfoTile label="Paket adı" value={packageName} />
            <InfoTile label="Müşteri adı" value={company?.name || application.company_name || "Müşteri bilgisi yok"} />
            <InfoTile label="Uygulama tarihi" value={application.created_at ? new Date(application.created_at).toLocaleString("tr-TR") : "Yeni oluşturuldu"} />
            <InfoTile label="Durum" value={statusText} />
          </div>
          <section className="mt-4 rounded-[16px] border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-black text-slate-950">Uygulanan seçenekler</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(optionLabels).map(([key, label]) => <span key={key} className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${options[key] === false ? "bg-slate-50 text-slate-500 ring-slate-200" : "bg-cyan-50 text-cyan-700 ring-cyan-200"}`}>{options[key] === false ? "Atlandı" : "Uygulandı"} · {label}</span>)}
            </div>
          </section>
          <section className="mt-4 rounded-[16px] border border-slate-200 bg-white p-4">
            <h3 className="font-black text-slate-950">Oluşturulan kayıtlar</h3>
            <div className="mt-3 grid gap-2 text-sm text-slate-700">{recordLines.map((line) => <span key={line}>{line}</span>)}</div>
            {application.error_message && <p className="mt-3 rounded-[12px] border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">Hata: {application.error_message}</p>}
          </section>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <section className="rounded-[16px] border border-slate-200 bg-slate-50 p-4">
              <h3 className="font-black text-slate-950">Yapılacaklar</h3>
              <div className="mt-3 grid gap-1 text-sm text-slate-600">{nextActions.slice(0, 5).map((item: any, index: number) => <span key={`${item.title}-${index}`}>{item.title} · {item.priority || "Normal"} · {item.owner || "HK Intelligence"}</span>)}</div>
            </section>
            <section className="rounded-[16px] border border-slate-200 bg-slate-50 p-4">
              <h3 className="font-black text-slate-950">Takip metrikleri</h3>
              <div className="mt-3 flex flex-wrap gap-2">{trackingMetrics.slice(0, 8).map((item: any, index: number) => <span key={`${item.name}-${index}`} className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600 ring-1 ring-slate-200">{item.name}</span>)}</div>
            </section>
            <section className="rounded-[16px] border border-slate-200 bg-slate-50 p-4">
              <h3 className="font-black text-slate-950">7 günlük plan</h3>
              <div className="mt-3 grid gap-1 text-sm text-slate-600">{sevenDayPlan.slice(0, 7).map((item: any, index: number) => <span key={`${item.title}-${index}`}>{item.day ? `Gün ${item.day}: ` : ""}{item.title}</span>)}</div>
            </section>
            <section className="rounded-[16px] border border-slate-200 bg-slate-50 p-4">
              <h3 className="font-black text-slate-950">30 günlük plan</h3>
              <div className="mt-3 grid gap-1 text-sm text-slate-600">{thirtyDayPlan.slice(0, 4).map((item: any, index: number) => <span key={`${item.title}-${index}`}>{item.week ? `${item.week}. hafta: ` : ""}{item.focus || item.title}</span>)}</div>
            </section>
          </div>
          <section className="mt-4 rounded-[16px] border border-emerald-200 bg-emerald-50 p-4">
            <h3 className="font-black text-emerald-950">Sonraki önerilen adım</h3>
            <p className="mt-2 text-sm leading-6 text-emerald-900">Önce müşteri profilinde Uygulanan Paketler bölümünü kontrol edin, ardından görevler ve Agent Hub iş akışı taslaklarını açın.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => onOpenCustomer(company)} className="rounded-[12px] bg-cyan-500 px-4 py-2.5 text-sm font-black text-white">Müşteri Profilini Aç</button>
              <button onClick={() => onGo("Görevler")} className="rounded-[12px] border border-cyan-200 bg-white px-4 py-2.5 text-sm font-black text-cyan-700">Görevleri Gör</button>
              <button onClick={() => onGo("HK Agent Hub")} className="rounded-[12px] border border-cyan-200 bg-white px-4 py-2.5 text-sm font-black text-cyan-700">Agent Hub’da Aç</button>
            </div>
          </section>
          <details className="mt-4 rounded-[16px] border border-slate-200 bg-slate-50 p-4">
            <summary className="cursor-pointer text-sm font-black text-slate-700">Teknik detayı göster</summary>
            <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-700">{JSON.stringify({ application, createdRecords }, null, 2)}</pre>
          </details>
        </div>
      </section>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-3"><p className="text-[11px] font-black uppercase tracking-[.12em] text-slate-500">{label}</p><p className="mt-1 font-black text-slate-950">{value}</p></div>;
}
