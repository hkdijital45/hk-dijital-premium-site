import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { AI_WORKFORCE_MODULE } from "@/lib/ai-workforce-schema";

// Reuses agent_memories (already used by Agent Hub) rather than a second
// memory table — AI Workforce is just another authorized surface onto it.
export async function GET(request: Request) {
  const session = await requireModuleAccess(AI_WORKFORCE_MODULE);
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ memories: [] });

  const companyId = new URL(request.url).searchParams.get("companyId");
  const filter = companyId ? `&company_id=eq.${encodeURIComponent(companyId)}` : "";
  const memories = await supabaseRest<unknown[]>(`agent_memories?is_active=eq.true${filter}&select=*&order=created_at.desc&limit=100`).catch(() => []);
  return NextResponse.json({ memories });
}

export async function POST(request: Request) {
  const session = await requireModuleAccess(AI_WORKFORCE_MODULE);
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 503 });

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!content || !title) return NextResponse.json({ error: "Başlık ve içerik zorunludur." }, { status: 400 });

  try {
    const rows = await supabaseRest<unknown[]>("agent_memories", {
      method: "POST",
      body: JSON.stringify({
        company_id: body.companyId || null,
        customer_id: body.companyId || null,
        memory_type: body.memoryType || "manual_note",
        title,
        content: content.slice(0, 5000),
        impact_score: typeof body.impactScore === "number" ? body.impactScore : 50,
        tags: Array.isArray(body.tags) ? body.tags : [],
        is_active: true
      })
    });
    return NextResponse.json({ ok: true, memory: rows[0] });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title, detail: safe.detail }, { status: 500 });
  }
}
