"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState } from "react";
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
    ["Creative Director", "Kreatif yön ve format", "Claude / OpenAI", Palette],
    ["Video Specialist", "Reels, Shorts, video fikirleri", "OpenAI", Zap],
    ["Copywriter", "Metin ve kampanya dili", "Claude", MessageSquareText],
    ["Data Analyst", "KPI, ROAS, LTV analizi", "Gemini / OpenAI", Gauge],
    ["Finance Manager", "Tahsilat ve kârlılık", "Yerel karar motoru", CircleDollarSign],
    ["Reporting Manager", "Rapor ve müşteri özeti", "Claude / OpenAI", FileText],
    ["Customer Success", "Risk, onboarding ve yenileme", "HK Intelligence", HeartPulse]
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
    riskyCustomers[0] ? { title: `${riskyCustomers[0].company.name} için müşteri kurtarma planı`, impact: "Yüksek", difficulty: "Orta", duration: "2 saat", cost: "Düşük", probability: 78, action: "Customer Success görevi oluştur" } : null,
    overduePayments[0] ? { title: `${companyName(content.companies || [], overduePayments[0].company_id)} tahsilat hatırlatması`, impact: "Yüksek", difficulty: "Kolay", duration: "15 dk", cost: "Yok", probability: 70, action: "WhatsApp takip mesajı hazırla" } : null,
    openLeads[0] ? { title: `${openLeads[0].company || openLeads[0].name} için teklif ve arama planı`, impact: "Orta", difficulty: "Kolay", duration: "30 dk", cost: "Yok", probability: 64, action: "AI Satış Asistanı çalıştır" } : null,
    { title: "Aktif müşteriler için haftalık remarketing kontrolü", impact: "Orta", difficulty: "Orta", duration: "1 saat", cost: "Düşük", probability: 58, action: "Meta/Google kontrol görevi oluştur" },
    { title: "En iyi kreatifleri HK Learning Center hafızasına al", impact: "Orta", difficulty: "Kolay", duration: "20 dk", cost: "Yok", probability: 66, action: "Agent Memory güncelle" }
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
  const [packageForm, setPackageForm] = useState({
    sector: "Nail Studio",
    targetCustomer: "Yerel hizmet işletmesi",
    serviceTypes: "Google Ads, Meta Ads, SEO, Landing Page, WhatsApp",
    monthlyBudgetRange: "30.000 - 100.000 TL",
    mainGoal: "randevu",
    channels: "Meta, Google Ads, SEO, WhatsApp, içerik, web site",
    outputType: "hepsi"
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
    return { today, month, companies, activeCustomers, passiveCustomers, leads, openLeads, newLeads, tasks, criticalTasks, completedToday, payments, pendingPayments, overduePayments, paidThisMonth, campaigns, activeCampaigns, reports, integrations, healthRows, riskyCustomers, revenue, receivable, adSpend, roasRows, risks };
  }, [content]);

  const agents = useMemo(() => teamAgents(content), [content]);
  const recs = useMemo(() => recommendations(content, data.riskyCustomers, data.overduePayments, data.openLeads), [content, data.riskyCustomers, data.overduePayments, data.openLeads]);
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

  function go(target: string, message?: string) {
    setActive(target);
    if (message) notify?.(message, "success");
  }

  function openDetail(title: string, description: string, actions: Array<{ label: string; target?: string; payload?: any }> = [], payload?: any) {
    setDetail({ title, description, actions, payload });
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
      notify?.("Marketplace paketi üretildi.", "success");
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
    if (response.ok) notify?.("Marketplace paketi kaydedildi.", "success");
    else notify?.("Paket kaydedilemedi; Supabase bağlantısını kontrol edin.", "error");
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
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{kpis.map(([label, value, note, Icon]: any) => <div key={label} className="rounded-[18px] border border-slate-200 bg-white p-4 shadow-sm"><span className="grid size-10 place-items-center rounded-[13px] bg-cyan-50 text-cyan-700"><Icon size={18} /></span><p className="mt-3 text-xs font-bold text-slate-500">{label}</p><p className="mt-1 text-2xl font-black text-slate-950">{value}</p><p className="mt-1 text-xs text-slate-500">{note}</p></div>)}</section>

          <section className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
            <PanelCard title="HK Digital Team" subtitle="Sanal ajans ekibi ve görev dağılımı" icon={<Bot size={20} />}>
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
            <PanelCard title="AI Recommendation Engine" subtitle="Beklenen etki, süre, maliyet ve başarı olasılığı" icon={<BrainCircuit size={20} />}>
              {recs.map((item) => <button key={item.title} onClick={() => openDetail(item.title, `Etki: ${item.impact}. Zorluk: ${item.difficulty}. Süre: ${item.duration}. Maliyet: ${item.cost}. Başarı olasılığı: %${item.probability}.`, [{ label: "Görev oluştur", target: "Görevler" }, { label: "Müşteriye not olarak kaydet", target: "Müşteriler" }, { label: "Agent Memory’ye kaydet", target: "HK Agent Hub" }, { label: "Uygula / planla", target: "Takvim" }], item)} className="rounded-[14px] border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-cyan-200 hover:bg-cyan-50"><p className="font-black text-slate-950">{item.title}</p><p className="mt-1 text-xs text-slate-500">Etki: {item.impact} · Zorluk: {item.difficulty} · Süre: {item.duration} · Maliyet: {item.cost} · Başarı: %{item.probability}</p><p className="mt-2 text-xs font-black text-cyan-700">{item.action}</p></button>)}
            </PanelCard>
          </section>

          <section className="grid gap-5 xl:grid-cols-3">
            <PanelCard title="AI Copilot Chat" subtitle="Tüm sistem için doğal dil komut ekranı" icon={<MessageSquareText size={20} />}>
              <textarea value={copilotQuestion} onChange={(event) => setCopilotQuestion(event.target.value)} className="min-h-24 w-full rounded-[14px] border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900" />
              <button onClick={askCopilot} className="mt-3 rounded-[12px] bg-cyan-500 px-4 py-3 text-sm font-black text-white">HK Intelligence ile Yanıtla</button>
              {copilotAnswer && <div className="mt-3 rounded-[14px] bg-cyan-50 p-3"><p className="whitespace-pre-line text-sm leading-6 text-cyan-950">{copilotAnswer}</p><div className="mt-3 flex flex-wrap gap-2"><SmallButton onClick={() => go("Müşteriler")}>Müşterilere git</SmallButton><SmallButton onClick={() => go("Görevler")}>Görev oluştur</SmallButton><SmallButton onClick={() => go("HK Agent Hub")}>Agent Hub’da analiz et</SmallButton><SmallButton onClick={() => go("Müşteri Raporları")}>Rapor oluştur</SmallButton></div></div>}
            </PanelCard>
            <PanelCard title="Smart Command Palette" subtitle="Cmd/Ctrl+K komut mantığı" icon={<Command size={20} />}>
              <input value={commandQuery} onChange={(event) => setCommandQuery(event.target.value)} placeholder="Komut ara: müşteri aç, rapor oluştur..." className="w-full rounded-[14px] border border-slate-200 bg-slate-50 px-3 py-3 text-sm" />
              <div className="mt-3 grid gap-2">{filteredCommands.map((item) => <button key={item} onClick={() => go(commandToTarget(item), `${item} komutu açıldı.`)} className="flex items-center justify-between rounded-[12px] bg-slate-50 px-3 py-2 text-left text-sm font-bold text-slate-700 transition hover:bg-cyan-50 hover:text-cyan-700"><span>{item}</span><ArrowRight size={14} /></button>)}</div>
            </PanelCard>
            <PanelCard title="Global Search" subtitle="Müşteri, görev, belge, rapor ve hafıza araması" icon={<Search size={20} />}>
              {[["Müşteriler", data.companies.length], ["Görevler", data.tasks.length], ["Raporlar", data.reports.length], ["Tahsilatlar", data.payments.length], ["Kampanyalar", data.campaigns.length], ["Agent Memory", (content.agentMemories || []).length]].map(([label, count]) => <ActionRow key={label} title={`${label}: ${count}`} note="Kategori bazlı arama indeksine dahil." onClick={() => go(searchTarget(String(label)))} />)}
            </PanelCard>
          </section>

          <section className="grid gap-5 xl:grid-cols-4">
            <MiniModule title="AI Kreatif Stüdyosu" icon={<Palette size={19} />} items={["Instagram", "Facebook", "Google Display", "Carousel", "Story", "Reels", "TikTok", "YouTube Shorts", "Banner", "Thumbnail", "Blog", "Mail", "WhatsApp", "SMS"]} onClick={() => openDetail("AI Kreatif Stüdyosu", "Seçilen formatlar için prompt göstermeden kreatif brief, metin ve üretim payload’ı hazırlanır.", [{ label: "AI Studio aç", target: "AI Studio" }, { label: "Prompt üret", target: "HK Agent Hub" }])} />
            <MiniModule title="AI Satış Asistanı" icon={<Target size={19} />} items={["Arama metni", "WhatsApp", "Teklif", "Toplantı", "Takip görevi", "CRM güncelle"]} onClick={() => openDetail("AI Satış Asistanı", "Lead için arama metni, WhatsApp, teklif, toplantı ve CRM takip payload’ı üretir.", [{ label: "Lead Workspace aç", target: "CRM & Lead Workspace" }, { label: "Teklif oluştur", target: "Teklif Oluştur" }])} />
            <MiniModule title="HK Learning Center" icon={<BrainCircuit size={19} />} items={["Başarılı reklam", "Kreatif", "Hedef kitle", "Teklif", "Satış süreci", "Agent Memory"]} onClick={() => openDetail("HK Learning Center", "Başarılı reklam, kreatif ve satış süreçleri Agent Memory’ye öğrenme kaydı olarak hazırlanır.", [{ label: "Agent Hub aç", target: "HK Agent Hub" }, { label: "Kaydet", payload: "learning" }])} />
            <MiniModule title="Digital Twin" icon={<Layers3 size={19} />} items={["12 ay", "Google", "Meta", "SEO", "CRM", "Rapor", "Tahsilat", "Notlar"]} onClick={() => openDetail("Digital Twin", "Müşteri geçmişi, raporları, tahsilatları, notları ve entegrasyonları tek müşteri ikizi bağlamında özetlenir.", [{ label: "Müşteri seç", target: "Müşteriler" }, { label: "Agent ile sor", target: "HK Agent Hub" }])} />
          </section>

          <section className="grid gap-5 xl:grid-cols-3">
            <PanelCard title="Marketplace" subtitle="Hazır AI paketleri" icon={<BriefcaseBusiness size={20} />}>
              <button onClick={() => setMarketplaceOpen(true)} className="mb-3 inline-flex items-center gap-2 rounded-[12px] bg-cyan-500 px-4 py-2.5 text-sm font-black text-white"><Plus size={16} /> Yeni Paket Üret</button>
              <div className="grid gap-2 sm:grid-cols-2">{marketplaceSectors.map((item) => <div key={item} className="rounded-[12px] border border-slate-200 bg-slate-50 p-3"><p className="font-black text-slate-900">{item}</p><p className="mt-1 text-xs text-slate-500">Prompt, workflow (iş akışı), AI Team, KPI ve rapor şablonu.</p><div className="mt-3 flex flex-wrap gap-1.5"><TinyButton onClick={() => generateMarketplacePackage(item)}>Prompt Üret</TinyButton><TinyButton onClick={() => generateMarketplacePackage(item)}>Workflow Üret</TinyButton><TinyButton onClick={() => generateMarketplacePackage(item)}>AI Team Kur</TinyButton><TinyButton onClick={() => generateMarketplacePackage(item)}>KPI Şablonu</TinyButton><TinyButton onClick={() => generateMarketplacePackage(item)}>Rapor Şablonu</TinyButton><TinyButton onClick={() => openDetail(`${item} paketi müşteriye uygula`, "Müşteri seçimi sonrası paket Agent Memory, workflow taslağı ve görev payload’ı olarak uygulanır.", [{ label: "Müşterilere git", target: "Müşteriler" }, { label: "Agent Hub’da aç", target: "HK Agent Hub" }])}>Müşteriye Uygula</TinyButton></div></div>)}</div>
            </PanelCard>
            <PanelCard title="Çok Şubeli Yapı" subtitle="Tek panel, ayrı şube KPI ve raporları" icon={<BuildingIcon />}>
              {data.companies.slice(0, 5).map((company: any) => <ActionRow key={company.id} title={company.name} note="Şube altyapısı customer_branches tablosu ile hazır." onClick={() => openDetail(`${company.name} şube yapısı`, "Yeni şube ekleme, ayrı reklam/rapor/KPI payload’ı ve müşteri profili bağlantısı hazırlanır.", [{ label: "Müşteri profilini aç", target: "Müşteriler" }, { label: "Rapor oluştur", target: "Müşteri Raporları" }])} />)}
            </PanelCard>
            <PanelCard title="Health / Cost / Backup Center" subtitle="Sistem sağlığı, AI maliyeti ve yedekleme" icon={<Database size={20} />}>
              {["Database, Supabase, Storage, Cron, Queue, API", "OpenAI, Gemini, Claude, Groq, OpenRouter, Manus, Ollama", "Meta API, Google Ads API, GA4, Search Console, SMTP, Resend, Discord", "Otomatik günlük/haftalık/aylık yedek hazırlığı"].map((item) => <ActionRow key={item} title={item} note="Durum, son kontrol, yanıt süresi ve çözüm önerisi izlenir." onClick={() => go(healthTarget(item))} />)}
              <div className="mt-3 flex flex-wrap gap-2"><SmallButton onClick={() => go("QA Merkezi")}>Sağlık Kontrolü Yap</SmallButton><SmallButton onClick={() => go("HK Agent Hub")}>AI Maliyetlerini Aç</SmallButton><SmallButton onClick={() => go("Veri Aktarma")}>Yedeğe Git</SmallButton></div>
            </PanelCard>
          </section>

          <PanelCard title="Customer Timeline" subtitle="Müşteri tarihçesi ve operasyon olayları" icon={<ClipboardList size={20} />}>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{data.healthRows.slice(0, 8).map(({ company, health }: any) => <button key={company.id} onClick={() => openDetail(`${company.name} timeline`, buildTimeline(company, content), [{ label: "Müşteri profilini aç", target: "Müşteriler" }, { label: "Rapor oluştur", target: "Müşteri Raporları" }, { label: "Not ekle", target: "Müşteriler" }, { label: "Kapanış kontrolü", target: "Müşteriler" }])} className="rounded-[16px] border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-cyan-200 hover:bg-cyan-50"><p className="font-black text-slate-950">{company.name}</p><p className="mt-1 text-xs text-slate-500">Oluşturuldu → İlk görüşme → Teklif → Sözleşme → Pixel/GA4 → Kampanya → Rapor → Tahsilat</p><span className={`mt-3 inline-flex rounded-full px-3 py-1 text-[11px] font-black ring-1 ${toneForSeverity(health.status === "Kritik" ? "Kritik" : health.status === "Riskli" ? "Orta" : "Bilgi")}`}>{health.score}/100</span></button>)}</div>
          </PanelCard>
        </>
      )}
      {detail && <ActionModal detail={detail} onClose={() => setDetail(null)} onGo={go} onCopy={copyText} />}
      {marketplaceOpen && <MarketplaceModal form={packageForm} setForm={setPackageForm} draft={marketplaceDraft} loading={marketplaceLoading} onClose={() => setMarketplaceOpen(false)} onGenerate={() => generateMarketplacePackage()} onSave={saveMarketplacePackage} onCopy={copyText} />}
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

