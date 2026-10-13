import "server-only";

import webpush from "web-push";
import { listActiveSubscriptions, deactivateSubscription, recordDelivery, type PushSubscriptionRow } from "./store";

export function vapidConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let vapidReady = false;
function ensureVapid() {
  if (vapidReady) return;
  if (!vapidConfigured()) throw new Error("VAPID yapılandırılmadı (NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY eksik).");
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:destek@hkdijital.com.tr",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  vapidReady = true;
}

export type PushPayload = {
  title: string;
  body: string;
  deepLink?: string;
  category?: string;
  notificationId?: string;
};

export type DeliveryOutcome = {
  subscriptionId: string;
  requestAccepted: boolean;
  pushServiceAccepted: boolean;
  errorCategory?: string;
};

/** Real server-side push via web-push (VAPID). "pushServiceAccepted" means
 * the push service (Apple/Google/Mozilla's endpoint) accepted the
 * message for delivery — it is NOT proof the device received or
 * displayed it. Device receipt can never be confirmed from this server;
 * callers must never translate pushServiceAccepted into "delivered to
 * the phone". An expired/gone subscription (404/410) is deactivated so
 * future dispatches stop retrying it. */
export async function sendPushToSubscription(sub: PushSubscriptionRow, payload: PushPayload): Promise<DeliveryOutcome> {
  ensureVapid();
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
      JSON.stringify(payload)
    );
    await recordDelivery({ notificationId: payload.notificationId || "", subscriptionId: sub.id, status: "accepted" });
    return { subscriptionId: sub.id, requestAccepted: true, pushServiceAccepted: true };
  } catch (error) {
    const statusCode = (error as { statusCode?: number })?.statusCode;
    if (statusCode === 404 || statusCode === 410) {
      await deactivateSubscription(sub.endpoint);
    }
    const errorCategory = statusCode ? `http_${statusCode}` : "unknown";
    await recordDelivery({ notificationId: payload.notificationId || "", subscriptionId: sub.id, status: "failed", errorCategory });
    return { subscriptionId: sub.id, requestAccepted: true, pushServiceAccepted: false, errorCategory };
  }
}

/** Dispatches to every active subscription for a user. Returns per-device
 * outcomes so callers (the test-notification endpoint in particular) can
 * report honestly instead of collapsing everything into "Delivered". */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<DeliveryOutcome[]> {
  if (!vapidConfigured()) return [];
  const subscriptions = await listActiveSubscriptions(userId);
  if (subscriptions.length === 0) return [];
  return Promise.all(subscriptions.map((sub) => sendPushToSubscription(sub, payload)));
}
