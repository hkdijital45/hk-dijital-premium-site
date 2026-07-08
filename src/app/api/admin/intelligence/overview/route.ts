/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { buildCeoOverview } from "@/lib/hk-intelligence-mvp";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

async function requireIntelligenceAccess() {
  return (await requireModuleAccess("hk-intelligence-ceo"))
    || (await requireModuleAccess("google-analiz"))
    || (await requireModuleAccess("ad-insights"))
    || (await requireModuleAccess("reklam-operasyon-merkezi"));
}

export async function GET() {
  const session = await requireIntelligenceAccess();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });

  if (!hasSupabaseConfig()) {
    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      source: "fallback",
      message: "Supabase bağlantısı yapılandırılmadı. Intelligence özeti için bağlantı bekleniyor.",
      ...buildCeoOverview([], [])
    });
  }

  try {
    const [companies, integrations] = await Promise.all([
      supabaseRest<any[]>("companies?select=*&order=created_at.desc&limit=250").catch(() => []),
      supabaseRest<any[]>("customer_integrations?select=*&order=updated_at.desc&limit=500").catch(() => [])
    ]);

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      source: "supabase",
      ...buildCeoOverview(Array.isArray(companies) ? companies : [], Array.isArray(integrations) ? integrations : [])
    });
  } catch (error) {
    const safeError = getSafeSupabaseError(error);
    return NextResponse.json({
      ok: false,
      error: safeError.title,
      message: safeError.detail,
      ...buildCeoOverview([], [])
    }, { status: 200 });
  }
}
