import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { uuidPattern } from "@/lib/meta-pixel-admin";

const PRIORITIES = ["Düşük", "Orta", "Yüksek", "Kritik"];

type IncomingTask = {
  title: string; description?: string; priority?: string; due_date?: string | null;
  assigned_user_id?: string | null; company_id?: string | null; lead_id?: string | null;
  visible_to_customer?: boolean; template_key?: string | null;
};

function validate(task: IncomingTask, index: number): string | null {
  if (!task.title || !String(task.title).trim()) return `#${index + 1}: başlık zorunludur.`;
  if (task.company_id && task.lead_id) return `#${index + 1}: bir görev aynı anda hem müşteriye hem lead'e bağlanamaz.`;
  if (task.company_id && !uuidPattern.test(task.company_id)) return `#${index + 1}: geçersiz müşteri kimliği.`;
  if (task.lead_id && !uuidPattern.test(task.lead_id)) return `#${index + 1}: geçersiz lead kimliği.`;
  if (task.assigned_user_id && !uuidPattern.test(task.assigned_user_id)) return `#${index + 1}: geçersiz kullanıcı kimliği.`;
  if (task.priority && !PRIORITIES.includes(task.priority)) return `#${index + 1}: geçersiz öncelik.`;
  return null;
}

// Tek/Toplu Görev — one real batched insert (PostgREST array body) for
// however many tasks were selected, not one request per task, per the
// brief's own performance requirement. Supports CUSTOMER (company_id),
// LEAD (lead_id) and INTERNAL (neither) tasks — never both ids on the
// same row, never requires converting a lead into a customer.
export async function POST(request: Request) {
  const session = await requireModuleAccess("gorevler");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const tasks: IncomingTask[] = Array.isArray(body.tasks) ? body.tasks : [];
  if (!tasks.length) return NextResponse.json({ error: "Oluşturulacak görev listesi boş olamaz." }, { status: 400 });
  if (tasks.length > 100) return NextResponse.json({ error: "Tek seferde en fazla 100 görev oluşturulabilir." }, { status: 400 });

  for (let i = 0; i < tasks.length; i++) {
    const error = validate(tasks[i], i);
    if (error) return NextResponse.json({ error }, { status: 400 });
  }

  const now = new Date().toISOString();
  const rows = tasks.map((task) => ({
    title: String(task.title).trim(),
    description: task.description || null,
    notes: task.description || null,
    status: "Yapılacak",
    priority: task.priority || "Orta",
    due_date: task.due_date || null,
    assigned_user_id: task.assigned_user_id || null,
    company_id: task.company_id || null,
    lead_id: task.lead_id || null,
    visible_to_customer: Boolean(task.visible_to_customer),
    show_to_customer: Boolean(task.visible_to_customer),
    template_key: task.template_key || null,
    created_at: now,
    updated_at: now
  }));

  try {
    const created = await supabaseRest<Array<Record<string, unknown>>>("agency_tasks", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(rows)
    });
    return NextResponse.json({ tasks: created, count: created.length });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
