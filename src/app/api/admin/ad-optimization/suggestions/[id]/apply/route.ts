import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig } from "@/lib/supabase";
import { applyAdOptimizationSuggestion } from "@/lib/ad-optimization";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("ad-optimization");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });

  const { id } = await context.params;
  const result = await applyAdOptimizationSuggestion(id);
  return NextResponse.json(result);
}
