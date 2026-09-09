"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, Bot, Brain, CheckCircle2, Clock, Coins, DollarSign,
  Plug, Send, ShieldCheck, Sparkles, Users, Zap
} from "lucide-react";
import { AdminButton } from "./ui/AdminButton";
import { AdminKpiCard } from "./ui/AdminKpiCard";
import { AdminEmptyState, AdminErrorState, AdminLoadingState } from "./ui/AdminEmptyState";
import { AdminStatusBadge, type AdminStatusTone } from "./ui/AdminStatusBadge";
import { AdminTabs } from "./ui/AdminTabs";
import { AdminPageHeader, AdminSection } from "./ui/AdminPageHeader";

const SECTIONS = [
  "Control Center (Kontrol Merkezi)",
  "Director (Direktör)",
  "Agents (Ajanlar)",
  "Tasks (Görevler)",
  "Automations (Otomasyonlar)",
  "Approvals (Onaylar)",
  "Reports (Raporlar)",
  "Memory (Hafıza)",
  "Activity (Aktivite)",
  "AI Cost (Yapay Zekâ Maliyeti)",
  "Integrations (Entegrasyonlar)"
] as const;

type Section = (typeof SECTIONS)[number];

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error || "İstek başarısız oldu.");
  return body as T;
}

function useSectionData<T>(path: string, active: boolean) {
  const [state, setState] = useState<{ loading: boolean; error: string | null; data: T | null }>({ loading: true, error: null, data: null });
  const reload = useCallback(() => {
    if (!active) return;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    api<T>(path)
      .then((data) => setState({ loading: false, error: null, data }))
      .catch((error) => setState({ loading: false, error: error.message, data: null }));
  }, [path, active]);
  useEffect(() => { reload(); }, [reload]);
  return { ...state, reload };
}

function statusTone(status?: string | null): AdminStatusTone {
  if (!status) return "neutral";
  if (status.startsWith("completed") || status === "approved" || status === "ready" || status === "executed") return "success";
  if (status === "failed" || status === "rejected" || status === "critical") return "danger";
  if (status.includes("warning") || status === "pending" || status === "high") return "warning";
  return "info";
}

