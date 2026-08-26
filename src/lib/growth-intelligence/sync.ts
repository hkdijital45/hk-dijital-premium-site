import { fetchSearchConsolePerformance } from "@/lib/google-search-console-server";
import { supabaseRest } from "@/lib/supabase";
import { classifyOpportunity, computeOpportunityScore } from "./scoring";
import { DEFAULT_WORKSPACE_ID } from "./types";

type SearchConsoleRow = { query: string; page: string; clicks: number; impressions: number; ctr: number; position: number };

export async function syncSearchConsoleOpportunities(workspaceId = DEFAULT_WORKSPACE_ID) {
  const result = await fetchSearchConsolePerformance({ dimensions: ["query", "page"] });
  if (!result.ok) {
    return { ok: false as const, message: result.message, upserted: 0, totalRows: 0 };
  }

  const rows = (result.rows as SearchConsoleRow[]).filter((row) => row.query);
  let upserted = 0;

  for (const row of rows) {
    const { score, breakdown } = computeOpportunityScore({
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      avg_position: row.position
    });
    const { type, action } = classifyOpportunity({ query: row.query, page: row.page, avg_position: row.position });

    const payload = {
      workspace_id: workspaceId,
      query: row.query,
      page: row.page,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      avg_position: row.position,
      opportunity_type: type,
      opportunity_score: score,
      score_breakdown: breakdown,
      recommended_action: action,
      source: "search_console",
      synced_at: new Date().toISOString()
    };

    await supabaseRest(`growth_opportunities?on_conflict=workspace_id,query,page`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(payload)
    });
    upserted += 1;
  }

  return { ok: true as const, upserted, totalRows: rows.length };
}
