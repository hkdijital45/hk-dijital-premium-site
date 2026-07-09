/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { diagnoseAdPerformance } from "@/lib/hk-intelligence-mvp";
import { buildCustomerGoogleIntelligence } from "@/lib/google-intelligence-phase2";
import { requireModuleAccess } from "@/lib/permissions";

async function requireAdDoctorAccess() {
  return (await requireModuleAccess("ad-insights"))
    || (await requireModuleAccess("google-analiz"))
    || (await requireModuleAccess("meta-analiz"))
    || (await requireModuleAccess("reklam-operasyon-merkezi"));
}

export async function GET(request: NextRequest) {
  const session = await requireAdDoctorAccess();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const customerId = new URL(request.url).searchParams.get("customerId") || new URL(request.url).searchParams.get("companyId") || "";
  if (customerId) {
    const googleIntelligence = await buildCustomerGoogleIntelligence(customerId).catch(() => null);
    return NextResponse.json({
      ok: true,
      status: googleIntelligence?.google?.accessReady ? "connected" : "waiting_data",
      message: googleIntelligence?.google?.message || "Reklam Doktoru için canlı metrik bekleniyor.",
      google: googleIntelligence?.google || null,
      doctor: googleIntelligence?.adDoctor || diagnoseAdPerformance({})
    });
  }

  return NextResponse.json({
    ok: true,
    status: "waiting_data",
    message: "Reklam Doktoru için canlı metrik bekleniyor.",
    doctor: diagnoseAdPerformance({})
  });
}

export async function POST(request: NextRequest) {
  const session = await requireAdDoctorAccess();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });

  const body = await request.json().catch(() => ({} as any));
  return NextResponse.json({
    ok: true,
    doctor: diagnoseAdPerformance(body || {})
  });
}
