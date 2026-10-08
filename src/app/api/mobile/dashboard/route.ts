import { NextResponse } from "next/server";
import { requireMobileStaffSession } from "@/lib/mobile-auth";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

const TERMINAL_LEAD_STATUSES = ["Kazanıldı", "Kaybedildi", "Dönüştürüldü", "Reddedildi", "Ön İnceleme İptal"];

/**
 * Compact home-dashboard counts for the mobile app — small, targeted
 * COUNT-style queries (select=id only, bounded limit) against existing
 * tables, never the heavy /api/admin/center-data payload the web
 * dashboard uses. No fabricated numbers: every field here is a real row
 * count as of the request.
 */
export async function GET(request: Request) {
  const session = requireMobileStaffSession(request);
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });

  try {
    const [companies, openLeads, pendingTasks, unreadNotifications] = await Promise.all([
      supabaseRest<Array<{ id: string }>>("companies?select=id&deleted_at=is.null&limit=1000"),
      supabaseRest<Array<{ id: string }>>(`leads?select=id&deleted_at=is.null&status=not.in.(${TERMINAL_LEAD_STATUSES.map(encodeURIComponent).join(",")})&limit=1000`),
      supabaseRest<Array<{ id: string }>>("agency_tasks?select=id&status=eq.Yapılacak&archived_at=is.null&limit=1000"),
      supabaseRest<Array<{ id: string }>>("agency_notifications?select=id&is_read=eq.false&archived_at=is.null&limit=1000")
    ]);

    return NextResponse.json({
      activeCustomers: companies.length,
      openLeads: openLeads.length,
      pendingTasks: pendingTasks.length,
      unreadNotifications: unreadNotifications.length
    });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
