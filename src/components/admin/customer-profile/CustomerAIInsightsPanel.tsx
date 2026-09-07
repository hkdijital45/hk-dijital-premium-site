"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import { useEffect, useState } from "react";
import { sendToTeamActionPresets, type SendToTeamActionKey } from "@/lib/ai-workforce-schema";

type Recommendation = { id: string; title: string; recommendation_type?: string; expected_impact?: string; status: string };
type RiskEvent = { id: string; title: string; severity: string; status: string };
type Memory = { id: string; title: string; content: string };
type ReportRow = { id: string; report_type: string; created_at: string };
type RunRow = { id: string; agent_key?: string; task_type?: string; status?: string; completed_at?: string };

// Read-only "AI İçgörüleri (AI Insights)" tab for the Customer 360 profile —
// surfaces existing HK Intelligence / Agent Hub data for this one company,
// plus a real "Send to AI Team" action that creates a genuine agent run.
export function CustomerAIInsightsPanel({ companyId }: { companyId: string }) {
  const [data, setData] = useState<{ recommendations: Recommendation[]; risks: RiskEvent[]; memories: Memory[]; reports: ReportRow[]; recentRuns: RunRow[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<SendToTeamActionKey | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/customers/${companyId}/ai-insights`)
      .then((res) => res.json())
      .then((body) => { if (!cancelled) setData(body); })
      .catch(() => null)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [companyId]);

  const sendToTeam = async (action: SendToTeamActionKey) => {
    setSending(action);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/customers/${companyId}/send-to-ai-team`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      const body = await res.json();
      setMessage(res.ok ? (body.finalReport?.executiveSummary || `Görev tamamlandı: ${body.status}`) : (body.error || "Hata oluştu."));
    } catch {
      setMessage("Hata oluştu.");
    } finally {
      setSending(null);
    }
  };

  if (loading) return <p className="mt-5 text-sm" style={{ color: "var(--admin-text-muted)" }}>AI içgörüleri yükleniyor...</p>;
  if (!data) return <p className="mt-5 text-sm" style={{ color: "var(--admin-text-muted)" }}>AI içgörüleri alınamadı.</p>;

  return (
    <div className="mt-5 grid gap-4">
      <section className="rounded-[16px] border p-4" style={{ borderColor: "var(--admin-border)" }}>
        <h3 className="font-black" style={{ color: "var(--admin-text-primary)" }}>Send to AI Team (Yapay Zekâ Ekibine Gönder)</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(sendToTeamActionPresets) as SendToTeamActionKey[]).map((key) => (
            <button
              key={key}
              type="button"
              disabled={sending !== null}
              onClick={() => sendToTeam(key)}
              className="hk-button hk-button-outline px-3 py-2 text-xs disabled:opacity-50"
            >
              {sending === key ? "Çalışıyor..." : sendToTeamActionPresets[key].label}
            </button>
          ))}
        </div>
        {message && <p className="mt-3 rounded-[10px] border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-900">{message}</p>}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-[16px] border p-4" style={{ borderColor: "var(--admin-border)" }}>
          <h3 className="font-black" style={{ color: "var(--admin-text-primary)" }}>Recommendations (Öneriler)</h3>
          <div className="mt-2 grid gap-2">
            {data.recommendations.length ? data.recommendations.map((item) => (
              <div key={item.id} className="rounded-[10px] bg-[var(--admin-surface-soft)] p-2 text-xs"><strong>{item.title}</strong> — {item.status}</div>
            )) : <p className="text-xs" style={{ color: "var(--admin-text-muted)" }}>Öneri yok.</p>}
          </div>
        </section>
        <section className="rounded-[16px] border p-4" style={{ borderColor: "var(--admin-border)" }}>
          <h3 className="font-black" style={{ color: "var(--admin-text-primary)" }}>Risks (Riskler)</h3>
          <div className="mt-2 grid gap-2">
            {data.risks.length ? data.risks.map((item) => (
              <div key={item.id} className="rounded-[10px] bg-[var(--admin-surface-soft)] p-2 text-xs"><strong>{item.title}</strong> — {item.severity} · {item.status}</div>
            )) : <p className="text-xs" style={{ color: "var(--admin-text-muted)" }}>Risk kaydı yok.</p>}
          </div>
        </section>
        <section className="rounded-[16px] border p-4" style={{ borderColor: "var(--admin-border)" }}>
          <h3 className="font-black" style={{ color: "var(--admin-text-primary)" }}>Memory (Hafıza)</h3>
          <div className="mt-2 grid gap-2">
            {data.memories.length ? data.memories.map((item) => (
              <div key={item.id} className="rounded-[10px] bg-[var(--admin-surface-soft)] p-2 text-xs"><strong>{item.title}</strong><p className="mt-1">{item.content.slice(0, 160)}</p></div>
            )) : <p className="text-xs" style={{ color: "var(--admin-text-muted)" }}>Hafıza kaydı yok.</p>}
          </div>
        </section>
        <section className="rounded-[16px] border p-4" style={{ borderColor: "var(--admin-border)" }}>
          <h3 className="font-black" style={{ color: "var(--admin-text-primary)" }}>Recent Agent Runs (Son Ajan Çalıştırmaları)</h3>
          <div className="mt-2 grid gap-2">
            {data.recentRuns.length ? data.recentRuns.map((item) => (
              <div key={item.id} className="rounded-[10px] bg-[var(--admin-surface-soft)] p-2 text-xs"><strong>{item.agent_key || item.task_type}</strong> — {item.status}</div>
            )) : <p className="text-xs" style={{ color: "var(--admin-text-muted)" }}>Çalıştırma yok.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
