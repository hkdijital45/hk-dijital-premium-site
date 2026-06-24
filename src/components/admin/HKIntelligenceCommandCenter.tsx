"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Bot, Building2, CalendarDays, CircleDollarSign, CircleGauge, FileText, HeartPulse, RefreshCw, ShieldAlert, Sparkles, Target, UsersRound } from "lucide-react";

const lifecycleStages = ["Lead", "Görüşme", "Teklif", "Kazanıldı", "Onboarding", "Aktif Müşteri", "Raporlama", "Tahsilat", "Yenileme", "Referans"];
const closedLeadStatuses = ["Kazanıldı", "Kazandı", "Kaybedildi", "Dönüştürüldü", "Müşteri Oldu", "Reddedildi"];
const paidStatuses = ["Ödendi", "Tahsil Edildi"];
const completedTaskStatuses = ["Tamamlandı", "İptal"];

function numberValue(value: any) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = String(value ?? "").replace(/[^0-9,.-]/g, "").replace(/\.(?=.*\.)/g, "").replace(",", ".");
  return Number(normalized) || 0;
}

function money(value: any) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(numberValue(value));
}

function dateLabel(value: any) {
  if (!value) return "Tarih yok";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Tarih yok" : new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function dayDifference(value: any) {
  if (!value) return Number.POSITIVE_INFINITY;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return Number.POSITIVE_INFINITY;
  return Math.floor((Date.now() - date.getTime()) / 86400000);
}

function isArchived(item: any) {
  return Boolean(item?.archived_at || item?.deleted_at || item?.is_archived || item?.status === "Arşivlendi");
}

function companyName(companies: any[], companyId: string) {
  return companies.find((item) => item.id === companyId)?.name || "Firma belirtilmedi";
}

function leadStage(lead: any) {
  const value = String(lead?.pipeline_stage || lead?.status || "").toLocaleLowerCase("tr-TR");
  if (value.includes("kazan") || value.includes("müşteri") || value.includes("dönüştür")) return "Kazanıldı";
  if (value.includes("teklif") || numberValue(lead?.proposal_amount)) return "Teklif";
  if (value.includes("iletişim") || value.includes("görüş") || value.includes("toplantı") || value.includes("takip")) return "Görüşme";
  return "Lead";
}

function customerHealth(company: any, context: any) {
  const today = new Date().toISOString().slice(0, 10);
  const payments = context.payments.filter((item: any) => item.company_id === company.id && !isArchived(item));
  const tasks = context.tasks.filter((item: any) => item.company_id === company.id && !isArchived(item));
  const campaigns = context.campaigns.filter((item: any) => item.company_id === company.id && !isArchived(item));
  const reports = context.reports.filter((item: any) => item.company_id === company.id && !isArchived(item));
  const lead = context.leads.find((item: any) => item.company_id === company.id || String(item.company || "").toLocaleLowerCase("tr-TR") === String(company.name || "").toLocaleLowerCase("tr-TR"));
  const overduePayments = payments.filter((item: any) => !paidStatuses.includes(item.status) && item.due_date && item.due_date < today);
  const overdueTasks = tasks.filter((item: any) => !completedTaskStatuses.includes(item.status) && item.due_date && item.due_date < today);
  const activeCampaigns = campaigns.filter((item: any) => ["Aktif", "ACTIVE"].includes(item.status));
  const latestReport = [...reports].sort((a, b) => Number(new Date(b.updated_at || b.created_at || 0)) - Number(new Date(a.updated_at || a.created_at || 0)))[0];
  const contactDays = dayDifference(lead?.last_contact_at || company.last_contact_at || company.updated_at);
  const reportDays = dayDifference(latestReport?.published_at || latestReport?.updated_at || latestReport?.created_at);
  let score = 100;
  const reasons: string[] = [];
  if (overduePayments.length) { score -= Math.min(30, 15 + overduePayments.length * 5); reasons.push(`${overduePayments.length} tahsilat gecikmiş.`); }
  if (overdueTasks.length) { score -= Math.min(25, 10 + overdueTasks.length * 4); reasons.push(`${overdueTasks.length} görev gecikmiş.`); }
  if (!activeCampaigns.length) { score -= 12; reasons.push("Aktif kampanya bulunmuyor."); }
  if (contactDays > 14) { score -= contactDays > 30 ? 18 : 10; reasons.push(`${contactDays} gündür temas kaydı yok.`); }
  if (reportDays > 45) { score -= 12; reasons.push("Rapor güncelliği 45 günü geçti."); }
  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, status: score >= 75 ? "Sağlıklı" : score >= 50 ? "Riskli" : "Kaybedilebilir", reasons: reasons.length ? reasons : ["Tahsilat, görev, iletişim ve raporlama sinyalleri düzenli."] };
}

