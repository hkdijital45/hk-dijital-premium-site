import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { AI_WORKFORCE_MODULE } from "@/lib/ai-workforce-schema";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess(AI_WORKFORCE_MODULE);
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 503 });
  const { id } = await context.params;
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const patch: Record<string, unknown> = {};
  if (typeof body.isActive === "boolean") patch.is_active = body.isActive;
  if (typeof body.name === "string") patch.name = body.name;
  if (typeof body.prompt === "string") patch.prompt = body.prompt;
  if (!Object.keys(patch).length) return NextResponse.json({ error: "Güncellenecek alan yok." }, { status: 400 });

  try {
    const rows = await supabaseRest<unknown[]>(`agent_scheduled_tasks?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch)
    });
    return NextResponse.json({ ok: true, scheduledTask: rows[0] || null });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title, detail: safe.detail }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess(AI_WORKFORCE_MODULE);
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 503 });
  const { id } = await context.params;
  await supabaseRest(`agent_scheduled_tasks?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => null);
  return NextResponse.json({ ok: true });
}
