import { NextResponse } from "next/server";
import { recordActionFailure, recordActivity } from "@/lib/activity-log";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { requireModuleAccess } from "@/lib/permissions";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("agent-hub");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 503 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.title === "string") {
    const trimmed = body.title.trim();
    if (!trimmed) return NextResponse.json({ error: "Başlık boş olamaz." }, { status: 400 });
    patch.title = trimmed;
  }
  if (typeof body.promptText === "string" || typeof body.prompt_text === "string") {
    const trimmed = String(body.promptText ?? body.prompt_text).trim();
    if (!trimmed) return NextResponse.json({ error: "Prompt metni boş olamaz." }, { status: 400 });
    patch.prompt_text = trimmed;
  }
  if (typeof body.taskType === "string" || typeof body.task_type === "string") patch.task_type = String(body.taskType ?? body.task_type).trim();
  if (typeof body.providerKey === "string" || typeof body.provider_key === "string") patch.provider_key = body.providerKey ?? body.provider_key ?? null;
  if (typeof body.description === "string") patch.description = body.description.slice(0, 500);
  if (typeof body.isFavorite === "boolean") patch.is_favorite = body.isFavorite;
  if (typeof body.isActive === "boolean") patch.is_active = body.isActive;

  try {
    // If the prompt text changed, save the previous text as a version first
    // (reuses the already-shipped versions table/route logic instead of a
    // second, competing history mechanism).
    if (patch.prompt_text) {
      const existing = await supabaseRest<any[]>(`agent_prompts?id=eq.${encodeURIComponent(id)}&select=prompt_text`).catch(() => []);
      const previousText = existing[0]?.prompt_text;
      if (previousText && previousText !== patch.prompt_text) {
        const versions = await supabaseRest<any[]>(`agent_prompt_versions?prompt_id=eq.${encodeURIComponent(id)}&select=version_number&order=version_number.desc&limit=1`).catch(() => []);
        const versionNumber = Number(versions[0]?.version_number || 0) + 1;
        await supabaseRest("agent_prompt_versions", {
          method: "POST",
          body: JSON.stringify({ prompt_id: id, version_number: versionNumber, prompt_text: previousText, change_note: "Otomatik: düzenlemeden önceki sürüm", created_by: session.profileId || null })
        }).catch(() => null);
      }
    }

    const rows = await supabaseRest<any[]>(`agent_prompts?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) });
    if (!rows[0]) return NextResponse.json({ error: "Prompt bulunamadı." }, { status: 404 });
    await recordActivity({ session, action: "Güncelleme", entity: "Prompt Kütüphanesi", entityId: id, details: { message: "Prompt güncellendi" } }).catch(() => null);
    return NextResponse.json({ ok: true, prompt: rows[0], message: "Prompt güncellendi." });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    await recordActionFailure({ session, entity: "Prompt Kütüphanesi", action: "Prompt güncelleme", error, entityId: id }).catch(() => null);
    return NextResponse.json({ error: safe.title, detail: safe.detail }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("agent-hub");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 503 });
  const { id } = await params;

  try {
    // Soft-archive (is_active = false), consistent with this app's
    // established "never hard-delete operational records" convention.
    const rows = await supabaseRest<any[]>(`agent_prompts?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ is_active: false, updated_at: new Date().toISOString() }) });
    if (!rows[0]) return NextResponse.json({ error: "Prompt bulunamadı." }, { status: 404 });
    await recordActivity({ session, action: "Arşivleme", entity: "Prompt Kütüphanesi", entityId: id, details: { message: "Prompt arşivlendi", result: "Başarılı" } }).catch(() => null);
    return NextResponse.json({ ok: true, message: "Prompt arşivlendi." });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    await recordActionFailure({ session, entity: "Prompt Kütüphanesi", action: "Prompt arşivleme", error, entityId: id }).catch(() => null);
    return NextResponse.json({ error: safe.title, detail: safe.detail }, { status: 500 });
  }
}
