// Pure logic for the "Müşteri Keşfi" AI report pipeline (SWOT, dijital
// analiz, sunum, rakip analizi, keşif raporu): provider-error
// classification and section-schema validation/backfill. Kept dependency
// -free (no server-only imports, no DB, no fetch) so it is directly unit
// -testable and reusable from both the API route and agent-providers.ts.

export type ProviderErrorCategory =
  | "missing_configuration"
  | "auth_error"
  | "rate_limit"
  | "timeout"
  | "invalid_response"
  | "provider_error";

const categoryLabels: Record<ProviderErrorCategory, string> = {
  missing_configuration: "yapılandırma eksik",
  auth_error: "yetkilendirme hatası",
  rate_limit: "istek limiti aşıldı",
  timeout: "zaman aşımı",
  invalid_response: "geçersiz yanıt",
  provider_error: "sağlayıcı hatası"
};

/** Classifies a caught provider-call error into a safe, non-leaking
 * category. Never inspects/returns the raw error text to the caller —
 * only the caller's own (already-redacted) message may be logged. */
export function classifyProviderError(error: unknown): ProviderErrorCategory {
  if (error instanceof Error) {
    const tagged = (error as Error & { category?: ProviderErrorCategory }).category;
    if (tagged) return tagged;
    const status = (error as Error & { status?: number }).status;
    if (status === 401 || status === 403) return "auth_error";
    if (status === 429) return "rate_limit";
    if (error.name === "AbortError" || /timed?\s?out|timeout/i.test(error.message)) return "timeout";
    if (/api anahtarı yapılandırılmadı|api key/i.test(error.message) && /yapılandır/i.test(error.message)) return "missing_configuration";
    if (/json|parse|unexpected token/i.test(error.message)) return "invalid_response";
  }
  return "provider_error";
}

export type ProviderFailure = { provider: string; category: ProviderErrorCategory };

/** Builds one safe, differentiated, user-facing Turkish sentence per
 * distinct failure category actually observed — never echoes raw
 * provider/API error text. */
export function buildProviderFailureMessage(failures: ProviderFailure[]): string {
  if (!failures.length) return "AI sağlayıcısı yapılandırılmamış veya yanıt vermedi. AI ayarlarını kontrol edip tekrar deneyin.";
  const seen = new Set<ProviderErrorCategory>();
  const parts: string[] = [];
  for (const failure of failures) {
    if (seen.has(failure.category)) continue;
    seen.add(failure.category);
    parts.push(`${failure.provider}: ${categoryLabels[failure.category]}`);
  }
  return `AI sağlayıcıları kullanılamadı (${parts.join(", ")}). AI ayarlarını kontrol edip tekrar deneyin.`;
}

export type ReportSection = { title: string; summary?: string; items: string[] };

function normalizeTitleForMatch(title: string) {
  return title.toLocaleLowerCase("tr").normalize("NFKD").replace(/[̀-ͯ]/g, "").trim();
}

/** Ensures every required section title is present with at least one real
 * item. Sections the AI actually provided are kept as-is (never
 * discarded); only titles that are missing or empty are backfilled from
 * the deterministic, real-data fallback — never fabricated content. */
export function validateAndBackfillSections(
  aiSections: ReportSection[],
  requiredTitles: string[],
  fallbackSections: ReportSection[]
): { sections: ReportSection[]; backfilledTitles: string[] } {
  const byNormalizedTitle = new Map(aiSections.map((section) => [normalizeTitleForMatch(section.title), section]));
  const fallbackByTitle = new Map(fallbackSections.map((section) => [normalizeTitleForMatch(section.title), section]));
  const backfilledTitles: string[] = [];
  const sections = requiredTitles.map((title) => {
    const key = normalizeTitleForMatch(title);
    const provided = byNormalizedTitle.get(key);
    if (provided && provided.items.length > 0) return provided;
    backfilledTitles.push(title);
    return fallbackByTitle.get(key) || { title, items: ["Bu alan için yeterli veri yok."] };
  });
  // Preserve any extra, non-required sections the AI added on top.
  for (const section of aiSections) {
    if (!requiredTitles.some((title) => normalizeTitleForMatch(title) === normalizeTitleForMatch(section.title))) {
      sections.push(section);
    }
  }
  return { sections, backfilledTitles };
}
