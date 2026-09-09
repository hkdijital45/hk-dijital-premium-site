import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { enqueueContentItem, processDueQueue } from "@/lib/social-autopilot/publish-queue";
import type { SocialContentItem } from "@/lib/social-autopilot/types";

// Manual override: schedules for "now" and immediately runs one queue pass
// so an admin doesn't have to wait for the next cron tick. Goes through the
// exact same enqueue + precheck + publish pipeline as a normal scheduled
// publish — no shortcut around quality/privacy/connection checks.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });
  const { id } = await params;

  try {
    const rows = await supabaseRest<SocialContentItem[]>(`social_content_items?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
    if (!rows[0]) return NextResponse.json({ error: "İçerik bulunamadı." }, { status: 404 });
    if (rows[0].publication_status !== "ready") return NextResponse.json({ error: `İçerik "ready" durumunda değil (şu an: ${rows[0].publication_status}).` }, { status: 409 });

    await enqueueContentItem(id, new Date().toISOString());
    const summary = await processDueQueue(`manual-publish-now-${session.profileId || "admin"}-${Date.now()}`);
    const updated = await supabaseRest<SocialContentItem[]>(`social_content_items?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
    return NextResponse.json({ item: updated[0], summary });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).title }, { status: 500 });
  }
}
