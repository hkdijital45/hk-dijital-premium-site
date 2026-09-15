"use client";
/* eslint-disable react-hooks/set-state-in-effect -- fetch-on-mount pattern, same accepted precedent as src/components/admin/WebsiteAnalyticsCenter.tsx */

import { useEffect, useState } from "react";
import { BarChart3, ExternalLink } from "lucide-react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminStatusBadge, type AdminStatusTone } from "@/components/admin/ui/AdminStatusBadge";
import { AdminKpiCard } from "@/components/admin/ui/AdminKpiCard";

type AnalyticsProvider = "instagram" | "facebook" | "youtube" | "google_ads" | "google_business_profile";
const PROVIDER_LABELS: Record<AnalyticsProvider, string> = { instagram: "Instagram", facebook: "Facebook", youtube: "YouTube", google_ads: "Google Ads", google_business_profile: "Google Business Profile" };
const STATUS_TONE: Record<string, AdminStatusTone> = { connected: "success", not_connected: "neutral", token_expired: "warning", reauth_required: "warning", sync_error: "danger", no_data: "neutral" };

function unitFormat(value: number, unit: string): string {
  if (unit === "currency") return `${value.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL`;
  if (unit === "percent") return `${value.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}%`;
  return value.toLocaleString("tr-TR", { maximumFractionDigits: 0 });
}

// Lightweight, read-mostly summary — connected accounts + last-30-days
// headline KPIs, with a deep link to the full Analiz & Raporlama Merkezi
// for filtering/reporting. Reuses that module's own API routes rather than
// duplicating any fetching/aggregation logic here.
export function CustomerAnalyticsPanel({ company }: { company: { id: string; name?: string } }) {
  const [connections, setConnections] = useState<any[] | null>(null);
  const [tablesReady, setTablesReady] = useState<boolean | null>(null);
  const [kpis, setKpis] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!company?.id) return;
    setLoading(true);
    try {
      const statusResponse = await fetch(`/api/admin/analytics-center/status?companyId=${company.id}`);
      const statusData = await statusResponse.json();
      setTablesReady(statusData.tablesReady);
      setConnections(statusData.connections || []);
      if (statusData.tablesReady !== false) {
        const endDate = new Date().toISOString().slice(0, 10);
        const startDate = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
        const metricsResponse = await fetch(`/api/admin/analytics-center/metrics?companyId=${company.id}&startDate=${startDate}&endDate=${endDate}`);
        const metricsData = await metricsResponse.json();
        setKpis(metricsData.kpis || {});
      }
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [company?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const connectedCount = (connections || []).filter((c) => c.status === "connected").length;
  const headlineKpis = Object.values(kpis).flat().filter((k: any) => k.value !== null && k.capability === "supported").slice(0, 6);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black" style={{ color: "var(--admin-text-primary)" }}>Analiz Özeti (Son 30 Gün)</h3>
          {connections && <p className="mt-1 text-xs" style={{ color: "var(--admin-text-muted)" }}>{connectedCount}/{connections.length} platform bağlı</p>}
        </div>
        <a href="/hk-admin/analiz-raporlama" target="_blank" rel="noreferrer">
          <AdminButton compact variant="secondary"><ExternalLink size={14} /> Analiz Merkezinde Aç</AdminButton>
        </a>
      </div>

      {loading && <p className="text-sm" style={{ color: "var(--admin-text-muted)" }}>Yükleniyor...</p>}

      {!loading && tablesReady === false && (
        <p className="rounded-[8px] border border-dashed p-3 text-xs" style={{ borderColor: "var(--admin-border-strong)", color: "var(--admin-text-muted)" }}>
          Analiz Merkezi veritabanı tabloları henüz oluşturulmadı.
        </p>
      )}

      {!loading && tablesReady !== false && (
        <>
          <div className="flex flex-wrap gap-2">
            {(connections || []).map((c) => (
              <AdminStatusBadge key={c.provider} tone={STATUS_TONE[c.status] || "neutral"}>{PROVIDER_LABELS[c.provider as AnalyticsProvider]}: {c.statusLabel}</AdminStatusBadge>
            ))}
          </div>

          {headlineKpis.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {headlineKpis.map((kpi: any) => (
                <AdminKpiCard key={kpi.key} label={kpi.label} value={unitFormat(kpi.value, kpi.unit)} note={kpi.changePercent !== null ? `${kpi.changePercent >= 0 ? "↑" : "↓"} ${Math.abs(kpi.changePercent).toFixed(1)}%` : undefined} icon={<BarChart3 size={16} />} tone="primary" />
              ))}
            </div>
          ) : (
            <p className="rounded-[8px] border border-dashed p-3 text-xs" style={{ borderColor: "var(--admin-border-strong)", color: "var(--admin-text-muted)" }}>
              Henüz veri yok — hesap bağlı değil veya senkronizasyon yapılmadı. Detaylar için Analiz Merkezini açın.
            </p>
          )}
        </>
      )}
    </div>
  );
}
