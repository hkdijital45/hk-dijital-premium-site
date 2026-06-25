/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { recordActivity } from "@/lib/activity-log";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { requireModuleAccess } from "@/lib/permissions";

export async function POST(request: Request) {
  const session = await requireModuleAccess("musteriler");
  if (!session) {
    return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekir." }, { status: 403 });
  }

  if (!hasSupabaseConfig()) {
    return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });
  }

  const payload = await request.json();
  const name = String(payload.name || "").trim();

  if (!name) {
    return NextResponse.json({ error: "Firma adı zorunludur." }, { status: 400 });
  }

  try {
    const rows = await supabaseRest<any[]>("companies", {
      method: "POST",
      body: JSON.stringify({
        name,
        sector: payload.sector || "",
        city: payload.city || "",
        website: payload.website || "",
        instagram: payload.instagram || "",
        phone: payload.phone || "",
        email: payload.email || "",
        status: payload.status || "Aktif",
        is_active: payload.status === "Pasif" ? false : true,
        notes: payload.notes || ""
      })
    });

    await recordActivity({ session, action: "Oluşturma", entity: "Firma", entityId: rows[0]?.id, companyId: rows[0]?.id, details: { message: `${name} firması oluşturuldu` } });
    return NextResponse.json({ ok: true, company: rows[0] });
  } catch (error) {
    const safeError = getSafeSupabaseError(error);
    console.error("Firma oluşturma Supabase hatası:", safeError.detail);
    return NextResponse.json(
      {
        error: safeError.title,
        supabaseError: safeError.detail,
        possibleCause: "Service role kullanılmasına rağmen hata alınıyorsa canlı Supabase şeması veya tablo izinleri kontrol edilmelidir."
      },
      { status: 500 }
    );
  }
}
