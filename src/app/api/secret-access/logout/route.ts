import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRest } from "@/lib/supabase";
import { HIDDEN_ACCESS_COOKIE, extractClientIp, findValidHiddenAccessSession, logHiddenAccessEvent } from "@/lib/hidden-access";

export async function POST(request: Request) {
  const token = (await cookies()).get(HIDDEN_ACCESS_COOKIE)?.value;
  if (token) {
    const session = await findValidHiddenAccessSession(token);
    if (session) {
      await supabaseRest(`hidden_access_sessions?id=eq.${session.id}`, {
        method: "PATCH",
        body: JSON.stringify({ revoked_at: new Date().toISOString() })
      }).catch(() => null);
      await logHiddenAccessEvent({
        eventType: "SESSION_LOGOUT",
        keyId: session.key_id,
        sessionId: session.id,
        ipAddress: extractClientIp(request.headers),
        userAgent: request.headers.get("user-agent") || ""
      });
    }
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(HIDDEN_ACCESS_COOKIE);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
