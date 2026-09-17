import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError } from "@/lib/supabase";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import { createConnectLink, listConnectLinks, CONNECT_CAPABILITIES, type ConnectCapability } from "@/lib/connect-links";

// HK Connect remote connection links — admin-side create/list. The raw
// token is only ever returned here, at creation time; every other read
// (listConnectLinks) returns metadata only (expiry/used/revoked), never
// the token or its hash.
export async function GET(request: Request) {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const companyId = new URL(request.url).searchParams.get("companyId") || "";
  if (!companyId || !uuidPattern.test(companyId)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });
  try {
    return NextResponse.json({ links: await listConnectLinks(companyId) });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const companyId = typeof body.companyId === "string" ? body.companyId : "";
  if (!companyId || !uuidPattern.test(companyId)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });
  const capabilities: ConnectCapability[] = Array.isArray(body.capabilities) ? body.capabilities.filter((c: unknown) => CONNECT_CAPABILITIES.includes(c as ConnectCapability)) : [];
  if (!capabilities.length) return NextResponse.json({ error: "En az bir platform seçin." }, { status: 400 });
  try {
    const { token, link } = await createConnectLink(companyId, session.profileId || null, capabilities);
    const origin = new URL(request.url).origin;
    return NextResponse.json({ url: `${origin}/connect/${token}`, expiresAt: link.expires_at, id: link.id });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
