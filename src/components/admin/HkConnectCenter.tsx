"use client";
/* eslint-disable react-hooks/set-state-in-effect -- fetch-on-mount pattern, same accepted precedent as ContentPlanningCenter.tsx */

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Copy, Link2, RefreshCw, Ban } from "lucide-react";
import { AdminWorkspace } from "@/components/admin/workspace/AdminWorkspace";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminStatusBadge } from "@/components/admin/ui/AdminStatusBadge";

type Company = { id: string; name: string };
type PlatformStatus = Record<string, string>;
type ConnectLink = { id: string; expires_at: string; used_at: string | null; revoked_at: string | null; created_at: string };

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", youtube: "YouTube",
  meta_ads: "Meta Ads", google_ads: "Google Ads", ga4: "GA4", search_console: "Search Console", gtm: "GTM"
};

// Only capabilities the connect-link flow can actually complete (real
// OAuth + asset selection) — TikTok/YouTube/GTM have no such public flow
// yet, so they're never offered here even though they appear read-only in
// the status grid above.
const CAPABILITY_GROUPS: Array<{ label: string; items: Array<{ key: string; label: string }> }> = [
  { label: "META", items: [{ key: "facebook", label: "Facebook" }, { key: "instagram", label: "Instagram" }, { key: "meta_ads", label: "Meta Ads" }] },
  { label: "GOOGLE", items: [{ key: "google_ads", label: "Google Ads" }, { key: "ga4", label: "GA4" }, { key: "search_console", label: "Search Console" }] }
];

function readCompanyFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("company");
}
function writeCompanyToUrl(id: string) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("company", id);
  window.history.replaceState(null, "", url.toString());
}

function statusTone(status: string): "success" | "warning" | "neutral" {
  if (status === "connected" || status === "CONNECTED") return "success";
  if (status === "token_expired" || status === "reauth_required" || status === "AUTH_EXPIRED" || status === "sync_error" || status === "ERROR") return "warning";
  return "neutral";
}
function statusLabel(status: string): string {
  const map: Record<string, string> = { connected: "Bağlı", not_connected: "Bağlı değil", token_expired: "Token süresi doldu", reauth_required: "Yeniden yetki gerekli", sync_error: "Hata", no_data: "Veri yok", CONNECTED: "Bağlı", ACCOUNT_NOT_MAPPED: "Hesap eşleşmemiş", PLATFORM_NOT_CONFIGURED: "Yapılandırılmamış", AUTH_EXPIRED: "Yeniden yetki gerekli" };
  return map[status] || status;
}
// nowMs is captured once by the caller (inside an effect/event handler,
// never during render) so this stays a pure function of its arguments.
function findActiveLink(links: ConnectLink[], nowMs: number): ConnectLink | null {
  return links.find((l) => !l.used_at && !l.revoked_at && new Date(l.expires_at).getTime() > nowMs) || null;
}

