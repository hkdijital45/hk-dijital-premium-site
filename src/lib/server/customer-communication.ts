import "server-only";

import { getSession, isCustomerRole, isStaffRole, type AppSession } from "@/lib/auth";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import { canSessionAccessResourceBranch } from "@/lib/server/branch-access";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";

export const conversationCategories = ["general", "package_upgrade", "advertising", "report_question", "content_revision", "technical_support", "finance", "billing", "new_service", "account_access", "other"] as const;
export const conversationPriorities = ["normal", "important", "urgent"] as const;
export const conversationStatuses = ["new", "admin_reply_required", "customer_reply_required", "in_review", "in_progress", "resolved", "closed", "archived"] as const;

export type ConversationCategory = (typeof conversationCategories)[number];
export type ConversationPriority = (typeof conversationPriorities)[number];
export type ConversationStatus = (typeof conversationStatuses)[number];

export type ConversationRow = {
  id: string;
  company_id: string;
  branch_id?: string | null;
  subject: string;
  category: ConversationCategory;
  priority: ConversationPriority;
  status: ConversationStatus;
  created_by?: string | null;
  assigned_to?: string | null;
  source?: string | null;
  related_entity_type?: string | null;
  related_entity_id?: string | null;
  last_message_at: string;
  archived_at?: string | null;
  customer_archived_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type CommunicationContext = {
  session: AppSession;
  isStaff: boolean;
  isCustomer: boolean;
  profileId: string;
};

export function sanitizeCommunicationText(value: unknown, maxLength = 12000) {
  return String(value || "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim()
    .slice(0, maxLength);
}

export function isUuid(value: unknown): value is string {
  return uuidPattern.test(String(value || ""));
}

export async function getCommunicationContext(): Promise<CommunicationContext | null> {
  const session = await getSession();
  if (!session?.profileId || (!isStaffRole(session.role) && !isCustomerRole(session.role))) return null;
  return {
    session,
    isStaff: isStaffRole(session.role),
    isCustomer: isCustomerRole(session.role),
    profileId: session.profileId
  };
}

export async function getAccessibleConversation(context: CommunicationContext, conversationId: string) {
  if (!isUuid(conversationId)) return null;
  const rows = await supabaseRest<ConversationRow[]>(
    `customer_conversations?id=eq.${conversationId}&select=*&limit=1`
  ).catch(() => []);
  const conversation = rows[0];
  if (!conversation) return null;
  if (context.isStaff) return conversation;
  if (!context.session.companyId || context.session.companyId !== conversation.company_id) return null;
  const canAccess = await canSessionAccessResourceBranch(
    context.session,
    conversation.company_id,
    conversation.branch_id
  );
  return canAccess ? conversation : null;
}

export async function createConversationNotification({
  conversation,
  messageId,
  title,
  message,
  showToCustomer
}: {
  conversation: ConversationRow;
  messageId: string;
  title: string;
  message: string;
  showToCustomer: boolean;
}) {
  const duplicate = await supabaseRest<Array<{ id: string }>>(
    `agency_notifications?source_module=eq.customer_communication&source_entity_type=eq.message&source_entity_id=eq.${messageId}&show_to_customer=eq.${showToCustomer}&select=id&limit=1`
  ).catch(() => []);
  if (duplicate.length) return;
  await supabaseRest("agency_notifications", {
    method: "POST",
    body: JSON.stringify({
      company_id: conversation.company_id,
      branch_id: conversation.branch_id || null,
      notification_type: showToCustomer ? "customer_message_reply" : "customer_message",
      title,
      message: message.slice(0, 500),
      priority: conversation.priority,
      source_module: "customer_communication",
      source_entity_type: "message",
      source_entity_id: messageId,
      action_url: showToCustomer
        ? `/musteri-paneli?module=support&conversation=${conversation.id}#destek`
        : `/hk-admin/iletisim-merkezi?conversation=${conversation.id}`,
      show_to_customer: showToCustomer,
      metadata: { conversation_id: conversation.id }
    })
  }).catch((error) => {
    const safe = getSafeSupabaseError(error);
    console.error("[customer-communication] Bildirim oluşturulamadı:", safe.detail);
  });
}

export async function recordConversationActivity(
  conversationId: string,
  actorId: string,
  activityType: string,
  detail: Record<string, unknown> = {}
) {
  await supabaseRest("conversation_activity", {
    method: "POST",
    body: JSON.stringify({
      conversation_id: conversationId,
      actor_id: actorId,
      activity_type: activityType,
      detail
    })
  }).catch(() => null);
}

export function categoryLabel(value: string) {
  return ({
    general: "Genel",
    package_upgrade: "Paket Yükseltme",
    advertising: "Reklam",
    report_question: "Rapor Sorusu",
    content_revision: "İçerik Revizyonu",
    technical_support: "Teknik Destek",
    finance: "Finans",
    billing: "Tahsilat",
    new_service: "Yeni Hizmet",
    account_access: "Hesap Erişimi",
    other: "Diğer"
  } as Record<string, string>)[value] || "Genel";
}
