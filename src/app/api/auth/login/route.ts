import { NextResponse } from "next/server";
import { authenticateUser, createSession } from "@/lib/auth";

export async function POST(request: Request) {
  const { email, username, password, userType } = await request.json();
  const normalizedEmail = String(email || username || "").trim();
  const normalizedType = userType === "customer" ? "customer" : "admin";

  const session = await authenticateUser({
    email: normalizedEmail,
    password: String(password || ""),
    userType: normalizedType
  });

  if (!session) {
    return NextResponse.json({ error: "E-posta veya şifre hatalı." }, { status: 401 });
  }

  await createSession(session);
  return NextResponse.json({
    ok: true,
    redirectTo: session.role === "customer" ? "/musteri-paneli" : "/hk-admin",
    role: session.role
  });
}
