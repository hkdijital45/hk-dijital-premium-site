import { NextResponse } from "next/server";
import { createTeamNotification, getAccessibleTeamConversation, getTeamContext, isUuid, recordTeamActivity, sanitizeTeamText } from "@/lib/server/team-communication";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";

function mentionIds(value: unknown) {
  return Array.isArray(value) ? [...new Set(value.filter(isUuid))] : [];
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getTeamContext();
  if (!context) return NextResponse.json({ error: "Ekip iletişimine erişim yetkiniz yok." }, { status: 403 });
  const { id } = await params;
  const conversation = await getAccessibleTeamConversation(context, id);
  if (!conversation) return NextResponse.json({ error: "Ekip konuşması bulunamadı veya erişim yetkiniz yok." }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const messageBody = sanitizeTeamText(body.message);
  const idempotencyKey = sanitizeTeamText(body.idempotencyKey, 120) || null;
  const requestedMentions = mentionIds(body.mentionIds).filter((userId) => userId !== context.profileId);
  if (!messageBody) return NextResponse.json({ error: "Mesaj boş bırakılamaz." }, { status: 400 });
  try {
    if (idempotencyKey) {
      const existing = await supabaseRest<Array<{ id: string }>>(
        `team_messages?sender_id=eq.${context.profileId}&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&select=id&limit=1`
      ).catch(() => []);
      if (existing[0]) return NextResponse.json({ ok: true, messageId: existing[0].id, duplicate: true });
    }
    const participants = await supabaseRest<Array<{ user_id: string }>>(
      `team_conversation_participants?conversation_id=eq.${id}&left_at=is.null&select=user_id`
    );
    const participantIds = new Set(participants.map((item) => item.user_id));
    if (!participantIds.has(context.profileId) && !context.canAuditAll) return NextResponse.json({ error: "Bu konuşmaya mesaj gönderemezsiniz." }, { status: 403 });
    const validMentions = requestedMentions.filter((userId) => participantIds.has(userId));
    const now = new Date().toISOString();
    const rows = await supabaseRest<Array<{ id: string }>>("team_messages", {
      method: "POST",
      body: JSON.stringify({ conversation_id: id, sender_id: context.profileId, body: messageBody, idempotency_key: idempotencyKey, metadata: { mention_ids: validMentions } })
    });
    const message = rows[0];
    if (!message) throw new Error("Mesaj kaydedilemedi.");
    await supabaseRest(`team_conversations?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ last_message_at: now }) });
    await supabaseRest("team_message_reads?on_conflict=message_id,user_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ conversation_id: id, message_id: message.id, user_id: context.profileId, read_at: now })
    });
    if (validMentions.length) {
      await supabaseRest("team_message_mentions?on_conflict=message_id,mentioned_user_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify(validMentions.map((userId) => ({ conversation_id: id, message_id: message.id, mentioned_user_id: userId, created_by: context.profileId })))
      });
    }
    await recordTeamActivity(id, context.profileId, "team_message_sent", { message_id: message.id, mention_count: validMentions.length });
    await Promise.all([...participantIds].filter((userId) => userId !== context.profileId).map((userId) => createTeamNotification({ conversation, messageId: message.id, targetUserId: userId, title: "Yeni ekip mesajı", message: messageBody, type: validMentions.includes(userId) ? "team_mention" : "team_message" })));
    return NextResponse.json({ ok: true, messageId: message.id }, { status: 201 });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title }, { status: 500 });
  }
}
