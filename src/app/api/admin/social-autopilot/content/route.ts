import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { supabaseRest, getSafeSupabaseError } from "@/lib/supabase";
import { generateContentForDate } from "@/lib/social-autopilot/orchestrator";
import { SOCIAL_WORKSPACE_ID } from "@/lib/social-autopilot/types";
import type { SocialContentItem } from "@/lib/social-autopilot/types";

export async function GET(request: Request) {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const limit = Math.min(200, Number(url.searchParams.get("limit") || 50));
  try {
    const items = await supabaseRest<SocialContentItem[]>(
      `social_content_items?workspace_id=eq.${SOCIAL_WORKSPACE_ID}${status ? `&publication_status=eq.${encodeURIComponent(status)}` : ""}&select=*&order=content_date.desc&limit=${limit}`
    );
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

// Manual "create content for this date" action from İçerik Stüdyosu —
// requires optional_api_ai mode (generateContentForDate throws a clear
// Turkish error otherwise, directing the operator to Claude MCP's
// strategy_import instead).
export async function POST(request: Request) {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (typeof body.content_date !== "string") return NextResponse.json({ error: "content_date zorunludur." }, { status: 400 });
  try {
    const result = await generateContentForDate(body.content_date);
    if (!result) return NextResponse.json({ ok: true, item: null, message: "Bu tarih için üretilecek yeni içerik yok." });
    return NextResponse.json({ ok: true, item: result.item });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : getSafeSupabaseError(error).detail }, { status: 400 });
  }
}
