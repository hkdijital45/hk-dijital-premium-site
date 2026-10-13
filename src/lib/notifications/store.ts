import "server-only";

import { supabaseRest } from "@/lib/supabase";

export const NOTIFICATION_CATEGORIES = ["lead", "customer", "proposal", "campaign", "reminder", "system"] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export type AdminNotification = {
  id: string;
  recipient_profile_id: string;
  category: NotificationCategory;
  title: string;
  message: string;
  related_type: string | null;
  related_id: string | null;
  deep_link: string | null;
  idempotency_key: string;
  read_at: string | null;
  created_at: string;
};

export type NotificationPreferences = {
  user_id: string;
  push_enabled: boolean;
  categories: Record<NotificationCategory, boolean>;
  updated_at: string;
};

const DEFAULT_CATEGORIES: Record<NotificationCategory, boolean> = {
  lead: true, customer: true, proposal: true, campaign: true, reminder: true, system: true
};

/** Finds the staff who should receive a broadcast-style event (e.g. "new
 * lead created") — every active admin/yonetici/editor/sales user, same
 * role set every other RLS policy this session uses for staff access. */
export async function staffRecipientIds(): Promise<string[]> {
  const rows = await supabaseRest<Array<{ id: string }>>(
    `users?role=in.(admin,yonetici,editor,sales)&is_active=eq.true&deleted_at=is.null&select=id`
  );
  return rows.map((r) => r.id);
}

export type CreateNotificationInput = {
  category: NotificationCategory;
  title: string;
  message?: string;
  relatedType?: string;
  relatedId?: string;
  deepLink?: string;
  idempotencyKey: string;
};

/** Inserts one notification row per recipient. Uses the PostgREST
 * ignore-duplicates upsert so re-firing the same logical event (same
 * idempotencyKey) for the same recipient is a silent no-op rather than a
 * duplicate row or a thrown unique-constraint error. */
export async function createNotificationForRecipients(recipientProfileIds: string[], input: CreateNotificationInput): Promise<AdminNotification[]> {
  const uniqueRecipients = Array.from(new Set(recipientProfileIds.filter(Boolean)));
  if (uniqueRecipients.length === 0) return [];
  const rows = uniqueRecipients.map((recipientProfileId) => ({
    recipient_profile_id: recipientProfileId,
    category: input.category,
    title: input.title,
    message: input.message || "",
    related_type: input.relatedType || null,
    related_id: input.relatedId || null,
    deep_link: input.deepLink || null,
    idempotency_key: input.idempotencyKey
  }));
  return supabaseRest<AdminNotification[]>(
    `admin_notifications?on_conflict=recipient_profile_id,idempotency_key`,
    {
      method: "POST",
      headers: { Prefer: "return=representation,resolution=ignore-duplicates" },
      body: JSON.stringify(rows)
    }
  );
}

export async function listNotifications(recipientProfileId: string, options: { unreadOnly?: boolean; category?: NotificationCategory; limit?: number } = {}): Promise<AdminNotification[]> {
  const params = new URLSearchParams();
  params.set("recipient_profile_id", `eq.${recipientProfileId}`);
  if (options.unreadOnly) params.set("read_at", "is.null");
  if (options.category) params.set("category", `eq.${options.category}`);
  params.set("order", "created_at.desc");
  params.set("limit", String(options.limit || 50));
  return supabaseRest<AdminNotification[]>(`admin_notifications?${params.toString()}`);
}

export async function unreadCount(recipientProfileId: string): Promise<number> {
  const rows = await supabaseRest<AdminNotification[]>(
    `admin_notifications?recipient_profile_id=eq.${recipientProfileId}&read_at=is.null&select=id&limit=500`
  );
  return rows.length;
}

export async function markNotificationRead(id: string, recipientProfileId: string): Promise<void> {
  await supabaseRest(`admin_notifications?id=eq.${encodeURIComponent(id)}&recipient_profile_id=eq.${recipientProfileId}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ read_at: new Date().toISOString() })
  });
}

export async function markAllNotificationsRead(recipientProfileId: string): Promise<void> {
  await supabaseRest(`admin_notifications?recipient_profile_id=eq.${recipientProfileId}&read_at=is.null`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ read_at: new Date().toISOString() })
  });
}

export async function getPreferences(userId: string): Promise<NotificationPreferences> {
  const rows = await supabaseRest<NotificationPreferences[]>(`notification_preferences?user_id=eq.${userId}&limit=1`);
  if (rows[0]) return { ...rows[0], categories: { ...DEFAULT_CATEGORIES, ...rows[0].categories } };
  return { user_id: userId, push_enabled: true, categories: DEFAULT_CATEGORIES, updated_at: new Date().toISOString() };
}

export async function upsertPreferences(userId: string, patch: { push_enabled?: boolean; categories?: Partial<Record<NotificationCategory, boolean>> }): Promise<NotificationPreferences> {
  const existing = await getPreferences(userId);
  const [row] = await supabaseRest<NotificationPreferences[]>(`notification_preferences?on_conflict=user_id`, {
    method: "POST",
    headers: { Prefer: "return=representation,resolution=merge-duplicates" },
    body: JSON.stringify({
      user_id: userId,
      push_enabled: patch.push_enabled !== undefined ? patch.push_enabled : existing.push_enabled,
      categories: patch.categories ? { ...existing.categories, ...patch.categories } : existing.categories
    })
  });
  return { ...row, categories: { ...DEFAULT_CATEGORIES, ...row.categories } };
}

export type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
  user_agent: string | null;
  is_active: boolean;
};

export async function listActiveSubscriptions(userId: string): Promise<PushSubscriptionRow[]> {
  return supabaseRest<PushSubscriptionRow[]>(`push_subscriptions?user_id=eq.${userId}&is_active=eq.true`);
}

export async function upsertSubscription(input: { userId: string; endpoint: string; p256dh: string; authKey: string; userAgent?: string }): Promise<PushSubscriptionRow> {
  const [row] = await supabaseRest<PushSubscriptionRow[]>(`push_subscriptions?on_conflict=endpoint`, {
    method: "POST",
    headers: { Prefer: "return=representation,resolution=merge-duplicates" },
    body: JSON.stringify({
      user_id: input.userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth_key: input.authKey,
      user_agent: input.userAgent || null,
      is_active: true,
      updated_at: new Date().toISOString()
    })
  });
  return row;
}

export async function deactivateSubscription(endpoint: string, ownerUserId?: string): Promise<void> {
  const ownerFilter = ownerUserId ? `&user_id=eq.${ownerUserId}` : "";
  await supabaseRest(`push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}${ownerFilter}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ is_active: false, updated_at: new Date().toISOString() })
  });
}

export async function recordDelivery(input: { notificationId: string; subscriptionId: string | null; status: "accepted" | "failed" | "skipped_preference" | "skipped_no_subscription"; errorCategory?: string }): Promise<void> {
  await supabaseRest("notification_deliveries", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      notification_id: input.notificationId,
      subscription_id: input.subscriptionId,
      status: input.status,
      error_category: input.errorCategory || null
    })
  });
}
