/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { requireAdmin, requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { systemGuideCategories, systemGuideSeeds } from "@/lib/system-guide-content";

async function ensureSeedData() {
  await supabaseRest("system_guide_categories?on_conflict=name", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify(systemGuideCategories.map((name, index) => ({ name, description: `${name} kullanım ve sorun giderme içerikleri.`, sort_order: index })))
  });
  await supabaseRest("system_guides?on_conflict=slug", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify(systemGuideSeeds.map((guide) => ({ slug: guide.slug, title: guide.title, category: guide.category, description: guide.description, route: guide.route, content: guide.content, video_url: guide.videoUrl || null, is_published: true })))
  });
}

export async function GET() {
  const session = await requireModuleAccess("sistem-rehberi");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ status: "demo", categories: systemGuideCategories.map((name, index) => ({ id: `category-${index}`, name })), guides: systemGuideSeeds, analytics: { popular: [], recent: [], searches: [] } });
  try {
    await ensureSeedData();
    const [categories, guides, events] = await Promise.all([
      supabaseRest<any[]>("system_guide_categories?select=*&order=sort_order.asc"),
      supabaseRest<any[]>("system_guides?select=*&order=category.asc,title.asc"),
      supabaseRest<any[]>("system_guide_events?select=*&order=created_at.desc&limit=500")
    ]);
    const searches = Object.entries(events.filter((item) => item.event_type === "search" && item.search_query).reduce((acc: Record<string, number>, item) => { acc[item.search_query] = (acc[item.search_query] || 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 10);
    return NextResponse.json({ status: "live", categories, guides, analytics: { popular: [...guides].sort((a, b) => Number(b.view_count || 0) - Number(a.view_count || 0)).slice(0, 6), recent: events.filter((item) => item.event_type === "view").slice(0, 8), searches } });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ status: "fallback", warning: safe.title, categories: systemGuideCategories.map((name, index) => ({ id: `category-${index}`, name })), guides: systemGuideSeeds, analytics: { popular: [], recent: [], searches: [] } });
  }
}

export async function POST(request: Request) {
  const session = await requireModuleAccess("sistem-rehberi");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "");
  try {
    if (["createGuide", "updateGuide", "deleteGuide", "createCategory", "updateCategory", "deleteCategory"].includes(action) && !(await requireAdmin())) {
      return NextResponse.json({ error: "Bu işlem yalnız admin rolüne açıktır." }, { status: 403 });
    }
    if (action === "view") {
      const rows = await supabaseRest<any[]>(`system_guides?slug=eq.${encodeURIComponent(body.slug)}&select=id,view_count&limit=1`);
      if (rows[0]) await Promise.all([
        supabaseRest(`system_guides?id=eq.${rows[0].id}`, { method: "PATCH", body: JSON.stringify({ view_count: Number(rows[0].view_count || 0) + 1, updated_at: new Date().toISOString() }) }),
        supabaseRest("system_guide_events", { method: "POST", body: JSON.stringify({ guide_id: rows[0].id, guide_slug: body.slug, event_type: "view", user_id: session.profileId || null }) })
      ]);
      return NextResponse.json({ ok: true });
    }
    if (action === "search") {
      if (String(body.query || "").trim()) await supabaseRest("system_guide_events", { method: "POST", body: JSON.stringify({ event_type: "search", search_query: String(body.query).trim().slice(0, 160), user_id: session.profileId || null }) });
      return NextResponse.json({ ok: true });
    }
    if (action === "feedback") {
      const rows = await supabaseRest<any[]>(`system_guides?slug=eq.${encodeURIComponent(body.slug)}&select=id&limit=1`);
      if (rows[0]) await supabaseRest("system_guide_feedback", { method: "POST", body: JSON.stringify({ guide_id: rows[0].id, user_id: session.profileId || null, is_helpful: Boolean(body.isHelpful), note: String(body.note || "").slice(0, 500) || null }) });
      return NextResponse.json({ ok: true });
    }
    if (action === "createCategory") {
      const rows = await supabaseRest<any[]>("system_guide_categories", { method: "POST", body: JSON.stringify({ name: String(body.name || "").trim(), description: String(body.description || "").trim(), sort_order: Number(body.sortOrder || 0) }) });
      return NextResponse.json({ ok: true, category: rows[0] });
    }
    if (action === "updateCategory") {
      const categories = await supabaseRest<any[]>(`system_guide_categories?id=eq.${encodeURIComponent(body.id)}&select=*&limit=1`);
      const oldName = categories[0]?.name;
      const name = String(body.name || "").trim();
      if (!oldName || !name) return NextResponse.json({ error: "Kategori bulunamadı veya ad boş." }, { status: 400 });
      const rows = await supabaseRest<any[]>(`system_guide_categories?id=eq.${encodeURIComponent(body.id)}`, { method: "PATCH", body: JSON.stringify({ name, updated_at: new Date().toISOString() }) });
      await supabaseRest(`system_guides?category=eq.${encodeURIComponent(oldName)}`, { method: "PATCH", body: JSON.stringify({ category: name, updated_at: new Date().toISOString() }) });
      return NextResponse.json({ ok: true, category: rows[0] });
    }
    if (action === "deleteCategory") {
      await supabaseRest(`system_guide_categories?id=eq.${encodeURIComponent(body.id)}`, { method: "DELETE" });
      return NextResponse.json({ ok: true });
    }
    if (action === "deleteGuide") {
      await supabaseRest(`system_guides?id=eq.${encodeURIComponent(body.id)}`, { method: "DELETE" });
      return NextResponse.json({ ok: true });
    }
    if (["createGuide", "updateGuide"].includes(action)) {
      const payload = { slug: String(body.guide?.slug || "").trim(), title: String(body.guide?.title || "").trim(), category: String(body.guide?.category || "").trim(), description: String(body.guide?.description || "").trim(), route: body.guide?.route || null, content: body.guide?.content || {}, video_url: body.guide?.video_url || null, is_published: body.guide?.is_published !== false, updated_at: new Date().toISOString(), created_by: session.profileId || null };
      if (!payload.slug || !payload.title || !payload.category) return NextResponse.json({ error: "Başlık, kategori ve slug zorunludur." }, { status: 400 });
      const rows = action === "updateGuide"
        ? await supabaseRest<any[]>(`system_guides?id=eq.${encodeURIComponent(body.guide.id)}`, { method: "PATCH", body: JSON.stringify(payload) })
        : await supabaseRest<any[]>("system_guides", { method: "POST", body: JSON.stringify(payload) });
      return NextResponse.json({ ok: true, guide: rows[0] });
    }
    return NextResponse.json({ error: "Geçersiz işlem." }, { status: 400 });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title, detail: safe.detail }, { status: 500 });
  }
}
