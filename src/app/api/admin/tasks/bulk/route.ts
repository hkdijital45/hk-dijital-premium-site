/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { buildActionResult } from "@/lib/action-result";
import { recordActivity } from "@/lib/activity-log";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

const allowedActions = new Set([
  "complete",
  "archive",
  "delete",
  "postpone",
  "change_priority",
  "assign",
  "show_to_customer",
  "hide_from_customer",
  "today",
  "this_week"
]);

function today() {
  return new Date().toISOString().slice(0, 10);
}

function nextWeekDate() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

function taskPatch(action: string, payload: Record<string, any>) {
  const now = new Date().toISOString();
  if (action === "complete") return { status: "Tamamlandı", completed_at: now, updated_at: now, completed_note: payload.note || "Toplu işlem ile tamamlandı." };
  if (action === "archive") return { archived_at: now, updated_at: now };
  if (action === "delete") return { deleted_at: now, updated_at: now };
  if (action === "postpone") return { due_date: payload.due_date || nextWeekDate(), postponed_until: payload.due_date || nextWeekDate(), updated_at: now };
  if (action === "change_priority") return { priority: payload.priority || "Orta", updated_at: now };
  if (action === "assign") return { assigned_user_id: payload.assigned_user_id || null, updated_at: now };
  if (action === "show_to_customer") return { visible_to_customer: true, show_to_customer: true, updated_at: now };
  if (action === "hide_from_customer") return { visible_to_customer: false, show_to_customer: false, updated_at: now };
  if (action === "today") return { due_date: today(), updated_at: now };
  if (action === "this_week") return { due_date: nextWeekDate(), updated_at: now };
  return { updated_at: now };
}

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    complete: "Tamamlandı yapıldı",
    archive: "Arşivlendi",
    delete: "Silinmiş işaretlendi",
    postpone: "Ertelendi",
    change_priority: "Öncelik değiştirildi",
    assign: "Kullanıcı atandı",
    show_to_customer: "Müşteriye gösterildi",
    hide_from_customer: "Müşteriden gizlendi",
    today: "Bugüne alındı",
    this_week: "Bu haftaya planlandı"
  };
  return labels[action] || "Güncellendi";
}

export async function PATCH(request: Request) {
  const session = await requireModuleAccess("gorevler");
  if (!session) return NextResponse.json({ success: false, message: "Bu işlem için görev yönetimi yetkisi gerekir." }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ success: false, message: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });
  const body = await request.json().catch(() => ({}));
  const taskIds = Array.isArray(body.taskIds) ? body.taskIds.map(String).filter(Boolean) : [];
  const action = String(body.action || "");
  if (!taskIds.length) return NextResponse.json({ success: false, message: "En az bir görev seçmelisin." }, { status: 400 });
  if (!allowedActions.has(action)) return NextResponse.json({ success: false, message: "Geçerli bir toplu işlem seçmelisin." }, { status: 400 });
  try {
    const patch = taskPatch(action, body.payload || {});
    const rows = await supabaseRest<any[]>(`agency_tasks?id=in.(${taskIds.map(encodeURIComponent).join(",")})`, {
      method: "PATCH",
      body: JSON.stringify(patch)
    });
    await recordActivity({
      session,
      action: "Toplu Görev İşlemi",
      entity: "Görev",
      details: { message: `${rows.length} görev için ${actionLabel(action)} işlemi uygulandı.`, taskIds, action }
    }).catch(() => null);
    return NextResponse.json(buildActionResult({
      title: "Toplu görev işlemi tamamlandı",
      summary: `${rows.length} görev için “${actionLabel(action)}” işlemi uygulandı.`,
      entityType: "Görev",
      status: "success",
      createdRecords: [{ label: "Görev", count: rows.length, status: actionLabel(action) }],
      nextActions: ["Görev listesindeki filtreleri kontrol et.", "Müşteriye görünürlük gerekiyorsa ilgili toggle’ı aç.", "Geciken görev kalıp kalmadığını gözden geçir."],
      checkLinks: [
        { label: "Görevleri Gör", href: "/hk-admin/gorevler" },
        { label: "QA Center’da Kontrol Et", href: "/hk-admin/qa-center" }
      ],
      customerVisibility: { showToCustomer: action === "show_to_customer", label: action === "show_to_customer" ? "Seçili görevler müşteri paneline açıldı." : "Seçili görevler admin operasyon alanında kaldı." },
      technicalDetails: { taskIds, action, patch }
    }));
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json(buildActionResult({
      title: "Toplu görev işlemi tamamlanamadı",
      summary: safe.detail,
      status: "error",
      nextActions: ["Seçili görevleri kontrol et.", "Migration kolonlarının yüklü olduğundan emin ol.", "Tekrar dene."],
      technicalDetails: { error: safe.detail }
    }), { status: 500 });
  }
}
