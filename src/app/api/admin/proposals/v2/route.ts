import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import { createProposal, listProposals, ProposalValidationError, PROPOSAL_STATUSES, type ProposalStatus } from "@/lib/proposals/store";

// /v2 — the new persisted Teklif Motoru (proposals table), additive and
// separate from the existing stateless /api/admin/proposals/pdf route
// (which has no DB-backed proposal to read from and is left untouched).
function isValidStatus(value: string): value is ProposalStatus {
  return (PROPOSAL_STATUSES as readonly string[]).includes(value);
}

export async function GET(request: Request) {
  const session = await requireModuleAccess("teklifler") || await requireModuleAccess("crm") || await requireModuleAccess("leads");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId") || undefined;
  const leadId = searchParams.get("leadId") || undefined;
  const status = searchParams.get("status") || undefined;
  if (companyId && !uuidPattern.test(companyId)) return NextResponse.json({ error: "Geçersiz müşteri kimliği." }, { status: 400 });
  if (leadId && !uuidPattern.test(leadId)) return NextResponse.json({ error: "Geçersiz lead kimliği." }, { status: 400 });
  if (status && !isValidStatus(status)) return NextResponse.json({ error: "Geçersiz durum." }, { status: 400 });

  try {
    const proposals = await listProposals({ companyId, leadId, status: status as ProposalStatus | undefined });
    return NextResponse.json({ proposals });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Beklenmeyen hata." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireModuleAccess("teklifler") || await requireModuleAccess("crm") || await requireModuleAccess("leads");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const companyId = body.companyId ? String(body.companyId) : null;
  const leadId = body.leadId ? String(body.leadId) : null;
  if (companyId && !uuidPattern.test(companyId)) return NextResponse.json({ error: "Geçersiz müşteri kimliği." }, { status: 400 });
  if (leadId && !uuidPattern.test(leadId)) return NextResponse.json({ error: "Geçersiz lead kimliği." }, { status: 400 });
  const targetLabel = String(body.targetLabel || "").trim();
  if (!targetLabel) return NextResponse.json({ error: "İşletme/lead adı zorunludur." }, { status: 400 });

  try {
    const proposal = await createProposal({
      companyId, leadId, targetLabel,
      title: body.title ? String(body.title) : undefined,
      questionnaire: body.questionnaire && typeof body.questionnaire === "object" ? body.questionnaire : {},
      createdBy: session.profileId || null
    });
    return NextResponse.json({ proposal });
  } catch (error) {
    if (error instanceof ProposalValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Teklif oluşturulamadı." }, { status: 500 });
  }
}
