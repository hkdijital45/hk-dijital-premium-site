import { NextResponse } from "next/server";
import { getSession, isStaffRole } from "@/lib/auth";
import { syncIntegration, type IntegrationProvider } from "@/lib/business-flow";

export async function POST(request: Request) {
  const session = await getSession();
  if (!isStaffRole(session?.role)) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const provider = String(body.provider || "meta") as IntegrationProvider;
  if (!["meta", "google"].includes(provider)) return NextResponse.json({ error: "Geçerli sağlayıcı seçin." }, { status: 400 });
  const result = await syncIntegration(provider, body.integrationId);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
