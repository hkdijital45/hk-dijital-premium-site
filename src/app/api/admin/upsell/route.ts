import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

export async function GET() {
  const session = await requireModuleAccess("teklifler");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ opportunities: [] });

  try {
    const opportunities = await supabaseRest<Array<Record<string, unknown>>>(
      "upsell_opportunities?select=*,companies(name)&order=created_at.desc&limit=200"
    );
    return NextResponse.json({ opportunities });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await requireModuleAccess("teklifler");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = String(body.id || "");
  const status = String(body.status || "");
  if (!id || !["approved", "dismissed", "proposal_sent"].includes(status)) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  try {
    const updated = await supabaseRest<Array<Record<string, unknown>>>(`upsell_opportunities?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });
    return NextResponse.json({ opportunity: updated[0] });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
