import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import { getInstagramProfileAuditContext, InstagramProfileAuditNotFoundError } from "@/lib/instagram-profile-audits";

// İçerik Takip → Instagram Intelligence, for any company OTHER than HK
// Dijital's own agency account: reuses the exact same customer-scoped
// Instagram resolver/reader already built and production-verified for
// Instagram Profil Optimizasyonu (instagram-profile-audits.ts) — never
// HK Dijital's own single social_integrations row — gated by this
// screen's own "social-autopilot" module access (not "analiz-raporlama")
// so permissions stay consistent with the rest of İçerik Takip.
export async function GET(request: Request) {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });

  const url = new URL(request.url);
  const companyId = url.searchParams.get("companyId") || "";
  if (!companyId || !uuidPattern.test(companyId)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });

  try {
    const context = await getInstagramProfileAuditContext(companyId);
    return NextResponse.json({ context });
  } catch (error) {
    if (error instanceof InstagramProfileAuditNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Beklenmeyen hata." }, { status: 500 });
  }
}
