import { NextResponse } from "next/server";
import { getAccessibleTeamConversation, getTeamContext, isUuid } from "@/lib/server/team-communication";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";

type MessageRow = { id: string; conversation_id: string; sender_id: string; body: string; created_at: string };
type UserRow = { id: string; full_name: string | null; email: string };

function display(users: Map<string, UserRow>, id?: string | null) {
  if (!id) return "Bilinmiyor";
  const user = users.get(id);
  return user?.full_name || user?.email || "Ekip üyesi";
}

export async function GET(_request: Request, { params }: { params: Promise<{ messageId: string }> }) {
  const context = await getTeamContext();
  if (!context) return NextResponse.json({ error: "Ekip audit bilgilerine erişim yetkiniz yok." }, { status: 403 });
  const { messageId } = await params;
  if (!isUuid(messageId)) return NextResponse.json({ error: "Geçersiz mesaj kaydı." }, { status: 400 });
  try {
    const rows = await supabaseRest<MessageRow[]>(`team_messages?id=eq.${messageId}&deleted_at=is.null&select=id,conversation_id,sender_id,body,created_at&limit=1`);
    const message = rows[0];
    if (!message) return NextResponse.json({ error: "Mesaj bulunamadı." }, { status: 404 });
    const conversation = await getAccessibleTeamConversation(context, message.conversation_id);
    if (!conversation) return NextResponse.json({ error: "Ekip konuşması bulunamadı veya erişim yetkiniz yok." }, { status: 404 });
    const [reads, mentions, pins, activity, attachments] = await Promise.all([
      supabaseRest<Array<{ user_id: string; read_at: string }>>(`team_message_reads?message_id=eq.${message.id}&user_id=neq.${message.sender_id}&select=user_id,read_at&order=read_at.asc`),
      supabaseRest<Array<{ mentioned_user_id: string; created_at: string }>>(`team_message_mentions?message_id=eq.${message.id}&select=mentioned_user_id,created_at`),
      supabaseRest<Array<{ pinned_by: string | null; pinned_at: string; unpinned_at: string | null }>>(`team_message_pins?message_id=eq.${message.id}&select=pinned_by,pinned_at,unpinned_at`),
      supabaseRest<Array<{ id: string; actor_id: string | null; activity_type: string; detail: Record<string, unknown>; created_at: string }>>(`team_conversation_activity?conversation_id=eq.${conversation.id}&select=id,actor_id,activity_type,detail,created_at&order=created_at.desc&limit=120`),
      supabaseRest<Array<{ id: string }>>(`team_attachments?message_id=eq.${message.id}&select=id`)
    ]);
    const userIds = new Set<string>([message.sender_id]);
    reads.forEach((item) => userIds.add(item.user_id));
    mentions.forEach((item) => userIds.add(item.mentioned_user_id));
    pins.forEach((item) => item.pinned_by && userIds.add(item.pinned_by));
    activity.forEach((item) => item.actor_id && userIds.add(item.actor_id));
    const users = userIds.size ? await supabaseRest<UserRow[]>(`users?id=in.(${Array.from(userIds).join(",")})&select=id,full_name,email`) : [];
    const userMap = new Map(users.map((user) => [user.id, user]));
    return NextResponse.json({
      message: { sender_name: display(userMap, message.sender_id), sent_at: message.created_at, attachment_count: attachments.length },
      reads: {
        first_reader: reads[0] ? { user_name: display(userMap, reads[0].user_id), read_at: reads[0].read_at } : null,
        readers: reads.map((item) => ({ user_name: display(userMap, item.user_id), read_at: item.read_at })),
        total_readers: reads.length
      },
      mentions: mentions.map((item) => ({ user_name: display(userMap, item.mentioned_user_id), created_at: item.created_at })),
      pins: pins.map((item) => ({ pinned_by_name: display(userMap, item.pinned_by), pinned_at: item.pinned_at, unpinned_at: item.unpinned_at })),
      activity: activity.map((item) => ({ ...item, actor_name: display(userMap, item.actor_id), detail: item.detail || {} }))
    });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title }, { status: 500 });
  }
}
