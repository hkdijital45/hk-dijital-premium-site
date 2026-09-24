"use client";
/* eslint-disable react-hooks/set-state-in-effect -- fetch-on-mount pattern, same accepted precedent as AdsStrategyPanel.tsx */

import { useEffect, useState } from "react";
import { Copy, ExternalLink, History } from "lucide-react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminStatusBadge, type AdminStatusTone } from "@/components/admin/ui/AdminStatusBadge";
import { buildInstagramProfileAuditPrompt } from "@/lib/instagram-profile-audit-prompt";

type Company = { id: string; name: string };

type AuditListItem = { id: string; audit_date: string; status: "draft" | "approved" | "completed"; instagram_username: string; overall_summary: string; created_at: string };
type AuditDetail = AuditListItem & {
  current_bio: string; recommended_bio: string;
  profile_photo_analysis: unknown; username_analysis: unknown; name_field_analysis: unknown; link_cta_analysis: unknown;
  highlights_analysis: unknown[]; pinned_posts_analysis: unknown[]; profile_visual_analysis: unknown; trust_contact_analysis: unknown;
  priorities: Array<{ level?: string; title?: string; text?: string; description?: string }>;
  checklist: Array<{ text?: string; item?: string; label?: string }>;
};
type ContextResponse = {
  context: { company: Company; instagram: { username: string | null; connectionStatus: string }; latestAudit: AuditListItem | null };
  history: AuditListItem[];
};

const STATUS_LABELS: Record<string, string> = { draft: "Taslak", approved: "Onaylandı", completed: "Tamamlandı" };
const STATUS_TONE: Record<string, AdminStatusTone> = { draft: "neutral", approved: "info", completed: "success" };
const CONNECTION_TONE: Record<string, AdminStatusTone> = { CONNECTED: "success", NOT_CONNECTED: "neutral", AUTH_EXPIRED: "warning", PERMISSION_DENIED: "danger", NO_DATA: "neutral", ERROR: "danger" };
const CONNECTION_LABELS: Record<string, string> = { CONNECTED: "Bağlı", NOT_CONNECTED: "Bağlı değil", AUTH_EXPIRED: "Yeniden yetki gerekli", PERMISSION_DENIED: "İzin reddedildi", NO_DATA: "Veri yok", ERROR: "Hata" };

function priorityTone(level?: string): string {
  const value = String(level || "").toLocaleLowerCase("tr");
  if (value.includes("önce") || value.includes("yüksek") || value.includes("high") || value === "red" || value === "kırmızı") return "🔴";
  if (value.includes("sonra") || value.includes("orta") || value.includes("medium") || value === "yellow" || value === "sarı") return "🟡";
  if (value.includes("iyi") || value.includes("düşük") || value.includes("low") || value === "green" || value === "yeşil") return "🟢";
  return "🔴";
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="content-plan-stat rounded-[14px] border p-4" style={{ borderColor: "var(--admin-border)" }}>
      <p className="mb-2 text-xs font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>{title}</p>
      {children}
    </div>
  );
}

