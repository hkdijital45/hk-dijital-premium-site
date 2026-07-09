/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { recordActivity } from "@/lib/activity-log";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { requireModuleAccess } from "@/lib/permissions";

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
    "customer_package_note"
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

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireStaff();
  if (!session) {
    return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekir." }, { status: 403 });
  }

  if (!hasSupabaseConfig()) {
    return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });
  }

  const { id } = await context.params;

  try {
    await supabaseRest(`companies?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" }
    });
    await recordActivity({ session, action: "Silme", entity: "Firma", entityId: id, details: { message: "Firma silindi" } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const safeError = getSafeSupabaseError(error);
    console.error("Firma silme Supabase hatası:", safeError.detail);
    return NextResponse.json({ error: safeError.title, supabaseError: safeError.detail }, { status: 500 });
  }
}
