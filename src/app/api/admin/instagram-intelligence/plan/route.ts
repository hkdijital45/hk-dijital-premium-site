import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { supabaseRest, getSafeSupabaseError } from "@/lib/supabase";
import {
  CONTENT_PLAN_WORKSPACE_ID, CONTENT_PLAN_TABLE, CONTENT_FORMAT_KEYS, PLATFORM_KEYS,
  type ContentPlanItem
} from "@/lib/content-plan/types";

// Writes an already-authored 30-day Instagram plan into İçerik Takip
// (social_content_plan_items) — the same table/UI the user edits by hand,
// per the mission's "İçerik Takip source-of-truth olsun" rule. This route
// never generates content itself (no runtime AI call, no paid API) — it
// only validates and persists a plan payload that was authored elsewhere
// (a Claude Code session reasoning over /api/admin/instagram-intelligence/
// analysis's real output). Duplicate-safe: re-posting the same plan never
// creates duplicate rows or touches existing manual entries.

type PlanItemInput = {
  scheduled_date: string;
  platforms?: string[];
  content_format?: string;
  theme?: string;
  topic: string;
  hook?: string;
  summary?: string;
  cta?: string;
  goal?: string;
  audience?: string;
  priority?: string;
  rationale?: string;
};

function buildNotes(item: PlanItemInput): string {
  const lines = ["[Kaynak: Instagram Intelligence]"];
  if (item.hook) lines.push(`Hook: ${item.hook}`);
  if (item.summary) lines.push(`Özet: ${item.summary}`);
  if (item.cta) lines.push(`CTA: ${item.cta}`);
  if (item.goal) lines.push(`Amaç: ${item.goal}`);
  if (item.audience) lines.push(`Hedef kitle: ${item.audience}`);
  if (item.priority) lines.push(`Öncelik: ${item.priority}`);
  if (item.rationale) lines.push(`Gerekçe: ${item.rationale}`);
  return lines.join("\n");
}

function normalizeKey(date: string, title: string) {
  return `${date}::${title.trim().toLocaleLowerCase("tr-TR")}`;
}

export async function POST(request: Request) {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const items: PlanItemInput[] = Array.isArray(body.items) ? body.items : [];
  if (!items.length) return NextResponse.json({ error: "Plan boş olamaz." }, { status: 400 });
  if (items.length > 60) return NextResponse.json({ error: "Tek seferde en fazla 60 içerik gönderilebilir." }, { status: 400 });

  for (const item of items) {
    if (typeof item.scheduled_date !== "string" || !item.scheduled_date) {
      return NextResponse.json({ error: "Her içerik için tarih zorunludur." }, { status: 400 });
    }
    if (typeof item.topic !== "string" || !item.topic.trim()) {
      return NextResponse.json({ error: "Her içerik için konu (topic) zorunludur." }, { status: 400 });
    }
  }

  try {
    const existing = await supabaseRest<Array<Pick<ContentPlanItem, "scheduled_date" | "content_title">>>(
      `${CONTENT_PLAN_TABLE}?workspace_id=eq.${CONTENT_PLAN_WORKSPACE_ID}&select=scheduled_date,content_title&limit=1000`
    );
    const existingKeys = new Set(existing.map((row) => normalizeKey(row.scheduled_date, row.content_title)));

    const toInsert: Record<string, unknown>[] = [];
    let skipped = 0;
    for (const item of items) {
      const key = normalizeKey(item.scheduled_date, item.topic);
      if (existingKeys.has(key)) { skipped++; continue; }
      existingKeys.add(key); // guard against duplicates within the same payload too

      const platforms = Array.isArray(item.platforms) ? item.platforms.filter((p) => PLATFORM_KEYS.includes(p as never)) : ["instagram"];
      const contentFormat = typeof item.content_format === "string" && CONTENT_FORMAT_KEYS.includes(item.content_format as never) ? item.content_format : "static";

      toInsert.push({
        workspace_id: CONTENT_PLAN_WORKSPACE_ID,
        scheduled_date: item.scheduled_date,
        platforms: platforms.length ? platforms : ["instagram"],
        theme: typeof item.theme === "string" ? item.theme.trim() : "",
        content_title: item.topic.trim(),
        content_format: contentFormat,
        notes: buildNotes(item),
        is_published: false,
        published_at: null
      });
    }

    if (!toInsert.length) {
      return NextResponse.json({ inserted: 0, skipped, items: [] });
    }

    const rows = await supabaseRest<ContentPlanItem[]>(CONTENT_PLAN_TABLE, {
      method: "POST",
      body: JSON.stringify(toInsert)
    });

    return NextResponse.json({ inserted: rows.length, skipped, items: rows });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
