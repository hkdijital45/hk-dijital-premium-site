"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import { useEffect, useMemo, useState } from "react";
import { Bot, CheckCircle2, Clipboard, FileText, FlaskConical, History, Play, RefreshCw, Route, ShieldCheck, Workflow, XCircle } from "lucide-react";
import type { SiteContent } from "@/lib/types";
import type { AgentProviderKey, AgentTaskType } from "@/lib/agent-hub";

type Notify = (message: string, type?: string) => void;

const providerOptions: Array<{ value: AgentProviderKey | "auto"; label: string }> = [
  { value: "auto", label: "Auto - Akıllı yönlendirme" },
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
  workflow_task: "Workflow görevi"
};

const workflows = [
  {
    name: "Müşteri Reklam Sağlık Analizi",
    description: "Meta ve Google verilerini okuyup HK Intelligence aksiyon planına dönüştürür.",
    steps: ["Müşteri seç", "Meta verisini oku", "Google Ads verisini oku", "OpenAI/Gemini ile yorumla", "Aksiyon planı oluştur"]
  },
  {
    name: "Derin Rakip Analizi",
    description: "Rakip/pazar araştırmasını Manus ile derinleştirip satış fırsatlarını çıkarır.",
    steps: ["Web sitesini oku", "Rakipleri bul", "Manus ile araştır", "Gemini ile SEO kıyasla", "OpenAI ile fırsatları çıkar"]
  },
  {
    name: "Teklif Hazırlama",
    description: "Sektör potansiyeli ve müşteri verisinden teklif metni ve PDF hazırlığı üretir.",
    steps: ["Müşteri verilerini oku", "Sektör potansiyelini hesapla", "Claude/OpenAI ile teklif yaz", "PDF hazırlığı çıktısı üret"]
  }
];

const taskTypes = Object.entries(agentTaskLabels).map(([value, label]) => ({ value, label }));

function statusClass(status?: string) {
  if (status === "active") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "error") return "border-red-200 bg-red-50 text-red-800";
  if (status === "passive") return "border-slate-200 bg-slate-100 text-slate-700";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function statusLabel(status?: string) {
  if (status === "active") return "Aktif";
  if (status === "passive") return "Pasif";
  if (status === "error") return "Hata";
  return "Yapılandırılmadı";
}

function copyText(text: string, notify?: Notify) {
  navigator.clipboard?.writeText(text).then(() => notify?.("Kopyalandı.", "success")).catch(() => notify?.("Kopyalama başarısız oldu.", "error"));
}

