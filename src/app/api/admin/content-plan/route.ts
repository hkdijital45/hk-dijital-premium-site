import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { supabaseRest, getSafeSupabaseError } from "@/lib/supabase";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import { CONTENT_PLAN_TABLE, CONTENT_FORMAT_KEYS, PLATFORM_KEYS, type ContentPlanItem } from "@/lib/content-plan/types";

// İçerik Takip / Sosyal Medya Operasyon Merkezi — a lightweight, multi-
// client content tracker backed by its own table (social_content_plan_items),
// deliberately separate from social_content_items (the AI-generation/
// orchestration pipeline). Rows created here are never picked up by
// generateContentForDate, the publish queue, or the daily cron.
//
// Every row is scoped to a real public.companies row via company_id
// (including HK Dijital's own existing company record, resolved
// server-side — see resolveHkDijitalCompanyId in
// content-plan/hk-dijital-company.ts). Cross-customer isolation is
// enforced here, at the query level, not just client-side.

async function tablePresent() {
  try {
    const rows = await supabaseRest<unknown[]>(`${CONTENT_PLAN_TABLE}?select=id&limit=1`);
    return Array.isArray(rows);
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });

  const companyId = new URL(request.url).searchParams.get("companyId") || "";
  if (!companyId || !uuidPattern.test(companyId)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });

  if (!(await tablePresent())) {
    return NextResponse.json({
      tablesReady: false,
      items: [],
      message: "İçerik Planlama veritabanı tablosu henüz oluşturulmadı. supabase/migrations/20260917_content_plan_items.sql migration'ının uygulanması gerekiyor."
    });
  }
  try {
    const items = await supabaseRest<ContentPlanItem[]>(
      `${CONTENT_PLAN_TABLE}?company_id=eq.${encodeURIComponent(companyId)}&select=*&order=scheduled_date.desc,created_at.desc&limit=500`
    );
    return NextResponse.json({ tablesReady: true, items });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const body = await request.json().catch(() => ({}));

  if (typeof body.company_id !== "string" || !uuidPattern.test(body.company_id)) {
    return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });
  }
  if (typeof body.scheduled_date !== "string" || !body.scheduled_date) {
    return NextResponse.json({ error: "Tarih zorunludur." }, { status: 400 });
  }
  const platforms = Array.isArray(body.platforms) ? body.platforms.filter((p: unknown) => typeof p === "string" && PLATFORM_KEYS.includes(p as never)) : [];
  const contentFormat = typeof body.content_format === "string" && CONTENT_FORMAT_KEYS.includes(body.content_format) ? body.content_format : "static";
  const isPublished = Boolean(body.is_published);

  try {
    const rows = await supabaseRest<ContentPlanItem[]>(CONTENT_PLAN_TABLE, {
      method: "POST",
      body: JSON.stringify({
        company_id: body.company_id,
        scheduled_date: body.scheduled_date,
        platforms,
        theme: typeof body.theme === "string" ? body.theme.trim() : "",
        content_title: typeof body.content_title === "string" ? body.content_title.trim() : "",
        content_format: contentFormat,
        notes: typeof body.notes === "string" ? body.notes.trim() : "",
        is_published: isPublished,
        published_at: isPublished ? new Date().toISOString() : null
      })
    });
    return NextResponse.json({ item: rows[0] });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
