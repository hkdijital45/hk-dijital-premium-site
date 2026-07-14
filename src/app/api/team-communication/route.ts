import { NextResponse } from "next/server";
import { checkOperationalCustomer } from "@/lib/server/customer-visibility";
import {
  createTeamNotification,
  getActiveStaff,
  getTeamContext,
  isUuid,
  recordTeamActivity,
  sanitizeTeamText,
  teamConversationStatuses,
  teamConversationTypes,
  teamPriorities,
  type TeamConversationRow,
  type TeamConversationType
} from "@/lib/server/team-communication";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";

type TeamMessage = { id: string; conversation_id: string; sender_id: string; body: string; created_at: string };
type Participant = { conversation_id: string; user_id: string; role: string; left_at?: string | null };

function cleanIds(value: unknown) {
  return Array.isArray(value) ? [...new Set(value.filter(isUuid))] : [];
}

async function existingDirectConversation(currentUserId: string, otherUserId: string) {
  const mine = await supabaseRest<Array<{ conversation_id: string }>>(
    `team_conversation_participants?user_id=eq.${currentUserId}&left_at=is.null&select=conversation_id`
  ).catch(() => []);
  const ids = mine.map((item) => item.conversation_id);
  if (!ids.length) return null;
  const rows = await supabaseRest<Array<{ conversation_id: string }>>(
    `team_conversation_participants?conversation_id=in.(${ids.join(",")})&user_id=eq.${otherUserId}&left_at=is.null&select=conversation_id`
  ).catch(() => []);
  if (!rows[0]) return null;
  const conversations = await supabaseRest<TeamConversationRow[]>(
    `team_conversations?id=eq.${rows[0].conversation_id}&conversation_type=eq.direct&archived_at=is.null&select=*&limit=1`
  ).catch(() => []);
  return conversations[0] || null;
}

