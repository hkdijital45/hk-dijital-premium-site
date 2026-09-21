import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { deleteContentPlanItem, getContentPlanItem, getSafeSupabaseError, updateContentPlanItem } from "@/lib/organic-growth/data";
import { normalizeItemPayload } from "@/app/api/admin/organic-growth/content-plan/route";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const session = await requireModuleAccess("blog-seo");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  try {
    const item = await getContentPlanItem(id);
    if (!item) return NextResponse.json({ error: "Öğe bulunamadı." }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const session = await requireModuleAccess("blog-seo");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  try {
    const body = await request.json();
    const existing = await getContentPlanItem(id);
    if (!existing) return NextResponse.json({ error: "Öğe bulunamadı." }, { status: 404 });
    const merged = normalizeItemPayload({ ...existing, ...body });
    const patch: Record<string, unknown> = { ...merged };
    if (typeof body.claude_prompt_cache === "string") patch.claude_prompt_cache = body.claude_prompt_cache;
    const item = await updateContentPlanItem(id, patch);
    return NextResponse.json({ item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Beklenmeyen hata.";
    const isValidation = error instanceof Error && !message.toLocaleLowerCase("tr").includes("supabase");
    return NextResponse.json({ error: isValidation ? message : getSafeSupabaseError(error).detail }, { status: isValidation ? 400 : 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await requireModuleAccess("blog-seo");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  try {
    await deleteContentPlanItem(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
