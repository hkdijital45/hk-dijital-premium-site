import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { createContentPlanItem, listContentPlanItems, listTopicClusters, getSafeSupabaseError } from "@/lib/organic-growth/data";
import { parseMonthlyPlanImport } from "@/lib/organic-growth/claude-prompts";

// Structured import for a Claude-generated monthly plan. `preview=true`
// (default when the body has no `confirm: true`) only validates and
// returns what WOULD be created — nothing is written. A real import
// (confirm: true) still never silently overwrites: items whose
// working_title already exists for this strategy are skipped, not
// duplicated or replaced.
export async function POST(request: Request) {
  const session = await requireModuleAccess("blog-seo");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const raw = typeof body.raw === "string" ? body.raw : "";
  const strategyId = typeof body.strategy_id === "string" ? body.strategy_id.trim() : "";
  const confirm = body.confirm === true;
  if (!raw) return NextResponse.json({ error: "Claude çıktısı (raw JSON) gerekli." }, { status: 400 });

  const parsed = parseMonthlyPlanImport(raw);
  if (!parsed.valid) return NextResponse.json({ error: parsed.errors.join(" ") || "İçe aktarım doğrulanamadı." }, { status: 400 });

  try {
    const [existingItems, clusters] = await Promise.all([
      strategyId ? listContentPlanItems({ strategyId }) : Promise.resolve([]),
      listTopicClusters()
    ]);
    const existingTitles = new Set(existingItems.map((i) => i.working_title.toLocaleLowerCase("tr")));
    const clusterByName = new Map(clusters.map((c) => [c.name.toLocaleLowerCase("tr"), c.id]));

    const toCreate = parsed.items.filter((item) => !existingTitles.has(item.working_title.toLocaleLowerCase("tr")));
    const skipped = parsed.items.length - toCreate.length;

    if (!confirm) {
      return NextResponse.json({ preview: true, willCreate: toCreate.length, willSkipAsDuplicate: skipped, items: toCreate });
    }

    const created = [];
    for (const item of toCreate) {
      const row = await createContentPlanItem({
        strategy_id: strategyId || null,
        topic_cluster_id: item.topic_cluster ? clusterByName.get(item.topic_cluster.toLocaleLowerCase("tr")) || null : null,
        working_title: item.working_title,
        primary_topic: item.primary_topic || "",
        search_intent: item.search_intent || "",
        funnel_stage: item.funnel_stage || "",
        target_service: item.target_service || "",
        target_geography: item.target_geography || "",
        target_audience: item.target_audience || "",
        pillar_or_supporting: item.pillar_or_supporting || null,
        article_type: item.article_type || "",
        priority: item.priority || "medium",
        rationale: item.rationale || "",
        cta_objective: item.cta_objective || "",
        planned_publication_date: item.planned_publication_date || null,
        internal_link_targets: item.internal_link_targets || [],
        status: "PLANNED",
        created_by: session.email || null
      });
      created.push(row);
    }
    return NextResponse.json({ preview: false, created: created.length, skippedAsDuplicate: skipped, items: created });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
