"use client";
/* eslint-disable react-hooks/set-state-in-effect -- fetch-on-mount pattern, same accepted precedent as ContentPlanningCenter.tsx */

import { useCallback, useEffect, useState } from "react";
import { Copy, RefreshCw, Search, TrendingDown, TrendingUp } from "lucide-react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminStatusBadge } from "@/components/admin/ui/AdminStatusBadge";
import type { InstagramAnalysis } from "@/lib/instagram-intelligence/analysis";
import type { InstagramProfileAuditContext } from "@/lib/instagram-profile-audits";

/**
 * Instagram Intelligence — a read-only Instagram view for İçerik Takip's
 * currently selected company. For HK Dijital's own row (`company.
 * isHkDijitalSelf`) this reuses the existing deep, real-post-history
 * analysis engine built on Social Autopilot's own OAuth connection
 * (unchanged behavior). For any OTHER (customer) company, it reuses the
 * exact same customer-scoped Instagram resolver/reader already built and
 * production-verified for Instagram Profil Optimizasyonu
 * (getInstagramProfileAuditContext in instagram-profile-audits.ts) —
 * never HK Dijital's own single social_integrations row — so a
 * customer's Instagram Intelligence can never silently show or analyze
 * HK Dijital's own account. Never publishes/edits/deletes anything on
 * Instagram. Deliberately does not include a "generate plan" button that
 * fabricates strategy client-side: a real 30-day plan needs actual
 * creative judgment, which this app gets from Claude Code in an
 * interactive session (see .claude/skills/instagram-intelligence-planner/
 * SKILL.md) rather than a hidden paid AI API call — this panel only
 * shows the real data that session works from, and explains how to
 * trigger it.
 */

type Company = { id: string; name: string; isHkDijitalSelf?: boolean };

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

