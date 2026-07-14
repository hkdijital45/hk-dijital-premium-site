import { NextResponse } from "next/server";
import { authenticateUser, createSession, isCustomerPasswordChangeRequired, isCustomerRole } from "@/lib/auth";
import { recordCustomerLogin } from "@/lib/activity-log";
import { resolveLoginEmail } from "@/lib/server/usernames";

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
  return NextResponse.json({
    ok: true,
    redirectTo: isCustomerPasswordChangeRequired(session.session)
      ? "/sifre-degistir"
      : isCustomerRole(session.session.role) ? "/musteri-paneli" : "/hk-admin",
    role: session.session.role
  });
}
