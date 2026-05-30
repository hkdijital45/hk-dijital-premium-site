import { NextResponse } from "next/server";
import { sendPasswordResetEmail } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/supabase";

export async function POST(request: Request) {
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });
  }

  const { email } = await request.json();
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!normalizedEmail) {
    return NextResponse.json({ error: "E-posta adresi zorunludur." }, { status: 400 });
  }

  try {
    await sendPasswordResetEmail(normalizedEmail);
    return NextResponse.json({
      ok: true,
      message: "Şifre sıfırlama bağlantısı e-posta adresinize gönderildi."
    });
  } catch {
    return NextResponse.json(
      { error: "Şifre sıfırlama e-postası gönderilemedi. Lütfen daha sonra tekrar deneyin." },
      { status: 500 }
    );
  }
}
