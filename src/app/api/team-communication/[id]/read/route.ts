import { NextResponse } from "next/server";
import { getAccessibleTeamConversation, getTeamContext } from "@/lib/server/team-communication";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getTeamContext();
  if (!context) return NextResponse.json({ error: "Ekip iletişimine erişim yetkiniz yok." }, { status: 403 });
  const { id } = await params;
  const conversation = await getAccessibleTeamConversation(context, id);
  if (!conversation) return NextResponse.json({ error: "Ekip konuşması bulunamadı veya erişim yetkiniz yok." }, { status: 404 });
  try {
    const messages = await supabaseRest<Array<{ id: string; sender_id: string }>>(
      `team_messages?conversation_id=eq.${id}&deleted_at=is.null&sender_id=neq.${context.profileId}&select=id,sender_id&limit=300`
    );
    const now = new Date().toISOString();
    if (messages.length) {
      await supabaseRest("team_message_reads?on_conflict=message_id,user_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify(messages.map((message) => ({ conversation_id: id, message_id: message.id, user_id: context.profileId, read_at: now })))
      });
    }
    await supabaseRest(`team_conversation_participants?conversation_id=eq.${id}&user_id=eq.${context.profileId}`, {
      method: "PATCH",
      body: JSON.stringify({ last_read_at: now })
    }).catch(() => null);
    return NextResponse.json({ ok: true, readCount: messages.length });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title }, { status: 500 });
  }
}
