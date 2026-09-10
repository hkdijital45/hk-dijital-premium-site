import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { supabaseRest, getSafeSupabaseError } from "@/lib/supabase";
import { SOCIAL_WORKSPACE_ID } from "@/lib/social-autopilot/types";
import type { SocialContentItem } from "@/lib/social-autopilot/types";

export async function GET(request: Request) {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });

  const url = new URL(request.url);
  const start = url.searchParams.get("start") || new Date().toISOString().slice(0, 10);
  const end = url.searchParams.get("end") || new Date(Date.now() + 30 * 24 * 60 * 60_000).toISOString().slice(0, 10);
  if (start > end) return NextResponse.json({ error: "start, end'den önce olmalı." }, { status: 400 });

  try {
    const items = await supabaseRest<SocialContentItem[]>(
      `social_content_items?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&content_date=gte.${start}&content_date=lte.${end}&select=*&order=content_date.asc&limit=200`
    );
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
