/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { diagnoseAdPerformance } from "@/lib/hk-intelligence-mvp";
import { requireModuleAccess } from "@/lib/permissions";

async function requireAdDoctorAccess() {
  return (await requireModuleAccess("ad-insights"))
    || (await requireModuleAccess("google-analiz"))
    || (await requireModuleAccess("meta-analiz"))
    || (await requireModuleAccess("reklam-operasyon-merkezi"));
}

export async function GET() {
  const session = await requireAdDoctorAccess();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });

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
