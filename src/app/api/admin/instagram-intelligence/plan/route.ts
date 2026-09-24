import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { validatePlanItems, createContentPlanItems, getSafeSupabaseError, PlanInputError } from "@/lib/instagram-intelligence/plan";
import { resolveHkDijitalCompanyId } from "@/lib/content-plan/hk-dijital-company";

// Writes an already-authored 30-day Instagram plan into İçerik Takip
// (social_content_plan_items) — the same table/UI the user edits by hand,
// per the mission's "İçerik Takip source-of-truth olsun" rule. This route
// never generates content itself (no runtime AI call, no paid API) — it
// only validates and persists a plan payload that was authored elsewhere
// (a Claude Code session, reasoning over the real analysis output).
// Duplicate-safe: re-posting the same plan never creates duplicate rows
// or touches existing manual entries (see src/lib/instagram-intelligence/
// plan.ts — the same insert logic both callers share).
//
// This route is HK Dijital's own Instagram Intelligence planner only
// (see .claude/skills/instagram-intelligence-planner/SKILL.md) — it
// explicitly resolves and passes HK Dijital's own real company_id itself
// rather than relying on any implicit default in the shared writer, which
// now REQUIRES an explicit, verified companyId for every write (see
// createContentPlanItems). The customer-facing create_content_plan MCP
// tool passes its own caller-supplied companyId instead — see
// src/lib/instagram-intelligence/mcp/protocol.ts.

export async function POST(request: Request) {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });

  const body = await request.json().catch(() => ({}));

  try {
    const items = validatePlanItems(body.items);
    const companyId = await resolveHkDijitalCompanyId();
    const result = await createContentPlanItems(items, companyId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PlanInputError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
