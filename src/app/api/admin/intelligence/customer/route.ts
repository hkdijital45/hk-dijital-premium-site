/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { buildHKIntelligenceReport } from "@/lib/hk-intelligence-mvp";
import { buildCustomerGoogleIntelligence } from "@/lib/google-intelligence-phase2";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

async function requireIntelligenceAccess() {
  return (await requireModuleAccess("hk-intelligence-ceo"))
    || (await requireModuleAccess("google-analiz"))
    || (await requireModuleAccess("ad-insights"))
    || (await requireModuleAccess("reklam-operasyon-merkezi"));
}

export async function GET(request: NextRequest) {
  const session = await requireIntelligenceAccess();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });

  const url = new URL(request.url);
  const customerId = url.searchParams.get("customerId") || url.searchParams.get("companyId") || "";
  const dateRange = url.searchParams.get("dateRange") || "last_30d";
  if (!customerId) {
    return NextResponse.json({ error: "customerId veya companyId zorunlu" }, { status: 400 });
  }

  if (!hasSupabaseConfig()) {
    return NextResponse.json({
      ok: true,
      source: "fallback",
      report: buildHKIntelligenceReport({ customerId, dateRange })
    });
  }

  try {
    const companyRows = await supabaseRest<any[]>(`companies?id=eq.${encodeURIComponent(customerId)}&select=*&limit=1`).catch(() => []);
    const integrationRows = await supabaseRest<any[]>(`customer_integrations?or=(company_id.eq.${encodeURIComponent(customerId)},customer_id.eq.${encodeURIComponent(customerId)})&select=*&limit=1`).catch(() => []);
    const company = Array.isArray(companyRows) ? companyRows[0] : null;
    const integration = Array.isArray(integrationRows) ? integrationRows[0] : null;

    const googleIntelligence = await buildCustomerGoogleIntelligence(customerId, dateRange).catch(() => null);
    return NextResponse.json({
      ok: true,
      source: "supabase",
      google: googleIntelligence?.google || null,
      report: googleIntelligence?.report || buildHKIntelligenceReport({ customerId, company: company || {}, integration: integration || {}, dateRange })
    });
  } catch (error) {
    const safeError = getSafeSupabaseError(error);
    return NextResponse.json({
      ok: false,
      error: safeError.title,
      message: safeError.detail,
      report: buildHKIntelligenceReport({ customerId, dateRange })
    }, { status: 200 });
  }
}
