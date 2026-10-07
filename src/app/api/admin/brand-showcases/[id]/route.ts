import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";
import { parseBrandFields, swapPlan, type BrandShowcaseRow } from "@/lib/brand-showcase";
import { removeBrandLogo } from "@/lib/brand-showcase-storage";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("markalar");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: "Geçersiz marka kaydı." }, { status: 400 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });

  try {
    // Reordering is a two-row sort_order swap with a neighbor, not a full renumber.
    if (body.move === "up" || body.move === "down") {
      const rows = await supabaseRest<BrandShowcaseRow[]>("brand_showcases?select=id,sort_order&order=sort_order.asc");
      const plan = swapPlan(rows, id, body.move);
      if (!plan.ok) return NextResponse.json({ error: plan.error }, { status: 409 });
      await supabaseRest(`brand_showcases?id=eq.${encodeURIComponent(plan.a.id)}`, { method: "PATCH", body: JSON.stringify({ sort_order: plan.a.sort_order }) });
      await supabaseRest(`brand_showcases?id=eq.${encodeURIComponent(plan.b.id)}`, { method: "PATCH", body: JSON.stringify({ sort_order: plan.b.sort_order }) });
      const brands = await supabaseRest<BrandShowcaseRow[]>("brand_showcases?select=*&order=sort_order.asc");
      return NextResponse.json({ brands });
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof body.is_active === "boolean") patch.is_active = body.is_active;
    if (typeof body.logo_url === "string" && body.logo_url.trim()) patch.logo_url = body.logo_url.trim();
    if (body.name !== undefined || body.services !== undefined || body.description !== undefined) {
      const parsed = parseBrandFields({ name: body.name, services: body.services, description: body.description });
      if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
      patch.name = parsed.value.name;
      patch.services = parsed.value.services;
      patch.description = parsed.value.description;
    }

    const [updated] = await supabaseRest<BrandShowcaseRow[]>(`brand_showcases?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) });
    if (!updated) return NextResponse.json({ error: "Marka bulunamadı." }, { status: 404 });
    return NextResponse.json({ brand: updated });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).title }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("markalar");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: "Geçersiz marka kaydı." }, { status: 400 });

  try {
    const [deleted] = await supabaseRest<BrandShowcaseRow[]>(`brand_showcases?id=eq.${encodeURIComponent(id)}&select=id,logo_url`, { method: "DELETE" });
    if (!deleted) return NextResponse.json({ error: "Marka bulunamadı." }, { status: 404 });
    if (deleted.logo_url) {
      await removeBrandLogo(deleted.logo_url).catch((error) => {
        console.error("Marka logosu silinemedi:", getSafeSupabaseError(error).detail);
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).title }, { status: 500 });
  }
}
