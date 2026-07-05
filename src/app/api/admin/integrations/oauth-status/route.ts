import { NextResponse } from "next/server";
import { getOAuthProviderStatus, oauthProviders } from "@/lib/customer-integration-oauth";
import { requireModuleAccess } from "@/lib/permissions";

export async function GET() {
  const session = await requireModuleAccess("api-ayarlari");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 403 });

  const entries = oauthProviders.map((provider) => [provider, getOAuthProviderStatus(provider)]);
  return NextResponse.json(Object.fromEntries(entries));
}
