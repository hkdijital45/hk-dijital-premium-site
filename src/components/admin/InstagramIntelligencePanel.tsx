"use client";
/* eslint-disable react-hooks/set-state-in-effect -- fetch-on-mount pattern, same accepted precedent as ContentPlanningCenter.tsx */

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Search, TrendingDown, TrendingUp } from "lucide-react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminStatusBadge } from "@/components/admin/ui/AdminStatusBadge";
import type { InstagramAnalysis } from "@/lib/instagram-intelligence/analysis";

/**
 * Instagram Intelligence — a read-only analysis view of HK Dijital's real,
 * already-connected Instagram account (reuses Social Autopilot's existing
 * OAuth connection, never publishes/edits/deletes anything on Instagram).
 * Deliberately does not include a "generate plan" button that fabricates
 * strategy client-side: a real 30-day plan needs actual creative judgment,
 * which this app gets from Claude Code in an interactive session (see
 * .claude/skills/instagram-intelligence-planner/SKILL.md) rather than a
 * hidden paid AI API call — this panel only shows the real data that
 * session works from, and explains how to trigger it.
 */

type ConnectionStatus = {
  status: string;
  username: string | null;
  connectedAt: string | null;
  lastSuccessfulCallAt: string | null;
  lastInsightsSyncAt: string | null;
  appConfigured: boolean;
};

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("tr-TR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function InstagramIntelligencePanel() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [analysis, setAnalysis] = useState<InstagramAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [notConnectedMessage, setNotConnectedMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/social-autopilot/instagram/status");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Durum alınamadı.");
      setStatus(body.status);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Beklenmeyen hata.");
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  async function runAnalysis() {
    setAnalysisLoading(true);
    setError(null);
    setNotConnectedMessage(null);
    try {
      const res = await fetch("/api/admin/instagram-intelligence/analysis");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Analiz başarısız oldu.");
      if (body.connected === false) {
        setNotConnectedMessage(body.message);
        return;
      }
      setAnalysis(body.analysis);
      loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Beklenmeyen hata.");
    } finally {
      setAnalysisLoading(false);
    }
  }

  const connected = status?.status === "connected";

  return (
    <div className="grid gap-5">
      {/* Instagram Durumu */}
      <div className="content-plan-stat rounded-[14px] border p-4" style={{ borderColor: "var(--admin-border)" }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>Instagram Durumu</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <AdminStatusBadge tone={connected ? "success" : "warning"}>{connected ? "Bağlı" : "Bağlı Değil"}</AdminStatusBadge>
              {status?.username && <span className="font-bold">@{status.username}</span>}
            </div>
            <p className="mt-1.5 text-xs font-bold" style={{ color: "var(--admin-text-secondary)" }}>
              Son senkronizasyon: {formatDateTime(status?.lastInsightsSyncAt || status?.lastSuccessfulCallAt || null)}
              {analysis && ` · ${analysis.postsFetched} gönderi analiz edildi`}
            </p>
          </div>
          <AdminButton variant="secondary" icon={<RefreshCw size={14} />} loading={statusLoading} onClick={loadStatus} compact>
            Instagram Verilerini Yenile
          </AdminButton>
        </div>
      </div>

      {error && <p className="text-sm font-bold text-[#dc2626]">{error}</p>}
      {notConnectedMessage && (
        <div className="rounded-[10px] border p-3 text-sm font-bold" style={{ borderColor: "#fde68a", background: "#fffbeb", color: "#92400e" }}>
          {notConnectedMessage}
        </div>
      )}

      <div>
        <AdminButton variant="primary" icon={<Search size={16} />} loading={analysisLoading} onClick={runAnalysis}>
          Instagram&apos;ı Analiz Et
        </AdminButton>
      </div>

      {analysis && (
        <>
          {/* Kısa Analiz */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="content-plan-stat rounded-[14px] border p-4" style={{ borderColor: "var(--admin-border)" }}>
              <p className="text-[11px] font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>Son 30 Gün</p>
              <p className="mt-1 text-2xl font-black">{analysis.last30Days}</p>
            </div>
            <div className="content-plan-stat rounded-[14px] border p-4" style={{ borderColor: "var(--admin-border)" }}>
              <p className="text-[11px] font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>Son 90 Gün</p>
              <p className="mt-1 text-2xl font-black">{analysis.last90Days}</p>
            </div>
            <div className="content-plan-stat rounded-[14px] border p-4" style={{ borderColor: "var(--admin-border)" }}>
              <p className="text-[11px] font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>Haftalık Sıklık</p>
              <p className="mt-1 text-2xl font-black">{analysis.postingFrequencyPerWeek}</p>
            </div>
            <div className="content-plan-stat rounded-[14px] border p-4" style={{ borderColor: "var(--admin-border)" }}>
              <p className="text-[11px] font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>Metrikli Gönderi</p>
              <p className="mt-1 text-2xl font-black">{analysis.postsWithMetrics}</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="content-plan-stat rounded-[14px] border p-4" style={{ borderColor: "var(--admin-border)" }}>
              <p className="text-sm font-black">En Çok Kullanılan Temalar</p>
              <div className="mt-2 grid gap-1.5">
                {analysis.categoryDistribution.slice(0, 6).map((c) => (
                  <div key={c.category} className="flex items-center justify-between text-sm font-bold">
                    <span>{c.category}</span>
                    <span style={{ color: "var(--admin-text-muted)" }}>{c.count} · {c.lastUsedDaysAgo}g önce</span>
                  </div>
                ))}
                {!analysis.categoryDistribution.length && <p className="text-sm" style={{ color: "var(--admin-text-muted)" }}>Sınıflandırılabilen tema bulunamadı.</p>}
              </div>
            </div>

            <div className="content-plan-stat rounded-[14px] border p-4" style={{ borderColor: "var(--admin-border)" }}>
              <p className="text-sm font-black">Eksik Kalan Temalar</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {analysis.missingCategories.map((c) => (
                  <span key={c} className="rounded-full border px-2.5 py-1 text-xs font-bold" style={{ borderColor: "var(--admin-border)" }}>{c}</span>
                ))}
                {!analysis.missingCategories.length && <p className="text-sm" style={{ color: "var(--admin-text-muted)" }}>Tüm temalar en az bir kez işlenmiş.</p>}
              </div>
            </div>
          </div>

          {(analysis.topPerformers.length > 0 || analysis.weakPerformers.length > 0) && (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="content-plan-stat rounded-[14px] border p-4" style={{ borderColor: "var(--admin-border)" }}>
                <p className="flex items-center gap-1.5 text-sm font-black"><TrendingUp size={15} className="text-[#15803d]" /> Başarılı İçerikler</p>
                <div className="mt-2 grid gap-2">
                  {analysis.topPerformers.map((p) => (
                    <a key={p.id} href={p.permalink || "#"} target="_blank" rel="noreferrer" className="block text-sm font-bold underline decoration-dotted">
                      {p.caption.slice(0, 70) || "(başlıksız)"} <span style={{ color: "var(--admin-text-muted)" }}>· {p.format}</span>
                    </a>
                  ))}
                </div>
              </div>
              <div className="content-plan-stat rounded-[14px] border p-4" style={{ borderColor: "var(--admin-border)" }}>
                <p className="flex items-center gap-1.5 text-sm font-black"><TrendingDown size={15} className="text-[#b45309]" /> Zayıf Performans</p>
                <div className="mt-2 grid gap-2">
                  {analysis.weakPerformers.map((p) => (
                    <a key={p.id} href={p.permalink || "#"} target="_blank" rel="noreferrer" className="block text-sm font-bold underline decoration-dotted">
                      {p.caption.slice(0, 70) || "(başlıksız)"} <span style={{ color: "var(--admin-text-muted)" }}>· {p.format}</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}

          {analysis.repetitionRisks.length > 0 && (
            <div className="content-plan-stat rounded-[14px] border p-4" style={{ borderColor: "var(--admin-border)" }}>
              <p className="text-sm font-black">Tekrar Riski Olan Konular</p>
              <div className="mt-2 grid gap-1.5 text-sm" style={{ color: "var(--admin-text-secondary)" }}>
                {analysis.repetitionRisks.slice(0, 5).map((r, i) => (
                  <p key={i}>&quot;{r.captionA}…&quot; ↔ &quot;{r.captionB}…&quot; ({r.daysApart} gün arayla)</p>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-[10px] border p-3 text-sm font-bold" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }}>
            30 günlük stratejik içerik planı, bu gerçek analiz verisine dayanarak Claude Code ile oluşturulur (ücretli bir API çağrısı yapılmaz — Claude Pro aboneliğinizle çalışır). Claude Code&apos;da &quot;Instagram Intelligence planını oluştur&quot; yazmanız yeterli; oluşturulan plan otomatik olarak İçerik Takip&apos;e aktarılır.
          </div>
        </>
      )}
    </div>
  );
}
