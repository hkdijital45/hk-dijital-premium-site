"use client";
/* eslint-disable react-hooks/set-state-in-effect -- fetch-on-mount pattern, same accepted precedent as ContentPlanningCenter.tsx */

import { useEffect, useState } from "react";
import { Copy, RefreshCw, Sparkles } from "lucide-react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminStatusBadge } from "@/components/admin/ui/AdminStatusBadge";

type Company = { id: string; name: string };
type AdsStrategy = {
  dataSources: string[]; dataPeriod: { start: string; end: string }; confidence: string;
  assumptions?: string[]; dataGaps?: string[]; businessSummary: string;
  metaStrategy: { recommended: boolean; rationale: string; objective?: string; audience?: string; placements?: string; creative?: string; cta?: string; technicalGaps?: string[] };
  googleStrategy: { recommended: boolean; rationale: string; campaignTypes?: Array<{ type: string; rationale: string }> };
  budget: { hasHistoricalPerformance: boolean; meta?: { dailyMin: number; dailyMax: number; monthlyMin: number; monthlyMax: number }; google?: { dailyMin: number; dailyMax: number; monthlyMin: number; monthlyMax: number }; totalMonthlyRecommended: number; platformSplit: { meta: number; google: number }; rationale: string };
  kpis?: string[]; thirtyDayPlan: Array<{ phase: string; description: string }>; risks?: string[];
};
type Run = { id: string; created_at: string; final_report: { summary?: string; findings?: string[]; sources?: string[]; period_start?: string; period_end?: string; ads_strategy?: AdsStrategy } };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="content-plan-stat rounded-[14px] border p-4" style={{ borderColor: "var(--admin-border)" }}>
      <p className="mb-2 text-xs font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>{title}</p>
      {children}
    </div>
  );
}

