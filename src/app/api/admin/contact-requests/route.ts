import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";
import { CONTACT_REQUEST_STATUS, statusKeyFor, type ContactRequestRow } from "@/lib/contact-requests";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SETTABLE_STATUSES = ["new", "reviewing", "archived", "spam"] as const;

export async function GET() {
  const session = await requireModuleAccess("gelen-talepler");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  try {
    const requests = await supabaseRest<ContactRequestRow[]>("contact_forms?select=*&order=created_at.desc&limit=500");
    return NextResponse.json({ requests: requests ?? [] });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).title }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await requireModuleAccess("gelen-talepler");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const body = await request.json().catch(() => null) as { id?: unknown; status?: unknown } | null;
  const id = String(body?.id ?? "");
  const key = String(body?.status ?? "") as (typeof SETTABLE_STATUSES)[number];
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: "Geçersiz talep." }, { status: 400 });
  if (!SETTABLE_STATUSES.includes(key)) return NextResponse.json({ error: "Bu durum buradan ayarlanamaz." }, { status: 400 });
  try {
    const [current] = await supabaseRest<ContactRequestRow[]>(`contact_forms?id=eq.${encodeURIComponent(id)}&select=status,converted_lead_id&limit=1`);
    if (!current) return NextResponse.json({ error: "Talep bulunamadı." }, { status: 404 });
    if (statusKeyFor(current.status) === "converted" || current.converted_lead_id) {
      return NextResponse.json({ error: "Dönüştürülmüş bir talebin durumu değiştirilemez." }, { status: 409 });
    }
    await supabaseRest(`contact_forms?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: CONTACT_REQUEST_STATUS[key], updated_at: new Date().toISOString() })
    });
    return NextResponse.json({ ok: true, status: CONTACT_REQUEST_STATUS[key] });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).title }, { status: 500 });
  }
}
