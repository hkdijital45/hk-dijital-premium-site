import { NextResponse } from "next/server";
import {
  createSupabaseAuthUser,
  findSupabaseAuthUserByEmail,
  updateSupabaseAuthUser
} from "@/lib/auth";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

type UserProfile = {
  id: string;
  email: string;
  auth_user_id: string | null;
  full_name: string | null;
  role: string;
  is_active: boolean;
};

async function activeAdminExists() {
  const admins = await supabaseRest<Array<{ id: string }>>("users?role=eq.admin&is_active=eq.true&select=id&limit=1");
  return admins.length > 0;
}

async function getProfilesByEmail(email: string) {
  return supabaseRest<UserProfile[]>(
    `users?email=eq.${encodeURIComponent(email)}&select=id,email,auth_user_id,full_name,role,is_active&limit=1`
  );
}

async function getProfilesByAuthUserId(authUserId: string) {
  return supabaseRest<UserProfile[]>(
    `users?auth_user_id=eq.${encodeURIComponent(authUserId)}&select=id,email,auth_user_id,full_name,role,is_active&limit=1`
  );
}

async function patchProfile(id: string, payload: Record<string, unknown>) {
  const rows = await supabaseRest<UserProfile[]>(`users?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      ...payload,
      updated_at: new Date().toISOString()
    })
  });
  return rows[0];
}

async function insertProfile(payload: Record<string, unknown>) {
  const rows = await supabaseRest<UserProfile[]>("users", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  return rows[0];
}

export async function POST(request: Request) {
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });
  }

  const { fullName, email, password, bootstrapSecret } = await request.json();
  const expectedSecret = process.env.BOOTSTRAP_ADMIN_SECRET || "";
  const normalizedSecret = String(bootstrapSecret || "");

  if (!expectedSecret || normalizedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Bootstrap anahtarı hatalı." }, { status: 403 });
  }

  if (process.env.FORCE_BOOTSTRAP_ADMIN !== "true" && (await activeAdminExists())) {
    return NextResponse.json({ error: "Aktif admin hesabı zaten var." }, { status: 409 });
  }

  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedName = String(fullName || "").trim();
  const normalizedPassword = String(password || "");

  if (!normalizedName || !normalizedEmail) {
    return NextResponse.json({ error: "Ad Soyad ve e-posta zorunludur." }, { status: 400 });
  }

  if (normalizedPassword.length < 8) {
    return NextResponse.json({ error: "Şifre en az 8 karakter olmalıdır." }, { status: 400 });
  }

  try {
    let authUser = await findSupabaseAuthUserByEmail(normalizedEmail);

    if (authUser) {
      authUser = await updateSupabaseAuthUser(authUser.id, {
        email: normalizedEmail,
        password: normalizedPassword,
        fullName: normalizedName
      });
    } else {
      try {
        authUser = await createSupabaseAuthUser({
          email: normalizedEmail,
          password: normalizedPassword,
          fullName: normalizedName
        });
      } catch {
        const existingAfterCreateAttempt = await findSupabaseAuthUserByEmail(normalizedEmail);
        if (!existingAfterCreateAttempt) throw new Error("Supabase Auth kullanıcısı oluşturulamadı.");
        authUser = await updateSupabaseAuthUser(existingAfterCreateAttempt.id, {
          email: normalizedEmail,
          password: normalizedPassword,
          fullName: normalizedName
        });
      }
    }

    if (!authUser?.id) {
      throw new Error("Supabase Auth kullanıcı kimliği alınamadı.");
    }

    const [emailProfile] = await getProfilesByEmail(normalizedEmail);
    const [authProfile] = await getProfilesByAuthUserId(authUser.id);

    if (emailProfile && authProfile && emailProfile.id !== authProfile.id) {
      await patchProfile(authProfile.id, {
        auth_user_id: null,
        is_active: false
      });
    }

    const targetProfile = emailProfile || authProfile;
    const profilePayload = {
      auth_user_id: authUser.id,
      email: normalizedEmail,
      full_name: normalizedName,
      role: "admin",
      company_id: null,
      is_active: true
    };

    const profile = targetProfile
      ? await patchProfile(targetProfile.id, profilePayload)
      : await insertProfile(profilePayload);

    return NextResponse.json({
      ok: true,
      message: "Süper admin hesabı oluşturuldu veya onarıldı. Artık giriş yapabilirsiniz.",
      user: {
        id: profile.id,
        email: profile.email,
        role: profile.role,
        isActive: profile.is_active
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Süper admin hesabı oluşturulamadı veya onarılamadı."
      },
      { status: 500 }
    );
  }
}
