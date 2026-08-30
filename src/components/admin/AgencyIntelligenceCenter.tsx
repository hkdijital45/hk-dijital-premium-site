"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, RefreshCw, Search, XCircle } from "lucide-react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminStatusBadge, type AdminStatusTone } from "@/components/admin/ui/AdminStatusBadge";
import { AdminTabs } from "@/components/admin/ui/AdminTabs";
import { AdminLoadingState } from "@/components/admin/ui/AdminEmptyState";
import { AdminWorkspace } from "@/components/admin/workspace/AdminWorkspace";
import { AdminDataGrid, type AdminDataGridColumn } from "@/components/admin/workspace/AdminDataGrid";

type GeoObservation = { id: string; query: string; platform: string; brand_mentioned: boolean; observed_at: string; notes: string | null };
type Forecast = { id: string; scenario: string; period_months: number; projected_revenue: number; projected_expenses: number; projected_net: number; generated_at: string };
type UpsellRow = { id: string; company_id: string; trigger_type: string; recommended_service: string; estimated_value: number; probability: number; ai_pitch: string | null; status: string; companies?: { name: string } };

const tabs = ["geo", "cashflow", "upsell"] as const;
type Tab = typeof tabs[number];
const tabLabels: Record<Tab, string> = { geo: "GEO Görünürlük", cashflow: "Nakit Akışı Tahmini", upsell: "Upsell Fırsatları" };

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) throw new Error(payload?.error || "İstek başarısız oldu.");
  return payload as T;
}

