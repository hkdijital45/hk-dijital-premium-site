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
    const [messages, attachments, reads, notes, activity, assignments, users, companies, branches] = await Promise.all([
      supabaseRest<Array<Record<string, unknown>>>(`customer_messages?conversation_id=eq.${id}&deleted_at=is.null&select=*&order=created_at.asc`),
      supabaseRest<Array<Record<string, unknown>>>(`conversation_attachments?conversation_id=eq.${id}&select=id,message_id,original_name,mime_type,file_size,created_at&order=created_at.asc`),
      supabaseRest<Array<{ message_id: string }>>(`conversation_reads?conversation_id=eq.${id}&user_id=eq.${context.profileId}&select=message_id`),
      context.isStaff ? supabaseRest<Array<Record<string, unknown>>>(`conversation_internal_notes?conversation_id=eq.${id}&select=*&order=created_at.desc`) : Promise.resolve([]),
      context.isStaff ? supabaseRest<Array<Record<string, unknown>>>(`conversation_activity?conversation_id=eq.${id}&select=*&order=created_at.desc&limit=100`) : Promise.resolve([]),
      context.isStaff ? supabaseRest<Array<Record<string, unknown>>>(`conversation_assignments?conversation_id=eq.${id}&select=assigned_to,assigned_by,created_at&order=created_at.desc&limit=50`) : Promise.resolve([]),
      supabaseRest<Array<{ id: string; full_name: string | null }>>("users?select=id,full_name"),
      supabaseRest<Array<{ id: string; name: string }>>(`companies?id=eq.${conversation.company_id}&select=id,name&limit=1`),
      conversation.branch_id
        ? supabaseRest<Array<{ id: string; branch_name: string }>>(`customer_branches?id=eq.${conversation.branch_id}&select=id,branch_name&limit=1`)
        : Promise.resolve([])
    ]);
    const names = new Map(users.map((user) => [user.id, user.full_name || "Kullanıcı"]));
    // The list endpoint (/api/communication) enriches each row with
    // company_name/branch_name/assigned_name via the same joins; this detail
    // endpoint must match that shape exactly, since the right-side management
    // panel derives its "is a conversation selected" signal from these fields
    // (see AdminDetailInspector's `title` prop) rather than from `detail` itself.
    const enrichedConversation = {
      ...conversation,
      company_name: companies[0]?.name || "Müşteri",
      branch_name: conversation.branch_id ? branches[0]?.branch_name || "Şube" : null,
      assigned_name: conversation.assigned_to ? names.get(conversation.assigned_to) || "Ekip üyesi" : null
    };
    return NextResponse.json({
      conversation: enrichedConversation,
      messages: messages.map((message) => ({ ...message, sender_name: names.get(String(message.sender_id || "")) || (message.sender_type === "staff" ? "HK Dijital" : "Müşteri") })),
      attachments,
      readMessageIds: reads.map((item) => item.message_id),
      internalNotes: notes.map((note) => ({ ...note, author_name: names.get(String(note.author_id || "")) || "Ekip üyesi" })),
      activity: activity.map((item) => ({ ...item, actor_name: names.get(String(item.actor_id || "")) || "Sistem" })),
      assignments: assignments.map((item) => ({
        assigned_to_name: names.get(String(item.assigned_to || "")) || "Atanmamış",
        assigned_by_name: names.get(String(item.assigned_by || "")) || "Sistem",
        created_at: item.created_at
      }))
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
      const rows = await supabaseRest<Array<{ id: string }>>("conversation_internal_notes", { method: "POST", body: JSON.stringify({ conversation_id: id, author_id: context.profileId, body: note }) });
      await recordConversationActivity(id, context.profileId, "internal_note_added", { note_id: rows[0]?.id || null });
      return NextResponse.json({ ok: true, noteId: rows[0]?.id || null });
    }
    if (action === "linked_action") {
      const actionType = sanitizeCommunicationText(body.actionType, 80) || "linked_action";
      await recordConversationActivity(id, context.profileId, actionType, {
        target: sanitizeCommunicationText(body.target, 120) || null,
        target_id: sanitizeCommunicationText(body.targetId, 160) || null
      });
      return NextResponse.json({ ok: true });
    }
    if (action === "assign" || action === "manage_fields") {
      const patch: Record<string, unknown> = {};
      const changes: Array<{ field: string; old_value: unknown; new_value: unknown }> = [];
      if (action === "assign") {
        if (!["admin", "yonetici"].includes(context.session.role)) return NextResponse.json({ error: "Konuşma atama yetkiniz bulunmuyor." }, { status: 403 });
        const assignedTo = isUuid(body.assignedTo) ? body.assignedTo : null;
        if ((conversation.assigned_to || null) !== assignedTo) {
          patch.assigned_to = assignedTo;
          changes.push({ field: "assigned_to", old_value: conversation.assigned_to || null, new_value: assignedTo });
        }
      } else {
        if (conversationStatuses.includes(body.status) && body.status !== conversation.status) {
          patch.status = body.status;
          patch.closed_at = body.status === "closed" ? new Date().toISOString() : null;
          changes.push({ field: "status", old_value: conversation.status, new_value: body.status });
        }
        if (conversationPriorities.includes(body.priority) && body.priority !== conversation.priority) {
          patch.priority = body.priority;
          changes.push({ field: "priority", old_value: conversation.priority, new_value: body.priority });
        }
        const assignedTo = isUuid(body.assignedTo) ? body.assignedTo : null;
        if ((conversation.assigned_to || null) !== assignedTo) {
          if (!["admin", "yonetici"].includes(context.session.role)) return NextResponse.json({ error: "Konuşma atama yetkiniz bulunmuyor." }, { status: 403 });
          patch.assigned_to = assignedTo;
          changes.push({ field: "assigned_to", old_value: conversation.assigned_to || null, new_value: assignedTo });
        }
      }
      if (!changes.length) return NextResponse.json({ ok: true, unchanged: true, conversation });
      const rows = await supabaseRest<Array<Record<string, unknown>>>(`customer_conversations?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(patch) });
      const assignmentChange = changes.find((change) => change.field === "assigned_to");
      if (assignmentChange) {
        await supabaseRest("conversation_assignments", {
          method: "POST",
          body: JSON.stringify({ conversation_id: id, assigned_to: assignmentChange.new_value, assigned_by: context.profileId })
        });
      }
      await recordConversationActivity(id, context.profileId, action === "assign" ? "assignment_changed" : "conversation_fields_updated", { changes });
      return NextResponse.json({ ok: true, conversation: rows[0] || null, changes });
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
