/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { recordActivity } from "@/lib/activity-log";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { requireModuleAccess } from "@/lib/permissions";
import { isAdminRole } from "@/lib/auth";
import { uuidPattern } from "@/lib/meta-pixel-admin";

async function requireStaff() {
  return requireModuleAccess("musteriler");
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireStaff();
  if (!session) {
    return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekir." }, { status: 403 });
  }

  if (!hasSupabaseConfig()) {
    return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });
  }

  const { id } = await context.params;
  const payload = await request.json();
  if (Object.prototype.hasOwnProperty.call(payload, "is_test") && !isAdminRole(session.role)) {
    const current = await supabaseRest<Array<{ is_test?: boolean }>>(`companies?id=eq.${encodeURIComponent(id)}&select=is_test&limit=1`).catch(() => []);
    if (!current[0] || Boolean(payload.is_test) !== Boolean(current[0].is_test)) {
      return NextResponse.json({ error: "Test kaydı durumunu yalnızca admin değiştirebilir." }, { status: 403 });
    }
    delete payload.is_test;
  }
  const editableFields = [
    "name",
    "sector",
    "custom_sector",
    "city",
    "website",
    "instagram",
    "phone",
    "email",
    "status",
    "notes",
    "contact_name",
    "authorized_person",
    "sales_status",
    "pipeline_stage",
    "lifecycle_stage",
    "last_contact_at",
    "next_action_at",
    "next_action",
    "follow_up_note",
    "customer_package_type",
    "customer_package_name",
    "customer_package_price",
    "customer_package_currency",
    "customer_package_tax_note",
    "customer_package_started_at",
    "customer_package_note",
    "is_test"
  ];
  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  for (const field of editableFields) {
    if (field in payload) patch[field] = payload[field] === "" && ["last_contact_at", "next_action_at", "customer_package_started_at"].includes(field) ? null : payload[field];
  }
  if ("status" in patch || "is_active" in payload) patch.is_active = patch.status === "Pasif" || payload.is_active === false ? false : true;

  if ("name" in patch && !String(patch.name || "").trim()) {
    return NextResponse.json({ error: "Zorunlu alan eksik", supabaseError: "Firma adı zorunludur." }, { status: 400 });
  }

  try {
    const rows = await supabaseRest<any[]>(`companies?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch)
    });
    await recordActivity({ session, action: "Güncelleme", entity: "Firma", entityId: id, companyId: id, details: { message: `${patch.name || id} müşteri profili güncellendi` } });
    return NextResponse.json({ ok: true, company: rows[0] });
  } catch (error) {
    const safeError = getSafeSupabaseError(error);
    console.error("Firma güncelleme Supabase hatası:", safeError.detail);
    return NextResponse.json({ error: safeError.title, supabaseError: safeError.detail }, { status: 500 });
  }
}

async function deleteCustomerScopedRows(table: string, companyId: string) {
  try {
    await supabaseRest(`${table}?company_id=eq.${encodeURIComponent(companyId)}`, {
      method: "DELETE",
      headers: { Prefer: "return=representation" }
    });
    return { table, ok: true };
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return { table, ok: false, error: safe.detail };
  }
}

async function patchCustomerScopedRows(table: string, companyId: string, patch: Record<string, unknown>) {
  try {
    await supabaseRest(`${table}?company_id=eq.${encodeURIComponent(companyId)}`, {
      method: "PATCH",
      body: JSON.stringify(patch)
    });
    return { table, ok: true };
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return { table, ok: false, error: safe.detail };
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireStaff();
  if (!session) {
    return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekir." }, { status: 403 });
  }
  if (!isAdminRole(session.role)) {
    return NextResponse.json({ error: "Müşteriyi kalıcı silme işlemini yalnızca admin rolü yapabilir." }, { status: 403 });
  }

  if (!hasSupabaseConfig()) {
    return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });
  }

  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });

  const payload = await request.json().catch(() => ({}));
  const confirmationName = String(payload.confirmationName || payload.confirmName || "").trim();

  try {
    const existingRows = await supabaseRest<any[]>(`companies?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
    const company = existingRows[0];
    if (!company) return NextResponse.json({ error: "Müşteri kaydı bulunamadı." }, { status: 404 });
    if (confirmationName !== String(company.name || "").trim()) {
      return NextResponse.json({ error: "Kalıcı silme için müşteri adını birebir yazın." }, { status: 400 });
    }
    if (!company.deleted_at && String(company.status || "").toLocaleLowerCase("tr-TR") !== "silindi") {
      return NextResponse.json({ error: "Kalıcı silmeden önce müşteriyi silinenlere taşıyın." }, { status: 409 });
    }

    const now = new Date().toISOString();
    const cleanupResults = await Promise.all([
      deleteCustomerScopedRows("agency_tasks", id),
      deleteCustomerScopedRows("agency_notifications", id),
      deleteCustomerScopedRows("customer_integrations", id),
      deleteCustomerScopedRows("ad_integrations", id),
      deleteCustomerScopedRows("integration_sync_logs", id),
      deleteCustomerScopedRows("customer_visibility_settings", id),
      deleteCustomerScopedRows("customer_branding", id),
      deleteCustomerScopedRows("customer_user_branches", id),
      deleteCustomerScopedRows("customer_branches", id),
      patchCustomerScopedRows("users", id, { is_active: false, deleted_at: now, updated_at: now })
    ]);

    const companyPatch = {
      status: "Silindi",
      is_active: false,
      deleted_at: company.deleted_at || now,
      deleted_by: session.profileId || null,
      archived_at: company.archived_at || now,
      archived_by: company.archived_by || session.profileId || null,
      updated_at: now
    };
    const rows = await supabaseRest<any[]>(`companies?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(companyPatch)
    });

    await recordActivity({
      session,
      action: "Silme",
      entity: "Firma",
      entityId: id,
      companyId: id,
      details: {
        message: `${company.name} için kalıcı silme temizliği uygulandı. Finansal ve geçmiş rapor kayıtları korunur.`,
        permanent_cleanup: true,
        cleanup_results: cleanupResults,
        preserved_records: ["payment_records", "reports", "monthly_reports", "customer_documents", "customer_files", "activity_logs"]
      }
    });
    return NextResponse.json({ ok: true, company: rows[0] || { ...company, ...companyPatch }, cleanupResults });
  } catch (error) {
    const safeError = getSafeSupabaseError(error);
    console.error("Firma kalıcı silme temizliği Supabase hatası:", safeError.detail);
    return NextResponse.json({ error: safeError.title, supabaseError: safeError.detail }, { status: 500 });
  }
}