// 1. Control Center -----------------------------------------------------
function ControlCenter({ active, onNavigate }: { active: boolean; onNavigate: (section: Section) => void }) {
  type Overview = {
    configured: boolean; activeAgents: number; activeAutomations: number; pendingApprovals: number;
    openRecommendations: number; criticalRisks: number; completedToday: number; failedRecent: number;
    costToday: number; costMonth: number; accountsNeedingAttention: number; recentActivity: { id: string; event_type: string; summary: string; created_at: string }[];
  };
  const { loading, error, data } = useSectionData<Overview>("/api/ai-workforce/overview", active);
  const [command, setCommand] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const runCommand = async () => {
    if (!command.trim()) return;
    setRunning(true);
    setResult(null);
    try {
      const res = await api<{ finalReport?: { executiveSummary?: string }; status: string }>("/api/ai-workforce/director/command", {
        method: "POST",
        body: JSON.stringify({ prompt: command })
      });
      setResult(res.finalReport?.executiveSummary || `Görev tamamlandı: ${res.status}`);
    } catch (err) {
      setResult(err instanceof Error ? err.message : "Hata oluştu.");
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <AdminLoadingState label="Kontrol Merkezi yükleniyor..." />;
  if (error || !data) return <AdminErrorState description={error || "Veri alınamadı."} />;

  return (
    <div className="grid gap-4">
      {!data.configured && <AdminErrorState title="Supabase yapılandırılmadı" description="Kontrol Merkezi verileri görüntülenemiyor." />}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AdminKpiCard label="Active Agents (Aktif Ajanlar)" value={data.activeAgents} icon={<Bot size={18} />} tone="ai" onClick={() => onNavigate("Agents (Ajanlar)")} />
        <AdminKpiCard label="Active Automations (Aktif Otomasyonlar)" value={data.activeAutomations} icon={<Zap size={18} />} tone="info" onClick={() => onNavigate("Automations (Otomasyonlar)")} />
        <AdminKpiCard label="Pending Approvals (Bekleyen Onaylar)" value={data.pendingApprovals} icon={<ShieldCheck size={18} />} tone={data.pendingApprovals ? "warning" : "success"} onClick={() => onNavigate("Approvals (Onaylar)")} />
        <AdminKpiCard label="Critical Risks (Kritik Riskler)" value={data.criticalRisks} icon={<AlertTriangle size={18} />} tone={data.criticalRisks ? "danger" : "success"} />
        <AdminKpiCard label="Completed Today (Bugün Tamamlanan)" value={data.completedToday} icon={<CheckCircle2 size={18} />} tone="success" />
        <AdminKpiCard label="Failed Runs (Başarısız Çalıştırma)" value={data.failedRecent} icon={<AlertTriangle size={18} />} tone={data.failedRecent ? "danger" : "success"} />
        <AdminKpiCard label="Estimated Cost Today (Bugün Tahmini Maliyet)" value={`$${data.costToday.toFixed(2)}`} icon={<DollarSign size={18} />} tone="primary" onClick={() => onNavigate("AI Cost (Yapay Zekâ Maliyeti)")} />
        <AdminKpiCard label="Accounts Needing Attention (İlgi Gereken Hesap)" value={data.accountsNeedingAttention} icon={<Users size={18} />} tone={data.accountsNeedingAttention ? "warning" : "success"} />
      </div>

      <AdminSection title="Director (Direktör)" description="Ajans genelinde veya bir müşteri için yüksek seviyeli bir komut ver — gerçek bir agent çalıştırması başlatır ve kalıcı olarak kaydedilir.">
        <textarea
          value={command}
          onChange={(event) => setCommand(event.target.value)}
          placeholder="Örn: Bugün tüm aktif müşterileri incele. Performansı düşenleri bul. SEO/GEO fırsatlarını çıkar. Önceliklendir."
          rows={3}
          className="w-full rounded-[12px] border p-3 text-sm"
          style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }}
        />
        <div className="mt-3 flex items-center gap-2">
          <AdminButton variant="ai" icon={<Send size={14} />} loading={running} onClick={runCommand}>Komutu Çalıştır</AdminButton>
          {result && <p className="text-sm leading-6" style={{ color: "var(--admin-text-secondary)" }}>{result}</p>}
        </div>
      </AdminSection>

      <AdminSection title="Recent Activity (Son Aktivite)">
        {data.recentActivity.length ? (
          <div className="grid gap-2">
            {data.recentActivity.map((item) => (
              <div key={item.id} className="rounded-[10px] border p-2.5 text-sm" style={{ borderColor: "var(--admin-border)" }}>
                <span className="font-bold" style={{ color: "var(--admin-text-primary)" }}>{item.summary}</span>
                <span className="ml-2 text-xs" style={{ color: "var(--admin-text-muted)" }}>{new Date(item.created_at).toLocaleString("tr-TR")}</span>
              </div>
            ))}
          </div>
        ) : (
          <AdminEmptyState title="Henüz aktivite yok" description="Director komutu çalıştırdığında veya bir ajan görev tamamladığında burada görünecek." />
        )}
      </AdminSection>
    </div>
  );
}

// 2. Director (standalone tab — reuses the same command box) ------------
function DirectorTab() {
  const [prompt, setPrompt] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [multiAgent, setMultiAgent] = useState(false);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<{ executiveSummary: string; findings: string[]; risks: string[]; recommendedActions: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!prompt.trim()) return;
    setRunning(true);
    setError(null);
    setReport(null);
    try {
      const res = await api<{ finalReport?: typeof report; errorMessage?: string | null }>("/api/ai-workforce/director/command", {
        method: "POST",
        body: JSON.stringify({ prompt, companyId: companyId || null, multiAgent })
      });
      setReport(res.finalReport || null);
      if (res.errorMessage) setError(res.errorMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hata oluştu.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="grid gap-4">
      <AdminSection title="Director (Direktör)" description="Yüksek seviyeli talepleri yorumlar, uzman ajanlara devreder ve sonuçları birleştirir. Her çalıştırma agent_runs tablosuna kalıcı olarak kaydedilir.">
        <div className="grid gap-3">
          <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={4} placeholder="Direktöre komut ver..." className="w-full rounded-[12px] border p-3 text-sm" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }} />
          <div className="flex flex-wrap items-center gap-3">
            <input value={companyId} onChange={(event) => setCompanyId(event.target.value)} placeholder="Müşteri ID (opsiyonel)" className="rounded-[10px] border px-3 py-2 text-sm" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }} />
            <label className="flex items-center gap-2 text-xs font-bold" style={{ color: "var(--admin-text-secondary)" }}>
              <input type="checkbox" checked={multiAgent} onChange={(event) => setMultiAgent(event.target.checked)} /> Multi-Agent (Çoklu Ajan)
            </label>
            <AdminButton variant="ai" icon={<Sparkles size={14} />} loading={running} onClick={run}>Görevi Başlat</AdminButton>
          </div>
        </div>
      </AdminSection>
      {error && <AdminErrorState title="Provider hatası" description={error} />}
      {report && (
        <AdminSection title="Sonuç (Draft — Taslak)">
          <p className="text-sm leading-6" style={{ color: "var(--admin-text-primary)" }}>{report.executiveSummary}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div><p className="text-xs font-black uppercase" style={{ color: "var(--admin-text-muted)" }}>Findings (Bulgular)</p><ul className="mt-1 list-disc pl-4 text-sm">{report.findings?.map((item) => <li key={item}>{item}</li>)}</ul></div>
            <div><p className="text-xs font-black uppercase" style={{ color: "var(--admin-text-muted)" }}>Risks (Riskler)</p><ul className="mt-1 list-disc pl-4 text-sm">{report.risks?.map((item) => <li key={item}>{item}</li>)}</ul></div>
            <div><p className="text-xs font-black uppercase" style={{ color: "var(--admin-text-muted)" }}>Recommended Actions (Önerilen Aksiyonlar)</p><ul className="mt-1 list-disc pl-4 text-sm">{report.recommendedActions?.map((item) => <li key={item}>{item}</li>)}</ul></div>
          </div>
        </AdminSection>
      )}
    </div>
  );
}

