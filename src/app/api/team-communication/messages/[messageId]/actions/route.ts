import { NextResponse } from "next/server";
import { getAccessibleTeamConversation, getTeamContext, isUuid, recordTeamActivity, sanitizeTeamText } from "@/lib/server/team-communication";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";

export async function POST(request: Request, { params }: { params: Promise<{ messageId: string }> }) {
  const context = await getTeamContext();
  if (!context) return NextResponse.json({ error: "Ekip iletişimine erişim yetkiniz yok." }, { status: 403 });
  const { messageId } = await params;
  if (!isUuid(messageId)) return NextResponse.json({ error: "Geçersiz mesaj kaydı." }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  const action = sanitizeTeamText(body.action, 80);
  try {
    const rows = await supabaseRest<Array<{ id: string; conversation_id: string; body: string }>>(`team_messages?id=eq.${messageId}&deleted_at=is.null&select=id,conversation_id,body&limit=1`);
    const message = rows[0];
    if (!message) return NextResponse.json({ error: "Mesaj bulunamadı." }, { status: 404 });
    const conversation = await getAccessibleTeamConversation(context, message.conversation_id);
    if (!conversation) return NextResponse.json({ error: "Ekip konuşması bulunamadı veya erişim yetkiniz yok." }, { status: 404 });
    if (action === "create_task") {
      if (!conversation.company_id) return NextResponse.json({ error: "Görev oluşturmak için bağlı müşteri gerekiyor." }, { status: 400 });
      const taskRows = await supabaseRest<Array<{ id: string }>>("agency_tasks", {
        method: "POST",
        body: JSON.stringify({
          company_id: conversation.company_id,
          title: sanitizeTeamText(body.title, 160) || `Ekip görüşmesi: ${conversation.title}`,
          description: message.body,
          notes: message.body,
          status: "Yapılacak",
          priority: conversation.priority === "urgent" ? "Yüksek" : "Normal",
          visible_to_customer: false,
          metadata: { source: "team_communication", team_conversation_id: conversation.id, team_message_id: message.id },
          updated_at: new Date().toISOString()
        })
      });
      await recordTeamActivity(conversation.id, context.profileId, "team_task_created", { message_id: message.id, task_id: taskRows[0]?.id || null });
      return NextResponse.json({ ok: true, taskId: taskRows[0]?.id || null });
    }
    if (action === "customer_reply_draft") {
      if (!conversation.source_customer_conversation_id) return NextResponse.json({ error: "Bu ekip görüşmesi müşteri konuşmasına bağlı değil." }, { status: 400 });
      await recordTeamActivity(conversation.id, context.profileId, "customer_reply_draft_created", { message_id: message.id, target_customer_conversation_id: conversation.source_customer_conversation_id });
      return NextResponse.json({ ok: true, draft: message.body, customerConversationId: conversation.source_customer_conversation_id });
    }
    return NextResponse.json({ error: "Geçersiz işlem." }, { status: 400 });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title }, { status: 500 });
  }
}
