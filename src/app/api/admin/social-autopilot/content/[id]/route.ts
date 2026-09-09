import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { cancelQueueItem } from "@/lib/social-autopilot/publish-queue";
import type { SocialContentItem, SocialQualityCheckResult } from "@/lib/social-autopilot/types";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });
  const { id } = await params;
  try {
    const [items, checks, versions] = await Promise.all([
      supabaseRest<SocialContentItem[]>(`social_content_items?id=eq.${encodeURIComponent(id)}&select=*&limit=1`),
      supabaseRest<SocialQualityCheckResult[]>(`social_quality_checks?content_item_id=eq.${encodeURIComponent(id)}&select=*&order=created_at.desc&limit=5`),
      supabaseRest<Array<Record<string, unknown>>>(`social_content_versions?content_item_id=eq.${encodeURIComponent(id)}&select=*&order=version.desc&limit=10`)
    ]);
    if (!items[0]) return NextResponse.json({ error: "İçerik bulunamadı." }, { status: 404 });
    return NextResponse.json({ item: items[0], qualityChecks: checks, versions });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).title }, { status: 500 });
  }
}

// Fields an editor may manually change from the Content Studio. Scoring/
// publication-lifecycle fields are intentionally excluded — those are only
// ever set by the quality gate / publish pipeline, never a raw PATCH body.
const EDITABLE_FIELDS = [
  "title", "hook", "secondary_hook", "caption", "cta", "cta_goal", "hashtags", "seo_keywords",
  "creative_brief", "media_asset_urls", "topic"
] as const;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  try {
    const existingRows = await supabaseRest<SocialContentItem[]>(`social_content_items?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
    const existing = existingRows[0];
    if (!existing) return NextResponse.json({ error: "İçerik bulunamadı." }, { status: 404 });

    const patch: Record<string, unknown> = {};
    const touchedFields: string[] = [];
    for (const field of EDITABLE_FIELDS) {
      if (field in body) { patch[field] = body[field]; touchedFields.push(field); }
    }

    if (Object.keys(patch).length) {
      // Snapshot the pre-edit state (spec section 44 — manual edits must
      // never be silently lost, and a future AI refresh must never clobber
      // them without a trace).
      await supabaseRest("social_content_versions", {
        method: "POST",
        body: JSON.stringify({ content_item_id: id, version: existing.version, snapshot: existing, edited_by: session.profileId || null, edit_note: body.editNote || null })
      });
      patch.edited_manually = true;
      patch.manual_edit_locked_fields = [...new Set([...(existing.manual_edit_locked_fields || []), ...touchedFields])];
      patch.version = existing.version + 1;
    }

    // A media upload completing (media_asset_urls going from empty to
    // populated) on an already quality-passed item moves it into READY so
    // it's schedulable — media is the last gate before that (see storage.ts).
    if (patch.media_asset_urls && Array.isArray(patch.media_asset_urls) && (patch.media_asset_urls as unknown[]).length && existing.publication_status === "generated") {
      patch.publication_status = "ready";
    }

    const rows = await supabaseRest<SocialContentItem[]>(`social_content_items?id=eq.${encodeURIComponent(id)}&select=*`, { method: "PATCH", body: JSON.stringify(patch) });
    return NextResponse.json({ item: rows[0] });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).title }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });
  const { id } = await params;
  try {
    const rows = await supabaseRest<SocialContentItem[]>(`social_content_items?id=eq.${encodeURIComponent(id)}&select=publication_status&limit=1`);
    if (rows[0]?.publication_status === "published") {
      return NextResponse.json({ error: "Yayınlanmış içerik silinemez — iptal edilemez, sadece arşivlenebilir." }, { status: 409 });
    }
    await cancelQueueItem(id).catch(() => {});
    await supabaseRest(`social_content_items?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ publication_status: "cancelled" }) });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).title }, { status: 500 });
  }
}
