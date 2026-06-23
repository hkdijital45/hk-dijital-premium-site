import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getCompanyPixelSettings, logPixelTest, safePixelSettings, updatePixelTestState, uuidPattern } from "@/lib/meta-pixel-admin";

export async function POST(request: Request) {
  if (!(await requireModuleAccess("api-ayarlari"))) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const { companyId } = await request.json().catch(() => ({}));
  if (!uuidPattern.test(String(companyId || ""))) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });
  const row = await getCompanyPixelSettings(companyId);
  const valid = /^\d{6,24}$/.test(String(row?.pixel_id || ""));
  const message = valid ? "Pixel ID formatı geçerli, Meta doğrulaması için API izni gerekebilir." : "Meta Pixel ID eksik veya formatı geçersiz.";
  const updated = await updatePixelTestState(companyId, { pixel_status: valid ? "Uyarı" : "Hata", last_pixel_test_at: new Date().toISOString(), sync_message: message });
  await logPixelTest(companyId, "pixel_test", valid ? "Uyarı" : "Hata", message);
  return NextResponse.json({ ok: valid, status: valid ? "Uyarı" : "Hata", message, settings: safePixelSettings(updated) }, { status: valid ? 200 : 400 });
}
