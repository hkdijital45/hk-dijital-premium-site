import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { upsertSubscription } from "@/lib/notifications/store";

// Called only after the user explicitly taps "Bildirimleri Etkinleştir" in
// Bildirim Ayarları and the browser's own permission prompt is granted —
// this route never runs on page load.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.profileId) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const endpoint = String(body.endpoint || "").trim();
  const p256dh = String(body.keys?.p256dh || "").trim();
  const authKey = String(body.keys?.auth || "").trim();
  if (!endpoint || !p256dh || !authKey) {
    return NextResponse.json({ error: "Geçersiz push aboneliği (endpoint/keys eksik)." }, { status: 400 });
  }

  try {
    const subscription = await upsertSubscription({
      userId: session.profileId, endpoint, p256dh, authKey,
      userAgent: typeof body.userAgent === "string" ? body.userAgent.slice(0, 300) : undefined
    });
    return NextResponse.json({ ok: true, subscription: { id: subscription.id } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Abonelik kaydedilemedi." }, { status: 500 });
  }
}
