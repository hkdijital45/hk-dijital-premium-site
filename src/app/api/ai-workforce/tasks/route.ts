import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig, getSafeSupabaseError, supabaseRest } from "@/lib/supabase";
import { AI_WORKFORCE_MODULE } from "@/lib/ai-workforce-schema";
import { logAiWorkforceActivity } from "@/lib/ai-workforce";

export async function GET() {
  const session = await requireModuleAccess(AI_WORKFORCE_MODULE);
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ tasks: [] });

  const tasks = await supabaseRest<unknown[]>(
    "agency_tasks?ai_generated=eq.true&deleted_at=is.null&select=id,company_id,title,description,status,priority,due_date,automation_key,created_at&order=created_at.desc&limit=100"
  ).catch(() => []);
  return NextResponse.json({ tasks });
}

// Bir Director/playbook çıktısını gerçek bir agency_tasks kaydına dönüştürür
// — approvals/[id] route'undaki "internal_write" görev oluşturma deseniyle
// birebir aynı: yeni tablo yok, sahte "tamamlandı" yok, yalnızca ajans içi
// bir görev kaydı gerçekten oluşturuluyor (dış sistemde hiçbir şey
// yayınlanmaz/gönderilmez).
export async function POST(request: Request) {
  const session = await requireModuleAccess(AI_WORKFORCE_MODULE);
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 503 });

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
  if (!title) return NextResponse.json({ error: "Görev başlığı zorunludur." }, { status: 400 });
  const description = typeof body.description === "string" ? body.description.slice(0, 4000) : "";
  const companyId = typeof body.companyId === "string" && body.companyId ? body.companyId : null;
  const priority = typeof body.priority === "string" && body.priority ? body.priority : "Normal";
  const runId = typeof body.runId === "string" ? body.runId : null;
  const createdBy = session.profileId || session.authUserId || null;

  try {
    const taskRows = await supabaseRest<{ id: string }[]>("agency_tasks", {
      method: "POST",
      body: JSON.stringify({
        company_id: companyId,
        title,
        description,
        status: "Açık",
        priority,
        ai_generated: true,
        automation_key: "ai-workforce-playbook",
        metadata: { run_id: runId, created_from: "ai-workforce", created_by: createdBy }
      })
    });
    const taskId = taskRows[0]?.id || null;
    await logAiWorkforceActivity({
      eventType: "task_created_from_report",
      summary: `AI Workforce çıktısından görev oluşturuldu: ${title}`,
      companyId,
      runId,
      taskId,
      createdBy
    });
    return NextResponse.json({ ok: true, taskId });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title, detail: safe.detail }, { status: 500 });
  }
}
