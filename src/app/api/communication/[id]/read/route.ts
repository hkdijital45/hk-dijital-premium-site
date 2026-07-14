import { NextResponse } from "next/server";
import { getAccessibleConversation, getCommunicationContext } from "@/lib/server/customer-communication";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getCommunicationContext();
  if (!context) return NextResponse.json({ error: "Oturum veya erişim yetkisi bulunamadı." }, { status: 401 });
  const { id } = await params;
  const conversation = await getAccessibleConversation(context, id);
  if (!conversation) return NextResponse.json({ error: "Konuşma bulunamadı veya erişim yetkiniz yok." }, { status: 404 });
  try {
    const messages = await supabaseRest<Array<{ id: string }>>(
      `customer_messages?conversation_id=eq.${id}&sender_id=neq.${context.profileId}&deleted_at=is.null&select=id`
    );
    if (messages.length) {
      await supabaseRest("conversation_reads?on_conflict=message_id,user_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify(messages.map((message) => ({ conversation_id: id, message_id: message.id, user_id: context.profileId, read_at: new Date().toISOString() })))
      });
    }
    return NextResponse.json({ ok: true, readCount: messages.length });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title }, { status: 500 });
  }
}
