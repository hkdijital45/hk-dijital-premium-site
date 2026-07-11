import { NextResponse } from "next/server";
import { adminNavigationItems } from "@/lib/admin-navigation";
import { getAllowedModules, requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

type PreferenceRow = {
  favorite_modules?: unknown;
  dashboard_widgets?: unknown;
  updated_at?: string | null;
};

const defaultWidgets = {
  order: ["dailySummary", "priorityActions", "customerRisks", "activity", "intelligence"],
  hidden: [] as string[]
};

function allowedFavoriteSlugs(session: Awaited<ReturnType<typeof requireModuleAccess>>) {
  const allowedModules = getAllowedModules(session);
  return new Set(adminNavigationItems.filter((item) => allowedModules.includes(item.module)).map((item) => item.slug || "dashboard"));
}

function normalizeFavorites(value: unknown, allowed: Set<string>) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => String(item || "").trim()).filter((item) => item && allowed.has(item)))).slice(0, 12);
}

function normalizeWidgets(value: unknown) {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const valid = new Set(defaultWidgets.order);
  const order = Array.isArray(input.order)
    ? Array.from(new Set(input.order.map(String).filter((item) => valid.has(item))))
    : [];
  const hidden = Array.isArray(input.hidden)
    ? Array.from(new Set(input.hidden.map(String).filter((item) => valid.has(item))))
    : [];
  return { order: [...order, ...defaultWidgets.order.filter((item) => !order.includes(item))], hidden };
}

async function loadPreference(userId: string) {
  const rows = await supabaseRest<PreferenceRow[]>(`admin_user_preferences?user_id=eq.${encodeURIComponent(userId)}&select=favorite_modules,dashboard_widgets,updated_at&limit=1`).catch(() => []);
  return rows[0] || null;
}

export async function GET() {
  const session = await requireModuleAccess("dashboard");
  if (!session?.profileId) return NextResponse.json({ error: "Bu işlem için yönetici oturumu gerekir." }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 503 });
  try {
    const row = await loadPreference(session.profileId);
    const allowed = allowedFavoriteSlugs(session);
    return NextResponse.json({
      favorites: normalizeFavorites(row?.favorite_modules, allowed),
      dashboard: normalizeWidgets(row?.dashboard_widgets),
      updatedAt: row?.updated_at || null
    });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await requireModuleAccess("dashboard");
  if (!session?.profileId) return NextResponse.json({ error: "Bu işlem için yönetici oturumu gerekir." }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  const allowed = allowedFavoriteSlugs(session);
  const existing = await loadPreference(session.profileId);
  const favorites = body.favorites === undefined
    ? normalizeFavorites(existing?.favorite_modules, allowed)
    : normalizeFavorites(body.favorites, allowed);
  const dashboard = body.dashboard === undefined
    ? normalizeWidgets(existing?.dashboard_widgets)
    : normalizeWidgets(body.dashboard);
  try {
    const rows = await supabaseRest<PreferenceRow[]>("admin_user_preferences?on_conflict=user_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        user_id: session.profileId,
        favorite_modules: favorites,
        dashboard_widgets: dashboard,
        updated_at: new Date().toISOString()
      })
    });
    return NextResponse.json({ ok: true, favorites, dashboard, updatedAt: rows[0]?.updated_at || null });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title }, { status: 500 });
  }
}
