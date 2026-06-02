import { NextResponse } from "next/server";
import { recordActivity } from "@/lib/activity-log";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { requireModuleAccess } from "@/lib/permissions";

async function requireCrmAccess() {
  return await requireModuleAccess("crm") || requireModuleAccess("leads");
}

const editableFields = [
  "source",
  "company_id",
  "name",
  "company",
  "phone",
  "email",
  "instagram",
  "website",
  "business_type",
  "goal",
  "budget",
  "recommended_package",
  "message",
  "status",
  "notes",
  "follow_up_date",
  "city",
  "district",
  "sector",
  "address",
  "source_url",
  "deleted_at",
  "rejected_at",
  "rejection_reason"
];

function sanitizeLeadPatch(body: Record<string, unknown>) {
  const patch: Record<string, unknown> = {};
  for (const field of editableFields) {
    if (Object.prototype.hasOwnProperty.call(body, field)) patch[field] = body[field] || null;
  }
  if (Object.prototype.hasOwnProperty.call(body, "status")) patch.status = body.status || "Yeni Başvuru";
  patch.updated_at = new Date().toISOString();
  return patch;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireCrmAccess();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 503 });

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const patch = sanitizeLeadPatch(body);

  try {
    const rows = await supabaseRest<any[]>(`leads?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch)
    });
    if (!rows[0]) return NextResponse.json({ error: "Başvuru bulunamadı." }, { status: 404 });
    await recordActivity({
      session,
      action: "Güncelleme",
      entity: "Başvuru",
      entityId: id,
      companyId: rows[0].company_id,
      details: { message: "CRM başvurusu güncellendi", fields: Object.keys(patch).filter((key) => key !== "updated_at") }
    });
    return NextResponse.json({ ok: true, lead: rows[0], message: "Başvuru güncellendi." });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    console.error("[crm-lead] Başvuru güncelleme hatası", safe.detail);
    return NextResponse.json({ error: safe.title, supabaseError: safe.detail }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireCrmAccess();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 503 });

  const { id } = await context.params;
  try {
    const rows = await supabaseRest<any[]>(`leads?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Prefer: "return=representation" }
    });
    await recordActivity({
      session,
      action: "Kalıcı Silme",
      entity: "Başvuru",
      entityId: id,
      companyId: rows?.[0]?.company_id,
      details: { message: "CRM başvurusu kalıcı olarak silindi" }
    });
    return NextResponse.json({ ok: true, lead: rows?.[0] || null, message: "Başvuru kalıcı olarak silindi." });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    console.error("[crm-lead] Başvuru kalıcı silme hatası", safe.detail);
    return NextResponse.json({ error: safe.title, supabaseError: safe.detail }, { status: 500 });
  }
}
