import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";

function toSessionDto(row: any) {
  return {
    id: row.id,
    keyId: row.key_id,
    keyName: row.hidden_access_keys?.name || null,
    deviceId: row.device_id,
    deviceName: row.device_name,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    triggerMethod: row.trigger_method,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    authenticatedUserId: row.authenticated_user_id,
    authenticatedUserName: row.users?.full_name || row.users?.email || null,
    authenticatedAt: row.authenticated_at
  };
}

export async function GET(request: Request) {
  const session = await requireModuleAccess("kullanicilar");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });

  const url = new URL(request.url);
  const activeOnly = url.searchParams.get("activeOnly") === "1";
  const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200);
  const offset = Math.max(Number(url.searchParams.get("offset") || 0), 0);

  const now = new Date().toISOString();
  const filter = activeOnly ? `&revoked_at=is.null&expires_at=gt.${now}` : "";

  try {
    const rows = await supabaseRest<any[]>(
      `hidden_access_sessions?select=*,hidden_access_keys(name),users(full_name,email)${filter}&order=created_at.desc&limit=${limit}&offset=${offset}`
    );
    return NextResponse.json({ sessions: rows.map(toSessionDto) });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title, detail: safe.detail }, { status: 500 });
  }
}
