/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { uuidPattern } from "@/lib/meta-pixel-admin";

function status(ready: boolean, label: string) {
  return { label, status: ready ? "Hazır" : "Eksik" };
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("musteriler");
  if (!session) return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekir." }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });

  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });

  try {
    const rows = await supabaseRest<any[]>(`customer_integrations?company_id=eq.${encodeURIComponent(id)}&select=*&limit=1`).catch(() => []);
    const integration = rows[0] || {};
    const results = [
      status(Boolean(integration.domain || integration.website_url), "Web sitesi"),
      status(Boolean(integration.meta_business_id || integration.meta_ad_account_id), "Meta Business"),
      status(Boolean(integration.meta_pixel_id), "Meta Pixel"),
      status(Boolean(integration.meta_dataset_id), "Meta Dataset"),
      status(Boolean(integration.ga4_measurement_id || integration.ga4_property_id), "GA4"),
      status(Boolean(integration.search_console_site_url), "Search Console"),
      status(Boolean(integration.google_ads_customer_id), "Google Ads"),
      status(Boolean(integration.gtm_container_id), "Google Tag Manager")
    ];

    return NextResponse.json({
      ok: true,
      results,
      message: "Entegrasyon testi tamamlandı. Secret değerleri kontrol sonucu olarak gösterilir, açık değer döndürülmez."
    });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title, supabaseError: safe.detail }, { status: 500 });
  }
}
