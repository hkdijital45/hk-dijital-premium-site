import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { disconnectInstagram } from "@/lib/social-autopilot/instagram-oauth";

export async function POST() {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  await disconnectInstagram();
  return NextResponse.json({ ok: true });
}