function lifecycleFor(company: any, context: any) {
  const relatedLead = context.leads.find((item: any) => item.company_id === company.id || String(item.company || "").toLocaleLowerCase("tr-TR") === String(company.name || "").toLocaleLowerCase("tr-TR"));
  const reports = context.reports.filter((item: any) => item.company_id === company.id && !isArchived(item));
  const payments = context.payments.filter((item: any) => item.company_id === company.id && !isArchived(item));
  const onboardingTasks = context.tasks.filter((item: any) => item.company_id === company.id && /onboarding|kurulum|erişim/i.test(`${item.title || ""} ${item.description || ""}`));
  if (/referans/i.test(company.lifecycle_stage || company.status || "")) return "Referans";
  if (/yenile/i.test(company.lifecycle_stage || "")) return "Yenileme";
  if (payments.some((item: any) => !paidStatuses.includes(item.status))) return "Tahsilat";
  if (reports.length) return "Raporlama";
  if (company.status === "Aktif" && onboardingTasks.length && onboardingTasks.some((item: any) => !completedTaskStatuses.includes(item.status))) return "Onboarding";
  if (company.status === "Aktif") return "Aktif Müşteri";
  return relatedLead ? leadStage(relatedLead) : "Onboarding";
}

function statusClass(status: string) {
  if (["Sağlıklı", "Çalışıyor", "Düşük"].includes(status)) return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (["Riskli", "Uyarı", "Orta"].includes(status)) return "bg-amber-50 text-amber-700 ring-amber-200";
  return "bg-red-50 text-red-700 ring-red-200";
}

