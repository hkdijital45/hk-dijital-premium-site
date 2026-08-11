import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";

function toLogDto(row: any) {
  return {
    id: row.id,
    eventType: row.event_type,
    keyId: row.key_id,
    keyName: row.hidden_access_keys?.name || null,
    sessionId: row.session_id,
    authenticatedUserId: row.authenticated_user_id,
    authenticatedUserName: row.users?.full_name || row.users?.email || null,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    deviceType: row.device_type,
    operatingSystem: row.operating_system,
    browser: row.browser,
    deviceId: row.device_id,
    deviceName: row.device_name,
    triggerMethod: row.trigger_method,
    reasonCode: row.reason_code,
    createdAt: row.created_at
  };
}

export async function GET(request: Request) {
  const session = await requireModuleAccess("kullanicilar");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });

  const url = new URL(request.url);
  const eventType = url.searchParams.get("eventType");
  const keyId = url.searchParams.get("keyId");
  const ip = url.searchParams.get("ip");
  const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200);
  const offset = Math.max(Number(url.searchParams.get("offset") || 0), 0);

  let filter = "";
  if (eventType && eventType !== "all") filter += `&event_type=eq.${encodeURIComponent(eventType)}`;
  if (keyId) filter += `&key_id=eq.${encodeURIComponent(keyId)}`;
  if (ip) filter += `&ip_address=eq.${encodeURIComponent(ip)}`;

  try {
    const rows = await supabaseRest<any[]>(
      `hidden_access_logs?select=*,hidden_access_keys(name),users(full_name,email)${filter}&order=created_at.desc&limit=${limit}&offset=${offset}`
    );
    return NextResponse.json({ logs: rows.map(toLogDto) });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title, detail: safe.detail }, { status: 500 });
  }
}
