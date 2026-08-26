import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { DEFAULT_WORKSPACE_ID, type GrowthAutomationMode, type GrowthSettings } from "@/lib/growth-intelligence/types";

const automationModes: GrowthAutomationMode[] = ["manual", "assisted", "semi_automatic", "fully_automatic"];

function clampInt(value: unknown, fallback: number, min: number, max: number) {
  const num = Math.round(Number(value));
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function normalizeSettingsPatch(body: Record<string, unknown>): Partial<GrowthSettings> {
  const patch: Partial<GrowthSettings> = {};
  if (typeof body.automation_mode === "string" && automationModes.includes(body.automation_mode as GrowthAutomationMode)) {
    patch.automation_mode = body.automation_mode as GrowthAutomationMode;
  }
  if (body.min_opportunity_score !== undefined) patch.min_opportunity_score = clampInt(body.min_opportunity_score, 60, 0, 100);
  if (body.min_quality_score !== undefined) patch.min_quality_score = clampInt(body.min_quality_score, 75, 0, 100);
  if (body.min_word_count !== undefined) patch.min_word_count = clampInt(body.min_word_count, 650, 0, 10000);
  if (typeof body.require_review === "boolean") patch.require_review = body.require_review;
  if (typeof body.indexnow_enabled === "boolean") patch.indexnow_enabled = body.indexnow_enabled;
  if (typeof body.sitemap_ping_enabled === "boolean") patch.sitemap_ping_enabled = body.sitemap_ping_enabled;
  if (body.gsc_sync_frequency_hours !== undefined) patch.gsc_sync_frequency_hours = clampInt(body.gsc_sync_frequency_hours, 24, 1, 168);
  if (Array.isArray(body.target_service_pages)) patch.target_service_pages = body.target_service_pages.map((item) => String(item)).slice(0, 40);
  return patch;
}

async function ensureSettingsRow(): Promise<GrowthSettings> {
  const rows = await supabaseRest<GrowthSettings[]>(`growth_settings?workspace_id=eq.${DEFAULT_WORKSPACE_ID}&select=*&limit=1`);
  if (rows.length) return rows[0];
  const created = await supabaseRest<GrowthSettings[]>("growth_settings", {
    method: "POST",
    body: JSON.stringify({ workspace_id: DEFAULT_WORKSPACE_ID })
  });
  return created[0];
}

export async function GET() {
  const session = await requireModuleAccess("growth-intelligence");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });
  try {
    return NextResponse.json({ settings: await ensureSettingsRow() });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await requireModuleAccess("growth-intelligence");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });
  try {
    await ensureSettingsRow();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const patch = normalizeSettingsPatch(body);
    const updated = await supabaseRest<GrowthSettings[]>(
      `growth_settings?workspace_id=eq.${DEFAULT_WORKSPACE_ID}`,
      { method: "PATCH", body: JSON.stringify(patch) }
    );
    return NextResponse.json({ settings: updated[0] });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 400 });
  }
}
