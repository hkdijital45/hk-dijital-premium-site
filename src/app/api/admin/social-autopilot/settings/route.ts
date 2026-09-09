import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { SOCIAL_WORKSPACE_ID } from "@/lib/social-autopilot/types";
import type { SocialAutopilotSettings } from "@/lib/social-autopilot/types";

async function loadSettings() {
  const rows = await supabaseRest<SocialAutopilotSettings[]>(`social_autopilot_settings?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&select=*&limit=1`);
  return rows[0] || null;
}

export async function GET() {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });
  try {
    const settings = await loadSettings();
    if (!settings) return NextResponse.json({ error: "Ayarlar bulunamadı — migration uygulanmamış olabilir." }, { status: 404 });
    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).title }, { status: 500 });
  }
}

const EDITABLE_FIELDS = [
  "autopilot_active", "control_mode", "test_mode", "emergency_pause", "emergency_pause_reason",
  "timezone", "min_quality_score", "max_quality_retries", "daily_publish_cap", "posting_frequency_per_week",
  "reel_ratio", "carousel_ratio", "static_ratio", "content_pillar_weights", "funnel_stage_plan",
  "crisis_pause_enabled", "ai_provider_preference", "notify_on_failure", "notify_on_disconnect", "notify_on_quality_gate_repeat_failure"
] as const;

export async function PUT(request: Request) {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  for (const field of EDITABLE_FIELDS) if (field in body) patch[field] = body[field];
  if (patch.emergency_pause === true) {
    patch.emergency_paused_at = new Date().toISOString();
    patch.emergency_paused_by = session.profileId || null;
  } else if (patch.emergency_pause === false) {
    patch.emergency_pause_reason = null;
    patch.emergency_paused_at = null;
  }

  try {
    const rows = await supabaseRest<SocialAutopilotSettings[]>(`social_autopilot_settings?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&select=*`, {
      method: "PATCH", body: JSON.stringify(patch)
    });
    return NextResponse.json({ settings: rows[0] });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).title }, { status: 500 });
  }
}