// 3. Agents ---------------------------------------------------------------
function AgentsTab({ active }: { active: boolean }) {
  type Agent = {
    id: string; agent_key: string; agent_name: string; role_label: string; status: string;
    current_task?: string | null; success_rate?: number | null; last_run_at?: string | null;
    lastRun?: { status?: string | null; completed_at?: string | null; estimated_cost?: number | null } | null;
  };
  const { loading, error, data, reload } = useSectionData<{ agents: Agent[] }>("/api/ai-workforce/agents", active);
  const [runningId, setRunningId] = useState<string | null>(null);

  const runAgent = async (id: string) => {
    setRunningId(id);
    try {
      await api(`/api/ai-workforce/agents/${id}/run`, { method: "POST", body: JSON.stringify({}) });
      reload();
    } catch {
      // surfaced via reload/empty state; keep the click responsive without a blocking alert
    } finally {
      setRunningId(null);
    }
  };

  if (loading) return <AdminLoadingState label="Ajanlar yükleniyor..." />;
  if (error) return <AdminErrorState description={error} />;
  if (!data?.agents.length) return <AdminEmptyState title="Ajan bulunamadı" description="hk_virtual_agents tablosunda kayıtlı ajan yok." />;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {data.agents.map((agent) => (
        <div key={agent.id} className="admin-card rounded-[16px] p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-black" style={{ color: "var(--admin-text-primary)" }}>{agent.agent_name}</p>
              <p className="text-xs" style={{ color: "var(--admin-text-muted)" }}>{agent.role_label}</p>
            </div>
            <AdminStatusBadge tone={statusTone(agent.status)}>{agent.status}</AdminStatusBadge>
          </div>
          <p className="mt-2 text-sm leading-5" style={{ color: "var(--admin-text-secondary)" }}>{agent.current_task || "Görev bekleniyor."}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>
            <span>Success Rate (Başarı): %{agent.success_rate ?? 0}</span>
            <span>Last Run (Son Çalıştırma): {agent.last_run_at ? new Date(agent.last_run_at).toLocaleString("tr-TR") : "Henüz yok"}</span>
          </div>
          {agent.lastRun && (
            <AdminStatusBadge tone={statusTone(agent.lastRun.status)}>{agent.lastRun.status}</AdminStatusBadge>
          )}
          <div className="mt-3">
            <AdminButton variant="ai" icon={<Zap size={14} />} loading={runningId === agent.id} onClick={() => runAgent(agent.id)} compact>Run (Çalıştır)</AdminButton>
          </div>
        </div>
      ))}
    </div>
  );
}

