"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Activity, AlertTriangle, Bot, CheckCircle2, ClipboardList, RefreshCw, XCircle } from "lucide-react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminStatusBadge, type AdminStatusTone } from "@/components/admin/ui/AdminStatusBadge";
import { AdminTabs } from "@/components/admin/ui/AdminTabs";
import { AdminEmptyState, AdminLoadingState } from "@/components/admin/ui/AdminEmptyState";
import { AdminWorkspace } from "@/components/admin/workspace/AdminWorkspace";
import { AdminCompactKpiStrip } from "@/components/admin/workspace/AdminCompactKpiStrip";

type AutomationJob = { key: string; label: string; schedule: string; path: string; lastRunAt: string | null };
type Overview = {
  qaFindings: Array<{ id: string; title: string; module: string | null; severity: string }>;
  recentFailures: Array<{ id: string; action_type: string; title: string | null; summary: string | null; created_at: string }>;
  testRuns: Array<{ id: string; score: number; status: string; error_count: number; warning_count: number; created_at: string }>;
  automation: AutomationJob[];
};

const tabs = ["canli-testler", "qa-dogrulama", "log-hata", "otomasyon", "ai-bug-ozeti"] as const;
type Tab = typeof tabs[number];
const tabLabels: Record<Tab, string> = {
  "canli-testler": "Canlı Testler",
  "qa-dogrulama": "QA & Doğrulama",
  "log-hata": "Log & Hata Takibi",
  otomasyon: "Otomasyon Durumu",
  "ai-bug-ozeti": "AI Bug Özeti"
};

function severityTone(severity: string): AdminStatusTone {
  if (severity === "critical" || severity === "Kritik") return "danger";
  if (severity === "warning" || severity === "Uyarı") return "warning";
  return "info";
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) throw new Error(payload?.error || "İstek başarısız oldu.");
  return payload as T;
}

