import { NextResponse } from "next/server";
import { findSupabaseAuthUserByEmail, getSession, isAdminRole, sendPasswordResetEmail } from "@/lib/auth";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { recordActivity } from "@/lib/activity-log";

export async function POST(request: Request) {
  const session = await getSession();
  if (!isAdminRole(session?.role)) {
    return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekir." }, { status: 403 });
  }

  if (!hasSupabaseConfig()) {
    return NextResponse.json({ error: "Sunucu yapılandırması eksik. Lütfen sistem yöneticisine başvurun." }, { status: 503 });
  }

  const { email, userId, source } = await request.json().catch(() => ({}));
  const requestedUserId = String(userId || "").trim();
  const requestedEmail = String(email || "").trim().toLowerCase();

  try {
    const rows = requestedUserId
      ? await supabaseRest<any[]>(`users?id=eq.${encodeURIComponent(requestedUserId)}&select=*&limit=1`)
      : requestedEmail ? await supabaseRest<any[]>(`users?email=eq.${encodeURIComponent(requestedEmail)}&select=*&limit=1`) : [];
    const user = rows[0];
    if (!user) return NextResponse.json({ error: "Müşteriye bağlı giriş hesabı bulunamadı." }, { status: 404 });
    if (!["customer", "musteri"].includes(user.role)) return NextResponse.json({ error: "Yalnızca müşteri hesaplarına sıfırlama bağlantısı gönderilebilir." }, { status: 400 });
    if (!user.is_active || user.deleted_at) return NextResponse.json({ error: "Pasif veya silinmiş müşteri hesabına bağlantı gönderilemez." }, { status: 409 });

    const normalizedEmail = String(user.email || "").trim().toLowerCase();
    if (!normalizedEmail) {
      return NextResponse.json({ error: "Kullanıcının e-posta adresi bulunamadı." }, { status: 400 });
    }

    const authUser = user.auth_user_id ? { id: user.auth_user_id } : await findSupabaseAuthUserByEmail(normalizedEmail);
    if (!authUser) return NextResponse.json({ error: "Supabase Auth kullanıcısı bulunamadı." }, { status: 409 });
    await sendPasswordResetEmail(normalizedEmail);
    await recordActivity({ session, action: "Şifre Sıfırlama", entity: "Kullanıcı", entityId: user.id, companyId: user.company_id, details: { event: "customer_password_reset_link_sent", source: String(source || "admin_user_management").slice(0, 80), message: `${normalizedEmail} adresine şifre sıfırlama bağlantısı gönderildi` } });

    return NextResponse.json({
      ok: true,
      message: "Şifre sıfırlama bağlantısı kullanıcı e-posta adresine gönderildi."
    });
  } catch (error) {
    const safeError = getSafeSupabaseError(error);
    console.error("Şifre sıfırlama Supabase hatası:", safeError.detail);
    return NextResponse.json({ error: "Şifre sıfırlama bağlantısı gönderilemedi. E-posta ve yönlendirme ayarlarını kontrol edip tekrar deneyin." }, { status: 502 });
  }
}
