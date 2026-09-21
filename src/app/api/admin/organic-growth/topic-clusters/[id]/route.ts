import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { deleteTopicCluster, getSafeSupabaseError, updateTopicCluster } from "@/lib/organic-growth/data";

type Params = { params: Promise<{ id: string }> };

function text(value: unknown, fallback = "") {
  return String(value ?? fallback).trim();
}

export async function PATCH(request: Request, { params }: Params) {
  const session = await requireModuleAccess("blog-seo");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.name = text(body.name);
  if (body.description !== undefined) patch.description = text(body.description);
  if (body.target_service !== undefined) patch.target_service = text(body.target_service) || null;
  if (body.search_intents !== undefined) patch.search_intents = Array.isArray(body.search_intents) ? body.search_intents.map(String).filter(Boolean) : [];
  if (body.geography !== undefined) patch.geography = text(body.geography) || null;
  if (body.pillar_article_id !== undefined) patch.pillar_article_id = text(body.pillar_article_id) || null;
  try {
    const cluster = await updateTopicCluster(id, patch);
    if (!cluster) return NextResponse.json({ error: "Küme bulunamadı." }, { status: 404 });
    return NextResponse.json({ cluster });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await requireModuleAccess("blog-seo");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  try {
    await deleteTopicCluster(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
