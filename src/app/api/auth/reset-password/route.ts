import { NextResponse } from "next/server";
import { updatePasswordWithAccessToken } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/supabase";

export async function POST(request: Request) {
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });
  }

  const { accessToken, password, passwordConfirm } = await request.json();
  const token = String(accessToken || "").trim();
  const nextPassword = String(password || "");

  if (!token) {
    return NextResponse.json({ error: "Şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş." }, { status: 400 });
  }

  if (nextPassword.length < 8) {
    return NextResponse.json({ error: "Şifre en az 8 karakter olmalıdır." }, { status: 400 });
  }

  if (nextPassword !== String(passwordConfirm || "")) {
    return NextResponse.json({ error: "Şifre tekrarı eşleşmiyor." }, { status: 400 });
  }

  try {
    await updatePasswordWithAccessToken(token, nextPassword);
    return NextResponse.json({
      ok: true,
      message: "Şifreniz güncellendi. Yeni şifrenizle giriş yapabilirsiniz."
    });
  } catch {
    return NextResponse.json(
      { error: "Şifre güncellenemedi. Bağlantının süresini kontrol edip tekrar deneyin." },
      { status: 500 }
    );
  }
}
