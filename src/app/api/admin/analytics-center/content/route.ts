import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { analyticsTablesReady, queryContentMetrics } from "@/lib/analytics-center/metrics-store";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import type { AnalyticsProvider } from "@/lib/analytics-center/types";

const CONTENT_PROVIDERS: AnalyticsProvider[] = ["instagram", "facebook", "tiktok", "youtube"];

export async function GET(request: Request) {
  const session = await requireModuleAccess("analiz-raporlama");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });

  const url = new URL(request.url);
  const companyId = url.searchParams.get("companyId") || "";
  if (!companyId || !uuidPattern.test(companyId)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });

  if (!(await analyticsTablesReady())) return NextResponse.json({ tablesReady: false, content: [] });

  const providersParam = url.searchParams.get("providers");
  const providers = providersParam
    ? providersParam.split(",").filter((p): p is AnalyticsProvider => CONTENT_PROVIDERS.includes(p as AnalyticsProvider))
    : CONTENT_PROVIDERS;

  const startDate = url.searchParams.get("startDate") || new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  const endDate = url.searchParams.get("endDate") || new Date().toISOString().slice(0, 10);

  const content = await queryContentMetrics(companyId, providers, { startDate, endDate }, 100);
  return NextResponse.json({ tablesReady: true, content });
}
