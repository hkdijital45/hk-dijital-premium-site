// Public homepage read for "HK Dijital ile Çalışan Markalar". Server-only,
// service-role query (same pattern as getSiteContent/blog posts) — only
// active brands, only the columns the showcase renders, newest sort first.
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { servicesArray, type BrandShowcaseRow } from "@/lib/brand-showcase";

export type PublicBrandShowcase = {
  id: string;
  name: string;
  logoUrl: string | null;
  services: string[];
  description: string | null;
};

export async function getActiveBrandShowcases(): Promise<PublicBrandShowcase[]> {
  if (!hasSupabaseConfig()) return [];
  try {
    const rows = await supabaseRest<BrandShowcaseRow[]>(
      "brand_showcases?select=id,name,logo_url,services,description&is_active=eq.true&order=sort_order.asc"
    );
    return (rows ?? [])
      .filter((row) => row.logo_url)
      .map((row) => ({
        id: row.id,
        name: row.name,
        logoUrl: row.logo_url,
        services: servicesArray(row.services),
        description: row.description || null
      }));
  } catch (error) {
    console.error("[brand-showcase] Aktif markalar yüklenemedi:", error instanceof Error ? error.message : error);
    return [];
  }
}
