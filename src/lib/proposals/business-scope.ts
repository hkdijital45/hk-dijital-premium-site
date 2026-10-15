// Teklif kapsamı — which businesses (main business, related brands,
// branches) a proposal covers, and optional per-business service lines.
// Pure helpers shared by ProposalModal, financials.ts, document.ts and
// tests. Stored inside proposals.questionnaire (jsonb), so no schema
// change: old proposals simply have no businessScope and behave exactly as
// before.

export type ProposalBusinessScopeItem = {
  /** "lead:<uuid>" | "company:<uuid>" | "unit:<uuid>" */
  key: string;
  name: string;
  /** "main" for the proposal's own lead/customer, otherwise the relationship type. */
  role: "main" | "branch" | "related_brand" | "business_group";
  instagram?: string | null;
};

export type ProposalBusinessServiceLine = {
  businessKey: string;
  description: string;
  monthlyFee: number;
  setupFee: number;
};

export type NormalizedServiceLine = ProposalBusinessServiceLine & { businessName: string };

const SCOPE_KEY_PATTERN = /^(lead|company|unit):[0-9a-f-]{36}$/i;

export function isValidScopeKey(key: unknown): key is string {
  return typeof key === "string" && SCOPE_KEY_PATTERN.test(key);
}

/** Drops malformed/duplicate scope entries; keeps the user's order. */
export function normalizeBusinessScope(scope: unknown): ProposalBusinessScopeItem[] {
  if (!Array.isArray(scope)) return [];
  const seen = new Set<string>();
  const out: ProposalBusinessScopeItem[] = [];
  for (const raw of scope) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    if (!isValidScopeKey(item.key) || seen.has(item.key)) continue;
    const role = item.role === "branch" || item.role === "related_brand" || item.role === "business_group" ? item.role : "main";
    seen.add(item.key);
    out.push({ key: item.key, name: String(item.name || "").trim().slice(0, 200) || "İsimsiz işletme", role, instagram: typeof item.instagram === "string" ? item.instagram : null });
  }
  return out;
}

function money(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
}

function lineIdentity(line: { businessKey: string; description: string }) {
  // Turkish lower-casing turns "I" into "ı" but "i" stays "i" — fold both so
  // "Instagram" and "instagram" are recognised as the same service.
  return `${line.businessKey}|${line.description.trim().toLocaleLowerCase("tr").replace(/ı/g, "i").replace(/\s+/g, " ")}`;
}

/**
 * Per-business service lines that actually count toward the price:
 *  - only for businesses currently in scope (unchecking a business removes its lines from the total),
 *  - only with a description and a positive fee,
 *  - the same service for the same business is billed once (exact duplicates are ignored and reported).
 * Never multiplies anything by the number of businesses.
 */
export function normalizeServiceLines(lines: unknown, scope: ProposalBusinessScopeItem[]): { lines: NormalizedServiceLine[]; duplicatesIgnored: number } {
  if (!Array.isArray(lines)) return { lines: [], duplicatesIgnored: 0 };
  const names = new Map(scope.map((item) => [item.key, item.name]));
  const seen = new Set<string>();
  const out: NormalizedServiceLine[] = [];
  let duplicatesIgnored = 0;
  for (const raw of lines) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const businessKey = String(item.businessKey || "");
    const description = String(item.description || "").trim().slice(0, 300);
    const monthlyFee = money(item.monthlyFee);
    const setupFee = money(item.setupFee);
    if (!names.has(businessKey) || !description || (monthlyFee === 0 && setupFee === 0)) continue;
    const identity = lineIdentity({ businessKey, description });
    if (seen.has(identity)) { duplicatesIgnored += 1; continue; }
    seen.add(identity);
    out.push({ businessKey, businessName: names.get(businessKey) || "", description, monthlyFee, setupFee });
  }
  return { lines: out, duplicatesIgnored };
}

export function scopeSummaryText(scope: ProposalBusinessScopeItem[]): string {
  const roleLabel: Record<ProposalBusinessScopeItem["role"], string> = { main: "Ana işletme", branch: "Şube", related_brand: "Bağlı marka", business_group: "İşletme grubu" };
  return scope.map((item) => `${item.name} (${roleLabel[item.role]})`).join(", ");
}
