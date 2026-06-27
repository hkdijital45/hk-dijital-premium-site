import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

const queueStatuses = "queued,routing,provider_running,multi_agent_running,hk_finalizing,failed,cancelled";

export async function GET() {
  const session = await requireModuleAccess("agent-hub");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });

  const runs = hasSupabaseConfig()
    ? await supabaseRest<unknown[]>(`agent_runs?status=in.(${queueStatuses})&select=*&order=created_at.desc&limit=80`).catch(() => [])
    : [];

  return NextResponse.json({ runs });
}
