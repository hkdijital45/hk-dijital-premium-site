// Absolute client-privacy filter. Loads the watchlist from this module's
// OWN social_privacy_blacklist table — never from companies/customers or
// any other HK Admin customer table, never seeded with real client data
// (spec section 10, a hard rule for this task). The table starts empty; add
// protected names, Instagram handles, domains, phone numbers or e-mails
// from Autopilot Ayarları. Applies the pure scan logic in privacy-scan.ts.
import { supabaseRest } from "@/lib/supabase";
import { SOCIAL_WORKSPACE_ID } from "./types";
import type { PrivacyWatchlist } from "./privacy-scan";

export { scanForPrivacyLeaks, type PrivacyLeakHit, type PrivacyWatchlist } from "./privacy-scan";

type BlacklistRow = { kind: "name" | "handle" | "domain" | "phone" | "email"; value: string; active: boolean };

export async function loadPrivacyWatchlist(): Promise<PrivacyWatchlist> {
  const rows = await supabaseRest<BlacklistRow[]>(`social_privacy_blacklist?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&active=eq.true&select=kind,value,active`);
  const watchlist: PrivacyWatchlist = { names: [], handles: [], domains: [], phones: [], emails: [] };
  for (const row of rows) {
    if (row.kind === "name") watchlist.names.push(row.value);
    else if (row.kind === "handle") watchlist.handles.push(row.value);
    else if (row.kind === "domain") watchlist.domains.push(row.value);
    else if (row.kind === "phone") watchlist.phones.push(row.value);
    else if (row.kind === "email") watchlist.emails.push(row.value);
  }
  return watchlist;
}
