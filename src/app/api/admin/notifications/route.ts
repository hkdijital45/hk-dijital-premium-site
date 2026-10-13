import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listNotifications, unreadCount, NOTIFICATION_CATEGORIES, type NotificationCategory } from "@/lib/notifications/store";

function isValidCategory(value: string): value is NotificationCategory {
  return (NOTIFICATION_CATEGORIES as readonly string[]).includes(value);
}

// Notifications belong to the logged-in staff member, not a specific
// module — any authenticated admin session can read their own inbox.
export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.profileId) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const unreadOnly = searchParams.get("unreadOnly") === "true";
  const category = searchParams.get("category") || undefined;
  if (category && !isValidCategory(category)) return NextResponse.json({ error: "Geçersiz kategori." }, { status: 400 });

  try {
    const [notifications, unread] = await Promise.all([
      listNotifications(session.profileId, { unreadOnly, category: category as NotificationCategory | undefined }),
      unreadCount(session.profileId)
    ]);
    return NextResponse.json({ notifications, unreadCount: unread });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Beklenmeyen hata." }, { status: 500 });
  }
}
