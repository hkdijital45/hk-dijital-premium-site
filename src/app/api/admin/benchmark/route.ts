import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { generateBenchmarkSnapshot, getExternalBenchmarkStatus } from "@/lib/agency-benchmark";

export async function GET() {
  const session = await requireModuleAccess("karlilik");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const external = getExternalBenchmarkStatus();
  if (!hasSupabaseConfig()) return NextResponse.json({ snapshots: [], external });

  try {
    const snapshots = await supabaseRest<Array<Record<string, unknown>>>("benchmark_snapshots?select=*&order=period_end.desc&limit=12");
    return NextResponse.json({ snapshots, external });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireModuleAccess("karlilik");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const today = new Date();
  const periodEnd = String(body.periodEnd || today.toISOString().slice(0, 10));
  const periodStart = String(body.periodStart || new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10));

  try {
    const result = await generateBenchmarkSnapshot(periodStart, periodEnd);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
