import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPreferences, upsertPreferences, NOTIFICATION_CATEGORIES, type NotificationCategory } from "@/lib/notifications/store";

export async function GET() {
  const session = await getSession();
  if (!session?.profileId) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const preferences = await getPreferences(session.profileId);
  return NextResponse.json({ preferences });
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session?.profileId) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const body = await request.json().catch(() => ({}));

  const patch: { push_enabled?: boolean; categories?: Partial<Record<NotificationCategory, boolean>> } = {};
  if (typeof body.pushEnabled === "boolean") patch.push_enabled = body.pushEnabled;
  if (body.categories && typeof body.categories === "object") {
    const categories: Partial<Record<NotificationCategory, boolean>> = {};
    for (const key of NOTIFICATION_CATEGORIES) {
      if (typeof body.categories[key] === "boolean") categories[key] = body.categories[key];
    }
    patch.categories = categories;
  }

  const preferences = await upsertPreferences(session.profileId, patch);
  return NextResponse.json({ preferences });
}
