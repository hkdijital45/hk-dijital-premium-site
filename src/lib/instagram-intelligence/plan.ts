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

// The full set of production-detail fields a content item can carry —
// shared by both create (PlanItemInput) and update (UpdateContentPlanItemInput)
// so notes are built identically regardless of path, and by buildNotes()
// below, the single place that turns them into the persisted notes text.
export type ContentPlanItemDetails = {
  hook?: string;
  contentFlow?: string;
  caption?: string;
  summary?: string;
  cta?: string;
  hashtagApproach?: string;
  goal?: string;
  audience?: string;
  priority?: string;
  rationale?: string;
  conditions?: string;
  storySupport?: string;
  productionNotes?: string;
};

export type PlanItemInput = ContentPlanItemDetails & {
  scheduled_date: string;
  platforms?: string[];
  content_format?: string;
  theme?: string;
  topic: string;
};

export type UpdateContentPlanItemInput = ContentPlanItemDetails & { id: string };

export class PlanInputError extends Error {}
export class ContentPlanCompanyNotFoundError extends Error {}
export class ContentPlanItemNotFoundError extends Error {}

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

// Deterministic, lossless text rendering — every supplied field is kept
// verbatim (no rewriting/summarizing), so a [DOĞRULANACAK] marker or a
// conditional-publish note survives exactly as authored. Only the single
// existing `notes` text column is used — no new table/column.
function buildNotes(item: ContentPlanItemDetails): string {
  const lines = ["[Kaynak: Instagram Intelligence]"];
  if (item.hook) lines.push(`Hook: ${item.hook}`);
  if (item.contentFlow) lines.push(`İçerik Akışı: ${item.contentFlow}`);
  if (item.caption) lines.push(`Caption: ${item.caption}`);
  if (item.summary) lines.push(`Özet: ${item.summary}`);
  if (item.cta) lines.push(`CTA: ${item.cta}`);
  if (item.hashtagApproach) lines.push(`Hashtag Yaklaşımı: ${item.hashtagApproach}`);
  if (item.goal) lines.push(`Amaç: ${item.goal}`);
  if (item.audience) lines.push(`Hedef kitle: ${item.audience}`);
  if (item.priority) lines.push(`Öncelik: ${item.priority}`);
  if (item.rationale) lines.push(`Gerekçe: ${item.rationale}`);
  if (item.conditions) lines.push(`Koşullar / Doğrulanacak: ${item.conditions}`);
  if (item.storySupport) lines.push(`Story Desteği: ${item.storySupport}`);
  if (item.productionNotes) lines.push(`Üretim Notu: ${item.productionNotes}`);
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

export function validateUpdateItems(items: unknown): UpdateContentPlanItemInput[] {
  if (!Array.isArray(items) || !items.length) throw new PlanInputError("Güncelleme listesi boş olamaz.");
  if (items.length > 60) throw new PlanInputError("Tek seferde en fazla 60 kayıt güncellenebilir.");
  for (const item of items) {
    if (!item || typeof item !== "object") throw new PlanInputError("Her güncelleme bir nesne olmalıdır.");
    const record = item as Record<string, unknown>;
    if (typeof record.id !== "string" || !record.id.trim()) throw new PlanInputError("Her güncelleme için id zorunludur.");
  }
  return items as UpdateContentPlanItemInput[];
}

/** Completes missing production details (hook/caption/CTA/etc, rebuilt into
 * the exact same notes text create_content_plan writes — see buildNotes)
 * on EXISTING rows only. Never inserts, never duplicates — this is a pure
 * per-id UPDATE. Row ownership is enforced at the query level: the PATCH
 * filter requires BOTH id AND company_id to match, so an id belonging to
 * another company is simply never matched/updated (fails closed with
 * ContentPlanItemNotFoundError, indistinguishable from "no such id" —
 * never leaks whether the id exists elsewhere). Only `notes` is touched;
 * date/theme/topic/format/platforms/publish state are left exactly as
 * they are. */
export async function updateContentPlanItemDetails(items: UpdateContentPlanItemInput[], companyId: string): Promise<{ updated: number; items: ContentPlanItem[] }> {
  await assertCompanyExists(companyId);
  const updated: ContentPlanItem[] = [];
  for (const item of items) {
    const rows = await supabaseRest<ContentPlanItem[]>(
      `${CONTENT_PLAN_TABLE}?id=eq.${encodeURIComponent(item.id)}&company_id=eq.${encodeURIComponent(companyId)}&select=*`,
      { method: "PATCH", body: JSON.stringify({ notes: buildNotes(item) }) }
    );
    if (!rows.length) throw new ContentPlanItemNotFoundError(`Kayıt bulunamadı veya bu şirkete ait değil: ${item.id}`);
    updated.push(rows[0]);
  }
  return { updated: updated.length, items: updated };
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
