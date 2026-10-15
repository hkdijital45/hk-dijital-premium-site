import { NextResponse } from "next/server";
import { recordActivity } from "@/lib/activity-log";
import { getLogoStatus, uploadManualLogo } from "@/lib/business-logos";
import { LOGO_MAX_BYTES } from "@/lib/server/logo-image";
import { logoErrorResponse, parseOwner, requireLogoAccess } from "@/lib/server/business-logo-route";

// Firma logosu — status (GET) and manual upload (POST multipart).
export async function GET(request: Request) {
  const session = await requireLogoAccess();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const owner = parseOwner(params.get("type"), params.get("id"));
  if (!owner) return NextResponse.json({ error: "Geçersiz işletme." }, { status: 400 });
  try {
    return NextResponse.json(await getLogoStatus(owner));
  } catch (error) {
    return logoErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const session = await requireLogoAccess();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  const owner = parseOwner(form.get("type"), form.get("id"));
  const file = form.get("file");
  if (!owner) return NextResponse.json({ error: "Geçersiz işletme." }, { status: 400 });
  if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "Logo dosyası seçin." }, { status: 400 });
  if (file.size > LOGO_MAX_BYTES) return NextResponse.json({ error: "Logo dosyası 5 MB sınırını aşıyor." }, { status: 400 });
  if (!["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.type)) return NextResponse.json({ error: "PNG, JPEG veya WebP yükleyin. SVG güvenlik nedeniyle kabul edilmez." }, { status: 400 });
  try {
    const record = await uploadManualLogo(owner, Buffer.from(await file.arrayBuffer()), session.profileId || null);
    await recordActivity({ session, action: "Güncelleme", entity: "Firma Logosu", details: { message: "Logo manuel yüklendi ve doğrulandı", result: "Başarılı", owner } }).catch(() => null);
    return NextResponse.json({ logo: record });
  } catch (error) {
    return logoErrorResponse(error);
  }
}
