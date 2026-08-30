import { NextResponse } from "next/server";
import { getSession, isStaffRole } from "@/lib/auth";
import { getCommunicationChannelStatus } from "@/lib/communication-ai";

export async function GET() {
  const session = await getSession();
  if (!session || !isStaffRole(session.role)) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  return NextResponse.json({ channels: getCommunicationChannelStatus() });
}
