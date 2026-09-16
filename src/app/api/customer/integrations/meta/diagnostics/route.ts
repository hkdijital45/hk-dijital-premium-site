import { NextResponse } from "next/server";
import { getSession, isCustomerPasswordChangeRequired, isCustomerRole, isStaffRole } from "@/lib/auth";
import { canAccessModule } from "@/lib/permissions";
import { advancedScopesEnabled, companyExistsForStaff } from "@/lib/customer-integration-oauth";
import { diagnoseMetaBusinessAccess, publicMetaDiagnostics, tokenForCustomerMetaIntegration } from "@/lib/meta-business-phase2";

// Same staff-preview trust boundary as GET /api/customer/integrations and
// oauthConnect/oauthAccounts/selectOAuthAccount: a customer session always
// gets its own company; a staff session with Analiz & Raporlama Merkezi
// access may read an explicit, validated ?company=. Previously this route
// was customer-only, so HK Admin's Meta diagnostics card had no working
// data source of its own and depended on rendering the customer-panel
// screen instead — this was one of the reasons that screen couldn't be
// removed from the admin OAuth flow.
export async function GET(request: Request) {
  const session = await getSession();
  if (isCustomerPasswordChangeRequired(session)) return NextResponse.json({ ok: false, error: "Önce geçici şifrenizi değiştirmeniz gerekiyor.", redirectTo: "/sifre-degistir" }, { status: 403 });
  let companyId = "";
  if (session && isCustomerRole(session.role) && session.companyId) {
    companyId = session.companyId;
  } else if (session && isStaffRole(session.role) && canAccessModule(session, "analiz-raporlama")) {
    const requestedCompany = new URL(request.url).searchParams.get("company") || "";
    if (requestedCompany && (await companyExistsForStaff(requestedCompany))) companyId = requestedCompany;
  }
  if (!companyId) return NextResponse.json({ ok: false, error: "Müşteri oturumu gerekir." }, { status: 403 });
  const tokenState = await tokenForCustomerMetaIntegration(companyId);
  if (!tokenState.token) {
    return NextResponse.json({
      ok: false,
      businessApiEnabled: advancedScopesEnabled("meta"),
      businessApiReady: false,
      userMessage: tokenState.message || "Önce Meta ile giriş yapın.",
      checks: []
    }, { status: 409 });
  }
  const diagnostics = publicMetaDiagnostics(await diagnoseMetaBusinessAccess(tokenState.token, advancedScopesEnabled("meta")));
  return NextResponse.json({ ok: diagnostics.ok, ...diagnostics });
}
