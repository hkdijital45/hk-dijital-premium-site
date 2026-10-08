import { NextResponse } from "next/server";
import { requireMobileStaffSession } from "@/lib/mobile-auth";

// Verifies a stored mobile session token is still valid server-side (a
// token can expire/be revoked/the user deactivated) — the app calls this
// on cold start before trusting a locally-cached token.
export async function GET(request: Request) {
  const session = requireMobileStaffSession(request);
  if (!session) return NextResponse.json({ error: "Oturum geçersiz." }, { status: 401 });
  return NextResponse.json({
    session: { email: session.email, role: session.role, fullName: session.fullName, allowedModules: session.allowedModules }
  });
}
