import { NextResponse } from "next/server";
import { getSession, isStaffRole } from "@/lib/auth";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

const platforms = ["chatgpt", "perplexity", "gemini", "manual"];

async function requireStaff() {
  const session = await getSession();
  return session && isStaffRole(session.role) ? session : null;
}

// No official public API exposes "does this AI answer engine mention my
// brand" today, so this is manual-entry only (a real, honest input mode —
// staff logs what they actually observed) plus a `source` column reserved
// for a real provider adapter if/when one becomes available. Never
// fabricates a "position" or automated visibility score.
export async function GET(request: Request) {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ observations: [] });

  const query = new URL(request.url).searchParams.get("query");
  const filters = ["select=*", "order=observed_at.desc", "limit=200"];
  if (query) filters.push(`query=ilike.*${encodeURIComponent(query)}*`);

  try {
    const observations = await supabaseRest<Array<Record<string, unknown>>>(`geo_visibility_observations?${filters.join("&")}`);
    return NextResponse.json({ observations });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const query = String(body.query || "").trim();
  const platform = platforms.includes(String(body.platform)) ? String(body.platform) : "manual";
  if (!query) return NextResponse.json({ error: "query zorunludur." }, { status: 400 });

  try {
    const inserted = await supabaseRest<Array<Record<string, unknown>>>("geo_visibility_observations", {
      method: "POST",
      body: JSON.stringify({
        query,
        platform,
        brand_mentioned: Boolean(body.brandMentioned),
        competitor_mentions: Array.isArray(body.competitorMentions) ? body.competitorMentions : [],
        cited_url: body.citedUrl || null,
        confidence: Number(body.confidence) || 50,
        source: "manual",
        notes: body.notes || null,
        created_by: session.profileId || null
      })
    });
    return NextResponse.json({ observation: inserted[0] });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
