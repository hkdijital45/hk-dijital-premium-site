import { NextResponse } from "next/server";
import { recordActionFailure, recordActivity } from "@/lib/activity-log";
import { updateSupabaseAuthUser } from "@/lib/auth";
import { TEMPORARY_CUSTOMER_PASSWORD } from "@/lib/password-policy";
import { requireAdmin } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

const recentRequests = new Map<string, number>();
const resetWindowMs = 10_000;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekir." }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Sunucu yapılandırması eksik." }, { status: 503 });
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Geçerli bir kullanıcı seçin." }, { status: 400 });
  const requestKey = `${session.profileId || session.email}:${id}`;

  try {
    const users = await supabaseRest<any[]>(`users?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
    const user = users[0];
    if (!user) return NextResponse.json({ error: "Müşteriye bağlı giriş hesabı bulunamadı." }, { status: 404 });
    if (!["customer", "musteri"].includes(user.role)) return NextResponse.json({ error: "Yalnızca müşteri hesaplarının şifresi bu işlemle sıfırlanabilir." }, { status: 400 });
    if (!user.is_active || user.deleted_at) return NextResponse.json({ error: "Pasif veya silinmiş müşteri hesabının şifresi sıfırlanamaz." }, { status: 409 });
    if (!user.company_id) return NextResponse.json({ error: "Müşteri hesabına bağlı firma bulunamadı." }, { status: 409 });
    if (!user.auth_user_id) return NextResponse.json({ error: "Supabase Auth kullanıcısı bulunamadı." }, { status: 409 });
    const lastRequestAt = recentRequests.get(requestKey) || 0;
    if (Date.now() - lastRequestAt < resetWindowMs) {
      return NextResponse.json({ error: "Bu kullanıcı için şifre sıfırlama işlemi kısa süre önce yapıldı. Lütfen bekleyin." }, { status: 429 });
    }
    recentRequests.set(requestKey, Date.now());

    const resetAt = new Date().toISOString();
    const previousState = {
      must_change_password: Boolean(user.must_change_password),
      last_password_reset_at: user.last_password_reset_at || null
    };
    const rows = await supabaseRest<any[]>(`users?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ last_password_reset_at: resetAt, must_change_password: true, updated_at: resetAt })
    });
    if (!rows[0]) throw new Error("Kullanıcı şifre durumu güncellenemedi.");
    try {
      await updateSupabaseAuthUser(user.auth_user_id, { password: TEMPORARY_CUSTOMER_PASSWORD, fullName: user.full_name || "" });
    } catch (error) {
      await supabaseRest(`users?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ ...previousState, updated_at: new Date().toISOString() })
      }).catch(() => null);
      throw error;
    }
    const body = await request.json().catch(() => ({}));
    await recordActivity({
      session,
      action: "Şifre Sıfırlama",
      entity: "Kullanıcı",
      entityId: id,
      companyId: user.company_id,
      details: {
        event: "customer_password_reset",
        source: String(body.source || "admin_user_management").slice(0, 80),
        message: `${user.full_name || user.email} kullanıcısının şifresi geçici olarak sıfırlandı`
      }
    });
    return NextResponse.json({
      ok: true,
      user: rows[0],
      temporaryPassword: TEMPORARY_CUSTOMER_PASSWORD,
      message: "Müşteri şifresi geçici olarak sıfırlandı. Müşteri ilk girişinde yeni bir şifre belirlemek zorundadır."
    });
  } catch (error) {
    recentRequests.delete(requestKey);
    const safe = getSafeSupabaseError(error);
    console.error("[users-reset-password] Şifre sıfırlama hatası", safe.detail);
    await recordActionFailure({ session, entity: "Kullanıcı", action: "Müşteri şifresini sıfırlama", error, entityId: id }).catch(() => null);
    return NextResponse.json({ error: "Geçici şifre oluşturulamadı. Lütfen tekrar deneyin." }, { status: 500 });
  }
}