export function HkConnectCenter() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState<string>("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [status, setStatus] = useState<PlatformStatus | null>(null);
  const [links, setLinks] = useState<ConnectLink[] | null>(null);
  const [latestActiveLink, setLatestActiveLink] = useState<ConnectLink | null>(null);
  const [creating, setCreating] = useState(false);
  const [newLink, setNewLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>([]);

  function toggleCapability(key: string) {
    setSelectedCapabilities((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  useEffect(() => {
    const fromUrl = readCompanyFromUrl();
    fetch("/api/admin/companies").then((r) => r.json()).then((body) => {
      const list: Company[] = body.companies || [];
      setCompanies(list);
      if (fromUrl && list.some((c) => c.id === fromUrl)) setCompanyId(fromUrl);
      else if (list.length) setCompanyId(list[0].id);
    }).catch(() => {});
  }, []);

  const loadStatus = useCallback(async () => {
    if (!companyId) return;
    setStatus(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/hk-connect/status?companyId=${companyId}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Yüklenemedi.");
      setStatus(body.platforms);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Beklenmeyen hata.");
    }
  }, [companyId]);

  const loadLinks = useCallback(async () => {
    if (!companyId) return;
    try {
      const res = await fetch(`/api/admin/connect-links?companyId=${companyId}`);
      const body = await res.json();
      if (res.ok) {
        const list: ConnectLink[] = body.links || [];
        setLinks(list);
        setLatestActiveLink(findActiveLink(list, Date.now()));
      }
    } catch { /* non-critical */ }
  }, [companyId]);

  useEffect(() => { loadStatus(); loadLinks(); setNewLink(null); }, [loadStatus, loadLinks]);

  function selectCompany(id: string) {
    setCompanyId(id);
    setPickerOpen(false);
    writeCompanyToUrl(id);
  }

  async function generateLink() {
    if (!selectedCapabilities.length) { setError("En az bir platform seçin."); return; }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/connect-links", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, capabilities: selectedCapabilities }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Oluşturulamadı.");
      setNewLink({ url: body.url, expiresAt: body.expiresAt });
      loadLinks();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Beklenmeyen hata.");
    } finally {
      setCreating(false);
    }
  }

  async function revokeLink(id: string) {
    try {
      await fetch(`/api/admin/connect-links/${id}/revoke`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId }) });
      setNewLink(null);
      loadLinks();
    } catch { /* surfaced via loadLinks staying stale — acceptable for a low-frequency admin action */ }
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard permission denied — link is still visible to copy manually */ }
  }

  return (
    <AdminWorkspace eyebrow="Entegrasyonlar" title="HK Connect — Entegrasyon Merkezi" description="Her müşterinin dijital platform bağlantılarını tek noktadan gör ve yönet.">
      <div className="mb-5 relative w-fit">
        <p className="mb-1 text-[11px] font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>Müşteri</p>
        <button type="button" onClick={() => setPickerOpen((v) => !v)} className="flex min-w-56 items-center justify-between gap-3 rounded-[10px] border px-3 py-2 text-sm font-black" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }}>
          {companies.find((c) => c.id === companyId)?.name || "Müşteri seçin"}
          <ChevronDown size={16} />
        </button>
        {pickerOpen && (
          <div className="absolute z-20 mt-1 w-full min-w-56 overflow-hidden rounded-[10px] border" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface, var(--admin-bg))", boxShadow: "var(--admin-shadow-card, var(--admin-shadow))" }}>
            {companies.map((c) => (
              <button key={c.id} type="button" onClick={() => selectCompany(c.id)} className="block w-full px-3 py-2 text-left text-sm font-bold" style={{ background: c.id === companyId ? "var(--admin-surface-soft)" : "transparent" }}>
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <p className="mb-3 text-sm font-bold text-[#dc2626]">{error}</p>}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="content-plan-stat rounded-[16px] border p-5" style={{ borderColor: "var(--admin-border)" }}>
          <div className="flex items-center justify-between">
            <p className="font-black">Bağlantı Durumu</p>
            <button type="button" onClick={loadStatus} aria-label="Yenile" className="rounded-full p-2" style={{ color: "var(--admin-text-muted)" }}><RefreshCw size={15} /></button>
          </div>
          <div className="mt-3 grid gap-2">
            {status ? Object.entries(status).map(([platform, value]) => (
              <div key={platform} className="flex items-center justify-between text-sm font-bold">
                <span>{PLATFORM_LABELS[platform] || platform}</span>
                <AdminStatusBadge tone={statusTone(value)}>{statusLabel(value)}</AdminStatusBadge>
              </div>
            )) : <p className="text-sm" style={{ color: "var(--admin-text-muted)" }}>Yükleniyor…</p>}
          </div>
        </div>

        <div className="content-plan-stat rounded-[16px] border p-5" style={{ borderColor: "var(--admin-border)" }}>
          <p className="font-black">Uzaktan Bağlantı Linki</p>
          <p className="mt-1 text-xs font-bold" style={{ color: "var(--admin-text-secondary)" }}>Müşteri HK Admin hesabı olmadan kendi Meta/Google hesabını bağlayabilir.</p>

          {latestActiveLink && !newLink && (
            <div className="mt-3 rounded-[10px] border p-3 text-xs font-bold" style={{ borderColor: "var(--admin-border)" }}>
              Aktif bir bağlantı linki var — son kullanma: {new Date(latestActiveLink.expires_at).toLocaleString("tr-TR")}
              <div className="mt-2"><AdminButton variant="danger" compact icon={<Ban size={14} />} onClick={() => revokeLink(latestActiveLink.id)}>Linki İptal Et</AdminButton></div>
            </div>
          )}

          {newLink && (
            <div className="mt-3 rounded-[10px] border p-3" style={{ borderColor: "var(--admin-border)" }}>
              <p className="break-all text-xs font-bold" style={{ color: "var(--admin-text-secondary)" }}>{newLink.url}</p>
              <p className="mt-1 text-[11px] font-bold" style={{ color: "var(--admin-text-muted)" }}>Son kullanma: {new Date(newLink.expiresAt).toLocaleString("tr-TR")}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <AdminButton variant="secondary" compact icon={<Copy size={14} />} onClick={() => copyLink(newLink.url)}>{copied ? "Kopyalandı ✓" : "Linki Kopyala"}</AdminButton>
                <AdminButton variant="ghost" compact icon={<Ban size={14} />} onClick={() => revokeLink(links?.find((l) => !l.used_at && !l.revoked_at)?.id || "")}>Linki İptal Et</AdminButton>
              </div>
            </div>
          )}

          <div className="mt-3 grid gap-2">
            <p className="text-[11px] font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>İstenecek platformlar</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {CAPABILITY_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="mb-1 text-[10px] font-black" style={{ color: "var(--admin-text-muted)" }}>{group.label}</p>
                  {group.items.map((item) => (
                    <label key={item.key} className="flex items-center gap-1.5 py-0.5 text-xs font-bold">
                      <input type="checkbox" className="size-3.5" checked={selectedCapabilities.includes(item.key)} onChange={() => toggleCapability(item.key)} />
                      {item.label}
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3">
            <AdminButton variant="primary" icon={<Link2 size={16} />} loading={creating} onClick={generateLink}>
              {latestActiveLink || newLink ? "Yeni Link Oluştur" : "Bağlantı Linki Oluştur"}
            </AdminButton>
          </div>
        </div>
      </div>
    </AdminWorkspace>
  );
}
