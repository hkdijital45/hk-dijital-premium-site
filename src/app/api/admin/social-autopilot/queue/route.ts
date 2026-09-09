import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { SOCIAL_WORKSPACE_ID } from "@/lib/social-autopilot/types";
import type { SocialContentItem, SocialQueueItem } from "@/lib/social-autopilot/types";

export async function GET() {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });
  try {
    const rows = await supabaseRest<Array<SocialQueueItem & { social_content_items: SocialContentItem | null }>>(
      `social_publish_queue?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&select=*,social_content_items(*)&order=scheduled_at.desc&limit=100`
    );
    return NextResponse.json({ queue: rows });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).title }, { status: 500 });
  }
}
