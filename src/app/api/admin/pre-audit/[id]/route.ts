import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";
import { validatePreAuditReportPatch } from "@/lib/pre-audit/report-actions";
import { getPreAuditReportById } from "@/lib/pre-audit/reports";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("on-inceleme");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });

  const { id } = await params;
  try {
    const report = await getPreAuditReportById(id);
    if (!report) return NextResponse.json({ error: "Rapor bulunamadı." }, { status: 404 });
    return NextResponse.json({ report });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function analysisGroupIdFor(reportId: string): Promise<string | null> {
  const rows = await supabaseRest<Array<{ analysis_group_id: string }>>(`pre_audit_reports?id=eq.${encodeURIComponent(reportId)}&select=analysis_group_id&limit=1`);
  return rows[0]?.analysis_group_id ?? null;
}

// Actions apply to the whole analysis group: an INTERNAL and CLIENT report
// produced together are archived, edited, or deleted as one unit.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("on-inceleme");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: "Geçersiz rapor." }, { status: 400 });
  const checked = validatePreAuditReportPatch(await request.json().catch(() => null));
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
  try {
    const groupId = await analysisGroupIdFor(id);
    if (!groupId) return NextResponse.json({ error: "Rapor bulunamadı." }, { status: 404 });
    await supabaseRest(`pre_audit_reports?analysis_group_id=eq.${encodeURIComponent(groupId)}`, {
      method: "PATCH",
      body: JSON.stringify({ ...checked.patch, updated_at: new Date().toISOString() })
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("on-inceleme");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: "Geçersiz rapor." }, { status: 400 });
  try {
    const groupId = await analysisGroupIdFor(id);
    if (!groupId) return NextResponse.json({ error: "Rapor bulunamadı." }, { status: 404 });
    await supabaseRest(`pre_audit_reports?analysis_group_id=eq.${encodeURIComponent(groupId)}`, { method: "DELETE" });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