export async function GET(request: Request) {
  const context = await getTeamContext();
  if (!context) return NextResponse.json({ error: "Ekip iletişimine erişim yetkiniz yok." }, { status: 403 });
  const query = new URL(request.url).searchParams;
  const view = query.get("view") || "mine";
  const type = query.get("type") || "";
  const status = query.get("status") || "";
  const search = sanitizeTeamText(query.get("search"), 80).toLocaleLowerCase("tr");
  const unreadOnly = query.get("unread") === "true";
  try {
    const participantRows = await supabaseRest<Participant[]>(
      `team_conversation_participants?user_id=eq.${context.profileId}&left_at=is.null&select=conversation_id,user_id,role,left_at`
    ).catch(() => []);
    const mineIds = participantRows.map((item) => item.conversation_id);
    const filters: string[] = [];
    if (view !== "archived") filters.push("archived_at=is.null");
    if (status && teamConversationStatuses.includes(status as (typeof teamConversationStatuses)[number])) filters.push(`status=eq.${status}`);
    if (type && teamConversationTypes.includes(type as TeamConversationType)) filters.push(`conversation_type=eq.${type}`);
    if (!context.canAuditAll || view === "mine") filters.push(mineIds.length ? `id=in.(${mineIds.join(",")})` : "id=eq.00000000-0000-0000-0000-000000000000");
    const conversations = await supabaseRest<TeamConversationRow[]>(
      `team_conversations?${filters.join("&")}&select=*&order=last_message_at.desc&limit=200`
    );
    const visible = conversations.filter((item) => !search || item.title.toLocaleLowerCase("tr").includes(search));
    const ids = visible.map((item) => item.id);
    const [messages, reads, participants, users, companies, staff] = ids.length
      ? await Promise.all([
        supabaseRest<TeamMessage[]>(`team_messages?conversation_id=in.(${ids.join(",")})&deleted_at=is.null&select=id,conversation_id,sender_id,body,created_at&order=created_at.asc`),
        supabaseRest<Array<{ message_id: string }>>(`team_message_reads?conversation_id=in.(${ids.join(",")})&user_id=eq.${context.profileId}&select=message_id`),
        supabaseRest<Participant[]>(`team_conversation_participants?conversation_id=in.(${ids.join(",")})&left_at=is.null&select=conversation_id,user_id,role,left_at`),
        supabaseRest<Array<{ id: string; full_name: string | null; email: string }>>("users?select=id,full_name,email"),
        supabaseRest<Array<{ id: string; name: string }>>(`companies?id=in.(${[...new Set(visible.map((item) => item.company_id).filter(Boolean))].join(",") || "00000000-0000-0000-0000-000000000000"})&select=id,name`),
        getActiveStaff()
      ])
      : [[], [], [], [], [], await getActiveStaff()];
    const readIds = new Set(reads.map((item) => item.message_id));
    const userNames = new Map(users.map((item) => [item.id, item.full_name || item.email || "Ekip üyesi"]));
    const companyNames = new Map(companies.map((item) => [item.id, item.name]));
    const result = visible.map((conversation) => {
      const ownMessages = messages.filter((item) => item.conversation_id === conversation.id);
      const latest = ownMessages.at(-1) || null;
      const memberNames = participants.filter((item) => item.conversation_id === conversation.id).map((item) => userNames.get(item.user_id) || "Ekip üyesi");
      const unreadCount = ownMessages.filter((message) => message.sender_id !== context.profileId && !readIds.has(message.id)).length;
      return {
        ...conversation,
        company_name: conversation.company_id ? companyNames.get(conversation.company_id) || "Müşteri" : null,
        participant_names: memberNames,
        participant_count: memberNames.length,
        latest_message: latest?.body || "",
        unread_count: unreadCount,
        message_count: ownMessages.length
      };
    }).filter((item) => !unreadOnly || item.unread_count > 0);
    return NextResponse.json({ conversations: result, staff });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getTeamContext();
  if (!context) return NextResponse.json({ error: "Ekip iletişimine erişim yetkiniz yok." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const conversationType = teamConversationTypes.includes(body.conversationType) ? body.conversationType as TeamConversationType : "general";
  const priority = teamPriorities.includes(body.priority) ? body.priority : "normal";
  const title = sanitizeTeamText(body.title, 180);
  const messageBody = sanitizeTeamText(body.message);
  const participantIds = cleanIds(body.participantIds).filter((id) => id !== context.profileId);
  const companyId = isUuid(body.companyId) ? body.companyId : null;
  const sourceCustomerConversationId = isUuid(body.sourceCustomerConversationId) ? body.sourceCustomerConversationId : null;
  if (!title && conversationType !== "direct") return NextResponse.json({ error: "Konuşma başlığı zorunludur." }, { status: 400 });
  if (!messageBody) return NextResponse.json({ error: "İlk mesaj boş bırakılamaz." }, { status: 400 });
  if (conversationType === "direct" && participantIds.length !== 1) return NextResponse.json({ error: "Birebir görüşme için bir ekip üyesi seçin." }, { status: 400 });
  if (conversationType !== "direct" && participantIds.length < 1) return NextResponse.json({ error: "En az bir ekip üyesi seçin." }, { status: 400 });
  try {
    const staff = await getActiveStaff();
    const staffIds = new Set(staff.map((user) => user.id));
    if (participantIds.some((id) => !staffIds.has(id))) return NextResponse.json({ error: "Yalnız aktif ekip kullanıcıları eklenebilir." }, { status: 400 });
    if (companyId) {
      const customerCheck = await checkOperationalCustomer(companyId);
      if (!customerCheck.ok) return NextResponse.json({ error: customerCheck.error }, { status: customerCheck.status });
    }
    if (conversationType === "direct") {
      const existing = await existingDirectConversation(context.profileId, participantIds[0]);
      if (existing) return NextResponse.json({ ok: true, conversationId: existing.id, duplicate: true });
    }
    if (sourceCustomerConversationId) {
      const existing = await supabaseRest<Array<{ id: string }>>(
        `team_conversations?source_customer_conversation_id=eq.${sourceCustomerConversationId}&status=neq.archived&select=id&limit=1`
      ).catch(() => []);
      if (existing[0]) return NextResponse.json({ ok: true, conversationId: existing[0].id, duplicate: true });
    }
    const now = new Date().toISOString();
    const rows = await supabaseRest<TeamConversationRow[]>("team_conversations", {
      method: "POST",
      body: JSON.stringify({
        title: title || "Birebir ekip görüşmesi",
        conversation_type: conversationType,
        company_id: companyId,
        branch_id: isUuid(body.branchId) ? body.branchId : null,
        related_entity_type: sanitizeTeamText(body.relatedEntityType, 80) || null,
        related_entity_id: isUuid(body.relatedEntityId) ? body.relatedEntityId : null,
        source_customer_conversation_id: sourceCustomerConversationId,
        priority,
        status: "active",
        created_by: context.profileId,
        last_message_at: now
      })
    });
    const conversation = rows[0];
    if (!conversation) throw new Error("Ekip konuşması oluşturulamadı.");
    const members = [context.profileId, ...participantIds];
    await supabaseRest("team_conversation_participants", {
      method: "POST",
      body: JSON.stringify(members.map((userId, index) => ({ conversation_id: conversation.id, user_id: userId, role: index === 0 ? "owner" : "member", added_by: context.profileId })))
    });
    const messageRows = await supabaseRest<Array<{ id: string }>>("team_messages", {
      method: "POST",
      body: JSON.stringify({ conversation_id: conversation.id, sender_id: context.profileId, body: messageBody, metadata: {} })
    });
    const message = messageRows[0];
    await supabaseRest("team_message_reads?on_conflict=message_id,user_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ conversation_id: conversation.id, message_id: message.id, user_id: context.profileId, read_at: now })
    });
    await recordTeamActivity(conversation.id, context.profileId, "team_conversation_created", { conversation_type: conversationType, participant_count: members.length });
    if (sourceCustomerConversationId) await supabaseRest("conversation_activity", { method: "POST", body: JSON.stringify({ conversation_id: sourceCustomerConversationId, actor_id: context.profileId, activity_type: "team_discussion_started", detail: { related_team_conversation_id: conversation.id } }) }).catch(() => null);
    await Promise.all(participantIds.map((userId) => createTeamNotification({ conversation, messageId: message.id, targetUserId: userId, title: "Yeni ekip görüşmesine eklendiniz", message: messageBody, type: conversationType === "announcement" ? "team_announcement" : "team_message" })));
    return NextResponse.json({ ok: true, conversationId: conversation.id, messageId: message.id }, { status: 201 });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title }, { status: 500 });
  }
}
