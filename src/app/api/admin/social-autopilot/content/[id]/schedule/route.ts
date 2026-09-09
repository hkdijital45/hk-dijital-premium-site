import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { enqueueContentItem } from "@/lib/social-autopilot/publish-queue";
import { recommendPublishTime } from "@/lib/social-autopilot/posting-time-engine";
import { getActiveStrategy } from "@/lib/social-autopilot/strategy-engine";
import { DEFAULT_QUALITY_THRESHOLD, SOCIAL_WORKSPACE_ID } from "@/lib/social-autopilot/constants";
import type { SocialAutopilotSettings, SocialContentItem } from "@/lib/social-autopilot/types";

// "Onayla ve Planla" (APPROVAL/MANUAL mode) or FULL_AUTO's own auto-schedule
// step once media is attached — the one explicit human-or-automated action
// that moves an item from READY into the publish queue.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  try {
    const [itemRows, settingsRows] = await Promise.all([
      supabaseRest<SocialContentItem[]>(`social_content_items?id=eq.${encodeURIComponent(id)}&select=*&limit=1`),
      supabaseRest<SocialAutopilotSettings[]>(`social_autopilot_settings?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&select=*&limit=1`)
    ]);
    const item = itemRows[0];
    const settings = settingsRows[0];
    if (!item) return NextResponse.json({ error: "İçerik bulunamadı." }, { status: 404 });
    if (!settings) return NextResponse.json({ error: "Ayarlar bulunamadı." }, { status: 500 });
    if (item.publication_status !== "ready") return NextResponse.json({ error: `İçerik "ready" durumunda değil (şu an: ${item.publication_status}).` }, { status: 409 });
    if (!item.media_asset_urls?.length) return NextResponse.json({ error: "Önce medya dosyası yükleyin." }, { status: 409 });
    if ((item.quality_score ?? 0) < settings.min_quality_score) return NextResponse.json({ error: `Kalite skoru eşik altında (${item.quality_score ?? 0}/${settings.min_quality_score ?? DEFAULT_QUALITY_THRESHOLD}).` }, { status: 409 });

    let scheduledAt = body.scheduledAt as string | undefined;
    let confidence: string | null = null;
    let reasoning: string | null = null;
    if (!scheduledAt) {
      const strategy = await getActiveStrategy();
      const dayIndex = strategy ? Math.max(0, Math.floor((new Date(`${item.content_date}T00:00:00Z`).getTime() - new Date(`${strategy.period_start}T00:00:00Z`).getTime()) / (24 * 60 * 60_000))) : 0;
      const recommendation = await recommendPublishTime({ contentDate: item.content_date, contentType: item.content_type, contentPillar: item.content_pillar, dayIndex });
      scheduledAt = recommendation.scheduledAt;
      confidence = recommendation.confidence;
      reasoning = recommendation.reasoning;
      await supabaseRest(`social_content_items?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ publish_confidence: confidence, publish_time_reasoning: reasoning }) });
    }

    const queueItem = await enqueueContentItem(id, scheduledAt);
    return NextResponse.json({ queueItem, scheduledAt, confidence, reasoning });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).title }, { status: 500 });
  }
}
