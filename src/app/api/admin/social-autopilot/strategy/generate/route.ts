import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { generateMonthlyStrategy } from "@/lib/social-autopilot/strategy-engine";
import { summarizeRecentLearnings } from "@/lib/social-autopilot/learning-engine";
import { SOCIAL_WORKSPACE_ID } from "@/lib/social-autopilot/types";
import type { SocialBrandProfile } from "@/lib/social-autopilot/types";

// Manual "Stratejiyi Şimdi Oluştur" trigger — bypasses the "only refresh
// once the period elapsed" gate the daily cycle applies, for deliberate
// admin-initiated regeneration (e.g. brand profile just changed).
export async function POST() {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });

  try {
    const brandRows = await supabaseRest<SocialBrandProfile[]>(`social_brand_profile?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&select=*&limit=1`);
    if (!brandRows[0]) return NextResponse.json({ error: "Marka profili bulunamadı." }, { status: 404 });
    const learningsSummary = await summarizeRecentLearnings();
    const result = await generateMonthlyStrategy({ brand: brandRows[0], learningsSummary });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).title }, { status: 500 });
  }
}
