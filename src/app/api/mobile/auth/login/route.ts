import { NextResponse } from "next/server";
import { authenticateUser, isStaffRole } from "@/lib/auth";
import { encodeSession } from "@/lib/session-token";
import { resolveLoginEmail } from "@/lib/server/usernames";

// Mobile-only login — reuses the exact same authenticateUser() credential
// check the web /api/auth/login route uses, but returns the signed
// session token in the JSON body (for SecureStore) instead of setting an
// HTTP-only cookie, since React Native has no shared cookie jar with the
// server. Staff/admin roles only — the mobile app is HK Admin, not the
// customer portal.
export async function POST(request: Request) {
  const { identity, email, username, password } = await request.json().catch(() => ({}));
  const rawIdentity = String(identity || email || username || "").trim().slice(0, 254);
  const normalizedEmail = await resolveLoginEmail(rawIdentity);

  if (!normalizedEmail || !String(password || "")) {
    return NextResponse.json({ error: "Kullanıcı adı/e-posta veya şifre hatalı." }, { status: 401 });
  }

  const result = await authenticateUser({ email: normalizedEmail, password: String(password || ""), userType: "admin" });

  if ("error" in result) {
    const message = result.error === "E-posta veya şifre hatalı." ? "Kullanıcı adı/e-posta veya şifre hatalı." : result.error;
    return NextResponse.json({ error: message }, { status: 401 });
  }

  if (!isStaffRole(result.session.role)) {
    return NextResponse.json({ error: "Bu hesap HK Admin mobil uygulamasına erişemez." }, { status: 403 });
  }

  return NextResponse.json({
    token: encodeSession(result.session),
    session: {
      email: result.session.email,
      role: result.session.role,
      fullName: result.session.fullName,
      allowedModules: result.session.allowedModules
    }
  });
}
