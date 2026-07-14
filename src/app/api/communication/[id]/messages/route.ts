import { NextResponse } from "next/server";
import {
  createConversationNotification,
  getAccessibleConversation,
  getCommunicationContext,
  recordConversationActivity,
  sanitizeCommunicationText
} from "@/lib/server/customer-communication";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getCommunicationContext();
  if (!context) return NextResponse.json({ error: "Oturum veya erişim yetkisi bulunamadı." }, { status: 401 });
  const { id } = await params;
  const conversation = await getAccessibleConversation(context, id);
  if (!conversation) return NextResponse.json({ error: "Konuşma bulunamadı veya erişim yetkiniz yok." }, { status: 404 });
  const payload = await request.json().catch(() => ({}));
  const body = sanitizeCommunicationText(payload.message);
  const idempotencyKey = sanitizeCommunicationText(payload.idempotencyKey, 120) || null;
  if (!body) return NextResponse.json({ error: "Mesaj alanı boş bırakılamaz." }, { status: 400 });
  if (["closed"].includes(conversation.status) && context.isCustomer) {
    return NextResponse.json({ error: "Kapatılmış konuşmaya yeni mesaj eklenemez. Yeni bir talep oluşturun." }, { status: 409 });
  }
  try {
    if (idempotencyKey) {
      const existing = await supabaseRest<Array<{ id: string }>>(
        `customer_messages?conversation_id=eq.${id}&sender_id=eq.${context.profileId}&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&select=id&limit=1`
      );
      if (existing[0]) return NextResponse.json({ ok: true, messageId: existing[0].id, duplicate: true });
    }
    const now = new Date().toISOString();
    const rows = await supabaseRest<Array<{ id: string }>>("customer_messages", {
      method: "POST",
      body: JSON.stringify({
        conversation_id: id,
        sender_id: context.profileId,
        sender_type: context.isStaff ? "staff" : "customer",
        body,
        idempotency_key: idempotencyKey
      })
    });
    const message = rows[0];
    if (!message) throw new Error("Mesaj kaydedilemedi.");
    await Promise.all([
      supabaseRest(`customer_conversations?id=eq.${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          last_message_at: now,
          status: context.isStaff ? "customer_reply_required" : "admin_reply_required",
          customer_archived_at: null
        })
      }),
      supabaseRest("conversation_reads?on_conflict=message_id,user_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({ conversation_id: id, message_id: message.id, user_id: context.profileId, read_at: now })
      })
    ]);
    await recordConversationActivity(id, context.profileId, "message_sent", { message_id: message.id });
    await createConversationNotification({
      conversation,
      messageId: message.id,
      title: context.isStaff ? `HK Dijital yanıtı: ${conversation.subject}` : `Müşteri yanıtı: ${conversation.subject}`,
      message: body,
      showToCustomer: context.isStaff
    });
    return NextResponse.json({ ok: true, messageId: message.id }, { status: 201 });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title }, { status: 500 });
  }
}
