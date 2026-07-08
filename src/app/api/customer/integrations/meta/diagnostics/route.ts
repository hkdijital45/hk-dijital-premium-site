import { NextResponse } from "next/server";
import { getSession, isCustomerRole } from "@/lib/auth";
import { diagnoseMetaBusinessAccess, publicMetaDiagnostics, tokenForCustomerMetaIntegration } from "@/lib/meta-business-phase2";

export async function GET() {
  const session = await getSession();
  if (!session || !isCustomerRole(session.role) || !session.companyId) {
    return NextResponse.json({ ok: false, error: "Müşteri oturumu gerekir." }, { status: 403 });
  }
  const tokenState = await tokenForCustomerMetaIntegration(session.companyId);
  if (!tokenState.token) {
    return NextResponse.json({
      ok: false,
      businessApiEnabled: process.env.META_ADVANCED_SCOPES_ENABLED === "true",
      businessApiReady: false,
      userMessage: tokenState.message || "Önce Meta ile giriş yapın.",
      checks: []
    }, { status: 409 });
  }
  const diagnostics = publicMetaDiagnostics(await diagnoseMetaBusinessAccess(tokenState.token, process.env.META_ADVANCED_SCOPES_ENABLED === "true"));
  return NextResponse.json({ ok: diagnostics.ok, ...diagnostics });
}
