import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getInstagramConnectionStatus } from "@/lib/social-autopilot/instagram-oauth";

export async function GET() {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const status = await getInstagramConnectionStatus();
  return NextResponse.json({ status });
}
