/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getSession, isAdminRole } from "@/lib/auth";
import { recordActivity } from "@/lib/activity-log";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { adminModules, normalizeRole } from "@/lib/permissions";
import { hasBranchAccessPayload, persistCustomerBranchAccess, validateCustomerBranchAccessPayload, type CustomerBranchAccessInput } from "@/lib/server/admin-user-branch-access";
import { createAvailableUsername } from "@/lib/server/usernames";
import { normalizeUsername, validateUsername } from "@/lib/usernames";
import { checkOperationalCustomer } from "@/lib/server/customer-visibility";

async function getActiveAdminCount() {
  const rows = await supabaseRest<Array<{ id: string }>>("users?role=eq.admin&is_active=eq.true&deleted_at=is.null&select=id");
  return rows.length;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!isAdminRole(session?.role)) {
    return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekir." }, { status: 403 });
  }

  if (!hasSupabaseConfig()) {
    return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });
  }

  const { id } = await context.params;
  const payload = await request.json();
  const existingRows = await supabaseRest<any[]>(`users?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
  const existing = existingRows[0];

  if (!existing) {
    return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
  }

  const nextRole = payload.role ?? existing.role;
  const nextCompanyId = (payload.companyId ?? payload.company_id ?? existing.company_id) || null;
  const nextActive = payload.isActive ?? payload.is_active ?? existing.is_active;
  const isSelf = session?.profileId === id;
  const activeAdminCount = await getActiveAdminCount();

  if (isSelf && normalizeRole(existing.role) === "admin" && normalizeRole(nextRole) !== "admin") {
    return NextResponse.json({ error: "Kendi yönetici rolünüzü kaldıramazsınız." }, { status: 400 });
  }

  if (isSelf && nextActive === false) {
    return NextResponse.json({ error: "Kendi hesabınızı devre dışı bırakamazsınız." }, { status: 400 });
  }

  if (normalizeRole(existing.role) === "admin" && existing.is_active && activeAdminCount <= 1 && (normalizeRole(nextRole) !== "admin" || nextActive === false)) {
    return NextResponse.json({ error: "Son aktif yönetici hesabı devre dışı bırakılamaz." }, { status: 400 });
  }

  let branchAccess: CustomerBranchAccessInput | null = null;
  const customerAccount = ["customer", "musteri"].includes(nextRole);
  const companyChanged = (payload.companyId !== undefined || payload.company_id !== undefined) && nextCompanyId !== existing.company_id;
  if (customerAccount && nextCompanyId && (companyChanged || !["customer", "musteri"].includes(existing.role))) {
    const customerCheck = await checkOperationalCustomer(nextCompanyId);
    if (!customerCheck.ok) return NextResponse.json({ error: customerCheck.error }, { status: customerCheck.status });
  }
  if (customerAccount && (!nextCompanyId || hasBranchAccessPayload(payload) || companyChanged || !["customer", "musteri"].includes(existing.role))) {
    if (!nextCompanyId) return NextResponse.json({ error: "Müşteri hesabı için firma seçimi zorunludur." }, { status: 400 });
    try {
      branchAccess = await validateCustomerBranchAccessPayload(payload, nextCompanyId);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Şube yetkileri doğrulanamadı." }, { status: 400 });
    }
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (payload.fullName !== undefined || payload.full_name !== undefined) patch.full_name = payload.fullName ?? payload.full_name;
  if (payload.email !== undefined) patch.email = String(payload.email || "").trim().toLowerCase();
  if (payload.username !== undefined) {
    const username = normalizeUsername(payload.username);
    const validationError = validateUsername(username);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
    const result = await createAvailableUsername({ requested: username, excludeUserId: id });
    if (result.adjusted) return NextResponse.json({ error: `Bu kullanıcı adı kullanımda. Öneri: ${result.username}` }, { status: 409 });
    patch.username = result.username;
  }
  if (payload.role !== undefined) patch.role = payload.role;
  if (payload.companyId !== undefined || payload.company_id !== undefined) patch.company_id = (payload.companyId ?? payload.company_id) || null;
  if (payload.isActive !== undefined || payload.is_active !== undefined) patch.is_active = payload.isActive ?? payload.is_active;
  if (payload.deleted_at !== undefined) patch.deleted_at = payload.deleted_at || null;
  if (Array.isArray(payload.allowed_modules)) patch.allowed_modules = payload.allowed_modules.filter((module: string) => adminModules.includes(module as any));

  try {
    const rows = await supabaseRest<any[]>(`users?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch)
    });
    if (branchAccess && nextCompanyId) {
      await persistCustomerBranchAccess(id, nextCompanyId, branchAccess);
      rows[0] = {
        ...rows[0],
        branch_access_mode: branchAccess.mode,
        default_branch_id: branchAccess.defaultBranchId,
        branch_ids: branchAccess.branchIds
      };
    }
    await recordActivity({ session, action: "Güncelleme", entity: "Kullanıcı", entityId: id, companyId: rows[0]?.company_id, details: { message: `${rows[0]?.full_name || rows[0]?.email} kullanıcısı güncellendi`, previous_role: existing.role, role: rows[0]?.role } });
    return NextResponse.json({ ok: true, user: rows[0] });
  } catch (error) {
    const safeError = getSafeSupabaseError(error);
    console.error("Kullanıcı güncelleme Supabase hatası:", safeError.detail);
    return NextResponse.json(
      {
        error: safeError.title,
        supabaseError: safeError.detail,
        possibleCause: "Service role kullanılmasına rağmen hata alınıyorsa public.users şeması veya tablo izinleri kontrol edilmelidir."
      },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!isAdminRole(session?.role)) {
    return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekir." }, { status: 403 });
  }

  if (!hasSupabaseConfig()) {
    return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });
  }

  const { id } = await context.params;
  const existingRows = await supabaseRest<any[]>(`users?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
  const existing = existingRows[0];

  if (!existing) {
    return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
  }

  if (session?.profileId === id) {
    return NextResponse.json({ error: "Kendi hesabınızı silemezsiniz." }, { status: 400 });
  }

  const activeAdminCount = await getActiveAdminCount();
  if (normalizeRole(existing.role) === "admin" && existing.is_active && activeAdminCount <= 1) {
    return NextResponse.json({ error: "Son aktif yönetici hesabı silinemez veya pasifleştirilemez." }, { status: 400 });
  }

  try {
    const deletedAt = new Date().toISOString();
    const rows = await supabaseRest<any[]>(`users?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: false, deleted_at: deletedAt, updated_at: deletedAt })
    });
    await recordActivity({ session, action: "Silme", entity: "Kullanıcı", entityId: id, companyId: rows[0]?.company_id, details: { message: `${rows[0]?.full_name || rows[0]?.email} kullanıcısı güvenli şekilde pasifleştirildi`, soft_delete: true } });
    return NextResponse.json({ ok: true, user: rows[0], message: "Bu kullanıcı güvenli şekilde pasifleştirildi." });
  } catch (error) {
    const safeError = getSafeSupabaseError(error);
    console.error("Kullanıcı silme Supabase hatası:", safeError.detail);
    return NextResponse.json({ error: safeError.title, supabaseError: safeError.detail }, { status: 500 });
  }
}