export function AgencyIntelligenceCenter() {
  const [tab, setTab] = useState<Tab>("geo");
  const [observations, setObservations] = useState<GeoObservation[]>([]);
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [upsells, setUpsells] = useState<UpsellRow[]>([]);
  const [executiveSummary, setExecutiveSummary] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [feedback, setFeedback] = useState("");
  const [geoQuery, setGeoQuery] = useState("");
  const [geoMentioned, setGeoMentioned] = useState(false);
  const [geoPlatform, setGeoPlatform] = useState("chatgpt");

  function loadAll() {
    setLoading(true);
    Promise.all([
      fetchJson<{ observations: GeoObservation[] }>("/api/admin/geo-visibility").then((data) => setObservations(data.observations || [])).catch(() => setObservations([])),
      fetchJson<{ forecasts: Forecast[] }>("/api/admin/cash-flow/forecast").then((data) => setForecasts(data.forecasts || [])).catch(() => setForecasts([])),
      fetchJson<{ opportunities: UpsellRow[] }>("/api/admin/upsell").then((data) => setUpsells(data.opportunities || [])).catch(() => setUpsells([]))
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

  function logGeoObservation() {
    if (!geoQuery.trim()) {
      setFeedback("Sorgu metni girin.");
      return;
    }
    run("geo-log", () => fetchJson("/api/admin/geo-visibility", { method: "POST", body: JSON.stringify({ query: geoQuery, platform: geoPlatform, brandMentioned: geoMentioned }) }), "Gözlem kaydedildi.").then(() => {
      setGeoQuery("");
      setGeoMentioned(false);
    });
  }

  function generateForecast() {
    run("forecast", async () => {
      const data = await fetchJson<{ executiveSummary: string }>("/api/admin/cash-flow/forecast", { method: "POST", body: JSON.stringify({ periodMonths: 3 }) });
      setExecutiveSummary(data.executiveSummary);
    }, "3 aylık tahmin oluşturuldu.");
  }

  const geoColumns: AdminDataGridColumn<GeoObservation>[] = [
    { key: "query", header: "Sorgu", render: (row) => row.query },
    { key: "platform", header: "Platform", render: (row) => row.platform },
    { key: "mentioned", header: "Marka Geçti mi?", render: (row) => <AdminStatusBadge tone={row.brand_mentioned ? "success" : "neutral"}>{row.brand_mentioned ? "Evet" : "Hayır"}</AdminStatusBadge> },
    { key: "observed", header: "Tarih", render: (row) => new Date(row.observed_at).toLocaleDateString("tr-TR") }
  ];

  const forecastColumns: AdminDataGridColumn<Forecast>[] = [
    { key: "scenario", header: "Senaryo", render: (row) => row.scenario },
    { key: "revenue", header: "Öngörülen Gelir", render: (row) => `${row.projected_revenue.toLocaleString("tr-TR")} TL` },
    { key: "expenses", header: "Öngörülen Gider", render: (row) => `${row.projected_expenses.toLocaleString("tr-TR")} TL` },
    { key: "net", header: "Net", render: (row) => <span className={row.projected_net >= 0 ? "text-emerald-600" : "text-red-600"}>{row.projected_net.toLocaleString("tr-TR")} TL</span> },
    { key: "generated", header: "Oluşturuldu", render: (row) => new Date(row.generated_at).toLocaleDateString("tr-TR") }
  ];

  const upsellColumns: AdminDataGridColumn<UpsellRow>[] = [
    { key: "company", header: "Müşteri", render: (row) => row.companies?.name || row.company_id },
    { key: "service", header: "Önerilen Hizmet", render: (row) => <div><p className="font-black">{row.recommended_service}</p><p className="text-xs opacity-70">{row.ai_pitch}</p></div> },
    { key: "value", header: "Tahmini Değer", render: (row) => `${row.estimated_value.toLocaleString("tr-TR")} TL` },
    { key: "probability", header: "Olasılık", render: (row) => `%${row.probability}` },
    { key: "status", header: "Durum", render: (row) => <AdminStatusBadge tone={row.status === "approved" ? "success" as AdminStatusTone : row.status === "dismissed" ? "danger" : "info"}>{row.status}</AdminStatusBadge> },
    {
      key: "actions", header: "", align: "right", render: (row) => row.status === "new" ? (
        <div className="flex justify-end gap-2">
          <AdminButton compact variant="success" icon={<CheckCircle2 size={14} />} loading={busy === `up-approve-${row.id}`} onClick={() => run(`up-approve-${row.id}`, () => fetchJson("/api/admin/upsell", { method: "PATCH", body: JSON.stringify({ id: row.id, status: "approved" }) }), "Fırsat onaylandı.")}>Onayla</AdminButton>
          <AdminButton compact variant="ghost" icon={<XCircle size={14} />} loading={busy === `up-dismiss-${row.id}`} onClick={() => run(`up-dismiss-${row.id}`, () => fetchJson("/api/admin/upsell", { method: "PATCH", body: JSON.stringify({ id: row.id, status: "dismissed" }) }), "Fırsat reddedildi.")}>Yok Say</AdminButton>
        </div>
      ) : null
    }
  ];

  return (
    <AdminWorkspace
      title="HK Ajans Zekası"
      eyebrow="GEO Görünürlük · Nakit Akışı · Upsell"
      description="Deterministik hesaplamalar önce yapılır; AI yalnızca yorum ve öneri metni üretir."
      headerActions={
        <>
          {tab === "cashflow" && <AdminButton variant="primary" icon={<RefreshCw size={14} />} loading={busy === "forecast"} onClick={generateForecast}>Tahmini Yenile</AdminButton>}
          {tab === "upsell" && <AdminButton variant="secondary" icon={<RefreshCw size={14} />} loading={busy === "run-upsell"} onClick={() => run("run-upsell", () => fetchJson("/api/admin/upsell/run-daily", { method: "POST" }), "Fırsatlar tarandı.")}>Fırsatları Tara</AdminButton>}
        </>
      }
    >
      {feedback && <div className="admin-card-soft mb-4 rounded-[12px] p-3 text-sm font-bold">{feedback}</div>}
      <AdminTabs items={tabs.map((key) => tabLabels[key])} active={tabLabels[tab]} onChange={(label) => setTab((Object.keys(tabLabels) as Tab[]).find((key) => tabLabels[key] === label) || "geo")} />

      {loading ? <AdminLoadingState /> : (
        <>
          {tab === "geo" && (
            <div className="grid gap-4">
              <div className="admin-card flex flex-wrap items-end gap-3 rounded-[14px] p-4">
                <div className="min-w-[240px] flex-1">
                  <label className="text-xs font-black uppercase tracking-wide opacity-60">Sorgu</label>
                  <input value={geoQuery} onChange={(event) => setGeoQuery(event.target.value)} placeholder="ör. Manisa dijital pazarlama ajansı" className="mt-1 w-full rounded-[10px] px-3 py-2 text-sm font-bold outline-none" style={{ border: "1px solid var(--admin-border)", background: "var(--admin-surface)", color: "var(--admin-text-primary)" }} />
                </div>
                <select value={geoPlatform} onChange={(event) => setGeoPlatform(event.target.value)} className="rounded-[10px] px-3 py-2 text-sm font-bold" style={{ border: "1px solid var(--admin-border)", background: "var(--admin-surface)", color: "var(--admin-text-primary)" }}>
                  <option value="chatgpt">ChatGPT</option>
                  <option value="perplexity">Perplexity</option>
                  <option value="gemini">Gemini</option>
                  <option value="manual">Diğer</option>
                </select>
                <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={geoMentioned} onChange={(event) => setGeoMentioned(event.target.checked)} /> Marka geçti</label>
                <AdminButton variant="primary" icon={<Search size={14} />} loading={busy === "geo-log"} onClick={logGeoObservation}>Kaydet</AdminButton>
              </div>
              <p className="text-xs opacity-60">Manuel gözlem kaydıdır — ChatGPT/Perplexity gibi platformlar için resmi bir görünürlük API&apos;si bulunmadığından, ekip bir sorguyu kendisi kontrol ettiğinde burada kaydeder.</p>
              <AdminDataGrid columns={geoColumns} rows={observations} rowKey={(row) => row.id} emptyTitle="Gözlem yok" />
            </div>
          )}
          {tab === "cashflow" && (
            <div className="grid gap-4">
              {executiveSummary && <div className="admin-card rounded-[14px] p-4 text-sm">{executiveSummary}</div>}
              <AdminDataGrid columns={forecastColumns} rows={forecasts} rowKey={(row) => row.id} emptyTitle="Tahmin yok" emptyDescription="Tahmini Yenile ile ilk tahmini oluşturun." />
            </div>
          )}
          {tab === "upsell" && <AdminDataGrid columns={upsellColumns} rows={upsells} rowKey={(row) => row.id} emptyTitle="Upsell fırsatı yok" emptyDescription="Fırsatları Tara ile tespit başlatın." />}
        </>
      )}
    </AdminWorkspace>
  );
}
