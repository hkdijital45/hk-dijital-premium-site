// Shared "write an authored plan into İçerik Takip" logic — the single
// implementation used by BOTH POST /api/admin/instagram-intelligence/plan
// (browser/admin UI callers) and the create_content_plan MCP tool (Claude
// Custom Connector callers). One dedup rule, one validation rule, one
// insert path — never two copies that could drift.
import { supabaseRest, getSafeSupabaseError } from "@/lib/supabase";
import {
  CONTENT_PLAN_WORKSPACE_ID, CONTENT_PLAN_TABLE, CONTENT_FORMAT_KEYS, PLATFORM_KEYS,
  type ContentPlanItem
} from "@/lib/content-plan/types";

export type PlanItemInput = {
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

export class PlanInputError extends Error {}
export class ContentPlanCompanyNotFoundError extends Error {}

/** Verifies companyId is a real public.companies row before any content-
 * tracking read or write is allowed to proceed — the single company-
 * validation gate shared by fetchContentPlanRows and
 * createContentPlanItems, so a missing/invalid/unresolved companyId can
 * never fall through to an implicit default (HK Dijital or otherwise).
 * Fails closed: throws rather than returning a boolean, so callers can't
 * accidentally ignore the result. */
export async function assertCompanyExists(companyId: unknown): Promise<string> {
  if (typeof companyId !== "string" || !companyId.trim()) throw new ContentPlanCompanyNotFoundError("companyId zorunludur.");
  const rows = await supabaseRest<Array<{ id: string }>>(`companies?id=eq.${encodeURIComponent(companyId)}&select=id&limit=1`);
  if (!rows.length) throw new ContentPlanCompanyNotFoundError(`company_id doğrulanamadı: ${companyId}`);
  return companyId;
}

/** Company-scoped content-tracking reads (history/upcoming) — the same
 * table/scoping rule create_content_plan writes with, so a company can
 * only ever read its own rows, never another company's (including HK
 * Dijital's). Shared by the get_content_tracking_history/
 * get_upcoming_content_plan MCP tools. */
export async function fetchContentPlanRows(filter: "history" | "upcoming", companyId: string, limit = 20): Promise<ContentPlanItem[]> {
  await assertCompanyExists(companyId);
  const today = new Date().toISOString().slice(0, 10);
  const scope = filter === "upcoming"
    ? `&is_published=eq.false&scheduled_date=gte.${today}`
    : `&is_published=eq.true`;
  return supabaseRest<ContentPlanItem[]>(
    `${CONTENT_PLAN_TABLE}?company_id=eq.${encodeURIComponent(companyId)}&select=*${scope}&order=scheduled_date.${filter === "upcoming" ? "asc" : "desc"}&limit=${limit}`
  );
}

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

export function validatePlanItems(items: unknown): PlanItemInput[] {
  if (!Array.isArray(items) || !items.length) throw new PlanInputError("Plan boş olamaz.");
  if (items.length > 60) throw new PlanInputError("Tek seferde en fazla 60 içerik gönderilebilir.");
  for (const item of items) {
    if (!item || typeof item !== "object") throw new PlanInputError("Her içerik bir nesne olmalıdır.");
    const record = item as Record<string, unknown>;
    if (typeof record.scheduled_date !== "string" || !record.scheduled_date) throw new PlanInputError("Her içerik için tarih (scheduled_date) zorunludur.");
    if (typeof record.topic !== "string" || !record.topic.trim()) throw new PlanInputError("Her içerik için konu (topic) zorunludur.");
  }
  return items as PlanItemInput[];
}

/** Inserts only the items that don't already exist (same scheduled_date +
 * topic, case/whitespace-insensitive) — never overwrites or duplicates an
 * existing İçerik Takip row, manual or otherwise. companyId is REQUIRED
 * and verified against a real public.companies row before any write —
 * there is no implicit default (HK Dijital or otherwise): a missing,
 * invalid, or unresolved companyId means no row is ever written. Callers
 * that genuinely only ever act for HK Dijital's own account (e.g. the
 * Instagram Intelligence admin route) must resolve and pass that real
 * companyId themselves — see resolveHkDijitalCompanyId in
 * content-plan/hk-dijital-company.ts. */
export async function createContentPlanItems(items: PlanItemInput[], companyId: string): Promise<{ inserted: number; skipped: number; items: ContentPlanItem[] }> {
  await assertCompanyExists(companyId);
  const existing = await supabaseRest<Array<Pick<ContentPlanItem, "scheduled_date" | "content_title">>>(
    `${CONTENT_PLAN_TABLE}?company_id=eq.${encodeURIComponent(companyId)}&select=scheduled_date,content_title&limit=1000`
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
      company_id: companyId,
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

  if (!toInsert.length) return { inserted: 0, skipped, items: [] };

  const rows = await supabaseRest<ContentPlanItem[]>(CONTENT_PLAN_TABLE, {
    method: "POST",
    body: JSON.stringify(toInsert)
  });

  return { inserted: rows.length, skipped, items: rows };
}

export { getSafeSupabaseError };
