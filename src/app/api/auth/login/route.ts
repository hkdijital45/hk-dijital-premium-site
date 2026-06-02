import { NextResponse } from "next/server";
import { authenticateUser, createSession, isCustomerRole } from "@/lib/auth";
import { recordCustomerLogin } from "@/lib/activity-log";

export async function POST(request: Request) {
  const { email, username, password, userType } = await request.json();
  const normalizedEmail = String(email || username || "").trim();
  const normalizedType = userType === "customer" ? "customer" : "admin";

  const session = await authenticateUser({
    email: normalizedEmail,
    password: String(password || ""),
    userType: normalizedType
  });

  if ("error" in session) {
    return NextResponse.json({ error: session.error }, { status: 401 });
  }

  await createSession(session.session);
  await recordCustomerLogin(session.session);
  return NextResponse.json({
    ok: true,
    redirectTo: isCustomerRole(session.session.role) ? "/musteri-paneli" : "/hk-admin",
    role: session.session.role
  });
}
