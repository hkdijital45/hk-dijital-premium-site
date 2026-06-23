/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getCompanyPixelSettings, logPixelTest, safePixelSettings, sendMetaTestEvent, updatePixelTestState, uuidPattern } from "@/lib/meta-pixel-admin";
import { supabaseRest } from "@/lib/supabase";

export async function POST(request: Request) {
  if (!(await requireModuleAccess("api-ayarlari"))) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const { companyId, sendEvent = false } = await request.json().catch(() => ({}));
  if (!uuidPattern.test(String(companyId || ""))) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });
  const row = await getCompanyPixelSettings(companyId);
  if (!row) return NextResponse.json({ error: "Önce Pixel ve Conversion API ayarlarını kaydedin." }, { status: 404 });
  try {
    if (sendEvent) {
      const companies = await supabaseRest<any[]>(`companies?id=eq.${companyId}&select=website&limit=1`);
      await sendMetaTestEvent(row, companies[0]?.website || undefined);
    } else {
      if (!(row.pixel_id || row.dataset_id)) throw new Error("Pixel ID veya Dataset ID eksik.");
      if (!row.conversion_api_token_encrypted) throw new Error("Conversion API token eksik.");
    }
    const now = new Date().toISOString();
    const message = sendEvent ? "Test event gönderildi. Meta Events Manager içinden Test Events bölümünü kontrol edin." : "Conversion API ayarları hazır görünüyor.";
    const updated = await updatePixelTestState(companyId, { capi_status: "Başarılı", last_capi_test_at: now, last_event_at: sendEvent ? now : row.last_event_at, sync_message: message });
    await logPixelTest(companyId, sendEvent ? "test_event" : "capi_test", "Başarılı", message);
    return NextResponse.json({ ok: true, status: "Başarılı", message, settings: safePixelSettings(updated) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Conversion API testi başarısız.";
    const updated = await updatePixelTestState(companyId, { capi_status: "Hata", last_capi_test_at: new Date().toISOString(), sync_message: message });
    await logPixelTest(companyId, sendEvent ? "test_event" : "capi_test", "Hata", message);
    return NextResponse.json({ error: message, settings: safePixelSettings(updated) }, { status: 400 });
  }
}
