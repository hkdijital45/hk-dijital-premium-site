import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { DEFAULT_WORKSPACE_ID, type GrowthOpportunity, type GrowthOpportunityStatus } from "@/lib/growth-intelligence/types";

const statuses: GrowthOpportunityStatus[] = ["new", "reviewing", "converted", "dismissed"];

export async function GET(request: Request) {
  const session = await requireModuleAccess("growth-intelligence");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ opportunities: [], source: "empty" });

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const minScore = url.searchParams.get("minScore");

  const filters = [`workspace_id=eq.${DEFAULT_WORKSPACE_ID}`];
  if (status && statuses.includes(status as GrowthOpportunityStatus)) filters.push(`status=eq.${status}`);
  if (minScore) filters.push(`opportunity_score=gte.${Math.max(0, Math.min(100, Number(minScore) || 0))}`);

  try {
    const opportunities = await supabaseRest<GrowthOpportunity[]>(
      `growth_opportunities?${filters.join("&")}&select=*&order=opportunity_score.desc&limit=200`
    );
    return NextResponse.json({ opportunities, source: "database" });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await requireModuleAccess("growth-intelligence");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const id = String(body.id || "");
    const status = String(body.status || "");
    if (!id || !statuses.includes(status as GrowthOpportunityStatus)) {
      return NextResponse.json({ error: "Geçersiz fırsat kimliği veya durum." }, { status: 400 });
    }
    const updated = await supabaseRest<GrowthOpportunity[]>(
      `growth_opportunities?id=eq.${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify({ status }) }
    );
    return NextResponse.json({ opportunity: updated[0] });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 400 });
  }
}
