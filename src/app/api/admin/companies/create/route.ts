/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { recordActivity } from "@/lib/activity-log";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { requireModuleAccess } from "@/lib/permissions";
import { isAdminRole } from "@/lib/auth";

export async function POST(request: Request) {
  const session = await requireModuleAccess("musteriler");
  if (!session) {
    return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekir." }, { status: 403 });
  }

  if (!hasSupabaseConfig()) {
    return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });
  }

  const payload = await request.json();
  if (payload.is_test === true && !isAdminRole(session.role)) {
    return NextResponse.json({ error: "Test firması yalnızca admin tarafından oluşturulabilir." }, { status: 403 });
  }
  const name = String(payload.name || "").trim();

  if (!name) {
    return NextResponse.json({ error: "Firma adı zorunludur." }, { status: 400 });
  }

  try {
    const duplicateQuery = emailOrNameQuery(name, payload.email, payload.phone);
    const existing = await supabaseRest<any[]>(`companies?${duplicateQuery}&deleted_at=is.null&select=*&limit=1`).catch(() => []);
    if (existing[0]) {
      return NextResponse.json({ ok: true, company: existing[0], duplicatePrevented: true, message: "Bu firma zaten kayıtlı; mevcut kayıt açıldı." });
    }
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
        notes: payload.notes || "",
        is_test: payload.is_test === true
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

function emailOrNameQuery(name: string, email: unknown, phone: unknown) {
  const filters = [`name.eq.${name}`];
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedPhone = String(phone || "").replace(/\D/g, "");
  if (normalizedEmail) filters.push(`email.eq.${normalizedEmail}`);
  if (normalizedPhone) filters.push(`phone.eq.${normalizedPhone}`);
  return `or=(${encodeURIComponent(filters.join(","))})`;
}
