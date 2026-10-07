import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";
import { parseBrandFields, type BrandShowcaseRow } from "@/lib/brand-showcase";

export async function GET() {
  const session = await requireModuleAccess("markalar");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  try {
    const brands = await supabaseRest<BrandShowcaseRow[]>("brand_showcases?select=*&order=sort_order.asc");
    return NextResponse.json({ brands: brands ?? [] });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).title }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireModuleAccess("markalar");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = parseBrandFields(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const logoUrl = String((body as Record<string, unknown> | null)?.logo_url ?? "").trim();
  if (!logoUrl) return NextResponse.json({ error: "Logo yüklemeden marka kaydedilemez." }, { status: 400 });

  try {
    const [last] = await supabaseRest<BrandShowcaseRow[]>("brand_showcases?select=sort_order&order=sort_order.desc&limit=1");
    const nextSortOrder = (last?.sort_order ?? -1) + 1;
    const [created] = await supabaseRest<BrandShowcaseRow[]>("brand_showcases", {
      method: "POST",
      body: JSON.stringify({
        name: parsed.value.name,
        services: parsed.value.services,
        description: parsed.value.description,
        logo_url: logoUrl,
        is_active: true,
        sort_order: nextSortOrder
      })
    });
    return NextResponse.json({ brand: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).title }, { status: 500 });
  }
}
