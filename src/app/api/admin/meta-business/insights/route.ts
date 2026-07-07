import { NextResponse } from "next/server";
import { fetchMetaInsightsForAccount, tokenForCustomerMetaIntegration } from "@/lib/meta-business-phase2";
import { requireModuleAccess } from "@/lib/permissions";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

export async function GET(request: Request) {
  const session = await requireModuleAccess("ad-insights") || await requireModuleAccess("meta-analiz") || await requireModuleAccess("api-ayarlari");
  if (!session) return NextResponse.json({ ok: false, error: "Yetki gerekli." }, { status: 403 });
  const url = new URL(request.url);
  const companyId = clean(url.searchParams.get("companyId") || url.searchParams.get("customerId"));
  const adAccountId = clean(url.searchParams.get("adAccountId") || url.searchParams.get("accountId"));
  const datePreset = clean(url.searchParams.get("datePreset")) || "last_30d";
  if (!companyId) return NextResponse.json({ ok: false, error: "Müşteri seçilmelidir." }, { status: 400 });
  if (!adAccountId) return NextResponse.json({ ok: false, error: "Meta reklam hesabı seçilmelidir." }, { status: 400 });
  const tokenState = await tokenForCustomerMetaIntegration(companyId);
  if (!tokenState.token) return NextResponse.json({ ok: false, error: tokenState.message || "Önce Meta ile giriş yapın." }, { status: 409 });
  try {
    const data = await fetchMetaInsightsForAccount(tokenState.token, adAccountId, datePreset);
    return NextResponse.json({ ok: true, data, message: "Meta insight adapter çıktısı hazır." });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Meta insight verisi alınamadı." }, { status: 502 });
  }
}
