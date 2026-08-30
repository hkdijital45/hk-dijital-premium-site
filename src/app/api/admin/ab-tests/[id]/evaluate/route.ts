import { NextResponse } from "next/server";
import { getSession, isStaffRole } from "@/lib/auth";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { evaluateAbTest } from "@/lib/ab-testing";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !isStaffRole(session.role)) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const variantA = body.variantA as { impressions: number; conversions: number } | undefined;
  const variantB = body.variantB as { impressions: number; conversions: number } | undefined;
  if (!variantA || !variantB) return NextResponse.json({ error: "variantA ve variantB metrikleri zorunludur." }, { status: 400 });

  const result = evaluateAbTest({ variantA, variantB });

  try {
    const updated = await supabaseRest<Array<Record<string, unknown>>>(`ab_tests?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: result.status,
        winner: result.winner,
        outcome_metrics: { variantA, variantB, rateA: result.rateA, rateB: result.rateB },
        end_date: result.status === "completed" ? new Date().toISOString().slice(0, 10) : null
      })
    });
    return NextResponse.json({ test: updated[0], result });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
