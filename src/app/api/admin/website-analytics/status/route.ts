import { NextResponse } from "next/server";
import { getSession, isStaffRole } from "@/lib/auth";
import { getMetaDatasetStatus } from "@/lib/meta-conversions-server";
import { getGoogleServiceAccountStatus } from "@/lib/google-analytics-server";
import { getSearchConsoleStatus } from "@/lib/google-search-console-server";
import { getWebsiteAnalyticsIntegrationStatus } from "@/lib/website-analytics";

export async function GET() {
  const session = await getSession();
  if (!isStaffRole(session?.role)) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  const integrationStatus = getWebsiteAnalyticsIntegrationStatus();
  const metaDataset = getMetaDatasetStatus();
  const serviceAccount = getGoogleServiceAccountStatus();
  const searchConsole = getSearchConsoleStatus();

  return NextResponse.json({
    ...integrationStatus,
    checks: {
      metaDataset,
      googleServiceAccount: serviceAccount,
      searchConsole
    },
    security: {
      secretsReturned: false,
      note: "Token, private key ve secret değerleri response içinde döndürülmez; yalnızca durum bilgisi gösterilir."
    }
  });
}
