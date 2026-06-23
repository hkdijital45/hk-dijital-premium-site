/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getSession, isStaffRole } from "@/lib/auth";
import { recordActivity } from "@/lib/activity-log";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";
import { uuidPattern } from "@/lib/meta-pixel-admin";

async function staffSession() {
  const session = await getSession();
  return isStaffRole(session?.role) ? session : null;
}

export async function GET(request: Request) {
  if (!(await staffSession())) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const companyId = new URL(request.url).searchParams.get("companyId") || "";
  if (!uuidPattern.test(companyId)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });
  const [payments, tasks] = await Promise.all([
    supabaseRest<any[]>(`payment_records?company_id=eq.${companyId}&archived_at=is.null&select=*&order=due_date.desc`).catch(() => []),
    supabaseRest<any[]>(`agency_tasks?company_id=eq.${companyId}&archived_at=is.null&select=*&order=due_date.asc`).catch(() => [])
  ]);
  return NextResponse.json({ payments, tasks });
}

export async function POST(request: Request) {
  const session = await staffSession();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const resource = body.resource;
  const item = body.item || {};
  if (!uuidPattern.test(String(item.company_id || ""))) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });
  try {
    const table = resource === "payment" ? "payment_records" : resource === "task" ? "agency_tasks" : "";
    if (!table) return NextResponse.json({ error: "Geçersiz kayıt türü." }, { status: 400 });
    const now = new Date().toISOString();
    const payload = resource === "payment" ? {
      company_id: item.company_id,
      amount: Number(item.amount || 0),
      status: item.status || "Bekliyor",
      due_date: item.due_date || null,
      payment_date: item.status === "Ödendi" ? item.payment_date || now.slice(0, 10) : item.payment_date || null,
      service_period: item.service_period || null,
      description: item.description || null,
      pdf_url: item.pdf_url || null,
      visible_to_customer: item.visible_to_customer !== false,
      updated_at: now
    } : {
      company_id: item.company_id,
      title: item.title || "Yeni görev",
      description: item.description || null,
      status: item.status || "Yapılacak",
      priority: item.priority || "Normal",
      due_date: item.due_date || null,
      assigned_user_id: item.assigned_user_id || null,
      visible_to_customer: Boolean(item.visible_to_customer),
      completed_at: item.status === "Tamamlandı" ? item.completed_at || now : null,
      updated_at: now
    };
    const rows = item.id && uuidPattern.test(String(item.id))
      ? await supabaseRest<any[]>(`${table}?id=eq.${item.id}`, { method: "PATCH", body: JSON.stringify(payload) })
      : await supabaseRest<any[]>(table, { method: "POST", body: JSON.stringify(payload) });
    await recordActivity({ session, action: item.id ? "Güncelleme" : "Oluşturma", entity: resource === "payment" ? "Tahsilat" : "Görev", entityId: rows[0]?.id, companyId: item.company_id, details: { message: resource === "payment" ? "Tahsilat kaydı güncellendi" : "Görev kaydı güncellendi" } });
    return NextResponse.json({ ok: true, item: rows[0], message: resource === "payment" ? "Ödeme kaydedildi." : "Görev kaydedildi." });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title, detail: safe.detail }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await staffSession();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const table = body.resource === "payment" ? "payment_records" : body.resource === "task" ? "agency_tasks" : "";
  if (!table || !uuidPattern.test(String(body.id || ""))) return NextResponse.json({ error: "Geçersiz kayıt." }, { status: 400 });
  await supabaseRest(`${table}?id=eq.${body.id}`, { method: "PATCH", body: JSON.stringify({ archived_at: new Date().toISOString() }) });
  await recordActivity({ session, action: "Silme", entity: body.resource === "payment" ? "Tahsilat" : "Görev", entityId: body.id, companyId: body.company_id || null, details: { message: "Kayıt güvenli şekilde arşivlendi" } });
  return NextResponse.json({ ok: true, message: "Kayıt arşivlendi." });
}
