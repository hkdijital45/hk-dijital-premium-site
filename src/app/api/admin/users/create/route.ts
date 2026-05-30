import { NextResponse } from "next/server";
import {
  createSupabaseAuthUser,
  findSupabaseAuthUserByEmail,
  getSession,
  isAdminRole,
  updateSupabaseAuthUser
} from "@/lib/auth";
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
  const companyId = payload.companyId || payload.company_id || null;

  if (!email || !password || password.length < 8) {
    return NextResponse.json({ error: "E-posta ve en az 8 karakterlik geçici şifre zorunludur." }, { status: 400 });
  }

  if (role === "customer" && !companyId) {
    return NextResponse.json({ error: "Müşteri hesabı için firma seçimi zorunludur." }, { status: 400 });
  }

  try {
    let authUser = await findSupabaseAuthUserByEmail(email);
    if (authUser) {
      authUser = await updateSupabaseAuthUser(authUser.id, { email, password, fullName });
    } else {
      authUser = await createSupabaseAuthUser({ email, password, fullName });
    }

    const profilePayload = {
      auth_user_id: authUser.id,
      email,
      full_name: fullName,
      role,
      company_id: companyId,
      is_active: payload.isActive ?? payload.is_active ?? true,
      updated_at: new Date().toISOString()
    };

    const byEmail = await supabaseRest<any[]>(`users?email=eq.${encodeURIComponent(email)}&select=*&limit=1`);
    const byAuth = await supabaseRest<any[]>(`users?auth_user_id=eq.${encodeURIComponent(authUser.id)}&select=*&limit=1`);
    const target = byEmail[0] || byAuth[0];

    const rows = target
      ? await supabaseRest<any[]>(`users?id=eq.${target.id}`, {
          method: "PATCH",
          body: JSON.stringify(profilePayload)
        })
      : await supabaseRest<any[]>("users", {
          method: "POST",
          body: JSON.stringify(profilePayload)
        });

    return NextResponse.json({ ok: true, user: rows[0] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Kullanıcı oluşturulamadı." },
      { status: 500 }
    );
  }
}
