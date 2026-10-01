import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import { supabaseRest } from "@/lib/supabase";
import { getAdEvaluationContext, AdEvaluationCompanyNotFoundError } from "@/lib/marketing-intelligence/ad-evaluations";
import { buildAdEvaluationPrompt } from "@/lib/marketing-intelligence/ad-evaluation-prompt";

// Real context for the "Değerlendirme Hazırla" screen: company, matched
// local campaign, resolved strategy/creative strategy, previous
// evaluations, and a real metrics snapshot built from the already-synced
// campaign_metrics/meta_adset_metrics/meta_ad_metrics tables (never a new
// Graph API call — "Mevcut Meta verilerini yenile/senkronize et" is the
// existing /api/admin/meta-ads sync action, run before this). Also
// returns the ready-to-copy prompt built from that same context.
export async function GET(request: Request) {
  const session = await requireModuleAccess("ad-insights");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId") || "";
  const campaignId = searchParams.get("campaignId") || undefined;
  const rangePreset = searchParams.get("rangePreset") || undefined;
  if (!companyId || !uuidPattern.test(companyId)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });

  try {
    const [context, campaigns] = await Promise.all([
      getAdEvaluationContext(companyId, { campaignId, rangePreset }),
      supabaseRest<Array<{ id: string; name: string; status: string; meta_campaign_id: string | null }>>(
        `campaigns?company_id=eq.${encodeURIComponent(companyId)}&select=id,name,status,meta_campaign_id&order=created_at.desc`
      ).catch(() => [])
    ]);
    const prompt = buildAdEvaluationPrompt(context);
    return NextResponse.json({ context, prompt, campaigns });
  } catch (error) {
    if (error instanceof AdEvaluationCompanyNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Beklenmeyen hata." }, { status: 500 });
  }
}
