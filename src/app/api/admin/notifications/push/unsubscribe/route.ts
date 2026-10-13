import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { deactivateSubscription } from "@/lib/notifications/store";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.profileId) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const endpoint = String(body.endpoint || "").trim();
  if (!endpoint) return NextResponse.json({ error: "endpoint zorunludur." }, { status: 400 });
  await deactivateSubscription(endpoint, session.profileId);
  return NextResponse.json({ ok: true });
}
