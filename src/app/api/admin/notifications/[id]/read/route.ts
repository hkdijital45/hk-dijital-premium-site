import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import { markNotificationRead } from "@/lib/notifications/store";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.profileId) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçersiz bildirim kimliği." }, { status: 400 });
  // Scoped to session.profileId inside markNotificationRead's own query —
  // a user can never mark another user's notification as read.
  await markNotificationRead(id, session.profileId);
  return NextResponse.json({ ok: true });
}
