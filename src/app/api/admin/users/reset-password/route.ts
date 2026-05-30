import { NextResponse } from "next/server";
import { getSession, isAdminRole, sendPasswordResetEmail } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/supabase";

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

  await sendPasswordResetEmail(normalizedEmail);

  return NextResponse.json({
    ok: true,
    message: "Şifre sıfırlama bağlantısı kullanıcı e-posta adresine gönderildi."
  });
}
