import "server-only";

import { getSession, isStaffRole, type AppSession } from "@/lib/auth";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";

export const teamConversationTypes = ["direct", "group", "customer_operation", "project", "task", "advertising", "content", "finance", "sales", "technical", "announcement", "general"] as const;
export const teamConversationStatuses = ["active", "waiting", "resolved", "archived"] as const;
export const teamPriorities = ["normal", "important", "urgent"] as const;
export const staffRoles = ["admin", "yonetici", "editor", "sales"];

export type TeamConversationType = (typeof teamConversationTypes)[number];
export type TeamConversationStatus = (typeof teamConversationStatuses)[number];
export type TeamPriority = (typeof teamPriorities)[number];

export type TeamContext = {
  session: AppSession;
  profileId: string;
  canAuditAll: boolean;
  canManageAll: boolean;
};

export type TeamConversationRow = {
  id: string;
  title: string;
  conversation_type: TeamConversationType;
  company_id?: string | null;
  branch_id?: string | null;
  related_entity_type?: string | null;
  related_entity_id?: string | null;
  source_customer_conversation_id?: string | null;
  priority: TeamPriority;
  status: TeamConversationStatus;
  created_by?: string | null;
  last_message_at: string;
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type TeamMessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  metadata?: Record<string, unknown>;
  idempotency_key?: string | null;
  created_at: string;
};

export function isUuid(value: unknown): value is string {
  return uuidPattern.test(String(value || ""));
}

export function sanitizeTeamText(value: unknown, maxLength = 12000) {
  return String(value || "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim()
    .slice(0, maxLength);
}

export async function getTeamContext(): Promise<TeamContext | null> {
  const session = await getSession();
  if (!session?.profileId || !isStaffRole(session.role)) return null;
  return {
    session,
    profileId: session.profileId,
    canAuditAll: ["admin", "yonetici"].includes(session.role),
    canManageAll: ["admin", "yonetici"].includes(session.role)
  };
}

export async function getActiveStaff() {
  return supabaseRest<Array<{ id: string; full_name: string | null; email: string; role: string }>>(
    `users?is_active=eq.true&deleted_at=is.null&role=in.(${staffRoles.join(",")})&select=id,full_name,email,role&order=full_name.asc`
  );
}

export async function isTeamParticipant(context: TeamContext, conversationId: string) {
  if (context.canAuditAll) return true;
  const rows = await supabaseRest<Array<{ id: string }>>(
    `team_conversation_participants?conversation_id=eq.${conversationId}&user_id=eq.${context.profileId}&left_at=is.null&select=id&limit=1`
  ).catch(() => []);
  return Boolean(rows[0]);
}

export async function getAccessibleTeamConversation(context: TeamContext, conversationId: string) {
  if (!isUuid(conversationId)) return null;
  const rows = await supabaseRest<TeamConversationRow[]>(
    `team_conversations?id=eq.${conversationId}&select=*&limit=1`
  ).catch(() => []);
  const conversation = rows[0];
  if (!conversation) return null;
  if (context.canAuditAll) return conversation;
  return await isTeamParticipant(context, conversation.id) ? conversation : null;
}

export async function recordTeamActivity(
  conversationId: string,
  actorId: string,
  activityType: string,
  detail: Record<string, unknown> = {}
) {
  await supabaseRest("team_conversation_activity", {
    method: "POST",
    body: JSON.stringify({ conversation_id: conversationId, actor_id: actorId, activity_type: activityType, detail })
  }).catch(() => null);
}

export async function createTeamNotification({
  conversation,
  messageId,
  targetUserId,
  title,
  message,
  type = "team_message"
}: {
  conversation: TeamConversationRow;
  messageId?: string | null;
  targetUserId: string;
  title: string;
  message: string;
  type?: string;
}) {
  const duplicateKey = messageId || conversation.id;
  const duplicate = await supabaseRest<Array<{ id: string }>>(
    `agency_notifications?source_module=eq.team_communication&source_entity_type=eq.${type}&source_entity_id=eq.${duplicateKey}&metadata->>target_user_id=eq.${targetUserId}&select=id&limit=1`
  ).catch(() => []);
  if (duplicate.length) return;
  await supabaseRest("agency_notifications", {
    method: "POST",
    body: JSON.stringify({
      company_id: conversation.company_id || null,
      branch_id: conversation.branch_id || null,
      notification_type: type,
      title,
      message: message.slice(0, 500),
      priority: conversation.priority,
      source_module: "team_communication",
      source_entity_type: type,
      source_entity_id: duplicateKey,
      action_url: `/hk-admin/iletisim-merkezi?channel=team&conversation=${conversation.id}`,
      show_to_customer: false,
      metadata: { conversation_id: conversation.id, target_user_id: targetUserId }
    })
  }).catch((error) => {
    const safe = getSafeSupabaseError(error);
    console.error("[team-communication] Bildirim oluşturulamadı:", safe.detail);
  });
}
