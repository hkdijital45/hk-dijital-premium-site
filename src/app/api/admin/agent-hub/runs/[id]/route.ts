import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("agent-hub");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Run ID eksik." }, { status: 400 });
  const rows = hasSupabaseConfig()
    ? await supabaseRest<unknown[]>(`agent_runs?id=eq.${encodeURIComponent(id)}&select=*`).catch(() => [])
    : [];
  const run = rows[0] || null;
  if (!run) return NextResponse.json({ error: "Agent görevi bulunamadı." }, { status: 404 });
  return NextResponse.json({ run });
}