export function HKIntelligenceCommandCenter({ content, setActive, notify, initialView = "command" }: any) {
  const [view, setView] = useState(initialView);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnswer, setAiAnswer] = useState("");
  const companies = useMemo(() => (content.companies || []).filter((item: any) => !isArchived(item)), [content.companies]);
  const leads = useMemo(() => (content.leads || []).filter((item: any) => !isArchived(item)), [content.leads]);
  const campaigns = useMemo(() => (content.campaigns || []).filter((item: any) => !isArchived(item)), [content.campaigns]);
  const payments = useMemo(() => (content.paymentRecords || []).filter((item: any) => !isArchived(item)), [content.paymentRecords]);
  const tasks = useMemo(() => (content.agencyTasks || []).filter((item: any) => !isArchived(item)), [content.agencyTasks]);
  const reports = useMemo(() => (content.reports || []).filter((item: any) => !isArchived(item)), [content.reports]);
  const expenses = useMemo(() => (content.agencyExpenses || []).filter((item: any) => !isArchived(item)), [content.agencyExpenses]);
  const integrations = useMemo(() => content.adIntegrations || [], [content.adIntegrations]);
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const openLeads = leads.filter((item: any) => !closedLeadStatuses.includes(item.status) && !closedLeadStatuses.includes(item.pipeline_stage));
  const openProposals = leads.filter((item: any) => ["Teklif Hazırlanıyor", "Teklif Gönderildi", "Teklif Görüntülendi", "Revize İstendi"].includes(item.proposal_status || item.status));
  const overduePayments = payments.filter((item: any) => !paidStatuses.includes(item.status) && item.status !== "İptal" && (item.status === "Gecikmiş" || item.due_date && item.due_date < today));
  const pendingPayments = payments.filter((item: any) => !paidStatuses.includes(item.status) && item.status !== "İptal");
  const paidThisMonth = payments.filter((item: any) => paidStatuses.includes(item.status) && String(item.paid_at || item.payment_date || item.updated_at || "").startsWith(month));
  const criticalTasks = tasks.filter((item: any) => !completedTaskStatuses.includes(item.status) && (item.priority === "Kritik" || item.due_date && item.due_date < today));
  const activeCustomers = companies.filter((item: any) => item.status === "Aktif");
  const newCustomers = companies.filter((item: any) => String(item.created_at || "").startsWith(month));
  const followUpLeads = openLeads.filter((item: any) => item.next_action_at && item.next_action_at <= today || dayDifference(item.last_contact_at || item.updated_at) >= 3);
  const expiringProposals = openProposals.filter((item: any) => item.estimated_close_date && item.estimated_close_date <= today);
  const pixelRisks = integrations.filter((item: any) => item.provider === "meta" && item.pixel_enabled && (!item.pixel_id || /hata|geçersiz|başarısız/i.test(`${item.pixel_status || ""} ${item.sync_message || ""}`)));
  const integrationRisks = integrations.filter((item: any) => /hata|geçersiz|başarısız|yetki eksik/i.test(`${item.status || ""} ${item.sync_status || ""} ${item.sync_message || ""}`));
  const proposalForecast = openLeads.reduce((sum: number, lead: any) => {
    const stage = leadStage(lead);
    const weight = stage === "Teklif" ? .55 : stage === "Görüşme" ? .25 : .1;
    return sum + numberValue(lead.proposal_amount || lead.budget) * weight;
  }, 0);
  const expectedRevenue = pendingPayments.reduce((sum: number, item: any) => sum + numberValue(item.amount), 0) + proposalForecast;

  const healthRows = companies.map((company: any) => ({ company, health: customerHealth(company, { leads, campaigns, payments, tasks, reports }) })).sort((a: any, b: any) => a.health.score - b.health.score);
  const lifecycleRows = companies.map((company: any) => ({ company, stage: lifecycleFor(company, { leads, payments, reports, tasks }) }));
  const profitRows = companies.map((company: any) => {
    const companyPayments = payments.filter((item: any) => item.company_id === company.id);
    const companyCampaigns = campaigns.filter((item: any) => item.company_id === company.id);
    const companyExpenses = expenses.filter((item: any) => item.company_id === company.id);
    const collected = companyPayments.filter((item: any) => paidStatuses.includes(item.status)).reduce((sum: number, item: any) => sum + numberValue(item.amount), 0);
    const pending = companyPayments.filter((item: any) => !paidStatuses.includes(item.status) && item.status !== "İptal").reduce((sum: number, item: any) => sum + numberValue(item.amount), 0);
    const adSpend = companyCampaigns.reduce((sum: number, item: any) => sum + numberValue(item.spent_budget ?? item.spent), 0);
    const operationCost = companyExpenses.reduce((sum: number, item: any) => sum + numberValue(item.amount), 0);
    return { company, serviceFee: collected + pending, collected, pending, adSpend, operationCost, profit: collected - operationCost };
  }).sort((a: any, b: any) => b.profit - a.profit);

  const risks = [
    ...overduePayments.map((item: any) => ({ id: `payment-${item.id}`, priority: 95, module: "Tahsilat", title: `${companyName(companies, item.company_id)} tahsilatı gecikti`, detail: `${money(item.amount)} · Vade ${dateLabel(item.due_date)}`, target: "Tahsilat" })),
    ...criticalTasks.map((item: any) => ({ id: `task-${item.id}`, priority: item.priority === "Kritik" ? 90 : 75, module: "Görevler", title: item.title || "Kritik görev", detail: `${companyName(companies, item.company_id)} · ${dateLabel(item.due_date)}`, target: "Görevler" })),
    ...pixelRisks.map((item: any) => ({ id: `pixel-${item.id}`, priority: 88, module: "Meta", title: `${companyName(companies, item.company_id)} Pixel kontrolü gerekli`, detail: item.sync_message || item.pixel_status || "Pixel ID veya doğrulama durumu eksik.", target: "Entegrasyonlar" })),
    ...integrationRisks.map((item: any) => ({ id: `integration-${item.id}`, priority: 82, module: "Entegrasyon", title: `${companyName(companies, item.company_id)} bağlantı hatası`, detail: item.sync_message || item.status || "Bağlantı başarısız.", target: "Entegrasyonlar" })),
    ...healthRows.filter((item: any) => item.health.score < 50).map((item: any) => ({ id: `health-${item.company.id}`, priority: 80, module: "Müşteri", title: `${item.company.name} kaybedilme riski taşıyor`, detail: item.health.reasons[0], target: "Müşteriler" })),
    ...expiringProposals.map((item: any) => ({ id: `proposal-${item.id}`, priority: 76, module: "Teklif", title: `${item.company || item.name} teklifi sonuç bekliyor`, detail: `Kapanış tarihi ${dateLabel(item.estimated_close_date)}`, target: "Teklif Oluştur" }))
  ].sort((a, b) => b.priority - a.priority);

  const recommendations = [
    healthRows[0] && healthRows[0].health.score < 70 ? `${healthRows[0].company.name} için müşteri sağlık nedenlerini inceleyin.` : "Müşteri sağlık skorları stabil; en düşük skorlu hesabı yine de haftalık gözden geçirin.",
    followUpLeads[0] ? `${followUpLeads[0].company || followUpLeads[0].name} için bugün takip görüşmesi planlayın.` : "Bugüne gecikmiş lead takibi görünmüyor.",
    overduePayments[0] ? `${companyName(companies, overduePayments[0].company_id)} için ${money(overduePayments[0].amount)} tahsilat hatırlatması hazırlayın.` : "Gecikmiş tahsilat görünmüyor.",
    campaigns.filter((item: any) => item.status === "Aktif").length ? "Aktif kampanyalarda son 7 gün performansını ve yeniden hedefleme fırsatını kontrol edin." : "Aktif kampanya bulunmuyor; uygun müşteriler için kampanya önerisi hazırlayın."
  ];

  const calendarItems = [
    ...tasks.filter((item: any) => item.due_date).map((item: any) => ({ id: `task-${item.id}`, date: item.due_date, type: "Görev", title: item.title, target: "Görevler" })),
    ...payments.filter((item: any) => item.due_date && !paidStatuses.includes(item.status)).map((item: any) => ({ id: `payment-${item.id}`, date: item.due_date, type: "Tahsilat", title: companyName(companies, item.company_id), target: "Tahsilat" })),
    ...openProposals.filter((item: any) => item.estimated_close_date).map((item: any) => ({ id: `proposal-${item.id}`, date: item.estimated_close_date, type: "Teklif", title: item.company || item.name, target: "Teklif Oluştur" })),
    ...campaigns.filter((item: any) => item.end_date && item.status === "Aktif").map((item: any) => ({ id: `campaign-${item.id}`, date: item.end_date, type: "Kampanya", title: item.name, target: "Kampanyalar" })),
    ...reports.filter((item: any) => item.end_date || item.report_date).map((item: any) => ({ id: `report-${item.id}`, date: item.end_date || item.report_date, type: "Rapor", title: item.title || item.report_type || "Rapor", target: "Müşteri Raporları" }))
  ].filter((item: any) => item.date >= today).sort((a: any, b: any) => String(a.date).localeCompare(String(b.date))).slice(0, 10);

  const priorities = [
    { count: overduePayments.length, text: "tahsilat gecikmiş", target: "Tahsilat", tone: "text-red-700 bg-red-50" },
    { count: followUpLeads.length, text: "lead aranmayı bekliyor", target: "Takip Merkezi", tone: "text-cyan-700 bg-cyan-50" },
    { count: pixelRisks.length, text: "müşteri Pixel hatası veriyor", target: "Entegrasyonlar", tone: "text-orange-700 bg-orange-50" },
    { count: expiringProposals.length, text: "teklif bugün sonuç bekliyor", target: "Teklif Oluştur", tone: "text-amber-700 bg-amber-50" },
    { count: criticalTasks.length, text: "kritik veya gecikmiş görev var", target: "Görevler", tone: "text-purple-700 bg-purple-50" }
  ];

  async function askCopilot() {
    setAiLoading(true);
    try {
      const response = await fetch("/api/admin/operations-assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: "Bugün ne yapmalıyım? Riskleri ve gelir fırsatlarını önem sırasıyla özetle." }) });
      const data = await response.json().catch(() => ({}));
      setAiAnswer(data.answer || recommendations.join("\n"));
      notify?.("HK Intelligence günlük planı güncelledi.", "success");
    } catch {
      setAiAnswer(recommendations.join("\n"));
      notify?.("AI sağlayıcısı yanıt vermedi; yerel operasyon özeti kullanıldı.", "warning");
    } finally {
      setAiLoading(false);
    }
  }

  const kpis = [
    ["Bu Ay Tahsil Edilen", money(paidThisMonth.reduce((sum: number, item: any) => sum + numberValue(item.amount), 0)), "Tahsilat", CircleDollarSign, "bg-emerald-50 text-emerald-700"],
    ["Bekleyen Tahsilatlar", money(pendingPayments.reduce((sum: number, item: any) => sum + numberValue(item.amount), 0)), "Tahsilat", CircleGauge, "bg-orange-50 text-orange-700"],
    ["Açık Leadler", openLeads.length, "Satış Hunisi", Target, "bg-cyan-50 text-cyan-700"],
    ["Açık Teklifler", openProposals.length, "Teklif Oluştur", FileText, "bg-amber-50 text-amber-700"],
    ["Kritik Görevler", criticalTasks.length, "Görevler", AlertTriangle, "bg-red-50 text-red-700"],
    ["Aktif Müşteriler", activeCustomers.length, "Müşteriler", UsersRound, "bg-blue-50 text-blue-700"],
    ["Bu Ay Yeni Müşteriler", newCustomers.length, "Müşteriler", Building2, "bg-indigo-50 text-indigo-700"],
    ["Tahmini Gelir", money(expectedRevenue), "Gelir Tahmini", CircleDollarSign, "bg-purple-50 text-purple-700"]
  ];

  return <div className="grid gap-5">
    <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_16px_38px_rgba(15,23,42,.07)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">HK Intelligence</p><h1 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">Ajans Command Center</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">CRM, tahsilat, görev, teklif, kampanya ve entegrasyon verilerini günlük karar sırasına dönüştürür.</p></div>
        <button onClick={askCopilot} disabled={aiLoading} className="inline-flex min-h-12 items-center gap-2 rounded-[14px] bg-purple-600 px-5 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 disabled:opacity-60"><Sparkles size={17} /> {aiLoading ? "Önceliklendiriliyor..." : "AI Günlük Özeti Yenile"}</button>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">{[["command", "Günlük Komuta"], ["lifecycle", "Müşteri Yaşam Döngüsü"], ["profit", "Karlılık Merkezi"], ["risk", "Risk Merkezi"]].map(([id, label]) => <button key={id} onClick={() => setView(id)} className={`rounded-full px-4 py-2 text-xs font-black ${view === id ? "bg-cyan-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{label}</button>)}</div>
    </section>

    {view === "command" && <>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8">{kpis.map(([label, value, target, Icon, tone]: any) => <button key={label} onClick={() => setActive(target)} className="rounded-[18px] border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-md"><span className={`grid size-10 place-items-center rounded-[13px] ${tone}`}><Icon size={19} /></span><strong className="mt-3 block text-xl font-black text-slate-950">{value}</strong><span className="mt-1 block text-xs font-bold text-slate-500">{label}</span></button>)}</section>
      <section className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.14em] text-purple-600">Bugün ne yapmalıyım?</p><h2 className="mt-1 text-xl font-black text-slate-950">AI Öncelik Merkezi</h2></div><Bot className="text-purple-600" /></div><div className="mt-4 grid gap-2">{priorities.map((item) => <button key={item.text} onClick={() => setActive(item.target)} className={`flex items-center justify-between gap-3 rounded-[14px] p-3 text-left ${item.tone}`}><span className="text-sm font-bold"><strong className="mr-2 text-lg">{item.count}</strong>{item.text}</span><ArrowRight size={16} /></button>)}</div>{aiAnswer && <p className="mt-4 whitespace-pre-line rounded-[14px] border border-purple-100 bg-purple-50 p-4 text-sm leading-7 text-slate-700">{aiAnswer}</p>}</div>
        <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.14em] text-cyan-700">Öneri Motoru</p><h2 className="mt-1 text-xl font-black text-slate-950">Bugünün önerileri</h2></div><RefreshCw size={18} className="text-cyan-600" /></div><div className="mt-4 grid gap-3">{recommendations.map((item, index) => <div key={item} className="flex gap-3 rounded-[14px] bg-slate-50 p-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-cyan-100 text-xs font-black text-cyan-700">{index + 1}</span><p className="text-sm leading-6 text-slate-700">{item}</p></div>)}</div></div>
      </section>
      <section className="grid gap-5 xl:grid-cols-3"><div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2"><div className="flex items-center justify-between"><div><h2 className="text-lg font-black text-slate-950">Operasyon Takvimi</h2><p className="mt-1 text-sm text-slate-500">Yaklaşan görev, tahsilat, teklif, kampanya ve rapor tarihleri.</p></div><button onClick={() => setActive("Takvim")} className="rounded-full bg-blue-50 px-3 py-2 text-xs font-black text-blue-700">Takvimi Aç</button></div><div className="mt-4 grid gap-2">{calendarItems.map((item: any) => <button key={item.id} onClick={() => setActive(item.target)} className="flex items-center gap-3 rounded-[13px] border border-slate-100 bg-slate-50 p-3 text-left"><CalendarDays size={17} className="text-blue-600" /><span className="min-w-0 flex-1"><strong className="block truncate text-sm text-slate-900">{item.title}</strong><span className="text-xs text-slate-500">{item.type} · {dateLabel(item.date)}</span></span></button>)}{!calendarItems.length && <p className="rounded-[14px] border border-dashed border-slate-200 p-4 text-sm text-slate-500">Yaklaşan operasyon tarihi bulunmuyor.</p>}</div></div><div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-black text-slate-950">Müşteri Sağlığı</h2><p className="mt-1 text-sm text-slate-500">En düşük skorlu müşteriler önce gösterilir.</p><div className="mt-4 grid gap-3">{healthRows.slice(0, 6).map(({ company, health }: any) => <button key={company.id} onClick={() => setActive("Müşteriler")} className="rounded-[13px] border border-slate-100 p-3 text-left"><span className="flex items-center justify-between gap-2"><strong className="truncate text-sm text-slate-900">{company.name}</strong><span className={`rounded-full px-2 py-1 text-[10px] font-black ring-1 ${statusClass(health.status)}`}>{health.score}/100</span></span><span className="mt-2 block text-xs text-slate-500">{health.reasons[0]}</span></button>)}</div></div></section>
    </>}

    {view === "lifecycle" && <section className="grid gap-5"><div className="overflow-x-auto rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-xl font-black text-slate-950">Müşteri yaşam döngüsü pipeline</h2><p className="mt-1 text-sm text-slate-500">Lead aşamasından referansa kadar tüm müşteri ilişkisini mevcut operasyon kayıtlarıyla izleyin.</p><div className="mt-5 grid min-w-[1100px] grid-cols-10 gap-2">{lifecycleStages.map((stage) => <div key={stage} className="rounded-[14px] border border-slate-200 bg-slate-50 p-3 text-center"><strong className="block text-xs text-slate-700">{stage}</strong><span className="mt-2 block text-2xl font-black text-cyan-700">{lifecycleRows.filter((item: any) => item.stage === stage).length}</span></div>)}</div></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{lifecycleRows.map(({ company, stage }: any) => { const health = healthRows.find((item: any) => item.company.id === company.id)?.health; return <button key={company.id} onClick={() => setActive("Müşteriler")} className="rounded-[18px] border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-cyan-200"><div className="flex items-start justify-between gap-3"><span><strong className="block text-slate-950">{company.name}</strong><span className="mt-1 block text-xs text-slate-500">{company.sector || "Sektör belirtilmedi"}</span></span><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ring-1 ${statusClass(health?.status)}`}>{health?.score || 0}/100</span></div><div className="mt-4 flex items-center gap-2 text-xs font-black text-cyan-700"><span className="rounded-full bg-cyan-50 px-3 py-1.5">{stage}</span><ArrowRight size={14} /></div></button>; })}</div></section>}

    {view === "profit" && <section className="grid gap-5"><div className="grid gap-3 md:grid-cols-4">{[["Toplam Tahsil Edilen", money(profitRows.reduce((sum: number, item: any) => sum + item.collected, 0))], ["Bekleyen", money(profitRows.reduce((sum: number, item: any) => sum + item.pending, 0))], ["Operasyon Maliyeti", money(profitRows.reduce((sum: number, item: any) => sum + item.operationCost, 0))], ["Tahmini Net", money(profitRows.reduce((sum: number, item: any) => sum + item.profit, 0))]].map(([label, value]) => <div key={label} className="rounded-[18px] border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-slate-950">{value}</p></div>)}</div><div className="overflow-x-auto rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-xl font-black text-slate-950">Müşteri bazlı kârlılık</h2><table className="mt-4 w-full min-w-[900px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs text-slate-500">{["Müşteri", "Hizmet Bedeli", "Tahsil Edilen", "Bekleyen", "Reklam Harcaması", "Operasyon Maliyeti", "Tahmini Kârlılık"].map((item) => <th key={item} className="px-3 py-3">{item}</th>)}</tr></thead><tbody>{profitRows.map((item: any) => <tr key={item.company.id} className="border-b border-slate-100 hover:bg-slate-50"><td className="px-3 py-3 font-black text-slate-900">{item.company.name}</td><td className="px-3 py-3">{money(item.serviceFee)}</td><td className="px-3 py-3 text-emerald-700">{money(item.collected)}</td><td className="px-3 py-3 text-amber-700">{money(item.pending)}</td><td className="px-3 py-3">{money(item.adSpend)}</td><td className="px-3 py-3">{money(item.operationCost)}</td><td className={`px-3 py-3 font-black ${item.profit >= 0 ? "text-emerald-700" : "text-red-700"}`}>{money(item.profit)}</td></tr>)}</tbody></table></div></section>}

    {view === "risk" && <section className="grid gap-5 xl:grid-cols-[1fr_340px]"><div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[.14em] text-red-600">Risk Merkezi</p><h2 className="mt-1 text-xl font-black text-slate-950">Önceliklendirilmiş riskler</h2></div><ShieldAlert className="text-red-600" /></div><div className="mt-4 grid gap-3">{risks.map((risk) => <button key={risk.id} onClick={() => setActive(risk.target)} className="flex items-start gap-3 rounded-[15px] border border-slate-200 p-4 text-left transition hover:border-red-200 hover:bg-red-50"><span className={`grid size-11 shrink-0 place-items-center rounded-[13px] font-black ${risk.priority >= 90 ? "bg-red-100 text-red-700" : risk.priority >= 80 ? "bg-orange-100 text-orange-700" : "bg-amber-100 text-amber-700"}`}>{risk.priority}</span><span className="min-w-0 flex-1"><strong className="block text-sm text-slate-950">{risk.title}</strong><span className="mt-1 block text-xs leading-5 text-slate-500">{risk.module} · {risk.detail}</span></span><ArrowRight size={16} className="mt-2 shrink-0 text-slate-400" /></button>)}{!risks.length && <div className="rounded-[16px] border border-dashed border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-700">Kritik risk sinyali bulunmuyor.</div>}</div></div><div className="grid content-start gap-4">{[["Geciken Tahsilat", overduePayments.length, "Tahsilat"], ["Pixel Sorunu", pixelRisks.length, "Entegrasyonlar"], ["Entegrasyon Hatası", integrationRisks.length, "Entegrasyonlar"], ["Kritik Görev", criticalTasks.length, "Görevler"], ["İletişimsiz Müşteri", healthRows.filter((item: any) => item.health.reasons.some((reason: string) => reason.includes("temas"))).length, "Müşteriler"]].map(([label, count, target]: any) => <button key={label} onClick={() => setActive(target)} className="flex items-center justify-between rounded-[16px] border border-slate-200 bg-white p-4 text-left shadow-sm"><span className="flex items-center gap-3"><HeartPulse size={18} className="text-red-600" /><strong className="text-sm text-slate-800">{label}</strong></span><span className="rounded-full bg-red-50 px-3 py-1 text-sm font-black text-red-700">{count}</span></button>)}</div></section>}
  </div>;
}
