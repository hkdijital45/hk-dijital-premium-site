import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

export async function GET() {
  const session = await requireModuleAccess("agent-hub");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const memories = hasSupabaseConfig()
    ? await supabaseRest<unknown[]>("agent_memories?select=*&order=created_at.desc&limit=120").catch(() => [])
    : [];
  return NextResponse.json({ memories });
}

export async function POST(request: Request) {
  const session = await requireModuleAccess("agent-hub");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const companyId = String(body.companyId || body.company_id || "").trim();
  const title = String(body.title || "").trim();
  const content = String(body.content || "").trim();
  if (!companyId || !title || !content) return NextResponse.json({ error: "Müşteri, başlık ve içerik zorunludur." }, { status: 400 });

  const rows = await supabaseRest("agent_memories", {
    method: "POST",
    body: JSON.stringify({
      company_id: companyId,
      customer_id: body.customerId || null,
      memory_type: body.memoryType || "manual_note",
      title,
      content,
      impact_score: Number(body.impactScore || 0),
      tags: Array.isArray(body.tags) ? body.tags : [],
      is_active: body.isActive !== false
    })
  });

  return NextResponse.json({ ok: true, memory: Array.isArray(rows) ? rows[0] : rows });
}
