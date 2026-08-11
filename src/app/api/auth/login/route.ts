import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { authenticateUser, createSession, isCustomerPasswordChangeRequired, isCustomerRole } from "@/lib/auth";
import { recordCustomerLogin } from "@/lib/activity-log";
import { resolveLoginEmail } from "@/lib/server/usernames";
import { HIDDEN_ACCESS_COOKIE, findValidHiddenAccessSession, logHiddenAccessEvent } from "@/lib/hidden-access";
import { supabaseRest } from "@/lib/supabase";

// Correlates a successful real login with whichever Secret Access session
// (if any) let the visitor reach the login screen in the first place — pure
// side effect, never blocks or changes the login response. See
// src/lib/hidden-access.ts for the gate itself.
async function linkHiddenAccessSession(profileId?: string) {
  if (!profileId) return;
  try {
    const token = (await cookies()).get(HIDDEN_ACCESS_COOKIE)?.value;
    if (!token) return;
    const secretSession = await findValidHiddenAccessSession(token);
    if (!secretSession || secretSession.authenticated_user_id) return;
    const now = new Date().toISOString();
    await supabaseRest(`hidden_access_sessions?id=eq.${secretSession.id}`, {
      method: "PATCH",
      body: JSON.stringify({ authenticated_user_id: profileId, authenticated_at: now })
    });
    await logHiddenAccessEvent({ eventType: "AUTHENTICATED_LINKED", keyId: secretSession.key_id, sessionId: secretSession.id, authenticatedUserId: profileId });
  } catch (error) {
    console.error("hidden access session correlation failed:", error instanceof Error ? error.message : error);
  }
}

export async function POST(request: Request) {
  const { identity, email, username, password, userType, remember } = await request.json().catch(() => ({}));
  const rawIdentity = String(identity || email || username || "").trim().slice(0, 254);
  const normalizedEmail = await resolveLoginEmail(rawIdentity);
  const normalizedType = userType === "admin" || userType === "customer" ? userType : undefined;

  if (!normalizedEmail || !String(password || "")) {
    return NextResponse.json({ error: "Kullanıcı adı/e-posta veya şifre hatalı." }, { status: 401 });
  }

  const session = await authenticateUser({
    email: normalizedEmail,
    password: String(password || ""),
    userType: normalizedType
  });

  if ("error" in session) {
    const message = session.error === "E-posta veya şifre hatalı."
      ? "Kullanıcı adı/e-posta veya şifre hatalı."
      : session.error;
    return NextResponse.json({ error: message }, { status: 401 });
  }

  await createSession(session.session, { remember: Boolean(remember) });
  await recordCustomerLogin(session.session);
  await linkHiddenAccessSession(session.session.profileId);
  return NextResponse.json({
    ok: true,
    redirectTo: isCustomerPasswordChangeRequired(session.session)
      ? "/sifre-degistir"
      : isCustomerRole(session.session.role) ? "/musteri-paneli" : "/hk-admin",
    role: session.session.role
  });
}
