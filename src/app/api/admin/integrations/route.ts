import { NextResponse } from "next/server";
import { getSession, isStaffRole } from "@/lib/auth";
import { getIntegrations, safeIntegrationForClient, upsertIntegration, type IntegrationProvider } from "@/lib/business-flow";
import { getSafeSupabaseError, hasSupabaseConfig } from "@/lib/supabase";

async function requireStaff() {
  const session = await getSession();
  return isStaffRole(session?.role) ? session : null;
}

export async function GET(request: Request) {
  if (!(await requireStaff())) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  if (!hasSupabaseConfig()) return NextResponse.json({ integrations: [], warning: "Supabase bağlantısı yapılandırılmadı." });
  const provider = new URL(request.url).searchParams.get("provider") as IntegrationProvider | null;
  const rows = await getIntegrations(provider || undefined);
  return NextResponse.json({ integrations: rows.map(safeIntegrationForClient) });
}

export async function POST(request: Request) {
  if (!(await requireStaff())) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });
  try {
    const body = await request.json();
    const rows = await upsertIntegration({
      provider: body.provider,
      companyId: body.companyId,
      businessAccountId: body.businessAccountId,
      adAccountId: body.adAccountId,
      pageId: body.pageId,
      instagramAccountId: body.instagramAccountId,
      customerAccountId: body.customerAccountId,
      accessToken: body.accessToken,
      refreshToken: body.refreshToken,
      autoSync: body.autoSync
    });
    return NextResponse.json({ ok: true, integration: safeIntegrationForClient(rows[0]), message: "Bağlantı bilgileri güvenli şekilde kaydedildi." });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title, detail: safe.detail }, { status: 500 });
  }
}