export function InstagramIntelligencePanel({ company }: { company: Company }) {
  const isAgency = Boolean(company.isHkDijitalSelf);

  // HK Dijital's own agency account — unchanged, existing behavior.
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [analysis, setAnalysis] = useState<InstagramAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [notConnectedMessage, setNotConnectedMessage] = useState<string | null>(null);

  // Any other (customer) company — customer-scoped via HK Connect, real
  // Graph API profile/recent-media reuse of the Profil Optimizasyonu data
  // layer, never HK Dijital's account.
  const [customerContext, setCustomerContext] = useState<InstagramProfileAuditContext | null>(null);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [showCustomerAnalysis, setShowCustomerAnalysis] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  const loadCustomerContext = useCallback(async (companyId: string) => {
    setCustomerLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/social-autopilot/instagram/customer-context?companyId=${companyId}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Durum alınamadı.");
      setCustomerContext(body.context);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Beklenmeyen hata.");
    } finally {
      setCustomerLoading(false);
    }
  }, []);

  // Company switching (including HK Dijital <-> a customer, or one
  // customer to another) must never leave the previous company's
  // username/analysis on screen — reset everything on every switch.
  useEffect(() => {
    setStatus(null); setAnalysis(null); setNotConnectedMessage(null);
    setCustomerContext(null); setShowCustomerAnalysis(false); setError(null);
    if (isAgency) loadStatus();
    else loadCustomerContext(company.id);
  }, [company.id, isAgency, loadStatus, loadCustomerContext]);

  async function runAnalysis() {
    if (!isAgency) {
      setShowCustomerAnalysis(true);
      await loadCustomerContext(company.id);
      return;
    }
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

  const connected = isAgency ? status?.status === "connected" : customerContext?.instagram.connectionStatus === "CONNECTED";
  const customerUsername = customerContext?.instagram.username || null;

  async function copyPrompt() {
    if (!isAgency) {
      const text = [
        `${company.name} için gerçek Instagram verilerini HK Digital Center MCP üzerinden incele (get_instagram_profile_audit_context, company_id: ${company.id}).`,
        customerUsername ? `Instagram hesabı: @${customerUsername}.` : "Instagram kullanıcı adını get_instagram_profile_audit_context ile doğrula.",
        "Gerçek profil/gönderi verisine dayanan, doğrudan uygulanabilir bir Instagram değerlendirmesi yap. Verisi bulunmayan alanı uydurma."
      ].join("\n");
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch { /* clipboard denied — nothing to fall back to here */ }
      return;
    }
    const handle = status?.username ? `@${status.username} hesabı` : "bağlı Instagram hesabı";
    const text = `HK Dijital'in ${handle} için güncel Instagram verilerini HK Dijital MCP üzerinden incele (get_instagram_analysis, get_instagram_recent_posts). Gerçek gönderi geçmişine dayanan, doğrudan uygulanabilir bir Instagram içerik stratejisi oluştur ve sonucu İçerik Takip'e kaydet.`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard denied — nothing to fall back to here */ }
  }

  return (
    <div className="grid gap-5">
      {/* Instagram Durumu */}
      <div className="content-plan-stat rounded-[14px] border p-4" style={{ borderColor: "var(--admin-border)" }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>Instagram Durumu</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <AdminStatusBadge tone={connected ? "success" : "warning"}>{connected ? "Bağlı" : "Bağlı Değil"}</AdminStatusBadge>
              {isAgency ? status?.username && <span className="font-bold">@{status.username}</span> : customerUsername && <span className="font-bold">@{customerUsername}</span>}
            </div>
            <p className="mt-1.5 text-xs font-bold" style={{ color: "var(--admin-text-secondary)" }}>
              {isAgency
                ? <>Son senkronizasyon: {formatDateTime(status?.lastInsightsSyncAt || status?.lastSuccessfulCallAt || null)}{analysis && ` · ${analysis.postsFetched} gönderi analiz edildi`}</>
                : company.name}
            </p>
          </div>
          <div className="flex gap-2">
            <AdminButton variant="secondary" icon={<RefreshCw size={14} />} loading={isAgency ? statusLoading : customerLoading} onClick={() => (isAgency ? loadStatus() : loadCustomerContext(company.id))} compact>
              Instagram Verilerini Yenile
            </AdminButton>
            <AdminButton variant="secondary" compact icon={<Copy size={14} />} onClick={copyPrompt}>{copied ? "Kopyalandı ✓" : "Claude için promptu kopyala"}</AdminButton>
          </div>
        </div>
      </div>

      {error && <p className="text-sm font-bold text-[#dc2626]">{error}</p>}
      {notConnectedMessage && (
        <div className="rounded-[10px] border p-3 text-sm font-bold" style={{ borderColor: "#fde68a", background: "#fffbeb", color: "#92400e" }}>
          {notConnectedMessage}
        </div>
      )}

      <div>
        <AdminButton variant="primary" icon={<Search size={16} />} loading={isAgency ? analysisLoading : customerLoading} onClick={runAnalysis}>
          Instagram&apos;ı Analiz Et
        </AdminButton>
      </div>

      {!isAgency && showCustomerAnalysis && customerContext && (
        <>
          {!connected && (
            <div className="content-plan-empty rounded-[16px] border p-6 text-center" style={{ borderColor: "var(--admin-border)" }}>
              <p className="text-sm font-bold" style={{ color: "var(--admin-text-secondary)" }}>{company.name} için bağlı bir Instagram hesabı bulunamadı. HK Connect üzerinden bağlanması gerekir.</p>
            </div>
          )}
          {connected && customerContext.instagram.profile && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="content-plan-stat rounded-[14px] border p-4" style={{ borderColor: "var(--admin-border)" }}>
                <p className="text-[11px] font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>Ad</p>
                <p className="mt-1 text-sm font-bold">{customerContext.instagram.profile.name || "—"}</p>
              </div>
              <div className="content-plan-stat rounded-[14px] border p-4" style={{ borderColor: "var(--admin-border)" }}>
                <p className="text-[11px] font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>Takipçi</p>
                <p className="mt-1 text-2xl font-black">{customerContext.instagram.profile.followersCount ?? "—"}</p>
              </div>
              <div className="content-plan-stat rounded-[14px] border p-4" style={{ borderColor: "var(--admin-border)" }}>
                <p className="text-[11px] font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>Gönderi</p>
                <p className="mt-1 text-2xl font-black">{customerContext.instagram.profile.mediaCount ?? "—"}</p>
              </div>
              <div className="content-plan-stat rounded-[14px] border p-4" style={{ borderColor: "var(--admin-border)" }}>
                <p className="text-[11px] font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>Son Analiz Verisi</p>
                <p className="mt-1 text-sm font-bold">{customerContext.instagram.profile.available ? "Gerçek Graph API verisi" : (customerContext.instagram.profile.error || "Kullanılamıyor")}</p>
              </div>
            </div>
          )}
          {connected && customerContext.instagram.profile?.biography && (
            <div className="content-plan-stat rounded-[14px] border p-4" style={{ borderColor: "var(--admin-border)" }}>
              <p className="mb-2 text-xs font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>Bio</p>
              <p className="text-sm">{customerContext.instagram.profile.biography}</p>
            </div>
          )}
          {connected && customerContext.instagram.recentMedia && customerContext.instagram.recentMedia.length > 0 && (
            <div className="content-plan-stat rounded-[14px] border p-4" style={{ borderColor: "var(--admin-border)" }}>
              <p className="mb-2 text-xs font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>Son Gönderiler</p>
              <div className="grid gap-2">
                {customerContext.instagram.recentMedia.map((m) => (
                  <a key={m.id} href={m.permalink || "#"} target="_blank" rel="noreferrer" className="block text-sm font-bold underline decoration-dotted">
                    {(m.caption || "(başlıksız)").slice(0, 70)} <span style={{ color: "var(--admin-text-muted)" }}>· {m.mediaType || "—"}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {isAgency && analysis && (
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
