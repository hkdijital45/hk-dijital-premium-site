/* eslint-disable @typescript-eslint/no-explicit-any */

export type CustomerSetupStepStatus = "completed" | "missing" | "optional" | "check";

export type CustomerSetupStep = {
  key: string;
  title: string;
  description: string;
  status: CustomerSetupStepStatus;
  actionLabel: string;
  actionHref: string;
};

export type CustomerSetupSummary = {
  totalSteps: number;
  completedSteps: number;
  progress: number;
  missing: CustomerSetupStep[];
  optionalMissing: CustomerSetupStep[];
  steps: CustomerSetupStep[];
};

function hasValue(value: unknown) {
  return Boolean(String(value ?? "").trim());
}

function step(
  key: string,
  title: string,
  description: string,
  completed: boolean,
  actionLabel: string,
  actionHref: string,
  optional = false
): CustomerSetupStep {
  return {
    key,
    title,
    description,
    status: completed ? "completed" : optional ? "optional" : "missing",
    actionLabel,
    actionHref
  };
}

export function getCustomerSetupSteps(
  company: Record<string, any> = {},
  customerUsers: Array<Record<string, any>> = [],
  integrations: Record<string, any> = {},
  campaigns: Array<Record<string, any>> = [],
  reports: Array<Record<string, any>> = []
): CustomerSetupStep[] {
  const companyHref = `/hk-admin/musteriler?companyId=${encodeURIComponent(company.id || "")}`;
  const integrationHref = `${companyHref}&tab=integrations`;

  return [
    step("company", "Firma oluştur", "Firma kaydı sistemde açılmış olmalı.", hasValue(company.id), "Müşteriyi aç", companyHref),
    step("customer_account", "Müşteri hesabı oluştur", "Müşteri paneli için aktif kullanıcı hesabı bulunmalı.", customerUsers.some((user) => user.is_active !== false), "Giriş bilgilerini aç", `${companyHref}&tab=login`),
    step("domain", "Domain gir", "Website URL veya domain bilgisi kaydedilmeli.", hasValue(integrations.domain) || hasValue(integrations.website_url) || hasValue(company.website), "Domain ekle", integrationHref),
    step("meta_business", "Meta Business bağla", "Meta Business ID veya reklam hesabı kaydedilmeli.", hasValue(integrations.meta_business_id) || hasValue(integrations.meta_ad_account_id), "Meta bilgisi gir", integrationHref),
    step("pixel", "Pixel ekle", "Meta Pixel ID girilmeli.", hasValue(integrations.meta_pixel_id), "Pixel ekle", integrationHref),
    step("dataset", "Dataset ekle", "Meta Dataset ID server-side olay eşleşmesi için girilmeli.", hasValue(integrations.meta_dataset_id), "Dataset ekle", integrationHref),
    step("ga4", "GA4 bağla", "GA4 Measurement ID veya Property ID kaydedilmeli.", hasValue(integrations.ga4_measurement_id) || hasValue(integrations.ga4_property_id), "GA4 ekle", integrationHref),
    step("search_console", "Search Console bağla", "Search Console Site URL kaydedilmeli.", hasValue(integrations.search_console_site_url), "Search Console ekle", integrationHref),
    step("google_ads", "Google Ads bağla", "Google Ads Customer ID kaydedilmeli.", hasValue(integrations.google_ads_customer_id), "Google Ads ekle", integrationHref),
    step("gtm", "Tag Manager bağla", "GTM container ID girilmeli.", hasValue(integrations.gtm_container_id), "GTM ekle", integrationHref),
    step("clarity", "Clarity bağla", "Microsoft Clarity davranış analitiği opsiyoneldir.", hasValue(integrations.clarity_project_id), "Clarity ekle", integrationHref, true),
    step("hotjar", "Hotjar bağla", "Hotjar davranış ve geri bildirim analitiği opsiyoneldir.", hasValue(integrations.hotjar_site_id), "Hotjar ekle", integrationHref, true),
    step("first_campaign", "İlk kampanyayı oluştur", "Müşteriye bağlı en az bir kampanya olmalı.", campaigns.length > 0, "Kampanya oluştur", `/hk-admin/kampanyalar?companyId=${encodeURIComponent(company.id || "")}`),
    step("first_report", "İlk raporu oluştur", "Müşteriye bağlı en az bir rapor olmalı.", reports.length > 0, "Rapor oluştur", `/hk-admin/raporlar?companyId=${encodeURIComponent(company.id || "")}`)
  ];
}

export function calculateCustomerSetupProgress(steps: CustomerSetupStep[]) {
  const required = steps.filter((item) => item.status !== "optional");
  const completed = required.filter((item) => item.status === "completed").length;
  return required.length ? Math.round((completed / required.length) * 100) : 0;
}

export function getMissingCustomerSetupItems(steps: CustomerSetupStep[]) {
  return steps.filter((item) => item.status === "missing");
}

export function buildCustomerSetupSummary(steps: CustomerSetupStep[]): CustomerSetupSummary {
  const required = steps.filter((item) => item.status !== "optional");
  const completedSteps = required.filter((item) => item.status === "completed").length;
  const optionalMissing = steps.filter((item) => item.status === "optional");
  return {
    totalSteps: steps.length,
    completedSteps,
    progress: calculateCustomerSetupProgress(steps),
    missing: getMissingCustomerSetupItems(steps),
    optionalMissing,
    steps
  };
}
