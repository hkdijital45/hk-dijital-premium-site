import { NextResponse } from "next/server";
import {
  conversationPriorities,
  conversationStatuses,
  getAccessibleConversation,
  getCommunicationContext,
  isUuid,
  recordConversationActivity,
  sanitizeCommunicationText
} from "@/lib/server/customer-communication";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getCommunicationContext();
  if (!context) return NextResponse.json({ error: "Oturum veya erişim yetkisi bulunamadı." }, { status: 401 });
  const { id } = await params;
  const conversation = await getAccessibleConversation(context, id);
  if (!conversation) return NextResponse.json({ error: "Konuşma bulunamadı veya erişim yetkiniz yok." }, { status: 404 });
  try {
    const [messages, attachments, reads, notes, activity, users] = await Promise.all([
      supabaseRest<Array<Record<string, unknown>>>(`customer_messages?conversation_id=eq.${id}&deleted_at=is.null&select=*&order=created_at.asc`),
      supabaseRest<Array<Record<string, unknown>>>(`conversation_attachments?conversation_id=eq.${id}&select=id,message_id,original_name,mime_type,file_size,created_at&order=created_at.asc`),
      supabaseRest<Array<{ message_id: string }>>(`conversation_reads?conversation_id=eq.${id}&user_id=eq.${context.profileId}&select=message_id`),
      context.isStaff ? supabaseRest<Array<Record<string, unknown>>>(`conversation_internal_notes?conversation_id=eq.${id}&select=*&order=created_at.desc`) : Promise.resolve([]),
      context.isStaff ? supabaseRest<Array<Record<string, unknown>>>(`conversation_activity?conversation_id=eq.${id}&select=*&order=created_at.desc&limit=100`) : Promise.resolve([]),
      supabaseRest<Array<{ id: string; full_name: string | null }>>("users?select=id,full_name")
    ]);
    const names = new Map(users.map((user) => [user.id, user.full_name || "Kullanıcı"]));
    return NextResponse.json({
      conversation,
      messages: messages.map((message) => ({ ...message, sender_name: names.get(String(message.sender_id || "")) || (message.sender_type === "staff" ? "HK Dijital" : "Müşteri") })),
      attachments,
      readMessageIds: reads.map((item) => item.message_id),
      internalNotes: notes.map((note) => ({ ...note, author_name: names.get(String(note.author_id || "")) || "Ekip üyesi" })),
      activity
    });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getCommunicationContext();
  if (!context) return NextResponse.json({ error: "Oturum veya erişim yetkisi bulunamadı." }, { status: 401 });
  const { id } = await params;
  const conversation = await getAccessibleConversation(context, id);
  if (!conversation) return NextResponse.json({ error: "Konuşma bulunamadı veya erişim yetkiniz yok." }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "");
  try {
    if (action === "customer_archive" && context.isCustomer) {
      await supabaseRest(`customer_conversations?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ customer_archived_at: new Date().toISOString() }) });
      return NextResponse.json({ ok: true });
    }
    if (!context.isStaff) return NextResponse.json({ error: "Bu işlem yalnızca ekip kullanıcılarına açıktır." }, { status: 403 });
    if (action === "internal_note") {
      const note = sanitizeCommunicationText(body.note, 8000);
      if (!note) return NextResponse.json({ error: "İç not boş bırakılamaz." }, { status: 400 });
      await supabaseRest("conversation_internal_notes", { method: "POST", body: JSON.stringify({ conversation_id: id, author_id: context.profileId, body: note }) });
      await recordConversationActivity(id, context.profileId, "internal_note_added");
      return NextResponse.json({ ok: true });
    }
    if (action === "assign") {
      if (!["admin", "yonetici"].includes(context.session.role)) return NextResponse.json({ error: "Konuşma atama yetkiniz bulunmuyor." }, { status: 403 });
      const assignedTo = isUuid(body.assignedTo) ? body.assignedTo : null;
      await supabaseRest(`customer_conversations?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ assigned_to: assignedTo }) });
      await supabaseRest("conversation_assignments", { method: "POST", body: JSON.stringify({ conversation_id: id, assigned_to: assignedTo, assigned_by: context.profileId }) });
      await recordConversationActivity(id, context.profileId, "assignment_changed", { assigned_to: assignedTo });
      return NextResponse.json({ ok: true });
    }
    const patch: Record<string, unknown> = {};
    if (conversationStatuses.includes(body.status)) {
      patch.status = body.status;
      patch.closed_at = body.status === "closed" ? new Date().toISOString() : null;
    }
    if (conversationPriorities.includes(body.priority)) patch.priority = body.priority;
    if (!Object.keys(patch).length) return NextResponse.json({ error: "Güncellenecek geçerli alan bulunamadı." }, { status: 400 });
    await supabaseRest(`customer_conversations?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    await recordConversationActivity(id, context.profileId, "conversation_updated", patch);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title }, { status: 500 });
  }
}
