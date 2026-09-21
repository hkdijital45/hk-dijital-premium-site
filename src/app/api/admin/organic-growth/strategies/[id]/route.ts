import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { deleteMonthlyStrategy, getMonthlyStrategy, getSafeSupabaseError, updateMonthlyStrategy } from "@/lib/organic-growth/data";
import { STRATEGY_STATUSES } from "@/lib/organic-growth/types";

type Params = { params: Promise<{ id: string }> };

function text(value: unknown, fallback = "") {
  return String(value ?? fallback).trim();
}

function stringArray(value: unknown) {
  if (Array.isArray(value)) return value.map(String).map((v) => v.trim()).filter(Boolean);
  return text(value).split(",").map((v) => v.trim()).filter(Boolean);
}

export async function GET(_request: Request, { params }: Params) {
  const session = await requireModuleAccess("blog-seo");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  try {
    const strategy = await getMonthlyStrategy(id);
    if (!strategy) return NextResponse.json({ error: "Strateji bulunamadı." }, { status: 404 });
    return NextResponse.json({ strategy });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const session = await requireModuleAccess("blog-seo");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (body.business_objective !== undefined) patch.business_objective = text(body.business_objective);
  if (body.target_services !== undefined) patch.target_services = stringArray(body.target_services);
  if (body.target_geography !== undefined) patch.target_geography = text(body.target_geography);
  if (body.target_audience !== undefined) patch.target_audience = text(body.target_audience);
  if (body.publishing_frequency !== undefined) patch.publishing_frequency = text(body.publishing_frequency);
  if (body.strategic_notes !== undefined) patch.strategic_notes = text(body.strategic_notes);
  if (body.status !== undefined) {
    if (!STRATEGY_STATUSES.includes(body.status)) return NextResponse.json({ error: "Geçersiz durum." }, { status: 400 });
    patch.status = body.status;
  }
  try {
    const strategy = await updateMonthlyStrategy(id, patch);
    if (!strategy) return NextResponse.json({ error: "Strateji bulunamadı." }, { status: 404 });
    return NextResponse.json({ strategy });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await requireModuleAccess("blog-seo");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  try {
    await deleteMonthlyStrategy(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
