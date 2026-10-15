import "server-only";

import { supabaseRest } from "@/lib/supabase";
import { assertUnitLinkedTo } from "@/lib/business-relationships";
import { BusinessRelationshipValidationError } from "@/lib/business-relationships-shared";
import {
  BUSINESS_AD_CAMPAIGN_LINKS_TABLE,
  distinctCampaigns,
  sharedCampaignKeys,
  type AdPlatformKey,
  type BusinessAdCampaignLink,
  type CampaignOption
} from "@/lib/business-ad-scope-shared";

// Server-side store for verified business ↔ campaign links (Reklam Doktoru
// Pro). Every write checks that the business really is linked to the
// customer and that the campaign really exists in that customer's synced
// data — nothing is matched by name.

const enc = encodeURIComponent;

export async function listCampaignOptions(companyId: string): Promise<CampaignOption[]> {
  const since = new Date(Date.now() - 400 * 86400000).toISOString().slice(0, 10);
  const rows = await supabaseRest<Array<Record<string, unknown>>>(
    `campaign_metrics?select=meta_campaign_id,campaign_id,campaign_name,source&company_id=eq.${enc(companyId)}&date=gte.${since}&order=date.desc&limit=5000`
  );
  return distinctCampaigns(rows);
}

export async function listCampaignLinks(companyId: string, businessUnitId?: string): Promise<BusinessAdCampaignLink[]> {
  const unitFilter = businessUnitId ? `&business_unit_id=eq.${enc(businessUnitId)}` : "";
  return supabaseRest<BusinessAdCampaignLink[]>(`${BUSINESS_AD_CAMPAIGN_LINKS_TABLE}?select=*&company_id=eq.${enc(companyId)}${unitFilter}&order=verified_at.desc&limit=500`);
}

export async function verifyCampaignLink(input: { companyId: string; businessUnitId: string; platform: AdPlatformKey; campaignKey: string; adAccountLabel?: string; verifiedBy: string | null; confirmed: boolean }) {
  if (!input.confirmed) throw new BusinessRelationshipValidationError("Kampanya eşleştirmesi kullanıcı tarafından onaylanmalıdır.");
  if (input.platform !== "meta" && input.platform !== "google") throw new BusinessRelationshipValidationError("Geçersiz platform.");
  await assertUnitLinkedTo(input.businessUnitId, { type: "company", id: input.companyId });
  const campaign = (await listCampaignOptions(input.companyId)).find((option) => option.platform === input.platform && option.campaignKey === input.campaignKey);
  if (!campaign) throw new BusinessRelationshipValidationError("Bu kampanya müşterinin senkronize reklam verilerinde bulunamadı.");
  const [row] = await supabaseRest<BusinessAdCampaignLink[]>(BUSINESS_AD_CAMPAIGN_LINKS_TABLE, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      business_unit_id: input.businessUnitId,
      company_id: input.companyId,
      platform: input.platform,
      campaign_key: campaign.campaignKey,
      campaign_name: campaign.campaignName,
      ad_account_label: String(input.adAccountLabel || "").trim().slice(0, 120),
      verified_by: input.verifiedBy
    })
  });
  return row;
}

export async function removeCampaignLink(id: string, companyId: string) {
  const rows = await supabaseRest<BusinessAdCampaignLink[]>(`${BUSINESS_AD_CAMPAIGN_LINKS_TABLE}?id=eq.${enc(id)}&company_id=eq.${enc(companyId)}`, {
    method: "DELETE",
    headers: { Prefer: "return=representation" }
  });
  if (!rows.length) throw new BusinessRelationshipValidationError("Eşleştirme bulunamadı.");
}

/** The verified campaign scope used by Reklam Doktoru for one business. */
export async function getBusinessAdScope(companyId: string, businessUnitId: string) {
  await assertUnitLinkedTo(businessUnitId, { type: "company", id: companyId });
  const all = await listCampaignLinks(companyId);
  const own = all.filter((link) => link.business_unit_id === businessUnitId);
  return { links: own, sharedKeys: sharedCampaignKeys(own, all, businessUnitId) };
}
