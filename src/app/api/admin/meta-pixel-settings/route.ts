/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getCompanyPixelSettings, safePixelSettings, saveCompanyPixelSettings, uuidPattern } from "@/lib/meta-pixel-admin";
import { supabaseRest } from "@/lib/supabase";

export async function GET(request: Request) {
  if (!(await requireModuleAccess("api-ayarlari"))) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId") || "";
  const scope = searchParams.get("scope");
  if (scope === "global") {
    const rows = await supabaseRest<any[]>("site_settings?key=eq.meta_pixel_global&select=value&limit=1").catch(() => []);
    return NextResponse.json({ settings: rows[0]?.value || { pixel_id: process.env.NEXT_PUBLIC_META_PIXEL_ID || "", enabled: true } });
  }
  if (!uuidPattern.test(companyId)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });
  const company = await supabaseRest<any[]>(`companies?id=eq.${companyId}&select=id,name,status&limit=1`);
  if (!company[0]) return NextResponse.json({ error: "Müşteri bulunamadı." }, { status: 404 });
  return NextResponse.json({ company: company[0], settings: safePixelSettings(await getCompanyPixelSettings(companyId)) });
}

export async function POST(request: Request) {
  if (!(await requireModuleAccess("api-ayarlari"))) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  if (body.scope === "global") {
    const value = { pixel_id: String(body.pixel_id || "").replace(/\D/g, ""), enabled: body.enabled !== false };
    await supabaseRest("site_settings?on_conflict=key", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify({ key: "meta_pixel_global", value }) });
    return NextResponse.json({ ok: true, settings: value, message: "Genel Meta Pixel ayarı kaydedildi." });
  }
  if (!uuidPattern.test(String(body.company_id || ""))) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });
  try {
    const row = await saveCompanyPixelSettings(body);
    return NextResponse.json({ ok: true, settings: safePixelSettings(row), message: "Meta Pixel ve Conversion API ayarları kaydedildi." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ayarlar kaydedilemedi." }, { status: 500 });
  }
}
