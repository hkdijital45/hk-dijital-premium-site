/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

export async function GET() {
  const session = await requireModuleAccess("hk-intelligence-ceo");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ agents: [], warning: "Supabase bağlantısı yok." });
  const rows = await supabaseRest<any[]>("hk_virtual_agents?select=*&order=agent_name.asc").catch(() => []);
  return NextResponse.json({ agents: rows });
}
