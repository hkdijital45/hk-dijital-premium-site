import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig } from "@/lib/supabase";
import { getOrganicGrowthSettings, listGenerationRuns, updateOrganicGrowthSettings } from "@/lib/organic-growth/data";

export async function GET() {
  const session = await requireModuleAccess("blog-seo");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });
  try {
    const [settings, runs] = await Promise.all([getOrganicGrowthSettings(), listGenerationRuns(20)]);
    const providerConfigured = Boolean(process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.OPENAI_API_KEY);
    return NextResponse.json({ settings, runs, providerConfigured });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await requireModuleAccess("blog-seo");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (typeof body.automation_enabled === "boolean") patch.automation_enabled = body.automation_enabled;
  if (Array.isArray(body.generation_days)) patch.generation_days = body.generation_days.map(String);
  if (typeof body.min_word_count === "number" && body.min_word_count > 0) patch.min_word_count = Math.round(body.min_word_count);
  if (!Object.keys(patch).length) return NextResponse.json({ error: "Geçerli bir ayar alanı gönderilmedi." }, { status: 400 });
  try {
    const settings = await updateOrganicGrowthSettings({ ...patch, updated_by: session.email || null });
    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
