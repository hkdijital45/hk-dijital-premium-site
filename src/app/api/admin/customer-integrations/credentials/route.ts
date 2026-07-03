/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getSession, isStaffRole } from "@/lib/auth";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { uuidPattern } from "@/lib/meta-pixel-admin";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normalizePatch(body: Record<string, any>) {
  const allowed = [
    "status",
    "admin_review_status",
    "login_email",
    "login_username",
    "login_password",
    "recovery_email",
    "two_factor_note",
    "access_note",
    "notes"
  ];
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const field of allowed) if (field in body) patch[field] = clean(body[field]);
  if (body.sensitive_metadata && typeof body.sensitive_metadata === "object") patch.sensitive_metadata = body.sensitive_metadata;
  return patch;
}

async function requireStaff() {
  const session = await getSession();
  return session && isStaffRole(session.role) ? session : null;
}

export async function GET(request: Request) {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Bu bilgiler yalnız admin ekibi tarafından görüntülenebilir." }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ credentials: [], warning: "Supabase bağlantısı yapılandırılmadı." });
  const customerId = new URL(request.url).searchParams.get("customerId") || "";
  if (!uuidPattern.test(customerId)) return NextResponse.json({ error: "Geçerli müşteri seçin." }, { status: 400 });
  try {
    const rows = await supabaseRest<any[]>(`customer_integrations?company_id=eq.${encodeURIComponent(customerId)}&select=*&limit=1`).catch(() => []);
    return NextResponse.json({ credentials: rows, message: rows.length ? "Bağlantı bilgileri alındı." : "Bu müşteri henüz hesap bilgisi eklemedi." });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title, supabaseError: safe.detail }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Bu işlem için admin yetkisi gerekir." }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });
  const body = await request.json().catch(() => ({}));
  const id = clean(body.id);
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçerli bağlantı kaydı seçin." }, { status: 400 });
  try {
    const rows = await supabaseRest<any[]>(`customer_integrations?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ ...normalizePatch(body), updated_by: session.profileId || null })
    });
    return NextResponse.json({ ok: true, credential: rows[0], message: "Bağlantı bilgisi güncellendi." });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title, supabaseError: safe.detail }, { status: 500 });
  }
}
