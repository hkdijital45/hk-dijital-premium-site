import { NextResponse } from "next/server";
import { recordActivity } from "@/lib/activity-log";
import { approveLogo, rejectLogo } from "@/lib/business-logos";
import { isUuid, logoErrorResponse, requireLogoAccess } from "@/lib/server/business-logo-route";

// Explicit admin decision on a candidate: "Onayla" makes it the report logo
// (the only path, besides a manual upload, that changes an approved logo).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireLogoAccess();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Geçersiz logo kimliği." }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  try {
    if (body.action === "approve") {
      const logo = await approveLogo(id, session.profileId || null);
      await recordActivity({ session, action: "Güncelleme", entity: "Firma Logosu", details: { message: "Logo onaylandı", result: "Başarılı", logoId: id } }).catch(() => null);
      return NextResponse.json({ logo });
    }
    if (body.action === "reject") {
      const logo = await rejectLogo(id);
      await recordActivity({ session, action: "Güncelleme", entity: "Firma Logosu", details: { message: "Logo reddedildi", result: "Başarılı", logoId: id } }).catch(() => null);
      return NextResponse.json({ logo });
    }
    return NextResponse.json({ error: "Geçersiz işlem." }, { status: 400 });
  } catch (error) {
    return logoErrorResponse(error);
  }
}