export function AgentHubCenter({ content, notify }: { content: SiteContent; notify?: Notify }) {
  const companies = Array.isArray((content as any).companies) ? (content as any).companies : [];
  const [activeTab, setActiveTab] = useState("overview");
  const [providers, setProviders] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [testingProvider, setTestingProvider] = useState("");
  const [editingProvider, setEditingProvider] = useState<any>(null);
  const [providerForm, setProviderForm] = useState({ status: "not_configured", defaultModel: "", dailyLimit: "", monthlyLimit: "", estimatedMonthlyCost: "", notes: "", apiKey: "" });
  const [runResult, setRunResult] = useState<any>(null);
  const [form, setForm] = useState({
    customerId: "",
    taskType: "ad_analysis" as AgentTaskType,
    priority: "normal",
    requestedProvider: "auto" as AgentProviderKey | "auto",
    outputFormat: "aksiyon planı",
    prompt: "Seçili müşteri için reklam performansını yorumla, riskleri çıkar ve 7 günlük aksiyon planı hazırla."
  });

  async function loadData() {
    setLoading(true);
    try {
      const [providerResponse, logResponse] = await Promise.all([
        fetch("/api/admin/agent-hub/providers"),
        fetch("/api/admin/agent-hub/logs")
      ]);
      const providerData = await providerResponse.json().catch(() => ({}));
      const logData = await logResponse.json().catch(() => ({}));
      if (!providerResponse.ok) throw new Error(providerData.error || "Provider listesi alınamadı.");
      setProviders(providerData.providers || []);
      setLogs(logData.logs || []);
      setSummary(logData.summary || {});
    } catch (error) {
      notify?.(error instanceof Error ? error.message : "Agent Hub verileri alınamadı.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function runTask() {
    if (!form.prompt.trim()) {
      notify?.("Görev açıklaması boş olamaz.", "warning");
      return;
    }
    setLoading(true);
    setRunResult(null);
    try {
      const response = await fetch("/api/admin/agent-hub/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Agent görevi başlatılamadı.");
      setRunResult(data);
      notify?.("Agent görevi tamamlandı.", data.status === "completed_with_fallback" ? "warning" : "success");
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

  function openProviderEdit(provider: any) {
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

  const monthlyManusRuns = useMemo(() => logs.filter((log) => log.selected_provider === "manus").length, [logs]);
  const topProvider = useMemo(() => {
    const counts = logs.reduce((acc: Record<string, number>, log) => {
      const key = log.selected_provider || "demo";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";
  }, [logs]);

  return <div className="grid gap-6">
    <section className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-6 text-white shadow-[0_22px_70px_rgba(15,23,42,.18)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[.18em] text-cyan-200">AI & Otomasyon</p>
          <h2 className="mt-3 text-3xl font-black">HK Agent Hub v1.0</h2>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-200">ChatGPT, Claude, Gemini, Groq, Manus ve yerel/alternatif modelleri görev tipine göre yöneten AI orkestrasyon merkezi.</p>
        </div>
        <button onClick={loadData} disabled={loading} className="rounded-[14px] border border-white/15 bg-white/10 px-5 py-3 text-sm font-black text-white disabled:opacity-60"><RefreshCw size={16} className="mr-2 inline" />Yenile</button>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {[
          ["Bugünkü görev", summary.todayRuns || 0],
          ["Bu ay görev", summary.monthRuns || logs.length],
          ["Tahmini maliyet", `${Number(summary.estimatedCost || 0).toLocaleString("tr-TR")} $`],
          ["Başarı oranı", `%${Math.round(summary.successRate || 100)}`],
          ["En çok kullanılan", topProvider],
          ["Manus araştırma", monthlyManusRuns]
        ].map(([label, value]) => <div key={label as string} className="rounded-[18px] border border-white/10 bg-white/10 p-4">
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
        ["logs", "Agent Logları", History]
      ].map(([key, label, Icon]: any) => <button key={key} onClick={() => setActiveTab(key)} className={`whitespace-nowrap rounded-[12px] px-4 py-3 text-sm font-black ${activeTab === key ? "bg-cyan-500 text-white" : "text-slate-600 hover:bg-slate-50"}`}><Icon size={16} className="mr-2 inline" />{label}</button>)}
    </nav>

    {activeTab === "overview" && <section className="grid gap-4 lg:grid-cols-[1fr_.42fr]">
      <div className="rounded-[22px] border border-slate-200 bg-white p-6">
        <p className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">Akıllı yönlendirme</p>
        <h3 className="mt-2 text-2xl font-black text-slate-950">Görev tipine göre doğru sağlayıcı seçimi</h3>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {[
            ["Günlük reklam ve CRM yorumları", "OpenAI / Gemini / Claude", "Kısa analiz, müşteri raporu ve aksiyon planı."],
            ["Hızlı cevaplar", "Groq / OpenAI", "Düşük gecikmeli kısa üretimler."],
            ["Teklif ve uzun metin", "Claude / OpenAI", "Daha kapsamlı metin ve teklif kurguları."],
            ["Derin araştırma", "Manus AI", "Rakip, pazar, fiyat, sektör keşfi ve uzun web araştırması."]
          ].map(([title, provider, detail]) => <div key={title} className="rounded-[18px] border border-slate-200 bg-slate-50 p-4">
            <strong className="block text-slate-950">{title}</strong>
            <span className="mt-2 block text-sm font-black text-cyan-700">{provider}</span>
            <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
          </div>)}
        </div>
      </div>
      <aside className="rounded-[22px] border border-amber-200 bg-amber-50 p-6">
        <p className="text-xs font-black uppercase tracking-[.16em] text-amber-700">Manus konumu</p>
        <h3 className="mt-2 text-xl font-black text-slate-950">Derin Araştırma Uzmanı</h3>
        <p className="mt-3 text-sm leading-6 text-slate-700">Manus günlük kısa cevaplar için değil; derin araştırma, rakip/pazar analizi ve kapsamlı rapor görevleri için kullanılır.</p>
        <div className="mt-4 grid gap-2 text-sm font-bold text-amber-900">
          {["competitor_research", "market_research", "pricing_research", "sector_discovery", "deep_report", "long_web_research"].map((item) => <span key={item} className="rounded-full border border-amber-200 bg-white px-3 py-2">{item}</span>)}
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
          <button onClick={() => testProvider(provider.provider_key)} disabled={testingProvider === provider.provider_key} className="rounded-[12px] bg-cyan-500 px-3 py-2 text-xs font-black text-white disabled:opacity-60"><FlaskConical size={14} className="mr-1 inline" />{testingProvider === provider.provider_key ? "Test..." : "Test Et"}</button>
          <button onClick={() => openProviderEdit(provider)} className="rounded-[12px] border border-slate-200 px-3 py-2 text-xs font-black text-slate-700">Ayarları Düzenle</button>
          <button onClick={() => setActiveTab("prompts")} className="rounded-[12px] border border-slate-200 px-3 py-2 text-xs font-black text-slate-700">Promptları Gör</button>
          <button onClick={() => setActiveTab("logs")} className="rounded-[12px] border border-slate-200 px-3 py-2 text-xs font-black text-slate-700">Logları Aç</button>
        </div>
      </div>)}
    </section>}

    {activeTab === "run" && <section className="grid gap-5 lg:grid-cols-[.42fr_1fr]">
      <div className="rounded-[22px] border border-slate-200 bg-white p-5">
        <h3 className="text-xl font-black text-slate-950">Yeni Agent Görevi</h3>
        <div className="mt-4 grid gap-3">
          <label className="grid gap-1 text-sm font-bold text-slate-700">Müşteri
            <select value={form.customerId} onChange={(event) => setForm({ ...form, customerId: event.target.value })} className="rounded-[12px] border border-slate-200 px-3 py-3">
              <option value="">Müşteri seçilmedi</option>
              {companies.map((company: any) => <option key={company.id} value={company.id}>{company.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-bold text-slate-700">Görev tipi
            <select value={form.taskType} onChange={(event) => setForm({ ...form, taskType: event.target.value as AgentTaskType })} className="rounded-[12px] border border-slate-200 px-3 py-3">{taskTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
          </label>
          <label className="grid gap-1 text-sm font-bold text-slate-700">Öncelik
            <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })} className="rounded-[12px] border border-slate-200 px-3 py-3"><option>düşük</option><option>normal</option><option>yüksek</option><option>kritik</option></select>
          </label>
          <label className="grid gap-1 text-sm font-bold text-slate-700">Kullanılacak sağlayıcı
            <select value={form.requestedProvider} onChange={(event) => setForm({ ...form, requestedProvider: event.target.value as AgentProviderKey | "auto" })} className="rounded-[12px] border border-slate-200 px-3 py-3">{providerOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
          </label>
          <label className="grid gap-1 text-sm font-bold text-slate-700">Çıktı formatı
            <select value={form.outputFormat} onChange={(event) => setForm({ ...form, outputFormat: event.target.value })} className="rounded-[12px] border border-slate-200 px-3 py-3"><option>kısa özet</option><option>detaylı rapor</option><option>aksiyon planı</option><option>tablo</option><option>PDF hazırlığı</option></select>
          </label>
          <label className="grid gap-1 text-sm font-bold text-slate-700">Görev açıklaması
            <textarea value={form.prompt} onChange={(event) => setForm({ ...form, prompt: event.target.value })} rows={7} className="rounded-[12px] border border-slate-200 px-3 py-3" />
          </label>
          <button onClick={runTask} disabled={loading} className="rounded-[14px] bg-slate-950 px-5 py-4 text-sm font-black text-white disabled:opacity-60"><Play size={16} className="mr-2 inline" />{loading ? "Çalışıyor..." : "Görevi Başlat"}</button>
        </div>
      </div>
      <div className="rounded-[22px] border border-slate-200 bg-white p-5">
        <h3 className="text-xl font-black text-slate-950">HK Intelligence Son Yorumu</h3>
        {!runResult && <p className="mt-4 rounded-[16px] border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">Görev çalıştırılınca seçilen sağlayıcı, riskler, fırsatlar ve 7 günlük plan burada görünür.</p>}
        {runResult && <div className="mt-4 grid gap-4">
          <div className="rounded-[16px] border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-900"><Route size={16} className="mr-2 inline" />Seçilen sağlayıcı: <strong>{runResult.selectedProvider?.provider_name}</strong> · Durum: <strong>{runResult.status}</strong> · Süre: <strong>{runResult.responseMs} ms</strong></div>
          <pre className="whitespace-pre-wrap rounded-[16px] border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700">{runResult.output?.summary}</pre>
          <div className="grid gap-3 md:grid-cols-2">
            {["findings", "risks", "opportunities", "recommendedActions", "nextSteps"].map((key) => <div key={key} className="rounded-[16px] border border-slate-200 p-4">
              <h4 className="font-black text-slate-950">{key === "findings" ? "Bulgular" : key === "risks" ? "Riskler" : key === "opportunities" ? "Fırsatlar" : key === "recommendedActions" ? "Öncelikli Aksiyonlar" : "7 Günlük Plan"}</h4>
              <ul className="mt-3 grid gap-2 text-sm text-slate-600">{(runResult.output?.[key] || []).map((item: string) => <li key={item}>- {item}</li>)}</ul>
            </div>)}
          </div>
          <button onClick={() => copyText(JSON.stringify(runResult.output, null, 2), notify)} className="w-fit rounded-[12px] border border-slate-200 px-4 py-3 text-sm font-black text-slate-700"><Clipboard size={16} className="mr-2 inline" />Çıktıyı Kopyala</button>
        </div>}
      </div>
    </section>}

    {activeTab === "prompts" && <section className="rounded-[22px] border border-slate-200 bg-white p-5">
      <h3 className="text-xl font-black text-slate-950">Prompt Merkezi</h3>
      <p className="mt-2 text-sm text-slate-600">Agent Hub promptları `agent_prompts` tablosuyla uyumludur. Mevcut Prompt Merkezi varsa aynı veri yapısına bağlanabilir.</p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm"><thead className="text-xs uppercase tracking-[.12em] text-slate-500"><tr><th className="border-b py-3">Görev tipi</th><th className="border-b py-3">Sağlayıcı</th><th className="border-b py-3">Başlık</th><th className="border-b py-3">Durum</th><th className="border-b py-3">İşlem</th></tr></thead>
          <tbody>{taskTypes.slice(0, 8).map((task, index) => <tr key={task.value} className="border-b border-slate-100"><td className="py-3 font-bold">{task.label}</td><td className="py-3">{index < 2 ? "manus" : index % 2 ? "openai" : "gemini"}</td><td className="py-3">{task.label} varsayılan promptu</td><td className="py-3"><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">Aktif</span></td><td className="py-3"><button onClick={() => notify?.("Prompt düzenleme API güvenli şekilde sonraki sürümde detaylandırılabilir.", "info")} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-black">Görüntüle</button></td></tr>)}</tbody></table>
      </div>
    </section>}

    {activeTab === "workflows" && <section className="grid gap-4 lg:grid-cols-3">
      {workflows.map((workflow) => <div key={workflow.name} className="rounded-[22px] border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-3"><h3 className="text-lg font-black text-slate-950">{workflow.name}</h3><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">Aktif</span></div>
        <p className="mt-3 text-sm leading-6 text-slate-600">{workflow.description}</p>
        <ol className="mt-4 grid gap-2 text-sm text-slate-700">{workflow.steps.map((step, index) => <li key={step} className="rounded-[12px] bg-slate-50 p-3"><strong>{index + 1}.</strong> {step}</li>)}</ol>
        <div className="mt-4 grid grid-cols-3 gap-2"><button onClick={() => setActiveTab("run")} className="rounded-[12px] bg-cyan-500 px-3 py-2 text-xs font-black text-white">Çalıştır</button><button onClick={() => notify?.("Workflow detayları kart üzerinde listelendi.", "info")} className="rounded-[12px] border border-slate-200 px-3 py-2 text-xs font-black">Detay</button><button onClick={() => copyText(JSON.stringify(workflow, null, 2), notify)} className="rounded-[12px] border border-slate-200 px-3 py-2 text-xs font-black">Kopyala</button></div>
      </div>)}
    </section>}

    {activeTab === "logs" && <section className="rounded-[22px] border border-slate-200 bg-white p-5">
      <h3 className="text-xl font-black text-slate-950">Agent Logları</h3>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-sm"><thead className="text-xs uppercase tracking-[.12em] text-slate-500"><tr><th className="border-b py-3">Tarih</th><th className="border-b py-3">Görev tipi</th><th className="border-b py-3">Sağlayıcı</th><th className="border-b py-3">Durum</th><th className="border-b py-3">Süre</th><th className="border-b py-3">Maliyet</th><th className="border-b py-3">İşlem</th></tr></thead>
          <tbody>{logs.map((log) => <tr key={log.id || `${log.created_at}-${log.task_type}`} className="border-b border-slate-100"><td className="py-3 text-slate-600">{log.created_at ? new Date(log.created_at).toLocaleString("tr-TR") : "-"}</td><td className="py-3 font-bold">{agentTaskLabels[log.task_type as AgentTaskType] || log.task_type}</td><td className="py-3">{log.selected_provider || "-"}</td><td className="py-3">{log.status || "-"}</td><td className="py-3">{log.response_ms || 0} ms</td><td className="py-3">{Number(log.estimated_cost || 0).toLocaleString("tr-TR")} $</td><td className="py-3"><button onClick={() => copyText(log.output_summary || JSON.stringify(log.output_payload || {}), notify)} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-black">Çıktıyı Kopyala</button></td></tr>)}
          {!logs.length && <tr><td colSpan={7} className="py-8 text-center text-slate-500"><XCircle size={20} className="mx-auto mb-2" />Henüz agent log kaydı yok.</td></tr>}</tbody></table>
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
          <button onClick={() => setEditingProvider(null)} className="rounded-[12px] border border-slate-200 px-3 py-2 text-sm font-black text-slate-600">Kapat</button>
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
          <button onClick={() => setEditingProvider(null)} className="rounded-[12px] border border-slate-200 px-5 py-3 text-sm font-black text-slate-700">İptal</button>
          <button onClick={saveProviderSettings} disabled={loading} className="rounded-[12px] bg-cyan-500 px-5 py-3 text-sm font-black text-white disabled:opacity-60">Kaydet</button>
        </div>
      </div>
    </div>}
  </div>;
}
