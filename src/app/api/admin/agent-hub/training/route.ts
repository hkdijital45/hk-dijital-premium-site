import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

export async function GET() {
  const session = await requireModuleAccess("agent-hub");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const rules = hasSupabaseConfig()
    ? await supabaseRest<unknown[]>("agent_training_rules?select=*&order=priority.asc,created_at.asc&limit=120").catch(() => [])
    : [];
  return NextResponse.json({ rules });
}

export async function POST(request: Request) {
  const session = await requireModuleAccess("agent-hub");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const title = String(body.title || "").trim();
  const content = String(body.content || "").trim();
  if (!title || !content) return NextResponse.json({ error: "Kural başlığı ve içeriği zorunludur." }, { status: 400 });

  const rows = await supabaseRest("agent_training_rules", {
    method: "POST",
    body: JSON.stringify({
      rule_type: body.ruleType || "custom",
      title,
      content,
      is_active: body.isActive !== false,
      priority: Number(body.priority || 100)
    })
  });

  return NextResponse.json({ ok: true, rule: Array.isArray(rows) ? rows[0] : rows });
}
