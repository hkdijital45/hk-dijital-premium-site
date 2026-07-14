import { NextResponse } from "next/server";
import { getAccessibleConversation, getCommunicationContext, isUuid } from "@/lib/server/customer-communication";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  sender_type: "customer" | "staff";
  body: string;
  created_at: string;
};

type UserRow = { id: string; full_name: string | null; email?: string | null; role: string };
type ReadRow = { message_id: string; user_id: string; read_at: string };
type ActivityRow = { id: string; actor_id: string | null; activity_type: string; detail: Record<string, unknown>; created_at: string };
type AssignmentRow = { assigned_to: string | null; assigned_by: string | null; created_at: string };

function displayUser(users: Map<string, UserRow>, userId?: string | null) {
  if (!userId) return "Bilinmiyor";
  const user = users.get(userId);
  return user?.full_name || user?.email || "Ekip üyesi";
}

function minutesBetween(start?: string, end?: string) {
  if (!start || !end) return null;
  const diff = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(diff) || diff < 0) return null;
  return Math.round(diff / 60000);
}

export async function GET(_request: Request, { params }: { params: Promise<{ messageId: string }> }) {
  const context = await getCommunicationContext();
  if (!context) return NextResponse.json({ error: "Oturum veya erişim yetkisi bulunamadı." }, { status: 401 });
  if (!context.isStaff) return NextResponse.json({ error: "Mesaj denetim bilgileri yalnızca admin ekibine açıktır." }, { status: 403 });

  const { messageId } = await params;
  if (!isUuid(messageId)) return NextResponse.json({ error: "Geçersiz mesaj kaydı." }, { status: 400 });

  try {
    const messageRows = await supabaseRest<MessageRow[]>(
      `customer_messages?id=eq.${messageId}&deleted_at=is.null&select=id,conversation_id,sender_id,sender_type,body,created_at&limit=1`
    );
    const message = messageRows[0];
    if (!message) return NextResponse.json({ error: "Mesaj bulunamadı." }, { status: 404 });

    const conversation = await getAccessibleConversation(context, message.conversation_id);
    if (!conversation) return NextResponse.json({ error: "Konuşma bulunamadı veya erişim yetkiniz yok." }, { status: 404 });

    const [messages, reads, activity, assignments, attachments] = await Promise.all([
      supabaseRest<MessageRow[]>(`customer_messages?conversation_id=eq.${conversation.id}&deleted_at=is.null&select=id,conversation_id,sender_id,sender_type,body,created_at&order=created_at.asc`),
      supabaseRest<ReadRow[]>(`conversation_reads?conversation_id=eq.${conversation.id}&select=message_id,user_id,read_at&order=read_at.asc`),
      supabaseRest<ActivityRow[]>(`conversation_activity?conversation_id=eq.${conversation.id}&select=id,actor_id,activity_type,detail,created_at&order=created_at.desc&limit=120`),
      supabaseRest<AssignmentRow[]>(`conversation_assignments?conversation_id=eq.${conversation.id}&select=assigned_to,assigned_by,created_at&order=created_at.desc&limit=50`),
      supabaseRest<Array<{ id: string; message_id: string }>>(`conversation_attachments?conversation_id=eq.${conversation.id}&select=id,message_id`)
    ]);

    const userIds = new Set<string>();
    messages.forEach((item) => item.sender_id && userIds.add(item.sender_id));
    reads.forEach((item) => item.user_id && userIds.add(item.user_id));
    activity.forEach((item) => item.actor_id && userIds.add(item.actor_id));
    assignments.forEach((item) => {
      if (item.assigned_by) userIds.add(item.assigned_by);
      if (item.assigned_to) userIds.add(item.assigned_to);
    });
    const users = userIds.size
      ? await supabaseRest<UserRow[]>(`users?id=in.(${Array.from(userIds).join(",")})&select=id,full_name,email,role`)
      : [];
    const userMap = new Map(users.map((user) => [user.id, user]));
    const staffIds = new Set(users.filter((user) => ["admin", "yonetici", "editor", "sales"].includes(user.role)).map((user) => user.id));

    const currentIndex = messages.findIndex((item) => item.id === message.id);
    const nextCustomerIndex = currentIndex >= 0
      ? messages.findIndex((item, index) => index > currentIndex && item.sender_type === "customer")
      : -1;
    const replyWindow = currentIndex >= 0
      ? messages.slice(currentIndex + 1, nextCustomerIndex === -1 ? undefined : nextCustomerIndex).filter((item) => item.sender_type === "staff")
      : [];
    const firstReply = message.sender_type === "customer" ? replyWindow[0] || null : null;
    const lastReply = message.sender_type === "customer" ? replyWindow.at(-1) || null : null;
    const messageReads = reads
      .filter((item) => item.message_id === message.id && item.user_id !== message.sender_id && staffIds.has(item.user_id))
      .map((item) => ({ user_id: item.user_id, user_name: displayUser(userMap, item.user_id), read_at: item.read_at }))
      .sort((a, b) => new Date(a.read_at).getTime() - new Date(b.read_at).getTime());
    const relevantActivity = activity.map((item) => ({
      id: item.id,
      actor_id: item.actor_id,
      actor_name: displayUser(userMap, item.actor_id),
      activity_type: item.activity_type,
      detail: item.detail || {},
      created_at: item.created_at
    }));

    return NextResponse.json({
      message: {
        sender_name: displayUser(userMap, message.sender_id),
        sender_type: message.sender_type,
        sent_at: message.created_at,
        attachment_count: attachments.filter((item) => item.message_id === message.id).length
      },
      reads: {
        first_reader: messageReads[0] || null,
        readers: messageReads,
        total_staff_readers: messageReads.length
      },
      replies: {
        first_reply: firstReply ? { user_name: displayUser(userMap, firstReply.sender_id), sent_at: firstReply.created_at, response_minutes: minutesBetween(message.created_at, firstReply.created_at) } : null,
        last_reply: lastReply ? { user_name: displayUser(userMap, lastReply.sender_id), sent_at: lastReply.created_at, response_minutes: minutesBetween(message.created_at, lastReply.created_at) } : null
      },
      activity: relevantActivity,
      assignments: assignments.map((item) => ({
        assigned_to_name: displayUser(userMap, item.assigned_to),
        assigned_by_name: displayUser(userMap, item.assigned_by),
        created_at: item.created_at
      }))
    });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title }, { status: 500 });
  }
}
