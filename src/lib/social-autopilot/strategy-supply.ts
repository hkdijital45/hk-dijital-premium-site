// "How much runway does the currently-imported/generated content queue have
// left" — surfaced on Dashboard/Ayarlar and folded into the FULL AUTO
// readiness engine as the strategy_supply check. Purely a count of real
// upcoming social_content_items rows plus the active strategy's period end;
// no AI involved — this is exactly the kind of thing that should be
// computed, not asked of an LLM.
import { supabaseRest } from "@/lib/supabase";
import { SOCIAL_WORKSPACE_ID } from "./types";
import type { StrategySupplyStatus } from "./types";

// Below this many remaining scheduled/draft items OR days of runway, the UI
// starts nudging "time to run Claude Code again" rather than waiting until
// the queue is completely empty.
const LOW_SUPPLY_ITEM_THRESHOLD = 5;
const LOW_SUPPLY_DAY_THRESHOLD = 5;

const OPEN_STATUSES = ["draft", "generated", "quality_check", "ready", "scheduled"];

export async function computeStrategySupplyStatus(): Promise<StrategySupplyStatus> {
  const today = new Date().toISOString().slice(0, 10);
  const statusFilter = OPEN_STATUSES.map((status) => `publication_status.eq.${status}`).join(",");
  const remainingRows = await supabaseRest<Array<{ id: string; content_date: string }>>(
    `social_content_items?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&content_date=gte.${today}&or=(${statusFilter})&select=id,content_date&order=content_date.asc`
  );
  const remainingContentItems = remainingRows.length;
  const lastDate = remainingContentItems ? remainingRows[remainingContentItems - 1].content_date : null;
  const coverageDays = lastDate
    ? Math.max(0, Math.round((new Date(`${lastDate}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / (24 * 60 * 60_000)))
    : 0;

  const activeStrategyRows = await supabaseRest<Array<{ period_end: string }>>(`social_strategies?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&status=eq.active&select=period_end&limit=1`);
  const activeStrategyPeriodEnd = activeStrategyRows[0]?.period_end || null;

  const lastImportRows = await supabaseRest<Array<{ imported_at: string }>>(`social_strategy_packages?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&select=imported_at&order=imported_at.desc&limit=1`);
  const lastImportedAt = lastImportRows[0]?.imported_at || null;

  const warning = remainingContentItems <= LOW_SUPPLY_ITEM_THRESHOLD || coverageDays <= LOW_SUPPLY_DAY_THRESHOLD;
  const message = remainingContentItems === 0
    ? "İçerik kuyruğu boş — Claude Code ile yeni bir 30 günlük strateji/içerik paketi oluşturup içe aktarın."
    : warning
    ? "Claude Code ile yeni 30 günlük strateji oluşturma zamanı yaklaşıyor."
    : "İçerik tedariki yeterli.";

  return { remainingContentItems, coverageDays, activeStrategyPeriodEnd, lastImportedAt, warning, message };
}
