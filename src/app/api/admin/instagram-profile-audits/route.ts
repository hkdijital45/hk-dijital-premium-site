import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import { getInstagramProfileAuditContext, getInstagramProfileAudits, InstagramProfileAuditNotFoundError } from "@/lib/instagram-profile-audits";

// Read-only: HK Admin only displays the profile audit context/history
// Claude already saved via MCP (save_instagram_profile_audit) — this
// route never calls Claude/Anthropic and never writes anything.
export async function GET(request: Request) {
  const session = await requireModuleAccess("analiz-raporlama");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });

  const url = new URL(request.url);
  const companyId = url.searchParams.get("companyId") || "";
  if (!companyId || !uuidPattern.test(companyId)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });
  const id = url.searchParams.get("id") || "";

  try {
    if (id) {
      const audit = await getInstagramProfileAudits(companyId, { id });
      return NextResponse.json({ audit });
    }
    const [context, history] = await Promise.all([
      getInstagramProfileAuditContext(companyId),
      getInstagramProfileAudits(companyId, { limit: 10 })
    ]);
    return NextResponse.json({ context, history });
  } catch (error) {
    if (error instanceof InstagramProfileAuditNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Beklenmeyen hata." }, { status: 500 });
  }
}
