import { NextResponse } from "next/server";
import { requireMobileStaffSession } from "@/lib/mobile-auth";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

const FIELDS = "id,company_id,notification_type,title,message,priority,source_module,action_url,is_read,created_at";

/**
 * Real, persisted, cross-device notifications — public.agency_notifications,
 * the same table the web admin's "Bildirim Merkezi" drawer reads/writes.
 * Not the same as that drawer's full feed, which also synthesizes
 * notifications on the fly from leads/tasks/payments state — this mobile
 * route intentionally only returns ACTUAL stored rows, so nothing here is
 * ever a fabricated/derived notification.
 */
export async function GET(request: Request) {
  const session = requireMobileStaffSession(request);
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });

  try {
    const notifications = await supabaseRest<Array<Record<string, unknown>>>(
      `agency_notifications?select=${FIELDS}&archived_at=is.null&order=created_at.desc&limit=100`
    );
    return NextResponse.json({ notifications });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
