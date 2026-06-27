import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

type VersionRow = { version_number?: number | null };

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("agent-hub");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const { id } = await params;
  const versions = hasSupabaseConfig()
    ? await supabaseRest<unknown[]>(`agent_prompt_versions?prompt_id=eq.${encodeURIComponent(id)}&select=*&order=version_number.desc`).catch(() => [])
    : [];
  return NextResponse.json({ versions });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("agent-hub");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 503 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const promptText = String(body.promptText || body.prompt_text || "").trim();
  if (!promptText) return NextResponse.json({ error: "Prompt metni boş olamaz." }, { status: 400 });

  const versions = await supabaseRest<VersionRow[]>(`agent_prompt_versions?prompt_id=eq.${encodeURIComponent(id)}&select=version_number&order=version_number.desc&limit=1`).catch(() => []);
  const versionNumber = Number(versions[0]?.version_number || 0) + 1;
  const rows = await supabaseRest("agent_prompt_versions", {
    method: "POST",
    body: JSON.stringify({
      prompt_id: id,
      version_number: versionNumber,
      prompt_text: promptText,
      change_note: body.changeNote || null,
      created_by: session.profileId || session.authUserId || null
    })
  });

  return NextResponse.json({ ok: true, version: Array.isArray(rows) ? rows[0] : rows });
}
