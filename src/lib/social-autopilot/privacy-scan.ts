// Pure privacy-leak scanning logic — deliberately dependency-free (no
// server-only/DB imports) so it is directly unit-testable, mirroring the
// existing convention in src/lib/discovery-report-schema.ts. The watchlist
// itself is loaded from the database in privacy-filter.ts; this file only
// applies it.
export type PrivacyLeakHit = { type: "name" | "handle" | "domain" | "phone" | "email"; value: string };

export type PrivacyWatchlist = {
  names: string[];
  handles: string[];
  domains: string[];
  phones: string[];
  emails: string[];
};

export function stripHandle(value: string) {
  return value.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/\/$/, "").trim();
}

export function stripDomain(value: string) {
  return value.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/.*$/, "").trim();
}

export function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

export function scanForPrivacyLeaks(text: string, watchlist: PrivacyWatchlist): PrivacyLeakHit[] {
  if (!text) return [];
  const normalized = text.toLocaleLowerCase("tr");
  const hits: PrivacyLeakHit[] = [];

  for (const name of watchlist.names) {
    if (normalized.includes(name.toLocaleLowerCase("tr"))) hits.push({ type: "name", value: name });
  }
  for (const handle of watchlist.handles) {
    if (handle && normalized.includes(handle.toLocaleLowerCase("tr"))) hits.push({ type: "handle", value: handle });
  }
  for (const domain of watchlist.domains) {
    if (domain && normalized.includes(domain.toLocaleLowerCase("tr"))) hits.push({ type: "domain", value: domain });
  }
  for (const phone of watchlist.phones) {
    if (phone && text.replace(/\D/g, "").includes(phone)) hits.push({ type: "phone", value: phone });
  }
  for (const email of watchlist.emails) {
    if (email && normalized.includes(email)) hits.push({ type: "email", value: email });
  }

  // Generic PII patterns not tied to a known customer — a bare e-mail or
  // Turkish mobile number appearing in AI-generated marketing copy is itself
  // a red flag regardless of whose it is.
  const genericEmail = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (genericEmail && !hits.some((hit) => hit.type === "email")) hits.push({ type: "email", value: genericEmail[0] });
  const genericPhone = text.match(/(?:\+90|0)?\s?5\d{2}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}\b/);
  if (genericPhone && !hits.some((hit) => hit.type === "phone")) hits.push({ type: "phone", value: genericPhone[0] });

  return hits;
}
