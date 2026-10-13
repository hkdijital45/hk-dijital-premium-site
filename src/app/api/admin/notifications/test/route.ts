import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listActiveSubscriptions } from "@/lib/notifications/store";
import { sendPushToSubscription, vapidConfigured } from "@/lib/notifications/push";

// "TEST BİLDİRİMİ GÖNDER" — never claims delivery beyond what is actually
// verifiable from a server: pushServiceAccepted only means Apple/Google's
// push endpoint accepted the message for delivery, NOT that the phone
// received or displayed it. That last step has no server-visible
// confirmation and is reported as such.
export async function POST() {
  const session = await getSession();
  if (!session?.profileId) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });

  if (!vapidConfigured()) {
    return NextResponse.json({ error: "VAPID yapılandırılmamış — sunucuda VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY ortam değişkenleri eksik.", requestAccepted: false }, { status: 503 });
  }

  const subscriptions = await listActiveSubscriptions(session.profileId);
  if (subscriptions.length === 0) {
    return NextResponse.json({ error: "Bu hesaba kayıtlı aktif bir push aboneliği yok. Önce Bildirim Ayarları'ndan bildirimleri etkinleştirin.", requestAccepted: false }, { status: 404 });
  }

  const results = await Promise.all(subscriptions.map((sub) =>
    sendPushToSubscription(sub, {
      title: "HK Admin Test Bildirimi",
      body: "Bu bir test bildirimidir. Gördüyseniz push bildirimleri bu cihazda çalışıyor demektir.",
      category: "system"
    })
  ));

  return NextResponse.json({
    requestAccepted: true,
    devices: results.map((r) => ({
      subscriptionId: r.subscriptionId,
      pushServiceAccepted: r.pushServiceAccepted,
      errorCategory: r.errorCategory || null
    })),
    note: "pushServiceAccepted=true yalnızca push servisinin isteği kabul ettiğini gösterir; cihazda gerçekten görüntülendiği sunucu tarafından doğrulanamaz."
  });
}
