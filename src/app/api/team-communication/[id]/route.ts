import { NextResponse } from "next/server";
import { getAccessibleTeamConversation, getTeamContext, recordTeamActivity, sanitizeTeamText, teamConversationStatuses, teamPriorities } from "@/lib/server/team-communication";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";

type UserRow = { id: string; full_name: string | null; email: string };

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getTeamContext();
  if (!context) return NextResponse.json({ error: "Ekip iletişimine erişim yetkiniz yok." }, { status: 403 });
  const { id } = await params;
  const conversation = await getAccessibleTeamConversation(context, id);
  if (!conversation) return NextResponse.json({ error: "Ekip konuşması bulunamadı veya erişim yetkiniz yok." }, { status: 404 });
  try {
    const [messages, participants, reads, mentions, pins, activity, attachments, users, companies] = await Promise.all([
      supabaseRest<Array<Record<string, unknown>>>(`team_messages?conversation_id=eq.${id}&deleted_at=is.null&select=*&order=created_at.asc&limit=300`),
      supabaseRest<Array<Record<string, unknown>>>(`team_conversation_participants?conversation_id=eq.${id}&select=*&order=joined_at.asc`),
      supabaseRest<Array<Record<string, unknown>>>(`team_message_reads?conversation_id=eq.${id}&select=message_id,user_id,read_at`),
      supabaseRest<Array<Record<string, unknown>>>(`team_message_mentions?conversation_id=eq.${id}&select=message_id,mentioned_user_id,created_at`),
      supabaseRest<Array<Record<string, unknown>>>(`team_message_pins?conversation_id=eq.${id}&unpinned_at=is.null&select=*&order=pinned_at.desc`),
      supabaseRest<Array<Record<string, unknown>>>(`team_conversation_activity?conversation_id=eq.${id}&select=*&order=created_at.desc&limit=120`),
      supabaseRest<Array<Record<string, unknown>>>(`team_attachments?conversation_id=eq.${id}&select=id,message_id,original_name,mime_type,file_size,created_at&order=created_at.asc`),
      supabaseRest<UserRow[]>("users?select=id,full_name,email"),
      conversation.company_id ? supabaseRest<Array<{ id: string; name: string }>>(`companies?id=eq.${conversation.company_id}&select=id,name`) : Promise.resolve([])
    ]);
    const names = new Map(users.map((user) => [user.id, user.full_name || user.email || "Ekip üyesi"]));
    return NextResponse.json({
      conversation: { ...conversation, company_name: companies[0]?.name || null },
      messages: messages.map((message) => ({ ...message, sender_name: names.get(String(message.sender_id || "")) || "Ekip üyesi" })),
      participants: participants.map((participant) => ({ ...participant, user_name: names.get(String(participant.user_id || "")) || "Ekip üyesi" })),
      reads,
      mentions: mentions.map((mention) => ({ ...mention, user_name: names.get(String(mention.mentioned_user_id || "")) || "Ekip üyesi" })),
      pins: pins.map((pin) => ({ ...pin, pinned_by_name: names.get(String(pin.pinned_by || "")) || "Ekip üyesi" })),
      activity: activity.map((item) => ({ ...item, actor_name: names.get(String(item.actor_id || "")) || "Sistem" })),
      attachments
    });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getTeamContext();
  if (!context) return NextResponse.json({ error: "Ekip iletişimine erişim yetkiniz yok." }, { status: 403 });
  const { id } = await params;
  const conversation = await getAccessibleTeamConversation(context, id);
  if (!conversation) return NextResponse.json({ error: "Ekip konuşması bulunamadı veya erişim yetkiniz yok." }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const action = sanitizeTeamText(body.action, 80);
  try {
    if (action === "archive") {
      await supabaseRest(`team_conversations?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ status: "archived", archived_at: new Date().toISOString() }) });
      await recordTeamActivity(id, context.profileId, "team_conversation_archived");
      return NextResponse.json({ ok: true });
    }
    if (action === "status") {
      const status = teamConversationStatuses.includes(body.status) ? body.status : "";
      if (!status) return NextResponse.json({ error: "Geçersiz durum." }, { status: 400 });
      await supabaseRest(`team_conversations?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ status, archived_at: status === "archived" ? new Date().toISOString() : null }) });
      await recordTeamActivity(id, context.profileId, "team_status_changed", { old_value: conversation.status, new_value: status });
      return NextResponse.json({ ok: true });
    }
    if (action === "priority") {
      const priority = teamPriorities.includes(body.priority) ? body.priority : "";
      if (!priority) return NextResponse.json({ error: "Geçersiz öncelik." }, { status: 400 });
      await supabaseRest(`team_conversations?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ priority }) });
      await recordTeamActivity(id, context.profileId, "team_priority_changed", { old_value: conversation.priority, new_value: priority });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Geçersiz işlem." }, { status: 400 });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title }, { status: 500 });
  }
}
