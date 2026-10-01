import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import { resolveHkConnectMetaIdentity } from "@/lib/marketing-intelligence/ad-accounts";

// Read-only — resolves the customer's canonical HK Connect Meta identity
// (same customer_integrations.integration_assets data the Meta sync and
// Ad Insights already read, no second connection system). Used by both
// Customer Profile → Entegrasyonlar → Meta's "HK Connect'ten Getir" (to
// populate the existing form fields, never auto-saved) and "Bağlantıyı
// Doğrula" (same read, shown as a status summary instead). Never returns
// the access token — only a safe status string.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("musteriler");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçersiz müşteri kimliği." }, { status: 400 });

  try {
    const identity = await resolveHkConnectMetaIdentity(id);
    return NextResponse.json({ identity });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "HK Connect bağlantı bilgisi alınamadı." }, { status: 500 });
  }
}
