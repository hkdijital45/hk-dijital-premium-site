// Customer resolution + integration status for the HK Marketing
// Intelligence MCP tools. Reuses the exact same canonical sources the rest
// of HK Admin already uses — public.companies (canonical customer id),
// public.customer_integrations (real Meta/Google mapping + tokens), and
// Analiz & Raporlama Merkezi's own connection reader — never a parallel
// customer/integration system.
import { supabaseRest } from "@/lib/supabase";
import { getAllProviderConnectionStatuses } from "@/lib/analytics-center/connections";
import { connectedMetaAdAccountAsset } from "@/lib/marketing-intelligence/ad-accounts";

export type Customer = { id: string; name: string; status?: string | null };

export async function listCustomers(limit = 200): Promise<Customer[]> {
  return supabaseRest<Customer[]>(`companies?select=id,name,status&deleted_at=is.null&order=name.asc&limit=${limit}`);
}

/** Fuzzy name match — never guesses a single result when more than one
 * company plausibly matches; the caller (Claude) must ask the user to
 * disambiguate instead of picking one silently. */
export async function resolveCustomer(query: string): Promise<Customer[]> {
  const term = query.trim();
  if (!term) return [];
  return supabaseRest<Customer[]>(
    `companies?select=id,name,status&deleted_at=is.null&name=ilike.*${encodeURIComponent(term)}*&order=name.asc&limit=10`
  );
}

export type IntegrationStatus =
  | "CONNECTED" | "NOT_CONNECTED" | "ACCOUNT_NOT_MAPPED" | "AUTH_EXPIRED" | "PERMISSION_DENIED" | "NO_DATA" | "ERROR";

export type CustomerIntegrationSummary = {
  companyId: string;
  instagram: IntegrationStatus;
  facebook: IntegrationStatus;
  tiktok: IntegrationStatus;
  youtube: IntegrationStatus;
  metaAds: IntegrationStatus;
  metaAdAccountId: string | null;
  googleAds: IntegrationStatus;
  googleAdsCustomerId: string | null;
};

function mapConnectionStatus(status: string | undefined): IntegrationStatus {
  if (status === "connected") return "CONNECTED";
  if (status === "token_expired" || status === "reauth_required") return "AUTH_EXPIRED";
  if (status === "sync_error") return "ERROR";
  if (status === "no_data") return "NO_DATA";
  return "NOT_CONNECTED";
}

/** Real, non-fabricated per-channel status for one customer. Social
 * channels (instagram/facebook/tiktok/youtube) reuse the same
 * customer_integrations reader Analiz & Raporlama Merkezi already uses.
 * Meta/Google Ads only report whether a real ad account id is mapped —
 * this app has no live campaign-performance reader yet (see
 * meta_ads_account/google_ads_account tool descriptions), so their status
 * never implies performance data is available. */
export async function getCustomerIntegrations(companyId: string): Promise<CustomerIntegrationSummary> {
  const [connections, rows] = await Promise.all([
    getAllProviderConnectionStatuses(companyId),
    supabaseRest<Array<{ meta_ad_account_id: string | null; google_ads_customer_id: string | null; integration_assets: unknown }>>(
      `customer_integrations?company_id=eq.${encodeURIComponent(companyId)}&select=meta_ad_account_id,google_ads_customer_id,integration_assets&limit=1`
    )
  ]);
  const byProvider = new Map(connections.map((c) => [c.provider, c.status]));
  const row = rows[0] || null;
  // Same fix as ad-accounts.ts's getMetaAdsAccount() — the legacy
  // meta_ad_account_id column is never written by the OAuth/HK Connect
  // asset-selection flow, only by manual entry. Fall back to a connected
  // meta_ad_account entry in integration_assets so this MCP-facing status
  // never contradicts what HK Connect itself shows.
  const oauthAdAccountAsset = connectedMetaAdAccountAsset(row?.integration_assets);
  const metaAdAccountId = row?.meta_ad_account_id || oauthAdAccountAsset?.account_id || oauthAdAccountAsset?.asset_id || null;

  return {
    companyId,
    instagram: mapConnectionStatus(byProvider.get("instagram")),
    facebook: mapConnectionStatus(byProvider.get("facebook")),
    tiktok: mapConnectionStatus(byProvider.get("tiktok")),
    youtube: mapConnectionStatus(byProvider.get("youtube")),
    metaAds: metaAdAccountId ? "CONNECTED" : "ACCOUNT_NOT_MAPPED",
    metaAdAccountId,
    googleAds: row?.google_ads_customer_id ? "CONNECTED" : "ACCOUNT_NOT_MAPPED",
    googleAdsCustomerId: row?.google_ads_customer_id || null
  };
}
