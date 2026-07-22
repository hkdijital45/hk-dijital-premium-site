// Pure, dependency-free open-redirect guard used by the customer OAuth
// connect/callback flow. Kept in its own file (no Next.js or Supabase
// imports) so it can be unit-tested with a plain Node test runner without
// needing a bundler-aware module loader.
export function safeReturnTo(value: string, fallback = "/musteri-paneli#hesap-bagla") {
  const raw = String(value ?? "").trim() || fallback;
  try {
    const parsed = new URL(raw, "https://hkdijital.local");
    return `${parsed.pathname}${parsed.search}${parsed.hash || "#hesap-bagla"}`;
  } catch {
    return fallback;
  }
}
