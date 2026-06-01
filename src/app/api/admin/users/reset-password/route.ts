import { NextResponse } from "next/server";
import { getSession, isAdminRole, sendPasswordResetEmail } from "@/lib/auth";
import { getSafeSupabaseError, hasSupabaseConfig } from "@/lib/supabase";
import { recordActivity } from "@/lib/activity-log";

export async function POST(request: Request) {
  const session = await getSession();
  if (!isAdminRole(session?.role)) {
    return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekir." }, { status: 403 });
  }

  if (!hasSupabaseConfig()) {
    return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });
  }

  const { email } = await request.json().catch(() => ({}));
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!normalizedEmail) {
    return NextResponse.json({ error: "E-posta adresi zorunludur." }, { status: 400 });
  }

  try {
    await sendPasswordResetEmail(normalizedEmail);
    await recordActivity({ session, action: "Şifre Sıfırlama", entity: "Kullanıcı", details: { message: `${normalizedEmail} adresine şifre sıfırlama bağlantısı gönderildi` } });
  } catch (error) {
    const safeError = getSafeSupabaseError(error);
    console.error("Şifre sıfırlama Supabase hatası:", safeError.detail);
    return NextResponse.json({ error: safeError.title, supabaseError: safeError.detail }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: "Şifre sıfırlama bağlantısı kullanıcı e-posta adresine gönderildi."
  });
}