function buildTimeline(company: any, content: any) {
  const campaigns = (content.campaigns || []).filter((item: any) => item.company_id === company.id).length;
  const reports = (content.reports || []).filter((item: any) => item.company_id === company.id).length;
  const payments = (content.paymentRecords || []).filter((item: any) => item.company_id === company.id).length;
  const tasks = (content.agencyTasks || []).filter((item: any) => item.company_id === company.id).length;
  const integration = (content.customerIntegrations || []).find((item: any) => item.company_id === company.id);
  return [
    `Oluşturuldu: ${company.created_at ? new Date(company.created_at).toLocaleDateString("tr-TR") : "tarih yok"}`,
    `Kampanya sinyali: ${campaigns}`,
    `Rapor sinyali: ${reports}`,
    `Tahsilat sinyali: ${payments}`,
    `Görev sinyali: ${tasks}`,
    `Pixel/GA4: ${integration?.meta_pixel_id || integration?.ga4_measurement_id ? "var" : "eksik"}`,
    "Hazırlık modu: timeline detayları ilgili müşteri profilinde derinleştirilebilir."
  ].join("\n");
}

function buildMarketplaceFallback(input: any) {
  const sector = input.sector || "Sektör";
  const channels = Array.isArray(input.channels) ? input.channels : String(input.channels || "Meta, Google Ads, SEO").split(",").map((item) => item.trim()).filter(Boolean);
  const serviceTypes = Array.isArray(input.serviceTypes) ? input.serviceTypes : String(input.serviceTypes || "Google Ads, Meta Ads").split(",").map((item) => item.trim()).filter(Boolean);
  return {
    packageName: `${sector} Growth OS Paketi`,
    package_name: `${sector} Growth OS Paketi`,
    sector,
    targetCustomer: input.targetCustomer || input.target_customer || "Yerel hizmet işletmesi",
    target_customer: input.targetCustomer || input.target_customer || "Yerel hizmet işletmesi",
    serviceTypes,
    service_types: serviceTypes,
    channels,
    monthlyBudgetRange: input.monthlyBudgetRange || input.monthly_budget_range || "30.000 - 100.000 TL",
    monthly_budget_range: input.monthlyBudgetRange || input.monthly_budget_range || "30.000 - 100.000 TL",
    mainGoal: input.mainGoal || input.main_goal || "lead",
    main_goal: input.mainGoal || input.main_goal || "lead",
    generatedPrompt: `${sector} sektörü için Google, Meta, SEO, WhatsApp ve raporlama verilerini analiz et. Satış garantisi verme. İlk 30 gün için öncelikli aksiyon, risk, fırsat, KPI ve teklif dilini Türkçe üret.`,
    generated_prompt: `${sector} sektörü için Google, Meta, SEO, WhatsApp ve raporlama verilerini analiz et. Satış garantisi verme. İlk 30 gün için öncelikli aksiyon, risk, fırsat, KPI ve teklif dilini Türkçe üret.`,
    workflowSteps: ["Müşteri hedefini doğrula", "Rakip ve arama görünürlüğünü incele", "Google/Meta fırsatlarını çıkar", "Landing page ve WhatsApp akışını planla", "İlk teklif ve 7 günlük takip planı üret"],
    workflow_steps: ["Müşteri hedefini doğrula", "Rakip ve arama görünürlüğünü incele", "Google/Meta fırsatlarını çıkar", "Landing page ve WhatsApp akışını planla", "İlk teklif ve 7 günlük takip planı üret"],
    aiTeam: ["CEO", "Satış Müdürü", "Google Ads Uzmanı", "Meta Ads Uzmanı", "SEO Uzmanı", "Creative Director", "Reporting Manager"],
    ai_team: ["CEO", "Satış Müdürü", "Google Ads Uzmanı", "Meta Ads Uzmanı", "SEO Uzmanı", "Creative Director", "Reporting Manager"],
    kpiTemplate: ["Lead sayısı", "Randevu oranı", "CPL", "ROAS", "WhatsApp dönüşümü", "Rapor görünürlüğü"],
    kpi_template: ["Lead sayısı", "Randevu oranı", "CPL", "ROAS", "WhatsApp dönüşümü", "Rapor görünürlüğü"],
    reportTemplate: ["Yönetici özeti", "Kanal performansı", "Riskler", "Fırsatlar", "7 günlük plan"],
    report_template: ["Yönetici özeti", "Kanal performansı", "Riskler", "Fırsatlar", "7 günlük plan"],
    proposalDraft: `${sector} için başlangıçta ${serviceTypes.join(" + ")} paketi önerilir. Hedef ${input.mainGoal || "lead"} olduğundan ilk ay ölçümleme, hızlı kazanımlar ve rapor disiplini önceliklendirilir.`,
    proposal_draft: `${sector} için başlangıçta ${serviceTypes.join(" + ")} paketi önerilir. Hedef ${input.mainGoal || "lead"} olduğundan ilk ay ölçümleme, hızlı kazanımlar ve rapor disiplini önceliklendirilir.`,
    operationPlan: ["1. hafta: analiz ve kurulum", "2. hafta: kampanya ve kreatif yayına alma", "3. hafta: optimizasyon", "4. hafta: rapor ve yenileme teklifi"],
    operation_plan: ["1. hafta: analiz ve kurulum", "2. hafta: kampanya ve kreatif yayına alma", "3. hafta: optimizasyon", "4. hafta: rapor ve yenileme teklifi"],
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

function ActionModal({ detail, onClose, onGo, onCopy }: { detail: any; onClose: () => void; onGo: (target: string, message?: string) => void; onCopy: (text: string) => void }) {
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
          <p className="text-xs font-black text-slate-500">Kullanılabilir payload</p>
          <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-700">{payload}</pre>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {(detail.actions || []).map((action: any) => <button key={action.label} onClick={() => action.target ? onGo(action.target, `${action.label} açıldı.`) : onCopy(JSON.stringify(action.payload || detail.payload || detail, null, 2))} className="rounded-[12px] bg-cyan-500 px-4 py-2.5 text-sm font-black text-white">{action.label}</button>)}
          <button onClick={() => onCopy(payload)} className="inline-flex items-center gap-2 rounded-[12px] border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-700"><Copy size={15} /> Kopyala</button>
          <button onClick={onClose} className="rounded-[12px] border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-500">Kapat</button>
        </div>
      </section>
    </div>
  );
}

function MarketplaceModal({ form, setForm, draft, loading, onClose, onGenerate, onSave, onCopy }: any) {
  const draftText = draft ? JSON.stringify(draft, null, 2) : "";
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/45 p-4">
      <section className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-[24px] bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">Marketplace</p><h2 className="mt-1 text-2xl font-black text-slate-950">Yeni Paket Üret</h2></div>
          <button onClick={onClose} className="rounded-full border border-slate-200 p-2 text-slate-500"><X size={18} /></button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {[
            ["sector", "Sektör adı"],
            ["targetCustomer", "Hedef müşteri tipi"],
            ["serviceTypes", "Hizmet türleri"],
            ["monthlyBudgetRange", "Aylık bütçe aralığı"],
            ["mainGoal", "Ana hedef"],
            ["channels", "Kullanılacak kanallar"],
            ["outputType", "Çıktı tipi"]
          ].map(([key, label]) => <label key={key} className="grid gap-1 text-sm font-bold text-slate-700">{label}<input value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900" /></label>)}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button disabled={loading} onClick={onGenerate} className="inline-flex items-center gap-2 rounded-[12px] bg-cyan-500 px-4 py-2.5 text-sm font-black text-white disabled:opacity-60"><Sparkles size={16} /> {loading ? "Üretiliyor..." : "Prompt / Workflow / KPI Üret"}</button>
          {draft && <button onClick={onSave} className="inline-flex items-center gap-2 rounded-[12px] border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-sm font-black text-cyan-700"><Save size={16} /> Kaydet</button>}
          {draft && <button onClick={() => onCopy(draftText)} className="inline-flex items-center gap-2 rounded-[12px] border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-700"><Copy size={16} /> Çıktıyı Kopyala</button>}
        </div>
        {draft && <pre className="mt-4 max-h-[45vh] overflow-auto rounded-[16px] bg-slate-950 p-4 text-xs leading-5 text-cyan-50">{draftText}</pre>}
      </section>
    </div>
  );
}
