import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { createContentPlanItem, listContentPlanItems, getSafeSupabaseError } from "@/lib/organic-growth/data";
import { CONTENT_PLAN_STATUSES, PILLAR_OR_SUPPORTING, PRIORITY_LEVELS } from "@/lib/organic-growth/types";

function text(value: unknown, fallback = "") {
  return String(value ?? fallback).trim();
}

function stringArray(value: unknown) {
  if (Array.isArray(value)) return value.map(String).map((v) => v.trim()).filter(Boolean);
  return [];
}

export function normalizeItemPayload(body: Record<string, unknown>) {
  const workingTitle = text(body.working_title);
  if (workingTitle.length < 4) throw new Error("Çalışma başlığı en az 4 karakter olmalı.");
  const priority = (PRIORITY_LEVELS.includes(body.priority as never) ? body.priority : "medium") as "low" | "medium" | "high";
  const status = (CONTENT_PLAN_STATUSES.includes(body.status as never) ? body.status : "PLANNED") as typeof CONTENT_PLAN_STATUSES[number];
  const pillarOrSupporting = (PILLAR_OR_SUPPORTING.includes(body.pillar_or_supporting as never) ? body.pillar_or_supporting : null) as "pillar" | "supporting" | null;
  return {
    strategy_id: text(body.strategy_id) || null,
    topic_cluster_id: text(body.topic_cluster_id) || null,
    blog_post_id: text(body.blog_post_id) || null,
    planned_publication_date: text(body.planned_publication_date) || null,
    working_title: workingTitle,
    primary_topic: text(body.primary_topic),
    search_intent: text(body.search_intent),
    funnel_stage: text(body.funnel_stage),
    target_service: text(body.target_service),
    target_geography: text(body.target_geography),
    target_audience: text(body.target_audience),
    pillar_or_supporting: pillarOrSupporting,
    article_type: text(body.article_type),
    priority,
    rationale: text(body.rationale),
    cta_objective: text(body.cta_objective),
    internal_link_targets: stringArray(body.internal_link_targets),
    status,
    why_this_article: text(body.why_this_article),
    primary_question: text(body.primary_question),
    secondary_questions: stringArray(body.secondary_questions),
    related_concepts: stringArray(body.related_concepts),
    must_cover_points: stringArray(body.must_cover_points),
    existing_related_content: stringArray(body.existing_related_content),
    content_angle: text(body.content_angle),
    seo_requirements: text(body.seo_requirements),
    geo_requirements: text(body.geo_requirements),
    facts_sources: text(body.facts_sources),
    editorial_notes: text(body.editorial_notes)
  };
}

export async function GET(request: Request) {
  const session = await requireModuleAccess("blog-seo");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const url = new URL(request.url);
  try {
    const items = await listContentPlanItems({
      strategyId: url.searchParams.get("strategyId") || undefined,
      status: url.searchParams.get("status") || undefined,
      topicClusterId: url.searchParams.get("topicClusterId") || undefined
    });
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireModuleAccess("blog-seo");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  try {
    const body = await request.json();
    const payload = normalizeItemPayload(body);
    const item = await createContentPlanItem({ ...payload, created_by: session.email || null });
    return NextResponse.json({ item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Beklenmeyen hata.";
    const isValidation = error instanceof Error && !message.toLocaleLowerCase("tr").includes("supabase");
    return NextResponse.json({ error: isValidation ? message : getSafeSupabaseError(error).detail }, { status: isValidation ? 400 : 500 });
  }
}
