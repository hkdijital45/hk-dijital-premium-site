"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, RefreshCw, ShieldAlert, XCircle } from "lucide-react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminStatusBadge, type AdminStatusTone } from "@/components/admin/ui/AdminStatusBadge";
import { AdminTabs } from "@/components/admin/ui/AdminTabs";
import { AdminLoadingState } from "@/components/admin/ui/AdminEmptyState";
import { AdminWorkspace } from "@/components/admin/workspace/AdminWorkspace";
import { AdminDataGrid, type AdminDataGridColumn } from "@/components/admin/workspace/AdminDataGrid";

type RiskRow = { id: string; company_id: string; score: number; risk_level: string; trend: string; calculated_at: string; companies?: { name: string } };
type SuggestionRow = { id: string; company_id: string; platform: string; issue_type: string; suggested_action: string; ai_reasoning: string | null; confidence: number; risk_level: string; status: string; generated_at: string; companies?: { name: string } };
type SeoJobRow = { id: string; query: string; url: string; trigger_type: string; position_before: number | null; position_after: number | null; ai_brief: string | null; status: string; triggered_at: string };

const tabs = ["risk", "ads", "seo"] as const;
type Tab = typeof tabs[number];
const tabLabels: Record<Tab, string> = { risk: "Müşteri Riski", ads: "Reklam Optimizasyonu", seo: "SEO Autopilot" };

function riskTone(level: string): AdminStatusTone {
  if (level === "critical" || level === "high") return "danger";
  if (level === "risky" || level === "medium") return "warning";
  if (level === "attention") return "info";
  return "success";
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) throw new Error(payload?.error || "İstek başarısız oldu.");
  return payload as T;
}

