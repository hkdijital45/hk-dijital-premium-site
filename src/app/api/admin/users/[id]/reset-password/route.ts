import { NextResponse } from "next/server";
import { recordActivity } from "@/lib/activity-log";
import { updateSupabaseAuthUser } from "@/lib/auth";
import { requireAdmin } from "@/lib/permissions";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";

const temporaryPassword = "ABC12345";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekir." }, { status: 403 });
  const { id } = await context.params;
  try {
    const users = await supabaseRest<any[]>(`users?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
    const user = users[0];
    if (!user?.auth_user_id) return NextResponse.json({ error: "Kullanıcının Supabase Auth bağlantısı bulunamadı." }, { status: 400 });
    await updateSupabaseAuthUser(user.auth_user_id, { password: temporaryPassword, fullName: user.full_name || "" });
    const resetAt = new Date().toISOString();
    const rows = await supabaseRest<any[]>(`users?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ last_password_reset_at: resetAt, must_change_password: true, updated_at: resetAt })
    });
    await recordActivity({ session, action: "Şifre Sıfırlama", entity: "Kullanıcı", entityId: id, companyId: user.company_id, details: { message: `${user.full_name || user.email} kullanıcısının şifresi geçici olarak sıfırlandı` } });
    return NextResponse.json({ ok: true, user: rows[0], message: "Şifre geçici olarak ABC12345 yapıldı. Kullanıcı giriş yaptıktan sonra şifresini değiştirmelidir." });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    console.error("[users-reset-password] Şifre sıfırlama hatası", safe.detail);
    return NextResponse.json({ error: safe.title, supabaseError: safe.detail }, { status: 500 });
  }
}