export function InstagramProfileAuditPanel({ company }: { company: Company }) {
  const [data, setData] = useState<ContextResponse | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedAudit, setSelectedAudit] = useState<AuditDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  function load() {
    if (!company?.id) return;
    setData(undefined);
    setError(null);
    fetch(`/api/admin/instagram-profile-audits?companyId=${company.id}`)
      .then((r) => r.json())
      .then((body) => { if (body.error) setError(body.error); else setData(body); })
      .catch(() => setError("Yüklenemedi."));
  }
  useEffect(load, [company?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function openAudit(id: string) {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/instagram-profile-audits?companyId=${company.id}&id=${id}`);
      const body = await res.json();
      setSelectedAudit(body.audit || null);
    } finally {
      setDetailLoading(false);
    }
  }

  async function copyPrompt() {
    const username = data?.context?.instagram?.username || null;
    const text = buildInstagramProfileAuditPrompt(company, username);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Prompt kopyalanamadı. Lütfen tekrar deneyin.");
    }
  }

  if (!company?.id) return <p className="text-sm font-bold" style={{ color: "var(--admin-text-muted)" }}>Bir müşteri seçin.</p>;

  const connectionStatus = data?.context?.instagram?.connectionStatus;
  const notConnected = connectionStatus && connectionStatus !== "CONNECTED";
  const latest = data?.context?.latestAudit;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-black" style={{ color: "var(--admin-text-primary)" }}>Instagram Profil Optimizasyonu</h3>
          {data?.context && (
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs" style={{ color: "var(--admin-text-muted)" }}>
              {data.context.instagram.username ? `@${data.context.instagram.username}` : "Instagram hesabı bilinmiyor"}
              {connectionStatus && <AdminStatusBadge tone={CONNECTION_TONE[connectionStatus] || "neutral"}>{CONNECTION_LABELS[connectionStatus] || connectionStatus}</AdminStatusBadge>}
              {latest && <span>· Son analiz: {new Date(latest.audit_date).toLocaleDateString("tr-TR")} <AdminStatusBadge tone={STATUS_TONE[latest.status] || "neutral"}>{STATUS_LABELS[latest.status] || latest.status}</AdminStatusBadge></span>}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <AdminButton variant="secondary" compact icon={<History size={14} />} onClick={() => setShowHistory((v) => !v)}>Rapor Geçmişi</AdminButton>
          <AdminButton variant="ai" compact icon={<Copy size={14} />} onClick={copyPrompt} disabled={data === undefined}>{copied ? "Kopyalandı ✓" : "Promptu Kopyala"}</AdminButton>
        </div>
      </div>

      {error && <p className="text-sm font-bold text-[#dc2626]">{error}</p>}
      {data === undefined && !error && <p className="text-sm font-bold" style={{ color: "var(--admin-text-muted)" }}>Yükleniyor…</p>}

      {data && notConnected && (
        <div className="content-plan-empty rounded-[16px] border p-6 text-center" style={{ borderColor: "var(--admin-border)" }}>
          <p className="text-sm font-bold" style={{ color: "var(--admin-text-secondary)" }}>Bu müşteri için bağlı bir Instagram hesabı bulunamadı.</p>
          <a href="/hk-admin/hk-connect" target="_blank" rel="noreferrer" className="mt-3 inline-flex">
            <AdminButton compact variant="secondary" icon={<ExternalLink size={14} />}>HK Connect&apos;i Aç</AdminButton>
          </a>
        </div>
      )}

      {data && !notConnected && !latest && (
        <div className="content-plan-empty rounded-[16px] border p-6 text-center" style={{ borderColor: "var(--admin-border)" }}>
          <p className="text-sm font-bold" style={{ color: "var(--admin-text-secondary)" }}>Henüz Instagram profil optimizasyon raporu oluşturulmamış.</p>
        </div>
      )}

      {showHistory && data && (
        <Section title="Rapor Geçmişi">
          {data.history.length ? (
            <div className="grid gap-2">
              {data.history.map((item) => (
                <button key={item.id} type="button" onClick={() => openAudit(item.id)} className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border p-2.5 text-left text-xs" style={{ borderColor: "var(--admin-border)" }}>
                  <span className="font-bold" style={{ color: "var(--admin-text-primary)" }}>{new Date(item.audit_date).toLocaleDateString("tr-TR")} · @{item.instagram_username}</span>
                  <span className="flex items-center gap-2"><AdminStatusBadge tone={STATUS_TONE[item.status] || "neutral"}>{STATUS_LABELS[item.status] || item.status}</AdminStatusBadge></span>
                </button>
              ))}
            </div>
          ) : <p className="text-xs" style={{ color: "var(--admin-text-muted)" }}>Henüz kayıtlı rapor yok.</p>}
        </Section>
      )}

      {detailLoading && <p className="text-sm font-bold" style={{ color: "var(--admin-text-muted)" }}>Rapor yükleniyor…</p>}

      {(selectedAudit || (!showHistory && latest && data)) && (() => {
        const audit = selectedAudit;
        if (!audit) return <p className="text-xs" style={{ color: "var(--admin-text-muted)" }}>Detayı görüntülemek için bir raporu Rapor Geçmişi&apos;nden açın.</p>;
        const priorities = Array.isArray(audit.priorities) ? audit.priorities : [];
        const checklist = Array.isArray(audit.checklist) ? audit.checklist : [];
        return (
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>
              {new Date(audit.audit_date).toLocaleDateString("tr-TR")} · @{audit.instagram_username} · <AdminStatusBadge tone={STATUS_TONE[audit.status] || "neutral"}>{STATUS_LABELS[audit.status] || audit.status}</AdminStatusBadge>
            </div>
            <Section title="Genel Durum"><p className="text-sm">{audit.overall_summary || "Bu bölüm için veri bulunmuyor."}</p></Section>
            {audit.current_bio && (
              <Section title="Bio">
                <p className="text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>Mevcut</p>
                <p className="text-sm">{audit.current_bio}</p>
                {audit.recommended_bio && <><p className="mt-2 text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>Önerilen</p><p className="text-sm">{audit.recommended_bio}</p></>}
              </Section>
            )}
            {!!priorities.length && (
              <Section title="Öncelikler">
                <ul className="grid gap-1.5 text-sm">
                  {priorities.map((p, i) => <li key={i}>{priorityTone(p.level)} {p.title || p.text || p.description || ""}</li>)}
                </ul>
              </Section>
            )}
            {!!checklist.length && (
              <Section title="Uygulama Kontrol Listesi">
                <ul className="grid gap-1 text-sm">
                  {checklist.map((c, i) => <li key={i}>☐ {c.text || c.item || c.label || ""}</li>)}
                </ul>
              </Section>
            )}
          </div>
        );
      })()}
    </div>
  );
}
