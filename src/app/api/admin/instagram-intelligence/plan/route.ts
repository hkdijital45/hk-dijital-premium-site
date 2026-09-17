import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { validatePlanItems, createContentPlanItems, getSafeSupabaseError, PlanInputError } from "@/lib/instagram-intelligence/plan";

// Writes an already-authored 30-day Instagram plan into İçerik Takip
// (social_content_plan_items) — the same table/UI the user edits by hand,
// per the mission's "İçerik Takip source-of-truth olsun" rule. This route
// never generates content itself (no runtime AI call, no paid API) — it
// only validates and persists a plan payload that was authored elsewhere
// (a Claude Code session, or the Instagram Intelligence MCP connector's
// create_content_plan tool, reasoning over the real analysis output).
// Duplicate-safe: re-posting the same plan never creates duplicate rows
// or touches existing manual entries (see src/lib/instagram-intelligence/
// plan.ts — the same insert logic both callers share).

export async function POST(request: Request) {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });

  const body = await request.json().catch(() => ({}));

  try {
    const items = validatePlanItems(body.items);
    const result = await createContentPlanItems(items);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PlanInputError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
