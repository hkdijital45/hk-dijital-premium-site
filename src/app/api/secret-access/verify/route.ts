import { NextResponse } from "next/server";
import { supabaseRest } from "@/lib/supabase";
import {
  HIDDEN_ACCESS_COOKIE,
  HIDDEN_ACCESS_SESSION_TTL_SECONDS,
  extractClientIp,
  generateSessionToken,
  hashToken,
  verifySecret,
  isIpRateLimited,
  logHiddenAccessEvent
} from "@/lib/hidden-access";
import { safeCompare } from "@/lib/secure-compare";

const GENERIC_ERROR = "Erişim reddedildi.";

type HiddenAccessKeyRow = { id: string; secret_hash: string; usage_count: number };

export async function POST(request: Request) {
  const ipAddress = extractClientIp(request.headers);
  const userAgent = request.headers.get("user-agent") || "";
  const body = await request.json().catch(() => ({}));
  const secret = String(body.secret || "").trim();
  const deviceId = typeof body.deviceId === "string" ? body.deviceId.slice(0, 120) : null;
  const triggerMethod = typeof body.triggerMethod === "string" ? body.triggerMethod.slice(0, 60) : null;

  if (await isIpRateLimited(ipAddress)) {
    await logHiddenAccessEvent({ eventType: "BLOCKED", ipAddress, userAgent, deviceId, triggerMethod, reasonCode: "RATE_LIMITED" });
    return NextResponse.json({ error: "Çok fazla başarısız deneme. Lütfen birkaç dakika sonra tekrar deneyin." }, { status: 429 });
  }

  if (!secret) {
    await logHiddenAccessEvent({ eventType: "FAILED", ipAddress, userAgent, deviceId, triggerMethod, reasonCode: "EMPTY_SECRET" });
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  const now = new Date().toISOString();
  let matchedKeyId: string | null = null;

  try {
    const candidateKeys = await supabaseRest<HiddenAccessKeyRow[]>(
      `hidden_access_keys?is_active=eq.true&archived_at=is.null&or=(expires_at.is.null,expires_at.gt.${now})&select=id,secret_hash,usage_count`
    );
    const match = candidateKeys.find((key) => verifySecret(secret, key.secret_hash));
    if (match) {
      matchedKeyId = match.id;
      await supabaseRest(`hidden_access_keys?id=eq.${match.id}`, {
        method: "PATCH",
        body: JSON.stringify({ usage_count: (match.usage_count || 0) + 1, last_used_at: now, updated_at: now })
      });
    } else if (candidateKeys.length === 0) {
      // Bootstrap fallback — only reachable while zero real access keys
      // exist yet, so a fresh deployment cannot lock itself out before the
      // first key is created. Never client-side, never NEXT_PUBLIC_.
      const bootstrapSecret = process.env.HK_HIDDEN_ACCESS_BOOTSTRAP_SECRET;
      if (bootstrapSecret && safeCompare(secret, bootstrapSecret)) {
        matchedKeyId = null; // bootstrap access is not tied to a key row
      } else {
        await logHiddenAccessEvent({ eventType: "FAILED", ipAddress, userAgent, deviceId, triggerMethod, reasonCode: "INVALID_ACCESS_KEY" });
        return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
      }
    } else {
      await logHiddenAccessEvent({ eventType: "FAILED", ipAddress, userAgent, deviceId, triggerMethod, reasonCode: "INVALID_ACCESS_KEY" });
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
    }
  } catch (error) {
    console.error("secret-access verify failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }

  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + HIDDEN_ACCESS_SESSION_TTL_SECONDS * 1000).toISOString();
  let sessionId: string | null = null;
  try {
    const rows = await supabaseRest<Array<{ id: string }>>("hidden_access_sessions", {
      method: "POST",
      body: JSON.stringify({
        key_id: matchedKeyId,
        session_token_hash: hashToken(token),
        device_id: deviceId,
        device_name: null,
        ip_address: ipAddress,
        user_agent: userAgent.slice(0, 500),
        trigger_method: triggerMethod,
        expires_at: expiresAt
      })
    });
    sessionId = rows[0]?.id || null;
  } catch (error) {
    console.error("hidden_access_sessions insert failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }

  await logHiddenAccessEvent({ eventType: "SUCCESS", keyId: matchedKeyId, sessionId, ipAddress, userAgent, deviceId, triggerMethod });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(HIDDEN_ACCESS_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: HIDDEN_ACCESS_SESSION_TTL_SECONDS
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
