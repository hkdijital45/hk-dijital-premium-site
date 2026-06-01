import { NextResponse } from "next/server";
import { getSession, isAdminRole } from "@/lib/auth";
import { recordActivity } from "@/lib/activity-log";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

async function getActiveAdminCount() {
  const rows = await supabaseRest<Array<{ id: string }>>("users?role=eq.admin&is_active=eq.true&select=id");
  return rows.length;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!isAdminRole(session?.role)) {
    return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekir." }, { status: 403 });
  }

  if (!hasSupabaseConfig()) {
    return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });
  }

  const { id } = await context.params;
  const payload = await request.json();
  const existingRows = await supabaseRest<any[]>(`users?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
  const existing = existingRows[0];

  if (!existing) {
    return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
  }

  const nextRole = payload.role ?? existing.role;
  const nextActive = payload.isActive ?? payload.is_active ?? existing.is_active;
  const isSelf = session?.profileId === id;
  const activeAdminCount = await getActiveAdminCount();

  if (isSelf && existing.role === "admin" && nextRole !== "admin") {
    return NextResponse.json({ error: "Kendi yönetici rolünüzü kaldıramazsınız." }, { status: 400 });
  }

  if (isSelf && existing.role === "admin" && nextActive === false) {
    return NextResponse.json({ error: "Kendi yönetici hesabınızı devre dışı bırakamazsınız." }, { status: 400 });
  }

  if (existing.role === "admin" && existing.is_active && activeAdminCount <= 1 && (nextRole !== "admin" || nextActive === false)) {
    return NextResponse.json({ error: "Son aktif yönetici hesabı devre dışı bırakılamaz." }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (payload.fullName !== undefined || payload.full_name !== undefined) patch.full_name = payload.fullName ?? payload.full_name;
  if (payload.email !== undefined) patch.email = String(payload.email || "").trim().toLowerCase();
  if (payload.role !== undefined) patch.role = payload.role;
  if (payload.companyId !== undefined || payload.company_id !== undefined) patch.company_id = (payload.companyId ?? payload.company_id) || null;
  if (payload.isActive !== undefined || payload.is_active !== undefined) patch.is_active = payload.isActive ?? payload.is_active;

  try {
    const rows = await supabaseRest<any[]>(`users?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch)
    });
    await recordActivity({ session, action: "Güncelleme", entity: "Kullanıcı", entityId: id, companyId: rows[0]?.company_id, details: { message: `${rows[0]?.full_name || rows[0]?.email} kullanıcısı güncellendi`, previous_role: existing.role, role: rows[0]?.role } });
    return NextResponse.json({ ok: true, user: rows[0] });
  } catch (error) {
    const safeError = getSafeSupabaseError(error);
    console.error("Kullanıcı güncelleme Supabase hatası:", safeError.detail);
    return NextResponse.json(
      {
        error: safeError.title,
        supabaseError: safeError.detail,
        possibleCause: "Service role kullanılmasına rağmen hata alınıyorsa public.users şeması veya tablo izinleri kontrol edilmelidir."
      },
      { status: 500 }
    );
  }
}
