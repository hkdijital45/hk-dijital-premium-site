import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getAllProviderConnectionStatuses } from "@/lib/analytics-center/connections";
import type { AnalyticsProvider } from "@/lib/analytics-center/types";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import { PLATFORM_KEYS, type PlatformKey } from "@/lib/content-plan/types";

// Real per-company social platform connection status for İçerik Takip's
// "Sosyal Medya Hesapları" row — reuses the exact same customer_integrations
// reader Analiz & Raporlama Merkezi already uses (getAllProviderConnectionStatuses),
// so the two screens never disagree about what's actually connected. No new
// integration table, no fabricated "connected" state: a platform this app
// has no OAuth provider for (LinkedIn) is always reported manual.
const OAUTH_BACKED: PlatformKey[] = ["instagram", "facebook", "tiktok", "youtube"];

export async function GET(request: Request) {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });

  const companyId = new URL(request.url).searchParams.get("companyId") || "";
  if (!companyId || !uuidPattern.test(companyId)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });

  const connections = await getAllProviderConnectionStatuses(companyId);
  const byProvider = new Map(connections.map((c) => [c.provider, c]));

  const platforms = PLATFORM_KEYS.map((platform) => {
    if (!OAUTH_BACKED.includes(platform)) return { platform, connected: false, manual: true, statusLabel: "Manuel" };
    const connection = byProvider.get(platform as AnalyticsProvider);
    const connected = connection?.status === "connected";
    return { platform, connected, manual: !connected, statusLabel: connection?.statusLabel || "Bağlı değil" };
  });

  return NextResponse.json({ platforms });
}
