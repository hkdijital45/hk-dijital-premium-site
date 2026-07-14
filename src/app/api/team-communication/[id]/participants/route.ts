import { NextResponse } from "next/server";
import { getAccessibleTeamConversation, getActiveStaff, getTeamContext, isUuid, recordTeamActivity } from "@/lib/server/team-communication";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";

async function canManageParticipants(conversationId: string, profileId: string, canManageAll: boolean) {
  if (canManageAll) return true;
  const rows = await supabaseRest<Array<{ role: string }>>(
    `team_conversation_participants?conversation_id=eq.${conversationId}&user_id=eq.${profileId}&left_at=is.null&select=role&limit=1`
  ).catch(() => []);
  return ["owner", "moderator"].includes(rows[0]?.role || "");
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getTeamContext();
  if (!context) return NextResponse.json({ error: "Ekip iletişimine erişim yetkiniz yok." }, { status: 403 });
  const { id } = await params;
  const conversation = await getAccessibleTeamConversation(context, id);
  if (!conversation) return NextResponse.json({ error: "Ekip konuşması bulunamadı veya erişim yetkiniz yok." }, { status: 404 });
  if (!await canManageParticipants(id, context.profileId, context.canManageAll)) return NextResponse.json({ error: "Katılımcı yönetme yetkiniz yok." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const rawUserIds: unknown[] = Array.isArray(body.userIds) ? body.userIds : [];
  const userIds = Array.from(new Set(rawUserIds.map(String).filter(isUuid)));
  if (!userIds.length) return NextResponse.json({ error: "Eklenecek ekip üyesi seçin." }, { status: 400 });
  try {
    const staff = new Set((await getActiveStaff()).map((user) => user.id));
    const valid = userIds.filter((userId) => staff.has(userId));
    if (!valid.length) return NextResponse.json({ error: "Yalnız aktif ekip kullanıcıları eklenebilir." }, { status: 400 });
    await supabaseRest("team_conversation_participants?on_conflict=conversation_id,user_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(valid.map((userId) => ({ conversation_id: id, user_id: userId, role: "member", added_by: context.profileId, left_at: null })))
    });
    await recordTeamActivity(id, context.profileId, "team_participants_added", { user_ids: valid });
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
  if (!await canManageParticipants(id, context.profileId, context.canManageAll)) return NextResponse.json({ error: "Katılımcı yönetme yetkiniz yok." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const userId = isUuid(body.userId) ? body.userId : "";
  if (!userId || userId === context.profileId) return NextResponse.json({ error: "Geçerli ekip üyesi seçin." }, { status: 400 });
  try {
    await supabaseRest(`team_conversation_participants?conversation_id=eq.${id}&user_id=eq.${userId}`, { method: "PATCH", body: JSON.stringify({ left_at: new Date().toISOString() }) });
    await recordTeamActivity(id, context.profileId, "team_participant_removed", { user_id: userId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title }, { status: 500 });
  }
}
