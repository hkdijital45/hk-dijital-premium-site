import { NextResponse } from "next/server";
import { adminCookieName, getAdminCredentials } from "@/lib/auth";

export async function POST(request: Request) {
  const { username, password } = await request.json();
  const credentials = getAdminCredentials();

  if (username !== credentials.username || password !== credentials.password) {
    return NextResponse.json({ error: "Kullanıcı adı veya şifre hatalı" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(adminCookieName, credentials.sessionSecret, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8
  });
  return response;
}
