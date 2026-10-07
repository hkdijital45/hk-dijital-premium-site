import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { parseArticleImport } from "@/lib/organic-growth/claude-prompts";
import { getSafeSupabaseError, insertArticleAsDraft } from "@/lib/organic-growth/article-import";

// Imports a Claude-written article (pasted structured JSON) into blog_posts
// as a DRAFT, linked back to its content_plan_item. Never publishes
// directly — publishing/scheduling remains a separate, explicit human step
// via the existing blog-posts PATCH route. Insert/scoring logic lives in
// article-import.ts, shared with the automated autopilot so a human-pasted
// article and an autopilot-generated one go through identical validation.
export async function POST(request: Request) {
  const session = await requireModuleAccess("blog-seo");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const raw = typeof body.raw === "string" ? body.raw : "";
  const contentPlanItemId = typeof body.content_plan_item_id === "string" ? body.content_plan_item_id.trim() : "";
  if (!raw) return NextResponse.json({ error: "Claude çıktısı (raw JSON) gerekli." }, { status: 400 });

  const parsed = parseArticleImport(raw);
  if (!parsed.valid) return NextResponse.json({ error: parsed.errors.join(" ") }, { status: 400 });

  try {
    const { post } = await insertArticleAsDraft(parsed.article, contentPlanItemId);
    return NextResponse.json({ post, flaggedClaims: parsed.article.flagged_claims || [] });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
