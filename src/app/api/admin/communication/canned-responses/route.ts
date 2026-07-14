import { NextResponse } from "next/server";
import { isStaffRole, getSession } from "@/lib/auth";
import { sanitizeCommunicationText } from "@/lib/server/customer-communication";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";

export async function GET() {
  const session = await getSession();
  if (!isStaffRole(session?.role)) return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 403 });
  try {
    const responses = await supabaseRest<Array<Record<string, unknown>>>(
      "communication_canned_responses?is_active=eq.true&select=id,title,category,body,sort_order&order=sort_order.asc"
    );
    return NextResponse.json({ responses });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.profileId || !["admin", "yonetici"].includes(session.role)) return NextResponse.json({ error: "Hazır yanıt yönetimi için yetkiniz yok." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const title = sanitizeCommunicationText(body.title, 120);
  const responseBody = sanitizeCommunicationText(body.body, 8000);
  const category = sanitizeCommunicationText(body.category, 40) || "general";
  if (!title || !responseBody) return NextResponse.json({ error: "Başlık ve yanıt metni zorunludur." }, { status: 400 });
  try {
    const rows = await supabaseRest<Array<Record<string, unknown>>>("communication_canned_responses", {
      method: "POST",
      body: JSON.stringify({ title, body: responseBody, category, created_by: session.profileId })
    });
    return NextResponse.json({ ok: true, response: rows[0] }, { status: 201 });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session?.profileId || !["admin", "yonetici"].includes(session.role)) return NextResponse.json({ error: "Hazır yanıt yönetimi için yetkiniz yok." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const id = sanitizeCommunicationText(body.id, 80);
  if (!id) return NextResponse.json({ error: "Hazır yanıt seçilmelidir." }, { status: 400 });
  try {
    await supabaseRest(`communication_canned_responses?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ is_active: false }) });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title }, { status: 500 });
  }
}
