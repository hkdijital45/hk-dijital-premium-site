/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getSession, isStaffRole } from "@/lib/auth";
import { recordActionFailure, recordActivity } from "@/lib/activity-log";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import { checkOperationalCustomer } from "@/lib/server/customer-visibility";
import { TASK_NOTE_MAX, TASK_TITLE_MAX, isValidIsoDate } from "@/lib/task-planner";

async function staffSession() {
  const session = await getSession();
  return isStaffRole(session?.role) ? session : null;
}

export async function GET(request: Request) {
  const session = await staffSession();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const companyId = params.get("companyId") || "";
  if (params.get("scope") === "planner") {
    // Dashboard "Bugünün Planı": tüm müşteriler, filtreler veritabanı seviyesinde.
    const from = params.get("from") || "";
    const to = params.get("to") || "";
    if ((companyId && !uuidPattern.test(companyId)) || (from && !isValidIsoDate(from)) || (to && !isValidIsoDate(to))) return NextResponse.json({ error: "Geçersiz filtre." }, { status: 400 });
    const query = [
      "archived_at=is.null", "deleted_at=is.null", "parent_task_id=is.null", "status=neq.%C4%B0ptal",
      companyId && `company_id=eq.${companyId}`,
      from && `due_date=gte.${from}`,
      to && `due_date=lte.${to}`,
      "select=*", "order=due_date.asc.nullslast", "order=created_at.asc", "limit=1000"
    ].filter(Boolean).join("&");
    try {
      return NextResponse.json({ tasks: await supabaseRest<any[]>(`agency_tasks?${query}`) });
    } catch (error) {
      const safe = getSafeSupabaseError(error);
      return NextResponse.json({ error: safe.title, detail: safe.detail }, { status: 500 });
    }
  }
  if (!uuidPattern.test(companyId)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });
  try {
    const [payments, tasks] = await Promise.all([
      supabaseRest<any[]>(`payment_records?company_id=eq.${companyId}&archived_at=is.null&select=*&order=due_date.desc`),
      supabaseRest<any[]>(`agency_tasks?company_id=eq.${companyId}&archived_at=is.null&select=*&order=sort_order.asc&order=due_date.asc`)
    ]);
    return NextResponse.json({ payments, tasks });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    await recordActionFailure({ session, entity: "Müşteri Profili", action: "Görev ve tahsilat kayıtlarını yükleme", error, companyId }).catch(() => null);
    return NextResponse.json({ error: safe.title, detail: safe.detail }, { status: 500 });
  }
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
    if (resource === "payment" && (!Number.isFinite(Number(item.amount)) || Number(item.amount) <= 0)) return NextResponse.json({ error: "Tahsilat tutarı sıfırdan büyük olmalıdır." }, { status: 400 });
    if (resource === "task" && !String(item.title || "").trim()) return NextResponse.json({ error: "Görev başlığı zorunludur." }, { status: 400 });
    if (resource === "task" && String(item.title).trim().length > TASK_TITLE_MAX) return NextResponse.json({ error: `Görev başlığı en fazla ${TASK_TITLE_MAX} karakter olabilir.` }, { status: 400 });
    if (resource === "task" && String(item.description || item.notes || "").length > TASK_NOTE_MAX) return NextResponse.json({ error: `Açıklama en fazla ${TASK_NOTE_MAX} karakter olabilir.` }, { status: 400 });
    if (resource === "task" && item.due_date && !isValidIsoDate(String(item.due_date).slice(0, 10))) return NextResponse.json({ error: "Geçerli bir görev tarihi seçin." }, { status: 400 });
    const isExistingRecord = Boolean(item.id && uuidPattern.test(String(item.id)) && !item._draft && !item.isNew);
    if (!isExistingRecord) {
      const customerCheck = await checkOperationalCustomer(item.company_id);
      if (!customerCheck.ok) return NextResponse.json({ error: customerCheck.error }, { status: customerCheck.status });
    }
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
      parent_task_id: item.parent_task_id || null,
      is_subtask: Boolean(item.parent_task_id || item.is_subtask),
      title: String(item.title).trim(),
      description: item.description || null,
      notes: item.notes || item.description || null,
      status: item.status || "Yapılacak",
      priority: item.priority || "Normal",
      due_date: item.due_date || null,
      assigned_user_id: item.assigned_user_id || null,
      visible_to_customer: Boolean(item.visible_to_customer),
      completed_at: item.status === "Tamamlandı" ? item.completed_at || now : null,
      sort_order: Number(item.sort_order || 0),
      recurring_rule: item.recurring_rule || null,
      recurring_interval: Number(item.recurring_interval || 0) || null,
      recurring_until: item.recurring_until || null,
      reminder_at: item.reminder_at || null,
      template_key: item.template_key || null,
      ai_generated: Boolean(item.ai_generated),
      metadata: item.metadata || {},
      updated_at: now
    };
    const rows = isExistingRecord
      ? await supabaseRest<any[]>(`${table}?id=eq.${item.id}`, { method: "PATCH", body: JSON.stringify(payload) })
      : await supabaseRest<any[]>(table, { method: "POST", body: JSON.stringify(payload) });
    if (!rows[0]) return NextResponse.json({ error: "Kayıt bulunamadı veya güncellenemedi." }, { status: 404 });
    await recordActivity({ session, action: item.id ? "Güncelleme" : "Oluşturma", entity: resource === "payment" ? "Tahsilat" : "Görev", entityId: rows[0]?.id, companyId: item.company_id, details: { message: resource === "payment" ? "Tahsilat kaydı güncellendi" : "Görev kaydı güncellendi" } });
    return NextResponse.json({ ok: true, item: rows[0], message: resource === "payment" ? "Tahsilat kaydedildi." : "Görev kaydedildi." });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    await recordActionFailure({ session, entity: resource === "payment" ? "Tahsilat" : "Müşteri Görevleri", action: item.id ? "Kayıt güncelleme" : "Kayıt oluşturma", error, entityId: item.id, companyId: item.company_id }).catch(() => null);
    return NextResponse.json({ error: safe.title, detail: safe.detail }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await staffSession();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const table = body.resource === "payment" ? "payment_records" : body.resource === "task" ? "agency_tasks" : "";
  if (!table || !uuidPattern.test(String(body.id || ""))) return NextResponse.json({ error: "Geçersiz kayıt." }, { status: 400 });
  try {
    const rows = await supabaseRest<any[]>(`${table}?id=eq.${body.id}`, { method: "PATCH", body: JSON.stringify({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() }) });
    if (!rows[0]) return NextResponse.json({ error: "Arşivlenecek kayıt bulunamadı." }, { status: 404 });
    await recordActivity({ session, action: "Arşivleme", entity: body.resource === "payment" ? "Tahsilat" : "Görev", entityId: body.id, companyId: body.company_id || null, details: { message: "Kayıt güvenli şekilde arşivlendi", result: "Başarılı" } });
    return NextResponse.json({ ok: true, item: rows[0], message: "Kayıt arşivlendi." });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    await recordActionFailure({ session, entity: body.resource === "payment" ? "Tahsilat" : "Müşteri Görevleri", action: "Kayıt arşivleme", error, entityId: body.id, companyId: body.company_id }).catch(() => null);
    return NextResponse.json({ error: safe.title, detail: safe.detail }, { status: 500 });
  }
}
