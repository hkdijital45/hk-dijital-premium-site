import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { AI_WORKFORCE_MODULE } from "@/lib/ai-workforce-schema";

export async function GET() {
  const session = await requireModuleAccess(AI_WORKFORCE_MODULE);
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ activity: [] });

  const activity = await supabaseRest<unknown[]>("ai_activity_log?select=*&order=created_at.desc&limit=100").catch(() => []);
  return NextResponse.json({ activity });
}
