// Reklam Doktoru Pro — business-level ad scope (pure helpers).
//
// A branch / related brand's ad performance is NEVER inferred from its name,
// Instagram handle or the customer's whole ad account. It is computed only
// from campaigns a staff member explicitly verified as belonging to that
// business (business_ad_campaign_links). Synced metric rows carry no reliable
// ad-account id, so the campaign is the smallest safe, verifiable unit — it
// also handles two brands sharing one ad account: each brand gets only its
// own verified campaigns.

export const BUSINESS_AD_CAMPAIGN_LINKS_TABLE = "business_ad_campaign_links";

export type AdPlatformKey = "meta" | "google";

export type BusinessAdCampaignLink = {
  id: string;
  business_unit_id: string;
  company_id: string;
  platform: AdPlatformKey;
  campaign_key: string;
  campaign_name: string;
  ad_account_label: string;
  verified_by: string | null;
  verified_at: string;
};

export type CampaignOption = { platform: AdPlatformKey; campaignKey: string; campaignName: string };

type MetricRow = Record<string, unknown>;

export function platformOf(row: MetricRow): AdPlatformKey {
  return String(row.source || "").toLocaleLowerCase("tr").includes("google") ? "google" : "meta";
}

/** Stable per-campaign identity inside one customer's synced data. */
export function campaignKeyOf(row: MetricRow): string {
  const id = row.meta_campaign_id || row.google_campaign_id || row.campaign_id || row.campaign_name;
  return id ? String(id) : "";
}

/** Distinct campaigns present in a customer's synced metric rows. */
export function distinctCampaigns(rows: MetricRow[]): CampaignOption[] {
  const map = new Map<string, CampaignOption>();
  for (const row of rows) {
    const campaignKey = campaignKeyOf(row);
    if (!campaignKey) continue;
    const platform = platformOf(row);
    const id = `${platform}:${campaignKey}`;
    if (!map.has(id)) map.set(id, { platform, campaignKey, campaignName: String(row.campaign_name || row.name || campaignKey) });
  }
  return [...map.values()].sort((a, b) => a.platform.localeCompare(b.platform) || a.campaignName.localeCompare(b.campaignName, "tr"));
}

/** Keeps only rows of the verified campaigns — platform-aware, so a Meta
 * campaign id can never match a Google row and vice versa. */
export function filterRowsToVerifiedCampaigns<T extends MetricRow>(rows: T[], links: Array<Pick<BusinessAdCampaignLink, "platform" | "campaign_key">>): T[] {
  if (!links.length) return [];
  const allowed = new Set(links.map((link) => `${link.platform}:${link.campaign_key}`));
  return rows.filter((row) => {
    const key = campaignKeyOf(row);
    return key !== "" && allowed.has(`${platformOf(row)}:${key}`);
  });
}

/** Verified campaigns that another business of the same customer also
 * claims — their numbers are the campaign's total, not this business's
 * exclusive performance, and the UI must say so. */
export function sharedCampaignKeys(own: Array<Pick<BusinessAdCampaignLink, "platform" | "campaign_key">>, all: Array<Pick<BusinessAdCampaignLink, "platform" | "campaign_key" | "business_unit_id">>, unitId: string): string[] {
  const ownKeys = new Set(own.map((link) => `${link.platform}:${link.campaign_key}`));
  const shared = new Set<string>();
  for (const link of all) {
    const key = `${link.platform}:${link.campaign_key}`;
    if (link.business_unit_id !== unitId && ownKeys.has(key)) shared.add(key);
  }
  return [...shared];
}