// 4. Tasks ------------------------------------------------------------------
function TasksTab({ active }: { active: boolean }) {
  type Task = { id: string; title: string; status: string; priority?: string; due_date?: string | null; automation_key?: string | null; created_at: string };
  const { loading, error, data } = useSectionData<{ tasks: Task[] }>("/api/ai-workforce/tasks", active);
  if (loading) return <AdminLoadingState label="Görevler yükleniyor..." />;
  if (error) return <AdminErrorState description={error} />;
  if (!data?.tasks.length) return <AdminEmptyState title="AI tarafından oluşturulmuş görev yok" description="Bir öneri veya onay task'a dönüştürüldüğünde burada görünür (agency_tasks, ai_generated=true)." />;
  return (
    <div className="overflow-x-auto rounded-[16px] border" style={{ borderColor: "var(--admin-border)" }}>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-xs font-black uppercase" style={{ color: "var(--admin-text-muted)" }}>
          <th className="p-3">Title (Başlık)</th><th className="p-3">Status (Durum)</th><th className="p-3">Priority (Öncelik)</th><th className="p-3">Origin (Köken)</th><th className="p-3">Created (Oluşturma)</th>
        </tr></thead>
        <tbody>
          {data.tasks.map((task) => (
            <tr key={task.id} className="border-t" style={{ borderColor: "var(--admin-border)" }}>
              <td className="p-3 font-bold" style={{ color: "var(--admin-text-primary)" }}>{task.title}</td>
              <td className="p-3"><AdminStatusBadge tone={statusTone(task.status)}>{task.status}</AdminStatusBadge></td>
              <td className="p-3">{task.priority || "Normal"}</td>
              <td className="p-3 text-xs" style={{ color: "var(--admin-text-muted)" }}>{task.automation_key || "—"}</td>
              <td className="p-3 text-xs" style={{ color: "var(--admin-text-muted)" }}>{new Date(task.created_at).toLocaleDateString("tr-TR")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 5. Automations -------------------------------------------------------------
function AutomationsTab({ active }: { active: boolean }) {
  type ScheduledTask = { id: string; name: string; task_type: string; schedule_frequency: string; schedule_day?: string; schedule_time?: string; is_active: boolean; last_run_at?: string | null; next_run_at?: string | null };
  type CalendarItem = { id: string; title: string; operation_type: string; frequency: string; assigned_agent_key?: string | null; next_run_at?: string | null; is_active: boolean };
  const { loading, error, data, reload } = useSectionData<{ scheduledTasks: ScheduledTask[]; calendar: CalendarItem[] }>("/api/ai-workforce/automations", active);
  const [form, setForm] = useState({ name: "", prompt: "", frequency: "weekly", day: "Pazartesi", time: "09:00" });
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!form.name.trim() || !form.prompt.trim()) return;
    setSaving(true);
    try {
      await api("/api/ai-workforce/automations", { method: "POST", body: JSON.stringify(form) });
      setForm({ name: "", prompt: "", frequency: "weekly", day: "Pazartesi", time: "09:00" });
      reload();
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (id: string, isActive: boolean) => {
    await api(`/api/ai-workforce/automations/${id}`, { method: "PATCH", body: JSON.stringify({ isActive: !isActive }) });
    reload();
  };

  if (loading) return <AdminLoadingState label="Otomasyonlar yükleniyor..." />;
  if (error) return <AdminErrorState description={error} />;

  return (
    <div className="grid gap-4">
      <AdminSection title="New Automation (Yeni Otomasyon)" description="Belirlenen sıklıkta otomatik çalışacak bir agent görevi tanımla. Cron: her gün 06:20 UTC'de vadesi gelenler otomatik çalıştırılır.">
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Otomasyon adı" className="rounded-[10px] border px-3 py-2 text-sm" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }} />
          <select value={form.frequency} onChange={(event) => setForm({ ...form, frequency: event.target.value })} className="rounded-[10px] border px-3 py-2 text-sm" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }}>
            <option value="daily">Daily (Günlük)</option>
            <option value="weekly">Weekly (Haftalık)</option>
            <option value="monthly">Monthly (Aylık)</option>
          </select>
          <textarea value={form.prompt} onChange={(event) => setForm({ ...form, prompt: event.target.value })} placeholder="Görev açıklaması" rows={2} className="sm:col-span-2 rounded-[10px] border px-3 py-2 text-sm" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }} />
        </div>
        <div className="mt-2"><AdminButton variant="primary" loading={saving} onClick={create}>Otomasyonu Kaydet</AdminButton></div>
      </AdminSection>

      <AdminSection title="Scheduled Tasks (Zamanlanmış Görevler)">
        {data?.scheduledTasks.length ? (
          <div className="grid gap-2">
            {data.scheduledTasks.map((task) => (
              <div key={task.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border p-3" style={{ borderColor: "var(--admin-border)" }}>
                <div>
                  <p className="font-bold" style={{ color: "var(--admin-text-primary)" }}>{task.name}</p>
                  <p className="text-xs" style={{ color: "var(--admin-text-muted)" }}>{task.schedule_frequency} · {task.schedule_day} {task.schedule_time} · Next (Sonraki): {task.next_run_at ? new Date(task.next_run_at).toLocaleString("tr-TR") : "Belirlenecek"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <AdminStatusBadge tone={task.is_active ? "success" : "neutral"}>{task.is_active ? "Active (Aktif)" : "Paused (Duraklatıldı)"}</AdminStatusBadge>
                  <AdminButton variant="outline" compact onClick={() => toggle(task.id, task.is_active)}>{task.is_active ? "Duraklat" : "Etkinleştir"}</AdminButton>
                </div>
              </div>
            ))}
          </div>
        ) : <AdminEmptyState title="Zamanlanmış görev yok" />}
      </AdminSection>

      <AdminSection title="AI Operations Calendar (AI Operasyon Takvimi)" description="HK Intelligence CEO ekranındaki haftalık operasyon takvimi (salt okunur).">
        {data?.calendar.length ? (
          <div className="grid gap-2">
            {data.calendar.map((item) => (
              <div key={item.id} className="rounded-[10px] border p-2.5 text-sm" style={{ borderColor: "var(--admin-border)" }}>
                <span className="font-bold">{item.title}</span> — {item.operation_type} · {item.frequency} · {item.assigned_agent_key || "Atanmadı"}
              </div>
            ))}
          </div>
        ) : <AdminEmptyState title="Takvim girdisi yok" />}
      </AdminSection>
    </div>
  );
}

// 6. Approvals ----------------------------------------------------------------
function ApprovalsTab({ active }: { active: boolean }) {
  type ApprovalItem = { id: string; source: "approval" | "recommendation"; title: string; description: string; actionType: string; riskLevel: string; status: string; executionStatus: string; companyId: string | null; createdAt: string };
  const { loading, error, data, reload } = useSectionData<{ approvals: ApprovalItem[] }>("/api/ai-workforce/approvals", active);
  const [busyId, setBusyId] = useState<string | null>(null);

  const decide = async (item: ApprovalItem, decision: "approved" | "rejected") => {
    setBusyId(item.id);
    try {
      await api(`/api/ai-workforce/approvals/${item.id}`, { method: "PATCH", body: JSON.stringify({ decision, source: item.source }) });
      reload();
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <AdminLoadingState label="Onaylar yükleniyor..." />;
  if (error) return <AdminErrorState description={error} />;
  const pending = data?.approvals.filter((item) => item.status === "pending") || [];
  const decided = data?.approvals.filter((item) => item.status !== "pending") || [];

  return (
    <div className="grid gap-4">
      <AdminSection title="Pending (Bekleyen)">
        {pending.length ? (
          <div className="grid gap-2">
            {pending.map((item) => (
              <div key={`${item.source}-${item.id}`} className="rounded-[12px] border p-3" style={{ borderColor: "var(--admin-border)" }}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-black" style={{ color: "var(--admin-text-primary)" }}>{item.title}</p>
                    <p className="text-sm" style={{ color: "var(--admin-text-secondary)" }}>{item.description}</p>
                  </div>
                  <div className="flex gap-1">
                    <AdminStatusBadge tone={statusTone(item.riskLevel)}>{item.riskLevel}</AdminStatusBadge>
                    <AdminStatusBadge tone="info">{item.actionType}</AdminStatusBadge>
                  </div>
                </div>
                <div className="mt-2 flex gap-2">
                  <AdminButton variant="success" compact loading={busyId === item.id} onClick={() => decide(item, "approved")}>Approve (Onayla)</AdminButton>
                  <AdminButton variant="danger" compact loading={busyId === item.id} onClick={() => decide(item, "rejected")}>Reject (Reddet)</AdminButton>
                </div>
              </div>
            ))}
          </div>
        ) : <AdminEmptyState title="Bekleyen onay yok" description="Director çalıştırmaları veya HK Intelligence önerileri buraya düşer." />}
      </AdminSection>
      <AdminSection title="Decided (Karar Verilenler)">
        {decided.length ? (
          <div className="grid gap-2">
            {decided.slice(0, 20).map((item) => (
              <div key={`${item.source}-${item.id}`} className="flex items-center justify-between rounded-[10px] border p-2.5 text-sm" style={{ borderColor: "var(--admin-border)" }}>
                <span>{item.title}</span>
                <div className="flex gap-2">
                  <AdminStatusBadge tone={statusTone(item.status)}>{item.status}</AdminStatusBadge>
                  <AdminStatusBadge tone={item.executionStatus === "execution_unavailable" ? "warning" : "neutral"}>{item.executionStatus}</AdminStatusBadge>
                </div>
              </div>
            ))}
          </div>
        ) : <AdminEmptyState title="Henüz karar verilmedi" />}
      </AdminSection>
    </div>
  );
}

// 7. Reports --------------------------------------------------------------
function ReportsTab({ active }: { active: boolean }) {
  type ReportRow = { id: string; report_type: string; source_module?: string | null; created_at: string };
  const { loading, error, data } = useSectionData<{ reports: ReportRow[] }>("/api/ai-workforce/reports", active);
  if (loading) return <AdminLoadingState label="Raporlar yükleniyor..." />;
  if (error) return <AdminErrorState description={error} />;
  if (!data?.reports.length) return <AdminEmptyState title="Rapor yok" description="Raporlar Rapor Merkezi (HK Admin) ile paylaşılır." />;
  return (
    <div className="grid gap-2">
      {data.reports.map((report) => (
        <div key={report.id} className="flex items-center justify-between rounded-[10px] border p-3 text-sm" style={{ borderColor: "var(--admin-border)" }}>
          <span className="font-bold" style={{ color: "var(--admin-text-primary)" }}>{report.report_type}</span>
          <span className="text-xs" style={{ color: "var(--admin-text-muted)" }}>{report.source_module} · {new Date(report.created_at).toLocaleDateString("tr-TR")}</span>
        </div>
      ))}
    </div>
  );
}

// 8. Memory -----------------------------------------------------------------
function MemoryTab({ active }: { active: boolean }) {
  type MemoryRow = { id: string; title: string; content: string; memory_type?: string; impact_score?: number; created_at: string };
  const { loading, error, data, reload } = useSectionData<{ memories: MemoryRow[] }>("/api/ai-workforce/memory", active);
  const [form, setForm] = useState({ title: "", content: "" });
  const [saving, setSaving] = useState(false);

  const add = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    setSaving(true);
    try {
      await api("/api/ai-workforce/memory", { method: "POST", body: JSON.stringify(form) });
      setForm({ title: "", content: "" });
      reload();
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <AdminLoadingState label="Hafıza yükleniyor..." />;
  if (error) return <AdminErrorState description={error} />;

  return (
    <div className="grid gap-4">
      <AdminSection title="Add Memory (Hafıza Ekle)" description="Ajans-seviyesi talimat, müşteri marka kuralı veya onaylanmış strateji kararı ekle. Sır/anahtar burada saklanmaz.">
        <div className="grid gap-2">
          <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Başlık" className="rounded-[10px] border px-3 py-2 text-sm" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }} />
          <textarea value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="İçerik" rows={2} className="rounded-[10px] border px-3 py-2 text-sm" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }} />
        </div>
        <div className="mt-2"><AdminButton variant="primary" loading={saving} onClick={add}>Kaydet</AdminButton></div>
      </AdminSection>
      <AdminSection title="Memory (Hafıza)">
        {data?.memories.length ? (
          <div className="grid gap-2">
            {data.memories.map((memory) => (
              <div key={memory.id} className="rounded-[10px] border p-3 text-sm" style={{ borderColor: "var(--admin-border)" }}>
                <p className="font-bold" style={{ color: "var(--admin-text-primary)" }}>{memory.title}</p>
                <p className="mt-1 leading-5" style={{ color: "var(--admin-text-secondary)" }}>{memory.content}</p>
              </div>
            ))}
          </div>
        ) : <AdminEmptyState title="Hafıza kaydı yok" />}
      </AdminSection>
    </div>
  );
}

// 9. Activity ----------------------------------------------------------------
function ActivityTab({ active }: { active: boolean }) {
  type ActivityRow = { id: string; event_type: string; summary: string; agent_key?: string | null; created_at: string };
  const { loading, error, data } = useSectionData<{ activity: ActivityRow[] }>("/api/ai-workforce/activity", active);
  if (loading) return <AdminLoadingState label="Aktivite yükleniyor..." />;
  if (error) return <AdminErrorState description={error} />;
  if (!data?.activity.length) return <AdminEmptyState title="Aktivite kaydı yok" />;
  return (
    <div className="grid gap-2">
      {data.activity.map((item) => (
        <div key={item.id} className="flex items-start gap-3 rounded-[10px] border p-3 text-sm" style={{ borderColor: "var(--admin-border)" }}>
          <AdminStatusBadge tone="info">{item.event_type}</AdminStatusBadge>
          <div className="min-w-0">
            <p style={{ color: "var(--admin-text-primary)" }}>{item.summary}</p>
            <p className="text-xs" style={{ color: "var(--admin-text-muted)" }}>{item.agent_key ? `${item.agent_key} · ` : ""}{new Date(item.created_at).toLocaleString("tr-TR")}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// 10. AI Cost -----------------------------------------------------------------
function CostTab({ active }: { active: boolean }) {
  type CostBreakdown = { today: number; month: number; byProvider: { key: string; estimatedCost: number; tokensUsed: number; runCount: number }[]; byAgent: { key: string; estimatedCost: number; tokensUsed: number; runCount: number }[]; note: string };
  const { loading, error, data } = useSectionData<CostBreakdown>("/api/ai-workforce/cost", active);
  if (loading) return <AdminLoadingState label="Maliyet verisi yükleniyor..." />;
  if (error) return <AdminErrorState description={error} />;
  if (!data) return null;
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <AdminKpiCard label="Estimated Cost — Today (Tahmini Maliyet — Bugün)" value={`$${data.today.toFixed(2)}`} icon={<Coins size={18} />} tone="primary" />
        <AdminKpiCard label="Estimated Cost — Month (Tahmini Maliyet — Bu Ay)" value={`$${data.month.toFixed(2)}`} icon={<Coins size={18} />} tone="ai" />
      </div>
      <AdminEmptyState title="Actual Cost (Gerçek Maliyet)" description={data.note} />
      <AdminSection title="By Provider (Sağlayıcıya Göre)">
        {data.byProvider.length ? (
          <div className="grid gap-2">
            {data.byProvider.map((row) => (
              <div key={row.key} className="flex items-center justify-between rounded-[10px] border p-2.5 text-sm" style={{ borderColor: "var(--admin-border)" }}>
                <span className="font-bold">{row.key}</span>
                <span>${row.estimatedCost.toFixed(2)} · {row.runCount} run · {row.tokensUsed} token</span>
              </div>
            ))}
          </div>
        ) : <AdminEmptyState title="Bu ay veri yok" />}
      </AdminSection>
      <AdminSection title="By Agent (Ajana Göre)">
        {data.byAgent.length ? (
          <div className="grid gap-2">
            {data.byAgent.map((row) => (
              <div key={row.key} className="flex items-center justify-between rounded-[10px] border p-2.5 text-sm" style={{ borderColor: "var(--admin-border)" }}>
                <span className="font-bold">{row.key}</span>
                <span>${row.estimatedCost.toFixed(2)} · {row.runCount} run</span>
              </div>
            ))}
          </div>
        ) : <AdminEmptyState title="Ajan bazlı çalıştırma yok" description="Ajanlar sekmesinden Run çalıştırdığında burada birikir." />}
      </AdminSection>
    </div>
  );
}

// 11. Integrations -------------------------------------------------------------
function IntegrationsTab({ active }: { active: boolean }) {
  type ProviderRow = { key: string; name: string; status: string; configured: boolean; roleLabel?: string | null };
  const { loading, error, data } = useSectionData<{ providers: ProviderRow[]; supabaseConfigured: boolean; cronConfigured: boolean }>("/api/ai-workforce/integrations", active);
  if (loading) return <AdminLoadingState label="Entegrasyonlar yükleniyor..." />;
  if (error) return <AdminErrorState description={error} />;
  if (!data) return null;
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <AdminKpiCard label="Supabase" value={data.supabaseConfigured ? "Connected (Bağlı)" : "Missing (Eksik)"} icon={<Plug size={18} />} tone={data.supabaseConfigured ? "success" : "danger"} />
        <AdminKpiCard label="Cron Secret" value={data.cronConfigured ? "Configured (Yapılandırıldı)" : "Missing (Eksik)"} icon={<Clock size={18} />} tone={data.cronConfigured ? "success" : "warning"} />
      </div>
      <AdminSection title="AI Providers (Yapay Zekâ Sağlayıcıları)" description="Agent Hub ile aynı canlı durumu gösterir (getAgentProviders).">
        <div className="grid gap-2 sm:grid-cols-2">
          {data.providers.map((provider) => (
            <div key={provider.key} className="flex items-center justify-between rounded-[10px] border p-2.5 text-sm" style={{ borderColor: "var(--admin-border)" }}>
              <div>
                <p className="font-bold" style={{ color: "var(--admin-text-primary)" }}>{provider.name}</p>
                <p className="text-xs" style={{ color: "var(--admin-text-muted)" }}>{provider.roleLabel}</p>
              </div>
              <AdminStatusBadge tone={provider.configured ? "success" : "neutral"}>{provider.status}</AdminStatusBadge>
            </div>
          ))}
        </div>
      </AdminSection>
    </div>
  );
}

// Shell -----------------------------------------------------------------------
export function AIWorkforceApp({ initialSection }: { initialSection?: Section }) {
  const [active, setActive] = useState<Section>(initialSection && SECTIONS.includes(initialSection) ? initialSection : "Control Center (Kontrol Merkezi)");
  // The --admin-* color tokens this whole page (and the shared AdminButton/
  // AdminKpiCard/AdminTabs/etc. kit it's built from) reads are only DEFINED
  // inside the .hk-admin CSS scope (see globals.css) — every other real
  // /hk-admin/* page renders inside AdminAppShell, which carries that class.
  // This page is intentionally a separate, standalone product (no shared
  // mega-nav/header), so it never picked up that class, which left every
  // var(--admin-text-*) reference invalid at computed-value time — for the
  // inherited `color` property that means it silently fell back to the
  // public marketing site's near-white --foreground text color, unreadable
  // on this page's light surfaces. Applying the same class + persisted theme
  // attribute AdminStandaloneShell uses (without its full nav shell) fixes
  // every tab, not just Control Center, since they all share this root.
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  useEffect(() => {
    try {
      const stored = localStorage.getItem("hk-admin-theme");
      if (stored === "dark" || stored === "light") setTheme(stored);
      else if (window.matchMedia?.("(prefers-color-scheme: light)").matches) setTheme("light");
    } catch {}
  }, []);

  return (
    <div
      data-admin="true"
      data-theme={theme}
      className={`hk-admin admin-shell ai-workforce-shell min-h-screen ${theme === "light" ? "admin-light" : ""}`}
      style={{ background: "var(--admin-bg, #F6F5F1)" }}
    >
      {/* role="banner" (not a real <header>) — the global .hk-admin header
          selector forces a fixed light background with !important that would
          fight this bar's own theme-aware background in dark mode. */}
      <div role="banner" className="border-b p-4 sm:p-6" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Brain size={22} style={{ color: "var(--nav-accent-text, #0e7490)" }} />
            <div>
              <p className="text-lg font-black" style={{ color: "var(--admin-text-primary)" }}>HK AI Workforce</p>
              <p className="text-xs" style={{ color: "var(--admin-text-muted)" }}>HK Yapay Zekâ İş Gücü</p>
            </div>
          </div>
          <Link href="/hk-admin" className="hk-button hk-button-outline px-4 py-2 text-sm">HK Admin&apos;e Dön</Link>
        </div>
      </div>
      <main className="mx-auto max-w-6xl p-4 sm:p-6">
        <AdminPageHeader eyebrow="AI Operations Center" title={active} description="Ajans genelinde AI ajanlarını, görevlerini, onaylarını ve maliyetini tek bir yerden yönet." />
        <AdminTabs items={SECTIONS} active={active} onChange={(value) => setActive(value as Section)} ariaLabel="HK AI Workforce sekmeleri" />
        <div className="mt-2">
          {active === "Control Center (Kontrol Merkezi)" && <ControlCenter active={active === "Control Center (Kontrol Merkezi)"} onNavigate={setActive} />}
          {active === "Director (Direktör)" && <DirectorTab />}
          {active === "Agents (Ajanlar)" && <AgentsTab active={active === "Agents (Ajanlar)"} />}
          {active === "Tasks (Görevler)" && <TasksTab active={active === "Tasks (Görevler)"} />}
          {active === "Automations (Otomasyonlar)" && <AutomationsTab active={active === "Automations (Otomasyonlar)"} />}
          {active === "Approvals (Onaylar)" && <ApprovalsTab active={active === "Approvals (Onaylar)"} />}
          {active === "Reports (Raporlar)" && <ReportsTab active={active === "Reports (Raporlar)"} />}
          {active === "Memory (Hafıza)" && <MemoryTab active={active === "Memory (Hafıza)"} />}
          {active === "Activity (Aktivite)" && <ActivityTab active={active === "Activity (Aktivite)"} />}
          {active === "AI Cost (Yapay Zekâ Maliyeti)" && <CostTab active={active === "AI Cost (Yapay Zekâ Maliyeti)"} />}
          {active === "Integrations (Entegrasyonlar)" && <IntegrationsTab active={active === "Integrations (Entegrasyonlar)"} />}
        </div>
      </main>
    </div>
  );
}
