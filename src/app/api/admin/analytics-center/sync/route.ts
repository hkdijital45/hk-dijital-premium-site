import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity-log";
import { syncCompanyAnalytics, defaultSyncRange } from "@/lib/analytics-center/sync";
import { analyticsTablesReady } from "@/lib/analytics-center/metrics-store";
import { ANALYTICS_PROVIDERS } from "@/lib/analytics-center/types";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import type { AnalyticsProvider } from "@/lib/analytics-center/types";

export async function POST(request: Request) {
  const session = await requireModuleAccess("analiz-raporlama");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });

  if (!(await analyticsTablesReady())) {
    return NextResponse.json({ error: "Analiz Merkezi veritabanı tabloları henüz oluşturulmadı. Migration uygulanmalı." }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const companyId = String(body.companyId || "");
  if (!companyId || !uuidPattern.test(companyId)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });

  const requestedProviders: AnalyticsProvider[] = Array.isArray(body.providers) && body.providers.length
    ? body.providers.filter((p: string) => ANALYTICS_PROVIDERS.includes(p as AnalyticsProvider))
    : ANALYTICS_PROVIDERS;

  const range = body.startDate && body.endDate ? { startDate: body.startDate, endDate: body.endDate } : defaultSyncRange();

  const results = await syncCompanyAnalytics(companyId, requestedProviders, range);

  await recordActivity({
    session,
    action: "API İşlemi",
    entity: "Analiz Merkezi",
    companyId,
    details: { message: `Analiz Merkezi senkronizasyonu çalıştırıldı (${requestedProviders.join(", ")}).`, results }
  }).catch(() => null);

  return NextResponse.json({ ok: true, results });
}
