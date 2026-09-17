import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError } from "@/lib/supabase";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import { revokeConnectLink } from "@/lib/connect-links";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const companyId = typeof body.companyId === "string" ? body.companyId : "";
  if (!companyId || !uuidPattern.test(companyId)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });
  try {
    const ok = await revokeConnectLink(id, companyId);
    if (!ok) return NextResponse.json({ error: "Bağlantı bulunamadı." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
