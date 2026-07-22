import { NextResponse } from "next/server";
import { recordActionFailure, recordActivity } from "@/lib/activity-log";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { requireModuleAccess } from "@/lib/permissions";

// Real CRUD for the Prompt Kütüphanesi tab in HK Agent Hub. Before this
// route existed, public.agent_prompts (created in
// supabase/migrations/20260627_agent_hub_v1.sql) had no list/create route at
// all — only the already-shipped per-prompt versions/restore endpoints
// existed, and the UI rendered a hardcoded static table instead of querying
// this table.
export async function GET(request: Request) {
  const session = await requireModuleAccess("agent-hub");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ prompts: [] });

  try {
    const includeArchived = new URL(request.url).searchParams.get("includeArchived") === "1";
    const filter = includeArchived ? "" : "&is_active=eq.true";
    const prompts = await supabaseRest<any[]>(`agent_prompts?select=*${filter}&order=updated_at.desc`);
    return NextResponse.json({ prompts });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    await recordActionFailure({ session, entity: "Prompt Kütüphanesi", action: "Liste yükleme", error }).catch(() => null);
    return NextResponse.json({ error: safe.title, detail: safe.detail }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireModuleAccess("agent-hub");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const title = String(body.title || "").trim();
  const promptText = String(body.promptText || body.prompt_text || "").trim();
  const taskType = String(body.taskType || body.task_type || "").trim();
  if (!title) return NextResponse.json({ error: "Başlık zorunludur." }, { status: 400 });
  if (!promptText) return NextResponse.json({ error: "Prompt metni boş olamaz." }, { status: 400 });
  if (!taskType) return NextResponse.json({ error: "Görev tipi (kategori) zorunludur." }, { status: 400 });

  try {
    const now = new Date().toISOString();
    const rows = await supabaseRest<any[]>("agent_prompts", {
      method: "POST",
      body: JSON.stringify({
        title,
        prompt_text: promptText,
        task_type: taskType,
        provider_key: body.providerKey || body.provider_key || null,
        description: body.description ? String(body.description).slice(0, 500) : null,
        is_default: Boolean(body.isDefault),
        is_active: true,
        is_favorite: false,
        created_by: session.profileId || null,
        created_at: now,
        updated_at: now
      })
    });
    if (!rows[0]) return NextResponse.json({ error: "Prompt kaydedilemedi." }, { status: 500 });
    await recordActivity({ session, action: "Oluşturma", entity: "Prompt Kütüphanesi", entityId: rows[0].id, details: { message: `"${title}" promptu oluşturuldu` } }).catch(() => null);
    return NextResponse.json({ ok: true, prompt: rows[0], message: "Prompt kaydedildi." });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    await recordActionFailure({ session, entity: "Prompt Kütüphanesi", action: "Prompt oluşturma", error }).catch(() => null);
    return NextResponse.json({ error: safe.title, detail: safe.detail }, { status: 500 });
  }
}
