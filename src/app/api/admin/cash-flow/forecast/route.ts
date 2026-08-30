import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { generateCashFlowForecast } from "@/lib/cash-flow-forecast";

export async function GET() {
  const session = await requireModuleAccess("karlilik");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ forecasts: [] });

  try {
    const forecasts = await supabaseRest<Array<Record<string, unknown>>>("cash_flow_forecasts?select=*&order=generated_at.desc&limit=12");
    return NextResponse.json({ forecasts });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireModuleAccess("karlilik");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const periodMonths = Math.max(1, Math.min(12, Number(body.periodMonths) || 3));

  try {
    const result = await generateCashFlowForecast(periodMonths, session.profileId || null);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
