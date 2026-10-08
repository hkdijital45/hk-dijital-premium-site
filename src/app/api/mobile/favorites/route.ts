import { NextResponse } from "next/server";
import { requireMobileStaffSession } from "@/lib/mobile-auth";
import { allowedFavoriteSlugs, normalizeFavorites, moduleDetails } from "@/lib/mobile-favorites";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

/**
 * Real, server-backed, cross-device module favorites — the exact same
 * public.admin_user_preferences.favorite_modules row the web admin's
 * Favoriler button reads/writes (see /api/admin/preferences). This route
 * does not introduce a new favorites system or table; it is a bearer-token
 * equivalent of the existing cookie-based route.
 */

type PreferenceRow = { favorite_modules?: unknown; updated_at?: string | null };

async function loadPreference(userId: string) {
  const rows = await supabaseRest<PreferenceRow[]>(`admin_user_preferences?user_id=eq.${encodeURIComponent(userId)}&select=favorite_modules,updated_at&limit=1`).catch(() => []);
  return rows[0] || null;
}

export async function GET(request: Request) {
  const session = requireMobileStaffSession(request);
  if (!session?.profileId) return NextResponse.json({ error: "Bu işlem için yönetici oturumu gerekir." }, { status: 401 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });
  try {
    const row = await loadPreference(session.profileId);
    const allowed = allowedFavoriteSlugs(session);
    const favorites = normalizeFavorites(row?.favorite_modules, allowed);
    return NextResponse.json({ favorites: moduleDetails(favorites), updatedAt: row?.updated_at || null });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = requireMobileStaffSession(request);
  if (!session?.profileId) return NextResponse.json({ error: "Bu işlem için yönetici oturumu gerekir." }, { status: 401 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  const allowed = allowedFavoriteSlugs(session);
  const existing = await loadPreference(session.profileId);
  const favorites = body.favorites === undefined
    ? normalizeFavorites(existing?.favorite_modules, allowed)
    : normalizeFavorites(body.favorites, allowed);
  try {
    const rows = await supabaseRest<PreferenceRow[]>("admin_user_preferences?on_conflict=user_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ user_id: session.profileId, favorite_modules: favorites, updated_at: new Date().toISOString() })
    });
    return NextResponse.json({ ok: true, favorites: moduleDetails(favorites), updatedAt: rows[0]?.updated_at || null });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
