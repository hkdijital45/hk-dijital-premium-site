import { NextResponse } from "next/server";
import { recordActivity } from "@/lib/activity-log";
import { discoverLogoFromWebsite } from "@/lib/business-logos";
import { logoErrorResponse, parseOwner, requireLogoAccess } from "@/lib/server/business-logo-route";

// "Web Sitesinden Bul": reads the business's own recorded website only.
export async function POST(request: Request) {
  const session = await requireLogoAccess();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const owner = parseOwner(body.type, body.id);
  if (!owner) return NextResponse.json({ error: "Geçersiz işletme." }, { status: 400 });
  try {
    const result = await discoverLogoFromWebsite(owner, session.profileId || null);
    await recordActivity({ session, action: "API İşlemi", entity: "Firma Logosu", details: { message: `Web sitesinden logo arandı: ${result.status}`, result: "Başarılı", owner } }).catch(() => null);
    return NextResponse.json(result);
  } catch (error) {
    return logoErrorResponse(error);
  }
}
