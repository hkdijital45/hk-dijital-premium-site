/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { recordActivity } from "@/lib/activity-log";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { buildCustomerSetupSummary, getCustomerSetupSteps } from "@/lib/customer-onboarding";
import { uuidPattern } from "@/lib/meta-pixel-admin";

const allowedFields = [
  "domain",
  "website_url",
  "cms_provider",
  "hosting_notes",
  "meta_business_id",
  "meta_ad_account_id",
  "meta_pixel_id",
  "meta_dataset_id",
  "meta_page_id",
  "instagram_business_id",
  "meta_access_token_masked",
  "ga4_measurement_id",
  "ga4_property_id",
  "google_ads_customer_id",
  "search_console_site_url",
  "gtm_container_id",
  "google_service_account_email",
  "google_service_account_status",
  "clarity_project_id",
  "hotjar_site_id",
  "preferred_ai_provider",
  "ai_notes"
] as const;

function cleanString(value: unknown) {
  return String(value ?? "").trim();
}

function validatePayload(body: Record<string, any>) {
  const errors: string[] = [];
  const ga4Measurement = cleanString(body.ga4_measurement_id);
  const gtm = cleanString(body.gtm_container_id);
  const metaPixel = cleanString(body.meta_pixel_id);
  const metaDataset = cleanString(body.meta_dataset_id);
  const searchConsole = cleanString(body.search_console_site_url);

  if (ga4Measurement && !ga4Measurement.startsWith("G-")) errors.push("GA4 Measurement ID G- ile başlamalı.");
  if (gtm && !gtm.startsWith("GTM-")) errors.push("GTM ID GTM- ile başlamalı.");
  if (metaPixel && !/^\d+$/.test(metaPixel)) errors.push("Meta Pixel ID sadece rakamlardan oluşmalı.");
  if (metaDataset && !/^\d+$/.test(metaDataset)) errors.push("Meta Dataset ID sadece rakamlardan oluşmalı.");
  if (searchConsole && !/^https?:\/\//i.test(searchConsole)) errors.push("Search Console Site URL http:// veya https:// ile başlamalı.");

  return errors;
}

async function loadContext(companyId: string) {
  const [companyRows, userRows, integrationRows, campaigns, reports] = await Promise.all([
    supabaseRest<any[]>(`companies?id=eq.${encodeURIComponent(companyId)}&select=*&limit=1`),
    supabaseRest<any[]>(`users?company_id=eq.${encodeURIComponent(companyId)}&select=id,is_active,role`).catch(() => []),
    supabaseRest<any[]>(`customer_integrations?company_id=eq.${encodeURIComponent(companyId)}&select=*&limit=1`).catch(() => []),
    supabaseRest<any[]>(`campaigns?company_id=eq.${encodeURIComponent(companyId)}&select=id&limit=1`).catch(() => []),
    supabaseRest<any[]>(`reports?company_id=eq.${encodeURIComponent(companyId)}&select=id&limit=1`).catch(() => [])
  ]);
  return { company: companyRows[0], users: userRows, integration: integrationRows[0] || {}, campaigns, reports };
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("musteriler");
  if (!session) return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekir." }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });

  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });

  try {
    const contextData = await loadContext(id);
    if (!contextData.company) return NextResponse.json({ error: "Müşteri kaydı bulunamadı." }, { status: 404 });
    const steps = getCustomerSetupSteps(contextData.company, contextData.users, contextData.integration, contextData.campaigns, contextData.reports);
    return NextResponse.json({ integration: contextData.integration, setup: buildCustomerSetupSummary(steps) });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title, supabaseError: safe.detail }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("musteriler");
  if (!session) return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekir." }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });

  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const errors = validatePayload(body);
  if (errors.length) return NextResponse.json({ error: "Form doğrulama hatası", details: errors }, { status: 400 });

  const patch: Record<string, unknown> = { company_id: id, updated_by: session.profileId || null, updated_at: new Date().toISOString() };
  for (const field of allowedFields) patch[field] = cleanString(body[field]);
  if (!patch.preferred_ai_provider) patch.preferred_ai_provider = "auto";
  if (!patch.google_service_account_status) patch.google_service_account_status = "not_configured";

  try {
    const contextData = await loadContext(id);
    if (!contextData.company) return NextResponse.json({ error: "Müşteri kaydı bulunamadı." }, { status: 404 });

    const steps = getCustomerSetupSteps(contextData.company, contextData.users, patch, contextData.campaigns, contextData.reports);
    const setup = buildCustomerSetupSummary(steps);
    patch.setup_status = setup;
    patch.setup_progress = setup.progress;
    patch.last_checked_at = new Date().toISOString();
    patch.created_by = contextData.integration?.created_by || session.profileId || null;

    const rows = await supabaseRest<any[]>("customer_integrations?on_conflict=company_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(patch)
    });

    await recordActivity({
      session,
      action: "Güncelleme",
      entity: "Müşteri Entegrasyonları",
      entityId: id,
      companyId: id,
      details: { message: "Müşteri entegrasyon bilgileri güncellendi.", setup_progress: setup.progress, result: "Başarılı" }
    }).catch(() => null);

    return NextResponse.json({ ok: true, integration: rows[0], setup, message: "Entegrasyon bilgileri kaydedildi." });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title, supabaseError: safe.detail }, { status: 500 });
  }
}
