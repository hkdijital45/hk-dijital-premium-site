import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { createTopicCluster, listTopicClusters, getSafeSupabaseError } from "@/lib/organic-growth/data";

function text(value: unknown, fallback = "") {
  return String(value ?? fallback).trim();
}

function slugify(value: string) {
  return value.toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

export async function GET() {
  const session = await requireModuleAccess("blog-seo");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  try {
    const clusters = await listTopicClusters();
    return NextResponse.json({ clusters });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireModuleAccess("blog-seo");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const name = text(body.name);
  if (name.length < 3) return NextResponse.json({ error: "Küme adı en az 3 karakter olmalı." }, { status: 400 });
  const slug = slugify(text(body.slug, name));
  if (!slug) return NextResponse.json({ error: "Geçerli bir slug üretilemedi." }, { status: 400 });
  try {
    const cluster = await createTopicCluster({
      name,
      slug,
      description: text(body.description),
      target_service: text(body.target_service) || null,
      search_intents: Array.isArray(body.search_intents) ? body.search_intents.map(String).filter(Boolean) : [],
      geography: text(body.geography) || null,
      pillar_article_id: text(body.pillar_article_id) || null
    });
    return NextResponse.json({ cluster });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
