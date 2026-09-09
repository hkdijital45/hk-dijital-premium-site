// Absolute client-privacy filter (spec section 6). Loads the real-customer
// watchlist live from public.companies/public.customers — the only source
// of truth for "real customer" identity, so this never depends on a
// hardcoded list going stale — and applies the pure scan logic in
// privacy-scan.ts. Never trust AI output not to leak this; this filter is
// enforced server-side on every content item before it can leave
// DRAFT/GENERATED status.
import { supabaseRest } from "@/lib/supabase";
import { digitsOnly, stripDomain, stripHandle, type PrivacyWatchlist } from "./privacy-scan";

export { scanForPrivacyLeaks, type PrivacyLeakHit, type PrivacyWatchlist } from "./privacy-scan";

type CompanyRow = { name?: string | null; website?: string | null; instagram?: string | null; phone?: string | null; email?: string | null };
type CustomerRow = { full_name?: string | null; website?: string | null; instagram?: string | null; phone?: string | null; email?: string | null };

export async function loadPrivacyWatchlist(): Promise<PrivacyWatchlist> {
  const [companies, customers] = await Promise.all([
    supabaseRest<CompanyRow[]>("companies?select=name,website,instagram,phone,email"),
    supabaseRest<CustomerRow[]>("customers?select=full_name,website,instagram,phone,email")
  ]);

  const names = new Set<string>();
  const handles = new Set<string>();
  const domains = new Set<string>();
  const phones = new Set<string>();
  const emails = new Set<string>();

  const addPerson = (row: { website?: string | null; instagram?: string | null; phone?: string | null; email?: string | null }, name?: string | null) => {
    // Only names of at least 4 characters are watched — shorter tokens (e.g.
    // a 2-3 letter company abbreviation) would false-positive on ordinary
    // Turkish words constantly and make the filter useless.
    if (name && name.trim().length >= 4) names.add(name.trim());
    if (row.instagram) handles.add(stripHandle(row.instagram));
    if (row.website) domains.add(stripDomain(row.website));
    if (row.phone && digitsOnly(row.phone).length >= 7) phones.add(digitsOnly(row.phone));
    if (row.email) emails.add(row.email.trim().toLowerCase());
  };

  companies.forEach((row) => addPerson(row, row.name));
  customers.forEach((row) => addPerson(row, row.full_name));

  return {
    names: [...names].filter(Boolean),
    handles: [...handles].filter(Boolean),
    domains: [...domains].filter(Boolean),
    phones: [...phones].filter(Boolean),
    emails: [...emails].filter(Boolean)
  };
}
