"use client";
/* eslint-disable react-hooks/set-state-in-effect -- resetting local picker
   state when the active provider tab changes, and auto-loading accounts on
   an OAuth-return open, are the same accepted pattern as
   CustomerAccountConnectCenter.tsx and AnalyticsReportingCenter.tsx. */

import { useEffect, useMemo, useState } from "react";
import { ImagePlus, Megaphone, Music2, PlayCircle, Search, MapPin, X } from "lucide-react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminStatusBadge } from "@/components/admin/ui/AdminStatusBadge";
import { PROVIDER_ASSET_TYPE, PROVIDER_LABELS, PROVIDER_OAUTH_PARENT } from "@/lib/analytics-center/capabilities";
import type { AnalyticsProvider, ProviderConnectionStatus } from "@/lib/analytics-center/types";

const PROVIDER_ICONS: Record<AnalyticsProvider, any> = { instagram: ImagePlus, facebook: Megaphone, tiktok: Music2, youtube: PlayCircle, google_ads: Search, google_business_profile: MapPin };
const ADMIN_MANAGED_PROVIDERS: AnalyticsProvider[] = ["instagram", "facebook", "tiktok", "youtube", "google_ads", "google_business_profile"];

// Matches the account_type values selectOAuthAccount()/normalizeAsset()
// already write into integration_assets (see connections.ts's
// PROVIDER_ASSET_TYPE and CustomerAccountConnectCenter.tsx's
// groupedOAuthAccounts, the two other places this exact mapping already
// exists — kept in sync deliberately, not re-derived from a shared export,
// since the two screens read slightly different raw shapes: the customer
// screen groups directly by account_type, this one filters a specific
// provider's accounts out of one shared Meta/Google discovery list).
function matchesChildProvider(item: any, provider: AnalyticsProvider): boolean {
  const accountType = String(item?.account_type || item?.asset_type || "").trim();
  switch (provider) {
    case "instagram": return accountType === "instagram_business";
    case "facebook": return accountType === "facebook_page";
    case "tiktok": return accountType === "tiktok_account";
    case "youtube": return accountType === "youtube_channel" || accountType === "youtube";
    case "google_ads": return accountType === "google_ads_customer" || accountType === "google_ads";
    case "google_business_profile": return accountType.includes("google_business") || accountType.includes("business_profile");
    default: return false;
  }
}

const integrationErrorMessages: Record<string, string> = {
  meta_env_missing: "Bu platform için otomatik bağlantı ayarları henüz tamamlanmamış.",
  google_env_missing: "Bu platform için otomatik bağlantı ayarları henüz tamamlanmamış.",
  session_missing: "Oturum doğrulanamadı. Lütfen HK Admin panelinden çıkış yapıp tekrar giriş yapın.",
  company_mismatch: "Bağlantı isteği bu müşteri seçimiyle eşleşmiyor.",
  state_invalid: "OAuth güvenlik doğrulaması başarısız oldu. Lütfen bağlantıyı yeniden başlatın.",
  token_exchange_failed: "Platform girişinden sonra erişim doğrulaması tamamlanamadı.",
  invalid_scope: "Meta bu izin kapsamını kabul etmedi.",
  redirect_uri_mismatch: "Platform callback adresi eşleşmedi.",
  user_info_fetch_failed: "Giriş tamamlandı ancak kullanıcı bilgisi okunamadı. Lütfen tekrar deneyin.",
  permission_denied: "Platform izni verilmedi veya bağlantı iptal edildi."
};

