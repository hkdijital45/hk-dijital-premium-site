import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { supabaseRest, getSafeSupabaseError } from "@/lib/supabase";
import { recordActivity } from "@/lib/activity-log";
import { SOCIAL_WORKSPACE_ID } from "@/lib/social-autopilot/types";
import type { SocialAutopilotSettings } from "@/lib/social-autopilot/types";

const EDITABLE_FIELDS = [
  "autopilot_active", "control_mode", "test_mode", "timezone", "min_quality_score", "max_quality_retries",
  "daily_publish_cap", "posting_frequency_per_week", "reel_ratio", "carousel_ratio", "static_ratio",
  "content_pillar_weights", "funnel_stage_plan", "crisis_pause_enabled", "ai_provider_preference",
  "ai_operating_mode", "media_mode_default", "full_auto_supported_formats", "min_media_quality_score",
  "media_daily_generation_cap", "media_regeneration_limit", "notify_on_failure", "notify_on_disconnect",
  "notify_on_quality_gate_repeat_failure"
] as const;

async function getSettingsRow(): Promise<SocialAutopilotSettings | null> {
  const rows = await supabaseRest<SocialAutopilotSettings[]>(`social_autopilot_settings?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&select=*&limit=1`);
  return rows[0] || null;
}

export async function GET() {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  try {
    const settings = await getSettingsRow();
    if (!settings) return NextResponse.json({ error: "Ayarlar bulunamadı — migration uygulanmamış olabilir." }, { status: 503 });
    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  for (const field of EDITABLE_FIELDS) if (field in body) patch[field] = body[field];
  if (!Object.keys(patch).length) return NextResponse.json({ error: "Geçerli bir alan gönderilmedi." }, { status: 400 });

  try {
    const rows = await supabaseRest<SocialAutopilotSettings[]>(`social_autopilot_settings?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&select=*`, { method: "PATCH", body: JSON.stringify(patch) });
    if (!rows[0]) return NextResponse.json({ error: "Ayarlar bulunamadı." }, { status: 404 });
    await recordActivity({ action: "Güncelleme", entity: "HK Social Autopilot Ayarları", details: { changedFields: Object.keys(patch) } }).catch(() => {});
    return NextResponse.json({ settings: rows[0] });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
