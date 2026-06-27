"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  CalendarClock,
  CheckCircle2,
  Clipboard,
  Download,
  FileText,
  FlaskConical,
  History,
  Mail,
  Play,
  RefreshCw,
  Route,
  ShieldCheck,
  Workflow,
  XCircle
} from "lucide-react";
import type { SiteContent } from "@/lib/types";
import type { AgentProviderKey, AgentTaskType } from "@/lib/agent-hub";

type Notify = (message: string, type?: string) => void;
type CompanyOption = { id?: string; name?: string; company_name?: string; title?: string };
type ProviderRow = {
  provider_key: AgentProviderKey;
  provider_name: string;
  role_label?: string | null;
  status?: string | null;
  default_model?: string | null;
  purpose?: string | null;
  daily_limit?: number | null;
  monthly_limit?: number | null;
  estimated_monthly_cost?: number | null;
  success_rate?: number | null;
  avg_response_ms?: number | null;
  notes?: string | null;
  secret_mask?: string | null;
  configured?: boolean;
};
type LogRow = {
  id?: string;
  created_at?: string;
  task_type?: AgentTaskType;
  selected_provider?: string | null;
  status?: string | null;
  response_ms?: number | null;
  estimated_cost?: number | string | null;
  output_summary?: string | null;
  output_payload?: unknown;
  run_mode?: string | null;
};
type AgentFinalReport = {
  providerChain?: string[];
  selectedProvider?: string;
  confidence?: number;
  executiveSummary?: string;
  findings?: string[];
  risks?: string[];
  opportunities?: string[];
  recommendedActions?: string[];
  sevenDayPlan?: string[];
  customerMessageDraft?: string;
  internalNotes?: string;
};
type RunResult = {
  runId?: string;
  status?: string;
  responseMs?: number;
  estimatedCost?: number;
  errorMessage?: string | null;
  selectedProvider?: ProviderRow;
  providerChain?: ProviderRow[];
  finalReport?: AgentFinalReport;
  output?: AgentFinalReport;
  progressEvents?: Array<{ step: string; progress: number; provider?: string; at?: string }>;
};
type ScheduledTask = {
  id?: string;
  name?: string;
  task_type?: AgentTaskType;
  schedule_frequency?: string;
  schedule_day?: string | null;
  schedule_time?: string | null;
  provider_mode?: string | null;
  multi_agent?: boolean | null;
  is_active?: boolean | null;
  last_run_at?: string | null;
  next_run_at?: string | null;
};

const providerOptions: Array<{ value: AgentProviderKey | "auto"; label: string }> = [
  { value: "auto", label: "Auto AI Router" },
  { value: "openai", label: "OpenAI / ChatGPT" },
  { value: "anthropic", label: "Claude" },
  { value: "gemini", label: "Gemini" },
  { value: "groq", label: "Groq" },
  { value: "manus", label: "Manus AI" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "ollama", label: "Ollama" },
  { value: "demo", label: "Demo / Local fallback" }
];

const agentTaskLabels: Record<AgentTaskType, string> = {
  ad_analysis: "Reklam analizi",
  crm_summary: "CRM özeti",
  content_generation: "İçerik üretimi",
  seo_analysis: "SEO analizi",
  competitor_research: "Rakip araştırması",
  market_research: "Pazar araştırması",
  pricing_research: "Fiyat karşılaştırması",
  sector_discovery: "Yeni sektör keşfi",
  deep_report: "Kapsamlı rapor",
  proposal_generation: "Teklif üretimi",
  customer_report: "Müşteri raporu",
  code_review: "Kod inceleme",
  fast_answer: "Hızlı cevap",
  workflow_task: "Workflow görevi",
  long_web_research: "Uzun web araştırması"
};

const taskTypes = Object.entries(agentTaskLabels).map(([value, label]) => ({ value: value as AgentTaskType, label }));
const manusTasks: AgentTaskType[] = ["competitor_research", "market_research", "pricing_research", "sector_discovery", "deep_report", "long_web_research"];
const multiAgentRecommendedTasks: AgentTaskType[] = ["competitor_research", "market_research", "deep_report", "proposal_generation", "customer_report"];

const chainMap: Partial<Record<AgentTaskType, AgentProviderKey[]>> = {
  ad_analysis: ["openai", "gemini", "anthropic"],
  crm_summary: ["openai", "gemini"],
  content_generation: ["openai", "anthropic", "gemini"],
  seo_analysis: ["gemini", "openai"],
  competitor_research: ["manus", "gemini", "openai"],
  market_research: ["manus", "gemini", "openai"],
  pricing_research: ["manus", "gemini", "openai"],
  sector_discovery: ["manus", "gemini", "openai"],
  deep_report: ["manus", "anthropic", "openai"],
  proposal_generation: ["openai", "anthropic"],
  customer_report: ["openai", "anthropic"],
  code_review: ["anthropic", "openai"],
  fast_answer: ["groq", "openai", "gemini"],
  workflow_task: ["openai", "gemini"],
  long_web_research: ["manus", "gemini", "openai"]
};