export function AutonomousOpsCenter() {
  const [tab, setTab] = useState<Tab>("risk");
  const [risks, setRisks] = useState<RiskRow[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestionRow[]>([]);
  const [seoJobs, setSeoJobs] = useState<SeoJobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [feedback, setFeedback] = useState("");

  function loadAll() {
    setLoading(true);
    Promise.all([
      fetchJson<{ scores: RiskRow[] }>("/api/admin/customer-risk").then((data) => setRisks(data.scores || [])).catch(() => setRisks([])),
      fetchJson<{ suggestions: SuggestionRow[] }>("/api/admin/ad-optimization/suggestions").then((data) => setSuggestions(data.suggestions || [])).catch(() => setSuggestions([])),
      fetchJson<{ jobs: SeoJobRow[] }>("/api/admin/seo-autopilot/jobs").then((data) => setSeoJobs(data.jobs || [])).catch(() => setSeoJobs([]))
    ]).finally(() => setLoading(false));
  }

  useEffect(() => {
    const timer = window.setTimeout(loadAll, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function run(key: string, action: () => Promise<unknown>, message: string) {
    setBusy(key);
    setFeedback("");
    try {
      await action();
      setFeedback(message);
      loadAll();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "İşlem başarısız oldu.");
    } finally {
      setBusy("");
    }
  }

  const riskColumns: AdminDataGridColumn<RiskRow>[] = [
    { key: "company", header: "Müşteri", render: (row) => row.companies?.name || row.company_id },
    { key: "score", header: "Risk Skoru", render: (row) => <AdminStatusBadge tone={riskTone(row.risk_level)}>{row.score}/100</AdminStatusBadge> },
    { key: "trend", header: "Trend", render: (row) => row.trend },
    { key: "calculated", header: "Hesaplandı", render: (row) => new Date(row.calculated_at).toLocaleDateString("tr-TR") }
  ];

  const adColumns: AdminDataGridColumn<SuggestionRow>[] = [
    { key: "company", header: "Müşteri", render: (row) => row.companies?.name || row.company_id },
    { key: "issue", header: "Sorun", render: (row) => <div><p className="font-black">{row.issue_type}</p><p className="text-xs opacity-70">{row.suggested_action}</p></div> },
    { key: "confidence", header: "Güven", render: (row) => `${row.confidence}/100` },
    { key: "risk", header: "Risk", render: (row) => <AdminStatusBadge tone={riskTone(row.risk_level)}>{row.risk_level}</AdminStatusBadge> },
    { key: "status", header: "Durum", render: (row) => <AdminStatusBadge tone={row.status === "approved" ? "success" : row.status === "rejected" ? "danger" : "info"}>{row.status}</AdminStatusBadge> },
    {
      key: "actions", header: "", align: "right", render: (row) => row.status === "pending" ? (
        <div className="flex justify-end gap-2">
          <AdminButton compact variant="success" icon={<CheckCircle2 size={14} />} loading={busy === `approve-${row.id}`} onClick={() => run(`approve-${row.id}`, () => fetchJson(`/api/admin/ad-optimization/suggestions/${row.id}`, { method: "PATCH", body: JSON.stringify({ status: "approved" }) }), "Öneri onaylandı.")}>Onayla</AdminButton>
          <AdminButton compact variant="ghost" icon={<XCircle size={14} />} loading={busy === `reject-${row.id}`} onClick={() => run(`reject-${row.id}`, () => fetchJson(`/api/admin/ad-optimization/suggestions/${row.id}`, { method: "PATCH", body: JSON.stringify({ status: "rejected" }) }), "Öneri reddedildi.")}>Reddet</AdminButton>
        </div>
      ) : row.status === "approved" ? (
        <AdminButton compact variant="secondary" loading={busy === `apply-${row.id}`} onClick={() => run(`apply-${row.id}`, () => fetchJson(`/api/admin/ad-optimization/suggestions/${row.id}/apply`, { method: "POST" }), "Uygulama denendi — bkz. mesaj.")}>Uygula</AdminButton>
      ) : null
    }
  ];

  const seoColumns: AdminDataGridColumn<SeoJobRow>[] = [
    { key: "query", header: "Sorgu", render: (row) => <div><p className="font-black">{row.query}</p><p className="text-xs opacity-70">{row.url}</p></div> },
    { key: "trigger", header: "Tetikleyici", render: (row) => row.trigger_type },
    { key: "position", header: "Pozisyon", render: (row) => row.position_before && row.position_after ? `${row.position_before.toFixed(1)} → ${row.position_after.toFixed(1)}` : "—" },
    { key: "status", header: "Durum", render: (row) => <AdminStatusBadge tone={row.status === "published" ? "success" : row.status === "rejected" ? "danger" : "info"}>{row.status}</AdminStatusBadge> },
    {
      key: "actions", header: "", align: "right", render: (row) => row.status === "detected" || row.status === "draft_ready" || row.status === "awaiting_approval" ? (
        <div className="flex justify-end gap-2">
          <AdminButton compact variant="success" loading={busy === `seo-approve-${row.id}`} onClick={() => run(`seo-approve-${row.id}`, () => fetchJson(`/api/admin/seo-autopilot/jobs/${row.id}`, { method: "PATCH", body: JSON.stringify({ status: "approved" }) }), "İş onaylandı.")}>Onayla</AdminButton>
          <AdminButton compact variant="ghost" loading={busy === `seo-reject-${row.id}`} onClick={() => run(`seo-reject-${row.id}`, () => fetchJson(`/api/admin/seo-autopilot/jobs/${row.id}`, { method: "PATCH", body: JSON.stringify({ status: "rejected" }) }), "İş reddedildi.")}>Reddet</AdminButton>
        </div>
      ) : null
    }
  ];

  const criticalRiskCount = useMemo(() => risks.filter((row) => row.risk_level === "critical" || row.risk_level === "risky").length, [risks]);

  return (
    <AdminWorkspace
      title="Otonom Operasyonlar"
      eyebrow="Customer Risk · Ad Optimizer · SEO Autopilot"
      description="AI önerileri her zaman insan onayından geçer — AUTO_APPLY_AD_CHANGES varsayılan olarak kapalıdır."
      headerActions={
        <>
          {tab === "risk" && <AdminButton variant="secondary" icon={<RefreshCw size={14} />} loading={busy === "run-risk"} onClick={() => run("run-risk", () => fetchJson("/api/admin/customer-risk/run-daily", { method: "POST" }), "Risk skorları güncellendi.")}>Şimdi Hesapla</AdminButton>}
          {tab === "ads" && <AdminButton variant="secondary" icon={<RefreshCw size={14} />} loading={busy === "run-ads"} onClick={() => run("run-ads", () => fetchJson("/api/admin/ad-optimization/run-daily", { method: "POST" }), "Öneriler güncellendi.")}>Öneri Üret</AdminButton>}
          {tab === "seo" && <AdminButton variant="secondary" icon={<RefreshCw size={14} />} loading={busy === "run-seo"} onClick={() => run("run-seo", () => fetchJson("/api/admin/seo-autopilot/run-daily", { method: "POST" }), "Gerileme taraması tamamlandı.")}>Taramayı Çalıştır</AdminButton>}
        </>
      }
    >
      {feedback && <div className="admin-card-soft mb-4 rounded-[12px] p-3 text-sm font-bold">{feedback}</div>}
      {criticalRiskCount > 0 && tab !== "risk" && (
        <div className="mb-4 flex items-center gap-2 rounded-[12px] bg-red-50 p-3 text-sm font-bold text-red-700"><ShieldAlert size={16} /> {criticalRiskCount} müşteri riskli/kritik seviyede — Müşteri Riski sekmesine bakın.</div>
      )}

      <AdminTabs items={tabs.map((key) => tabLabels[key])} active={tabLabels[tab]} onChange={(label) => setTab((Object.keys(tabLabels) as Tab[]).find((key) => tabLabels[key] === label) || "risk")} />

      {loading ? <AdminLoadingState /> : (
        <>
          {tab === "risk" && <AdminDataGrid columns={riskColumns} rows={risks} rowKey={(row) => row.id} emptyTitle="Risk skoru yok" emptyDescription="Şimdi Hesapla ile ilk skorlamayı çalıştırın." />}
          {tab === "ads" && <AdminDataGrid columns={adColumns} rows={suggestions} rowKey={(row) => row.id} emptyTitle="Öneri yok" emptyDescription="Öneri Üret ile Reklam Doktoru Pro'nun son teşhislerinden öneri oluşturun." />}
          {tab === "seo" && <AdminDataGrid columns={seoColumns} rows={seoJobs} rowKey={(row) => row.id} emptyTitle="Gerileme tespit edilmedi" emptyDescription="Taramayı Çalıştır ile Search Console verisini kontrol edin." />}
        </>
      )}
    </AdminWorkspace>
  );
}
