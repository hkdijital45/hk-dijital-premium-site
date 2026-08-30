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
type HealthRow = { id: string; company_id: string; score: number; health_level: string; trend: string; calculated_at: string; companies?: { name: string } };
type CapacityRow = { id: string; userId: string; name: string; weeklyHours: number; allocatedHours: number; remainingHours: number; utilizationPercent: number; taskCount: number; overloaded: boolean };
type PricingRow = { id: string; selected_services: Array<{ title: string; price: number }>; recommended_price: number; recommended_range_min: number; recommended_range_max: number; close_probability: number; ai_rationale: string; actual_outcome: string; created_at: string };
type ContractRow = { id: string; title: string; end_date: string; status: string; companies?: { name: string } };
type OutreachRow = { id: string; lead_id: string; channel: string; message_draft: string; status: string; created_at: string; leads?: { company: string } };

const tabs = ["risk", "ads", "seo", "health", "capacity", "pricing", "contracts", "outreach"] as const;
type Tab = typeof tabs[number];
const tabLabels: Record<Tab, string> = { risk: "Müşteri Riski", ads: "Reklam Optimizasyonu", seo: "SEO Autopilot", health: "Müşteri Sağlığı", capacity: "Kapasite", pricing: "Fiyatlandırma", contracts: "Sözleşmeler", outreach: "Lead İlk Temas" };

