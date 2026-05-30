import { NextResponse } from "next/server";
import { getSession, isStaffRole } from "@/lib/auth";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

export async function POST(request: Request) {
  const session = await getSession();
  if (!isStaffRole(session?.role)) {
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
        status: payload.status || "Aktif"
      })
    });

    return NextResponse.json({ ok: true, company: rows[0] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Firma oluşturulamadı.";
    console.error("Firma oluşturma Supabase hatası:", message);
    return NextResponse.json(
      {
        error: "Firma oluşturulamadı.",
        supabaseError: message,
        possibleCause: "Service role kullanılmasına rağmen hata alınıyorsa canlı Supabase şeması veya tablo izinleri kontrol edilmelidir."
      },
      { status: 500 }
    );
  }
}
