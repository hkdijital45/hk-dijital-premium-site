import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import { duplicateProposal, ProposalNotFoundError } from "@/lib/proposals/store";

async function authorize() {
  return (await requireModuleAccess("teklifler")) || (await requireModuleAccess("crm")) || (await requireModuleAccess("leads"));
}

// Free-standing copy (not linked via previous_proposal_id) for reusing a
// proposal's structure/content as a starting point for a different
// lead/business — always starts as a fresh, unsent Taslak.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await authorize();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçersiz teklif kimliği." }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const companyId = body.companyId !== undefined ? (body.companyId ? String(body.companyId) : null) : undefined;
  const leadId = body.leadId !== undefined ? (body.leadId ? String(body.leadId) : null) : undefined;
  const targetLabel = body.targetLabel ? String(body.targetLabel) : undefined;

  try {
    const proposal = await duplicateProposal(id, { companyId, leadId, targetLabel });
    return NextResponse.json({ proposal });
  } catch (error) {
    if (error instanceof ProposalNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Teklif kopyalanamadı." }, { status: 500 });
  }
}
