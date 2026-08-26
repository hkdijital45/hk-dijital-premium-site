import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { normalizeContentPlanItem } from "@/lib/blog-content-ops";
import type { GrowthOpportunity } from "@/lib/growth-intelligence/types";

const INBOX_PLAN_NAME = "HK Growth Intelligence Fırsatları";

// Growth Intelligence deliberately does not run its own content editor or AI
// drafting pipeline — that already exists and works in Blog & SEO Merkezi
// (content_plans / content_plan_items / the blog-seo AI route). This route is
// the bridge: it turns a scored raw signal (growth_opportunities) into a real
// content_plan_item in that existing system, so a human picks it up from
// there to draft/review/publish — same tables, one system, no duplication.
async function ensureInboxPlan(userId?: string | null) {
  const existing = await supabaseRest<Array<{ id: string }>>(
    `content_plans?name=eq.${encodeURIComponent(INBOX_PLAN_NAME)}&select=id&limit=1`
  );
  if (existing.length) return existing[0].id;

  const created = await supabaseRest<Array<{ id: string }>>("content_plans", {
    method: "POST",
    body: JSON.stringify({
      name: INBOX_PLAN_NAME,
      status: "active",
      service: "",
      region: "Türkiye",
      audience: "",
      objective: "Search Console fırsatlarından otomatik türetilen içerik fikirleri.",
      weekly_count: 3,
      preferred_days: [],
      preferred_time: "10:00",
      auto_generate_drafts: false,
      auto_publish: false,
      require_approval: true,
      created_by: userId || null
    })
  });
  return created[0].id;
}

export async function POST(request: Request) {
  const session = await requireModuleAccess("growth-intelligence");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const opportunityId = String(body.opportunityId || "");
    if (!opportunityId) return NextResponse.json({ error: "opportunityId zorunludur." }, { status: 400 });

    const opportunities = await supabaseRest<GrowthOpportunity[]>(
      `growth_opportunities?id=eq.${encodeURIComponent(opportunityId)}&select=*&limit=1`
    );
    const opportunity = opportunities[0];
    if (!opportunity) return NextResponse.json({ error: "Fırsat bulunamadı." }, { status: 404 });

    const planId = await ensureInboxPlan(session.profileId);
    const existingItems = await supabaseRest<Array<{ slug: string }>>(
      `content_plan_items?plan_id=eq.${planId}&select=slug`
    );

    const item = normalizeContentPlanItem(
      {
        title: opportunity.query,
        primary_keyword: opportunity.query,
        search_intent: "Yerel arama",
        content_type: opportunity.opportunity_type === "service_page" ? "Hizmet açıklaması" : "Blog yazısı",
        rationale: `${opportunity.recommended_action} (Opportunity Score: ${opportunity.opportunity_score}/100, ${opportunity.impressions} gösterim, ${opportunity.clicks} tıklama, ortalama sıra ${opportunity.avg_position.toFixed(1)}.)`,
        source_signals: ["Search Console"]
      },
      existingItems.map((row) => row.slug)
    );

    const inserted = await supabaseRest<Array<{ id: string }>>("content_plan_items", {
      method: "POST",
      body: JSON.stringify({ ...item, plan_id: planId })
    });

    await supabaseRest(`growth_opportunities?id=eq.${encodeURIComponent(opportunityId)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "converted", related_content_plan_item_id: inserted[0].id })
    });

    return NextResponse.json({ ok: true, planId, contentPlanItemId: inserted[0].id });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 400 });
  }
}
