/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import {
  createSupabaseAuthUser,
  findSupabaseAuthUserByEmail,
  getSession,
  isAdminRole,
  updateSupabaseAuthUser
} from "@/lib/auth";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { recordActivity } from "@/lib/activity-log";
import { adminModules, roleTemplates, normalizeRole } from "@/lib/permissions";
import { persistCustomerBranchAccess, validateCustomerBranchAccessPayload, type CustomerBranchAccessInput } from "@/lib/server/admin-user-branch-access";
import { createAvailableUsername } from "@/lib/server/usernames";
import { checkOperationalCustomer } from "@/lib/server/customer-visibility";

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
  const role = ["admin", "yonetici", "editor", "musteri", "sales", "customer"].includes(payload.role) ? payload.role : "musteri";
  const companyId = payload.companyId || payload.company_id || null;

  if (!email || !password || password.length < 8) {
    return NextResponse.json({ error: "E-posta ve en az 8 karakterlik geçici şifre zorunludur." }, { status: 400 });
  }

  if (["customer", "musteri"].includes(role) && !companyId) {
    return NextResponse.json({ error: "Müşteri hesabı için firma seçimi zorunludur." }, { status: 400 });
  }
  if (["customer", "musteri"].includes(role)) {
    const customerCheck = await checkOperationalCustomer(companyId);
    if (!customerCheck.ok) return NextResponse.json({ error: customerCheck.error }, { status: customerCheck.status });
  }

  let branchAccess: CustomerBranchAccessInput | null = null;
  if (["customer", "musteri"].includes(role)) {
    try {
      branchAccess = await validateCustomerBranchAccessPayload(payload, companyId);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Şube yetkileri doğrulanamadı." }, { status: 400 });
    }
  }

  let createdProfileId = "";
  let createdNewProfile = false;
  try {
    const existingProfiles = await supabaseRest<any[]>(`users?email=eq.${encodeURIComponent(email)}&select=*&limit=1`);
    const companyRows = companyId
      ? await supabaseRest<Array<{ name?: string }>>(`companies?id=eq.${encodeURIComponent(companyId)}&select=name&limit=1`).catch(() => [])
      : [];
    const usernameResult = await createAvailableUsername({
      requested: payload.username,
      companyName: companyRows[0]?.name,
      fullName,
      email,
      excludeUserId: existingProfiles[0]?.id
    });
    let authUser = await findSupabaseAuthUserByEmail(email);
    if (authUser) {
      authUser = await updateSupabaseAuthUser(authUser.id, { email, password, fullName });
    } else {
      authUser = await createSupabaseAuthUser({ email, password, fullName });
    }

    const profilePayload = {
      auth_user_id: authUser.id,
      email,
      username: usernameResult.username,
      full_name: fullName,
      role,
      company_id: companyId,
      is_active: payload.isActive ?? payload.is_active ?? true,
      deleted_at: null,
      allowed_modules: Array.isArray(payload.allowed_modules)
        ? payload.allowed_modules.filter((module: string) => adminModules.includes(module as any))
        : roleTemplates[normalizeRole(role)],
      updated_at: new Date().toISOString()
    };

    const byAuth = await supabaseRest<any[]>(`users?auth_user_id=eq.${encodeURIComponent(authUser.id)}&select=*&limit=1`);
    const target = existingProfiles[0] || byAuth[0];
    createdNewProfile = !target;

    const rows = target
      ? await supabaseRest<any[]>(`users?id=eq.${target.id}`, {
          method: "PATCH",
          body: JSON.stringify(profilePayload)
        })
      : await supabaseRest<any[]>("users", {
          method: "POST",
          body: JSON.stringify(profilePayload)
        });

    createdProfileId = rows[0]?.id || "";
    if (branchAccess && createdProfileId) {
      await persistCustomerBranchAccess(createdProfileId, companyId, branchAccess);
      rows[0] = {
        ...rows[0],
        branch_access_mode: branchAccess.mode,
        default_branch_id: branchAccess.defaultBranchId,
        branch_ids: branchAccess.branchIds
      };
    }

    await recordActivity({ session, action: "Oluşturma", entity: "Kullanıcı", entityId: rows[0]?.id, companyId, details: { message: `${fullName || email} kullanıcısı oluşturuldu`, role } });
    return NextResponse.json({
      ok: true,
      user: rows[0],
      username: usernameResult.username,
      usernameAdjusted: usernameResult.adjusted,
      message: usernameResult.adjusted
        ? `Kullanıcı oluşturuldu. Seçilen ad kullanımda olduğu için ${usernameResult.username} atandı.`
        : `Kullanıcı oluşturuldu. Kullanıcı adı: ${usernameResult.username}`
    });
  } catch (error) {
    if (createdNewProfile && createdProfileId) {
      await supabaseRest(`users?id=eq.${encodeURIComponent(createdProfileId)}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: false, updated_at: new Date().toISOString() })
      }).catch(() => null);
    }
    const safeError = getSafeSupabaseError(error);
    console.error("Kullanıcı oluşturma Supabase hatası:", safeError.detail);
    return NextResponse.json(
      {
        error: safeError.title,
        supabaseError: safeError.detail,
        possibleCause: "Auth kullanıcısı veya public.users profil satırı oluşturulurken Supabase hatası alındı."
      },
      { status: 500 }
    );
  }
}
