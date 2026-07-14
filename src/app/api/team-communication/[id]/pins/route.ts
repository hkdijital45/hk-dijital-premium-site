import { NextResponse } from "next/server";
import { getAccessibleTeamConversation, getTeamContext, isUuid, recordTeamActivity } from "@/lib/server/team-communication";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getTeamContext();
  if (!context) return NextResponse.json({ error: "Ekip iletişimine erişim yetkiniz yok." }, { status: 403 });
  const { id } = await params;
  const conversation = await getAccessibleTeamConversation(context, id);
  if (!conversation) return NextResponse.json({ error: "Ekip konuşması bulunamadı veya erişim yetkiniz yok." }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const messageId = isUuid(body.messageId) ? body.messageId : "";
  if (!messageId) return NextResponse.json({ error: "Geçerli mesaj seçin." }, { status: 400 });
  try {
    const existingPins = await supabaseRest<Array<{ id: string }>>(`team_message_pins?conversation_id=eq.${id}&unpinned_at=is.null&select=id`);
    if (existingPins.length >= 20) return NextResponse.json({ error: "Bir konuşmada en fazla 20 sabit mesaj olabilir." }, { status: 400 });
    const message = await supabaseRest<Array<{ id: string }>>(`team_messages?id=eq.${messageId}&conversation_id=eq.${id}&deleted_at=is.null&select=id&limit=1`);
    if (!message[0]) return NextResponse.json({ error: "Mesaj bulunamadı." }, { status: 404 });
    await supabaseRest("team_message_pins?on_conflict=message_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ conversation_id: id, message_id: messageId, pinned_by: context.profileId, unpinned_at: null })
    });
    await recordTeamActivity(id, context.profileId, "team_message_pinned", { message_id: messageId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getTeamContext();
  if (!context) return NextResponse.json({ error: "Ekip iletişimine erişim yetkiniz yok." }, { status: 403 });
  const { id } = await params;
  const conversation = await getAccessibleTeamConversation(context, id);
  if (!conversation) return NextResponse.json({ error: "Ekip konuşması bulunamadı veya erişim yetkiniz yok." }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const messageId = isUuid(body.messageId) ? body.messageId : "";
  if (!messageId) return NextResponse.json({ error: "Geçerli mesaj seçin." }, { status: 400 });
  try {
    await supabaseRest(`team_message_pins?conversation_id=eq.${id}&message_id=eq.${messageId}`, { method: "PATCH", body: JSON.stringify({ unpinned_at: new Date().toISOString() }) });
    await recordTeamActivity(id, context.profileId, "team_message_unpinned", { message_id: messageId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title }, { status: 500 });
  }
}
