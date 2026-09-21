import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { createMonthlyStrategy, listMonthlyStrategies, getMonthlyStrategyByMonth, getSafeSupabaseError } from "@/lib/organic-growth/data";
import { STRATEGY_STATUSES } from "@/lib/organic-growth/types";

function text(value: unknown, fallback = "") {
  return String(value ?? fallback).trim();
}

function stringArray(value: unknown) {
  if (Array.isArray(value)) return value.map(String).map((v) => v.trim()).filter(Boolean);
  return text(value).split(",").map((v) => v.trim()).filter(Boolean);
}

export async function GET() {
  const session = await requireModuleAccess("blog-seo");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  try {
    const strategies = await listMonthlyStrategies();
    return NextResponse.json({ strategies });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireModuleAccess("blog-seo");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const month = text(body.month);
  if (!/^\d{4}-\d{2}-01$/.test(month)) {
    return NextResponse.json({ error: "Ay, YYYY-MM-01 formatında olmalı (örn. 2026-10-01)." }, { status: 400 });
  }
  try {
    const existing = await getMonthlyStrategyByMonth(month);
    if (existing) return NextResponse.json({ error: "Bu ay için zaten bir strateji mevcut." }, { status: 409 });
    const status = STRATEGY_STATUSES.includes(body.status) ? body.status : "draft";
    const strategy = await createMonthlyStrategy({
      month,
      business_objective: text(body.business_objective),
      target_services: stringArray(body.target_services),
      target_geography: text(body.target_geography),
      target_audience: text(body.target_audience),
      publishing_frequency: text(body.publishing_frequency),
      strategic_notes: text(body.strategic_notes),
      status,
      created_by: session.email || null
    });
    return NextResponse.json({ strategy });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
