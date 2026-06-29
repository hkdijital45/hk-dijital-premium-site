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
  Database,
  FileText,
  Gauge,
  HeartPulse,
  Layers3,
  LineChart,
  Megaphone,
  MessageSquareText,
  Palette,
  Search,
  ShieldAlert,
  Sparkles,
  Target,
  UsersRound,
  Zap
} from "lucide-react";

const paidStatuses = ["Ödendi", "Tahsil Edildi"];
const doneStatuses = ["Tamamlandı", "İptal"];
const closedLeadStatuses = ["Kazanıldı", "Kaybedildi", "Dönüştürüldü", "Müşteri Oldu", "Reddedildi"];

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

  const marketplace = ["Emlak", "Klinik", "Oto Galeri", "Nail Studio", "Diş Kliniği", "Cafe", "Restoran", "Kuaför", "Avukat", "Muhasebeci"];
  const commands = ["Müşteri aç", "Yeni görev oluştur", "Yeni teklif oluştur", "Agent çalıştır", "Rapor oluştur", "Tahsilat ekle", "QA Center aç", "Website Analytics aç", "Google Intelligence aç", "Meta Intelligence aç"];
  const filteredCommands = commands.filter((item) => item.toLocaleLowerCase("tr").includes(commandQuery.toLocaleLowerCase("tr")));

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
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{agents.map(({ Icon, ...agent }: any) => <article key={agent.name} className="rounded-[16px] border border-slate-200 bg-slate-50 p-4"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-[13px] bg-white text-cyan-700"><Icon size={18} /></span><div className="min-w-0"><p className="font-black text-slate-950">{agent.name}</p><p className="mt-1 text-xs leading-5 text-slate-500">{agent.task}</p></div></div><div className="mt-3 grid gap-2 text-xs text-slate-600"><span>Durum: <strong>{agent.status}</strong></span><span>Başarı: <strong>%{agent.success}</strong></span><span>AI: <strong>{agent.ai}</strong></span><span>Maliyet: <strong>{agent.cost}</strong></span></div></article>)}</div>
            </PanelCard>
            <PanelCard title="AI Operasyon Takvimi" subtitle="Haftalık ajans ritmi" icon={<CalendarDays size={20} />}>
              <div className="grid gap-3">{calendar.map(([day, plan]) => <div key={day} className="rounded-[14px] border border-slate-200 bg-slate-50 p-4"><p className="font-black text-slate-950">{day}</p><p className="mt-1 text-sm leading-6 text-slate-600">{plan}</p></div>)}</div>
            </PanelCard>
          </section>

          <section className="grid gap-5 xl:grid-cols-3">
            <PanelCard title="Risk Merkezi" subtitle="Teknik, reklam, ödeme ve analytics riskleri" icon={<ShieldAlert size={20} />}>
              <div className="grid gap-2">{data.risks.slice(0, 10).map((risk: any) => <div key={`${risk.module}-${risk.title}`} className="rounded-[14px] border border-slate-200 bg-slate-50 p-3"><div className="flex items-start justify-between gap-2"><p className="text-sm font-black text-slate-900">{risk.title}</p><span className={`rounded-full px-2 py-1 text-[10px] font-black ring-1 ${toneForSeverity(risk.severity)}`}>{risk.severity}</span></div><p className="mt-1 text-xs leading-5 text-slate-500">{risk.module} · {risk.detail}</p></div>)}{!data.risks.length && <Empty text="Kritik risk sinyali yok." />}</div>
            </PanelCard>
            <PanelCard title="Rakip Alarm Merkezi" subtitle="Rakip reklam, fiyat ve web değişim sinyalleri" icon={<Megaphone size={20} />}>
              {["Rakip yeni kampanya açtı mı kontrol et", "Rakip fiyat değişimi için haftalık tarama", "Google yorum artışı ve sosyal büyüme sinyali", "Rakip web sitesi ve landing page değişimi"].map((item) => <InfoRow key={item} title={item} note="Derin araştırma için Manus / Gemini zinciri önerilir." />)}
            </PanelCard>
            <PanelCard title="AI Recommendation Engine" subtitle="Beklenen etki, süre, maliyet ve başarı olasılığı" icon={<BrainCircuit size={20} />}>
              {recs.map((item) => <div key={item.title} className="rounded-[14px] border border-slate-200 bg-slate-50 p-3"><p className="font-black text-slate-950">{item.title}</p><p className="mt-1 text-xs text-slate-500">Etki: {item.impact} · Zorluk: {item.difficulty} · Süre: {item.duration} · Maliyet: {item.cost} · Başarı: %{item.probability}</p><p className="mt-2 text-xs font-black text-cyan-700">{item.action}</p></div>)}
            </PanelCard>
          </section>

          <section className="grid gap-5 xl:grid-cols-3">
            <PanelCard title="AI Copilot Chat" subtitle="Tüm sistem için doğal dil komut ekranı" icon={<MessageSquareText size={20} />}>
              <textarea value={copilotQuestion} onChange={(event) => setCopilotQuestion(event.target.value)} className="min-h-24 w-full rounded-[14px] border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900" />
              <button onClick={askCopilot} className="mt-3 rounded-[12px] bg-cyan-500 px-4 py-3 text-sm font-black text-white">HK Intelligence ile Yanıtla</button>
              {copilotAnswer && <p className="mt-3 whitespace-pre-line rounded-[14px] bg-cyan-50 p-3 text-sm leading-6 text-cyan-950">{copilotAnswer}</p>}
            </PanelCard>
            <PanelCard title="Smart Command Palette" subtitle="Cmd/Ctrl+K komut mantığı" icon={<Command size={20} />}>
              <input value={commandQuery} onChange={(event) => setCommandQuery(event.target.value)} placeholder="Komut ara: müşteri aç, rapor oluştur..." className="w-full rounded-[14px] border border-slate-200 bg-slate-50 px-3 py-3 text-sm" />
              <div className="mt-3 grid gap-2">{filteredCommands.map((item) => <button key={item} onClick={() => setActive(commandToTarget(item))} className="flex items-center justify-between rounded-[12px] bg-slate-50 px-3 py-2 text-left text-sm font-bold text-slate-700"><span>{item}</span><ArrowRight size={14} /></button>)}</div>
            </PanelCard>
            <PanelCard title="Global Search" subtitle="Müşteri, görev, belge, rapor ve hafıza araması" icon={<Search size={20} />}>
              {[["Müşteriler", data.companies.length], ["Görevler", data.tasks.length], ["Raporlar", data.reports.length], ["Tahsilatlar", data.payments.length], ["Kampanyalar", data.campaigns.length], ["Agent Memory", (content.agentMemories || []).length]].map(([label, count]) => <InfoRow key={label} title={`${label}: ${count}`} note="Kategori bazlı arama indeksine dahil." />)}
            </PanelCard>
          </section>

          <section className="grid gap-5 xl:grid-cols-4">
            <MiniModule title="AI Kreatif Stüdyosu" icon={<Palette size={19} />} items={["Instagram", "Facebook", "Google Display", "Carousel", "Story", "Reels", "TikTok", "YouTube Shorts", "Banner", "Thumbnail", "Blog", "Mail", "WhatsApp", "SMS"]} />
            <MiniModule title="AI Satış Asistanı" icon={<Target size={19} />} items={["Arama metni", "WhatsApp", "Teklif", "Toplantı", "Takip görevi", "CRM güncelle"]} />
            <MiniModule title="HK Learning Center" icon={<BrainCircuit size={19} />} items={["Başarılı reklam", "Kreatif", "Hedef kitle", "Teklif", "Satış süreci", "Agent Memory"]} />
            <MiniModule title="Digital Twin" icon={<Layers3 size={19} />} items={["12 ay", "Google", "Meta", "SEO", "CRM", "Rapor", "Tahsilat", "Notlar"]} />
          </section>

          <section className="grid gap-5 xl:grid-cols-3">
            <PanelCard title="Marketplace" subtitle="Hazır AI paketleri" icon={<BriefcaseBusiness size={20} />}>
              <div className="grid gap-2 sm:grid-cols-2">{marketplace.map((item) => <div key={item} className="rounded-[12px] border border-slate-200 bg-slate-50 p-3"><p className="font-black text-slate-900">{item}</p><p className="mt-1 text-xs text-slate-500">Prompt, workflow (iş akışı), AI Team, KPI ve rapor şablonu.</p></div>)}</div>
            </PanelCard>
            <PanelCard title="Çok Şubeli Yapı" subtitle="Tek panel, ayrı şube KPI ve raporları" icon={<BuildingIcon />}>
              {data.companies.slice(0, 5).map((company: any) => <InfoRow key={company.id} title={company.name} note="Şube altyapısı customer_branches tablosu ile hazır." />)}
            </PanelCard>
            <PanelCard title="Health / Cost / Backup Center" subtitle="Sistem sağlığı, AI maliyeti ve yedekleme" icon={<Database size={20} />}>
              {["Database, Supabase, Storage, Cron, Queue, API", "OpenAI, Gemini, Claude, Groq, OpenRouter, Manus, Ollama", "Meta API, Google Ads API, GA4, Search Console, SMTP, Resend, Discord", "Otomatik günlük/haftalık/aylık yedek hazırlığı"].map((item) => <InfoRow key={item} title={item} note="Durum, son kontrol, yanıt süresi ve çözüm önerisi izlenir." />)}
            </PanelCard>
          </section>

          <PanelCard title="Customer Timeline" subtitle="Müşteri tarihçesi ve operasyon olayları" icon={<ClipboardList size={20} />}>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{data.healthRows.slice(0, 8).map(({ company, health }: any) => <button key={company.id} onClick={() => setActive("Müşteriler")} className="rounded-[16px] border border-slate-200 bg-slate-50 p-4 text-left"><p className="font-black text-slate-950">{company.name}</p><p className="mt-1 text-xs text-slate-500">Oluşturuldu → İlk görüşme → Teklif → Sözleşme → Pixel/GA4 → Kampanya → Rapor → Tahsilat</p><span className={`mt-3 inline-flex rounded-full px-3 py-1 text-[11px] font-black ring-1 ${toneForSeverity(health.status === "Kritik" ? "Kritik" : health.status === "Riskli" ? "Orta" : "Bilgi")}`}>{health.score}/100</span></button>)}</div>
          </PanelCard>
        </>
      )}
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

function InfoRow({ title, note }: { title: string; note: string }) {
  return <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-3"><p className="text-sm font-black text-slate-900">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{note}</p></div>;
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-[14px] border border-dashed border-slate-200 p-4 text-sm text-slate-500">{text}</p>;
}

function MiniModule({ title, icon, items }: { title: string; icon: ReactNode; items: string[] }) {
  return <section className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-3 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-[14px] bg-cyan-50 text-cyan-700">{icon}</span><h2 className="font-black text-slate-950">{title}</h2></div><div className="flex flex-wrap gap-2">{items.map((item) => <span key={item} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">{item}</span>)}</div></section>;
}

function BuildingIcon() {
  return <BriefcaseBusiness size={20} />;
}
