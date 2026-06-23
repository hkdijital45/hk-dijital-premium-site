import { hasSupabaseConfig, supabaseRest } from "./supabase";

export async function getGlobalMetaPixelId(fallback = "") {
  if (!hasSupabaseConfig()) return fallback || process.env.NEXT_PUBLIC_META_PIXEL_ID || "";
  try {
    const rows = await supabaseRest<Array<{ value?: { pixel_id?: string; enabled?: boolean } }>>("site_settings?key=eq.meta_pixel_global&select=value&limit=1");
    const saved = rows[0]?.value;
    if (saved?.enabled !== false && saved?.pixel_id) return saved.pixel_id;
  } catch {}
  return fallback || process.env.NEXT_PUBLIC_META_PIXEL_ID || "";
}
