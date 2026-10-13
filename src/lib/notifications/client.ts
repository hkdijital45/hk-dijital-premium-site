"use client";

// Client-side Web Push helpers. Every function here is only ever called
// from an explicit user click (the "Bildirimleri Etkinleştir" button in
// Bildirim Ayarları) — never on page load, per iOS Safari's own
// requirement that the permission prompt only appears after a genuine
// user gesture, and per this project's own rule against auto-requesting
// permission.

export type PushSupportState = "unsupported" | "supported";

export function getPushSupportState(): PushSupportState {
  if (typeof window === "undefined") return "unsupported";
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  return supported ? "supported" : "unsupported";
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
}

export function getPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/hk-admin/");
  if (existing) return existing;
  return navigator.serviceWorker.register("/sw.js", { scope: "/hk-admin/" });
}

export type SubscribeResult =
  | { ok: true }
  | { ok: false; reason: "unsupported" | "not_standalone" | "permission_denied" | "no_public_key" | "subscribe_failed" | "save_failed"; detail?: string };

/** Must be called synchronously from within a click handler (the browser
 * ties the permission prompt to the user-gesture call stack) — never
 * from a useEffect or on mount. */
export async function enablePushNotifications(): Promise<SubscribeResult> {
  if (getPushSupportState() === "unsupported") return { ok: false, reason: "unsupported" };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "permission_denied" };

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) return { ok: false, reason: "no_public_key" };

  try {
    const registration = await registerServiceWorker();
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource
    });
    const json = subscription.toJSON();
    const response = await fetch("/api/admin/notifications/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys, userAgent: navigator.userAgent })
    });
    if (!response.ok) return { ok: false, reason: "save_failed" };
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: "subscribe_failed", detail: error instanceof Error ? error.message : String(error) };
  }
}

export async function disablePushNotifications(): Promise<void> {
  if (getPushSupportState() === "unsupported") return;
  const registration = await navigator.serviceWorker.getRegistration("/hk-admin/");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe().catch(() => {});
  await fetch("/api/admin/notifications/push/unsubscribe", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint })
  }).catch(() => {});
}

export async function getActiveSubscriptionEndpoint(): Promise<string | null> {
  if (getPushSupportState() === "unsupported") return null;
  const registration = await navigator.serviceWorker.getRegistration("/hk-admin/");
  const subscription = await registration?.pushManager.getSubscription();
  return subscription?.endpoint || null;
}
