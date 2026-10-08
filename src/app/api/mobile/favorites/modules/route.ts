import { NextResponse } from "next/server";
import { requireMobileStaffSession } from "@/lib/mobile-auth";
import { allowedFavoriteSlugs, moduleDetails } from "@/lib/mobile-favorites";

// All modules the signed-in staff member is allowed to favorite — used by
// the mobile "add to favorites" picker. Real permission-scoped list, not a
// static catalog (mirrors the web admin's own allowed-module gating).
export async function GET(request: Request) {
  const session = requireMobileStaffSession(request);
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const allowed = Array.from(allowedFavoriteSlugs(session));
  return NextResponse.json({ modules: moduleDetails(allowed) });
}