export function AdminConnectionDrawer({
  companyId,
  initialProvider,
  connections,
  autoLoadAccounts,
  incomingError,
  onClose,
  onConnectionsChanged
}: {
  companyId: string;
  initialProvider: AnalyticsProvider;
  connections: ProviderConnectionStatus[] | null;
  autoLoadAccounts?: boolean;
  incomingError?: string | null;
  onClose: () => void;
  onConnectionsChanged: () => void;
}) {
  const [activeProvider, setActiveProvider] = useState<AnalyticsProvider>(initialProvider);
  const [oauthInfo, setOauthInfo] = useState<any>(null);
  const [metaDiagnostics, setMetaDiagnostics] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [message, setMessage] = useState(incomingError ? (integrationErrorMessages[incomingError] || "Bağlantı tamamlanamadı. Lütfen tekrar deneyin.") : "");

  const conn = useMemo(() => connections?.find((c) => c.provider === activeProvider) || null, [connections, activeProvider]);
  const oauthParent = PROVIDER_OAUTH_PARENT[activeProvider];

  useEffect(() => {
    setOauthInfo(null);
    setMetaDiagnostics(null);
    setSelectedIds([]);
    if (!incomingError) setMessage("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProvider]);

  useEffect(() => {
    if (autoLoadAccounts) loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (oauthParent !== "meta") return;
    fetch(`/api/customer/integrations/meta/diagnostics?company=${encodeURIComponent(companyId)}`, { cache: "no-store" })
      .then((r) => r.json()).then(setMetaDiagnostics).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProvider, companyId]);

  // Google responses carry a per-service `groups` object (see
  // googleDiscoveryGroups in customer-integration-oauth.ts) keyed exactly
  // by AnalyticsProvider ("youtube"/"google_ads"/"google_business_profile")
  // — the real, service-specific result and message, never the old
  // account-level filter that couldn't distinguish "this service returned
  // nothing" from "this service errored" from "this service was never
  // checked". Meta doesn't have this shape (listMetaBusinessAssets' own
  // groups are category-labeled, not AnalyticsProvider-keyed, and the Meta
  // flow already works in production — untouched here), so Meta still
  // filters the flat accounts list directly.
  const googleGroup = useMemo(() => {
    if (oauthParent !== "google") return null;
    return oauthInfo?.groups?.[activeProvider] || null;
  }, [oauthInfo, oauthParent, activeProvider]);

  const childAccounts = useMemo(() => {
    if (googleGroup) return googleGroup.assets || [];
    const accounts = Array.isArray(oauthInfo?.accounts) ? oauthInfo.accounts : [];
    return accounts.filter((item: any) => matchesChildProvider(item, activeProvider));
  }, [oauthInfo, activeProvider, googleGroup]);

  async function loadAccounts() {
    setLoadingAccounts(true);
    setMessage("");
    try {
      const response = await fetch(`/api/integrations/accounts?provider=${oauthParent}&company=${encodeURIComponent(companyId)}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      setOauthInfo(payload);
      const group = oauthParent === "google" ? payload?.groups?.[activeProvider] : null;
      const matches = group ? (group.assets || []) : (Array.isArray(payload.accounts) ? payload.accounts : []).filter((item: any) => matchesChildProvider(item, activeProvider));
      setSelectedIds(matches.slice(0, 1).map((item: any) => item.id));
      if (!response.ok) setMessage(payload.message || "Yetkili hesap listesi alınamadı.");
      else if (group) setMessage(group.message);
      else if (!matches.length) setMessage(payload.message || "Bu hesap için henüz yetkili varlık listelenemedi.");
      else setMessage(payload.message || "Yetkili hesaplar listelendi.");
    } catch {
      setMessage("Yetkili hesap listesi alınamadı.");
    } finally {
      setLoadingAccounts(false);
    }
  }

  async function saveSelected() {
    const selected = childAccounts.filter((item: any) => selectedIds.includes(item.id));
    if (!selected.length) { setMessage("Kaydetmek için en az bir hesap seçin."); return; }
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/integrations/accounts/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: oauthParent,
          company: companyId,
          accounts: selected.map((item: any) => ({
            provider: oauthParent,
            platform: activeProvider,
            provider_account_id: item.provider_account_id || item.account_id || item.asset_id || item.id,
            provider_account_name: item.provider_account_name || item.asset_name || item.name,
            account_type: item.account_type || item.asset_type || PROVIDER_ASSET_TYPE[activeProvider],
            metadata: item.metadata || item
          }))
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.supabaseError || payload.error || "Seçilen hesap kaydedilemedi.");
      setMessage(payload.message || "Hesap kaydedildi.");
      onConnectionsChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Seçilen hesap kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    if (!conn?.asset) return;
    setDisconnecting(true);
    setMessage("");
    try {
      const response = await fetch("/api/customer/integrations/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: companyId,
          provider: oauthParent,
          account_type: conn.asset.account_type || conn.asset.asset_type,
          provider_account_id: conn.asset.provider_account_id
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Bağlantı kesilemedi.");
      setMessage(payload.message || "Bağlantı kesildi.");
      setOauthInfo(null);
      onConnectionsChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Bağlantı kesilemedi.");
    } finally {
      setDisconnecting(false);
    }
  }

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div role="dialog" aria-modal="true" aria-label="Bağlantı Yönetimi" onMouseDown={onClose} className="fixed inset-0 z-[60] flex justify-end" style={{ background: "var(--admin-overlay, rgba(15,23,42,.55))" }}>
      <div onMouseDown={(event) => event.stopPropagation()} className="flex h-full w-full max-w-xl min-w-0 flex-col overflow-y-auto p-5" style={{ background: "var(--admin-surface, var(--admin-bg))", boxShadow: "var(--admin-shadow-card, var(--admin-shadow))" }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[.14em]" style={{ color: "var(--admin-text-muted)" }}>Bağlantı Yönetimi</p>
            <h2 className="mt-1 text-xl font-black" style={{ color: "var(--admin-text-primary)" }}>{PROVIDER_LABELS[activeProvider]}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Kapat" className="rounded-full p-2" style={{ background: "var(--admin-surface-soft)" }}><X size={18} /></button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {ADMIN_MANAGED_PROVIDERS.map((p) => {
            const Icon = PROVIDER_ICONS[p];
            return (
              <button key={p} type="button" onClick={() => setActiveProvider(p)} className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-black" style={{ borderColor: activeProvider === p ? "transparent" : "var(--admin-border)", background: activeProvider === p ? "var(--hk-cyan-soft, var(--admin-surface-soft))" : "transparent", color: "var(--admin-text-primary)" }}>
                <Icon size={14} /> {PROVIDER_LABELS[p]}
              </button>
            );
          })}
        </div>

        {conn && (
          <div className="mt-4 rounded-[16px] border p-4" style={{ borderColor: "var(--admin-border)" }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-black" style={{ color: "var(--admin-text-primary)" }}>Bağlantı Durumu</p>
              <AdminStatusBadge tone={conn.status === "connected" ? "success" : conn.status === "not_connected" ? "neutral" : "warning"}>{conn.statusLabel}</AdminStatusBadge>
            </div>
            <div className="mt-3 grid gap-1.5 text-xs" style={{ color: "var(--admin-text-secondary)" }}>
              <p><strong>{oauthParent === "google" ? "Google" : oauthParent === "tiktok" ? "TikTok" : "Meta"} girişi:</strong> {conn.parentConnected ? `Bağlı${conn.parentAccountName ? ` (${conn.parentAccountName})` : ""}` : "Bağlı değil"}</p>
              <p><strong>Seçili hesap:</strong> {conn.asset ? conn.asset.provider_account_name || conn.asset.provider_account_id : "Seçilmedi"}</p>
              <p><strong>İzinler:</strong> {(conn.asset?.metadata as any)?.scopes ? (conn.asset?.metadata as any).scopes.join(", ") : conn.scopeReady ? "Yeterli" : "Ek izin gerekiyor"}</p>
              <p><strong>Son senkronizasyon:</strong> {conn.lastSyncedAt ? new Date(conn.lastSyncedAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" }) : "Henüz yok"}</p>
              {conn.lastError && <p className="font-bold text-red-600"><strong>Hata:</strong> {conn.lastError}</p>}
              {!conn.scopeReady && conn.scopeNote && <p>{conn.scopeNote}</p>}
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <AdminButton variant="primary" compact onClick={() => { window.location.href = conn?.manageHref || "#"; }} disabled={!conn}>
            {conn?.parentConnected ? "Hesabı Yeniden Bağla" : "Bağla"}
          </AdminButton>
          <AdminButton variant="secondary" compact onClick={loadAccounts} loading={loadingAccounts} disabled={!conn?.parentConnected}>Yetkili Hesapları Listele</AdminButton>
          {conn?.asset && <AdminButton variant="danger" compact onClick={disconnect} loading={disconnecting}>Bağlantıyı Kes</AdminButton>}
        </div>

        {oauthParent === "meta" && metaDiagnostics && (
          <div className="mt-4 rounded-[14px] border p-3 text-xs" style={{ borderColor: "var(--admin-border)", color: "var(--admin-text-secondary)" }}>
            <p className="font-black" style={{ color: "var(--admin-text-primary)" }}>Meta bağlantı teşhisi</p>
            <p className="mt-1">Temel Facebook Login: {metaDiagnostics.ok ? "Başarılı" : "Kontrol gerekli"}</p>
            <p>Business API erişimi: {metaDiagnostics.businessApiReady ? "Hazır" : "Hazır değil / ayrı Business App gerekir"}</p>
            {metaDiagnostics.userMessage && <p className="mt-1">{metaDiagnostics.userMessage}</p>}
          </div>
        )}

        {childAccounts.length > 0 && (
          <div className="mt-4 rounded-[14px] border p-3" style={{ borderColor: "var(--admin-border)" }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-black" style={{ color: "var(--admin-text-primary)" }}>Yetkili Hesaplar</p>
              <AdminButton variant="success" compact onClick={saveSelected} loading={saving}>Seçilenleri Kaydet</AdminButton>
            </div>
            <div className="mt-2 max-h-64 overflow-auto rounded-[10px] border" style={{ borderColor: "var(--admin-border)" }}>
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead style={{ background: "var(--admin-surface-soft)", color: "var(--admin-text-muted)" }}>
                  <tr>
                    <th className="p-2">Seç</th>
                    <th className="p-2">Hesap adı</th>
                    <th className="p-2">Platform</th>
                    <th className="p-2">Varlık türü</th>
                    <th className="p-2">Hesap ID</th>
                    <th className="p-2">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {childAccounts.map((item: any) => (
                    <tr key={item.id} className="border-t" style={{ borderColor: "var(--admin-border)" }}>
                      <td className="p-2"><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} /></td>
                      <td className="p-2 font-bold" style={{ color: "var(--admin-text-primary)" }}>{item.provider_account_name || item.asset_name || item.name}</td>
                      <td className="p-2">{PROVIDER_LABELS[activeProvider]}</td>
                      <td className="p-2">{item.account_type || item.asset_type}</td>
                      <td className="p-2" style={{ color: "var(--admin-text-muted)" }}>{item.provider_account_id || item.account_id || item.asset_id}</td>
                      <td className="p-2">{item.status || "Seçilebilir"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {message && <p className="mt-4 rounded-[12px] border p-3 text-xs font-bold" style={{ borderColor: "var(--admin-border)", color: "var(--admin-text-secondary)" }}>{message}</p>}
      </div>
    </div>
  );
}
