import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { markAllNotificationsRead } from "@/lib/notifications/store";

export async function POST() {
  const session = await getSession();
  if (!session?.profileId) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  await markAllNotificationsRead(session.profileId);
  return NextResponse.json({ ok: true });
}