export function OperationalQualityCenter() {
  const [tab, setTab] = useState<Tab>("canli-testler");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState<{ summary: string; severity: string } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  function load() {
    setLoading(true);
    fetchJson<Overview>("/api/admin/operational-quality/overview")
      .then(setOverview)
      .catch(() => setOverview(null))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function generateAiSummary() {
    setAiLoading(true);
    fetchJson<{ summary: string; severity: string }>("/api/admin/operational-quality/ai-summary", { method: "POST" })
      .then(setAiSummary)
      .catch((error) => setAiSummary({ summary: error instanceof Error ? error.message : "Özet oluşturulamadı.", severity: "unknown" }))
      .finally(() => setAiLoading(false));
  }

  const latestTestRun = overview?.testRuns[0];

  return (
    <AdminWorkspace
      title="Operasyonel Kalite Merkezi"
      eyebrow="QA Merkezi + Sistem Test Merkezi birleşik görünümü"
      description="Canlı sağlık durumu, QA bulguları, hata logları, otomasyon durumu ve AI destekli hata özeti tek yerde."
      headerActions={<AdminButton variant="secondary" icon={<RefreshCw size={14} />} onClick={load} loading={loading}>Yenile</AdminButton>}
    >
      <AdminCompactKpiStrip items={[
        { key: "qa", label: "Açık QA Bulgusu", value: overview?.qaFindings.length ?? "—", icon: <ClipboardList size={16} />, tone: (overview?.qaFindings.length || 0) > 0 ? "warning" : "success" },
        { key: "failures", label: "Başarısız İşlem", value: overview?.recentFailures.length ?? "—", icon: <XCircle size={16} />, tone: (overview?.recentFailures.length || 0) > 0 ? "danger" : "success" },
        { key: "test", label: "Son Test Skoru", value: latestTestRun ? `${latestTestRun.score}/100` : "—", icon: <CheckCircle2 size={16} />, tone: latestTestRun && latestTestRun.score >= 80 ? "success" : "warning" },
        { key: "automation", label: "Aktif Otomasyon", value: overview?.automation.length ?? "—", icon: <Activity size={16} />, tone: "info" }
      ]} />

      <AdminTabs items={tabs.map((key) => tabLabels[key])} active={tabLabels[tab]} onChange={(label) => setTab((Object.keys(tabLabels) as Tab[]).find((key) => tabLabels[key] === label) || "canli-testler")} />

      {loading ? <AdminLoadingState /> : !overview ? <AdminEmptyState title="Veri yüklenemedi" /> : (
        <>
          {tab === "canli-testler" && (
            <div className="grid gap-3">
              <p className="text-sm opacity-70">Detaylı manuel test checklist&apos;i için Sistem Test Merkezi&apos;ni kullanın.</p>
              {overview.testRuns.map((run) => (
                <div key={run.id} className="admin-card flex items-center justify-between rounded-[14px] p-4">
                  <div><p className="font-black">{new Date(run.created_at).toLocaleString("tr-TR")}</p><p className="text-xs opacity-70">{run.error_count} hata · {run.warning_count} uyarı</p></div>
                  <AdminStatusBadge tone={run.score >= 80 ? "success" : run.score >= 50 ? "warning" : "danger"}>{run.score}/100</AdminStatusBadge>
                </div>
              ))}
              {!overview.testRuns.length && <AdminEmptyState title="Henüz test kaydı yok" />}
            </div>
          )}

          {tab === "qa-dogrulama" && (
            <div className="grid gap-3">
              <Link href="/hk-admin/qa-center" className="admin-card flex items-center justify-between rounded-[14px] p-4 transition hover:-translate-y-0.5"><span>QA Merkezi&apos;nde tüm bulguları ve API/migration denetimini görüntüle</span></Link>
              {overview.qaFindings.map((finding) => (
                <div key={finding.id} className="admin-card rounded-[14px] p-4">
                  <div className="flex items-center justify-between gap-3"><p className="font-black">{finding.title}</p><AdminStatusBadge tone={severityTone(finding.severity)}>{finding.severity}</AdminStatusBadge></div>
                  {finding.module && <p className="mt-1 text-xs opacity-70">{finding.module}</p>}
                </div>
              ))}
              {!overview.qaFindings.length && <AdminEmptyState title="Açık QA bulgusu yok" />}
            </div>
          )}

          {tab === "log-hata" && (
            <div className="grid gap-3">
              {overview.recentFailures.map((failure) => (
                <div key={failure.id} className="admin-card rounded-[14px] p-4">
                  <div className="flex items-center justify-between gap-3"><p className="font-black">{failure.title || failure.action_type}</p><span className="text-xs opacity-60">{new Date(failure.created_at).toLocaleString("tr-TR")}</span></div>
                  {failure.summary && <p className="mt-1 text-xs opacity-70">{failure.summary}</p>}
                </div>
              ))}
              {!overview.recentFailures.length && <AdminEmptyState title="Başarısız işlem kaydı yok" />}
            </div>
          )}

          {tab === "otomasyon" && (
            <div className="grid gap-3">
              {overview.automation.map((job) => (
                <div key={job.key} className="admin-card flex items-center justify-between rounded-[14px] p-4">
                  <div><p className="font-black">{job.label}</p><p className="text-xs opacity-70">{job.schedule} · {job.path}</p></div>
                  <AdminStatusBadge tone={job.lastRunAt ? "success" : "neutral"}>{job.lastRunAt ? new Date(job.lastRunAt).toLocaleString("tr-TR") : "Henüz çalışmadı"}</AdminStatusBadge>
                </div>
              ))}
            </div>
          )}

          {tab === "ai-bug-ozeti" && (
            <div className="admin-card grid gap-3 rounded-[16px] p-5">
              <AdminButton variant="ai" icon={<Bot size={14} />} loading={aiLoading} onClick={generateAiSummary}>Son 24 Saati Özetle</AdminButton>
              {aiSummary && (
                <div className="mt-2 rounded-[14px] bg-[var(--admin-surface-soft,#f8fafc)] p-4">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide opacity-60"><AlertTriangle size={14} /> {aiSummary.severity}</div>
                  <p className="mt-2 whitespace-pre-line text-sm leading-6">{aiSummary.summary}</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </AdminWorkspace>
  );
}