function healthTone(level: string): AdminStatusTone {
  if (level === "critical") return "danger";
  if (level === "at_risk") return "warning";
  if (level === "good") return "info";
  return "success";
}

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
  const [healthScores, setHealthScores] = useState<HealthRow[]>([]);
  const [capacity, setCapacity] = useState<CapacityRow[]>([]);
  const [pricingHistory, setPricingHistory] = useState<PricingRow[]>([]);
  const [pricingServices, setPricingServices] = useState("");
  const [pricingResult, setPricingResult] = useState<PricingRow | null>(null);
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [outreachDrafts, setOutreachDrafts] = useState<OutreachRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [feedback, setFeedback] = useState("");

  function loadAll() {
    setLoading(true);
    Promise.all([
      fetchJson<{ scores: RiskRow[] }>("/api/admin/customer-risk").then((data) => setRisks(data.scores || [])).catch(() => setRisks([])),
      fetchJson<{ suggestions: SuggestionRow[] }>("/api/admin/ad-optimization/suggestions").then((data) => setSuggestions(data.suggestions || [])).catch(() => setSuggestions([])),
      fetchJson<{ jobs: SeoJobRow[] }>("/api/admin/seo-autopilot/jobs").then((data) => setSeoJobs(data.jobs || [])).catch(() => setSeoJobs([])),
      fetchJson<{ scores: HealthRow[] }>("/api/admin/customer-health").then((data) => setHealthScores(data.scores || [])).catch(() => setHealthScores([])),
      fetchJson<{ board: Array<Omit<CapacityRow, "id">> }>("/api/admin/capacity/board").then((data) => setCapacity((data.board || []).map((row) => ({ ...row, id: row.userId })))).catch(() => setCapacity([])),
      fetchJson<{ recommendations: PricingRow[] }>("/api/admin/pricing/recommend").then((data) => setPricingHistory(data.recommendations || [])).catch(() => setPricingHistory([])),
      fetchJson<{ contracts: ContractRow[] }>("/api/admin/contracts").then((data) => setContracts(data.contracts || [])).catch(() => setContracts([])),
      fetchJson<{ drafts: OutreachRow[] }>("/api/admin/outreach/drafts").then((data) => setOutreachDrafts(data.drafts || [])).catch(() => setOutreachDrafts([]))
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

  const healthColumns: AdminDataGridColumn<HealthRow>[] = [
    { key: "company", header: "Müşteri", render: (row) => row.companies?.name || row.company_id },
    { key: "score", header: "Sağlık Skoru", render: (row) => <AdminStatusBadge tone={healthTone(row.health_level)}>{row.score}/100</AdminStatusBadge> },
    { key: "trend", header: "Trend", render: (row) => row.trend },
    { key: "calculated", header: "Hesaplandı", render: (row) => new Date(row.calculated_at).toLocaleDateString("tr-TR") }
  ];

  const capacityColumns: AdminDataGridColumn<CapacityRow>[] = [
    { key: "name", header: "Ekip Üyesi", render: (row) => row.name },
    { key: "allocated", header: "Ayrılan / Toplam Saat", render: (row) => `${row.allocatedHours}/${row.weeklyHours}` },
    { key: "remaining", header: "Kalan Saat", render: (row) => row.remainingHours },
    { key: "utilization", header: "Doluluk", render: (row) => <AdminStatusBadge tone={row.overloaded ? "danger" : row.utilizationPercent > 80 ? "warning" : "success"}>%{row.utilizationPercent}</AdminStatusBadge> },
    { key: "tasks", header: "Bu Hafta Görev", render: (row) => row.taskCount }
  ];

  const pricingColumns: AdminDataGridColumn<PricingRow>[] = [
    { key: "services", header: "Hizmetler", render: (row) => row.selected_services.map((service) => service.title).join(", ") },
    { key: "price", header: "Önerilen Fiyat", render: (row) => `${row.recommended_price.toLocaleString("tr-TR")} TL` },
    { key: "range", header: "Aralık", render: (row) => `${row.recommended_range_min.toLocaleString("tr-TR")} - ${row.recommended_range_max.toLocaleString("tr-TR")} TL` },
    { key: "close", header: "Kapanış Olasılığı", render: (row) => `%${row.close_probability}` },
    { key: "outcome", header: "Sonuç", render: (row) => <AdminStatusBadge tone={row.actual_outcome === "won" ? "success" : row.actual_outcome === "lost" ? "danger" : "neutral"}>{row.actual_outcome}</AdminStatusBadge> }
  ];

  const contractColumns: AdminDataGridColumn<ContractRow>[] = [
    { key: "company", header: "Müşteri", render: (row) => row.companies?.name || "" },
    { key: "title", header: "Sözleşme", render: (row) => row.title },
    { key: "end", header: "Bitiş", render: (row) => new Date(row.end_date).toLocaleDateString("tr-TR") },
    { key: "status", header: "Durum", render: (row) => <AdminStatusBadge tone={row.status === "expired" ? "danger" : row.status === "expiring" ? "warning" : "success"}>{row.status}</AdminStatusBadge> }
  ];

  const outreachColumns: AdminDataGridColumn<OutreachRow>[] = [
    { key: "lead", header: "Aday", render: (row) => row.leads?.company || row.lead_id },
    { key: "draft", header: "Taslak Mesaj", render: (row) => <span className="text-xs">{row.message_draft}</span> },
    { key: "status", header: "Durum", render: (row) => <AdminStatusBadge tone={row.status === "approved" ? "success" : row.status === "rejected" || row.status === "opted_out" ? "danger" : "info"}>{row.status}</AdminStatusBadge> },
    {
      key: "actions", header: "", align: "right", render: (row) => row.status === "draft" ? (
        <div className="flex justify-end gap-2">
          <AdminButton compact variant="success" loading={busy === `outreach-approve-${row.id}`} onClick={() => run(`outreach-approve-${row.id}`, () => fetchJson("/api/admin/outreach/drafts", { method: "PATCH", body: JSON.stringify({ id: row.id, status: "approved" }) }), "Taslak onaylandı.")}>Onayla</AdminButton>
          <AdminButton compact variant="ghost" loading={busy === `outreach-reject-${row.id}`} onClick={() => run(`outreach-reject-${row.id}`, () => fetchJson("/api/admin/outreach/drafts", { method: "PATCH", body: JSON.stringify({ id: row.id, status: "rejected" }) }), "Taslak reddedildi.")}>Reddet</AdminButton>
        </div>
      ) : row.status === "approved" ? (
        <AdminButton compact variant="secondary" loading={busy === `outreach-send-${row.id}`} onClick={() => run(`outreach-send-${row.id}`, () => fetchJson(`/api/admin/outreach/drafts/${row.id}/send`, { method: "POST" }), "Gönderim denendi — bkz. mesaj.")}>Gönder</AdminButton>
      ) : null
    }
  ];

  function generatePricing() {
    const slugs = pricingServices.split(",").map((item) => item.trim()).filter(Boolean);
    if (!slugs.length) {
      setFeedback("Paket slug'larını virgülle ayırarak girin (ör. meta-pro, google-ads-pro).");
      return;
    }
    run("pricing", async () => {
      const data = await fetchJson<{ recommendation: PricingRow }>("/api/admin/pricing/recommend", { method: "POST", body: JSON.stringify({ serviceSlugs: slugs }) });
      setPricingResult(data.recommendation);
    }, "Fiyat önerisi oluşturuldu.");
  }

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
          {tab === "health" && <AdminButton variant="secondary" icon={<RefreshCw size={14} />} loading={busy === "run-health"} onClick={() => run("run-health", () => fetchJson("/api/admin/customer-health/run-daily", { method: "POST" }), "Sağlık skorları güncellendi.")}>Şimdi Hesapla</AdminButton>}
          {tab === "contracts" && <AdminButton variant="secondary" icon={<RefreshCw size={14} />} loading={busy === "run-contracts"} onClick={() => run("run-contracts", () => fetchJson("/api/admin/contracts/run-daily", { method: "POST" }), "Sözleşme/SLA kontrolü tamamlandı.")}>Kontrolü Çalıştır</AdminButton>}
          {tab === "outreach" && <AdminButton variant="secondary" icon={<RefreshCw size={14} />} loading={busy === "run-outreach"} onClick={() => run("run-outreach", () => fetchJson("/api/admin/outreach/run-daily", { method: "POST" }), "Yeni taslaklar üretildi.")}>Taslak Üret</AdminButton>}
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
          {tab === "health" && <AdminDataGrid columns={healthColumns} rows={healthScores} rowKey={(row) => row.id} emptyTitle="Sağlık skoru yok" emptyDescription="Şimdi Hesapla ile ilk skorlamayı çalıştırın." />}
          {tab === "capacity" && <AdminDataGrid columns={capacityColumns} rows={capacity} rowKey={(row) => row.userId} emptyTitle="Kapasite profili yok" emptyDescription="Ekip üyeleri için haftalık kapasite tanımlanmadı." />}
          {tab === "pricing" && (
            <div className="grid gap-4">
              <div className="admin-card flex flex-wrap items-end gap-3 rounded-[14px] p-4">
                <div className="min-w-[280px] flex-1">
                  <label className="text-xs font-black uppercase tracking-wide opacity-60">Paket Slug&apos;ları (virgülle ayırın)</label>
                  <input value={pricingServices} onChange={(event) => setPricingServices(event.target.value)} placeholder="meta-pro, google-ads-pro" className="mt-1 w-full rounded-[10px] px-3 py-2 text-sm font-bold outline-none" style={{ border: "1px solid var(--admin-border)", background: "var(--admin-surface)", color: "var(--admin-text-primary)" }} />
                </div>
                <AdminButton variant="primary" loading={busy === "pricing"} onClick={generatePricing}>Fiyat Önerisi Oluştur</AdminButton>
              </div>
              {pricingResult && (
                <div className="admin-card rounded-[14px] p-4">
                  <p className="font-black">{pricingResult.recommended_price.toLocaleString("tr-TR")} TL <span className="text-xs opacity-60">(aralık: {pricingResult.recommended_range_min.toLocaleString("tr-TR")}-{pricingResult.recommended_range_max.toLocaleString("tr-TR")} TL, kapanış %{pricingResult.close_probability})</span></p>
                  <p className="mt-2 text-sm opacity-80">{pricingResult.ai_rationale}</p>
                </div>
              )}
              <AdminDataGrid columns={pricingColumns} rows={pricingHistory} rowKey={(row) => row.id} emptyTitle="Fiyat önerisi geçmişi yok" />
            </div>
          )}
          {tab === "contracts" && <AdminDataGrid columns={contractColumns} rows={contracts} rowKey={(row) => row.id} emptyTitle="Sözleşme yok" emptyDescription="Kontrolü Çalıştır ile yaklaşan yenileme ve SLA ihlallerini tarayın." />}
          {tab === "outreach" && (
            <div className="grid gap-3">
              <p className="text-xs opacity-60">AUTO_SEND_OUTREACH varsayılan olarak kapalıdır — taslaklar her zaman onay bekler.</p>
              <AdminDataGrid columns={outreachColumns} rows={outreachDrafts} rowKey={(row) => row.id} emptyTitle="Taslak yok" emptyDescription="Taslak Üret ile yüksek skorlu adaylardan ilk temas mesajı oluşturun." />
            </div>
          )}
        </>
      )}
    </AdminWorkspace>
  );
}
