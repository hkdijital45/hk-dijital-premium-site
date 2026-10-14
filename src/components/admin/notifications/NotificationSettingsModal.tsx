"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, BellOff, X, Smartphone, CircleCheck, CircleAlert } from "lucide-react";
import { getPushSupportState, isStandalone, getPermission, enablePushNotifications, disablePushNotifications, getActiveSubscriptionEndpoint } from "@/lib/notifications/client";
import { forceTextColor } from "@/lib/admin-style";

function getAdminPortalRoot(): Element {
  return document.querySelector(".hk-admin") || document.body;
}

type Preferences = { push_enabled: boolean; categories: Record<string, boolean> };

const CATEGORY_LABELS: Record<string, string> = {
  lead: "Lead Bildirimleri", customer: "Müşteri Bildirimleri", proposal: "Teklif Bildirimleri",
  campaign: "Kampanya Bildirimleri", reminder: "Hatırlatma Bildirimleri", system: "Sistem Bildirimleri"
};

/** Bildirim Ayarları — reached from the gear icon inside the Bildirim
 * Merkezi panel (the existing bell icon's drawer). Permission is only
 * ever requested from inside handleEnable(), itself only reachable by a
 * real click on this modal's own button — never on mount. */
export function NotificationSettingsModal({ onClose }: { onClose: () => void }) {
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/notifications/preferences").then((r) => r.json()).then((data) => setPreferences(data.preferences)).catch(() => {});
    getActiveSubscriptionEndpoint().then((endpoint) => setSubscribed(Boolean(endpoint)));
  }, []);

  async function savePreferences(patch: Partial<Preferences>) {
    const response = await fetch("/api/admin/notifications/preferences", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch)
    });
    const data = await response.json();
    if (data.preferences) setPreferences(data.preferences);
  }

  async function handleEnable() {
    setBusy(true); setError(null);
    const result = await enablePushNotifications();
    setBusy(false);
    if (result.ok) {
      setSubscribed(true);
      await savePreferences({ push_enabled: true });
    } else {
      const messages: Record<string, string> = {
        unsupported: "Bu tarayıcı/cihaz push bildirimlerini desteklemiyor.",
        permission_denied: "Bildirim izni reddedildi. iOS Ayarlar > Bildirimler'den izin verebilirsiniz.",
        no_public_key: "Sunucuda VAPID anahtarı yapılandırılmamış — HK Admin yöneticisiyle iletişime geçin.",
        subscribe_failed: "Push aboneliği oluşturulamadı.",
        save_failed: "Abonelik sunucuya kaydedilemedi."
      };
      setError(messages[result.reason] || "Bilinmeyen bir hata oluştu.");
    }
  }

  async function handleDisable() {
    setBusy(true);
    await disablePushNotifications();
    setSubscribed(false);
    setBusy(false);
  }

  async function handleTest() {
    setBusy(true); setTestResult(null); setError(null);
    try {
      const response = await fetch("/api/admin/notifications/test", { method: "POST" });
      const data = await response.json();
      if (!response.ok) { setError(data.error || "Test bildirimi gönderilemedi."); setBusy(false); return; }
      const acceptedCount = data.devices?.filter((d: { pushServiceAccepted: boolean }) => d.pushServiceAccepted).length || 0;
      setTestResult(`${acceptedCount}/${data.devices?.length || 0} cihaz için push servisi isteği kabul etti. ${data.note}`);
    } catch {
      setError("Test bildirimi gönderilemedi.");
    }
    setBusy(false);
  }

  const supportState = getPushSupportState();
  const standalone = isStandalone();
  const permission = getPermission();

  const content = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" className="w-full max-w-[520px] max-h-[88vh] overflow-y-auto rounded-[14px] border p-6" style={{ background: "var(--admin-surface)", borderColor: "var(--admin-border)", color: "var(--admin-text-primary)" }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-[10px]" style={{ background: "linear-gradient(135deg,#7c3aed,#0891b2)" }}><Bell size={18} className="text-white" /></span>
            <div>
              <h2 className="text-base font-black uppercase tracking-[.04em]">Bildirim Ayarları</h2>
              <p className="text-xs" style={{ color: "var(--admin-text-muted)" }}>Push bildirimleri ve kategori tercihleri</p>
            </div>
          </div>
          <button onClick={onClose} className="admin-icon-action grid size-9 place-items-center rounded-[8px]" aria-label="Kapat"><X size={16} /></button>
        </div>

        {supportState === "unsupported" && (
          <p className="mt-5 rounded-[10px] border p-3 text-sm" style={{ borderColor: "#fecdd3", background: "#fff1f2", color: "#9f1239" }}>
            Bu tarayıcı push bildirimlerini desteklemiyor.
          </p>
        )}

        {supportState === "supported" && !standalone && (
          <div className="mt-5 rounded-[10px] border p-4 text-sm leading-6" style={{ borderColor: "#bae6fd", background: "#eff8ff", color: "#1e3a8a" }}>
            <p className="font-black">iPhone&apos;da bildirim almak için önce Ana Ekrana ekleyin:</p>
            <ol className="mt-2 list-decimal pl-5">
              <li>HK Admin&apos;i Safari&apos;de açın.</li>
              <li>Paylaş düğmesine dokunun.</li>
              <li>&quot;Ana Ekrana Ekle&quot;yi seçin.</li>
              <li>Ana ekrandaki HK Admin simgesinden uygulamayı açın.</li>
              <li>Bu ekrana tekrar gelip &quot;Bildirimleri Etkinleştir&quot;e dokunun.</li>
              <li>iOS izin isteğini onaylayın.</li>
            </ol>
          </div>
        )}

        {supportState === "supported" && (
          <div className="mt-5 grid gap-3">
            <div className="flex items-center justify-between rounded-[10px] border p-3" style={{ borderColor: "var(--admin-border)" }}>
              <div className="flex items-center gap-2 text-sm font-bold">
                <Smartphone size={16} />
                {subscribed ? "Bu cihaz bildirime abone" : "Bu cihaz abone değil"}
                {permission === "denied" && <CircleAlert size={14} className="text-red-600" />}
              </div>
              {subscribed ? (
                <button disabled={busy} onClick={handleDisable} className="rounded-[8px] px-3 py-1.5 text-xs font-black" style={{ background: "var(--admin-surface-soft)", color: "var(--admin-text-primary)" }}>
                  <BellOff size={13} className="mr-1 inline" /> Devre Dışı Bırak
                </button>
              ) : (
                <button disabled={busy || permission === "denied"} onClick={handleEnable} className="rounded-[8px] px-3 py-1.5 text-xs font-black" style={forceTextColor({ background: "#0e7490", color: "#fff" })}>
                  Bildirimleri Etkinleştir
                </button>
              )}
            </div>

            {subscribed && (
              <button disabled={busy} onClick={handleTest} className="rounded-[8px] border px-3 py-2 text-xs font-black" style={{ borderColor: "var(--admin-border)" }}>
                Test Bildirimi Gönder
              </button>
            )}
            {testResult && <p className="flex items-start gap-1.5 text-xs" style={{ color: "var(--admin-text-secondary)" }}><CircleCheck size={14} className="mt-0.5 shrink-0 text-emerald-600" /> {testResult}</p>}
            {error && <p className="text-xs font-bold text-red-600">{error}</p>}
          </div>
        )}

        {preferences && (
          <div className="mt-6 grid gap-2">
            <p className="text-xs font-black uppercase tracking-[.06em]" style={{ color: "var(--admin-text-muted)" }}>Kategori Tercihleri</p>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <label key={key} className="flex items-center justify-between rounded-[8px] border px-3 py-2 text-sm" style={{ borderColor: "var(--admin-border)" }}>
                {label}
                <input
                  type="checkbox"
                  checked={Boolean(preferences.categories?.[key] ?? true)}
                  onChange={(e) => savePreferences({ categories: { ...preferences.categories, [key]: e.target.checked } })}
                />
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(content, getAdminPortalRoot());
}
