import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getAllProviderConnectionStatuses } from "@/lib/analytics-center/connections";
import { analyticsTablesReady } from "@/lib/analytics-center/metrics-store";
import { uuidPattern } from "@/lib/meta-pixel-admin";

export async function GET(request: Request) {
  const session = await requireModuleAccess("analiz-raporlama");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });

  const companyId = new URL(request.url).searchParams.get("companyId") || "";
  if (!companyId || !uuidPattern.test(companyId)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });

  // Connection state lives entirely in customer_integrations (an existing
  // table, unaffected by whether this module's own metrics tables have
  // been migrated yet), so it's always computed — a company's connected
  // accounts should be visible even before the metrics migration runs.
  // Only the metrics/content/sync endpoints actually need tablesReady.
  const [tablesReady, connections] = await Promise.all([analyticsTablesReady(), getAllProviderConnectionStatuses(companyId)]);

  return NextResponse.json({
    tablesReady,
    message: tablesReady ? undefined : "Analiz Merkezi veritabanı tabloları henüz oluşturulmadı. supabase/migrations/20260915_analytics_center.sql migration'ının uygulanması gerekiyor.",
    connections
  });
}
