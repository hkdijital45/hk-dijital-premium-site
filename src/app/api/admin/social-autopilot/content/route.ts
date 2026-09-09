import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { generateContentForDate } from "@/lib/social-autopilot/orchestrator";
import { SOCIAL_WORKSPACE_ID } from "@/lib/social-autopilot/types";
import type { SocialContentItem } from "@/lib/social-autopilot/types";

export async function GET(request: Request) {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });

  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const status = url.searchParams.get("status");

  const filters = [`workspace_id=eq.${SOCIAL_WORKSPACE_ID}`];
  if (from) filters.push(`content_date=gte.${from}`);
  if (to) filters.push(`content_date=lte.${to}`);
  if (status) filters.push(`publication_status=eq.${status}`);

  try {
    const items = await supabaseRest<SocialContentItem[]>(`social_content_items?${filters.join("&")}&select=*&order=content_date.asc&limit=200`);
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).title }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const contentDate = String(body.contentDate || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(contentDate)) return NextResponse.json({ error: "Geçerli bir tarih (YYYY-MM-DD) gerekli." }, { status: 400 });

  try {
    const result = await generateContentForDate(contentDate);
    if (!result) return NextResponse.json({ error: "İçerik üretilemedi." }, { status: 500 });
    return NextResponse.json({ item: result.item, qualityScore: result.gateResult.overall_score, passed: result.passedThreshold });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).title }, { status: 500 });
  }
}
