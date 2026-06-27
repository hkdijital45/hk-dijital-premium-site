import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

type VersionRow = { prompt_text?: string | null; version_number?: number | null };

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("agent-hub");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 503 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const versionId = String(body.versionId || "").trim();
  if (!versionId) return NextResponse.json({ error: "Geri yüklenecek sürüm seçilmedi." }, { status: 400 });

  const versions = await supabaseRest<VersionRow[]>(`agent_prompt_versions?id=eq.${encodeURIComponent(versionId)}&prompt_id=eq.${encodeURIComponent(id)}&select=*`).catch(() => []);
  const version = versions[0];
  if (!version?.prompt_text) return NextResponse.json({ error: "Prompt sürümü bulunamadı." }, { status: 404 });

  await supabaseRest(`agent_prompts?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ prompt_text: version.prompt_text, updated_at: new Date().toISOString() })
  });

  return NextResponse.json({ ok: true, message: `${version.version_number || ""}. sürüm geri yüklendi.` });
}