export function AdsStrategyPanel({ companyId, companies }: { companyId: string; companies: Company[] }) {
  const [run, setRun] = useState<Run | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function load() {
    if (!companyId) return;
    setRun(undefined);
    setError(null);
    fetch(`/api/admin/ad-insights/ads-strategy?companyId=${companyId}`)
      .then((r) => r.json())
      .then((body) => setRun(body.run || null))
      .catch(() => setError("Yüklenemedi."));
  }

  useEffect(load, [companyId]);

  const companyName = companies.find((c) => c.id === companyId)?.name || "";
  const s = run?.final_report?.ads_strategy;

  async function copyCommand() {
    const text = `${companyName} için güncel Instagram, Facebook, Meta Ads ve Google Ads verilerini HK Dijital MCP üzerinden incele. Profesyonel reklam stratejisi ve bütçe planı oluştur ve sonucu HK Dijital'e kaydet.`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard denied — nothing to fall back to here */ }
  }

  if (!companyId) return <p className="text-sm font-bold" style={{ color: "var(--admin-text-muted)" }}>Bir müşteri seçin.</p>;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold" style={{ color: "var(--admin-text-secondary)" }}>Claude MCP ile oluşturulan reklam stratejisi — HK Admin yalnızca sonucu okur, analiz Claude tarafında yapılır.</p>
        <div className="flex gap-2">
          <AdminButton variant="secondary" compact icon={<RefreshCw size={14} />} onClick={load}>Yenile</AdminButton>
          <AdminButton variant="secondary" compact icon={<Copy size={14} />} onClick={copyCommand}>{copied ? "Kopyalandı ✓" : "Claude için komutu kopyala"}</AdminButton>
        </div>
      </div>

      {error && <p className="text-sm font-bold text-[#dc2626]">{error}</p>}
      {run === undefined && <p className="text-sm font-bold" style={{ color: "var(--admin-text-muted)" }}>Yükleniyor…</p>}
      {run === null && (
        <div className="content-plan-empty rounded-[16px] border p-8 text-center" style={{ borderColor: "var(--admin-border)" }}>
          <p className="text-sm font-bold" style={{ color: "var(--admin-text-secondary)" }}>{companyName} için henüz Claude MCP ile kaydedilmiş bir reklam stratejisi yok.</p>
        </div>
      )}

      {run && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>
            <Sparkles size={14} /> Claude MCP ile oluşturuldu · {new Date(run.created_at).toLocaleString("tr-TR")}
            {run.final_report.sources && <span>· Kaynaklar: {run.final_report.sources.join(", ")}</span>}
            {run.final_report.period_start && <span>· Dönem: {run.final_report.period_start} — {run.final_report.period_end}</span>}
          </div>

          {!s ? (
            <p className="text-sm">{run.final_report.summary}</p>
          ) : (
            <div className="grid gap-3">
              <Section title="Genel Değerlendirme">
                <p className="text-sm">{s.businessSummary}</p>
                <p className="mt-2 text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>Güven seviyesi: {s.confidence}</p>
                {!!s.dataGaps?.length && <p className="mt-1 text-xs font-bold text-[#b45309]">Veri eksikleri: {s.dataGaps.join(", ")}</p>}
              </Section>

              <div className="grid gap-3 lg:grid-cols-2">
                <Section title="Meta Stratejisi">
                  <AdminStatusBadge tone={s.metaStrategy.recommended ? "success" : "neutral"}>{s.metaStrategy.recommended ? "Önerilir" : "Önerilmez"}</AdminStatusBadge>
                  <p className="mt-2 text-sm">{s.metaStrategy.rationale}</p>
                  {s.metaStrategy.audience && <p className="mt-1 text-xs" style={{ color: "var(--admin-text-secondary)" }}>Hedef kitle: {s.metaStrategy.audience}</p>}
                  {s.metaStrategy.creative && <p className="mt-1 text-xs" style={{ color: "var(--admin-text-secondary)" }}>Kreatif: {s.metaStrategy.creative}</p>}
                </Section>
                <Section title="Google Ads Stratejisi">
                  <AdminStatusBadge tone={s.googleStrategy.recommended ? "success" : "neutral"}>{s.googleStrategy.recommended ? "Önerilir" : "Önerilmez"}</AdminStatusBadge>
                  <p className="mt-2 text-sm">{s.googleStrategy.rationale}</p>
                  {s.googleStrategy.campaignTypes?.map((c, i) => <p key={i} className="mt-1 text-xs" style={{ color: "var(--admin-text-secondary)" }}>{c.type}: {c.rationale}</p>)}
                </Section>
              </div>

              <Section title="Bütçe Planı">
                {!s.budget.hasHistoricalPerformance && <p className="mb-2 text-xs font-bold text-[#b45309]">Geçmiş reklam performans verisi yok; bütçe bir test önerisidir, performans garantisi değildir.</p>}
                <p className="text-sm font-black">Aylık önerilen toplam: {s.budget.totalMonthlyRecommended} TL</p>
                <p className="text-xs" style={{ color: "var(--admin-text-secondary)" }}>Platform dağılımı: Meta %{s.budget.platformSplit.meta} · Google %{s.budget.platformSplit.google}</p>
                <p className="mt-2 text-sm">{s.budget.rationale}</p>
              </Section>

              <Section title="30 Günlük Yol Haritası">
                <ol className="grid gap-1.5 text-sm">
                  {s.thirtyDayPlan.map((p, i) => <li key={i}><strong>{p.phase}:</strong> {p.description}</li>)}
                </ol>
              </Section>

              {!!s.kpis?.length && (
                <Section title="KPI / Ölçüm Planı">
                  <ul className="list-disc pl-5 text-sm">{s.kpis.map((k, i) => <li key={i}>{k}</li>)}</ul>
                </Section>
              )}
              {!!s.risks?.length && (
                <Section title="Eksikler / Riskler">
                  <ul className="list-disc pl-5 text-sm">{s.risks.map((r, i) => <li key={i}>{r}</li>)}</ul>
                </Section>
              )}
              {!!s.assumptions?.length && (
                <Section title="Claude'un Gerekçeleri / Varsayımları">
                  <ul className="list-disc pl-5 text-sm">{s.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul>
                </Section>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
