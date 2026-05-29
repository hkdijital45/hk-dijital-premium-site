import { NextResponse } from "next/server";
import { createSupabaseAuthUser, getSession, isAdminRole } from "@/lib/auth";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

export async function POST(request: Request) {
  const session = await getSession();
  if (!isAdminRole(session?.role)) {
    return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekir." }, { status: 403 });
  }

  if (!hasSupabaseConfig()) {
    return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });
  }

  const payload = await request.json();
  const email = String(payload.email || "").trim().toLowerCase();
  const password = String(payload.password || "");
  const fullName = String(payload.fullName || payload.full_name || "").trim();
  const role = ["admin", "editor", "sales", "customer"].includes(payload.role) ? payload.role : "customer";

  if (!email || !password || password.length < 8) {
    return NextResponse.json({ error: "E-posta ve en az 8 karakterlik geçici şifre zorunludur." }, { status: 400 });
  }

  try {
    const authUser = await createSupabaseAuthUser({ email, password, fullName });
    const rows = await supabaseRest<any[]>("users", {
      method: "POST",
      body: JSON.stringify({
        auth_user_id: authUser.id,
        email,
        full_name: fullName,
        role,
        company_id: payload.companyId || payload.company_id || null,
        is_active: payload.isActive ?? payload.is_active ?? true
      })
    });

    return NextResponse.json({ ok: true, user: rows[0] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Kullanıcı oluşturulamadı." },
      { status: 500 }
    );
  }
}