const workflows = [
  {
    name: "Müşteri Reklam Sağlık Analizi",
    description: "Meta ve Google verilerini okuyup HK Intelligence aksiyon planına dönüştürür.",
    steps: ["Müşteri seç", "Meta verisini oku", "Google Ads verisini oku", "OpenAI/Gemini ile yorumla", "Aksiyon planı oluştur"]
  },
  {
    name: "Derin Rakip Analizi",
    description: "Manus araştırma katmanı, Gemini SEO kıyası ve OpenAI satış fırsatlarını tek final raporda birleştirir.",
    steps: ["Rakipleri bul", "Manus ile araştır", "Gemini ile SEO kıyasla", "OpenAI ile fırsatları çıkar", "HK Intelligence final raporu"]
  },
  {
    name: "Teklif Hazırlama",
    description: "Sektör potansiyeli ve müşteri verisinden garanti vermeyen teklif metni ve PDF hazırlığı üretir.",
    steps: ["İhtiyaç özeti", "Paket ve kapsam", "Risk dili kontrolü", "Export payload hazırlığı"]
  }
];

const primaryButtonClass = "rounded-[14px] bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-3 text-sm font-black text-slate-950 shadow-[0_12px_24px_rgba(14,165,233,.22)] transition hover:from-cyan-300 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClass = "rounded-[12px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:border-cyan-200 hover:bg-cyan-50";
const softButtonClass = "rounded-[12px] border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-sm font-black text-cyan-800 transition hover:bg-cyan-100";

function statusClass(status?: string | null) {
  if (status === "active") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "error") return "border-red-200 bg-red-50 text-red-800";
  if (status === "passive") return "border-slate-200 bg-slate-100 text-slate-700";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function statusLabel(status?: string | null) {
  if (status === "active") return "Aktif";
  if (status === "passive") return "Pasif";
  if (status === "error") return "Hata";
  return "Yapılandırılmadı";
}

function providerLabel(provider: string) {
  return providerOptions.find((item) => item.value === provider)?.label || provider;
}

function copyText(text: string, notify?: Notify) {
  navigator.clipboard?.writeText(text).then(() => notify?.("Kopyalandı.", "success")).catch(() => notify?.("Kopyalama başarısız oldu.", "error"));
}

function finalReportText(report?: AgentFinalReport) {
  if (!report) return "";
  return [
    report.executiveSummary,
    "Bulgular:",
    ...(report.findings || []).map((item) => `- ${item}`),
    "Riskler:",
    ...(report.risks || []).map((item) => `- ${item}`),
    "Aksiyonlar:",
    ...(report.recommendedActions || []).map((item) => `- ${item}`),
    "7 Günlük Plan:",
    ...(report.sevenDayPlan || []).map((item) => `- ${item}`),
    report.customerMessageDraft
  ].filter(Boolean).join("\n");
}

export function AgentHubCenter({ content, notify }: { content: SiteContent; notify?: Notify }) {
  const contentWithCompanies = content as unknown as { companies?: CompanyOption[] };
  const companies = Array.isArray(contentWithCompanies.companies) ? contentWithCompanies.companies : [];
  const [activeTab, setActiveTab] = useState("overview");
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([]);
  const [summary, setSummary] = useState<Record<string, string | number>>({});
  const [stats, setStats] = useState<{ summary?: Record<string, string | number>; charts?: Record<string, Record<string, number>> }>({});
  const [loading, setLoading] = useState(false);
  const [testingProvider, setTestingProvider] = useState("");
  const [editingProvider, setEditingProvider] = useState<ProviderRow | null>(null);
  const [providerForm, setProviderForm] = useState({ status: "not_configured", defaultModel: "", dailyLimit: "", monthlyLimit: "", estimatedMonthlyCost: "", notes: "", apiKey: "" });
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [exportPayload, setExportPayload] = useState<Record<string, unknown> | null>(null);
  const [emailDraft, setEmailDraft] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState({
    customerId: "",
    taskType: "ad_analysis" as AgentTaskType,
    priority: "normal",
    requestedProvider: "auto" as AgentProviderKey | "auto",
    outputFormat: "aksiyon planı",
    multiAgent: false,
    prompt: "Seçili müşteri için reklam performansını yorumla, riskleri çıkar ve 7 günlük aksiyon planı hazırla."
  });
  const [scheduleForm, setScheduleForm] = useState({
    name: "Haftalık reklam sağlık kontrolü",
    customerId: "",
    taskType: "ad_analysis" as AgentTaskType,
    scheduleFrequency: "weekly",
    scheduleDay: "Pazartesi",
    scheduleTime: "09:00",
    outputFormat: "detaylı rapor",
    multiAgent: false,
    prompt: "Haftalık reklam sağlık kontrolü yap ve HK Intelligence aksiyon planı üret."
  });

  const selectedChain = useMemo(() => {
    if (form.requestedProvider !== "auto") return [form.requestedProvider];
    const base = chainMap[form.taskType] || ["demo"];
    return form.multiAgent ? base : base.slice(0, 1);
  }, [form.multiAgent, form.requestedProvider, form.taskType]);

  const manualManusWarning = form.requestedProvider === "manus" && !manusTasks.includes(form.taskType);

  async function loadData() {
    setLoading(true);
    try {
      const [providerResponse, logResponse, statsResponse, scheduledResponse] = await Promise.all([
        fetch("/api/admin/agent-hub/providers"),
        fetch("/api/admin/agent-hub/logs"),
        fetch("/api/admin/agent-hub/stats"),
        fetch("/api/admin/agent-hub/scheduled")
      ]);
      const providerData = await providerResponse.json().catch(() => ({}));
      const logData = await logResponse.json().catch(() => ({}));
      const statsData = await statsResponse.json().catch(() => ({}));
      const scheduledData = await scheduledResponse.json().catch(() => ({}));
      if (!providerResponse.ok) throw new Error(providerData.error || "Provider listesi alınamadı.");
      setProviders(providerData.providers || []);
      setLogs(logData.logs || []);
      setSummary(logData.summary || {});
      setStats(statsData || {});
      setScheduledTasks(scheduledData.tasks || []);
    } catch (error) {
      notify?.(error instanceof Error ? error.message : "Agent Hub verileri alınamadı.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function updateTaskType(taskType: AgentTaskType) {
    setForm((current) => ({
      ...current,
      taskType,
      multiAgent: multiAgentRecommendedTasks.includes(taskType),
      requestedProvider: current.requestedProvider === "manus" && !manusTasks.includes(taskType) ? "auto" : current.requestedProvider
    }));
  }

  async function runTask() {
    if (!form.prompt.trim()) {
      notify?.("Görev açıklaması boş olamaz.", "warning");
      return;
    }
    setLoading(true);
    setRunResult(null);
    setExportPayload(null);
    setEmailDraft(null);
    try {
      const response = await fetch("/api/admin/agent-hub/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Agent görevi başlatılamadı.");
      setRunResult(data);
      notify?.("Agent görevi tamamlandı.", data.status === "completed_with_fallback" || data.status === "completed_with_warning" ? "warning" : "success");
      await loadData();
    } catch (error) {
      notify?.(error instanceof Error ? error.message : "Agent görevi başarısız oldu.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function testProvider(providerKey: string) {
    setTestingProvider(providerKey);
    try {
      const response = await fetch("/api/admin/agent-hub/providers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerKey })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Provider test edilemedi.");
      notify?.(data.message || "Provider testi tamamlandı.", data.ok ? "success" : "warning");
      await loadData();
    } catch (error) {
      notify?.(error instanceof Error ? error.message : "Provider testi başarısız oldu.", "error");
    } finally {
      setTestingProvider("");
    }
  }

  function openProviderEdit(provider: ProviderRow) {
    setEditingProvider(provider);
    setProviderForm({
      status: provider.status || "not_configured",
      defaultModel: provider.default_model || "",
      dailyLimit: provider.daily_limit ? String(provider.daily_limit) : "",
      monthlyLimit: provider.monthly_limit ? String(provider.monthly_limit) : "",
      estimatedMonthlyCost: provider.estimated_monthly_cost ? String(provider.estimated_monthly_cost) : "",
      notes: provider.notes || "",
      apiKey: ""
    });
  }

  async function saveProviderSettings() {
    if (!editingProvider?.provider_key) return;
    setLoading(true);
    try {
      const response = await fetch("/api/admin/agent-hub/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerKey: editingProvider.provider_key, ...providerForm })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Provider ayarları kaydedilemedi.");
      notify?.(data.message || "Provider ayarları kaydedildi.", "success");
      setEditingProvider(null);
      await loadData();
    } catch (error) {
      notify?.(error instanceof Error ? error.message : "Provider ayarları kaydedilemedi.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function exportRun(format: "docx" | "pdf" | "pptx" | "copy_text") {
    const report = runResult?.finalReport || runResult?.output;
    if (!report) {
      notify?.("Önce agent görevi çalıştırılmalı.", "warning");
      return;
    }
    if (!runResult?.runId) {
      const payload = { format, status: "local_payload_ready", executiveSummary: report.executiveSummary, providerChain: report.providerChain };
      setExportPayload(payload);
      if (format === "copy_text") copyText(finalReportText(report), notify);
      notify?.("Hazırlık verisi oluşturuldu.", "success");
      return;
    }
    const response = await fetch(`/api/admin/agent-hub/runs/${runResult.runId}/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      notify?.(data.error || "Export hazırlığı başarısız oldu.", "error");
      return;
    }
    setExportPayload(data.payload);
    if (format === "copy_text") copyText(finalReportText(report), notify);
    notify?.(data.payload?.message || "Hazırlık verisi oluşturuldu.", "success");
  }

  async function createEmailDraft() {
    const report = runResult?.finalReport || runResult?.output;
    if (!report) {
      notify?.("Önce agent görevi çalıştırılmalı.", "warning");
      return;
    }
    if (!runResult?.runId) {
      const draft = {
        subject: "HK Dijital analiz ve aksiyon önerileri",
        body: report.customerMessageDraft || "Müşteriye gönderilebilir özet hazırlandı.",
        status: "draft_ready"
      };
      setEmailDraft(draft);
      notify?.("E-posta taslağı hazırlandı.", "success");
      return;
    }
    const response = await fetch(`/api/admin/agent-hub/runs/${runResult.runId}/email-draft`, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      notify?.(data.error || "E-posta taslağı hazırlanamadı.", "error");
      return;
    }
    setEmailDraft(data.draft);
    notify?.("E-posta taslağı hazırlandı.", "success");
  }

  async function createScheduledTask() {
    if (!scheduleForm.name.trim()) {
      notify?.("Planlanmış görev adı boş olamaz.", "warning");
      return;
    }
    const response = await fetch("/api/admin/agent-hub/scheduled", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(scheduleForm)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      notify?.(data.error || "Planlanmış görev oluşturulamadı.", "error");
      return;
    }
    notify?.("Planlanmış agent görevi oluşturuldu.", "success");
    await loadData();
  }

  const statsSummary = stats.summary || summary || {};
  const monthlyManusRuns = Number(statsSummary.manusRuns || logs.filter((log) => log.selected_provider === "manus").length);
  const topProvider = String(statsSummary.topProvider || "-");
  const finalReport = runResult?.finalReport || runResult?.output;

  return <div className="grid gap-6">
    <section className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-6 text-white shadow-[0_22px_70px_rgba(15,23,42,.18)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[.18em] text-cyan-200">AI & Otomasyon</p>
          <h2 className="mt-3 text-3xl font-black">HK Agent Hub Phase 2</h2>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-200">Auto AI Router, çoklu AI işbirliği, HK Intelligence final katmanı, canlı görev ilerlemesi ve raporlaştırılabilir agent çıktıları.</p>
        </div>
        <button onClick={loadData} disabled={loading} className="rounded-[14px] border border-white/20 bg-white px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-60"><RefreshCw size={16} className="mr-2 inline" />Yenile</button>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-8">
        {[
          ["Bugünkü görev", statsSummary.todayRuns || 0],
          ["Bu ay görev", statsSummary.monthRuns || logs.length],
          ["Başarı oranı", `%${Math.round(Number(statsSummary.successRate || 100))}`],
          ["Ortalama süre", `${Number(statsSummary.averageMs || 0)} ms`],
          ["Tahmini maliyet", `${Number(statsSummary.estimatedCost || 0).toLocaleString("tr-TR")} $`],
          ["En çok kullanılan", topProvider],
          ["Manus araştırma", monthlyManusRuns],
          ["Çoklu AI", statsSummary.multiAgentRuns || 0]
        ].map(([label, value]) => <div key={String(label)} className="rounded-[18px] border border-white/10 bg-white/10 p-4">
          <strong className="block text-2xl font-black">{value}</strong>
          <span className="mt-1 block text-xs font-bold text-slate-300">{label}</span>
        </div>)}
      </div>
    </section>

    <nav className="flex gap-2 overflow-x-auto rounded-[18px] border border-slate-200 bg-white p-2">
      {[
        ["overview", "Genel Bakış", Bot],
        ["providers", "AI Sağlayıcıları", ShieldCheck],
        ["run", "Yeni Agent Görevi", Play],
        ["prompts", "Prompt Merkezi", FileText],
        ["workflows", "Workflow Builder", Workflow],
        ["logs", "Agent Logları", History],
        ["scheduled", "Planlanmış Görevler", CalendarClock]
      ].map(([key, label, Icon]) => {
        const TabIcon = Icon as typeof Bot;
        return <button key={String(key)} onClick={() => setActiveTab(String(key))} className={`whitespace-nowrap rounded-[12px] px-4 py-3 text-sm font-black ${activeTab === key ? "bg-cyan-500 text-white" : "text-slate-600 hover:bg-slate-50"}`}><TabIcon size={16} className="mr-2 inline" />{String(label)}</button>;
      })}
    </nav>

    {activeTab === "overview" && <section className="grid gap-4 lg:grid-cols-[1fr_.42fr]">
      <div className="rounded-[22px] border border-slate-200 bg-white p-6">
        <p className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">Auto AI Router</p>
        <h3 className="mt-2 text-2xl font-black text-slate-950">Görev tipine göre doğru sağlayıcı ve yedek akış</h3>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {[
            ["Reklam ve CRM yorumları", "OpenAI / Gemini / Claude", "Kısa analiz, müşteri raporu ve aksiyon planı."],
            ["Hızlı cevaplar", "Groq / OpenAI", "Düşük gecikmeli kısa üretimler."],
            ["Teklif ve rapor dili", "Claude / OpenAI", "Uzun metin, paketleme ve garanti vermeyen rapor dili."],
            ["Derin araştırma", "Manus AI", "Rakip, pazar, fiyat, sektör keşfi ve uzun web araştırması."]
          ].map(([title, provider, detail]) => <div key={title} className="rounded-[18px] border border-slate-200 bg-slate-50 p-4">
            <strong className="block text-slate-950">{title}</strong>
            <span className="mt-2 block text-sm font-black text-cyan-700">{provider}</span>
            <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
          </div>)}
        </div>
        <div className="mt-5 rounded-[18px] border border-blue-100 bg-blue-50 p-4">
          <strong className="text-blue-950">HK Intelligence final katmanı</strong>
          <p className="mt-2 text-sm leading-6 text-blue-900">Manus veya başka bir sağlayıcı çıktısı doğrudan final cevap olmaz. Tüm çıktılar önce HK Intelligence tarafından yönetici özeti, risk, fırsat, 7 günlük plan ve müşteri mesajı formatına dönüştürülür.</p>
        </div>
      </div>
      <aside className="rounded-[22px] border border-amber-200 bg-amber-50 p-6">
        <p className="text-xs font-black uppercase tracking-[.16em] text-amber-700">Manus konumu</p>
        <h3 className="mt-2 text-xl font-black text-slate-950">Derin Araştırma Uzmanı</h3>
        <p className="mt-3 text-sm leading-6 text-slate-700">Manus günlük kısa cevaplar için değil; derin araştırma, rakip/pazar analizi ve kapsamlı rapor görevleri için kullanılır.</p>
        <div className="mt-4 grid gap-2 text-sm font-bold text-amber-900">
          {manusTasks.map((item) => <span key={item} className="rounded-full border border-amber-200 bg-white px-3 py-2">{agentTaskLabels[item]}</span>)}
        </div>
      </aside>
    </section>}

    {activeTab === "providers" && <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {providers.map((provider) => <div key={provider.provider_key} className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_10px_26px_rgba(15,23,42,.05)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-500">{provider.provider_key}</p>
            <h3 className="mt-1 text-lg font-black text-slate-950">{provider.provider_name}</h3>
          </div>
          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${statusClass(provider.status)}`}>{statusLabel(provider.status)}</span>
        </div>
        <p className="mt-3 text-sm font-bold text-cyan-700">{provider.role_label || "AI sağlayıcısı"}</p>
        <p className="mt-2 min-h-16 text-sm leading-6 text-slate-600">{provider.purpose || "Kullanım amacı tanımlı değil."}</p>
        <div className="mt-4 grid gap-2 rounded-[14px] bg-slate-50 p-3 text-xs text-slate-600">
          <span>Model: <strong>{provider.default_model || "-"}</strong></span>
          <span>API: <strong>{provider.secret_mask || (provider.configured ? "Sunucuda kayıtlı / maskeli" : "API anahtarı eklenmedi")}</strong></span>
          <span>Başarı oranı: <strong>%{provider.success_rate || 100}</strong></span>
          <span>Ortalama yanıt: <strong>{provider.avg_response_ms || 0} ms</strong></span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={() => testProvider(provider.provider_key)} disabled={testingProvider === provider.provider_key} className={softButtonClass}><FlaskConical size={14} className="mr-1 inline" />{testingProvider === provider.provider_key ? "Test..." : "Test Et"}</button>
          <button onClick={() => openProviderEdit(provider)} className={secondaryButtonClass}>Ayarları Düzenle</button>
          <button onClick={() => setActiveTab("prompts")} className={secondaryButtonClass}>Promptları Gör</button>
          <button onClick={() => setActiveTab("logs")} className={secondaryButtonClass}>Logları Aç</button>
        </div>
      </div>)}
    </section>}

    {activeTab === "run" && <section className="grid gap-5 lg:grid-cols-[.42fr_1fr]">
      <div className="rounded-[22px] border border-slate-200 bg-white p-5">
        <h3 className="text-xl font-black text-slate-950">Yeni Agent Görevi</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">Varsayılan mod Auto AI Router’dır. HK Intelligence görev tipine, maliyete, uygun sağlayıcıya ve yedek akışa göre karar verir.</p>
        <div className="mt-4 grid gap-3">
          <label className="grid gap-1 text-sm font-bold text-slate-700">Müşteri
            <select value={form.customerId} onChange={(event) => setForm({ ...form, customerId: event.target.value })} className="rounded-[12px] border border-slate-200 px-3 py-3">
              <option value="">Müşteri seçilmedi</option>
              {companies.map((company) => <option key={company.id} value={company.id}>{company.name || company.company_name || company.title || "İsimsiz müşteri"}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-bold text-slate-700">Görev tipi
            <select value={form.taskType} onChange={(event) => updateTaskType(event.target.value as AgentTaskType)} className="rounded-[12px] border border-slate-200 px-3 py-3">{taskTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
          </label>
          <label className="grid gap-1 text-sm font-bold text-slate-700">Öncelik
            <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })} className="rounded-[12px] border border-slate-200 px-3 py-3"><option>düşük</option><option>normal</option><option>yüksek</option><option>kritik</option></select>
          </label>
          <label className="grid gap-1 text-sm font-bold text-slate-700">Kullanılacak sağlayıcı
            <select value={form.requestedProvider} onChange={(event) => setForm({ ...form, requestedProvider: event.target.value as AgentProviderKey | "auto" })} className="rounded-[12px] border border-slate-200 px-3 py-3">{providerOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
          </label>
          {manualManusWarning && <div className="rounded-[14px] border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">Manus bu görev için ideal değildir. Auto Router OpenAI/Gemini/Claude önerir.</div>}
          <label className="flex items-start gap-3 rounded-[14px] border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-700">
            <input type="checkbox" checked={form.multiAgent} onChange={(event) => setForm({ ...form, multiAgent: event.target.checked })} className="mt-1 size-4 accent-cyan-600" />
            <span>Çoklu AI işbirliği kullan <small className="mt-1 block font-medium text-slate-500">Birden fazla sağlayıcı görev aşamalarına göre çalışır; son kararı HK Intelligence tek rapor halinde birleştirir.</small></span>
          </label>
          <div className="rounded-[14px] border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
            <strong>Önerilen zincir:</strong> {selectedChain.map(providerLabel).join(" → ")}
          </div>
          <label className="grid gap-1 text-sm font-bold text-slate-700">Çıktı formatı
            <select value={form.outputFormat} onChange={(event) => setForm({ ...form, outputFormat: event.target.value })} className="rounded-[12px] border border-slate-200 px-3 py-3"><option>kısa özet</option><option>detaylı rapor</option><option>aksiyon planı</option><option>tablo</option><option>PDF hazırlığı</option></select>
          </label>
          <label className="grid gap-1 text-sm font-bold text-slate-700">Görev açıklaması
            <textarea value={form.prompt} onChange={(event) => setForm({ ...form, prompt: event.target.value })} rows={7} className="rounded-[12px] border border-slate-200 px-3 py-3" />
          </label>
          <button onClick={runTask} disabled={loading || !form.prompt.trim()} className={primaryButtonClass}><Play size={16} className="mr-2 inline" />{loading ? "Çalışıyor..." : "Görevi Başlat"}</button>
        </div>
      </div>
      <div className="rounded-[22px] border border-slate-200 bg-white p-5">
        <h3 className="text-xl font-black text-slate-950">HK Intelligence Final Raporu</h3>
        {!runResult && <p className="mt-4 rounded-[16px] border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">Görev çalıştırılınca canlı ilerleme, sağlayıcı zinciri, final rapor, export ve e-posta taslağı burada görünür.</p>}
        {runResult && <div className="mt-4 grid gap-4">
          <div className="rounded-[16px] border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-900"><Route size={16} className="mr-2 inline" />Durum: <strong>{runResult.status}</strong> · Süre: <strong>{runResult.responseMs || 0} ms</strong> · Maliyet: <strong>{Number(runResult.estimatedCost || 0).toLocaleString("tr-TR")} $</strong></div>
          {runResult.errorMessage && <div className="rounded-[16px] border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">{runResult.errorMessage}</div>}
          <div className="rounded-[16px] border border-slate-200 p-4">
            <h4 className="font-black text-slate-950">Canlı Görev İlerlemesi</h4>
            <div className="mt-3 grid gap-2">{(runResult.progressEvents || []).map((event) => <div key={`${event.step}-${event.progress}`} className="flex items-center gap-3 text-sm">
              <span className="h-2 rounded-full bg-cyan-500" style={{ width: `${Math.max(event.progress, 10)}px` }} />
              <strong className="min-w-12 text-cyan-800">%{event.progress}</strong>
              <span className="text-slate-700">{event.step}</span>
            </div>)}</div>
          </div>
          <div className="rounded-[16px] border border-slate-200 p-4">
            <h4 className="font-black text-slate-950">Kullanılan AI Zinciri</h4>
            <div className="mt-3 flex flex-wrap gap-2">{(finalReport?.providerChain || selectedChain).map((provider) => <span key={provider} className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-black text-blue-800">{providerLabel(provider)}</span>)}</div>
          </div>
          <div className="rounded-[16px] border border-blue-100 bg-blue-50 p-4">
            <h4 className="font-black text-blue-950">Yönetici Özeti</h4>
            <p className="mt-2 text-sm leading-7 text-blue-900">{finalReport?.executiveSummary}</p>
            <p className="mt-3 text-xs font-black uppercase tracking-[.14em] text-blue-700">Güven skoru: %{Math.round(Number(finalReport?.confidence || 0.7) * 100)}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {[
              ["Bulgular", finalReport?.findings],
              ["Riskler", finalReport?.risks],
              ["Fırsatlar", finalReport?.opportunities],
              ["Öncelikli Aksiyonlar", finalReport?.recommendedActions],
              ["7 Günlük Plan", finalReport?.sevenDayPlan],
              ["İç Notlar", finalReport?.internalNotes ? [finalReport.internalNotes] : []]
            ].map(([title, items]) => <div key={String(title)} className="rounded-[16px] border border-slate-200 p-4">
              <h4 className="font-black text-slate-950">{String(title)}</h4>
              <ul className="mt-3 grid gap-2 text-sm text-slate-600">{((items as string[] | undefined) || []).map((item) => <li key={item}>- {item}</li>)}</ul>
            </div>)}
          </div>
          <div className="rounded-[16px] border border-emerald-200 bg-emerald-50 p-4">
            <h4 className="font-black text-emerald-950">Müşteriye Gönderilebilir Özet</h4>
            <p className="mt-2 text-sm leading-7 text-emerald-900">{finalReport?.customerMessageDraft}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => exportRun("docx")} className={secondaryButtonClass}><Download size={16} className="mr-2 inline" />Word hazırla</button>
            <button onClick={() => exportRun("pdf")} className={secondaryButtonClass}><Download size={16} className="mr-2 inline" />PDF hazırla</button>
            <button onClick={() => exportRun("pptx")} className={secondaryButtonClass}><Download size={16} className="mr-2 inline" />PowerPoint hazırla</button>
            <button onClick={() => exportRun("copy_text")} className={softButtonClass}><Clipboard size={16} className="mr-2 inline" />Çıktıyı kopyala</button>
            <button onClick={createEmailDraft} className={softButtonClass}><Mail size={16} className="mr-2 inline" />Müşteriye E-posta Hazırla</button>
          </div>
          {exportPayload && <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">Export durumu: <strong>{String(exportPayload.status || "hazır")}</strong></div>}
          {emailDraft && <pre className="whitespace-pre-wrap rounded-[14px] border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700">{String(emailDraft.body || "")}</pre>}
        </div>}
      </div>
    </section>}

    {activeTab === "prompts" && <section className="rounded-[22px] border border-slate-200 bg-white p-5">
      <h3 className="text-xl font-black text-slate-950">Prompt Merkezi</h3>
      <p className="mt-2 text-sm text-slate-600">Agent Hub promptları `agent_prompts` tablosuyla uyumludur. Mevcut Prompt Merkezi varsa aynı veri yapısına bağlanabilir.</p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm"><thead className="text-xs uppercase tracking-[.12em] text-slate-500"><tr><th className="border-b py-3">Görev tipi</th><th className="border-b py-3">Sağlayıcı</th><th className="border-b py-3">Başlık</th><th className="border-b py-3">Durum</th><th className="border-b py-3">İşlem</th></tr></thead>
          <tbody>{taskTypes.slice(0, 8).map((task, index) => <tr key={task.value} className="border-b border-slate-100"><td className="py-3 font-bold">{task.label}</td><td className="py-3">{index < 2 ? "manus" : index % 2 ? "openai" : "gemini"}</td><td className="py-3">{task.label} varsayılan promptu</td><td className="py-3"><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">Aktif</span></td><td className="py-3"><button onClick={() => notify?.("Prompt düzenleme API güvenli şekilde sonraki sürümde detaylandırılabilir.", "info")} className={secondaryButtonClass}>Görüntüle</button></td></tr>)}</tbody></table>
      </div>
    </section>}

    {activeTab === "workflows" && <section className="grid gap-4 lg:grid-cols-3">
      {workflows.map((workflow) => <div key={workflow.name} className="rounded-[22px] border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-3"><h3 className="text-lg font-black text-slate-950">{workflow.name}</h3><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">Aktif</span></div>
        <p className="mt-3 text-sm leading-6 text-slate-600">{workflow.description}</p>
        <ol className="mt-4 grid gap-2 text-sm text-slate-700">{workflow.steps.map((step, index) => <li key={step} className="rounded-[12px] bg-slate-50 p-3"><strong>{index + 1}.</strong> {step}</li>)}</ol>
        <div className="mt-4 grid grid-cols-3 gap-2"><button onClick={() => setActiveTab("run")} className={softButtonClass}>Çalıştır</button><button onClick={() => notify?.("Workflow detayları kart üzerinde listelendi.", "info")} className={secondaryButtonClass}>Detay</button><button onClick={() => copyText(JSON.stringify(workflow, null, 2), notify)} className={secondaryButtonClass}>Kopyala</button></div>
      </div>)}
    </section>}

    {activeTab === "logs" && <section className="rounded-[22px] border border-slate-200 bg-white p-5">
      <h3 className="text-xl font-black text-slate-950">Agent Logları</h3>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-sm"><thead className="text-xs uppercase tracking-[.12em] text-slate-500"><tr><th className="border-b py-3">Tarih</th><th className="border-b py-3">Görev tipi</th><th className="border-b py-3">Sağlayıcı</th><th className="border-b py-3">Durum</th><th className="border-b py-3">Süre</th><th className="border-b py-3">Maliyet</th><th className="border-b py-3">İşlem</th></tr></thead>
          <tbody>{logs.map((log) => <tr key={log.id || `${log.created_at}-${log.task_type}`} className="border-b border-slate-100"><td className="py-3 text-slate-600">{log.created_at ? new Date(log.created_at).toLocaleString("tr-TR") : "-"}</td><td className="py-3 font-bold">{log.task_type ? agentTaskLabels[log.task_type] : "-"}</td><td className="py-3">{log.selected_provider || "-"}</td><td className="py-3">{log.status || "-"}</td><td className="py-3">{log.response_ms || 0} ms</td><td className="py-3">{Number(log.estimated_cost || 0).toLocaleString("tr-TR")} $</td><td className="py-3"><button onClick={() => copyText(log.output_summary || JSON.stringify(log.output_payload || {}), notify)} className={secondaryButtonClass}>Çıktıyı Kopyala</button></td></tr>)}
          {!logs.length && <tr><td colSpan={7} className="py-8 text-center text-slate-500"><XCircle size={20} className="mx-auto mb-2" />Henüz agent log kaydı yok.</td></tr>}</tbody></table>
      </div>
    </section>}

    {activeTab === "scheduled" && <section className="grid gap-5 lg:grid-cols-[.42fr_1fr]">
      <div className="rounded-[22px] border border-slate-200 bg-white p-5">
        <h3 className="text-xl font-black text-slate-950">Planlanmış Agent Görevi</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">V1 cron-ready yapıdadır. Gerçek zamanlayıcı için `AGENT_HUB_CRON_SECRET` ile güvenli endpoint çalıştırılır.</p>
        <div className="mt-4 grid gap-3">
          <input value={scheduleForm.name} onChange={(event) => setScheduleForm({ ...scheduleForm, name: event.target.value })} className="rounded-[12px] border border-slate-200 px-3 py-3 text-sm" placeholder="Görev adı" />
          <select value={scheduleForm.customerId} onChange={(event) => setScheduleForm({ ...scheduleForm, customerId: event.target.value })} className="rounded-[12px] border border-slate-200 px-3 py-3 text-sm">
            <option value="">Müşteri seçilmedi</option>
            {companies.map((company) => <option key={company.id} value={company.id}>{company.name || company.company_name || company.title || "İsimsiz müşteri"}</option>)}
          </select>
          <select value={scheduleForm.taskType} onChange={(event) => setScheduleForm({ ...scheduleForm, taskType: event.target.value as AgentTaskType })} className="rounded-[12px] border border-slate-200 px-3 py-3 text-sm">{taskTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
          <div className="grid gap-3 md:grid-cols-3">
            <select value={scheduleForm.scheduleFrequency} onChange={(event) => setScheduleForm({ ...scheduleForm, scheduleFrequency: event.target.value })} className="rounded-[12px] border border-slate-200 px-3 py-3 text-sm"><option value="daily">Günlük</option><option value="weekly">Haftalık</option><option value="monthly">Aylık</option></select>
            <input value={scheduleForm.scheduleDay} onChange={(event) => setScheduleForm({ ...scheduleForm, scheduleDay: event.target.value })} className="rounded-[12px] border border-slate-200 px-3 py-3 text-sm" placeholder="Gün" />
            <input value={scheduleForm.scheduleTime} onChange={(event) => setScheduleForm({ ...scheduleForm, scheduleTime: event.target.value })} className="rounded-[12px] border border-slate-200 px-3 py-3 text-sm" placeholder="09:00" />
          </div>
          <label className="flex items-center gap-3 text-sm font-bold text-slate-700"><input type="checkbox" checked={scheduleForm.multiAgent} onChange={(event) => setScheduleForm({ ...scheduleForm, multiAgent: event.target.checked })} className="size-4 accent-cyan-600" />Çoklu AI açık</label>
          <textarea value={scheduleForm.prompt} onChange={(event) => setScheduleForm({ ...scheduleForm, prompt: event.target.value })} rows={4} className="rounded-[12px] border border-slate-200 px-3 py-3 text-sm" />
          <button onClick={createScheduledTask} className={primaryButtonClass}>Planlanmış Görev Oluştur</button>
        </div>
      </div>
      <div className="rounded-[22px] border border-slate-200 bg-white p-5">
        <h3 className="text-xl font-black text-slate-950">Planlanmış Görevler</h3>
        <div className="mt-4 grid gap-3">
          {scheduledTasks.map((task) => <div key={task.id || task.name} className="rounded-[16px] border border-slate-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><strong className="text-slate-950">{task.name}</strong><p className="mt-1 text-sm text-slate-600">{task.task_type ? agentTaskLabels[task.task_type] : "-"} · {task.schedule_frequency} · {task.schedule_day || "-"} {task.schedule_time || ""}</p></div>
              <span className={`rounded-full px-3 py-1 text-xs font-black ${task.is_active === false ? "bg-slate-100 text-slate-600" : "bg-emerald-50 text-emerald-700"}`}>{task.is_active === false ? "Pasif" : "Aktif"}</span>
            </div>
            <p className="mt-3 text-xs text-slate-500">Son çalışma: {task.last_run_at ? new Date(task.last_run_at).toLocaleString("tr-TR") : "-"} · Sonraki çalışma: {task.next_run_at ? new Date(task.next_run_at).toLocaleString("tr-TR") : "Cron tarafından belirlenecek"}</p>
          </div>)}
          {!scheduledTasks.length && <p className="rounded-[16px] border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">Henüz planlanmış agent görevi yok.</p>}
        </div>
      </div>
    </section>}

    <section className="rounded-[18px] border border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-600">
      <CheckCircle2 size={17} className="mr-2 inline text-emerald-700" />Güvenlik notu: API key ve secret değerleri client component’e gönderilmez. Provider ayarları server-side route üzerinden okunur ve sadece maskeli durum bilgisi gösterilir.
    </section>

    {editingProvider && <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/55 p-4" onMouseDown={() => setEditingProvider(null)}>
      <div className="w-full max-w-2xl rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_30px_100px_rgba(15,23,42,.24)]" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">Provider ayarları</p>
            <h3 className="mt-2 text-2xl font-black text-slate-950">{editingProvider.provider_name}</h3>
            <p className="mt-2 text-sm text-slate-500">API anahtarı kaydedilirse server-side saklanır; bu ekrana geri dönmez.</p>
          </div>
          <button onClick={() => setEditingProvider(null)} className={secondaryButtonClass}>Kapat</button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm font-bold text-slate-700">Durum
            <select value={providerForm.status} onChange={(event) => setProviderForm({ ...providerForm, status: event.target.value })} className="rounded-[12px] border border-slate-200 px-3 py-3">
              <option value="active">active</option>
              <option value="passive">passive</option>
              <option value="error">error</option>
              <option value="not_configured">not_configured</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-bold text-slate-700">Varsayılan model
            <input value={providerForm.defaultModel} onChange={(event) => setProviderForm({ ...providerForm, defaultModel: event.target.value })} className="rounded-[12px] border border-slate-200 px-3 py-3" />
          </label>
          <label className="grid gap-1 text-sm font-bold text-slate-700">Günlük limit
            <input value={providerForm.dailyLimit} onChange={(event) => setProviderForm({ ...providerForm, dailyLimit: event.target.value })} className="rounded-[12px] border border-slate-200 px-3 py-3" />
          </label>
          <label className="grid gap-1 text-sm font-bold text-slate-700">Aylık limit
            <input value={providerForm.monthlyLimit} onChange={(event) => setProviderForm({ ...providerForm, monthlyLimit: event.target.value })} className="rounded-[12px] border border-slate-200 px-3 py-3" />
          </label>
          <label className="grid gap-1 text-sm font-bold text-slate-700">Tahmini aylık maliyet
            <input value={providerForm.estimatedMonthlyCost} onChange={(event) => setProviderForm({ ...providerForm, estimatedMonthlyCost: event.target.value })} className="rounded-[12px] border border-slate-200 px-3 py-3" />
          </label>
          <label className="grid gap-1 text-sm font-bold text-slate-700">API anahtarı
            <input value={providerForm.apiKey} onChange={(event) => setProviderForm({ ...providerForm, apiKey: event.target.value })} type="password" placeholder="Boş bırakılırsa değişmez" className="rounded-[12px] border border-slate-200 px-3 py-3" />
          </label>
          <label className="grid gap-1 text-sm font-bold text-slate-700 md:col-span-2">Notlar
            <textarea value={providerForm.notes} onChange={(event) => setProviderForm({ ...providerForm, notes: event.target.value })} rows={3} className="rounded-[12px] border border-slate-200 px-3 py-3" />
          </label>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button onClick={() => setEditingProvider(null)} className={secondaryButtonClass}>İptal</button>
          <button onClick={saveProviderSettings} disabled={loading} className={primaryButtonClass}>Kaydet</button>
        </div>
      </div>
    </div>}
  </div>;
}
