import { hasSupabaseConfig, supabaseRest } from "./supabase";

export type CustomerCenterData = {
  company: any;
  visibility: any;
  campaigns: any[];
  metrics: any[];
  updates: any[];
  files: any[];
};

const defaultVisibility = {
  show_campaigns: true,
  show_metrics: true,
  show_budget: true,
  show_spent: true,
  show_leads: true,
  show_strategy_notes: true,
  show_work_updates: true,
  show_files: true,
  show_contact_person: true
};

export async function getCustomerCenterData(companyId?: string): Promise<CustomerCenterData> {
  if (hasSupabaseConfig() && !companyId) {
    return {
      company: null,
      visibility: defaultVisibility,
      campaigns: [],
      metrics: [],
      updates: [],
      files: []
    };
  }

  if (hasSupabaseConfig() && companyId) {
    const [companies, visibilityRows, campaigns, metrics, updates, files] = await Promise.all([
      supabaseRest<any[]>(`companies?id=eq.${companyId}&select=*&limit=1`),
      supabaseRest<any[]>(`customer_visibility_settings?company_id=eq.${companyId}&select=*&limit=1`),
      supabaseRest<any[]>(`campaigns?company_id=eq.${companyId}&visible_to_customer=is.true&select=*&order=created_at.desc`),
      supabaseRest<any[]>(`campaign_metrics?company_id=eq.${companyId}&visible_to_customer=is.true&select=*&order=date.desc`),
      supabaseRest<any[]>(`customer_updates?company_id=eq.${companyId}&visible_to_customer=eq.true&select=*&order=created_at.desc`),
      supabaseRest<any[]>(`customer_files?company_id=eq.${companyId}&visible_to_customer=eq.true&select=*&order=uploaded_at.desc`)
    ]);

    return {
      company: companies[0] || null,
      visibility: visibilityRows[0] || defaultVisibility,
      campaigns,
      metrics,
      updates,
      files
    };
  }

  return {
    company: {
      id: "demo-company",
      name: "Demo İşletme",
      sector: "Hizmet Sektörü",
      city: "Manisa",
      website: "",
      instagram: "",
      phone: "",
      email: ""
    },
    visibility: defaultVisibility,
    campaigns: [
      {
        id: "demo-campaign",
        name: "Demo Reklam Çalışması",
        platform: "Meta",
        objective: "Form",
        status: "Hazırlanıyor",
        budget: 0,
        spent: 0,
        notes: "Supabase bağlandığında gerçek kampanya verileri burada gösterilir."
      }
    ],
    metrics: [
      {
        impressions: 0,
        reach: 0,
        clicks: 0,
        ctr: 0,
        cpc: 0,
        cpm: 0,
        leads: 0,
        conversions: 0,
        cost_per_lead: 0,
        spent: 0,
        notes: "Demo mod"
      }
    ],
    updates: [
      {
        id: "demo-update",
        title: "Panel hazırlandı",
        description: "HK Dijital Marketing Center, kampanya ve süreç takibi için hazırlandı.",
        update_type: "Yapılan Çalışma",
        created_at: new Date().toISOString()
      }
    ],
    files: []
  };
}

export function summarizeMetrics(metrics: any[]) {
  return metrics.reduce(
    (total, item) => ({
      impressions: total.impressions + Number(item.impressions || 0),
      reach: total.reach + Number(item.reach || 0),
      clicks: total.clicks + Number(item.clicks || 0),
      messages: total.messages + Number(item.messages || 0),
      spent: total.spent + Number(item.spent || 0),
      leads: total.leads + Number(item.leads || 0),
      cpc: Number(item.cpc || total.cpc || 0),
      cost_per_lead: Number(item.cost_per_lead || total.cost_per_lead || 0)
    }),
    { impressions: 0, reach: 0, clicks: 0, messages: 0, spent: 0, leads: 0, cpc: 0, cost_per_lead: 0 }
  );
}
