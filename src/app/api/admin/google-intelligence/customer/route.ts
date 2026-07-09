import { NextRequest, NextResponse } from "next/server";
import { buildCustomerGoogleIntelligence } from "@/lib/google-intelligence-phase2";
import { requireModuleAccess } from "@/lib/permissions";

async function requireGoogleAccess() {
  return (await requireModuleAccess("google-analiz"))
    || (await requireModuleAccess("hk-intelligence-ceo"))
    || (await requireModuleAccess("ad-insights"))
    || (await requireModuleAccess("reklam-operasyon-merkezi"));
}

export async function GET(request: NextRequest) {
  const session = await requireGoogleAccess();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });

  const url = new URL(request.url);
  const customerId = url.searchParams.get("customerId") || url.searchParams.get("companyId") || "";
  const dateRange = url.searchParams.get("dateRange") || "last_30d";
  if (!customerId) return NextResponse.json({ error: "customerId veya companyId zorunlu" }, { status: 400 });

  const result = await buildCustomerGoogleIntelligence(customerId, dateRange);
  return NextResponse.json({
    ok: true,
    customerId,
    dateRange,
    google: result.google,
    report: result.report,
    adDoctor: result.adDoctor
  });
}
