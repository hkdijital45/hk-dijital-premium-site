import { NextResponse } from "next/server";
import { getSession, isAdminRole } from "@/lib/auth";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

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
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (payload.fullName !== undefined || payload.full_name !== undefined) patch.full_name = payload.fullName ?? payload.full_name;
  if (payload.role !== undefined) patch.role = payload.role;
  if (payload.companyId !== undefined || payload.company_id !== undefined) patch.company_id = (payload.companyId ?? payload.company_id) || null;
  if (payload.isActive !== undefined || payload.is_active !== undefined) patch.is_active = payload.isActive ?? payload.is_active;

  try {
    const rows = await supabaseRest<any[]>(`users?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch)
    });

    return NextResponse.json({ ok: true, user: rows[0] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kullanıcı güncellenemedi.";
    console.error("Kullanıcı güncelleme Supabase hatası:", message);
    return NextResponse.json(
      {
        error: "Kullanıcı güncellenemedi.",
        supabaseError: message,
        possibleCause: "Service role kullanılmasına rağmen hata alınıyorsa public.users şeması veya tablo izinleri kontrol edilmelidir."
      },
      { status: 500 }
    );
  }
}
