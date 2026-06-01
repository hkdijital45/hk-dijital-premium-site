import { NextResponse } from "next/server";
import { getSession, isStaffRole } from "@/lib/auth";
import { recordActivity } from "@/lib/activity-log";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

async function requireStaff() {
  const session = await getSession();
  return isStaffRole(session?.role) ? session : null;
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
  const patch = {
    name: payload.name || "",
    sector: payload.sector || "",
    city: payload.city || "",
    website: payload.website || "",
    instagram: payload.instagram || "",
    phone: payload.phone || "",
    email: payload.email || "",
    status: payload.status || "Aktif",
    updated_at: new Date().toISOString()
  };

  if (!patch.name.trim()) {
    return NextResponse.json({ error: "Zorunlu alan eksik", supabaseError: "Firma adı zorunludur." }, { status: 400 });
  }

  try {
    const rows = await supabaseRest<any[]>(`companies?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch)
    });
    await recordActivity({ session, action: "Güncelleme", entity: "Firma", entityId: id, companyId: id, details: { message: `${patch.name} firması güncellendi` } });
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
