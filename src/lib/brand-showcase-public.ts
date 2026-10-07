// Public homepage read for "HK Dijital ile Çalışan Markalar". Server-only,
// service-role query (same pattern as getSiteContent/blog posts) — only
// active brands, only the columns the showcase renders, newest sort first.
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { mapPublicBrandRow, type BrandShowcaseRow, type PublicBrandShowcase } from "@/lib/brand-showcase";

export type { PublicBrandShowcase };

export async function getActiveBrandShowcases(): Promise<PublicBrandShowcase[]> {
  if (!hasSupabaseConfig()) return [];
  try {
    const rows = await supabaseRest<BrandShowcaseRow[]>(
      "brand_showcases?select=id,name,logo_url,services,description&is_active=eq.true&order=sort_order.asc"
    );
    return (rows ?? [])
      .map(mapPublicBrandRow)
      .filter((brand): brand is PublicBrandShowcase => brand !== null);
  } catch (error) {
    console.error("[brand-showcase] Aktif markalar yüklenemedi:", error instanceof Error ? error.message : error);
    return [];
  }
}
