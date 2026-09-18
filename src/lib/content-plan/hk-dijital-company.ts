// Server-side resolution of HK Dijital's own public.companies row — never a
// hardcoded UUID. The previous approach (a literal id constant in
// content-plan/types.ts) broke every create_content_plan write the moment
// that companies row was deleted and recreated (outside this app) with a
// new id: the constant silently pointed at nothing, and the resulting
// foreign-key violation surfaced to MCP callers as an opaque
// SERVICE_UNAVAILABLE. This resolves the id fresh (with a short in-memory
// cache) by the one durable, human-meaningful attribute the companies
// schema actually has today — its name — so a future id change fixes
// itself without a code deploy.
import { supabaseRest } from "@/lib/supabase";

export const HK_DIJITAL_COMPANY_NAME = "HK DİJİTAL";

export class HkDijitalCompanyNotFoundError extends Error {}

type Cached = { id: string; expiresAt: number };
let cached: Cached | null = null;
// Long enough that a warm Lambda handling several MCP calls in a row (a
// 30-day plan write followed by a read-back, say) doesn't re-query on every
// single one; short enough that fixing a misconfigured/renamed row takes
// effect within minutes, not a redeploy.
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Resolves HK Dijital's own company_id. Throws HkDijitalCompanyNotFoundError
 * (never silently falls back to a stale/hardcoded id) if the row can't be
 * found unambiguously.
 */
export async function resolveHkDijitalCompanyId(): Promise<string> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.id;

  const rows = await supabaseRest<Array<{ id: string }>>(
    `companies?select=id&name=eq.${encodeURIComponent(HK_DIJITAL_COMPANY_NAME)}&deleted_at=is.null&limit=2`
  );

  if (rows.length === 0) {
    throw new HkDijitalCompanyNotFoundError(
      `HK Dijital'in kendi company_id kaydı bulunamadı: public.companies içinde name="${HK_DIJITAL_COMPANY_NAME}" ve deleted_at IS NULL eşleşen satır yok. Şirket kaydı silinmiş, arşivlenmiş veya adı değiştirilmiş olabilir.`
    );
  }
  if (rows.length > 1) {
    throw new HkDijitalCompanyNotFoundError(
      `HK Dijital'in company_id kaydı belirsiz: public.companies içinde name="${HK_DIJITAL_COMPANY_NAME}" ile eşleşen birden fazla satır var.`
    );
  }

  cached = { id: rows[0].id, expiresAt: now + CACHE_TTL_MS };
  return cached.id;
}
