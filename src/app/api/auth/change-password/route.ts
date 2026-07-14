import { NextResponse } from "next/server";
import { recordActivity } from "@/lib/activity-log";
import { getSession, isCustomerPasswordChangeRequired, updateSupabaseAuthUser } from "@/lib/auth";
import { validateNewPassword } from "@/lib/password-policy";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturumunuz bulunamadı. Lütfen tekrar giriş yapın." }, { status: 401 });
  if (!isCustomerPasswordChangeRequired(session)) {
    return NextResponse.json({ error: "Bu hesap için zorunlu şifre değişikliği bulunmuyor." }, { status: 403 });
  }
  if (!session.authUserId || !session.profileId) {
    return NextResponse.json({ error: "Supabase Auth kullanıcısı bulunamadı." }, { status: 409 });
  }
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ error: "Sunucu yapılandırması eksik." }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const password = String(body.password || "").slice(0, 129);
  const confirmation = String(body.passwordConfirm || "").slice(0, 129);
  const validationError = validateNewPassword(password, confirmation);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  try {
    await updateSupabaseAuthUser(session.authUserId, { password, fullName: session.fullName || "" });
    const changedAt = new Date().toISOString();
    const rows = await supabaseRest<Array<{ id: string }>>(`users?id=eq.${encodeURIComponent(session.profileId)}`, {
      method: "PATCH",
      body: JSON.stringify({ must_change_password: false, updated_at: changedAt })
    });
    if (!rows[0]) throw new Error("Kullanıcı profili güncellenemedi.");
    await recordActivity({
      session,
      action: "Şifre Sıfırlama",
      entity: "Kullanıcı",
      entityId: session.profileId,
      companyId: session.companyId,
      details: { event: "customer_password_changed", message: "Müşteri zorunlu şifre değişikliğini tamamladı" }
    });
    return NextResponse.json({ ok: true, message: "Şifreniz başarıyla değiştirildi.", redirectTo: "/musteri-paneli" });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    console.error("[forced-password-change] Şifre değişikliği tamamlanamadı:", safe.detail);
    return NextResponse.json({ error: "Şifre değiştirilemedi. Lütfen tekrar deneyin." }, { status: 500 });
  }
}
