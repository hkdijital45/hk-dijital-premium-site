import { NextResponse } from "next/server";
import { createSession, createSupabaseAuthUser } from "@/lib/auth";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

async function adminExists() {
  const rows = await supabaseRest<Array<{ id: string }>>("users?role=eq.admin&select=id&limit=1");
  return rows.length > 0;
}

export async function GET() {
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ allowed: false, error: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });
  }

  return NextResponse.json({ allowed: !(await adminExists()) });
}

export async function POST(request: Request) {
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });
  }

  if (await adminExists()) {
    return NextResponse.json({ error: "Kurulum tamamlandı. Bu sayfa artık kullanılamaz." }, { status: 403 });
  }

  const { fullName, email, password, passwordConfirm } = await request.json();
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedName = String(fullName || "").trim();
  const normalizedPassword = String(password || "");

  if (!normalizedName || !normalizedEmail) {
    return NextResponse.json({ error: "Ad Soyad ve e-posta zorunludur." }, { status: 400 });
  }

  if (normalizedPassword.length < 8) {
    return NextResponse.json({ error: "Şifre en az 8 karakter olmalıdır." }, { status: 400 });
  }

  if (normalizedPassword !== String(passwordConfirm || "")) {
    return NextResponse.json({ error: "Şifre tekrarı eşleşmiyor." }, { status: 400 });
  }

  try {
    const authUser = await createSupabaseAuthUser({
      email: normalizedEmail,
      password: normalizedPassword,
      fullName: normalizedName
    });

    const rows = await supabaseRest<any[]>("users", {
      method: "POST",
      body: JSON.stringify({
        auth_user_id: authUser.id,
        email: normalizedEmail,
        full_name: normalizedName,
        role: "admin",
        is_active: true
      })
    });

    const profile = rows[0];
    await createSession({
      authUserId: authUser.id,
      profileId: profile.id,
      email: normalizedEmail,
      fullName: normalizedName,
      role: "admin",
      companyId: null
    });

    return NextResponse.json({
      ok: true,
      message: "İlk yönetici hesabı oluşturuldu. Giriş yapabilirsiniz."
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "İlk yönetici hesabı oluşturulamadı."
      },
      { status: 500 }
    );
  }
}
