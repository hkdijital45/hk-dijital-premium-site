import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { supabaseRest, getSafeSupabaseError } from "@/lib/supabase";
import { CONTENT_FORMAT_KEYS, PLATFORM_KEYS, type ContentPlanItem } from "@/lib/content-plan/types";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const patch: Record<string, unknown> = {};
  if (typeof body.scheduled_date === "string") patch.scheduled_date = body.scheduled_date;
  if (Array.isArray(body.platforms)) patch.platforms = body.platforms.filter((p: unknown) => typeof p === "string" && PLATFORM_KEYS.includes(p as never));
  if (typeof body.theme === "string") patch.theme = body.theme.trim();
  if (typeof body.content_title === "string") patch.content_title = body.content_title.trim();
  if (typeof body.content_format === "string" && CONTENT_FORMAT_KEYS.includes(body.content_format)) patch.content_format = body.content_format;
  if (typeof body.notes === "string") patch.notes = body.notes.trim();
  // is_published carries published_at along with it — toggling on stamps
  // "now" (unless the caller supplies a real historical published_at),
  // toggling off clears it, exactly per the mission's UX spec.
  if (typeof body.is_published === "boolean") {
    patch.is_published = body.is_published;
    patch.published_at = body.is_published ? (typeof body.published_at === "string" ? body.published_at : new Date().toISOString()) : null;
  }

  if (!Object.keys(patch).length) return NextResponse.json({ error: "Güncellenecek alan yok." }, { status: 400 });

  try {
    const rows = await supabaseRest<ContentPlanItem[]>(`content_plan_items?id=eq.${encodeURIComponent(id)}&select=*`, {
      method: "PATCH",
      body: JSON.stringify(patch)
    });
    if (!rows[0]) return NextResponse.json({ error: "Kayıt bulunamadı." }, { status: 404 });
    return NextResponse.json({ item: rows[0] });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  try {
    await supabaseRest(`content_plan_items?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
