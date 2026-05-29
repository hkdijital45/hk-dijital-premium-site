import { NextResponse } from "next/server";
import { getSession, isAdminRole } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/supabase";

export async function POST() {
  const session = await getSession();
  if (!isAdminRole(session?.role)) {
    return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekir." }, { status: 403 });
  }

  if (!hasSupabaseConfig()) {
    return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message:
      "Şifre sıfırlama akışı hazırlandı. Üretimde Supabase Auth reset password e-postası veya güvenli geçici şifre ekranı bağlanmalıdır."
  });
}
